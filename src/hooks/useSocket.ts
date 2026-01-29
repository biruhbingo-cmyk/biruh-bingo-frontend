import { useEffect, useState, useRef } from 'react';
import { WS_URL } from '@/lib/api';

export interface WebSocketMessage {
  event: string;
  data: any;
}

/**
 * Connect to WebSocket by game type (recommended) or game ID
 * @param gameType - Game type string (G1-G7) - recommended
 * @param gameId - Game ID (UUID) - alternative to gameType
 * @returns WebSocket instance or null
 */
export function useGameWebSocket(
  gameType: string | null,
  gameId: string | null = null
): WebSocket | null {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    // Need either gameType or gameId
    if (!gameType && !gameId) {
      return;
    }

    const connect = () => {
      try {
        // Ensure WS_URL doesn't have trailing slash
        const baseUrl = WS_URL.endsWith('/') ? WS_URL.slice(0, -1) : WS_URL;
        
        // Connect by game type (recommended) or game ID
        let wsUrl: string;
        if (gameType && /^G[1-7]$/.test(gameType)) {
          // Connect by game type (recommended)
          wsUrl = `${baseUrl}/api/v1/ws/game?type=${gameType}`;
        } else if (gameId) {
          // Connect by game ID
          // Extract actual gameId (remove any reconnect suffix if present)
          const actualGameId = gameId.split('-reconnect-')[0];
          wsUrl = `${baseUrl}/api/v1/ws/game/${actualGameId}`;
        } else {
          console.error('Invalid gameType or gameId provided');
          return;
        }

        console.log('🔌 Attempting WebSocket connection to:', wsUrl);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('✅ Connected to WebSocket');
          reconnectAttempts.current = 0;
        };

        ws.onerror = (error) => {
          // Only log error on first attempt to reduce console spam
          if (reconnectAttempts.current === 0) {
            console.error('❌ WebSocket error:', error);
            console.error('❌ WebSocket URL:', wsUrl);
          }
        };

        ws.onclose = (event) => {
          // Only log on first disconnect to reduce console spam
          if (reconnectAttempts.current === 0) {
            console.log('❌ Disconnected from WebSocket');
            console.log('   Close code:', event.code);
            if (event.reason) {
              console.log('   Close reason:', event.reason);
            }
          }
          setSocket(null);

          // Don't reconnect if it was a clean close or if max attempts reached
          if (event.code === 1000 || reconnectAttempts.current >= maxReconnectAttempts) {
            if (reconnectAttempts.current >= maxReconnectAttempts) {
              console.error('Max reconnection attempts reached. WebSocket connection failed.');
            }
            return;
          }

          // Attempt to reconnect
          reconnectAttempts.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        };

        setSocket(ws);
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socket) {
        socket.close();
      }
    };
  }, [gameType, gameId]);

  return socket;
}

// Generic WebSocket hook for Socket.IO compatibility (if needed elsewhere)
export function useSocket(): WebSocket | null {
  console.warn('useSocket is deprecated. Use useGameWebSocket instead for game connections.');
  return null;
}
