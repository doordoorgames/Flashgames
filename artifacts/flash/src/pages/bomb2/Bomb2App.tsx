import { useState, useEffect, useCallback } from "react";
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

type AppPhase = "home" | "lobby" | "game";
type RoomPhase = "task" | "passing" | "catching" | "exploded";

interface Session { code: string; playerId: string; isAdmin: boolean; }
interface CatchData { fromName: string; windowMs: number; threshold: number; }

interface Props { onBack: () => void; }

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
  const [sabotageAlert, setSabotageAlert] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const socket = getSocket();

    socket.on("b2:lobby-update", (data: { players: B2Player[] }) => {
      setPlayers(data.players);
    });

    socket.on("b2:game-started", (data: {
      bombHolderId: string; task: B2Task; players: B2Player[];
      stability: number; reactorPhase: ReactorPhase;
    }) => {
      setPlayers(data.players);
      setBombHolderId(data.bombHolderId);
      setTask(data.task);
      setStability(data.stability);
      setReactorPhase(data.reactorPhase);
      setGamePhase("playing");
      setRoomPhase("task");
      setLoserId(null); setLoserName(null);
      setPassCandidates([]); setCatchData(null); setCatchTaps(0);
      setSabotageAlert("");
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
    });

    socket.on("b2:bomb-thrown", (data: {
      fromId: string; fromName: string; targetId: string; targetName: string;
      autoThrown: boolean; windowMs: number; catchThreshold: number;
    }) => {
      const socket = getSocket();
      if (socket.id === data.targetId) {
        setCatchData({ fromName: data.fromName, windowMs: data.windowMs, threshold: data.catchThreshold });
        setCatchTaps(0);
      }
      setRoomPhase("catching");
      setSabotageAlert(`BOMB THROWN → ${data.targetName.toUpperCase()}`);
      setTimeout(() => setSabotageAlert(""), 1800);
    });

    socket.on("b2:catch-progress", (data: { taps: number; needed: number }) => {
      setCatchTaps(data.taps);
    });

    socket.on("b2:bomb-caught", (data: { newHolderId: string; newHolderName: string }) => {
      setBombHolderId(data.newHolderId);
      setCatchData(null); setPassCandidates([]);
      setSabotageAlert(`${data.newHolderName.toUpperCase()} NOW HOLDS BOMB`);
      setTimeout(() => setSabotageAlert(""), 1800);
    });

    socket.on("b2:bomb-deflected", (data: { deflectorId: string; newHolderId: string; newHolderName: string }) => {
      setBombHolderId(data.newHolderId);
      setCatchData(null); setPassCandidates([]);
      setSabotageAlert(`DEFLECTED → ${data.newHolderName.toUpperCase()}`);
      setTimeout(() => setSabotageAlert(""), 1800);
    });

    socket.on("b2:task-failed", (data: { holderId: string }) => {
      const holder = players.find(p => p.id === data.holderId);
      setSabotageAlert(`TASK FAILED — ${holder?.name.toUpperCase() ?? "???"}`);
      setTimeout(() => setSabotageAlert(""), 1500);
    });

    socket.on("b2:sabotage-effect", (data: { type: string; saboteurName: string }) => {
      const msgs: Record<string, string> = {
        overheat: `OVERHEAT BY ${data.saboteurName.toUpperCase()}`,
        power_surge: `POWER SURGE — ${data.saboteurName.toUpperCase()}`,
        static_burst: `STATIC BURST — ${data.saboteurName.toUpperCase()}`,
        coolant: `COOLANT BY ${data.saboteurName.toUpperCase()}`,
      };
      setSabotageAlert(msgs[data.type] ?? `${data.type.toUpperCase()}`);
      setTimeout(() => setSabotageAlert(""), 2000);
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
       "b2:bomb-deflected","b2:task-failed","b2:sabotage-effect","b2:explode",
       "b2:error","b2:room-closed"].forEach(e => socket.off(e));
    };
  }, [players]);

  const handleJoined = (code: string, playerId: string, _name: string, isAdmin: boolean) => {
    setSession({ code, playerId, isAdmin });
    setPhase("lobby");
  };

  const onTaskComplete = useCallback(() => {
    if (!session) return;
    getSocket().emit("b2:task-complete", { code: session.code });
  }, [session]);

  const onTaskFail = useCallback(() => {
    if (!session) return;
    getSocket().emit("b2:task-fail", { code: session.code });
  }, [session]);

  const onThrowBomb = useCallback((targetId: string) => {
    if (!session) return;
    getSocket().emit("b2:throw-bomb", { code: session.code, targetId });
    setPassCandidates([]);
  }, [session]);

  const onCatchTap = useCallback(() => {
    if (!session) return;
    getSocket().emit("b2:catch-tap", { code: session.code });
  }, [session]);

  const onSabotage = useCallback((sabotageType: string) => {
    if (!session) return;
    getSocket().emit("b2:sabotage", { code: session.code, sabotageType });
  }, [session]);

  const onPlayAgain = useCallback(() => {
    if (!session) return;
    getSocket().emit("b2:play-again", { code: session.code });
    setGamePhase("playing");
  }, [session]);

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
        sabotageAlert={sabotageAlert}
        onTaskComplete={onTaskComplete}
        onTaskFail={onTaskFail}
        onThrowBomb={onThrowBomb}
        onCatchTap={onCatchTap}
        onSabotage={onSabotage}
        onPlayAgain={onPlayAgain}
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
        onStartGame={() => getSocket().emit("b2:start-game", { code: session.code })}
        onBack={() => { setPhase("home"); setSession(null); }}
      />
    );
  }

  return <Bomb2Home onBack={onBack} onJoined={handleJoined} />;
}
