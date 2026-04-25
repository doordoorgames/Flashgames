import type { Room } from "./gameState.js";

const rooms = new Map<string, Room>();

export function generateRoomCode(): string {
  let code: string;
  do {
    code = Math.floor(10000 + Math.random() * 90000).toString();
  } while (rooms.has(code));
  return code;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function setRoom(code: string, room: Room): void {
  rooms.set(code, room);
}

export function deleteRoom(code: string): void {
  rooms.delete(code);
}

export function getAllRooms(): Map<string, Room> {
  return rooms;
}
