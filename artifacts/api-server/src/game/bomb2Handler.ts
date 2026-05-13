import type { Server, Socket } from "socket.io";

type ReactorPhase = "calm" | "heating" | "critical" | "meltdown";
type RoomPhase = "lobby" | "task" | "passing" | "catching" | "exploded";

export interface B2Player { id: string; name: string; losses: number; isAdmin: boolean; }
export interface B2MashTask   { type: "mash";   target: number; }
export interface B2SwipeTask  { type: "swipe";  pattern: string[]; }
export interface B2FreezeTask { type: "freeze"; holdMs: number; }
export interface B2WiresTask  { type: "wires";  wires: string[]; correctWire: string; }
export interface B2CodeTask   { type: "code";   code: string; showMs: number; }
export type B2Task = B2MashTask | B2SwipeTask | B2FreezeTask | B2WiresTask | B2CodeTask;

interface B2Room {
  code: string;
  adminId: string;
  players: Map<string, B2Player>;
  roomPhase: RoomPhase;
  bombHolderId: string | null;
  stability: number;
  stabilityInterval: ReturnType<typeof setInterval> | null;
  currentTask: B2Task | null;
  passTargetId: string | null;
  catchTaps: number;
  catchTimeout: ReturnType<typeof setTimeout> | null;
  sabotageTimestamps: Map<string, number>;
}

const rooms = new Map<string, B2Room>();
const PREFIX = "B2-";
const SABOTAGE_COOLDOWN_MS = 2500;
const CATCH_WINDOW_MS = 2800;
const CATCH_THRESHOLD = 5;
const PASS_WINDOW_MS = 8000;

function genCode(): string {
  let c: string;
  do { c = String(Math.floor(10000 + Math.random() * 90000)); } while (rooms.has(PREFIX + c));
  return c;
}

function reactorPhase(stability: number): ReactorPhase {
  if (stability > 75) return "calm";
  if (stability > 50) return "heating";
  if (stability > 25) return "critical";
  return "meltdown";
}

function drainPerTick(stability: number): number {
  const phase = reactorPhase(stability);
  if (phase === "calm")     return 0.4;
  if (phase === "heating")  return 0.8;
  if (phase === "critical") return 1.6;
  return 2.8;
}

function generateTask(stability: number): B2Task {
  const phase = reactorPhase(stability);
  const pool: Array<B2Task["type"]> = ["mash", "swipe", "freeze", "wires", "code"];
  const type = pool[Math.floor(Math.random() * pool.length)];
  if (type === "mash") {
    const target = phase === "meltdown" ? 22 : phase === "critical" ? 18 : 14;
    return { type: "mash", target };
  }
  if (type === "swipe") {
    const dirs = ["up","down","left","right"];
    const len = phase === "meltdown" ? 8 : phase === "critical" ? 6 : 4;
    return { type: "swipe", pattern: Array.from({ length: len }, () => dirs[Math.floor(Math.random() * 4)]) };
  }
  if (type === "freeze") {
    const holdMs = phase === "meltdown" ? 2500 : phase === "critical" ? 3000 : 3500;
    return { type: "freeze", holdMs };
  }
  if (type === "wires") {
    const colors = ["RED","GREEN","BLUE","YELLOW"];
    const shuffled = [...colors].sort(() => Math.random() - 0.5);
    return { type: "wires", wires: shuffled, correctWire: shuffled[Math.floor(Math.random() * 4)] };
  }
  const digits = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join("");
  const showMs = phase === "meltdown" ? 1000 : phase === "critical" ? 1500 : 2200;
  return { type: "code", code: digits, showMs };
}

