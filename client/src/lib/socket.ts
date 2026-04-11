import { io, Socket } from 'socket.io-client';

export const createSocket = (apiUrl: string) => {
  const origin = new URL(apiUrl).origin;
  return io(origin, {
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
    secure: origin.startsWith('https://'),
    reconnection: true,
  });
};

export type SocketClient = Socket;
