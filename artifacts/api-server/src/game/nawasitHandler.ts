import type { Server, Socket } from "socket.io";

const COLS = 5;
const ROWS = 9;
const CATCHER_TIMER_MS = 7_000;

interface Pos { x: number; y: number }

interface NawasitPlayer {
  id: string;
  name: string;
  isAdmin: boolean;
  socketId: string;
}

interface NawasitRoom {
  code: string;
  adminId: string;
  players: Map<string, NawasitPlayer>;
  socketToPlayer: Map<string, string>;
  phase: "lobby" | "playing" | "gameover";
  thiefId: string;
  catcherId: string;
  thiefPos: Pos;
  catcherPos: Pos;
  jewelPos: Pos;
  currentTurn: "thief" | "catcher";
  catcherTimer: ReturnType<typeof setTimeout> | null;
  catcherTimerEnd: number;
}

const rooms = new Map<string, NawasitRoom>();

function generateCode(): string {
  let code: string;
  do {
    code = String(Math.floor(10000 + Math.random() * 90000));
  } while (rooms.has("NWS" + code));
  return code;
}

function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function posKey(p: Pos): string {
  return `${p.x},${p.y}`;
}

function getEdgeCells(): Pos[] {
  const cells: Pos[] = [];
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      if (x === 0 || x === COLS - 1 || y === 0 || y === ROWS - 1) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function setupStartPositions(): { thiefPos: Pos; catcherPos: Pos; jewelPos: Pos } {
  const edges = getEdgeCells();

  const thiefPos = randomFrom(edges);

  const jewelCandidates = edges.filter(
    (p) => posKey(p) !== posKey(thiefPos) && manhattan(p, thiefPos) >= 7,
  );
  const jewelPos = randomFrom(jewelCandidates.length > 0 ? jewelCandidates : edges.filter((p) => posKey(p) !== posKey(thiefPos)));

  const catcherCandidates = edges.filter(
    (p) =>
      posKey(p) !== posKey(thiefPos) &&
      posKey(p) !== posKey(jewelPos) &&
      manhattan(p, thiefPos) >= 4,
  );
  const catcherPos = randomFrom(
    catcherCandidates.length > 0
      ? catcherCandidates
      : edges.filter((p) => posKey(p) !== posKey(thiefPos) && posKey(p) !== posKey(jewelPos)),
  );

  return { thiefPos, catcherPos, jewelPos };
}

function applyMove(pos: Pos, dir: string): Pos {
  let { x, y } = pos;
  if (dir === "up")    y = Math.min(ROWS - 1, y + 1);
  if (dir === "down")  y = Math.max(0, y - 1);
  if (dir === "left")  x = Math.max(0, x - 1);
  if (dir === "right") x = Math.min(COLS - 1, x + 1);
  return { x, y };
}

function distanceFeedback(dist: number): string {
  if (dist === 0) return "CAUGHT!";
  if (dist <= 2)  return "VERY CLOSE";
  if (dist <= 4)  return "CLOSE";
  return "FAR";
}

function sendGameState(io: Server, room: NawasitRoom): void {
  const thief  = room.players.get(room.thiefId);
  const catcher = room.players.get(room.catcherId);
  if (!thief || !catcher) return;

  const playerNames: Record<string, string> = {};
  for (const [id, p] of room.players) playerNames[id] = p.name;

  io.to(thief.socketId).emit("nws:state", {
    role: "thief",
    thiefPos:  room.thiefPos,
    catcherPos: room.catcherPos,
    jewelPos:  room.jewelPos,
    currentTurn: room.currentTurn,
    catcherTimerEnd: room.catcherTimerEnd,
    playerNames,
    thiefId:  room.thiefId,
    catcherId: room.catcherId,
  });

  io.to(catcher.socketId).emit("nws:state", {
    role: "catcher",
    catcherPos: room.catcherPos,
    currentTurn: room.currentTurn,
    catcherTimerEnd: room.catcherTimerEnd,
    playerNames,
    thiefId:  room.thiefId,
    catcherId: room.catcherId,
  });
}

function broadcastToRoom(io: Server, code: string, event: string, data: unknown): void {
  io.to("NWS" + code).emit(event, data);
}

function clearCatcherTimer(room: NawasitRoom): void {
  if (room.catcherTimer) { clearTimeout(room.catcherTimer); room.catcherTimer = null; }
  room.catcherTimerEnd = 0;
}

function startCatcherTimer(io: Server, room: NawasitRoom): void {
  clearCatcherTimer(room);
  room.catcherTimerEnd = Date.now() + CATCHER_TIMER_MS;
  room.catcherTimer = setTimeout(() => {
    room.catcherTimer = null;
    room.catcherTimerEnd = 0;
    room.currentTurn = "thief";
    sendGameState(io, room);
  }, CATCHER_TIMER_MS);
}

function endGame(io: Server, room: NawasitRoom, winner: "thief" | "catcher", reason: string): void {
  clearCatcherTimer(room);
  room.phase = "gameover";
  const thiefP  = room.players.get(room.thiefId);
  const catcherP = room.players.get(room.catcherId);
  broadcastToRoom(io, room.code, "nws:game-over", {
    winner,
    reason,
    thiefPos:   room.thiefPos,
    catcherPos: room.catcherPos,
    jewelPos:   room.jewelPos,
    thiefName:  thiefP?.name  ?? "?",
    catcherName: catcherP?.name ?? "?",
  });
}

function cleanupRoom(io: Server, roomKey: string): void {
  const room = rooms.get(roomKey);
  if (!room) return;
  clearCatcherTimer(room);
  rooms.delete(roomKey);
  broadcastToRoom(io, room.code, "nws:room-closed", {});
}

function lobbyPayload(room: NawasitRoom) {
  return {
    players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name, isAdmin: p.isAdmin })),
    adminId: room.adminId,
  };
}

