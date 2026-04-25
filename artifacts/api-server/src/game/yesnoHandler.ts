import type { Server, Socket } from "socket.io";
import { getYesNoQuestions } from "./yesnoStore.js";

interface YesNoPlayer {
  id: string;
  name: string;
  score: number;
  isAdmin: boolean;
}

interface YesNoRoom {
  code: string;
  adminId: string;
  players: Map<string, YesNoPlayer>;
  phase: "lobby" | "round" | "between-rounds" | "gameover";
  questions: string[];
  askerPlayerId: string | null;
  hotSeatPlayerId: string | null;
  currentQuestionIndex: number;
  answersThisRound: string[];
  questionCount: number;
  playerQueue: string[];
  currentQueueIndex: number;
}

const yesnoRooms = new Map<string, YesNoRoom>();

function generateCode(): string {
  let code: string;
  do {
    code = String(Math.floor(10000 + Math.random() * 90000));
  } while (yesnoRooms.has("YN" + code));
  return code;
}

const YES_WORDS = new Set([
  "yes", "yeah", "yep", "yup", "aye", "sure", "absolutely",
  "definitely", "certainly", "affirmative", "indeed", "correct",
  "right", "true", "of course", "for sure", "totally",
]);
const NO_WORDS = new Set([
  "no", "nope", "nah", "never", "negative", "not", "nay",
  "absolutely not", "of course not",
]);

function detectViolation(answer: string, prevAnswers: string[]): "yes" | "no" | "repeat" | null {
  const lower = answer.toLowerCase().trim();
  const words = lower.split(/\s+/);
  for (const w of words) { if (YES_WORDS.has(w)) return "yes"; }
  for (const phrase of YES_WORDS) { if (lower.includes(phrase)) return "yes"; }
  for (const w of words) { if (NO_WORDS.has(w)) return "no"; }
  for (const phrase of NO_WORDS) { if (lower.includes(phrase)) return "no"; }
  const normalized = lower.replace(/[^a-z0-9\s]/g, "").trim();
  for (const prev of prevAnswers) {
    if (normalized === prev.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim()) return "repeat";
  }
  return null;
}

function emitLobbyUpdate(io: Server, code: string): void {
  const room = yesnoRooms.get("YN" + code);
  if (!room) return;
  io.to("YN" + code).emit("yn:lobby-update", {
    players: Array.from(room.players.values()),
    adminId: room.adminId,
    questionCount: getYesNoQuestions().length,
  });
}

function getLeaderboard(room: YesNoRoom): YesNoPlayer[] {
  return Array.from(room.players.values()).sort((a, b) => b.score - a.score);
}

function buildRoundOverExtras(room: YesNoRoom) {
  const isLastPair = room.currentQueueIndex + 2 >= room.playerQueue.length;
  const nextAskedName = isLastPair
    ? null
    : room.players.get(room.playerQueue[room.currentQueueIndex + 2])?.name ?? null;
  return { isLastPair, nextAskedName };
}

function startPairRound(io: Server, code: string): void {
  const room = yesnoRooms.get("YN" + code);
  if (!room) return;

  const questions = getYesNoQuestions();
  if (questions.length === 0) {
    io.to("YN" + code).emit("yn:error", { message: "No questions uploaded. Go to /admin to upload questions." });
    return;
  }

  const askerId = room.playerQueue[room.currentQueueIndex];
  const askedId = room.playerQueue[room.currentQueueIndex + 1];
  const asker = room.players.get(askerId);
  const asked = room.players.get(askedId);

  if (!asker || !asked) {
    room.currentQueueIndex++;
    if (room.currentQueueIndex + 1 >= room.playerQueue.length) {
      room.phase = "gameover";
      yesnoRooms.set("YN" + code, room);
      io.to("YN" + code).emit("yn:game-over", { leaderboard: getLeaderboard(room) });
      return;
    }
    yesnoRooms.set("YN" + code, room);
    startPairRound(io, code);
    return;
  }

  room.phase = "round";
  room.questions = [...questions].sort(() => Math.random() - 0.5);
  room.askerPlayerId = askerId;
  room.hotSeatPlayerId = askedId;
  room.currentQuestionIndex = 0;
  room.answersThisRound = [];
  room.questionCount = 0;
  yesnoRooms.set("YN" + code, room);

  const { isLastPair, nextAskedName } = buildRoundOverExtras(room);

  io.to("YN" + code).emit("yn:round-started", {
    askerPlayerId: askerId,
    askerPlayerName: asker.name,
    hotSeatPlayerId: askedId,
    hotSeatPlayerName: asked.name,
    question: room.questions[0],
    questionNumber: 1,
    leaderboard: getLeaderboard(room),
    pairNumber: room.currentQueueIndex + 1,
    totalPairs: room.playerQueue.length - 1,
    isLastPair,
    nextAskedName,
  });
}

