'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useGameStore } from '@/store/gameStore';
import { useSocket } from '@/hooks/useSocket';

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
    fetchGames();
    fetchUserBalance();
    const interval = setInterval(fetchGames, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

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
      const response = await axios.get(`${API_URL}/api/user/${userId}`);
      setBalance(response.data.user.balance);
      setStoreBalance(response.data.user.balance);
    } catch (error) {
      console.error('Error fetching balance:', error);
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

  return (
    <div className="min-h-screen p-4">
      {/* Header with Back Button and Balance */}
      <div className="flex justify-between items-center mb-6 text-white">
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-white/20 rounded-lg backdrop-blur-sm"
        >
          ← Back
        </button>
        <div className="text-lg font-bold">
          Balance: {balance} birr
        </div>
      </div>

      {/* Game List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-white">Loading games...</div>
        ) : (
          gameTypes.map((type) => {
            const game = games.find((g) => g.gameType === type);
            const canJoin = balance >= type && game && game.playerCount > 0;

            return (
              <div
                key={type}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white"
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">{type} birr Game</h2>
                  <span
                    className={`px-3 py-1 rounded-full text-sm ${
                      game?.status === 'playing'
                        ? 'bg-red-500'
                        : game?.status === 'waiting'
                        ? 'bg-green-500'
                        : 'bg-gray-500'
                    }`}
                  >
                    {game?.status || 'Closed'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm opacity-75">Players</p>
                    <p className="text-xl font-semibold">{game?.playerCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm opacity-75">Potential Win</p>
                    <p className="text-xl font-semibold">{game?.potentialWin || 0} birr</p>
                  </div>
                </div>

                <button
                  onClick={() => handleJoinGame(type)}
                  disabled={!canJoin || balance < type}
                  className={`w-full py-3 rounded-lg font-semibold transition-all ${
                    canJoin && balance >= type
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {balance < type
                    ? 'Insufficient Balance'
                    : game?.playerCount === 0
                    ? 'No Players'
                    : 'Get In'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

