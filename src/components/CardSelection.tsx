'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { API_URL, getGameState, calculatePotentialWin, type User, type Wallet, type Game } from '@/lib/api';
import { useGameStore } from '@/store/gameStore';
import { useGameWebSocket, type WebSocketMessage } from '@/hooks/useSocket';
import axios from 'axios';
import { getCardData } from '@/lib/cardData';

// Generate 100 card IDs
const CARD_IDS = Array.from({ length: 100 }, (_, i) => i + 1);

interface CardSelectionProps {
  user: User;
  wallet: Wallet;
}

interface CardData {
  id: number;
  numbers: number[][];
}

export default function CardSelection({ user, wallet }: CardSelectionProps) {
  const searchParams = useSearchParams();
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [selectedCardData, setSelectedCardData] = useState<CardData | null>(null);
  const [joining, setJoining] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  
  const { setCurrentView, setSelectedCardId: setStoreCardId, currentGameId, selectedGameType, selectedGameTypeString } = useGameStore();

  // Connect to WebSocket for real-time updates (by game type - recommended)
  const socket = useGameWebSocket(selectedGameTypeString, currentGameId);

  // Fetch initial game state
  useEffect(() => {
    const fetchGameData = async () => {
      if (currentGameId) {
        try {
          const gameState = await getGameState(currentGameId);
          setGame(gameState.game);
        } catch (error) {
          console.error('Error fetching game data:', error);
        }
      }
    };

    fetchGameData();
  }, [currentGameId]);

  // Listen to WebSocket messages for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        switch (message.event) {
          case 'INITIAL_STATE':
            if (message.data.game) {
              setGame(message.data.game);
            }
            break;

          case 'GAME_STATUS':
            if (message.data.state) {
              setGame((prev) => prev ? { 
                ...prev, 
                state: message.data.state,
                player_count: message.data.player_count ?? prev.player_count,
                prize_pool: message.data.prize_pool ?? prev.prize_pool
              } : null);
            }
            break;

          case 'PLAYER_COUNT':
            if (message.data.count !== undefined) {
              setGame((prev) => prev ? { ...prev, player_count: message.data.count } : null);
            }
            break;

          case 'PLAYER_JOINED':
          case 'PLAYER_LEFT':
            // Update player count when players join/leave
            if (message.data.count !== undefined) {
              setGame((prev) => prev ? { ...prev, player_count: message.data.count } : null);
            }
            break;

          case 'COUNTDOWN':
            // Countdown updates - game state should already be COUNTDOWN
            // Could update countdown_ends if needed
            break;

          case 'CARDS_TAKEN':
            // Cards taken updates - could be used for UI updates
            break;

          case 'NUMBER_DRAWN':
            // Number drawn - for game play screen
            break;

          case 'PLAYER_ELIMINATED':
            // Player eliminated - could update player count
            if (message.data.count !== undefined) {
              setGame((prev) => prev ? { ...prev, player_count: message.data.count } : null);
            }
            break;

          case 'WINNER':
            // Game finished - update game state
            setGame((prev) => prev ? { ...prev, state: 'FINISHED' } : null);
            break;

          default:
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.addEventListener('message', handleMessage);

    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket]);

  const handleCardClick = (cardId: number) => {
    setSelectedCardId(cardId);
    
    // Get card data from local storage (fast, no API call)
    const cardNumbers = getCardData(cardId);
    if (cardNumbers) {
      setSelectedCardData({
        id: cardId,
        numbers: cardNumbers,
      });
    } else {
      alert('Invalid card ID');
    }
  };

  const handleJoinGame = async () => {
    if (!selectedCardId || !currentGameId) {
      alert('Please select a card');
      return;
    }

    const token = searchParams.get('token');
    const userIdParam = searchParams.get('userId');
    const telegramId = token || (userIdParam && /^\d+$/.test(userIdParam) ? userIdParam : null);
    
    if (!telegramId) {
      alert('User ID not found');
      return;
    }

    setJoining(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/v1/games/${currentGameId}/join`,
        {
          user_id: telegramId,
          card_id: selectedCardId,
        }
      );

      if (response.data.player) {
        setStoreCardId(selectedCardId);
        setCurrentView('play');
      }
    } catch (err: any) {
      console.error('Error joining game:', err);
      alert(err.response?.data?.error || 'Failed to join game');
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a1929] text-white">
      {/* Back Button and Balance */}
      <div className="px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => setCurrentView('selection')}
          className="hover:text-blue-300 text-base flex items-center gap-2 px-3 py-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          ተመለስ
        </button>
        
        {/* Balance */}
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 00-2 2v1a16.94 16.94 0 0012 6 16.94 16.94 0 0012-6V6a2 2 0 00-2-2H4z" />
            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
          </svg>
          <span className="text-yellow-400 font-semibold text-lg">
            {wallet.balance.toFixed(2)} ETB
          </span>
        </div>
      </div>

      {/* Card Selection */}
      <div className="p-4 pb-32">
        {/* Game Info Row */}
        <div className="bg-[#1e3a5f] rounded-lg p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Bet Amount */}
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-base">
                {selectedGameType || game?.bet_amount || 0} ብር
              </span>
            </div>
            
            {/* Player Count */}
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              <span className="text-sm text-gray-300">
                {game?.player_count || 0} players
              </span>
            </div>
          </div>
          
          {/* Potential Win */}
          <div className="bg-yellow-500/20 text-yellow-400 text-sm px-3 py-1.5 rounded">
            {game ? `${calculatePotentialWin(game).toFixed(2)} ብር ደራሽ` : '- ብር ደራሽ'}
          </div>
        </div>
        
        {/* Cards Grid */}
        <div className="grid grid-cols-10 gap-2 mb-6">
          {CARD_IDS.map((cardId) => {
            const isSelected = selectedCardId === cardId;
            return (
              <button
                key={cardId}
                onClick={() => handleCardClick(cardId)}
                className={`aspect-square rounded-lg border-2 transition-all text-sm font-semibold ${
                  isSelected
                    ? 'bg-[#1e3a5f] border-red-500 border-2 text-white ring-2 ring-red-500'
                    : 'bg-[#1e3a5f] border-[#254a75] text-white hover:bg-[#254a75] hover:border-blue-500'
                }`}
              >
                {cardId}
              </button>
            );
          })}
        </div>

        {/* Selected Card Preview */}
        {selectedCardData && (
          <div className="mb-6 flex flex-col items-center">
            <h3 className="text-lg font-semibold mb-3">Selected Card: {selectedCardData.id}</h3>
            <div className="bg-black rounded-lg p-2">
              {/* Header Row - B I N G O */}
              <div className="grid grid-cols-5 gap-2 mb-2">
                {(['B', 'I', 'N', 'G', 'O'] as const).map((letter, idx) => {
                  const colors = ['bg-pink-500', 'bg-green-400', 'bg-blue-600', 'bg-orange-500', 'bg-red-500'];
                  return (
                    <div
                      key={letter}
                      className={`aspect-square text-center font-bold text-sm flex items-center justify-center ${colors[idx]} text-white rounded-lg`}
                    >
                      {letter}
                    </div>
                  );
                })}
              </div>
              
              {/* Card Numbers Grid */}
              <div className="grid grid-cols-5 gap-2">
                {selectedCardData.numbers.map((row, rowIndex) => (
                  row.map((number, colIndex) => {
                    const isCenter = rowIndex === 2 && colIndex === 2;
                    const displayValue = isCenter && number === 0 ? '#' : number;
                    
                    return (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className={`aspect-square rounded-lg border-2 flex items-center justify-center font-semibold text-sm ${
                          isCenter && number === 0
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-black border-gray-300'
                        }`}
                      >
                        {displayValue}
                      </div>
                    );
                  })
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Join Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0a1929] border-t border-[#1e3a5f]">
          <button
            onClick={handleJoinGame}
            disabled={!selectedCardId || joining}
            className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition-all ${
              selectedCardId && !joining
                ? 'bg-gradient-to-r from-blue-500 via-blue-600 to-yellow-500 text-white hover:from-blue-600 hover:via-blue-700 hover:to-yellow-600'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {joining ? (
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
    </main>
  );
}

