'use client';

import { useEffect, useState, useRef } from 'react';
import { useGameWebSocket, type WebSocketMessage } from '@/hooks/useSocket';
import { useGameStore } from '@/store/gameStore';
import { API_URL, getGameState } from '@/lib/api';
import axios from 'axios';

interface BingoCard {
  cardId: number;
  numbers: {
    B: number[];
    I: number[];
    N: number[];
    G: number[];
    O: number[];
  };
}

interface DrawnNumber {
  letter: string;
  number: number;
  drawn_at: string;
}

export default function GamePlay({ userId }: { userId: string }) {
  const { selectedCardId, currentGameId } = useGameStore();
  const [card, setCard] = useState<BingoCard | null>(null);
  const [markedNumbers, setMarkedNumbers] = useState<number[]>([]);
  const [drawnNumbers, setDrawnNumbers] = useState<DrawnNumber[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gameStatus, setGameStatus] = useState<'WAITING' | 'COUNTDOWN' | 'DRAWING' | 'FINISHED' | 'CLOSED' | 'CANCELLED'>('WAITING');
  const [winner, setWinner] = useState<string | null>(null);
  const [showBingoModal, setShowBingoModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const socket = useGameWebSocket(currentGameId, userId);
  const drawnNumbersRef = useRef<HTMLDivElement>(null);

  // Fetch game state and card data from backend
  useEffect(() => {
    const fetchGameData = async () => {
      if (!currentGameId || !selectedCardId) return;
      
      try {
        const gameState = await getGameState(currentGameId);
        
        // Initialize drawn numbers
        if (gameState.drawnNumbers) {
          setDrawnNumbers(gameState.drawnNumbers);
        }
        
        // Set game status
        if (gameState.game.state) {
          setGameStatus(gameState.game.state);
        }

        // TODO: Fetch card data from backend
        // For now, card data should come from the backend API
        // The backend should provide card data when joining or via a separate endpoint
        // This is a placeholder - the actual card data will come from the backend
        setLoading(false);
      } catch (error) {
        console.error('Error fetching game data:', error);
        setLoading(false);
      }
    };

    fetchGameData();
  }, [currentGameId, selectedCardId]);

  // Handle WebSocket messages
  useEffect(() => {
    if (!socket || !currentGameId) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('WebSocket message:', message);

        switch (message.event) {
          case 'INITIAL_STATE':
            // Initialize game state
            if (message.data.drawnNumbers) {
              setDrawnNumbers(message.data.drawnNumbers);
            }
            if (message.data.game?.state) {
              setGameStatus(message.data.game.state);
            }
            if (message.data.secondsLeft !== undefined) {
              setCountdown(message.data.secondsLeft);
            }
            // Card data should come from backend - check if it's in the initial state
            if (message.data.card) {
              setCard(message.data.card);
            }
            break;

          case 'GAME_STATUS':
            if (message.data.status) {
              setGameStatus(message.data.status);
            }
            if (message.data.secondsLeft !== undefined) {
              setCountdown(message.data.secondsLeft);
            }
            break;

          case 'COUNTDOWN':
            if (message.data.secondsLeft !== undefined) {
              setCountdown(message.data.secondsLeft);
            }
            break;

          case 'NUMBER_DRAWN':
            if (message.data.letter && message.data.number) {
              const newDrawn: DrawnNumber = {
                letter: message.data.letter,
                number: message.data.number,
                drawn_at: message.data.drawn_at || new Date().toISOString(),
              };
              setDrawnNumbers((prev) => [newDrawn, ...prev].slice(0, 20)); // Keep last 20
              
              // Auto-scroll to top
              if (drawnNumbersRef.current) {
                drawnNumbersRef.current.scrollTop = 0;
              }
            }
            break;

          case 'WINNER':
            if (message.data.userId) {
              setWinner(message.data.userId);
              setGameStatus('FINISHED');
              setShowBingoModal(false);
            }
            break;

          case 'PLAYER_ELIMINATED':
            if (message.data.userId === userId) {
              alert('Invalid bingo claim. You have been eliminated.');
              setShowBingoModal(false);
            }
            break;

          case 'GAME_CANCELLED':
            alert('Game was cancelled due to insufficient players.');
            setGameStatus('CLOSED');
            break;

          default:
            console.log('Unhandled WebSocket event:', message.event);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.addEventListener('message', handleMessage);

    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket, currentGameId, userId]);

  const handleNumberClick = (number: number) => {
    if (gameStatus !== 'DRAWING' || !currentGameId || !selectedCardId) return;
    if (markedNumbers.includes(number)) return;
    if (number === 0) return; // Center cell

    // Mark number locally (client-side marking for UI)
    setMarkedNumbers((prev) => [...prev, number]);
  };

  const handleBingo = async () => {
    if (!currentGameId || !selectedCardId || markedNumbers.length === 0) {
      alert('Please mark at least one number before claiming bingo');
      return;
    }

    setShowBingoModal(true);

    try {
      const response = await axios.post(`${API_URL}/api/v1/games/${currentGameId}/bingo`, {
        user_id: userId,
        marked_numbers: markedNumbers,
      });

      if (response.data.winner) {
        setWinner(userId);
        setGameStatus('FINISHED');
        setShowBingoModal(false);
      } else {
        // Player eliminated - handled by WebSocket event
        setShowBingoModal(false);
      }
    } catch (error: any) {
      console.error('Error claiming bingo:', error);
      alert(error.response?.data?.error || 'Failed to claim bingo');
      setShowBingoModal(false);
    }
  };

  const handleLeaveGame = async () => {
    if (!currentGameId) return;
    try {
      await axios.post(`${API_URL}/api/v1/games/${currentGameId}/leave`, {
        user_id: userId,
      });
      // Navigate back to game selection
      window.location.href = `/?userId=${userId}`;
    } catch (error: any) {
      console.error('Error leaving game:', error);
      alert(error.response?.data?.error || 'Failed to leave game');
    }
  };

  if (loading || !card) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-[#0a1929]">
        <div>Loading game...</div>
      </div>
    );
  }

  const isNumberDrawn = (num: number) => {
    return drawnNumbers.some((d) => d.number === num);
  };

  const isNumberMarked = (num: number) => markedNumbers.includes(num);

  return (
    <div className="min-h-screen p-4 text-white bg-[#0a1929]">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={handleLeaveGame}
          className="px-4 py-2 bg-red-500/80 rounded-lg backdrop-blur-sm hover:bg-red-600"
        >
          Leave Game
        </button>
        {winner && (
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">
              🏆 {winner === userId ? 'You Won!' : `Winner: ${winner}`}
            </div>
          </div>
        )}
        {countdown !== null && (gameStatus === 'WAITING' || gameStatus === 'COUNTDOWN') && (
          <div className="text-xl font-bold">
            Starting in: {countdown}s
          </div>
        )}
        {gameStatus === 'DRAWING' && (
          <div className="text-xl font-bold text-green-400">
            Game in Progress
          </div>
        )}
      </div>

      {/* Drawn Numbers */}
      <div
        ref={drawnNumbersRef}
        className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-4 max-h-32 overflow-y-auto"
      >
        <h3 className="font-bold mb-2">Drawn Numbers:</h3>
        <div className="flex flex-wrap gap-2">
          {drawnNumbers.map((drawn, idx) => (
            <div
              key={idx}
              className="px-3 py-1 bg-blue-500 rounded-lg font-semibold"
            >
              {drawn.letter}-{drawn.number}
            </div>
          ))}
          {drawnNumbers.length === 0 && (
            <div className="text-gray-400">No numbers drawn yet...</div>
          )}
        </div>
      </div>

      {/* Bingo Card */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-4">
        <div className="grid grid-cols-5 gap-2 mb-4">
          {(['B', 'I', 'N', 'G', 'O'] as const).map((letter, idx) => {
            const colors = ['bg-pink-500', 'bg-green-400', 'bg-blue-600', 'bg-orange-500', 'bg-red-500'];
            return (
              <div
                key={letter}
                className={`text-center font-bold text-lg py-2 ${colors[idx]} text-white rounded`}
              >
                {letter}
              </div>
            );
          })}
        </div>

        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="grid grid-cols-5 gap-2 mb-2">
            {(['B', 'I', 'N', 'G', 'O'] as const).map((letter) => {
              const num = card.numbers[letter][row];
              const marked = isNumberMarked(num);
              const drawn = isNumberDrawn(num);
              const canClick = gameStatus === 'DRAWING' && drawn && !marked && num !== 0;

              // Check if this is the center cell (row 2, column N)
              const isCenter = row === 2 && letter === 'N' && num === 0;
              
              return (
                <button
                  key={`${letter}-${row}`}
                  onClick={() => canClick && handleNumberClick(num)}
                  disabled={!canClick || isCenter}
                  className={`aspect-square rounded-lg border-2 font-semibold transition-all ${
                    isCenter
                      ? 'bg-gray-200 border-gray-300 text-gray-400 cursor-not-allowed'
                      : marked
                      ? 'bg-black text-white border-black'
                      : drawn
                      ? 'bg-white/20 border-red-500 border-2 text-white'
                      : 'bg-white/20 border-white/30 text-white'
                  } ${canClick && !isCenter ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}`}
                >
                  {isCenter ? 'FREE' : num}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* BINGO Button */}
      {gameStatus === 'DRAWING' && (
        <button
          onClick={handleBingo}
          disabled={markedNumbers.length === 0}
          className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-xl mb-4"
        >
          🎯 BINGO
        </button>
      )}

      {/* Bingo Modal */}
      {showBingoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full text-black text-center">
            <div className="text-4xl mb-4">⏳</div>
            <h2 className="text-2xl font-bold mb-2">Checking Bingo...</h2>
            <p>Please wait while we verify your win!</p>
          </div>
        </div>
      )}
    </div>
  );
}
