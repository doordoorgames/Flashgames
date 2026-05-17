import type { Server, Socket } from "socket.io";

interface BombPlayer {
  id: string;
  name: string;
  losses: number;
  isAdmin: boolean;
}

interface TapAction    { type: "tap";     required: number; }
interface CodeAction   { type: "code";    digits: string; direction: "ltr" | "rtl"; }
interface WireAction   { type: "wire";    wires: Array<{ color: string; word: string }>; targetWord: string; }
interface CountryAction{ type: "country"; target: string; choices: string[]; }
interface MemoryAction { type: "memory";  letters: string[]; }
interface ReactorAction{ type: "reactor"; safeMin: number; safeMax: number; startTemp: number; }
type BombAction = TapAction | CodeAction | WireAction | CountryAction | MemoryAction | ReactorAction;

interface BombRoom {
  code: string;
  adminId: string;
  players: Map<string, BombPlayer>;
  phase: "lobby" | "playing" | "exploded";
  bombHolderId: string | null;
  previousHolderId: string | null;
  explodeTimeout: ReturnType<typeof setTimeout> | null;
}

const bombRooms = new Map<string, BombRoom>();

function generateCode(): string {
  let code: string;
  do {
    code = String(Math.floor(10000 + Math.random() * 90000));
  } while (bombRooms.has("BOMB" + code));
  return code;
}

const WIRE_COLORS = ["red", "green", "blue", "yellow", "purple", "orange", "white", "cyan", "pink"];
const WIRE_WORDS  = ["RED", "GREEN", "BLUE", "YELLOW", "PURPLE", "ORANGE", "WHITE", "CYAN", "PINK"];

function generateWireAction(): WireAction {
  const count = 4 + Math.floor(Math.random() * 3); // 4, 5, or 6
  // Pick `count` unique words
  const shuffledWords = [...WIRE_WORDS].sort(() => Math.random() - 0.5).slice(0, count);
  // Pick one as the target
  const targetWord = shuffledWords[Math.floor(Math.random() * shuffledWords.length)];
  // Assign random colors independently — wire color ≠ wire word by design (misleading)
  const wires = shuffledWords.map(word => {
    const color = WIRE_COLORS[Math.floor(Math.random() * WIRE_COLORS.length)];
    return { color, word };
  });
  return { type: "wire", wires, targetWord };
}

const COUNTRY_POOL = [
  "Russia", "Oman", "Congo", "Brazil", "Japan", "Canada", "Saudi Arabia",
  "India", "Egypt", "Argentina", "Australia", "Mexico", "Turkey", "France",
  "Italy", "China", "South Korea", "South Africa", "Norway", "Germany",
  "Chile", "USA", "Peru", "Colombia",
];

function generateCountryAction(): CountryAction {
  const shuffled = [...COUNTRY_POOL].sort(() => Math.random() - 0.5);
  const target = shuffled[0];
  const choices = [target, ...shuffled.slice(1, 4)].sort(() => Math.random() - 0.5);
  return { type: "country", target, choices };
}

const MEMORY_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O to avoid confusion

function generateMemoryAction(): MemoryAction {
  const letters = Array.from({ length: 6 }, () =>
    MEMORY_LETTERS[Math.floor(Math.random() * MEMORY_LETTERS.length)]
  );
  return { type: "memory", letters };
}

const REACTOR_CONTROLS_POOL = [
  "COOLANT", "VENT", "EXHAUST", "BOOST", "PURGE",
  "FLUSH", "IGNITE", "OVERRIDE", "SUPPRESS", "STABILIZE",
];

function generateReactorAction(): ReactorAction {
  const safeMin = 32 + Math.floor(Math.random() * 18);
  const safeMax = Math.min(safeMin + 20 + Math.floor(Math.random() * 12), 88);
  const startOutside = Math.random() < 0.55;
  let startTemp: number;
  void startOutside;
  startTemp = 0;
  return { type: "reactor", safeMin, safeMax, startTemp };
}

function generateAction(): BombAction {
  const roll = Math.random();
  if (roll < 1 / 6) {
    return { type: "tap", required: 12 + Math.floor(Math.random() * 15) };
  } else if (roll < 2 / 6) {
    const digits = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join("");
    const direction: "ltr" | "rtl" = Math.random() < 0.5 ? "ltr" : "rtl";
    return { type: "code", digits, direction };
  } else if (roll < 3 / 6) {
    return generateWireAction();
  } else if (roll < 4 / 6) {
    return generateCountryAction();
  } else if (roll < 5 / 6) {
    return generateMemoryAction();
  } else {
    return generateReactorAction();
  }
}

