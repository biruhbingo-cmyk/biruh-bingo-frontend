'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useGameStore } from '@/store/gameStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function CardSelection({ userId }: { userId: string }) {
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const { selectedGameType, setCurrentView, setSelectedCardId, setCurrentGameId, balance: storeBalance } = useGameStore();
  const requiredSelections = 1; // Number of cards needed

  useEffect(() => {
    fetchUserBalance();
  }, [userId]);

  const fetchUserBalance = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/user/${userId}`);
      const userBalance = response.data?.user?.balance ?? 0;
      setBalance(userBalance);
    } catch (error: any) {
      if (error.response?.status === 404) {
        try {
          const token = new URLSearchParams(window.location.search).get('token');
          if (token) {
            const telegramResponse = await axios.get(`${API_URL}/api/user/telegram/${token}`);
            const userBalance = telegramResponse.data?.user?.balance ?? 0;
            setBalance(userBalance);
          }
        } catch (telegramError) {
          console.error('Error fetching by telegram ID:', telegramError);
        }
      }
    }
  };

  const handleNumberClick = (number: number) => {
    if (selectedNumbers.length >= 25 && !selectedNumbers.includes(number)) {
      // Limit to 25 numbers for a bingo card (5x5 grid)
      return;
    }

    setSelectedNumbers((prev) => {
      if (prev.includes(number)) {
        return prev.filter((n) => n !== number);
      } else {
        // Limit to 25 selections (for a standard bingo card)
        if (prev.length >= 25) return prev;
        return [...prev, number];
      }
    });
  };

  const handleStartGame = async () => {
    if (selectedNumbers.length < 25 || !selectedGameType) {
      alert('Please select 25 numbers to create your bingo card');
      return;
    }

    try {
      // First, we need to create or find a card with these numbers
      // For now, we'll try to find an existing card or create one
      // This might need backend support for custom cards
      const response = await axios.post(`${API_URL}/api/game/join`, {
        userId,
        gameType: selectedGameType,
        selectedNumbers: selectedNumbers.sort((a, b) => a - b), // Send sorted numbers
      });

      if (response.data.success) {
        // If backend returns a cardId, use it
        const cardId = response.data.cardId || 1; // Fallback to 1 if not provided
        setSelectedCardId(cardId);
        setCurrentGameId(response.data.gameId);
        setCurrentView('play');
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to join game');
    }
  };

  // Generate numbers 1-100
  const numbers = Array.from({ length: 100 }, (_, i) => i + 1);

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
          <span className={selectedNumbers.length >= 25 ? 'text-white' : 'text-red-500'}>
            {selectedNumbers.length >= 25 ? 1 : 0}
          </span>
          <span className="text-white">/{requiredSelections}</span>
        </div>
      </div>

      {/* Number Grid */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-12 gap-2">
          {numbers.map((number) => {
            const isSelected = selectedNumbers.includes(number);
            const isDisabled = !isSelected && selectedNumbers.length >= 25;
            
            return (
              <button
                key={number}
                onClick={() => handleNumberClick(number)}
                disabled={isDisabled}
                className={`aspect-square rounded-lg border-2 transition-all text-sm font-semibold ${
                  isSelected
                    ? 'bg-blue-500 border-blue-600 text-white'
                    : isDisabled
                    ? 'bg-gray-700 border-gray-600 text-gray-500 cursor-not-allowed'
                    : 'bg-[#1e3a5f] border-[#254a75] text-white hover:bg-[#254a75] hover:border-blue-500'
                }`}
              >
                {number}
              </button>
            );
          })}
        </div>
      </div>

      {/* Start Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0a1929] border-t border-[#1e3a5f]">
        <button
          onClick={handleStartGame}
          disabled={selectedNumbers.length < 25}
          className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all ${
            selectedNumbers.length >= 25
              ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-yellow-500 text-white hover:from-blue-600 hover:via-blue-700 hover:to-yellow-600 shadow-lg'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
          <span>ይጫኑ ለመጀመር...</span>
        </button>
      </div>
    </div>
  );
}
