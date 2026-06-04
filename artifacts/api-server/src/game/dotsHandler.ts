import type { Server, Socket } from "socket.io";

const COLS = 5;
const ROWS = 9;
const ROUND_MS     = 60_000; // 1 minute per side, 2 minutes total
const CLAIM_MS     = 3_000;  // 3 seconds to claim a window
const MAX_PENDING  = 10;     // thief can work on up to 10 windows at once

const DOT_COLORS = [
  "#FF6B9D","#FF9F43","#FECA57","#48DBFB","#54A0FF",
  "#5F27CD","#01CBC6","#10AC84","#EE5A24","#C44569",
  "#F8B739","#A3CB38","#1289A7","#D980FA","#9980FA",
];

interface DotsPlayer {
  id: string;
  name: string;
  isAdmin: boolean;
  socketId: string;
}

interface DotsRoom {
  code: string;
  adminId: string;
  players: Map<string, DotsPlayer>;
  socketToPlayer: Map<string, string>;
  phase: "lobby" | "round1" | "switch" | "round2" | "results";
  cellColors: string[];
  thiefId: string;
  catcherId: string;
  thiefPos: { x: number; y: number };
  claimedCells: Set<string>;
  pendingClaims: Map<string, ReturnType<typeof setTimeout>>; // key → 3s claim timer
  round1ThiefId: string;
  round1Score: number;
  round2Score: number;
  roundTimer: ReturnType<typeof setTimeout> | null;
  roundEndTime: number;
  switchAcks: Set<string>;
}

const rooms = new Map<string, DotsRoom>();

function generateCode(): string {
  let code: string;
  do {
    code = String(Math.floor(10000 + Math.random() * 90000));
  } while (rooms.has("DOTS" + code));
  return code;
}

function generateCellColors(): string[] {
  return Array.from({ length: COLS * ROWS }, () =>
    DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)],
  );
}

function broadcastToRoom(io: Server, roomCode: string, event: string, data: unknown) {
  io.to("DOTS" + roomCode).emit(event, data);
}

function clearPendingClaims(room: DotsRoom): void {
  for (const timer of room.pendingClaims.values()) clearTimeout(timer);
  room.pendingClaims.clear();
}

function startRound(io: Server, room: DotsRoom): void {
  const round = room.phase === "round2" ? 2 : 1;
  const roundEndTime = Date.now() + ROUND_MS;
  room.roundEndTime = roundEndTime;
  room.claimedCells = new Set();
  clearPendingClaims(room);
  room.thiefPos = {
    x: Math.floor(Math.random() * COLS),
    y: Math.floor(Math.random() * ROWS),
  };

  const thiefPlayer = room.players.get(room.thiefId);
  const catcherPlayer = room.players.get(room.catcherId);
  if (!thiefPlayer || !catcherPlayer) return;

  const playerNames = Object.fromEntries(
    [...room.players.entries()].map(([id, p]) => [id, p.name]),
  );

  io.to(thiefPlayer.socketId).emit("dots:round-started", {
    role: "thief",
    thiefPos: room.thiefPos,
    cellColors: room.cellColors,
    roundEndTime,
    round,
    playerNames,
    thiefId: room.thiefId,
    catcherId: room.catcherId,
  });

  io.to(catcherPlayer.socketId).emit("dots:round-started", {
    role: "catcher",
    cellColors: room.cellColors,
    roundEndTime,
    round,
    playerNames,
    thiefId: room.thiefId,
    catcherId: room.catcherId,
  });

  room.roundTimer = setTimeout(() => endRound(io, room, false), ROUND_MS);
}

function endRound(io: Server, room: DotsRoom, caught: boolean, caughtCell?: { x: number; y: number }): void {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }

  // Stop all in-progress claims
  clearPendingClaims(room);

  const score = room.claimedCells.size;

  if (room.phase === "round1") {
    room.round1Score = score;
    room.phase = "switch";
    room.switchAcks = new Set();

    broadcastToRoom(io, room.code, "dots:round-over", {
      round: 1,
      score,
      caught,
      caughtCell: caught ? caughtCell : undefined,
      thiefPos: room.thiefPos,
    });

    setTimeout(() => {
      broadcastToRoom(io, room.code, "dots:switch-sides", {
        round1Score: room.round1Score,
        round1ThiefId: room.round1ThiefId,
      });
    }, 1800);
  } else {
    room.round2Score = score;
    room.phase = "results";

    const round1ThiefName = room.players.get(room.round1ThiefId)?.name ?? "?";
    const round2ThiefId = room.thiefId;
    const round2ThiefName = room.players.get(round2ThiefId)?.name ?? "?";

    let winnerId: string | null = null;
    if (room.round1Score > room.round2Score) winnerId = room.round1ThiefId;
    else if (room.round2Score > room.round1Score) winnerId = round2ThiefId;

    broadcastToRoom(io, room.code, "dots:game-over", {
      round1ThiefId: room.round1ThiefId,
      round1ThiefName,
      round1Score: room.round1Score,
      round2ThiefId,
      round2ThiefName,
      round2Score: room.round2Score,
      winnerId,
      winnerName: winnerId ? room.players.get(winnerId)?.name : null,
      caught,
      caughtCell: caught ? caughtCell : undefined,
      thiefPos: room.thiefPos,
    });
  }
}

