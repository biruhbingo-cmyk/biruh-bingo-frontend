import { create } from 'zustand';

interface GameState {
  currentView: 'selection' | 'cards' | 'play' | 'wallet' | 'deposit' | 'withdraw' | 'history';
  selectedGameType: number | null; // Bet amount
  selectedGameTypeString: string | null; // Game type string (G1-G7)
  selectedCardId: number | null;
  currentGameId: string | null;
  balance: number;
  setCurrentView: (view: 'selection' | 'cards' | 'play' | 'wallet' | 'deposit' | 'withdraw' | 'history') => void;
  setSelectedGameType: (type: number | null) => void;
  setSelectedGameTypeString: (type: string | null) => void;
  setSelectedCardId: (cardId: number | null) => void;
  setCurrentGameId: (gameId: string | null) => void;
  setBalance: (balance: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  currentView: 'selection',
  selectedGameType: null,
  selectedGameTypeString: null,
  selectedCardId: null,
  currentGameId: null,
  balance: 0,
  setCurrentView: (view) => set({ currentView: view }),
  setSelectedGameType: (type) => set({ selectedGameType: type }),
  setSelectedGameTypeString: (type) => set({ selectedGameTypeString: type }),
  setSelectedCardId: (cardId) => set({ selectedCardId: cardId }),
  setCurrentGameId: (gameId) => set({ currentGameId: gameId }),
  setBalance: (balance) => set({ balance }),
}));

