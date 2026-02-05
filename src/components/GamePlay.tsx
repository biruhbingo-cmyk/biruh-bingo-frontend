'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { API_URL, getGameState, calculatePotentialWin, getWalletByTelegramId, getPlayerCardId, type Game, type User, type Wallet } from '@/lib/api';
import { useGameStore } from '@/store/gameStore';
import { useGameWebSocket, type WebSocketMessage } from '@/hooks/useSocket';
import { getCardData } from '@/lib/cardData';
import axios from 'axios';

interface GamePlayProps {
  user: User;
  wallet: Wallet;
  onWalletUpdate?: (wallet: Wallet) => void;
}

interface DrawnNumber {
  letter: string;
  number: number;
  drawn_at: string;
}

export default function GamePlay({ user, wallet, onWalletUpdate }: GamePlayProps) {
  const searchParams = useSearchParams();
  const [game, setGame] = useState<Game | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<DrawnNumber[]>([]);
  const [markedNumbers, setMarkedNumbers] = useState<Set<string>>(new Set()); // Track marked numbers on player's card
  const [countdown, setCountdown] = useState<number | null>(null);
  const [claimingBingo, setClaimingBingo] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [winnerPopup, setWinnerPopup] = useState<{ show: boolean; message: string; prize?: number; winnerName?: string; cardId?: number; markedNumbers?: number[] } | null>(null);
  const [wsReconnectKey, setWsReconnectKey] = useState(0);
  const [currentWallet, setCurrentWallet] = useState<Wallet>(wallet);
  
  const { currentGameId, selectedGameTypeString, selectedCardId, setCurrentView, setSelectedCardId } = useGameStore();
  
  // Sync wallet when prop changes
  useEffect(() => {
    setCurrentWallet(wallet);
  }, [wallet]);
  
  // Get player's card data
  const playerCardNumbers = selectedCardId ? getCardData(selectedCardId) : null;

  // Connect to WebSocket for real-time updates
  // Use gameId (not gameType) for GamePlay page to get specific game updates
  // Extract actual gameId (in case we need to force reconnect with key)
  const actualGameId = currentGameId?.split('?')[0] || currentGameId;
  const socket = useGameWebSocket(null, wsReconnectKey > 0 ? `${actualGameId}-reconnect-${wsReconnectKey}` : actualGameId);

  // Fetch initial game state and player card ID if missing
  useEffect(() => {
    const fetchGameData = async () => {
      if (currentGameId && user?.id) {
        try {
          const gameState = await getGameState(currentGameId);
          setGame(gameState.game);
          if (gameState.drawnNumbers) {
            setDrawnNumbers(gameState.drawnNumbers);
            // Mark numbers on player's card that have been drawn
            const drawn = new Set(
              gameState.drawnNumbers.map(n => `${n.letter}-${n.number}`)
            );
            setMarkedNumbers(drawn);
          }
          
          // If selectedCardId is missing, fetch it from the backend
          if (!selectedCardId) {
            const cardId = await getPlayerCardId(currentGameId, user.id);
            if (cardId) {
              setSelectedCardId(cardId);
              console.log('✅ Fetched player card ID:', cardId);
            } else {
              console.warn('⚠️ Could not fetch player card ID');
            }
          }
        } catch (error) {
          console.error('Error fetching game data:', error);
        }
      }
    };

    fetchGameData();
  }, [currentGameId, user?.id, selectedCardId, setSelectedCardId]);

  // Listen to WebSocket messages
  useEffect(() => {
    if (!socket) {
      console.log('⚠️ WebSocket not connected. currentGameId:', currentGameId);
      return;
    }
    
    console.log('✅ WebSocket connected for game:', currentGameId);

    const handleMessage = (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        // Debug logging to see what messages we're receiving
        console.log('📨 WebSocket message received:', message.event, message.data);

        switch (message.event) {
          case 'INITIAL_STATE':
            if (message.data.game) {
              console.log('🎮 Initial game state:', message.data.game);
              setGame(message.data.game);
            }
            if (message.data.drawnNumbers) {
              setDrawnNumbers(message.data.drawnNumbers);
              const drawn = new Set<string>(
                message.data.drawnNumbers.map((n: DrawnNumber) => `${n.letter}-${n.number}`)
              );
              setMarkedNumbers(drawn);
            }
            break;

          case 'GAME_STATUS':
            if (message.data.state) {
              console.log('🔄 Game status changed:', message.data.state, 'Player count:', message.data.player_count);
              setGame((prev) => {
                if (!prev) return null;
                const updated = {
                  ...prev,
                  state: message.data.state,
                  player_count: message.data.player_count ?? prev.player_count,
                  prize_pool: message.data.prize_pool ?? prev.prize_pool,
                  countdown_ends: message.data.countdown_ends ?? prev.countdown_ends,
                };
                console.log('📊 Updated game state:', updated);
                return updated;
              });
              
              // Handle countdown based on state change
              if (message.data.state !== 'COUNTDOWN') {
                // Clear countdown when state changes to DRAWING, FINISHED, etc.
                setCountdown(null);
              } else {
                // State is COUNTDOWN - set countdown from message or calculate
                if (message.data.secondsLeft !== undefined) {
                  // Only set if > 0, otherwise clear it
                  if (message.data.secondsLeft > 0) {
                    setCountdown(message.data.secondsLeft);
                  } else {
                    setCountdown(null);
                  }
                } else if (message.data.countdown_ends) {
                  // Calculate from countdown_ends if secondsLeft not provided
                  const now = new Date().getTime();
                  const ends = new Date(message.data.countdown_ends).getTime();
                  const seconds = Math.max(0, Math.floor((ends - now) / 1000));
                  if (seconds > 0) {
                    setCountdown(seconds);
                  } else {
                    setCountdown(null);
                  }
                }
              }
            }
            // Also check if countdown_ends is set but state wasn't updated
            else if (message.data.countdown_ends) {
              setGame((prev) => {
                if (!prev || prev.state !== 'WAITING') return prev;
                // If we have countdown_ends but state is still WAITING, update to COUNTDOWN
                console.log('🔄 Auto-updating state from WAITING to COUNTDOWN (countdown_ends received)');
                return {
                  ...prev,
                  state: 'COUNTDOWN',
                  countdown_ends: message.data.countdown_ends,
                  player_count: message.data.player_count ?? prev.player_count,
                  prize_pool: message.data.prize_pool ?? prev.prize_pool,
                };
              });
            }
            break;

          case 'COUNTDOWN':
            console.log('⏰ Countdown update:', message.data.secondsLeft);
            // Only process COUNTDOWN events if state is COUNTDOWN or WAITING
            // Don't process if state is already DRAWING or FINISHED
            setGame((prev) => {
              if (!prev) return null;
              // Don't update state if already DRAWING, FINISHED, CLOSED, or CANCELLED
              if (prev.state === 'DRAWING' || prev.state === 'FINISHED' || prev.state === 'CLOSED' || prev.state === 'CANCELLED') {
                // Clear countdown if state is DRAWING or beyond
                if (prev.state === 'DRAWING') {
                  setCountdown(null);
                }
                return prev;
              }
              
              // If state is still WAITING, update it to COUNTDOWN
              const newState = prev.state === 'WAITING' ? 'COUNTDOWN' : prev.state;
              
              // Only set countdown if state is COUNTDOWN
              if (newState === 'COUNTDOWN' && message.data.secondsLeft !== undefined) {
                setCountdown(message.data.secondsLeft);
              } else if (message.data.secondsLeft === 0 || message.data.secondsLeft < 0) {
                // If countdown reaches 0, clear it
                setCountdown(null);
              }
              
              return {
                ...prev,
                state: newState,
                countdown_ends: message.data.countdown_ends ?? prev.countdown_ends,
              };
            });
            break;

          case 'PLAYER_COUNT':
            if (message.data.count !== undefined) {
              setGame((prev) => prev ? { ...prev, player_count: message.data.count } : null);
            }
            break;

          case 'PLAYER_JOINED':
          case 'PLAYER_LEFT':
            console.log(`👥 Player ${message.event}:`, message.data);
            // Update player count when players join/leave
            setGame((prev) => {
              if (!prev) return null;
              
              // If count is provided, use it; otherwise increment/decrement manually
              let newPlayerCount: number;
              if (message.data.count !== undefined) {
                newPlayerCount = message.data.count;
              } else {
                // Manually increment for JOINED, decrement for LEFT
                if (message.event === 'PLAYER_JOINED') {
                  newPlayerCount = (prev.player_count || 0) + 1;
                } else {
                  newPlayerCount = Math.max(0, (prev.player_count || 0) - 1);
                }
              }
              
              const updated = {
                ...prev,
                player_count: newPlayerCount,
                prize_pool: message.data.prize_pool ?? prev.prize_pool,
              };
              console.log('📊 Updated player count:', newPlayerCount);
              return updated;
            });
            break;

          case 'NUMBER_DRAWN':
            if (message.data.letter && message.data.number) {
              const newDrawn: DrawnNumber = {
                letter: message.data.letter,
                number: message.data.number,
                drawn_at: message.data.drawn_at || new Date().toISOString(),
              };
              // Add to drawn numbers - keep ALL drawn numbers
              setDrawnNumbers((prev) => {
                // Check if already exists to avoid duplicates
                const exists = prev.some(n => n.letter === newDrawn.letter && n.number === newDrawn.number);
                if (exists) return prev;
                return [...prev, newDrawn];
              });
            }
            break;

          case 'WINNER':
            // Show popup for all players in the game
            const winnerName = message.data.winner_name || message.data.user_name || 'Another player';
            const isCurrentUser = message.data.user_id === user.id;
            
            setWinnerPopup({
              show: true,
              message: isCurrentUser ? 'Congratulations! You won!' : `${winnerName} won the game!`,
              prize: message.data.prize,
              winnerName: isCurrentUser ? `${user.first_name} ${user.last_name || ''}`.trim() : winnerName,
              cardId: message.data.card_id,
              markedNumbers: message.data.marked_numbers,
            });
            
            if (isCurrentUser) {
              // Refresh wallet balance when user wins
              getWalletByTelegramId(user.telegram_id.toString())
                .then((updatedWallet) => {
                  setCurrentWallet(updatedWallet);
                  // Update parent component's wallet state
                  if (onWalletUpdate) {
                    onWalletUpdate(updatedWallet);
                  }
                  console.log('💰 Updated wallet balance after win:', updatedWallet.balance);
                })
                .catch((err) => {
                  console.error('Error refreshing wallet after win:', err);
                });
            }
            // Redirect after 5 seconds (increased to show card)
            setTimeout(() => {
              setCurrentView('selection');
            }, 5000);
            break;

          case 'PLAYER_ELIMINATED':
            if (message.data.user_id === user.id) {
              alert('Your bingo claim was invalid. You have been eliminated.');
              setCurrentView('selection');
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
  }, [socket, user.id, setCurrentView]);

  // Ensure state is COUNTDOWN if countdown_ends is set
  useEffect(() => {
    if (game && game.state === 'WAITING' && game.countdown_ends) {
      console.log('🔄 Auto-updating state: WAITING -> COUNTDOWN (countdown_ends detected)');
      setGame((prev) => prev ? { ...prev, state: 'COUNTDOWN' } : null);
    }
  }, [game?.state, game?.countdown_ends]);

  // Update countdown timer - initial calculation when entering COUNTDOWN state
  // WebSocket COUNTDOWN events will update it every second
  useEffect(() => {
    if (!game) {
      setCountdown(null);
      return;
    }

    // Clear countdown if state is not COUNTDOWN
    if (game.state !== 'COUNTDOWN') {
      setCountdown(null);
      return;
    }

    if (!game.countdown_ends) {
      return;
    }

    // Calculate initial countdown when entering COUNTDOWN state
    // WebSocket will send COUNTDOWN events to keep it updated
    const now = new Date().getTime();
    const ends = new Date(game.countdown_ends).getTime();
    const seconds = Math.max(0, Math.floor((ends - now) / 1000));
    
    // Set initial countdown only if > 0, otherwise clear it
    if (seconds > 0) {
      setCountdown(seconds);
    } else {
      setCountdown(null);
    }
  }, [game?.state, game?.countdown_ends]);

  // Handle marking a number on player's card
  const handleMarkNumber = (letter: string, number: number) => {
    const key = `${letter}-${number}`;
    
    // Check if this number has been drawn
    const isDrawn = drawnNumbers.some(n => n.letter === letter && n.number === number);
    
    if (!isDrawn) {
      alert('This number has not been drawn yet!');
      return;
    }

    // Mark the number (only mark, don't toggle - once marked it stays marked)
    setMarkedNumbers((prev) => {
      const newSet = new Set(prev);
      newSet.add(key);
      return newSet;
    });
  };

  // Handle bingo claim
  const handleClaimBingo = async () => {
    if (!currentGameId || !playerCardNumbers) {
      alert('Game or card information missing');
      return;
    }

    // Verify pattern (simple check - can be enhanced)
    const markedCount = markedNumbers.size;
    if (markedCount < 4) {
      alert('You need to mark at least 4 numbers to claim bingo!');
      return;
    }

    setClaimingBingo(true);

    try {
      // Convert marked numbers to card position indices (0-24)
      // The card is a 5x5 grid, so we need to find the position of each marked number
      const markedIndices: number[] = [];
      
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
          const cardNumber = playerCardNumbers[row][col];
          const letter = ['B', 'I', 'N', 'G', 'O'][col];
          const key = `${letter}-${cardNumber}`;
          
          // Skip center square (always marked)
          if (row === 2 && col === 2 && cardNumber === 0) {
            continue;
          }
          
          // If this number is marked, add its index
          if (markedNumbers.has(key)) {
            const index = row * 5 + col;
            markedIndices.push(index);
          }
        }
      }

      const response = await axios.post(
        `${API_URL}/api/v1/games/${currentGameId}/bingo`,
        {
          user_id: user.id,
          marked_numbers: markedIndices,
        }
      );

      if (response.data.winner) {
        setWinnerPopup({
          show: true,
          message: 'Congratulations! You won!',
          prize: response.data.prize,
          winnerName: `${user.first_name} ${user.last_name || ''}`.trim(),
          cardId: selectedCardId || undefined,
          markedNumbers: markedIndices,
        });
        
        // Refresh wallet balance when user wins
        getWalletByTelegramId(user.telegram_id.toString())
          .then((updatedWallet) => {
            setCurrentWallet(updatedWallet);
            // Update parent component's wallet state
            if (onWalletUpdate) {
              onWalletUpdate(updatedWallet);
            }
            console.log('💰 Updated wallet balance after bingo win:', updatedWallet.balance);
          })
          .catch((err) => {
            console.error('Error refreshing wallet after bingo win:', err);
          });
        
        // Redirect after 5 seconds (increased to show card)
        setTimeout(() => {
          setCurrentView('selection');
        }, 5000);
      } else {
        alert(response.data.message || 'Invalid bingo claim. You have been eliminated.');
        setCurrentView('selection');
      }
    } catch (err: any) {
      console.error('Error claiming bingo:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to claim bingo';
      alert(errorMessage);
      
      // If the error response indicates elimination, navigate back to selection
      if (err.response?.data?.winner === false) {
        setCurrentView('selection');
      }
    } finally {
      setClaimingBingo(false);
    }
  };

  // Handle leave game - show confirmation modal
  const handleLeaveGame = () => {
    if (!currentGameId) return;
    setShowLeaveConfirm(true);
  };

  // Confirm and execute leave game
  const confirmLeaveGame = async () => {
    if (!currentGameId) return;

    setShowLeaveConfirm(false);
    setLeaving(true);

    try {
      await axios.post(
        `${API_URL}/api/v1/games/${currentGameId}/leave`,
        {
          user_id: user.id,
        }
      );

      setCurrentView('selection');
    } catch (err: any) {
      console.error('Error leaving game:', err);
      alert('Failed to leave game. Please try again.');
    } finally {
      setLeaving(false);
    }
  };

  // Handle refresh - fetch updated data and reconnect WebSocket if needed
  const handleRefresh = async () => {
    if (!currentGameId) return;

    try {
      // Fetch updated game state
      const gameState = await getGameState(currentGameId);
      setGame(gameState.game);
      
      // Update drawn numbers
      if (gameState.drawnNumbers) {
        setDrawnNumbers(gameState.drawnNumbers);
        // Mark numbers on player's card that have been drawn
        const drawn = new Set(
          gameState.drawnNumbers.map(n => `${n.letter}-${n.number}`)
        );
        setMarkedNumbers(drawn);
      }

      // Check WebSocket connection and force reconnect if closed
      if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
        console.log('🔄 WebSocket is closed, forcing reconnection...');
        // Force reconnection by updating the reconnect key (this will trigger hook to recreate connection)
        setWsReconnectKey(prev => prev + 1);
      } else if (socket.readyState === WebSocket.OPEN) {
        console.log('✅ WebSocket is already connected');
      } else if (socket.readyState === WebSocket.CONNECTING) {
        console.log('⏳ WebSocket is connecting...');
      }
    } catch (error) {
      console.error('Error refreshing game data:', error);
      alert('Failed to refresh game data. Please try again.');
    }
  };

  // Get current call (most recent drawn number)
  const currentCall = drawnNumbers.length > 0 ? drawnNumbers[drawnNumbers.length - 1] : null;

  // Generate all 75 bingo numbers
  const getAllBingoNumbers = () => {
    const numbers: { letter: string; number: number }[] = [];
    const ranges = [
      { letter: 'B', start: 1, end: 15 },
      { letter: 'I', start: 16, end: 30 },
      { letter: 'N', start: 31, end: 45 },
      { letter: 'G', start: 46, end: 60 },
      { letter: 'O', start: 61, end: 75 },
    ];

    ranges.forEach(({ letter, start, end }) => {
      for (let i = start; i <= end; i++) {
        numbers.push({ letter, number: i });
      }
    });

    return numbers;
  };

  const allNumbers = getAllBingoNumbers();
  const drawnNumbersSet = new Set(drawnNumbers.map(n => `${n.letter}-${n.number}`));

  // Get recent 5 drawn numbers (newest at bottom)
  const recent5Drawn = [...drawnNumbers].slice(-5);

  if (!game || !playerCardNumbers) {
    return (
      <main className="min-h-screen bg-blue-600 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading game...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-blue-600 text-white flex flex-col relative">
      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-blue-600 bg-opacity-95 flex items-center justify-center z-50">
          <div className="bg-blue-700 border-2 border-blue-400 rounded-lg p-6 sm:p-8 max-w-md mx-4 text-center shadow-xl">
            <div className="text-4xl sm:text-5xl mb-4">⚠️</div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
              Are you sure you want to leave the game?
            </h2>
            <p className="text-blue-200 text-sm sm:text-base mb-6">
              Your bet will not be refunded if you leave now.
            </p>
            <div className="flex gap-3 sm:gap-4 justify-center">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm sm:text-base px-6 sm:px-8 py-2 sm:py-3 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmLeaveGame}
                disabled={leaving}
                className="bg-pink-500 hover:bg-pink-600 text-white font-bold text-sm sm:text-base px-6 sm:px-8 py-2 sm:py-3 rounded-lg transition-all disabled:opacity-50"
              >
                {leaving ? 'Leaving...' : 'Leave Game'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Winner Popup */}
      {winnerPopup && winnerPopup.show && (() => {
        const winnerCardNumbers = winnerPopup.cardId ? getCardData(winnerPopup.cardId) : null;
        const markedNumbersArray = winnerPopup.markedNumbers || [];
        
        // Convert marked numbers (card numbers like 2, 48, 11, etc.) to card positions
        // Each number in marked_numbers is the actual number on the bingo card that was marked
        // We need to find where each number appears on the card and mark that position
        const markedPositions = new Set<number>();
        
        if (winnerCardNumbers && markedNumbersArray.length > 0) {
          // For each marked number, find its position on the card
          markedNumbersArray.forEach((cardNumber: number) => {
            // Skip 0 (center square is always marked)
            if (cardNumber === 0) {
              markedPositions.add(12); // Center position (row 2, col 2 = index 12)
              return;
            }
            
            // Search for this number on the card
            for (let row = 0; row < 5; row++) {
              for (let col = 0; col < 5; col++) {
                if (winnerCardNumbers[row][col] === cardNumber) {
                  const index = row * 5 + col;
                  markedPositions.add(index);
                  return; // Found it, move to next number
                }
              }
            }
          });
        }
        
        return (
          <div className="fixed inset-0 bg-blue-600 bg-opacity-95 flex items-center justify-center z-50 overflow-y-auto p-4">
            <div className="bg-blue-700 border-2 border-blue-400 rounded-lg p-4 sm:p-6 max-w-lg mx-auto text-center shadow-xl">
              <div className="text-4xl sm:text-6xl mb-4">🎉</div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                {winnerPopup.winnerName}
              </h2>
              {winnerPopup.prize && (
                <p className="text-lg sm:text-xl font-bold text-yellow-300 mb-4">
                  {winnerPopup.winnerName === `${user.first_name} ${user.last_name || ''}`.trim() 
                    ? `You won ${winnerPopup.prize} ETB!`
                    : `Won ${winnerPopup.prize} ETB!`}
                </p>
              )}
              
              {/* Winner's Bingo Card */}
              {winnerCardNumbers && (
                <div className="mt-4 mb-4">
                  <div className="bg-blue-700 rounded-lg p-2 border-2 border-blue-500">
                    <div className="grid grid-cols-5 gap-0.5">
                      {/* Header Row */}
                      {['B', 'I', 'N', 'G', 'O'].map((letter, idx) => {
                        const colors = ['bg-pink-500', 'bg-green-400', 'bg-blue-500', 'bg-orange-500', 'bg-red-500'];
                        return (
                          <div
                            key={letter}
                            className={`${colors[idx]} text-white font-bold text-[8px] sm:text-[10px] p-1 rounded text-center shadow-sm`}
                          >
                            {letter}
                          </div>
                        );
                      })}
                      
                      {/* Card Numbers */}
                      {winnerCardNumbers.map((row: number[], rowIndex: number) =>
                        row.map((number: number, colIndex: number) => {
                          const isCenter = rowIndex === 2 && colIndex === 2 && number === 0;
                          const index = rowIndex * 5 + colIndex;
                          const isMarked = markedPositions.has(index) || isCenter;
                          
                          return (
                            <div
                              key={`${rowIndex}-${colIndex}`}
                              className={`w-8 h-8 sm:w-10 sm:h-10 rounded border-2 flex items-center justify-center font-black text-[9px] sm:text-[11px] transition-all ${
                                isCenter || isMarked
                                  ? 'bg-gray-900 text-white border-gray-800 shadow-inner'
                                  : 'bg-blue-800 text-white border-blue-500 shadow-sm'
                              }`}
                            >
                              {isCenter ? '#' : number}
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="text-center mt-1 text-white font-black text-[8px] sm:text-[9px]">
                      BOARD NUMBER {winnerPopup.cardId}
                    </div>
                  </div>
                </div>
              )}
              
              <p className="text-blue-200 text-sm sm:text-base">
                Redirecting to game selection...
              </p>
            </div>
          </div>
        );
      })()}

      {/* Top Header - Game Info */}
      <div className="bg-blue-700 px-4 sm:px-8 py-2 w-full flex items-center justify-between text-xs sm:text-sm">
        <div>
          <span className="text-blue-200">Derash: </span>
          <span className="font-bold text-yellow-300">{calculatePotentialWin(game).toFixed(2)} ETB</span>
        </div>
        <div>
          <span className="text-blue-200">Players: </span>
          <span className="font-bold text-white">{game.player_count}</span>
        </div>
        <div>
          <span className="text-blue-200">Bet: </span>
          <span className="font-bold text-white">{game.bet_amount} ETB</span>
        </div>
      </div>

      {/* Waiting Message */}
      {game.state === 'WAITING' && (
          <div className="mt-4 sm:mt-3 mb-4 sm:mb-4 text-center">
            <div className="bg-yellow-500/20 border-2 border-yellow-400 rounded-lg p-2 sm:p-3 inline-block">
              <p className="text-yellow-300 font-bold text-sm sm:text-base">
                ⏳ Waiting for other players to join...
              </p>
            </div>
          </div>
        )}

      {/* Main Game Area */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-1 sm:py-2">
        <div className={`grid grid-cols-1 ${game.state === 'COUNTDOWN' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-2 sm:gap-3`}>
          {/* Timer Section - Only show in COUNTDOWN state and countdown > 0 */}
          {game.state === 'COUNTDOWN' && countdown !== null && countdown > 0 && (
            <div className="lg:col-span-1">
              <div className="bg-blue-700 rounded-lg p-2 sm:p-3 flex flex-col items-center justify-center min-h-[100px] sm:min-h-[120px] border-2 border-blue-500">
                <div className="text-white text-xs sm:text-sm font-semibold mb-1">TIMER</div>
                <div className="text-white text-2xl sm:text-4xl font-bold">{countdown}</div>
              </div>
            </div>
          )}

          {/* Main Bingo Board - Called Numbers and Recent 5 Side by Side */}
          <div className={game.state === 'DRAWING' ? 'lg:col-span-2' : 'lg:col-span-2'}>
            <div className="flex gap-2 sm:gap-3 h-full">
              {/* 75 Bingo Numbers Grid */}
              <div className="flex-1">
                <div className="bg-blue-700 rounded-lg p-2 border-2 border-blue-500">
                  <div className="grid grid-cols-5 gap-1">
                    {['B', 'I', 'N', 'G', 'O'].map((letter, idx) => {
                      const colors = ['bg-pink-500', 'bg-green-400', 'bg-blue-500', 'bg-orange-500', 'bg-red-500'];
                      const ranges = [
                        { start: 1, end: 15 },
                        { start: 16, end: 30 },
                        { start: 31, end: 45 },
                        { start: 46, end: 60 },
                        { start: 61, end: 75 },
                      ];
                      
                      return (
                        <div key={letter} className="flex flex-col">
                          {/* Header */}
                          <div className={`${colors[idx]} text-white font-bold text-sm p-1.5 rounded mb-1 text-center shadow-md`}>
                            {letter}
                          </div>
                          {/* Numbers */}
                          <div className="space-y-0.5">
                            {Array.from({ length: ranges[idx].end - ranges[idx].start + 1 }, (_, i) => {
                              const number = ranges[idx].start + i;
                              const key = `${letter}-${number}`;
                              const isDrawn = drawnNumbersSet.has(key);
                              
                              return (
                                <div
                                  key={number}
                                  className={`text-[11px] sm:text-[12px] font-bold p-1.5 rounded text-center ${
                                    isDrawn
                                      ? 'bg-gray-900 text-white shadow-md'
                                      : 'bg-blue-500 text-white shadow-sm'
                                  }`}
                                >
                                  {number}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Recent 5 Drawn Numbers - Vertical Format with Bingo Card at Bottom */}
              <div className="flex-shrink-0 flex flex-col h-full">
                <div className="text-white text-xs sm:text-sm font-bold mb-2">Recent 5</div>
                <div className="flex flex-col gap-1.5">
                  {drawnNumbers.length > 0 ? (
                    [...drawnNumbers].slice(-5).map((drawn, idx) => {
                      const colors: Record<string, string> = {
                        'B': 'bg-pink-500',
                        'I': 'bg-green-400',
                        'N': 'bg-blue-500',
                        'G': 'bg-orange-500',
                        'O': 'bg-red-500',
                      };
                      
                      return (
                        <div
                          key={`${drawn.letter}-${drawn.number}-${idx}`}
                          className={`${colors[drawn.letter]} text-white font-bold text-sm sm:text-base px-2 sm:px-3 py-1.5 sm:py-2 rounded text-center border-2 border-white shadow-md`}
                        >
                          {drawn.letter}-{drawn.number}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-blue-200 text-xs sm:text-sm">No numbers drawn yet</div>
                  )}
                </div>
                
                {/* Player's Bingo Card - At the bottom of this column */}
                {playerCardNumbers && (
                  <div className="mt-auto pt-4">
                    <div className="bg-blue-700 rounded-lg p-1 border-2 border-blue-500">
                      <div className="grid grid-cols-5 gap-0.5">
                        {/* Header Row */}
                        {['B', 'I', 'N', 'G', 'O'].map((letter, idx) => {
                          const colors = ['bg-pink-500', 'bg-green-400', 'bg-blue-500', 'bg-orange-500', 'bg-red-500'];
                          return (
                            <div
                              key={letter}
                              className={`${colors[idx]} text-white font-bold text-[7px] p-0.5 rounded text-center shadow-sm`}
                            >
                              {letter}
                            </div>
                          );
                        })}
                        
                        {/* Card Numbers */}
                        {playerCardNumbers.map((row: number[], rowIndex: number) =>
                          row.map((number: number, colIndex: number) => {
                            const letter = ['B', 'I', 'N', 'G', 'O'][colIndex];
                            const isCenter = rowIndex === 2 && colIndex === 2 && number === 0;
                            const key = `${letter}-${number}`;
                            const isMarked = markedNumbers.has(key);
                            const isDrawn = drawnNumbersSet.has(key);
                            
                            return (
                              <button
                                key={`${rowIndex}-${colIndex}`}
                                onClick={() => !isCenter && isDrawn && handleMarkNumber(letter, number)}
                                disabled={isCenter || !isDrawn}
                                className={`w-7 h-7 sm:w-9 sm:h-9 rounded border-2 flex items-center justify-center font-black text-[9px] sm:text-[10px] transition-all ${
                                  isCenter
                                    ? 'bg-gray-900 text-white border-gray-800 cursor-default shadow-inner'
                                    : isMarked
                                    ? 'bg-gray-900 text-white border-gray-800 shadow-inner'
                                    : 'bg-blue-800 text-white border-blue-500 cursor-default shadow-sm'
                                }`}
                              >
                                {isCenter ? '#' : number}
                              </button>
                            );
                          })
                        )}
                      </div>
                      <div className="text-center mt-0.5 text-white font-black text-[7px] sm:text-[8px]">
                        BOARD NUMBER {selectedCardId}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-1 sm:mt-2 grid grid-cols-3 gap-1 sm:gap-2">
          <button
            onClick={handleLeaveGame}
            disabled={leaving}
            className="bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs sm:text-sm py-1.5 sm:py-2 rounded-lg transition-all disabled:opacity-50"
          >
            {leaving ? 'Leaving...' : 'Leave'}
          </button>
          
          <button
            onClick={handleClaimBingo}
            disabled={claimingBingo}
            className="bg-gradient-to-r from-blue-400 via-blue-500 to-yellow-400 hover:from-blue-500 hover:via-blue-600 hover:to-yellow-500 text-white font-bold text-xs sm:text-sm py-1.5 sm:py-2 rounded-lg transition-all disabled:opacity-50"
          >
            {claimingBingo ? 'Verifying...' : 'Bingo'}
          </button>
          
          <button
            onClick={handleRefresh}
            className="bg-yellow-400 hover:bg-yellow-500 text-white font-bold text-xs sm:text-sm py-1.5 sm:py-2 rounded-lg transition-all"
          >
            Refresh
          </button>
        </div>
      </div>
    </main>
  );
}

