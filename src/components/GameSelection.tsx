'use client';

import { useEffect, useState } from 'react';
import { getGames, calculatePotentialWin, getCountdownSeconds, type Game, type Wallet } from '@/lib/api';
import { useGameStore } from '@/store/gameStore';
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
    
    // Refresh games every 2 seconds
    const interval = setInterval(() => {
      fetchGames();
    }, 2000);
    
    return () => clearInterval(interval);
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
      <div className="p-4 space-y-3 pb-32">
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
              className="bg-[#1e3a5f] rounded-lg p-4 flex items-center justify-between"
            >
              {/* Left Side - Game Info */}
              <div className="flex-1">
                {/* Bet Amount and Status */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xl font-bold text-white">{betAmount} ብር</span>
                  <span className={`${getStatusColor(state)} text-white text-xs px-2 py-1 rounded`}>
                    {getStatusLabel(state)}
                  </span>
                  {state === 'COUNTDOWN' && countdown !== null && (
                    <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded font-mono">
                      {countdown}s
                    </span>
                  )}
                </div>

                {/* Player Count and Potential Win */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    <span className="text-sm text-gray-300">{playerCount > 0 ? playerCount : '-'} players</span>
                  </div>
                  <div className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded">
                    {potentialWin > 0 ? `${potentialWin.toFixed(2)} ብር ደራሽ` : '- ብር ደራሽ'}
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
                className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                  canJoin
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 cursor-pointer'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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

