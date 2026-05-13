import { useState, useEffect, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket";
import Bomb2Home from "./Bomb2Home";
import Bomb2Lobby from "./Bomb2Lobby";
import Bomb2Game from "./Bomb2Game";

export type ReactorPhase = "calm" | "heating" | "critical" | "meltdown";
export interface B2Player { id: string; name: string; losses: number; isAdmin: boolean; }
export interface B2MashTask   { type: "mash";   target: number; }
export interface B2SwipeTask  { type: "swipe";  pattern: string[]; }
export interface B2FreezeTask { type: "freeze"; holdMs: number; }
export interface B2WiresTask  { type: "wires";  wires: string[]; correctWire: string; }
export interface B2CodeTask   { type: "code";   code: string; showMs: number; }
export type B2Task = B2MashTask | B2SwipeTask | B2FreezeTask | B2WiresTask | B2CodeTask;

// HolderInputEvent is the universal event bus for:
// - real holder task inputs (mash, swipe, freeze, wires, code)
// - game events injected as synthetic entries (sabotage, bomb_thrown, etc.)
export interface HolderInputEvent {
  taskType: string; // "mash"|"swipe"|"freeze"|"wires"|"code"|"sabotage_surge"|"sabotage_static"|"sabotage_overheat"|"sabotage_coolant"|"bomb_thrown"|"bomb_deflected"|"task_fail"|"task_success"
  correct: boolean;
  label: string;   // display label for the live feed pill
}

type AppPhase = "home" | "lobby" | "game";
type RoomPhase = "task" | "passing" | "catching" | "exploded";
interface Session { code: string; playerId: string; isAdmin: boolean; }
interface CatchData { fromName: string; windowMs: number; threshold: number; }
interface Props { onBack: () => void; }

const MAX_INPUT_LOG = 40;

export default function Bomb2App({ onBack }: Props) {
  const [phase, setPhase] = useState<AppPhase>("home");
  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<B2Player[]>([]);
  const [bombHolderId, setBombHolderId] = useState("");
  const [task, setTask] = useState<B2Task | null>(null);
  const [gamePhase, setGamePhase] = useState<"playing" | "exploded">("playing");
  const [roomPhase, setRoomPhase] = useState<RoomPhase>("task");
  const [loserId, setLoserId] = useState<string | null>(null);
  const [loserName, setLoserName] = useState<string | null>(null);
  const [stability, setStability] = useState(100);
  const [reactorPhase, setReactorPhase] = useState<ReactorPhase>("calm");
  const [passCandidates, setPassCandidates] = useState<B2Player[]>([]);
  const [passWindowMs, setPassWindowMs] = useState(8000);
  const [catchData, setCatchData] = useState<CatchData | null>(null);
  const [catchTaps, setCatchTaps] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [holderInputLog, setHolderInputLog] = useState<HolderInputEvent[]>([]);
  const [roundCount, setRoundCount] = useState(0);
  const roundRef = useRef(-1);
  const sessionRef = useRef<Session | null>(null);

  // push a synthetic game-event into the log so Bomb2Game commentary fires
  const pushEvent = useCallback((ev: HolderInputEvent) => {
    setHolderInputLog(prev => [...prev.slice(-(MAX_INPUT_LOG - 1)), ev]);
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const socket = getSocket();

    socket.on("b2:lobby-update", (data: { players: B2Player[] }) => {
      setPlayers(data.players);
    });

    socket.on("b2:game-started", (data: {
      bombHolderId: string; task: B2Task; players: B2Player[];
      stability: number; reactorPhase: ReactorPhase;
    }) => {
      roundRef.current += 1;
      setRoundCount(roundRef.current);
      setPlayers(data.players);
      setBombHolderId(data.bombHolderId);
      setTask(data.task);
      setStability(data.stability);
      setReactorPhase(data.reactorPhase);
      setGamePhase("playing");
      setRoomPhase("task");
      setLoserId(null); setLoserName(null);
      setPassCandidates([]); setCatchData(null); setCatchTaps(0);
      setHolderInputLog([]);
      setPhase("game");
    });

    socket.on("b2:new-task", (data: { task: B2Task; holderId: string }) => {
      setTask(data.task);
      setBombHolderId(data.holderId);
      setRoomPhase("task");
      setCatchData(null); setPassCandidates([]);
    });

    socket.on("b2:stability-update", (data: { stability: number; reactorPhase: ReactorPhase }) => {
      setStability(data.stability);
      setReactorPhase(data.reactorPhase);
    });

    socket.on("b2:choose-target", (data: { players: B2Player[]; windowMs: number }) => {
      setPassCandidates(data.players);
      setPassWindowMs(data.windowMs);
      setRoomPhase("passing");
      pushEvent({ taskType: "task_success", correct: true, label: "✓" });
    });

    socket.on("b2:bomb-thrown", (data: {
      fromId: string; fromName: string; targetId: string; targetName: string;
      autoThrown: boolean; windowMs: number; catchThreshold: number;
    }) => {
      const s = sessionRef.current;
      if (s && socket.id === data.targetId) {
        setCatchData({ fromName: data.fromName, windowMs: data.windowMs, threshold: data.catchThreshold });
        setCatchTaps(0);
      }
      setRoomPhase("catching");
      pushEvent({ taskType: "bomb_thrown", correct: true, label: data.fromName });
    });

    socket.on("b2:catch-progress", (data: { taps: number; needed: number }) => {
      setCatchTaps(data.taps);
    });

    socket.on("b2:bomb-caught", (data: { newHolderId: string; newHolderName: string }) => {
      setBombHolderId(data.newHolderId);
      setCatchData(null); setPassCandidates([]);
    });

    socket.on("b2:bomb-deflected", (data: { deflectorId: string; newHolderId: string; newHolderName: string }) => {
      setBombHolderId(data.newHolderId);
      setCatchData(null); setPassCandidates([]);
      pushEvent({ taskType: "bomb_deflected", correct: true, label: data.newHolderName });
    });

    socket.on("b2:task-failed", (_data: { holderId: string }) => {
      pushEvent({ taskType: "task_fail", correct: false, label: "✗" });
    });

    socket.on("b2:sabotage-effect", (data: { type: string; saboteurName: string }) => {
      const typeMap: Record<string, string> = {
        overheat:    "sabotage_overheat",
        power_surge: "sabotage_surge",
        static_burst:"sabotage_static",
        coolant:     "sabotage_coolant",
      };
      pushEvent({ taskType: typeMap[data.type] ?? "sabotage_overheat", correct: false, label: data.saboteurName });
    });

    // Holder's real task inputs relayed from server to spectators
    socket.on("b2:holder-input", (ev: HolderInputEvent) => {
      setHolderInputLog(prev => [...prev.slice(-(MAX_INPUT_LOG - 1)), ev]);
    });

    socket.on("b2:explode", (data: { loserId: string; loserName: string; players: B2Player[] }) => {
      setPlayers(data.players);
      setLoserId(data.loserId); setLoserName(data.loserName);
      setGamePhase("exploded"); setRoomPhase("exploded");
    });

    socket.on("b2:error", (data: { message: string }) => setErrorMsg(data.message));

    socket.on("b2:room-closed", () => {
      alert("Host left. Reactor offline.");
      setPhase("home"); setSession(null);
    });

    return () => {
      ["b2:lobby-update","b2:game-started","b2:new-task","b2:stability-update",
       "b2:choose-target","b2:bomb-thrown","b2:catch-progress","b2:bomb-caught",
       "b2:bomb-deflected","b2:task-failed","b2:sabotage-effect","b2:holder-input",
       "b2:explode","b2:error","b2:room-closed"].forEach(e => socket.off(e));
    };
  }, [pushEvent]);

  const handleJoined = (code: string, playerId: string, _name: string, isAdmin: boolean) => {
    setSession({ code, playerId, isAdmin });
    setPhase("lobby");
  };

  const onTaskComplete = useCallback(() => {
    const s = sessionRef.current; if (!s) return;
    getSocket().emit("b2:task-complete", { code: s.code });
  }, []);

  const onTaskFail = useCallback(() => {
    const s = sessionRef.current; if (!s) return;
    getSocket().emit("b2:task-fail", { code: s.code });
  }, []);

  const onThrowBomb = useCallback((targetId: string) => {
    const s = sessionRef.current; if (!s) return;
    getSocket().emit("b2:throw-bomb", { code: s.code, targetId });
    setPassCandidates([]);
  }, []);

  const onCatchTap = useCallback(() => {
    const s = sessionRef.current; if (!s) return;
    getSocket().emit("b2:catch-tap", { code: s.code });
  }, []);

  const onSabotage = useCallback((sabotageType: string) => {
    const s = sessionRef.current; if (!s) return;
    getSocket().emit("b2:sabotage", { code: s.code, sabotageType });
  }, []);

  const onPlayAgain = useCallback(() => {
    const s = sessionRef.current; if (!s) return;
    getSocket().emit("b2:play-again", { code: s.code });
    setGamePhase("playing");
  }, []);

  // Called by task components when the holder does something (emits to server + local log)
  const onHolderInput = useCallback((ev: HolderInputEvent) => {
    const s = sessionRef.current; if (!s) return;
    // Update local log for the holder themselves
    setHolderInputLog(prev => [...prev.slice(-(MAX_INPUT_LOG - 1)), ev]);
    // Relay to spectators via server
    getSocket().emit("b2:holder-input", { code: s.code, event: ev });
  }, []);

  if (phase === "game" && session) {
    return (
      <Bomb2Game
        playerId={session.playerId}
        isAdmin={session.isAdmin}
        players={players}
        bombHolderId={bombHolderId}
        task={task}
        gamePhase={gamePhase}
        roomPhase={roomPhase}
        loserId={loserId}
        loserName={loserName}
        stability={stability}
        reactorPhase={reactorPhase}
        passCandidates={passCandidates}
        passWindowMs={passWindowMs}
        catchData={catchData}
        catchTaps={catchTaps}
        holderInputLog={holderInputLog}
        roundCount={roundCount}
        onTaskComplete={onTaskComplete}
        onTaskFail={onTaskFail}
        onThrowBomb={onThrowBomb}
        onCatchTap={onCatchTap}
        onSabotage={onSabotage}
        onPlayAgain={onPlayAgain}
        onHolderInput={onHolderInput}
        code={session.code}
      />
    );
  }

  if (phase === "lobby" && session) {
    return (
      <Bomb2Lobby
        code={session.code}
        playerId={session.playerId}
        isAdmin={session.isAdmin}
        players={players}
        errorMsg={errorMsg}
        onStartGame={() => { const s = sessionRef.current; if (s) getSocket().emit("b2:start-game", { code: s.code }); }}
        onBack={() => { setPhase("home"); setSession(null); }}
      />
    );
  }

  return <Bomb2Home onBack={onBack} onJoined={handleJoined} />;
}