function pickNextHolder(room: BombRoom): string | null {
  const ids = Array.from(room.players.keys());
  const eligible = ids.filter(id => id !== room.bombHolderId && id !== room.previousHolderId);
  const pool = eligible.length > 0 ? eligible : ids.filter(id => id !== room.bombHolderId);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function emitLobbyUpdate(io: Server, code: string): void {
  const room = bombRooms.get("BOMB" + code);
  if (!room) return;
  io.to("BOMB" + code).emit("bomb:lobby-update", {
    players: Array.from(room.players.values()),
    adminId: room.adminId,
  });
}

function launchRound(io: Server, code: string): void {
  const room = bombRooms.get("BOMB" + code);
  if (!room) return;
  const ids = Array.from(room.players.keys());
  const firstHolder = ids[Math.floor(Math.random() * ids.length)];
  const action = generateAction();
  const playerCount = room.players.size;
  const minS = 75 + (playerCount - 2) * 30;
  const maxS = 105 + (playerCount - 2) * 30;
  const timerMs = (minS + Math.floor(Math.random() * (maxS - minS + 1))) * 1000;

  room.phase = "playing";
  room.bombHolderId = firstHolder;
  room.previousHolderId = null;
  bombRooms.set("BOMB" + code, room);

  io.to("BOMB" + code).emit("bomb:game-started", {
    bombHolderId: firstHolder,
    action,
    players: Array.from(room.players.values()),
    timerMs,
  });

  if (room.explodeTimeout) clearTimeout(room.explodeTimeout);
  room.explodeTimeout = setTimeout(() => {
    const r = bombRooms.get("BOMB" + code);
    if (!r || r.phase !== "playing") return;
    const loser = r.players.get(r.bombHolderId!);
    if (loser) { loser.losses += 1; r.players.set(loser.id, loser); }
    r.phase = "exploded";
    r.explodeTimeout = null;
    bombRooms.set("BOMB" + code, r);
    io.to("BOMB" + code).emit("bomb:explode", {
      loserId: r.bombHolderId,
      loserName: loser?.name ?? "Unknown",
      players: Array.from(r.players.values()),
    });
  }, timerMs);
  bombRooms.set("BOMB" + code, room);
}

export function setupBombHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {

    socket.on("bomb:create-room", (data: { playerName: string }, cb: (res: { code: string; playerId: string }) => void) => {
      const code = generateCode();
      const player: BombPlayer = { id: socket.id, name: data.playerName, losses: 0, isAdmin: true };
      const room: BombRoom = {
        code, adminId: socket.id,
        players: new Map([[socket.id, player]]),
        phase: "lobby", bombHolderId: null, previousHolderId: null, explodeTimeout: null,
      };
      bombRooms.set("BOMB" + code, room);
      socket.join("BOMB" + code);
      cb({ code, playerId: socket.id });
      emitLobbyUpdate(io, code);
    });

    socket.on("bomb:join-room", (data: { code: string; playerName: string }, cb: (res: { success: boolean; playerId?: string; error?: string }) => void) => {
      const room = bombRooms.get("BOMB" + data.code);
      if (!room) { cb({ success: false, error: "Room not found" }); return; }
      if (room.phase !== "lobby") { cb({ success: false, error: "Game already started" }); return; }
      const player: BombPlayer = { id: socket.id, name: data.playerName, losses: 0, isAdmin: false };
      room.players.set(socket.id, player);
      socket.join("BOMB" + data.code);
      cb({ success: true, playerId: socket.id });
      emitLobbyUpdate(io, data.code);
    });

    socket.on("bomb:start-game", (data: { code: string }) => {
      const room = bombRooms.get("BOMB" + data.code);
      if (!room || socket.id !== room.adminId) return;
      if (room.players.size < 2) {
        socket.emit("bomb:error", { message: "Need at least 2 players to start." });
        return;
      }
      launchRound(io, data.code);
    });

    socket.on("bomb:complete-action", (data: { code: string }) => {
      const room = bombRooms.get("BOMB" + data.code);
      if (!room || room.phase !== "playing") return;
      if (socket.id !== room.bombHolderId) return;
      const nextId = pickNextHolder(room);
      if (!nextId) return;
      const nextPlayer = room.players.get(nextId);
      if (!nextPlayer) return;
      const newAction = generateAction();
      room.previousHolderId = room.bombHolderId;
      room.bombHolderId = nextId;
      bombRooms.set("BOMB" + data.code, room);
      io.to("BOMB" + data.code).emit("bomb:passed", {
        newHolderId: nextId,
        newHolderName: nextPlayer.name,
        newAction,
      });
    });

    socket.on("bomb:input-progress", (data: { code: string; progress: unknown }) => {
      const room = bombRooms.get("BOMB" + data.code);
      if (!room || room.phase !== "playing") return;
      if (socket.id !== room.bombHolderId) return;
      socket.to("BOMB" + data.code).emit("bomb:progress-update", data.progress);
    });

    socket.on("bomb:play-again", (data: { code: string }) => {
      const room = bombRooms.get("BOMB" + data.code);
      if (!room || socket.id !== room.adminId) return;
      if (room.phase !== "exploded") return;
      launchRound(io, data.code);
    });

    socket.on("disconnect", () => {
      for (const [key, room] of bombRooms) {
        if (room.players.has(socket.id)) {
          room.players.delete(socket.id);
          if (room.adminId === socket.id) {
            if (room.explodeTimeout) clearTimeout(room.explodeTimeout);
            bombRooms.delete(key);
            io.to(key).emit("bomb:room-closed");
          } else {
            emitLobbyUpdate(io, room.code);
          }
        }
      }
    });
  });
}
