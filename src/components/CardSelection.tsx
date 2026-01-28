'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { API_URL, getGameState, calculatePotentialWin, type User, type Wallet, type Game } from '@/lib/api';
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
  
  const { setCurrentView, setSelectedCardId: setStoreCardId, currentGameId, selectedGameType, selectedGameTypeString } = useGameStore();

  // Connect to WebSocket for real-time updates (by game type - recommended)
  const socket = useGameWebSocket(selectedGameTypeString, currentGameId);

  // Fetch initial game state
  useEffect(() => {
    const fetchGameData = async () => {
      if (currentGameId) {
        try {
          const gameState = await getGameState(currentGameId);
          setGame(gameState.game);
          // Set initial taken cards
          if (gameState.takenCards && Array.isArray(gameState.takenCards)) {
            setTakenCards(new Set(gameState.takenCards));
          }
        } catch (error) {
          console.error('Error fetching game data:', error);
        }
      }
    };

    fetchGameData();
  }, [currentGameId]);

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
            if (message.data.state) {
              setGame((prev) => prev ? { 
                ...prev, 
                state: message.data.state,
                player_count: message.data.player_count ?? prev.player_count,
                prize_pool: message.data.prize_pool ?? prev.prize_pool
              } : null);
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
            // Remove card from taken cards if card_id is provided
            if (message.data.card_id !== undefined) {
              setTakenCards((prev) => {
                const newSet = new Set(prev);
                newSet.delete(message.data.card_id);
                return newSet;
              });
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
            // Number drawn - for game play screen
            break;

          case 'PLAYER_ELIMINATED':
            // Player eliminated - could update player count
            if (message.data.count !== undefined) {
              setGame((prev) => prev ? { ...prev, player_count: message.data.count } : null);
            }
            break;

          case 'WINNER':
            // Game finished - update game state
            setGame((prev) => prev ? { ...prev, state: 'FINISHED' } : null);
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
  }, [socket]);

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
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5 w-full max-w-[min(90vw,500px)] aspect-square">
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
            <div className="bg-white rounded-lg p-1 sm:p-1.5 w-full max-w-[calc((min(90vw,500px))/2-0.5*0.25rem)] sm:max-w-[calc((min(90vw,500px))/2-0.5*0.375rem)] shadow-lg border-2 border-blue-300">
              {/* Header Row - B I N G O */}
              <div className="grid grid-cols-5 gap-1 sm:gap-1.5 mb-1 sm:mb-1.5">
                {(['B', 'I', 'N', 'G', 'O'] as const).map((letter, idx) => {
                  const colors = ['bg-pink-500', 'bg-green-500', 'bg-blue-600', 'bg-orange-500', 'bg-red-500'];
                  return (
                    <div
                      key={letter}
                      className={`aspect-square text-center font-bold text-xs sm:text-sm flex items-center justify-center ${colors[idx]} text-white rounded-lg shadow`}
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
                        className={`aspect-square rounded-lg border-2 flex items-center justify-center font-bold text-xs sm:text-sm ${
                          isCenter && number === 0
                            ? 'bg-gray-800 text-white border-gray-700'
                            : 'bg-white text-gray-900 border-gray-300'
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
          disabled={!selectedCardId || joining}
          className={`w-full py-2.5 sm:py-3 rounded-lg font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all shadow-lg ${
            selectedCardId && !joining
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
          ) : (
            <>
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              <span>ወደ ጨዋታው ይግቡ</span>
            </>
          )}
        </button>
      </footer>
    </main>
  );
}

