'use client';

import { useEffect, useState, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useGameStore } from '@/store/gameStore';
import axios from 'axios';

interface Card {
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
  number: number;
  column: 'B' | 'I' | 'N' | 'G' | 'O';
  timestamp: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function GamePlay({ userId }: { userId: string }) {
  const { selectedCardId, currentGameId, selectedGameType } = useGameStore();
  const [card, setCard] = useState<Card | null>(null);
  const [markedNumbers, setMarkedNumbers] = useState<number[]>([]);
  const [drawnNumbers, setDrawnNumbers] = useState<DrawnNumber[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gameStatus, setGameStatus] = useState<'waiting' | 'playing' | 'finished'>('waiting');
  const [winner, setWinner] = useState<string | null>(null);
  const [showBingoModal, setShowBingoModal] = useState(false);
  const socket = useSocket();
  const drawnNumbersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedCardId) {
      fetchCard();
    }
  }, [selectedCardId]);

  useEffect(() => {
    if (!socket || !currentGameId) return;

    socket.emit('join-game', { gameId: currentGameId, userId });

    socket.on('countdown', (data: { seconds: number }) => {
      setCountdown(data.seconds);
    });

    socket.on('countdown-stopped', () => {
      setCountdown(null);
    });

    socket.on('game-started', () => {
      setGameStatus('playing');
      setCountdown(null);
    });

    socket.on('number-drawn', (data: { number: number; column: string; drawnNumbers: number[] }) => {
      const newDrawn: DrawnNumber = {
        number: data.number,
        column: data.column as 'B' | 'I' | 'N' | 'G' | 'O',
        timestamp: Date.now(),
      };
      setDrawnNumbers((prev) => [newDrawn, ...prev].slice(0, 10)); // Keep last 10
      
      // Auto-scroll to top
      if (drawnNumbersRef.current) {
        drawnNumbersRef.current.scrollTop = 0;
      }
    });

    socket.on('number-marked', (data: { number: number; userId: string }) => {
      // Update marked numbers if it's our number
      if (data.userId === userId) {
        setMarkedNumbers((prev) => {
          if (!prev.includes(data.number)) {
            return [...prev, data.number];
          }
          return prev;
        });
      }
    });

    socket.on('game-won', (data: { winnerName: string; prize: number }) => {
      setWinner(data.winnerName);
      setGameStatus('finished');
    });

    socket.on('bingo-valid', () => {
      setShowBingoModal(false);
      setGameStatus('finished');
    });

    socket.on('bingo-invalid', (data: { message: string }) => {
      alert(data.message);
      setShowBingoModal(false);
    });

    return () => {
      socket.emit('leave-game', { gameId: currentGameId });
      socket.off('countdown');
      socket.off('countdown-stopped');
      socket.off('game-started');
      socket.off('number-drawn');
      socket.off('number-marked');
      socket.off('game-won');
      socket.off('bingo-valid');
      socket.off('bingo-invalid');
    };
  }, [socket, currentGameId, userId]);

  const fetchCard = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/game/cards/all`);
      const cards = response.data.cards;
      if (selectedCardId) {
        const foundCard = cards.find((c: Card) => c.cardId === selectedCardId);
        if (foundCard) {
          setCard(foundCard);
        }
      }
    } catch (error) {
      console.error('Error fetching card:', error);
    }
  };

  const handleNumberClick = async (number: number) => {
    if (gameStatus !== 'playing' || !currentGameId || !selectedCardId) return;
    if (markedNumbers.includes(number)) return;

    try {
      socket?.emit('mark-number', {
        gameId: currentGameId,
        userId,
        cardId: selectedCardId,
        number,
      });
      setMarkedNumbers((prev) => [...prev, number]);
    } catch (error) {
      console.error('Error marking number:', error);
    }
  };

  const handleBingo = () => {
    if (!currentGameId || !selectedCardId) return;
    setShowBingoModal(true);
    socket?.emit('claim-bingo', {
      gameId: currentGameId,
      userId,
      cardId: selectedCardId,
    });
  };

  const handleLeaveGame = async () => {
    if (!currentGameId) return;
    try {
      await axios.post(`${API_URL}/api/game/leave`, {
        userId,
        gameId: currentGameId,
      });
      window.location.reload();
    } catch (error) {
      console.error('Error leaving game:', error);
    }
  };

  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading card...
      </div>
    );
  }

  const getColumnForNumber = (num: number): 'B' | 'I' | 'N' | 'G' | 'O' => {
    if (num >= 1 && num <= 15) return 'B';
    if (num >= 16 && num <= 30) return 'I';
    if (num >= 31 && num <= 45) return 'N';
    if (num >= 46 && num <= 60) return 'G';
    if (num >= 61 && num <= 75) return 'O';
    return 'B';
  };

  const isNumberMarked = (num: number) => markedNumbers.includes(num);
  const isNumberDrawn = (num: number) => drawnNumbers.some((d) => d.number === num);

  return (
    <div className="min-h-screen p-4 text-white">
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
            <div className="text-2xl font-bold text-yellow-400">🏆 Winner: {winner}</div>
          </div>
        )}
        {countdown !== null && gameStatus === 'waiting' && (
          <div className="text-xl font-bold">
            Starting in: {countdown}s
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
              {drawn.column}-{drawn.number}
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
          {(['B', 'I', 'N', 'G', 'O'] as const).map((letter) => (
            <div
              key={letter}
              className="text-center font-bold text-lg py-2 bg-blue-500 rounded"
            >
              {letter}
            </div>
          ))}
        </div>

        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="grid grid-cols-5 gap-2 mb-2">
            {(['B', 'I', 'N', 'G', 'O'] as const).map((letter) => {
              const num = card.numbers[letter][row];
              const marked = isNumberMarked(num);
              const drawn = isNumberDrawn(num);
              const canClick = gameStatus === 'playing' && drawn && !marked;

              return (
                <button
                  key={`${letter}-${row}`}
                  onClick={() => canClick && handleNumberClick(num)}
                  disabled={!canClick}
                  className={`aspect-square rounded-lg border-2 font-semibold transition-all ${
                    marked
                      ? 'bg-black text-white border-black'
                      : drawn
                      ? 'bg-red-500 text-white border-red-600'
                      : 'bg-white/20 border-white/30 text-white'
                  } ${canClick ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'}`}
                >
                  {num}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* BINGO Button */}
      {gameStatus === 'playing' && (
        <button
          onClick={handleBingo}
          className="w-full py-4 bg-green-500 hover:bg-green-600 rounded-lg font-bold text-xl mb-4"
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

