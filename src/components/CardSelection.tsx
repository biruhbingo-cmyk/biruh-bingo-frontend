'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { API_URL, getGameState, getGames, calculatePotentialWin, checkUserInGame, getPlayerCardId, type User, type Wallet, type Game } from '@/lib/api';
import { useGameStore } from '@/store/gameStore';
import { useGameWebSocket, type WebSocketMessage } from '@/hooks/useSocket';
import axios from 'axios';
import { getCardData } from '@/lib/cardData';

// Generate 100 card IDs
const CARD_IDS = Array.from({ length: 100 }, (_, i) => i + 1);

interface CardSelectionProps {
  user: User;
  wallet: Wallet;
}

interface CardData {
  id: number;
  numbers: number[][];
}

export default function CardSelection({ user, wallet }: CardSelectionProps) {
  const searchParams = useSearchParams();
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [selectedCardData, setSelectedCardData] = useState<CardData | null>(null);
  const [joining, setJoining] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [takenCards, setTakenCards] = useState<Set<number>>(new Set());
  const [isUserInGame, setIsUserInGame] = useState<boolean>(false);
  // Track processed NEW_GAME_AVAILABLE events to prevent duplicates
  const processedGamesRef = useRef<Set<string>>(new Set());
  // Track games currently being fetched to prevent concurrent fetches
  const fetchingGamesRef = useRef<Set<string>>(new Set());
  
  const { setCurrentView, setSelectedCardId: setStoreCardId, currentGameId, selectedGameType, selectedGameTypeString, setCurrentGameId, selectedCardId: storeCardId } = useGameStore();

  // Connect to WebSocket for real-time updates (by game type - recommended)
  const socket = useGameWebSocket(selectedGameTypeString, currentGameId);

  // Fetch initial game state and check if user is already in game
  useEffect(() => {
    const fetchGameData = async () => {
      if (currentGameId && user?.id) {
        try {
          const gameState = await getGameState(currentGameId);
          setGame(gameState.game);
          // Set initial taken cards
          if (gameState.takenCards && Array.isArray(gameState.takenCards)) {
            setTakenCards(new Set(gameState.takenCards));
          }
          
          // Check if user is already in the game
          const userInGame = await checkUserInGame(currentGameId, user.id);
          setIsUserInGame(userInGame);
          
          // Also check if user's card from store is in taken cards (fallback check)
          if (!userInGame && storeCardId && gameState.takenCards) {
            const cardInTaken = gameState.takenCards.includes(storeCardId);
            if (cardInTaken) {
              setIsUserInGame(true);
            }
          }
        } catch (error) {
          console.error('Error fetching game data:', error);
          setIsUserInGame(false);
        }
      } else {
        setIsUserInGame(false);
      }
    };

    fetchGameData();
  }, [currentGameId, user?.id, storeCardId]);

  // Listen to WebSocket messages for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        switch (message.event) {
          case 'INITIAL_STATE':
            if (message.data.game) {
              setGame(message.data.game);
            }
            // Update taken cards from initial state
            if (message.data.takenCards && Array.isArray(message.data.takenCards)) {
              setTakenCards(new Set(message.data.takenCards));
            }
            break;

          case 'GAME_STATUS':
            // Check if this is a FINISHED/CANCELLED status message
            if (message.data.status === 'FINISHED' || message.data.status === 'CANCELLED') {
              if (currentGameId) {
                console.log(`🔄 Game status FINISHED/CANCELLED for gameId=${currentGameId}`);
                // Clear the game - wait for NEW_GAME_AVAILABLE
                setGame(null);
                // Clean up processed games ref
                processedGamesRef.current.delete(currentGameId);
                // Clear currentGameId so we can set it to the new game
                setCurrentGameId(null);
              }
              break;
            }
            
            // Regular GAME_STATUS with state update
            if (message.data.state) {
              // If state is FINISHED or CANCELLED, clear the game
              if (message.data.state === 'FINISHED' || message.data.state === 'CANCELLED') {
                if (currentGameId) {
                  console.log(`🔄 Game state FINISHED/CANCELLED for gameId=${currentGameId}`);
                  setGame(null);
                  processedGamesRef.current.delete(currentGameId);
                  setCurrentGameId(null);
                }
              } else {
                setGame((prev) => prev ? { 
                  ...prev, 
                  state: message.data.state,
                  player_count: message.data.player_count ?? prev.player_count,
                  prize_pool: message.data.prize_pool ?? prev.prize_pool
                } : null);
              }
            }
            break;

          case 'PLAYER_COUNT':
            if (message.data.count !== undefined) {
              setGame((prev) => prev ? { ...prev, player_count: message.data.count } : null);
            }
            break;

          case 'PLAYER_JOINED':
            // Update player count and add card to taken cards
            setGame((prev) => {
              if (!prev) return null;
              
              let newPlayerCount: number;
              if (message.data.count !== undefined) {
                newPlayerCount = message.data.count;
              } else {
                newPlayerCount = (prev.player_count || 0) + 1;
              }
              
              return {
                ...prev,
                player_count: newPlayerCount,
                prize_pool: message.data.prize_pool ?? prev.prize_pool,
              };
            });
            // Add card to taken cards if card_id is provided
            if (message.data.card_id !== undefined) {
              setTakenCards((prev) => new Set([...prev, message.data.card_id]));
              // If this is the current user's card, update isUserInGame
              if (message.data.card_id === storeCardId && user?.id && currentGameId) {
                checkUserInGame(currentGameId, user.id)
                  .then((inGame) => setIsUserInGame(inGame))
                  .catch(() => {
                    // Fallback: if user's card is in taken cards, assume they're in game
                    setIsUserInGame(true);
                  });
              }
            }
            break;

          case 'PLAYER_LEFT':
            // Update player count when players leave
            setGame((prev) => {
              if (!prev) return null;
              
              let newPlayerCount: number;
              if (message.data.count !== undefined) {
                newPlayerCount = message.data.count;
              } else {
                newPlayerCount = Math.max(0, (prev.player_count || 0) - 1);
              }
              
              return {
                ...prev,
                player_count: newPlayerCount,
                prize_pool: message.data.prize_pool ?? prev.prize_pool,
              };
            });
            
            // Refresh taken cards from server to ensure accuracy
            // This ensures the leaving player's card is removed unless another player has it
            if (currentGameId) {
              getGameState(currentGameId)
                .then((gameState) => {
                  if (gameState.takenCards && Array.isArray(gameState.takenCards)) {
                    setTakenCards(new Set(gameState.takenCards));
                    console.log('🔄 Refreshed taken cards after player left:', gameState.takenCards);
                    
                    // Re-check if user is still in game
                    if (user?.id) {
                      checkUserInGame(currentGameId, user.id)
                        .then((inGame) => {
                          setIsUserInGame(inGame);
                          // Fallback: check if user's card is in taken cards
                          if (!inGame && storeCardId && gameState.takenCards.includes(storeCardId)) {
                            setIsUserInGame(true);
                          }
                        })
                        .catch(() => {
                          // Fallback: check if user's card is in taken cards
                          if (storeCardId && gameState.takenCards.includes(storeCardId)) {
                            setIsUserInGame(true);
                          } else {
                            setIsUserInGame(false);
                          }
                        });
                    }
                  }
                })
                .catch((err) => {
                  console.error('Error refreshing taken cards after player left:', err);
                  // Fallback: Remove card from taken cards if card_id is provided
                  if (message.data.card_id !== undefined) {
                    setTakenCards((prev) => {
                      const newSet = new Set(prev);
                      newSet.delete(message.data.card_id);
                      return newSet;
                    });
                    // If user's card was removed, update isUserInGame
                    if (message.data.card_id === storeCardId && user?.id) {
                      setIsUserInGame(false);
                    }
                  }
                });
            } else {
              // Fallback: Remove card from taken cards if card_id is provided and no gameId
              if (message.data.card_id !== undefined) {
                setTakenCards((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(message.data.card_id);
                  return newSet;
                });
                // If user's card was removed, update isUserInGame
                if (message.data.card_id === storeCardId) {
                  setIsUserInGame(false);
                }
              }
            }
            break;

          case 'COUNTDOWN':
            // Countdown updates - game state should already be COUNTDOWN
            // Could update countdown_ends if needed
            break;

          case 'CARDS_TAKEN':
            // Update taken cards list
            if (message.data.takenCards && Array.isArray(message.data.takenCards)) {
              setTakenCards(new Set(message.data.takenCards));
            }
            break;

          case 'NUMBER_DRAWN':
            // Number drawn - update game state to DRAWING if it's still WAITING or COUNTDOWN
            setGame((prev) => {
              if (!prev) return null;
              
              // If game is in COUNTDOWN or WAITING state, transition to DRAWING
              if (prev.state === 'COUNTDOWN' || prev.state === 'WAITING') {
                console.log(`🔄 Updating state from ${prev.state} to DRAWING (number drawn)`);
                return { ...prev, state: 'DRAWING' };
              }
              
              return prev;
            });
            break;

          case 'PLAYER_ELIMINATED':
            // Player eliminated - could update player count
            if (message.data.count !== undefined) {
              setGame((prev) => prev ? { ...prev, player_count: message.data.count } : null);
            }
            break;

          case 'WINNER':
            // Game finished - clear the game and wait for NEW_GAME_AVAILABLE
            if (currentGameId) {
              console.log(`🏆 Winner announced for gameId=${currentGameId}`);
              setGame(null);
              processedGamesRef.current.delete(currentGameId);
              setCurrentGameId(null);
            }
            break;

          case 'NEW_GAME_AVAILABLE':
            // New game is available - fetch and update currentGameId
            const processingId = `${selectedGameTypeString}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            console.log(`🎮 [${processingId}] New game available for ${selectedGameTypeString}:`, message.data);
            if (message.data.gameId && message.data.gameType === selectedGameTypeString) {
              const gameId = message.data.gameId;
              
              // Check if we've already processed this game ID to prevent duplicates
              if (processedGamesRef.current.has(gameId)) {
                console.log(`⚠️ [${processingId}] Game ${gameId} already processed for ${selectedGameTypeString}, skipping duplicate`);
                return;
              }
              
              // Check if we're already fetching this game
              if (fetchingGamesRef.current.has(gameId)) {
                console.log(`⚠️ [${processingId}] Game ${gameId} already being fetched for ${selectedGameTypeString}, skipping duplicate fetch`);
                return;
              }
              
              // Mark as fetching to prevent concurrent fetches
              fetchingGamesRef.current.add(gameId);
              
              // Mark as processing to prevent duplicate processing BEFORE async call
              processedGamesRef.current.add(gameId);
              
              console.log(`📥 [${processingId}] Fetching game state for ${gameId} (${selectedGameTypeString})...`);
              
              // Helper function to fetch game with retry logic
              const fetchGameWithRetry = async (retryCount: number = 0, maxRetries: number = 3): Promise<Game | null> => {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 3000); // Exponential backoff: 1s, 2s, 3s
                
                if (retryCount > 0) {
                  console.log(`⏳ [${processingId}] Retrying fetch (attempt ${retryCount + 1}/${maxRetries + 1}) after ${delay}ms delay...`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                try {
                  // Try getGameState first
                  const gameState = await getGameState(gameId);
                  if (gameState?.game) {
                    return gameState.game;
                  }
                } catch (error: any) {
                  // If getGameState fails, try getGames as fallback
                  if (retryCount < maxRetries) {
                    console.warn(`⚠️ [${processingId}] getGameState failed (attempt ${retryCount + 1}), will retry:`, error.message);
                    return fetchGameWithRetry(retryCount + 1, maxRetries);
                  }
                  
                  // Last attempt: try getGames fallback
                  console.warn(`⚠️ [${processingId}] getGameState failed, trying getGames fallback...`);
                  try {
                    const games = await getGames(selectedGameTypeString || undefined);
                    const newGame = games.find((g) => g.id === gameId);
                    if (newGame) {
                      console.log(`✅ [${processingId}] Found new game via getGames fallback`);
                      return newGame;
                    }
                  } catch (fallbackError) {
                    console.error(`❌ [${processingId}] getGames fallback also failed:`, fallbackError);
                  }
                  
                  // If still failing and we have retries left, retry
                  if (retryCount < maxRetries) {
                    return fetchGameWithRetry(retryCount + 1, maxRetries);
                  }
                  
                  throw error;
                }
                
                return null;
              };
              
              // Fetch with retry logic (handles timing issue where game might not be in DB yet)
              setTimeout(() => {
                fetchGameWithRetry()
                  .then((newGame) => {
                    if (newGame) {
                      console.log(`✅ [${processingId}] Successfully fetched new game ${newGame.id} for ${selectedGameTypeString}`);
                      // Update currentGameId to the new game
                      setCurrentGameId(newGame.id);
                      // Update game state
                      setGame(newGame);
                      // Set initial taken cards if available
                      if (newGame.id) {
                        getGameState(newGame.id)
                          .then((gameState) => {
                            if (gameState.takenCards && Array.isArray(gameState.takenCards)) {
                              setTakenCards(new Set(gameState.takenCards));
                            }
                          })
                          .catch((err) => {
                            console.error('Error fetching taken cards for new game:', err);
                          });
                      }
                    } else {
                      console.error(`❌ [${processingId}] Could not fetch new game ${gameId} after all retries`);
                      // Remove from processed set so we can retry later
                      processedGamesRef.current.delete(gameId);
                      fetchingGamesRef.current.delete(gameId);
                    }
                  })
                  .catch((error) => {
                    console.error(`❌ [${processingId}] Failed to fetch new game ${gameId} after all retries:`, error);
                    // Remove from processed set on error, so we can retry
                    processedGamesRef.current.delete(gameId);
                    fetchingGamesRef.current.delete(gameId);
                  })
                  .finally(() => {
                    // Always remove from fetching set when done
                    fetchingGamesRef.current.delete(gameId);
                  });
              }, 1500); // Initial 1.5s delay to ensure backend has committed the game to DB
            }
            break;

          default:
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.addEventListener('message', handleMessage);

    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket, currentGameId, selectedGameTypeString, setCurrentGameId, user, storeCardId]);

  const handleCardClick = (cardId: number) => {
    setSelectedCardId(cardId);
    
    // Get card data from local storage (fast, no API call)
    const cardNumbers = getCardData(cardId);
    if (cardNumbers) {
      setSelectedCardData({
        id: cardId,
        numbers: cardNumbers,
      });
    } else {
      alert('Invalid card ID');
    }
  };

  const handleJoinGame = async () => {
    if (!selectedCardId || !currentGameId) {
      alert('Please select a card');
      return;
    }

    if (!user || !user.id) {
      alert('User information not found');
      return;
    }

    setJoining(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/v1/games/${currentGameId}/join`,
        {
          user_id: user.id, // Use user UUID, not telegram_id
          card_id: selectedCardId,
        }
      );

      if (response.data.player) {
        setStoreCardId(selectedCardId);
        setCurrentView('play');
      }
    } catch (err: any) {
      console.error('Error joining game:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to join game';
      alert(errorMessage);
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="min-h-screen bg-blue-600 text-white flex flex-col">
      {/* Back Button and Balance */}
      <div className="px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between flex-shrink-0 bg-blue-600">
        <button
          onClick={() => setCurrentView('selection')}
          className="hover:text-blue-200 text-white text-sm sm:text-base flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 font-bold"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">ተመለስ</span>
        </button>
        
        {/* Balance */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 00-2 2v1a16.94 16.94 0 0012 6 16.94 16.94 0 0012-6V6a2 2 0 00-2-2H4z" />
            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
          </svg>
          <span className="text-yellow-300 font-bold text-sm sm:text-lg">
            {wallet.balance.toFixed(2)} ETB
          </span>
        </div>
      </div>

      {/* Continue as Before Button - Only show if user is already in game */}
      {isUserInGame && (
        <div className="px-2 sm:px-4 py-2 sm:py-3 bg-green-600 border-b-2 border-green-500 flex-shrink-0">
          <button
            onClick={async () => {
              // Fetch and set card ID if not already set
              if (!storeCardId && currentGameId && user?.id) {
                try {
                  const cardId = await getPlayerCardId(currentGameId, user.id);
                  if (cardId) {
                    setStoreCardId(cardId);
                  }
                } catch (error) {
                  console.error('Error fetching player card ID:', error);
                }
              }
              setCurrentView('play');
            }}
            className="w-full py-2.5 sm:py-3 rounded-lg font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all shadow-lg bg-gradient-to-r from-green-500 via-green-600 to-green-700 text-white hover:from-green-600 hover:via-green-700 hover:to-green-800"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
            <span>ጨዋታውን ቀጥል</span>
          </button>
        </div>
      )}

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-2 bg-blue-600 min-h-0">
        {/* Game Info Row */}
        <div className="bg-blue-500 rounded-lg p-2 sm:p-3 mb-2 sm:mb-3 flex items-center justify-between border border-blue-400">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Bet Amount */}
            <span className="text-white font-bold text-sm sm:text-base">
              {selectedGameType || game?.bet_amount || 0} ብር
            </span>
            
            {/* Player Count */}
            <div className="flex items-center gap-1">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              <span className="text-white font-bold text-sm sm:text-base">{game?.player_count || 0}</span>
            </div>
          </div>
          
          {/* Potential Win */}
          <div className="bg-yellow-400/30 text-yellow-200 px-2 sm:px-3 py-1 sm:py-1.5 rounded font-bold text-xs sm:text-sm border border-yellow-300">
            {game ? `${calculatePotentialWin(game).toFixed(2)} ብር ደራሽ` : '- ብር ደራሽ'}
          </div>
        </div>
        
        {/* 10x10 Cards Grid - Square */}
        <div className="flex justify-center mb-3">
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5 w-full max-w-[360px] aspect-square">
            {CARD_IDS.map((cardId) => {
              const isSelected = selectedCardId === cardId;
              const isTaken = takenCards.has(cardId) && !isSelected;
              
              return (
                <button
                  key={cardId}
                  onClick={() => handleCardClick(cardId)}
                  className={`aspect-square rounded-lg border-2 transition-all text-xs sm:text-sm font-bold ${
                    isSelected
                      ? 'bg-red-500 border-red-600 text-white ring-2 ring-red-400 shadow-lg scale-105 z-10'
                      : isTaken
                      ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white border-red-500 shadow hover:bg-blue-500'
                      : 'bg-gradient-to-br from-blue-400 to-blue-600 text-white hover:bg-blue-500 hover:border-blue-200 shadow'
                  }`}
                >
                  {cardId}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Card Preview */}
        {selectedCardData && (
          <div className="flex flex-col items-center mb-3">
            <div className="bg-blue-700 rounded-lg p-1 sm:p-1.5 w-full max-w-[180px] shadow-lg border-2 border-blue-500">
              {/* Header Row - B I N G O */}
              <div className="grid grid-cols-5 gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
                {(['B', 'I', 'N', 'G', 'O'] as const).map((letter, idx) => {
                  const colors = ['bg-pink-500', 'bg-green-400', 'bg-blue-500', 'bg-orange-500', 'bg-red-500'];
                  return (
                    <div
                      key={letter}
                      className={`aspect-square text-center font-bold text-xs sm:text-sm flex items-center justify-center ${colors[idx]} text-white rounded-lg shadow-sm`}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
              
              {/* Card Numbers Grid */}
              <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
                {selectedCardData.numbers.map((row, rowIndex) => (
                  row.map((number, colIndex) => {
                    const isCenter = rowIndex === 2 && colIndex === 2;
                    const displayValue = isCenter && number === 0 ? '#' : number;
                    
                    return (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className={`aspect-square rounded-lg border-2 flex items-center justify-center font-black text-xs sm:text-sm ${
                          isCenter && number === 0
                            ? 'bg-gray-900 text-white border-gray-800 shadow-inner'
                            : 'bg-blue-800 text-white border-blue-500 shadow-sm'
                        }`}
                      >
                        {displayValue}
                      </div>
                    );
                  })
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Join Button - Fixed Footer */}
      <footer className="p-4 bg-blue-600 border-t border-blue-500/50 flex-shrink-0">
        <button
          onClick={handleJoinGame}
          disabled={!selectedCardId || joining || game?.state === 'DRAWING'}
          className={`w-full py-2.5 sm:py-3 rounded-lg font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all shadow-lg ${
            selectedCardId && !joining && game?.state !== 'DRAWING'
              ? 'bg-gradient-to-r from-blue-400 via-blue-500 to-yellow-400 text-white hover:from-blue-500 hover:via-blue-600 hover:to-yellow-500'
              : 'bg-gray-500 text-gray-300 cursor-not-allowed'
          }`}
        >
          {joining ? (
            <>
              <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Joining...</span>
            </>
          ) : game?.state === 'DRAWING' ? (
            <>
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              <span>እባክዎ ይጠብቁ</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              <span>ወደ ጨዋታው ይግቡ </span>
            </>
          )}
        </button>
      </footer>
    </main>
  );
}