export function setupNawasitHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {

    socket.on("nws:create-room", (
      { playerName }: { playerName: string },
      rawCb?: (r: { success: boolean; code?: string; playerId?: string; error?: string }) => void,
    ) => {
      type Res = { success: boolean; code?: string; playerId?: string; error?: string };
      const respond = typeof rawCb === "function"
        ? rawCb
        : (r: Res) => {
            if (r.success) socket.emit("nws:room-created", { code: r.code, playerId: r.playerId });
            else socket.emit("nws:error", { message: r.error });
          };

      if (!playerName?.trim()) { respond({ success: false, error: "Name is required." }); return; }
      const code     = generateCode();
      const playerId = Math.random().toString(36).slice(2, 9);
      const player: NawasitPlayer = { id: playerId, name: playerName.trim().slice(0, 20), isAdmin: true, socketId: socket.id };
      const room: NawasitRoom = {
        code, adminId: playerId,
        players: new Map([[playerId, player]]),
        socketToPlayer: new Map([[socket.id, playerId]]),
        phase: "lobby",
        thiefId: "", catcherId: "",
        thiefPos: { x: 0, y: 0 }, catcherPos: { x: 0, y: 0 }, jewelPos: { x: 0, y: 0 },
        currentTurn: "thief", catcherTimer: null, catcherTimerEnd: 0,
      };
      rooms.set("NWS" + code, room);
      socket.join("NWS" + code);
      respond({ success: true, code, playerId });
      broadcastToRoom(io, code, "nws:lobby-update", lobbyPayload(room));
    });

    socket.on("nws:join-room", (
      { code, playerName }: { code: string; playerName: string },
      rawCb?: (r: { success: boolean; code?: string; playerId?: string; error?: string }) => void,
    ) => {
      type Res = { success: boolean; code?: string; playerId?: string; error?: string };
      const respond = typeof rawCb === "function"
        ? rawCb
        : (r: Res) => {
            if (r.success) socket.emit("nws:room-joined", { code: r.code, playerId: r.playerId });
            else socket.emit("nws:error", { message: r.error });
          };

      const roomKey = "NWS" + code;
      const room = rooms.get(roomKey);
      if (!room)                      { respond({ success: false, error: "Room not found." }); return; }
      if (room.phase !== "lobby")     { respond({ success: false, error: "Game already in progress." }); return; }
      if (room.players.size >= 2)     { respond({ success: false, error: "Room is full (max 2 players)." }); return; }
      if (!playerName?.trim())        { respond({ success: false, error: "Name is required." }); return; }

      const playerId = Math.random().toString(36).slice(2, 9);
      const player: NawasitPlayer = { id: playerId, name: playerName.trim().slice(0, 20), isAdmin: false, socketId: socket.id };
      room.players.set(playerId, player);
      room.socketToPlayer.set(socket.id, playerId);
      socket.join(roomKey);
      respond({ success: true, code, playerId });
      broadcastToRoom(io, code, "nws:lobby-update", lobbyPayload(room));
    });

    socket.on("nws:start-game", ({ code }: { code: string }) => {
      const room = rooms.get("NWS" + code);
      if (!room) return;
      const playerId = room.socketToPlayer.get(socket.id);
      if (playerId !== room.adminId) return;
      if (room.players.size < 2) { socket.emit("nws:error", { message: "Need 2 players to start." }); return; }
      if (room.phase !== "lobby") return;

      const ids = [...room.players.keys()];
      const thiefIdx = Math.floor(Math.random() * 2);
      room.thiefId  = ids[thiefIdx];
      room.catcherId = ids[1 - thiefIdx];

      const pos = setupStartPositions();
      room.thiefPos  = pos.thiefPos;
      room.catcherPos = pos.catcherPos;
      room.jewelPos  = pos.jewelPos;
      room.currentTurn = "thief";
      room.phase = "playing";

      broadcastToRoom(io, code, "nws:game-started", {});
      sendGameState(io, room);
    });

    socket.on("nws:move", ({ code, dir }: { code: string; dir: string }) => {
      const room = rooms.get("NWS" + code);
      if (!room || room.phase !== "playing") return;
      const playerId = room.socketToPlayer.get(socket.id);
      if (!playerId) return;

      const isThief  = playerId === room.thiefId;
      const isCatcher = playerId === room.catcherId;
      if (room.currentTurn === "thief"  && !isThief)  return;
      if (room.currentTurn === "catcher" && !isCatcher) return;

      if (room.currentTurn === "thief") {
        const newPos = applyMove(room.thiefPos, dir);
        if (posKey(newPos) === posKey(room.thiefPos)) return;
        room.thiefPos = newPos;

        if (posKey(room.thiefPos) === posKey(room.jewelPos)) {
          sendGameState(io, room);
          endGame(io, room, "thief", "Thief reached the jewel!");
          return;
        }
        room.currentTurn = "catcher";
        startCatcherTimer(io, room);
        sendGameState(io, room);

      } else {
        clearCatcherTimer(room);
        const newPos = applyMove(room.catcherPos, dir);
        if (posKey(newPos) === posKey(room.catcherPos)) return;
        room.catcherPos = newPos;

        if (posKey(room.catcherPos) === posKey(room.thiefPos)) {
          sendGameState(io, room);
          endGame(io, room, "catcher", "Catcher caught the thief!");
          return;
        }

        const dist = manhattan(room.catcherPos, room.thiefPos);
        const catcherP = room.players.get(room.catcherId);
        if (catcherP) {
          io.to(catcherP.socketId).emit("nws:distance", {
            distance: dist,
            feedback: distanceFeedback(dist),
          });
        }
        room.currentTurn = "thief";
        sendGameState(io, room);
      }
    });

    socket.on("nws:rematch", ({ code }: { code: string }) => {
      const room = rooms.get("NWS" + code);
      if (!room || room.phase !== "gameover") return;
      const playerId = room.socketToPlayer.get(socket.id);
      if (playerId !== room.adminId) return;

      const tmp = room.thiefId;
      room.thiefId   = room.catcherId;
      room.catcherId = tmp;

      const pos = setupStartPositions();
      room.thiefPos  = pos.thiefPos;
      room.catcherPos = pos.catcherPos;
      room.jewelPos  = pos.jewelPos;
      room.currentTurn = "thief";
      room.phase = "playing";

      broadcastToRoom(io, code, "nws:game-started", {});
      sendGameState(io, room);
    });

    socket.on("disconnect", () => {
      for (const [roomKey, room] of rooms.entries()) {
        const playerId = room.socketToPlayer.get(socket.id);
        if (!playerId) continue;
        room.players.delete(playerId);
        room.socketToPlayer.delete(socket.id);
        if (room.players.size === 0) {
          clearCatcherTimer(room);
          rooms.delete(roomKey);
        } else if (playerId === room.adminId || room.phase === "playing") {
          cleanupRoom(io, roomKey);
        } else {
          const newAdmin = [...room.players.values()][0];
          room.adminId = newAdmin.id;
          newAdmin.isAdmin = true;
          broadcastToRoom(io, room.code, "nws:lobby-update", lobbyPayload(room));
        }
        break;
      }
    });
  });
}
