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
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [showCardDetails, setShowCardDetails] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { selectedGameType, setCurrentView, setSelectedCardId, setCurrentGameId } = useGameStore();

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/game/cards/all`);
      setCards(response.data.cards);
    } catch (error) {
      console.error('Error fetching cards:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (cardId: number) => {
    setSelectedCard(cardId);
    setShowCardDetails(cardId);
  };

  const handleStartGame = async () => {
    if (!selectedCard || !selectedGameType) return;

    try {
      const response = await axios.post(`${API_URL}/api/game/join`, {
        userId,
        gameType: selectedGameType,
        cardId: selectedCard,
      });

      if (response.data.success) {
        setSelectedCardId(selectedCard);
        setCurrentGameId(response.data.gameId);
        setCurrentView('play');
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to join game');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div>Loading cards...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 text-white">
        <button
          onClick={() => setCurrentView('selection')}
          className="px-4 py-2 bg-white/20 rounded-lg backdrop-blur-sm"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold">Select Your Card</h1>
        <div></div>
      </div>

      {/* Card Details Modal */}
      {showCardDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Card {showCardDetails}</h2>
              <button
                onClick={() => setShowCardDetails(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {cards.find((c) => c.cardId === showCardDetails) && (
              <div className="space-y-2">
                {(['B', 'I', 'N', 'G', 'O'] as const).map((letter) => {
                  const card = cards.find((c) => c.cardId === showCardDetails)!;
                  return (
                    <div key={letter} className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-500 text-white rounded flex items-center justify-center font-bold">
                        {letter}
                      </div>
                      <div className="flex gap-2">
                        {card.numbers[letter].map((num) => (
                          <div
                            key={num}
                            className="w-10 h-10 border-2 border-gray-300 rounded flex items-center justify-center font-semibold"
                          >
                            {num}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => {
                setSelectedCard(showCardDetails);
                setShowCardDetails(null);
              }}
              className={`w-full mt-4 py-3 rounded-lg font-semibold ${
                selectedCard === showCardDetails
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {selectedCard === showCardDetails ? 'Selected' : 'Select This Card'}
            </button>
          </div>
        </div>
      )}

      {/* Card Grid */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {cards.map((card) => (
          <button
            key={card._id}
            onClick={() => handleCardClick(card.cardId)}
            className={`aspect-square rounded-lg border-2 transition-all ${
              selectedCard === card.cardId
                ? 'bg-green-500 border-green-600 text-white'
                : 'bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20'
            }`}
          >
            {card.cardId}
          </button>
        ))}
      </div>

      {/* Start Game Button */}
      <button
        onClick={handleStartGame}
        disabled={!selectedCard}
        className={`w-full py-4 rounded-lg font-bold text-lg ${
          selectedCard
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-gray-500 text-gray-300 cursor-not-allowed'
        }`}
      >
        {selectedCard ? 'Start Game' : 'Select a Card to Start'}
      </button>
    </div>
  );
}

