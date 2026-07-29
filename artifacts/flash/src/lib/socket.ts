import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim() || undefined;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(apiBaseUrl, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