function startStabilityDrain(io: Server, code: string): void {
  const room = rooms.get(PREFIX + code);
  if (!room) return;
  if (room.stabilityInterval) clearInterval(room.stabilityInterval);
  room.stabilityInterval = setInterval(() => {
    const r = rooms.get(PREFIX + code);
    if (!r || r.roomPhase === "exploded" || r.roomPhase === "lobby") {
      clearInterval(r?.stabilityInterval ?? undefined);
      return;
    }
    r.stability = Math.max(0, r.stability - drainPerTick(r.stability));
    io.to(PREFIX + code).emit("b2:stability-update", {
      stability: r.stability,
      reactorPhase: reactorPhase(r.stability),
    });
    if (r.stability <= 0) {
      clearInterval(r.stabilityInterval!);
      r.stabilityInterval = null;
      r.roomPhase = "exploded";
      const loser = r.bombHolderId ? r.players.get(r.bombHolderId) : null;
      if (loser) { loser.losses += 1; r.players.set(loser.id, loser); }
      io.to(PREFIX + code).emit("b2:explode", {
        loserId: r.bombHolderId,
        loserName: loser?.name ?? "Unknown",
        players: Array.from(r.players.values()),
      });
    }
  }, 500);
}

function sendNewTask(io: Server, code: string): void {
  const room = rooms.get(PREFIX + code);
  if (!room || !room.bombHolderId) return;
  const task = generateTask(room.stability);
  room.currentTask = task;
  room.roomPhase = "task";
  io.to(PREFIX + code).emit("b2:new-task", { task, holderId: room.bombHolderId });
}

function emitLobby(io: Server, code: string): void {
  const room = rooms.get(PREFIX + code);
  if (!room) return;
  io.to(PREFIX + code).emit("b2:lobby-update", {
    players: Array.from(room.players.values()),
    adminId: room.adminId,
  });
}

