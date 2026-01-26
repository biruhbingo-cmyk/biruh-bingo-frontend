'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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

function HomeContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdowns, setCountdowns] = useState<Record<string, number | null>>({});

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Get telegram_id from token parameter (or userId if numeric)
        const token = searchParams.get('token');
        const userIdParam = searchParams.get('userId');
        
        const telegramId = token || (userIdParam && /^\d+$/.test(userIdParam) ? userIdParam : null);
        
        if (!telegramId) {
          setError('Missing telegram_id parameter');
          setLoading(false);
          return;
        }

        // Fetch user, wallet, and games data
        const [userData, walletData, gamesData] = await Promise.all([
          getUserByTelegramId(telegramId),
          getWalletByTelegramId(telegramId),
          getGames(),
        ]);

        setUser(userData);
        setWallet(walletData);
        setGames(gamesData);
      } catch (err: any) {
        console.error('Error fetching user data:', err);
        setError(err.response?.data?.error || 'Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
    
    // Refresh games every 2 seconds
    const interval = setInterval(() => {
      const token = searchParams.get('token');
      const userIdParam = searchParams.get('userId');
      const telegramId = token || (userIdParam && /^\d+$/.test(userIdParam) ? userIdParam : null);
      if (telegramId) {
        getGames().then(setGames).catch(console.error);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [searchParams]);

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

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a1929] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  if (error || !user || !wallet) {
    return (
      <main className="min-h-screen bg-[#0a1929] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-400">Error</h1>
          <p className="text-gray-400">{error || 'Failed to load user data'}</p>
        </div>
      </main>
    );
  }

  const fullName = `${user.first_name} ${user.last_name || ''}`.trim();

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

  const handleGameClick = (game: Game | undefined, betAmount: number) => {
    if (!game) {
      // TODO: Create new game or show message
      console.log('No game available for this type');
      return;
    }
    // TODO: Navigate to card selection page
    console.log('Navigate to card selection for game:', game.id);
  };

  return (
    <main className="min-h-screen bg-[#0a1929] text-white">
      {/* Header Row - User Name and Balance */}
      <div className="px-4 py-4 flex items-center justify-between">
        {/* Left: User Name */}
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
          <span className="text-white font-semibold text-lg">{fullName}</span>
        </div>

        {/* Right: Balance */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg">
          <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 00-2 2v1a16.94 16.94 0 0012 6 16.94 16.94 0 0012-6V6a2 2 0 00-2-2H4z" />
            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
          </svg>
          <span className="text-yellow-400 font-semibold text-lg">
            {wallet.balance.toFixed(2)} ETB
          </span>
        </div>
      </div>

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
          const canJoin = wallet ? wallet.balance >= betAmount : false;

          return (
            <div
              key={gameType.type}
              className="bg-[#1e3a5f] rounded-lg p-4 flex items-center justify-between cursor-pointer transition-all hover:bg-[#254a75]"
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
                onClick={() => handleGameClick(game, betAmount)}
                disabled={!canJoin || !game}
                className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                  canJoin && game
                    ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
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

export default function Home() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0a1929] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </main>
    }>
      <HomeContent />
    </Suspense>
  );
}
