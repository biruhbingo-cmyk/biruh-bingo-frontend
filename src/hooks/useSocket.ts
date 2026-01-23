import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';

export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(WS_URL, {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to WebSocket');
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return socket;
}

