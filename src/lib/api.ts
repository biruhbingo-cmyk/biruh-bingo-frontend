import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

// Derive WebSocket URL from API URL (ws:// for http, wss:// for https)
const getWebSocketUrl = (): string => {
  let wsUrl: string;
  
  if (process.env.NEXT_PUBLIC_WS_URL) {
    wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  } else {
    // Auto-detect protocol from API_URL
    if (API_URL.startsWith('https://')) {
      wsUrl = API_URL.replace('https://', 'wss://');
    } else if (API_URL.startsWith('http://')) {
      wsUrl = API_URL.replace('http://', 'ws://');
    } else {
      wsUrl = 'ws://localhost:8080';
    }
  }
  
  // Ensure protocol is correct (convert https/http to wss/ws if needed)
  if (wsUrl.startsWith('https://')) {
    wsUrl = wsUrl.replace('https://', 'wss://');
  } else if (wsUrl.startsWith('http://')) {
    wsUrl = wsUrl.replace('http://', 'ws://');
  }
  
  return wsUrl;
};

const WS_URL = getWebSocketUrl();

export { API_URL, WS_URL };

export interface User {
  id: string;
  telegram_id: number;
  first_name: string;
  last_name: string | null;
  phone_number: string;
  referal_code: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  user_id: string;
  balance: number;
  demo_balance: number;
  updated_at: string;
}

export interface Game {
  id: string;
  game_type: string;
  state: 'WAITING' | 'COUNTDOWN' | 'DRAWING' | 'FINISHED' | 'CLOSED' | 'CANCELLED';
  bet_amount: number;
  min_players: number;
  player_count: number;
  prize_pool: number;
  house_cut: number;
  winner_id: string | null;
  countdown_ends: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameStateResponse {
  game: Game;
  drawnNumbers: Array<{
    letter: string;
    number: number;
    drawn_at: string;
  }>;
  takenCards: number[];
}

// User API
export const getUserByTelegramId = async (telegramId: string): Promise<User> => {
  const response = await axios.get(`${API_URL}/api/v1/user/telegram/${telegramId}`);
  return response.data.user;
};

// Wallet API
export const getWalletByTelegramId = async (telegramId: string): Promise<Wallet> => {
  const response = await axios.get(`${API_URL}/api/v1/wallet/telegram/${telegramId}`);
  return response.data.wallet;
};

// Games API
export const getGames = async (type?: string): Promise<Game[]> => {
  const params = type ? { type } : {};
  const response = await axios.get(`${API_URL}/api/v1/games`, { params });
  return response.data.games;
};

export const getGameState = async (gameId: string): Promise<GameStateResponse> => {
  const response = await axios.get(`${API_URL}/api/v1/games/${gameId}/state`);
  return response.data;
};

// Calculate potential win based on game state
export const calculatePotentialWin = (game: Game): number => {
  if (game.player_count === 0) return 0;
  const totalPool = game.bet_amount * game.player_count;
  const houseCut = totalPool * game.house_cut;
  return totalPool - houseCut;
};

// Calculate countdown seconds remaining
export const getCountdownSeconds = (countdownEnds: string | null): number | null => {
  if (!countdownEnds) return null;
  const now = new Date().getTime();
  const ends = new Date(countdownEnds).getTime();
  const seconds = Math.max(0, Math.floor((ends - now) / 1000));
  return seconds > 0 ? seconds : null;
};

// Card API
export interface Card {
  id: number;
  numbers: number[][]; // 5x5 array: [row][column]
}

export const getCard = async (cardId: number): Promise<Card> => {
  const response = await axios.get(`${API_URL}/api/v1/cards/${cardId}`);
  return response.data.card;
};

