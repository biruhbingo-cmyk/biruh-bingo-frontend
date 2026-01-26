'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { API_URL, getWalletByTelegramId } from '@/lib/api';
import axios from 'axios';

// Cards are 1-100, server-generated
const CARD_IDS = Array.from({ length: 100 }, (_, i) => i + 1);

export default function CardSelection({ userId }: { userId: string }) {
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const { selectedGameType, currentGameId, setCurrentView, setSelectedCardId: setStoreCardId, setCurrentGameId: setStoreGameId } = useGameStore();

  useEffect(() => {
    fetchUserBalance();
  }, [userId]);

  const fetchUserBalance = async () => {
    try {
      const wallet = await getWalletByTelegramId(userId);
      setBalance(wallet.balance);
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const handleCardClick = (cardId: number) => {
    setSelectedCardId(cardId);
  };

  const handleJoinGame = async () => {
    if (!selectedCardId || !currentGameId) {
      alert('Please select a card and ensure you have a game selected');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/api/v1/games/${currentGameId}/join`, {
        user_id: userId,
        card_id: selectedCardId,
      });

      if (response.data.player) {
        setStoreCardId(selectedCardId);
        // Card data should be stored or fetched from backend
        // The backend will validate and provide the card data
        setCurrentView('play');
      }
    } catch (error: any) {
      console.error('Error joining game:', error);
      alert(error.response?.data?.error || 'Failed to join game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1929] text-white">
      {/* Header */}
      <div className="bg-[#132f4c] px-4 py-3 flex items-center justify-between border-b border-[#1e3a5f]">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-white">Mekdes Bingo</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-1.5 rounded-lg">
            <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v1a16.94 16.94 0 0012 6 16.94 16.94 0 0012-6V6a2 2 0 00-2-2H4z" />
              <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
            </svg>
            <span className="text-yellow-400 font-semibold">{balance.toFixed(2)} ETB</span>
          </div>
          <button 
            onClick={() => setCurrentView('selection')}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* User Info Banner */}
      <div className="bg-[#1e3a5f] px-4 py-3 border-b border-[#254a75]">
        <div className="flex items-center gap-4 mb-2">
          <button 
            onClick={() => setCurrentView('selection')}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            ተመለስ
          </button>
        </div>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-xs text-gray-400 mb-1">Balance</div>
            <div className="text-sm font-semibold text-white">{balance.toFixed(0)} ETB</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Coins</div>
            <div className="text-sm font-semibold text-white">#</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Derash</div>
            <div className="text-sm font-semibold text-white">-</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Stake</div>
            <div className="text-sm font-semibold text-white">{selectedGameType || '-'}</div>
          </div>
        </div>
      </div>

      {/* Card Selection Status */}
      <div className="px-4 py-3 bg-[#0a1929]">
        <div className="text-sm">
          <span className="text-gray-400">Num of cart selected - </span>
          <span className={selectedCardId ? 'text-red-500' : 'text-red-500'}>
            {selectedCardId ? 1 : 0}
          </span>
          <span className="text-white">/1</span>
        </div>
      </div>

      {/* Cards Grid (1-100) */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-12 gap-2 mb-6">
          {CARD_IDS.map((cardId) => {
            const isSelected = selectedCardId === cardId;
            return (
              <button
                key={cardId}
                onClick={() => handleCardClick(cardId)}
                className={`aspect-square rounded-lg border-2 transition-all text-xs font-semibold relative ${
                  isSelected
                    ? 'bg-[#1e3a5f] border-red-500 border-2 text-white ring-2 ring-red-500 ring-offset-1'
                    : 'bg-[#1e3a5f] border-[#254a75] text-white hover:bg-[#254a75] hover:border-blue-500'
                }`}
              >
                {cardId}
                {isSelected && (
                  <div className="absolute inset-0 rounded-lg border-2 border-red-500"></div>
                )}
              </button>
            );
          })}
        </div>

        {/* Card Preview Placeholder */}
        {selectedCardId ? (
          <div className="flex justify-center mb-24">
            <div className="bg-white/10 rounded-lg p-4 text-center">
              <p className="text-white font-semibold">Card {selectedCardId} Selected</p>
              <p className="text-gray-400 text-sm mt-2">Card data will be provided by the backend</p>
            </div>
          </div>
        ) : (
          <div className="bg-white/10 rounded-lg p-8 mb-24 text-center text-gray-400">
            <p>Select a card above to join the game</p>
          </div>
        )}
      </div>

      {/* Start Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0a1929] border-t border-[#1e3a5f]">
        <button
          onClick={handleJoinGame}
          disabled={!selectedCardId || loading}
          className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all ${
            selectedCardId && !loading
              ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-yellow-500 text-white hover:from-blue-600 hover:via-blue-700 hover:to-yellow-600 shadow-lg'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Joining...</span>
            </>
          ) : (
            <>
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              <span>ወደ ጨዋታው ይግቡ</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
