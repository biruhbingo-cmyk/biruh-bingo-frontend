'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useGameStore } from '@/store/gameStore';

interface Card {
  _id: string;
  cardId: number;
  numbers: {
    B: number[];
    I: number[];
    N: number[];
    G: number[];
    O: number[];
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function CardSelection({ userId }: { userId: string }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const { selectedGameType, setCurrentView, setSelectedCardId, setCurrentGameId } = useGameStore();

  useEffect(() => {
    fetchCards();
    fetchUserBalance();
  }, [userId]);

  const fetchCards = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/game/cards/all`);
      setCards(response.data.cards || []);
    } catch (error) {
      console.error('Error fetching cards:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleCardClick = (card: Card) => {
    setSelectedCard(card);
  };

  const handleStartGame = async () => {
    if (!selectedCard || !selectedGameType) return;

    try {
      const response = await axios.post(`${API_URL}/api/game/join`, {
        userId,
        gameType: selectedGameType,
        cardId: selectedCard.cardId,
      });

      if (response.data.success) {
        setSelectedCardId(selectedCard.cardId);
        setCurrentGameId(response.data.gameId);
        setCurrentView('play');
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to join game');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-[#0a1929]">
        <div>Loading cards...</div>
      </div>
    );
  }

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
          <span className={selectedCard ? 'text-red-500' : 'text-red-500'}>
            {selectedCard ? 1 : 0}
          </span>
          <span className="text-white">/1</span>
        </div>
      </div>

      {/* Cards Grid (1-100) */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-12 gap-2 mb-6">
          {cards.slice(0, 100).map((card) => {
            const isSelected = selectedCard?.cardId === card.cardId;
            return (
              <button
                key={card._id}
                onClick={() => handleCardClick(card)}
                className={`aspect-square rounded-lg border-2 transition-all text-xs font-semibold relative ${
                  isSelected
                    ? 'bg-[#1e3a5f] border-red-500 border-2 text-white ring-2 ring-red-500 ring-offset-1'
                    : 'bg-[#1e3a5f] border-[#254a75] text-white hover:bg-[#254a75] hover:border-blue-500'
                }`}
              >
                {card.cardId}
                {isSelected && (
                  <div className="absolute inset-0 rounded-lg border-2 border-red-500"></div>
                )}
              </button>
            );
          })}
        </div>

        {/* BINGO Card Table - Shows below the grid */}
        {selectedCard ? (
          <div className="bg-white rounded-lg p-4 mb-24">
            <div className="grid grid-cols-5 gap-1 mb-2">
              {(['B', 'I', 'N', 'G', 'O'] as const).map((letter, idx) => {
                const colors = ['bg-pink-500', 'bg-green-400', 'bg-blue-600', 'bg-orange-500', 'bg-red-500'];
                return (
                  <div
                    key={letter}
                    className={`text-center font-bold text-sm py-2 ${colors[idx]} text-white rounded-t`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>

            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="grid grid-cols-5 gap-1">
                {(['B', 'I', 'N', 'G', 'O'] as const).map((letter) => {
                  const num = selectedCard.numbers[letter][row];
                  // Check if this is the center cell (row 2, column N) - should be empty for 24 number cards
                  const isCenter = row === 2 && letter === 'N';
                  
                  return (
                    <div
                      key={`${letter}-${row}`}
                      className={`aspect-square rounded border-2 border-gray-300 flex items-center justify-center font-semibold text-sm ${
                        isCenter ? 'bg-gray-200 text-gray-400' : 'bg-white text-black'
                      }`}
                    >
                      {isCenter ? '#' : num}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white/10 rounded-lg p-8 mb-24 text-center text-gray-400">
            <p>Select a card above to view its BINGO numbers</p>
          </div>
        )}
      </div>

      {/* Start Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0a1929] border-t border-[#1e3a5f]">
        <button
          onClick={handleStartGame}
          disabled={!selectedCard}
          className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all ${
            selectedCard
              ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-yellow-500 text-white hover:from-blue-600 hover:via-blue-700 hover:to-yellow-600 shadow-lg'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
          <span>ወደ ጨዋታው ይግቡ</span>
        </button>
      </div>
    </div>
  );
}
