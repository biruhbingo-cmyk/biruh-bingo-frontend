'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { API_URL, getGameState, calculatePotentialWin, type Game, type User, type Wallet } from '@/lib/api';
import { useGameStore } from '@/store/gameStore';
import { useGameWebSocket, type WebSocketMessage } from '@/hooks/useSocket';
import { getCardData } from '@/lib/cardData';
import axios from 'axios';

interface GamePlayProps {
  user: User;
  wallet: Wallet;
}

interface DrawnNumber {
  letter: string;
  number: number;
  drawn_at: string;
}

export default function GamePlay({ user, wallet }: GamePlayProps) {
  const searchParams = useSearchParams();
  const [game, setGame] = useState<Game | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<DrawnNumber[]>([]);
  const [markedNumbers, setMarkedNumbers] = useState<Set<string>>(new Set()); // Track marked numbers on player's card
  const [countdown, setCountdown] = useState<number | null>(null);
  const [claimingBingo, setClaimingBingo] = useState(false);
  const [leaving, setLeaving] = useState(false);
  
  const { currentGameId, selectedGameTypeString, selectedCardId, setCurrentView } = useGameStore();
  
  // Get player's card data
  const playerCardNumbers = selectedCardId ? getCardData(selectedCardId) : null;

  // Connect to WebSocket for real-time updates
  // Use gameId (not gameType) for GamePlay page to get specific game updates
  const socket = useGameWebSocket(null, currentGameId);

  // Fetch initial game state
  useEffect(() => {
    const fetchGameData = async () => {
      if (currentGameId) {
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
        } catch (error) {
          console.error('Error fetching game data:', error);
        }
      }
    };

    fetchGameData();
  }, [currentGameId]);

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
                setCountdown(null);
              } else {
                // State is COUNTDOWN - set countdown from message or calculate
                if (message.data.secondsLeft !== undefined) {
                  setCountdown(message.data.secondsLeft);
                } else if (message.data.countdown_ends) {
                  // Calculate from countdown_ends if secondsLeft not provided
                  const now = new Date().getTime();
                  const ends = new Date(message.data.countdown_ends).getTime();
                  const seconds = Math.max(0, Math.floor((ends - now) / 1000));
                  if (seconds > 0) {
                    setCountdown(seconds);
                  }
                }
              }
            }
            break;

          case 'COUNTDOWN':
            console.log('⏰ Countdown update:', message.data.secondsLeft);
            if (message.data.secondsLeft !== undefined) {
              setCountdown(message.data.secondsLeft);
            }
            // Also update countdown_ends if provided
            if (message.data.countdown_ends) {
              setGame((prev) => prev ? { ...prev, countdown_ends: message.data.countdown_ends } : null);
            }
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
            if (message.data.user_id === user.id) {
              alert(`Congratulations! You won ${message.data.prize} ETB!`);
            } else {
              alert('Game finished. Another player won.');
            }
            setCurrentView('selection');
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

  // Update countdown timer - initial calculation when entering COUNTDOWN state
  // WebSocket COUNTDOWN events will update it every second
  useEffect(() => {
    if (!game) {
      setCountdown(null);
      return;
    }

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
    
    // Set initial countdown (WebSocket will override with more accurate values)
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
    if (markedCount < 5) {
      alert('You need to mark at least 5 numbers to claim bingo!');
      return;
    }

    setClaimingBingo(true);

    try {
      // Get marked numbers array for backend verification
      const markedNumbersArray = Array.from(markedNumbers).map(key => {
        const [letter, number] = key.split('-');
        return { letter, number: parseInt(number) };
      });

      const response = await axios.post(
        `${API_URL}/api/v1/games/${currentGameId}/claim-bingo`,
        {
          user_id: user.id,
          marked_numbers: markedNumbersArray,
        }
      );

      if (response.data.winner) {
        alert(`Congratulations! You won ${response.data.prize} ETB!`);
        setCurrentView('selection');
      }
    } catch (err: any) {
      console.error('Error claiming bingo:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to claim bingo';
      alert(errorMessage);
    } finally {
      setClaimingBingo(false);
    }
  };

  // Handle leave game
  const handleLeaveGame = async () => {
    if (!currentGameId) return;

    if (!confirm('Are you sure you want to leave the game?')) {
      return;
    }

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
  const recent5Drawn = [...drawnNumbers].slice(-5).reverse();

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
    <main className="min-h-screen bg-blue-600 text-white flex flex-col">
      {/* Top Header - Game Info */}
      <div className="bg-blue-700 px-2 sm:px-4 py-2 flex items-center justify-between flex-wrap gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <div>
            <span className="text-blue-200">Game: </span>
            <span className="font-bold text-white">{game.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div>
            <span className="text-blue-200">Derash: </span>
            <span className="font-bold text-yellow-300">{calculatePotentialWin(game).toFixed(2)} ETB</span>
          </div>
          <div>
            <span className="text-blue-200">Bonus: </span>
            <span className="font-bold text-white">-</span>
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
          {/* Timer Section - Only show in COUNTDOWN state */}
          {game.state === 'COUNTDOWN' && countdown !== null && (
            <div className="lg:col-span-1">
              <div className="bg-blue-700 rounded-lg p-2 sm:p-3 flex flex-col items-center justify-center min-h-[100px] sm:min-h-[120px] border-2 border-blue-500">
                <div className="text-white text-xs sm:text-sm font-semibold mb-1">TIMER</div>
                <div className="text-white text-2xl sm:text-4xl font-bold">{countdown}</div>
              </div>
            </div>
          )}

          {/* Main Bingo Board - Called Numbers */}
          <div className={game.state === 'DRAWING' ? 'lg:col-span-2' : 'lg:col-span-2'}>
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
                      <div className={`${colors[idx]} text-white font-bold text-xs p-1 rounded mb-1 text-center`}>
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
                              className={`text-[10px] font-bold p-1 rounded text-center ${
                                isDrawn
                                  ? 'bg-gray-800 text-white'
                                  : 'bg-blue-600 text-white'
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

          {/* Recent 5 Drawn Numbers */}
          <div className="lg:col-span-1">
            <div className="text-white text-xs sm:text-sm font-bold mb-4 mt-2 sm:mt-3">Recent 5</div>
            <div className="flex flex-wrap gap-1.5 mb-2 sm:mb-3">
              {drawnNumbers.length > 0 ? (
                [...drawnNumbers].slice(-5).reverse().map((drawn, idx) => {
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
                      className={`${colors[drawn.letter]} text-white font-bold text-sm sm:text-base px-2 sm:px-3 py-1 sm:py-1.5 rounded text-center border-2 border-white`}
                    >
                      {drawn.letter}-{drawn.number}
                    </div>
                  );
                })
              ) : (
                <div className="text-blue-200 text-xs sm:text-sm">No numbers drawn yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Player's Bingo Card */}
        {playerCardNumbers && (
          <div className="mt-3 sm:mt-4 mb-4 sm:mb-3 flex justify-center">
            <div className="bg-white rounded-lg p-1 border border-blue-300 inline-block">
              <div className="grid grid-cols-5 gap-0.5">
                {/* Header Row */}
                {['B', 'I', 'N', 'G', 'O'].map((letter, idx) => {
                  const colors = ['bg-pink-500', 'bg-green-400', 'bg-blue-500', 'bg-orange-500', 'bg-red-500'];
                  return (
                    <div
                      key={letter}
                      className={`${colors[idx]} text-white font-bold text-[8px] p-0.5 rounded text-center`}
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
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded border flex items-center justify-center font-bold text-[8px] sm:text-[9px] transition-all ${
                          isCenter
                            ? 'bg-gray-800 text-white border-gray-700 cursor-default'
                            : isMarked
                            ? 'bg-gray-800 text-white border-gray-700'
                            : 'bg-white text-gray-900 border-gray-300 cursor-default'
                        }`}
                      >
                        {isCenter ? '#' : number}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="text-center mt-0.5 text-gray-700 font-bold text-[8px] sm:text-[9px]">
                BOARD NUMBER {selectedCardId}
              </div>
            </div>
          </div>
        )}

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
            onClick={() => window.location.reload()}
            className="bg-yellow-400 hover:bg-yellow-500 text-white font-bold text-xs sm:text-sm py-1.5 sm:py-2 rounded-lg transition-all"
          >
            Refresh
          </button>
        </div>
      </div>
    </main>
  );
}

