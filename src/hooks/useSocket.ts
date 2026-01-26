import { useEffect, useState, useRef } from 'react';
import { WS_URL } from '@/lib/api';

export interface WebSocketMessage {
  event: string;
  data: any;
}

export function useGameWebSocket(gameId: string | null, userId: string | null): WebSocket | null {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    if (!gameId || !userId) {
      return;
    }

    const connect = () => {
      try {
        const wsUrl = `${WS_URL}/api/v1/ws/game/${gameId}?user_id=${userId}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('✅ Connected to WebSocket');
          reconnectAttempts.current = 0;
        };

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('❌ Disconnected from WebSocket');
          setSocket(null);

          // Attempt to reconnect
          if (reconnectAttempts.current < maxReconnectAttempts) {
            reconnectAttempts.current += 1;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
            console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          } else {
            console.error('Max reconnection attempts reached');
          }
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
  }, [gameId, userId]);

  return socket;
}

// Generic WebSocket hook for Socket.IO compatibility (if needed elsewhere)
export function useSocket(): WebSocket | null {
  console.warn('useSocket is deprecated. Use useGameWebSocket instead for game connections.');
  return null;
}