export function setupYesNoHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {

    socket.on("yn:create-room", (data: { playerName: string }, cb: (res: { code: string; playerId: string; error?: string }) => void) => {
      const code = generateCode();
      const player: YesNoPlayer = { id: socket.id, name: data.playerName, score: 0, isAdmin: true };
      const room: YesNoRoom = {
        code, adminId: socket.id,
        players: new Map([[socket.id, player]]),
        phase: "lobby", questions: [],
        askerPlayerId: null, hotSeatPlayerId: null,
        currentQuestionIndex: 0, answersThisRound: [], questionCount: 0,
        playerQueue: [], currentQueueIndex: 0,
      };
      yesnoRooms.set("YN" + code, room);
      socket.join("YN" + code);
      cb({ code, playerId: socket.id });
      emitLobbyUpdate(io, code);
    });

    socket.on("yn:join-room", (data: { code: string; playerName: string }, cb: (res: { success: boolean; playerId?: string; error?: string }) => void) => {
      const room = yesnoRooms.get("YN" + data.code);
      if (!room) { cb({ success: false, error: "Room not found" }); return; }
      if (room.phase !== "lobby") { cb({ success: false, error: "Game already started" }); return; }
      const player: YesNoPlayer = { id: socket.id, name: data.playerName, score: 0, isAdmin: false };
      room.players.set(socket.id, player);
      socket.join("YN" + data.code);
      cb({ success: true, playerId: socket.id });
      emitLobbyUpdate(io, data.code);
    });

    socket.on("yn:start-round", (data: { code: string }) => {
      const room = yesnoRooms.get("YN" + data.code);
      if (!room || socket.id !== room.adminId) return;
      if (room.players.size < 2) {
        io.to("YN" + data.code).emit("yn:error", { message: "Need at least 2 players to start." });
        return;
      }
      const playerIds = Array.from(room.players.keys());
      room.playerQueue = [...playerIds].sort(() => Math.random() - 0.5);
      room.currentQueueIndex = 0;
      yesnoRooms.set("YN" + data.code, room);
      startPairRound(io, data.code);
    });

    socket.on("yn:next-player", (data: { code: string }) => {
      const room = yesnoRooms.get("YN" + data.code);
      if (!room || socket.id !== room.adminId) return;
      if (room.phase !== "between-rounds") return;
      room.currentQueueIndex++;
      yesnoRooms.set("YN" + data.code, room);
      if (room.currentQueueIndex + 1 >= room.playerQueue.length) {
        room.phase = "gameover";
        yesnoRooms.set("YN" + data.code, room);
        io.to("YN" + data.code).emit("yn:game-over", { leaderboard: getLeaderboard(room) });
        return;
      }
      startPairRound(io, data.code);
    });

    socket.on("yn:next-question", (data: { code: string }) => {
      const room = yesnoRooms.get("YN" + data.code);
      if (!room || room.phase !== "round") return;
      const isAsker = socket.id === room.askerPlayerId;
      const isAdmin = socket.id === room.adminId;
      if (!isAsker && !isAdmin) return;
      room.currentQuestionIndex = (room.currentQuestionIndex + 1) % room.questions.length;
      const q = room.questions[room.currentQuestionIndex];
      yesnoRooms.set("YN" + data.code, room);
      io.to("YN" + data.code).emit("yn:question-changed", {
        question: q,
        questionNumber: room.questionCount + 1,
      });
    });

    socket.on("yn:fail-player", (data: { code: string }) => {
      const room = yesnoRooms.get("YN" + data.code);
      if (!room || room.phase !== "round") return;
      const isAsker = socket.id === room.askerPlayerId;
      const isAdmin = socket.id === room.adminId;
      if (!isAsker && !isAdmin) return;
      room.phase = "between-rounds";
      yesnoRooms.set("YN" + data.code, room);
      const { isLastPair, nextAskedName } = buildRoundOverExtras(room);
      io.to("YN" + data.code).emit("yn:round-over", {
        passed: false,
        violation: "manual",
        answersGiven: room.questionCount,
        hotSeatPlayerId: room.hotSeatPlayerId,
        leaderboard: getLeaderboard(room),
        isLastPair,
        nextAskedName,
      });
    });

    socket.on("yn:submit-answer", (data: { code: string; answer: string }) => {
      const room = yesnoRooms.get("YN" + data.code);
      if (!room || room.phase !== "round") return;
      if (socket.id !== room.hotSeatPlayerId) return;
      const answer = data.answer.trim();
      if (!answer) return;
      const violation = detectViolation(answer, room.answersThisRound);
      if (violation) {
        room.phase = "between-rounds";
        yesnoRooms.set("YN" + data.code, room);
        const { isLastPair, nextAskedName } = buildRoundOverExtras(room);
        io.to("YN" + data.code).emit("yn:answer-result", {
          answer, violation, answersThisRound: room.answersThisRound, questionNumber: room.questionCount + 1,
        });
        io.to("YN" + data.code).emit("yn:round-over", {
          passed: false, violation, answersGiven: room.questionCount,
          hotSeatPlayerId: room.hotSeatPlayerId, leaderboard: getLeaderboard(room), isLastPair, nextAskedName,
        });
        return;
      }
      room.answersThisRound.push(answer);
      room.questionCount++;
      yesnoRooms.set("YN" + data.code, room);
      io.to("YN" + data.code).emit("yn:answer-result", {
        answer, violation: null, answersThisRound: room.answersThisRound, questionNumber: room.questionCount,
      });
      if (room.questionCount >= 10) {
        const player = room.players.get(room.hotSeatPlayerId!);
        if (player) { player.score += 1; room.players.set(room.hotSeatPlayerId!, player); }
        room.phase = "between-rounds";
        yesnoRooms.set("YN" + data.code, room);
        const { isLastPair, nextAskedName } = buildRoundOverExtras(room);
        io.to("YN" + data.code).emit("yn:round-over", {
          passed: true, violation: null, answersGiven: 10,
          hotSeatPlayerId: room.hotSeatPlayerId, leaderboard: getLeaderboard(room), isLastPair, nextAskedName,
        });
      }
    });

    socket.on("yn:end-game", (data: { code: string }) => {
      const room = yesnoRooms.get("YN" + data.code);
      if (!room || socket.id !== room.adminId) return;
      room.phase = "gameover";
      yesnoRooms.set("YN" + data.code, room);
      io.to("YN" + data.code).emit("yn:game-over", { leaderboard: getLeaderboard(room) });
    });

    socket.on("yn:return-lobby", (data: { code: string }) => {
      const room = yesnoRooms.get("YN" + data.code);
      if (!room || socket.id !== room.adminId) return;
      room.phase = "lobby";
      room.askerPlayerId = null;
      room.hotSeatPlayerId = null;
      room.answersThisRound = [];
      room.questionCount = 0;
      room.playerQueue = [];
      room.currentQueueIndex = 0;
      yesnoRooms.set("YN" + data.code, room);
      emitLobbyUpdate(io, data.code);
    });

    socket.on("disconnect", () => {
      for (const [key, room] of yesnoRooms) {
        if (room.players.has(socket.id)) {
          room.players.delete(socket.id);
          if (room.adminId === socket.id) {
            yesnoRooms.delete(key);
            io.to(key).emit("yn:room-closed");
          } else {
            emitLobbyUpdate(io, room.code);
          }
        }
      }
    });
  });
}
