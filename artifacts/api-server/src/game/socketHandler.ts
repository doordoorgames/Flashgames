import type { Server } from "socket.io";
import {
  generateRoomCode,
  getRoom,
  setRoom,
  deleteRoom,
  getAllRooms,
} from "./roomManager.js";
import type { Room, Player, PlayerAnswer, GameItem } from "./gameState.js";
import { ROUND_CONFIG, TOTAL_ROUNDS, ANSWER_TIME_LIMIT } from "./gameState.js";
import { isCorrectAnswer, calculatePoints } from "./scoring.js";
import { getFlashPool } from "./confusionStore.js";

export function setupSocketHandlers(io: Server): void {
  io.on("connection", (socket) => {
    socket.on(
      "create-room",
      (
        data: { playerName: string },
        cb: (res: { code: string; playerId: string; error?: string }) => void
      ) => {
        const easy   = getFlashPool("easy");
        const medium = getFlashPool("medium");
        const hard   = getFlashPool("hard");
        console.log(`[Flash] create-room: pools easy=${easy.length}, medium=${medium.length}, hard=${hard.length}`);
        if (easy.length < 3 || medium.length < 3 || hard.length < 3) {
          cb({
            code: "",
            playerId: "",
            error: `Not enough flash_items per difficulty. Need 3+ each. easy=${easy.length}, medium=${medium.length}, hard=${hard.length}.`,
          });
          return;
        }
        const pick3 = (pool: GameItem[]) => [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
        const items = [...pick3(easy), ...pick3(medium), ...pick3(hard)];
        console.log(`[Flash] Session items selected (3 easy + 3 medium + 3 hard):`);
        items.forEach((item, i) => {
          const cfg = ROUND_CONFIG[i];
          console.log(`  Round ${i + 1} (${cfg.difficulty}, ${cfg.flashDurationMs}ms): "${item.prompt}"`);
        });
        const code = generateRoomCode();
        const player: Player = { id: socket.id, name: data.playerName, score: 0, isAdmin: true };
        const room: Room = {
          code,
          adminId: socket.id,
          players: new Map([[socket.id, player]]),
          phase: "lobby",
          currentRound: 0,
          items,
          currentAnswers: new Map(),
          roundResults: [],
        };
        setRoom(code, room);
        socket.join(code);
        cb({ code, playerId: socket.id });
        emitLobbyUpdate(io, code);
      }
    );

    socket.on(
      "join-room",
      (
        data: { code: string; playerName: string },
        cb: (res: { success: boolean; error?: string; playerId?: string }) => void
      ) => {
        const room = getRoom(data.code);
        if (!room) {
          cb({ success: false, error: "Room not found" });
          return;
        }
        if (room.phase !== "lobby") {
          cb({ success: false, error: "Game already started" });
          return;
        }
        const player: Player = {
          id: socket.id,
          name: data.playerName,
          score: 0,
          isAdmin: false,
        };
        room.players.set(socket.id, player);
        setRoom(data.code, room);
        socket.join(data.code);
        cb({ success: true, playerId: socket.id });
        emitLobbyUpdate(io, data.code);
      }
    );

    socket.on("start-game", (data: { code: string }) => {
      const room = getRoom(data.code);
      if (!room || socket.id !== room.adminId) return;
      if (room.items.length < TOTAL_ROUNDS) {
        io.to(data.code).emit("error-msg", {
          message: `Need at least ${TOTAL_ROUNDS} items. You have ${room.items.length}.`,
        });
        return;
      }
      room.currentRound = 0;
      startNextRound(io, data.code);
    });

    socket.on("next-round", (data: { code: string }) => {
      const room = getRoom(data.code);
      if (!room || socket.id !== room.adminId) return;
      if (room.phase !== "reveal") return;
      if (room.autoNextTimeout) {
        clearTimeout(room.autoNextTimeout);
        room.autoNextTimeout = undefined;
      }
      if (room.currentRound >= TOTAL_ROUNDS) {
        room.phase = "leaderboard";
        setRoom(data.code, room);
        io.to(data.code).emit("game-over", {
          players: getLeaderboard(room),
        });
        return;
      }
      startNextRound(io, data.code);
    });

    socket.on(
      "submit-answer",
      (data: { code: string; answer: string }) => {
        const room = getRoom(data.code);
        if (!room || room.phase !== "answering") return;
        if (room.currentAnswers.has(socket.id)) return;
        const player = room.players.get(socket.id);
        if (!player) return;
        const answer: PlayerAnswer = {
          playerId: socket.id,
          playerName: player.name,
          answer: data.answer,
          submittedAt: Date.now(),
        };
        room.currentAnswers.set(socket.id, answer);
        io.to(room.adminId).emit("answer-received", {
          playerId: socket.id,
          playerName: player.name,
          answer: data.answer,
        });
      }
    );

    socket.on("restart-game", (data: { code: string }) => {
      const room = getRoom(data.code);
      if (!room || socket.id !== room.adminId) return;
      if (room.phase !== "leaderboard") return;
      const easy   = getFlashPool("easy");
      const medium = getFlashPool("medium");
      const hard   = getFlashPool("hard");
      console.log(`[Flash] restart-game: pools easy=${easy.length}, medium=${medium.length}, hard=${hard.length}`);
      if (easy.length < 3 || medium.length < 3 || hard.length < 3) {
        io.to(data.code).emit("error-msg", {
          message: `Not enough flash_items per difficulty. Need 3+ each. easy=${easy.length}, medium=${medium.length}, hard=${hard.length}.`,
        });
        return;
      }
      const pick3 = (pool: GameItem[]) => [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
      const items = [...pick3(easy), ...pick3(medium), ...pick3(hard)];
      console.log(`[Flash] Restart items selected:`);
      items.forEach((item, i) => {
        const cfg = ROUND_CONFIG[i];
        console.log(`  Round ${i + 1} (${cfg.difficulty}, ${cfg.flashDurationMs}ms): "${item.prompt}"`);
      });
      room.players.forEach(player => { player.score = 0; });
      room.items = items;
      room.currentRound = 0;
      room.roundResults = [];
      room.phase = "lobby";
      setRoom(data.code, room);
      startNextRound(io, data.code);
    });

    socket.on("disconnect", () => {
      const allRooms = getAllRooms();
      for (const [code, room] of allRooms) {
        if (room.players.has(socket.id)) {
          room.players.delete(socket.id);
          if (room.adminId === socket.id) {
            deleteRoom(code);
            io.to(code).emit("room-closed");
          } else {
            setRoom(code, room);
            emitLobbyUpdate(io, code);
          }
        }
      }
    });
  });
}

function emitLobbyUpdate(io: Server, code: string): void {
  const room = getRoom(code);
  if (!room) return;
  io.to(code).emit("lobby-update", {
    players: Array.from(room.players.values()),
    adminId: room.adminId,
    itemCount: room.items.length,
  });
}

function getLeaderboard(room: Room): Player[] {
  return Array.from(room.players.values()).sort((a, b) => b.score - a.score);
}

function startNextRound(io: Server, code: string): void {
  const room = getRoom(code);
  if (!room) return;

  room.currentRound += 1;
  room.currentAnswers = new Map();
  const roundIndex = room.currentRound - 1;
  const config = ROUND_CONFIG[roundIndex];
  const item = room.items[roundIndex];

  console.log(`[Flash] Round ${room.currentRound}/${TOTAL_ROUNDS}: difficulty=${config.difficulty}, flashDuration=${config.flashDurationMs}ms, item="${item.prompt}"`);

  room.phase = "round-info";
  setRoom(code, room);

  io.to(code).emit("round-start", {
    roundNumber: room.currentRound,
    totalRounds: TOTAL_ROUNDS,
    difficulty: config.difficulty,
    flashDurationMs: config.flashDurationMs,
    item,
  });

  setTimeout(() => {
    const r = getRoom(code);
    if (!r) return;
    r.phase = "countdown";
    setRoom(code, r);

    let count = 3;
    const tick = () => {
      io.to(code).emit("countdown-tick", { count });
      count--;
      if (count > 0) {
        setTimeout(tick, 1000);
      } else {
        setTimeout(() => {
          doFlash(io, code, item, config.flashDurationMs);
        }, 1000);
      }
    };
    tick();
  }, 2500);
}

function doFlash(
  io: Server,
  code: string,
  item: GameItem,
  flashDurationMs: number
): void {
  const room = getRoom(code);
  if (!room) return;
  room.phase = "flash";
  setRoom(code, room);
  io.to(code).emit("flash-show", { item });

  room.flashTimeout = setTimeout(() => {
    const r = getRoom(code);
    if (!r) return;
    r.phase = "answering";
    setRoom(code, r);
    io.to(code).emit("flash-hide");
    io.to(code).emit("answering-start", { timeLimit: ANSWER_TIME_LIMIT });

    setTimeout(() => {
      revealAnswers(io, code, item);
    }, ANSWER_TIME_LIMIT * 1000);
  }, flashDurationMs);
}

function revealAnswers(io: Server, code: string, item: GameItem): void {
  const room = getRoom(code);
  if (!room) return;

  const answers = Array.from(room.currentAnswers.values());
  const sortedByTime = [...answers].sort(
    (a, b) => a.submittedAt - b.submittedAt
  );

  let rank = 1;
  for (const ans of sortedByTime) {
    const correct = isCorrectAnswer(
      ans.answer,
      item.correctAnswer,
      item.acceptedAnswers
    );
    ans.isCorrect = correct;
    if (correct) {
      ans.pointsEarned = calculatePoints(rank);
      rank++;
      const player = room.players.get(ans.playerId);
      if (player) {
        player.score += ans.pointsEarned;
        room.players.set(ans.playerId, player);
      }
    } else {
      ans.pointsEarned = 0;
    }
  }

  room.phase = "reveal";
  room.roundResults.push({
    roundNumber: room.currentRound,
    item,
    answers: sortedByTime,
  });
  setRoom(code, room);

  io.to(code).emit("round-reveal", {
    item,
    answers: sortedByTime,
    leaderboard: getLeaderboard(room),
    isLastRound: room.currentRound >= TOTAL_ROUNDS,
  });

  room.autoNextTimeout = setTimeout(() => {
    const r = getRoom(code);
    if (!r || r.phase !== "reveal") return;
    if (r.autoNextTimeout) {
      r.autoNextTimeout = undefined;
    }
    if (r.currentRound >= TOTAL_ROUNDS) {
      r.phase = "leaderboard";
      setRoom(code, r);
      io.to(code).emit("game-over", { players: getLeaderboard(r) });
    } else {
      startNextRound(io, code);
    }
  }, 10000);
  setRoom(code, room);
}