export function setupBomb2Handlers(io: Server): void {
  io.on("connection", (socket: Socket) => {

    socket.on("b2:create-room", (data: { playerName: string }, cb: (r: { code: string; playerId: string }) => void) => {
      const code = genCode();
      const player: B2Player = { id: socket.id, name: data.playerName, losses: 0, isAdmin: true };
      const room: B2Room = {
        code, adminId: socket.id,
        players: new Map([[socket.id, player]]),
        roomPhase: "lobby", bombHolderId: null,
        stability: 100, stabilityInterval: null, currentTask: null,
        passTargetId: null, catchTaps: 0, catchTimeout: null,
        sabotageTimestamps: new Map(),
      };
      rooms.set(PREFIX + code, room);
      socket.join(PREFIX + code);
      cb({ code, playerId: socket.id });
      emitLobby(io, code);
    });

    socket.on("b2:join-room", (data: { code: string; playerName: string }, cb: (r: { success: boolean; playerId?: string; error?: string }) => void) => {
      const room = rooms.get(PREFIX + data.code);
      if (!room) { cb({ success: false, error: "Room not found" }); return; }
      if (room.roomPhase !== "lobby") { cb({ success: false, error: "Game already started" }); return; }
      const player: B2Player = { id: socket.id, name: data.playerName, losses: 0, isAdmin: false };
      room.players.set(socket.id, player);
      socket.join(PREFIX + data.code);
      cb({ success: true, playerId: socket.id });
      emitLobby(io, data.code);
    });

    socket.on("b2:start-game", (data: { code: string }) => {
      const room = rooms.get(PREFIX + data.code);
      if (!room || socket.id !== room.adminId) return;
      if (room.players.size < 2) { socket.emit("b2:error", { message: "Need at least 2 players." }); return; }
      const ids = Array.from(room.players.keys());
      room.bombHolderId = ids[Math.floor(Math.random() * ids.length)];
      room.stability = 100;
      const task = generateTask(100);
      room.currentTask = task;
      room.roomPhase = "task";
      io.to(PREFIX + data.code).emit("b2:game-started", {
        bombHolderId: room.bombHolderId,
        task,
        players: Array.from(room.players.values()),
        stability: 100,
        reactorPhase: "calm" as ReactorPhase,
      });
      startStabilityDrain(io, data.code);
    });

    socket.on("b2:task-complete", (data: { code: string }) => {
      const room = rooms.get(PREFIX + data.code);
      if (!room || room.roomPhase !== "task") return;
      if (socket.id !== room.bombHolderId) return;
      room.roomPhase = "passing";
      const others = Array.from(room.players.values()).filter(p => p.id !== room.bombHolderId);
      socket.emit("b2:choose-target", {
        players: others,
        windowMs: PASS_WINDOW_MS,
      });
      const autoTimeout = setTimeout(() => {
        const r = rooms.get(PREFIX + data.code);
        if (!r || r.roomPhase !== "passing") return;
        const eligible = Array.from(r.players.values()).filter(p => p.id !== r.bombHolderId);
        if (eligible.length === 0) return;
        const target = eligible[Math.floor(Math.random() * eligible.length)];
        throwBomb(io, data.code, target.id, true);
      }, PASS_WINDOW_MS);
      room.catchTimeout = autoTimeout;
    });

    socket.on("b2:task-fail", (data: { code: string }) => {
      const room = rooms.get(PREFIX + data.code);
      if (!room || room.roomPhase !== "task") return;
      if (socket.id !== room.bombHolderId) return;
      const penalty = reactorPhase(room.stability) === "meltdown" ? 12 : 8;
      room.stability = Math.max(1, room.stability - penalty);
      io.to(PREFIX + data.code).emit("b2:stability-update", {
        stability: room.stability,
        reactorPhase: reactorPhase(room.stability),
      });
      io.to(PREFIX + data.code).emit("b2:task-failed", { holderId: socket.id });
      sendNewTask(io, data.code);
    });

    socket.on("b2:throw-bomb", (data: { code: string; targetId: string }) => {
      const room = rooms.get(PREFIX + data.code);
      if (!room || room.roomPhase !== "passing") return;
      if (socket.id !== room.bombHolderId) return;
      if (room.catchTimeout) { clearTimeout(room.catchTimeout); room.catchTimeout = null; }
      throwBomb(io, data.code, data.targetId, false);
    });

    socket.on("b2:catch-tap", (data: { code: string }) => {
      const room = rooms.get(PREFIX + data.code);
      if (!room || room.roomPhase !== "catching") return;
      if (socket.id !== room.passTargetId) return;
      room.catchTaps += 1;
      io.to(PREFIX + data.code).emit("b2:catch-progress", { taps: room.catchTaps, needed: CATCH_THRESHOLD });
      if (room.catchTaps >= CATCH_THRESHOLD) {
        if (room.catchTimeout) { clearTimeout(room.catchTimeout); room.catchTimeout = null; }
        const eligible = Array.from(room.players.values()).filter(p => p.id !== room.passTargetId && p.id !== room.bombHolderId);
        const target = eligible.length > 0
          ? eligible[Math.floor(Math.random() * eligible.length)]
          : Array.from(room.players.values()).filter(p => p.id !== room.passTargetId)[0];
        if (!target) return;
        io.to(PREFIX + data.code).emit("b2:bomb-deflected", {
          deflectorId: room.passTargetId,
          newHolderId: target.id,
          newHolderName: target.name,
        });
        room.bombHolderId = target.id;
        room.passTargetId = null;
        room.catchTaps = 0;
        sendNewTask(io, data.code);
      }
    });

    socket.on("b2:sabotage", (data: { code: string; sabotageType: string }) => {
      const room = rooms.get(PREFIX + data.code);
      if (!room || room.roomPhase === "lobby" || room.roomPhase === "exploded") return;
      if (socket.id === room.bombHolderId) return;
      const now = Date.now();
      const last = room.sabotageTimestamps.get(socket.id) ?? 0;
      if (now - last < SABOTAGE_COOLDOWN_MS) return;
      room.sabotageTimestamps.set(socket.id, now);
      const saboteur = room.players.get(socket.id);
      const sabName = saboteur?.name ?? "???";
      if (data.sabotageType === "overheat") {
        room.stability = Math.max(1, room.stability - 6);
        io.to(PREFIX + data.code).emit("b2:stability-update", { stability: room.stability, reactorPhase: reactorPhase(room.stability) });
        io.to(PREFIX + data.code).emit("b2:sabotage-effect", { type: "overheat", saboteurName: sabName });
      } else if (data.sabotageType === "power_surge") {
        io.to(PREFIX + data.code).emit("b2:sabotage-effect", { type: "power_surge", saboteurName: sabName });
      } else if (data.sabotageType === "static_burst") {
        io.to(PREFIX + data.code).emit("b2:sabotage-effect", { type: "static_burst", saboteurName: sabName });
      } else if (data.sabotageType === "coolant") {
        room.stability = Math.min(100, room.stability + 5);
        io.to(PREFIX + data.code).emit("b2:stability-update", { stability: room.stability, reactorPhase: reactorPhase(room.stability) });
        io.to(PREFIX + data.code).emit("b2:sabotage-effect", { type: "coolant", saboteurName: sabName });
      }
    });

    socket.on("b2:holder-input", (data: { code: string; event: unknown }) => {
      const room = rooms.get(PREFIX + data.code);
      if (!room || socket.id !== room.bombHolderId) return;
      socket.to(PREFIX + data.code).emit("b2:holder-input", data.event);
    });

    socket.on("b2:play-again", (data: { code: string }) => {
      const room = rooms.get(PREFIX + data.code);
      if (!room || socket.id !== room.adminId || room.roomPhase !== "exploded") return;
      room.stability = 100;
      room.catchTaps = 0;
      room.passTargetId = null;
      room.sabotageTimestamps.clear();
      const ids = Array.from(room.players.keys());
      room.bombHolderId = ids[Math.floor(Math.random() * ids.length)];
      const task = generateTask(100);
      room.currentTask = task;
      room.roomPhase = "task";
      io.to(PREFIX + data.code).emit("b2:game-started", {
        bombHolderId: room.bombHolderId,
        task,
        players: Array.from(room.players.values()),
        stability: 100,
        reactorPhase: "calm" as ReactorPhase,
      });
      startStabilityDrain(io, data.code);
    });

    socket.on("disconnect", () => {
      for (const [key, room] of rooms) {
        if (!room.players.has(socket.id)) continue;
        room.players.delete(socket.id);
        if (room.adminId === socket.id) {
          if (room.stabilityInterval) clearInterval(room.stabilityInterval);
          if (room.catchTimeout) clearTimeout(room.catchTimeout);
          rooms.delete(key);
          io.to(key).emit("b2:room-closed");
        } else {
          emitLobby(io, room.code);
        }
        break;
      }
    });
  });
}

function throwBomb(io: Server, code: string, targetId: string, autoThrown: boolean): void {
  const room = rooms.get(PREFIX + code);
  if (!room) return;
  const target = room.players.get(targetId);
  if (!target) return;
  room.passTargetId = targetId;
  room.catchTaps = 0;
  room.roomPhase = "catching";
  io.to(PREFIX + code).emit("b2:bomb-thrown", {
    fromId: room.bombHolderId,
    fromName: room.players.get(room.bombHolderId!)?.name ?? "???",
    targetId,
    targetName: target.name,
    autoThrown,
    windowMs: CATCH_WINDOW_MS,
    catchThreshold: CATCH_THRESHOLD,
  });
  room.catchTimeout = setTimeout(() => {
    const r = rooms.get(PREFIX + code);
    if (!r || r.roomPhase !== "catching") return;
    io.to(PREFIX + code).emit("b2:bomb-caught", {
      newHolderId: targetId,
      newHolderName: target.name,
    });
    r.bombHolderId = targetId;
    r.passTargetId = null;
    r.catchTaps = 0;
    sendNewTask(io, code);
  }, CATCH_WINDOW_MS);
}