function cleanupRoom(io: Server, roomKey: string) {
  const room = rooms.get(roomKey);
  if (!room) return;
  if (room.roundTimer) clearTimeout(room.roundTimer);
  clearPendingClaims(room);
  rooms.delete(roomKey);
  broadcastToRoom(io, room.code, "dots:room-closed", {});
}

export function setupDotsHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    socket.on("dots:create-room", (
      { playerName }: { playerName: string },
      rawCb?: (res: { success: boolean; code?: string; playerId?: string; error?: string }) => void,
    ) => {
      type Res = { success: boolean; code?: string; playerId?: string; error?: string };
      const respond = typeof rawCb === "function"
        ? rawCb
        : (res: Res) => {
            if (res.success) socket.emit("dots:room-created", { code: res.code, playerId: res.playerId });
            else socket.emit("dots:error", { message: res.error });
          };
      if (!playerName?.trim()) { respond({ success: false, error: "Name is required." }); return; }
      const code = generateCode();
      const playerId = Math.random().toString(36).slice(2, 9);
      const player: DotsPlayer = {
        id: playerId,
        name: playerName.trim().slice(0, 20),
        isAdmin: true,
        socketId: socket.id,
      };
      const room: DotsRoom = {
        code,
        adminId: playerId,
        players: new Map([[playerId, player]]),
        socketToPlayer: new Map([[socket.id, playerId]]),
        phase: "lobby",
        cellColors: generateCellColors(),
        thiefId: "",
        catcherId: "",
        thiefPos: { x: 0, y: 0 },
        claimedCells: new Set(),
        pendingClaims: new Map(),
        round1ThiefId: "",
        round1Score: 0,
        round2Score: 0,
        roundTimer: null,
        roundEndTime: 0,
        switchAcks: new Set(),
      };
      rooms.set("DOTS" + code, room);
      socket.join("DOTS" + code);
      respond({ success: true, code, playerId });
      broadcastToRoom(io, code, "dots:lobby-update", {
        players: [...room.players.values()].map((p) => ({
          id: p.id,
          name: p.name,
          isAdmin: p.isAdmin,
        })),
        adminId: room.adminId,
      });
    });

    socket.on("dots:join-room", (
      { code, playerName }: { code: string; playerName: string },
      rawCb?: (res: { success: boolean; code?: string; playerId?: string; error?: string }) => void,
    ) => {
      type Res = { success: boolean; code?: string; playerId?: string; error?: string };
      const respond = typeof rawCb === "function"
        ? rawCb
        : (res: Res) => {
            if (res.success) socket.emit("dots:room-joined", { code: res.code, playerId: res.playerId });
            else socket.emit("dots:error", { message: res.error });
          };
      const roomKey = "DOTS" + code;
      const room = rooms.get(roomKey);
      if (!room) { respond({ success: false, error: "Room not found. Check the code and try again." }); return; }
      if (room.phase !== "lobby") { respond({ success: false, error: "Game already in progress." }); return; }
      if (room.players.size >= 2) { respond({ success: false, error: "Room is full (max 2 players)." }); return; }
      if (!playerName?.trim()) { respond({ success: false, error: "Name is required." }); return; }

      const playerId = Math.random().toString(36).slice(2, 9);
      const player: DotsPlayer = {
        id: playerId,
        name: playerName.trim().slice(0, 20),
        isAdmin: false,
        socketId: socket.id,
      };
      room.players.set(playerId, player);
      room.socketToPlayer.set(socket.id, playerId);
      socket.join(roomKey);
      respond({ success: true, code, playerId });
      broadcastToRoom(io, code, "dots:lobby-update", {
        players: [...room.players.values()].map((p) => ({
          id: p.id,
          name: p.name,
          isAdmin: p.isAdmin,
        })),
        adminId: room.adminId,
      });
    });

    socket.on("dots:start-game", ({ code }: { code: string }) => {
      const roomKey = "DOTS" + code;
      const room = rooms.get(roomKey);
      if (!room) return;
      const playerId = room.socketToPlayer.get(socket.id);
      if (playerId !== room.adminId) return;
      if (room.players.size < 2) {
        socket.emit("dots:error", { message: "Need 2 players to start." });
        return;
      }
      if (room.phase !== "lobby") return;

      const playerIds = [...room.players.keys()];
      const thiefIdx = Math.floor(Math.random() * 2);
      room.thiefId = playerIds[thiefIdx];
      room.catcherId = playerIds[1 - thiefIdx];
      room.round1ThiefId = room.thiefId;
      room.phase = "round1";
      startRound(io, room);
    });

    socket.on("dots:claim", ({ code, x, y }: { code: string; x: number; y: number }) => {
      const room = rooms.get("DOTS" + code);
      if (!room) return;
      if (room.phase !== "round1" && room.phase !== "round2") return;
      const playerId = room.socketToPlayer.get(socket.id);
      if (playerId !== room.thiefId) return;

      const key = `${x},${y}`;
      // Block if already fully claimed or currently pending
      if (room.claimedCells.has(key)) return;
      if (room.pendingClaims.has(key)) return;
      // Max 10 simultaneous windows
      if (room.pendingClaims.size >= MAX_PENDING) return;

      // Start the 3-second claim timer
      const timer = setTimeout(() => {
        room.pendingClaims.delete(key);
        // Only add if round is still in progress
        if (room.phase !== "round1" && room.phase !== "round2") return;
        room.claimedCells.add(key);
        room.thiefPos = { x, y };
        broadcastToRoom(io, room.code, "dots:cell-claimed", {
          x, y, score: room.claimedCells.size,
        });
      }, CLAIM_MS);

      room.pendingClaims.set(key, timer);
      // Update thiefPos optimistically so catcher can still track rough position
      room.thiefPos = { x, y };
    });

    socket.on("dots:search", ({ code, x, y }: { code: string; x: number; y: number }) => {
      const room = rooms.get("DOTS" + code);
      if (!room) return;
      if (room.phase !== "round1" && room.phase !== "round2") return;
      const playerId = room.socketToPlayer.get(socket.id);
      if (playerId !== room.catcherId) return;

      const key = `${x},${y}`;

      if (room.pendingClaims.has(key)) {
        // Thief is actively claiming this window — caught in the act!
        const timer = room.pendingClaims.get(key)!;
        clearTimeout(timer);
        room.pendingClaims.delete(key);
        endRound(io, room, true, { x, y });
      } else {
        // Window not being claimed right now — miss
        socket.emit("dots:search-miss", { x, y });
      }
    });

    socket.on("dots:switch-ack", ({ code }: { code: string }) => {
      const room = rooms.get("DOTS" + code);
      if (!room || room.phase !== "switch") return;
      const playerId = room.socketToPlayer.get(socket.id);
      if (!playerId) return;
      room.switchAcks.add(playerId);
      if (room.switchAcks.size >= 2) {
        const tmp = room.thiefId;
        room.thiefId = room.catcherId;
        room.catcherId = tmp;
        room.phase = "round2";
        startRound(io, room);
      }
    });

    socket.on("dots:rematch", ({ code }: { code: string }) => {
      const room = rooms.get("DOTS" + code);
      if (!room || room.phase !== "results") return;
      const playerId = room.socketToPlayer.get(socket.id);
      if (playerId !== room.adminId) return;

      clearPendingClaims(room);
      room.phase = "lobby";
      room.cellColors = generateCellColors();
      room.claimedCells = new Set();
      room.round1Score = 0;
      room.round2Score = 0;
      room.thiefId = "";
      room.catcherId = "";
      room.round1ThiefId = "";
      room.switchAcks = new Set();

      broadcastToRoom(io, room.code, "dots:lobby-update", {
        players: [...room.players.values()].map((p) => ({
          id: p.id,
          name: p.name,
          isAdmin: p.isAdmin,
        })),
        adminId: room.adminId,
      });
      broadcastToRoom(io, room.code, "dots:rematch-ready", {});
    });

    socket.on("disconnect", () => {
      for (const [roomKey, room] of rooms.entries()) {
        const playerId = room.socketToPlayer.get(socket.id);
        if (!playerId) continue;

        room.players.delete(playerId);
        room.socketToPlayer.delete(socket.id);

        if (room.players.size === 0) {
          if (room.roundTimer) clearTimeout(room.roundTimer);
          clearPendingClaims(room);
          rooms.delete(roomKey);
        } else if (playerId === room.adminId) {
          cleanupRoom(io, roomKey);
        } else if (room.phase !== "lobby") {
          cleanupRoom(io, roomKey);
        } else {
          const newAdmin = [...room.players.values()][0];
          room.adminId = newAdmin.id;
          newAdmin.isAdmin = true;
          broadcastToRoom(io, room.code, "dots:lobby-update", {
            players: [...room.players.values()].map((p) => ({
              id: p.id,
              name: p.name,
              isAdmin: p.isAdmin,
            })),
            adminId: room.adminId,
          });
        }
        break;
      }
    });
  });
}
