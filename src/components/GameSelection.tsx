'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useGameStore } from '@/store/gameStore';

interface Game {
  gameType: number;
  status: string;
  playerCount: number;
  prizePool: number;
  potentialWin: number;
  gameId: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function GameSelection({ userId }: { userId: string }) {
  const [games, setGames] = useState<Game[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const { setCurrentView, setSelectedGameType, setBalance: setStoreBalance } = useGameStore();

  useEffect(() => {
    if (userId) {
      fetchGames();
      fetchUserBalance();
      const interval = setInterval(() => {
        fetchGames();
        fetchUserBalance();
      }, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  }, [userId]);

  const fetchGames = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/game/list`);
      setGames(response.data.games);
    } catch (error) {
      console.error('Error fetching games:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserBalance = async () => {
    try {
      console.log('Fetching balance for userId:', userId);
      const response = await axios.get(`${API_URL}/api/user/${userId}`);
      console.log('Balance response:', response.data);
      const userBalance = response.data?.user?.balance ?? 0;
      console.log('Setting balance to:', userBalance);
      setBalance(userBalance);
      setStoreBalance(userBalance);
    } catch (error: any) {
      console.error('Error fetching balance:', error);
      console.error('Error details:', error.response?.data || error.message);
      // Try alternative endpoint if userId might be telegramId
      if (error.response?.status === 404) {
        try {
          const token = new URLSearchParams(window.location.search).get('token');
          if (token) {
            const telegramResponse = await axios.get(`${API_URL}/api/user/telegram/${token}`);
            const userBalance = telegramResponse.data?.user?.balance ?? 0;
            setBalance(userBalance);
            setStoreBalance(userBalance);
          }
        } catch (telegramError) {
          console.error('Error fetching by telegram ID:', telegramError);
        }
      }
    }
  };

  const handleJoinGame = async (gameType: number) => {
    if (balance < gameType) {
      alert('Insufficient balance');
      return;
    }

    setSelectedGameType(gameType);
    setCurrentView('cards');
  };

  const gameTypes = [5, 7, 10, 20, 50, 100, 200];

  const getStatusLabel = (status: string | undefined) => {
    if (status === 'playing') return 'በመጫወት ላይ';
    if (status === 'waiting') return 'ክፍት';
    return 'ክፍት';
  };

  const getStatusColor = (status: string | undefined) => {
    if (status === 'playing') return 'bg-red-500';
    return 'bg-green-500';
  };

  return (
    <div className="min-h-screen bg-[#0a1929] text-white">
      {/* Header */}
      <div className="bg-[#132f4c] px-4 py-3 flex items-center justify-between border-b border-[#1e3a5f]">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Cheers Bingo</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-1.5 rounded-lg">
            <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v1a16.94 16.94 0 0012 6 16.94 16.94 0 0012-6V6a2 2 0 00-2-2H4z" />
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
            </svg>
            <span className="text-yellow-400 font-semibold">{balance.toFixed(2)} ETB</span>
          </div>
          <button className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
          <button className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Game List */}
      <div className="p-4 space-y-3 pb-32">
        {loading ? (
          <div className="text-center text-white py-8">Loading games...</div>
        ) : (
          gameTypes.map((type) => {
            const game = games.find((g) => g.gameType === type);
            const status = game?.status || 'waiting';
            const playerCount = game?.playerCount || 0;
            const prize = game?.potentialWin || 0;
            const canJoin = balance >= type && status !== 'playing';

            return (
              <div
                key={type}
                onClick={() => {
                  if (canJoin) {
                    handleJoinGame(type);
                  }
                }}
                className={`bg-[#1e3a5f] rounded-lg p-4 flex items-center justify-between cursor-pointer transition-all ${
                  canJoin ? 'hover:bg-[#254a75] active:scale-[0.98]' : 'opacity-60'
                }`}
              >
                {/* Left Side */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl font-bold text-white">{type} ብር</span>
                    <span className={`${getStatusColor(status)} text-white text-xs px-2 py-1 rounded`}>
                      {getStatusLabel(status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      <span className="text-sm text-gray-300">{playerCount > 0 ? playerCount : '-'}</span>
                    </div>
                    <div className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded">
                      {prize > 0 ? `${prize} ብር ደራሽ` : '- ብር ደራሽ'}
                    </div>
                  </div>
                </div>

                {/* Right Side - Join Button */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                    canJoin
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V5V3z" />
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
