'use client';

import { useEffect, useState, useRef } from 'react';
import { getGames, calculatePotentialWin, getCountdownSeconds, WS_URL, type Game, type Wallet } from '@/lib/api';
import { useGameStore } from '@/store/gameStore';
import { useGameWebSocket, type WebSocketMessage } from '@/hooks/useSocket';
import Header from './Header';
import { type User } from '@/lib/api';

// Game type mapping: G1-G7 to bet amounts
const GAME_TYPES = [
  { type: 'G1', bet: 5 },
  { type: 'G2', bet: 7 },
  { type: 'G3', bet: 10 },
  { type: 'G4', bet: 20 },
  { type: 'G5', bet: 50 },
  { type: 'G6', bet: 100 },
  { type: 'G7', bet: 200 },
];

interface GameSelectionProps {
  user: User;
  wallet: Wallet;
}

export default function GameSelection({ user, wallet }: GameSelectionProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [countdowns, setCountdowns] = useState<Record<string, number | null>>({});
  const { setCurrentView, setSelectedGameType, setSelectedGameTypeString, setCurrentGameId } = useGameStore();
  
  // Store WebSocket connections for each game type
  const socketsRef = useRef<Map<string, WebSocket>>(new Map());

  // Fetch initial games data
  useEffect(() => {
    const fetchGames = async () => {
      try {
        const gamesData = await getGames();
        setGames(gamesData);
      } catch (error) {
        console.error('Error fetching games:', error);
      }
    };

    fetchGames();
  }, []);

  // Connect WebSocket for each game type to get real-time updates
  useEffect(() => {
    const gameTypes = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'];
    
    // Ensure WS_URL doesn't have trailing slash
    const baseUrl = WS_URL.endsWith('/') ? WS_URL.slice(0, -1) : WS_URL;
    
    gameTypes.forEach((gameType) => {
      const wsUrl = `${baseUrl}/api/v1/ws/game?type=${gameType}`;
      
      try {
        const ws = new WebSocket(wsUrl);
        socketsRef.current.set(gameType, ws);

        ws.onopen = () => {
          console.log(`✅ Connected to WebSocket for ${gameType}`);
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            
            switch (message.event) {
              case 'INITIAL_STATE':
                if (message.data.game) {
                  setGames((prev) => {
                    const exists = prev.some((g) => g.id === message.data.game.id);
                    if (!exists) {
                      return [...prev, message.data.game];
                    }
                    return prev.map((g) => 
                      g.id === message.data.game.id ? message.data.game : g
                    );
                  });
                }
                break;

              case 'GAME_STATUS':
                if (message.data.state) {
                  console.log(`🔄 Game status for ${gameType}:`, message.data.state, 'Player count:', message.data.player_count);
                  setGames((prev) => {
                    const gameIndex = prev.findIndex((g) => g.game_type === gameType);
                    if (gameIndex !== -1) {
                      const updated = [...prev];
                      updated[gameIndex] = {
                        ...updated[gameIndex],
                        state: message.data.state,
                        player_count: message.data.player_count ?? updated[gameIndex].player_count,
                        prize_pool: message.data.prize_pool ?? updated[gameIndex].prize_pool,
                        countdown_ends: message.data.countdown_ends ?? updated[gameIndex].countdown_ends,
                      };
                      console.log(`📊 Updated game ${gameType}:`, updated[gameIndex]);
                      return updated;
                    }
                    return prev;
                  });
                }
                break;

              case 'PLAYER_COUNT':
                if (message.data.count !== undefined) {
                  console.log(`👥 Player count for ${gameType}:`, message.data.count);
                  setGames((prev) => {
                    const gameIndex = prev.findIndex((g) => g.game_type === gameType);
                    if (gameIndex !== -1) {
                      const updated = [...prev];
                      updated[gameIndex] = {
                        ...updated[gameIndex],
                        player_count: message.data.count,
                      };
                      console.log(`📊 Updated player count for ${gameType}:`, updated[gameIndex]);
                      return updated;
                    }
                    return prev;
                  });
                }
                break;

              case 'PLAYER_JOINED':
              case 'PLAYER_LEFT':
                console.log(`👥 Player ${message.event} for ${gameType}:`, message.data);
                setGames((prev) => {
                  const gameIndex = prev.findIndex((g) => g.game_type === gameType);
                  
                  // If game doesn't exist, wait for INITIAL_STATE to create it
                  if (gameIndex === -1) {
                    console.log(`⚠️ Game ${gameType} not found in state, waiting for INITIAL_STATE`);
                    return prev;
                  }
                  
                  const updated = [...prev];
                  const currentGame = updated[gameIndex];
                  
                  // If count is provided, use it; otherwise increment/decrement manually
                  let newPlayerCount: number;
                  if (message.data.count !== undefined) {
                    newPlayerCount = message.data.count;
                  } else {
                    // Manually increment for JOINED, decrement for LEFT
                    if (message.event === 'PLAYER_JOINED') {
                      newPlayerCount = (currentGame.player_count || 0) + 1;
                    } else {
                      newPlayerCount = Math.max(0, (currentGame.player_count || 0) - 1);
                    }
                  }
                  
                  updated[gameIndex] = {
                    ...currentGame,
                    player_count: newPlayerCount,
                    prize_pool: message.data.prize_pool ?? currentGame.prize_pool,
                  };
                  console.log(`📊 Updated ${message.event} for ${gameType}: player_count=${newPlayerCount}`, updated[gameIndex]);
                  return updated;
                });
                break;

              case 'COUNTDOWN':
                if (message.data.secondsLeft !== undefined) {
                  console.log(`⏰ Countdown for ${gameType}:`, message.data.secondsLeft);
                  setGames((prev) => {
                    const gameIndex = prev.findIndex((g) => g.game_type === gameType);
                    if (gameIndex !== -1) {
                      const game = prev[gameIndex];
                      // Update countdown in the countdowns state
                      setCountdowns((prevCountdowns) => ({
                        ...prevCountdowns,
                        [game.id]: message.data.secondsLeft,
                      }));
                      // Also update countdown_ends if provided
                      if (message.data.countdown_ends) {
                        const updated = [...prev];
                        updated[gameIndex] = {
                          ...updated[gameIndex],
                          countdown_ends: message.data.countdown_ends,
                        };
                        return updated;
                      }
                    }
                    return prev;
                  });
                }
                break;

              default:
                break;
            }
          } catch (error) {
            console.error(`Error parsing WebSocket message for ${gameType}:`, error);
          }
        };

        ws.onerror = (error) => {
          console.error(`WebSocket error for ${gameType}:`, error);
        };

        ws.onclose = () => {
          console.log(`WebSocket closed for ${gameType}`);
          socketsRef.current.delete(gameType);
        };
      } catch (error) {
        console.error(`Failed to create WebSocket for ${gameType}:`, error);
      }
    });

    // Cleanup: close all WebSocket connections
    return () => {
      socketsRef.current.forEach((ws, gameType) => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      });
      socketsRef.current.clear();
    };
  }, []);

  // Update countdowns every second
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      const newCountdowns: Record<string, number | null> = {};
      games.forEach((game) => {
        if (game.state === 'COUNTDOWN' && game.countdown_ends) {
          newCountdowns[game.id] = getCountdownSeconds(game.countdown_ends);
        }
      });
      setCountdowns(newCountdowns);
    }, 1000);
    return () => clearInterval(countdownInterval);
  }, [games]);

  const getStatusLabel = (state: Game['state']) => {
    switch (state) {
      case 'WAITING':
        return 'ክፍት';
      case 'COUNTDOWN':
        return 'በመቁጠር ላይ';
      case 'DRAWING':
        return 'በመጫወት ላይ';
      case 'FINISHED':
        return 'ያለቀ';
      case 'CLOSED':
        return 'ዝግ';
      case 'CANCELLED':
        return 'ተሰርዟል';
      default:
        return 'ክፍት';
    }
  };

  const getStatusColor = (state: Game['state']) => {
    switch (state) {
      case 'WAITING':
        return 'bg-green-500';
      case 'COUNTDOWN':
        return 'bg-yellow-500';
      case 'DRAWING':
        return 'bg-red-500';
      case 'FINISHED':
      case 'CLOSED':
      case 'CANCELLED':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleGameClick = async (game: Game | undefined, betAmount: number, gameType: string) => {
    // Check balance first
    if (wallet.balance < betAmount) {
      alert('Insufficient balance');
      return;
    }

    // If game already exists, use it
    if (game && (game.state === 'WAITING' || game.state === 'COUNTDOWN')) {
      setCurrentGameId(game.id);
      setSelectedGameType(betAmount);
      setSelectedGameTypeString(gameType); // Store game type string for WebSocket
      setCurrentView('cards');
      return;
    }

    // Otherwise, fetch games with type filter - this will auto-create a game if none exists
    try {
      const gamesWithType = await getGames(gameType);
      const foundGame = gamesWithType.find(
        (g) => g.game_type === gameType && (g.state === 'WAITING' || g.state === 'COUNTDOWN')
      );
      
      if (foundGame) {
        setCurrentGameId(foundGame.id);
        setSelectedGameType(betAmount);
        setSelectedGameTypeString(gameType); // Store game type string for WebSocket
        setCurrentView('cards');
        // Update the games list to include the newly created game
        setGames((prev) => {
          const exists = prev.some((g) => g.id === foundGame.id);
          if (!exists) {
            return [...prev, foundGame];
          }
          return prev.map((g) => (g.id === foundGame.id ? foundGame : g));
        });
      } else {
        alert('Unable to create or find a game. Please try again.');
      }
    } catch (error) {
      console.error('Error finding/creating game:', error);
      alert('Unable to create or find a game. Please try again.');
    }
  };

  return (
    <main className="min-h-screen bg-[#0a1929] text-white">
      <Header user={user} wallet={wallet} />

      {/* Game Selection List */}
      <div className="p-2 sm:p-4 space-y-2 sm:space-y-3">
        {GAME_TYPES.map((gameType) => {
          // Find game for this type (WAITING or COUNTDOWN)
          const game = games.find(
            (g) => g.game_type === gameType.type && (g.state === 'WAITING' || g.state === 'COUNTDOWN')
          );

          const betAmount = gameType.bet;
          const playerCount = game?.player_count || 0;
          const potentialWin = game ? calculatePotentialWin(game) : 0;
          const state = game?.state || 'WAITING';
          const countdown = game ? countdowns[game.id] : null;
          const canJoin = wallet.balance >= betAmount;

          return (
            <div
              key={gameType.type}
              className="bg-[#1e3a5f] rounded-lg p-2 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4"
            >
              {/* Left Side - Game Info */}
              <div className="flex-1 w-full sm:w-auto">
                {/* Bet Amount and Status */}
                <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2 flex-wrap">
                  <span className="text-lg sm:text-2xl font-bold text-white">{betAmount} ብር</span>
                  <span className={`${getStatusColor(state)} text-white text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded font-bold`}>
                    {getStatusLabel(state)}
                  </span>
                  {state === 'COUNTDOWN' && countdown !== null && (
                    <span className="bg-red-500/20 text-red-400 text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded font-mono font-bold">
                      {countdown}s
                    </span>
                  )}
                </div>

                {/* Player Count and Potential Win */}
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    <span className="text-sm sm:text-base text-gray-300 font-bold">{playerCount > 0 ? playerCount : '-'} players</span>
                  </div>
                  <div className="bg-yellow-500/20 text-yellow-400 text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded font-bold">
                    {potentialWin > 0 ? `${potentialWin.toFixed(2)} ብር` : '- ብር'}
                  </div>
                </div>
              </div>

              {/* Right Side - Join Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleGameClick(game, betAmount, gameType.type);
                }}
                disabled={!canJoin}
                className={`w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-base sm:text-lg flex items-center justify-center gap-2 transition-all ${
                  canJoin
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 cursor-pointer'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                }`}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                </svg>
                <span>ይግቡ</span>
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}

