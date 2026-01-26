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
  const socket = useGameWebSocket(selectedGameTypeString, currentGameId);

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
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        switch (message.event) {
          case 'INITIAL_STATE':
            if (message.data.game) {
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
              setGame((prev) => prev ? { ...prev, state: message.data.state } : null);
            }
            break;

          case 'COUNTDOWN':
            if (message.data.secondsLeft !== undefined) {
              setCountdown(message.data.secondsLeft);
            }
            break;

          case 'NUMBER_DRAWN':
            if (message.data.letter && message.data.number) {
              const newDrawn: DrawnNumber = {
                letter: message.data.letter,
                number: message.data.number,
                drawn_at: message.data.drawn_at || new Date().toISOString(),
              };
              setDrawnNumbers((prev) => {
                const updated = [...prev, newDrawn];
                // Keep only last 5
                return updated.slice(-5);
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

  // Update countdown timer
  useEffect(() => {
    if (!game || game.state !== 'COUNTDOWN' || !game.countdown_ends) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const ends = new Date(game.countdown_ends!).getTime();
      const seconds = Math.max(0, Math.floor((ends - now) / 1000));
      setCountdown(seconds > 0 ? seconds : null);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [game]);

  // Handle marking a number on player's card
  const handleMarkNumber = (letter: string, number: number) => {
    const key = `${letter}-${number}`;
    
    // Check if this number has been drawn
    const isDrawn = drawnNumbers.some(n => n.letter === letter && n.number === number);
    
    if (!isDrawn) {
      alert('This number has not been drawn yet!');
      return;
    }

    // Toggle mark
    setMarkedNumbers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
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

      {/* Main Game Area */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-2">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Timer Section */}
          <div className="lg:col-span-1">
            <div className="bg-blue-700 rounded-lg p-4 sm:p-6 flex flex-col items-center justify-center min-h-[150px] border-2 border-blue-500">
              <div className="text-white text-sm sm:text-base font-semibold mb-2">TIMER</div>
              {countdown !== null ? (
                <div className="text-white text-4xl sm:text-6xl font-bold">{countdown}</div>
              ) : game.state === 'DRAWING' ? (
                <div className="text-white text-2xl sm:text-3xl font-bold">PLAYING</div>
              ) : (
                <div className="text-white text-2xl sm:text-3xl font-bold">WAITING</div>
              )}
            </div>
          </div>

          {/* Main Bingo Board - Called Numbers */}
          <div className="lg:col-span-2">
            <div className="bg-blue-700 rounded-lg p-2 sm:p-3 border-2 border-blue-500">
              <div className="grid grid-cols-5 gap-1 sm:gap-2">
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
                      <div className={`${colors[idx]} text-white font-bold text-xs sm:text-sm p-1 sm:p-2 rounded mb-1 text-center`}>
                        {letter}
                      </div>
                      {/* Numbers */}
                      <div className="space-y-0.5 sm:space-y-1">
                        {Array.from({ length: ranges[idx].end - ranges[idx].start + 1 }, (_, i) => {
                          const number = ranges[idx].start + i;
                          const key = `${letter}-${number}`;
                          const isDrawn = drawnNumbersSet.has(key);
                          
                          return (
                            <div
                              key={number}
                              className={`text-xs sm:text-sm font-bold p-1 sm:p-1.5 rounded text-center ${
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
            <div className="space-y-2">
              {recent5Drawn.map((drawn, idx) => {
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
                    className={`${colors[drawn.letter]} text-white font-bold text-sm sm:text-base p-2 sm:p-3 rounded-lg text-center border-2 border-white`}
                  >
                    {drawn.letter}-{drawn.number}
                  </div>
                );
              })}
              {recent5Drawn.length === 0 && (
                <div className="text-blue-200 text-sm text-center py-4">No numbers drawn yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Current Call */}
        <div className="mt-3 sm:mt-4">
          <div className="text-white font-bold text-sm sm:text-base mb-2">Current Call</div>
          <div className={`${currentCall ? `bg-${currentCall.letter === 'B' ? 'pink' : currentCall.letter === 'I' ? 'green' : currentCall.letter === 'N' ? 'blue' : currentCall.letter === 'G' ? 'orange' : 'red'}-500` : 'bg-gray-500'} text-white font-bold text-lg sm:text-2xl p-3 sm:p-4 rounded-lg text-center border-2 border-white`}>
            {currentCall ? `${currentCall.letter}-${currentCall.number}` : '-'}
          </div>
        </div>

        {/* Player's Bingo Card */}
        {playerCardNumbers && (
          <div className="mt-3 sm:mt-4">
            <div className="bg-white rounded-lg p-2 sm:p-3 border-2 border-blue-300">
              <div className="grid grid-cols-5 gap-1 sm:gap-2">
                {/* Header Row */}
                {['B', 'I', 'N', 'G', 'O'].map((letter, idx) => {
                  const colors = ['bg-pink-500', 'bg-green-400', 'bg-blue-500', 'bg-orange-500', 'bg-red-500'];
                  return (
                    <div
                      key={letter}
                      className={`${colors[idx]} text-white font-bold text-xs sm:text-sm p-1 sm:p-2 rounded text-center`}
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
                        className={`aspect-square rounded-lg border-2 flex items-center justify-center font-bold text-xs sm:text-sm transition-all ${
                          isCenter
                            ? 'bg-gray-800 text-white border-gray-700 cursor-default'
                            : isMarked
                            ? 'bg-gray-800 text-white border-gray-700'
                            : isDrawn
                            ? 'bg-blue-100 text-gray-900 border-blue-300 hover:bg-blue-200 cursor-pointer'
                            : 'bg-white text-gray-900 border-gray-300 cursor-default'
                        }`}
                      >
                        {isCenter ? '#' : number}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="text-center mt-2 text-gray-700 font-bold text-xs sm:text-sm">
                BOARD NUMBER {selectedCardId}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <button
            onClick={handleLeaveGame}
            disabled={leaving}
            className="bg-pink-500 hover:bg-pink-600 text-white font-bold text-sm sm:text-base py-2 sm:py-3 rounded-lg transition-all disabled:opacity-50"
          >
            {leaving ? 'Leaving...' : 'Leave'}
          </button>
          
          <button
            onClick={handleClaimBingo}
            disabled={claimingBingo || game.state !== 'DRAWING'}
            className="bg-blue-400 hover:bg-blue-500 text-white font-bold text-base sm:text-lg py-2 sm:py-3 rounded-lg transition-all disabled:opacity-50"
          >
            {claimingBingo ? 'Verifying...' : 'Bingo'}
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="bg-yellow-400 hover:bg-yellow-500 text-white font-bold text-sm sm:text-base py-2 sm:py-3 rounded-lg transition-all"
          >
            Refresh
          </button>
        </div>
      </div>
    </main>
  );
}

