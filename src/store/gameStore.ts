import { create } from 'zustand';

interface GameState {
  currentView: 'selection' | 'cards' | 'play';
  selectedGameType: number | null;
  selectedCardId: number | null;
  currentGameId: string | null;
  balance: number;
  setCurrentView: (view: 'selection' | 'cards' | 'play') => void;
  setSelectedGameType: (type: number | null) => void;
  setSelectedCardId: (cardId: number | null) => void;
  setCurrentGameId: (gameId: string | null) => void;
  setBalance: (balance: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentView: 'selection',
  selectedGameType: null,
  selectedCardId: null,
  currentGameId: null,
  balance: 0,
  setCurrentView: (view) => set({ currentView: view }),
  setSelectedGameType: (type) => set({ selectedGameType: type }),
  setSelectedCardId: (cardId) => set({ selectedCardId: cardId }),
  setCurrentGameId: (gameId) => set({ currentGameId: gameId }),
  setBalance: (balance) => set({ balance }),
}));

