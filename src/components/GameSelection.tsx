'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import {
  getUserByTelegramId,
  getWalletByTelegramId,
  getGames,
  calculatePotentialWin,
  getCountdownSeconds,
  type User,
  type Wallet,
  type Game,
} from '@/lib/api';

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

export default function GameSelection({ userId }: { userId: string }) {
  const [games, setGames] = useState<Game[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdowns, setCountdowns] = useState<Record<string, number | null>>({});
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const { setCurrentView, setSelectedGameType, setBalance: setStoreBalance, setCurrentGameId } = useGameStore();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUrl(window.location.href);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetchData();
      const interval = setInterval(() => {
        fetchData();
      }, 2000); // Update every 2 seconds for countdown
      return () => clearInterval(interval);
    }
  }, [userId]);

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

  const fetchData = async () => {
    try {
      // Fetch user and wallet by telegram_id
      const [userData, walletData, gamesData] = await Promise.all([
        getUserByTelegramId(userId),
        getWalletByTelegramId(userId),
        getGames(),
      ]);

      setUser(userData);
      setWallet(walletData);
      setStoreBalance(walletData.balance);
      setGames(gamesData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = (game: Game) => {
    if (!wallet) return;

    if (wallet.balance < game.bet_amount) {
      alert('Insufficient balance');
      return;
    }

    if (game.state !== 'WAITING' && game.state !== 'COUNTDOWN') {
      alert('Game is not accepting new players');
      return;
    }

    setCurrentGameId(game.id);
    setSelectedGameType(game.bet_amount);
    setCurrentView('cards');
  };

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

  const canJoinGame = (game: Game): boolean => {
    if (!wallet) return false;
    if (wallet.balance < game.bet_amount) return false;
    if (game.state !== 'WAITING' && game.state !== 'COUNTDOWN') return false;
    return true;
  };

  const getUserDisplayName = (): string => {
    if (!user) return 'User';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    return `${firstName} ${lastName}`.trim() || 'User';
  };

  return (
    <div className="min-h-screen bg-[#0a1929] text-white">
      {/* Debug URL */}
      <div className="bg-gray-800/50 px-4 py-2 border-b border-gray-700">
        <p className="text-xs text-gray-400 font-mono break-all">
          <span className="text-yellow-400">DEBUG:</span> {currentUrl}
        </p>
      </div>

      {/* Header - User Name and Balance */}
      <div className="bg-[#132f4c] px-4 py-4 flex items-center justify-between border-b border-[#1e3a5f]">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Mekdes Bingo</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <span className="text-white font-semibold">{getUserDisplayName()}</span>
          </div>
          <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-1.5 rounded-lg">
            <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v1a16.94 16.94 0 0012 6 16.94 16.94 0 0012-6V6a2 2 0 00-2-2H4z" />
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
            </svg>
            <span className="text-yellow-400 font-semibold">
              {wallet ? wallet.balance.toFixed(2) : '0.00'} ETB
            </span>
          </div>
        </div>
      </div>

      {/* Game List */}
      <div className="p-4 space-y-3 pb-32">
        {loading ? (
          <div className="text-center text-white py-8">Loading games...</div>
        ) : (
          GAME_TYPES.map((gameType) => {
            // Find game for this type (WAITING or COUNTDOWN)
            const game = games.find(
              (g) => g.game_type === gameType.type && (g.state === 'WAITING' || g.state === 'COUNTDOWN')
            );

            const betAmount = gameType.bet;
            const playerCount = game?.player_count || 0;
            const potentialWin = game ? calculatePotentialWin(game) : 0;
            const canJoin = game ? canJoinGame(game) : wallet ? wallet.balance >= betAmount : false;
            const state = game?.state || 'WAITING';
            const countdown = game ? countdowns[game.id] : null;

            return (
              <div
                key={gameType.type}
                onClick={() => {
                  if (game && canJoin) {
                    handleJoinGame(game);
                  }
                }}
                className={`bg-[#1e3a5f] rounded-lg p-4 flex items-center justify-between cursor-pointer transition-all ${
                  game && canJoin ? 'hover:bg-[#254a75] active:scale-[0.98]' : 'opacity-60'
                }`}
              >
                {/* Left Side */}
                <div className="flex-1">
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
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      <span className="text-sm text-gray-300">{playerCount > 0 ? playerCount : '-'}</span>
                    </div>
                    <div className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded">
                      {potentialWin > 0 ? `${potentialWin.toFixed(2)} ብር ደራሽ` : '- ብር ደራሽ'}
                    </div>
                  </div>
                </div>

                {/* Right Side - Join Button */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                    game && canJoin
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                  </svg>
                  <span>ይግቡ</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0a1929] border-t border-[#1e3a5f] p-4 text-center">
        <p className="text-gray-400 text-xs">
          ውጤት ውድድሩ ከሚጀምርበት ሳምንት ጀምሮ በየእለቱ የምናሳውቅ
        </p>
      </div>
    </div>
  );
}
