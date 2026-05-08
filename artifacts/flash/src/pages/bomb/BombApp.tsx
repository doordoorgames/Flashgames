import { useState, useEffect, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import BombHome from "./BombHome";
import BombLobby from "./BombLobby";
import BombGame, { type BombAction, type BombPlayer, type InputProgress } from "./BombGame";

type BombPhase = "home" | "lobby" | "game";

interface BombSession {
  code: string;
  playerId: string;
  isAdmin: boolean;
}

interface Props {
  onBack: () => void;
}

export default function BombApp({ onBack }: Props) {
  const [phase, setPhase] = useState<BombPhase>("home");
  const [session, setSession] = useState<BombSession | null>(null);
  const [players, setPlayers] = useState<BombPlayer[]>([]);
  const [bombHolderId, setBombHolderId] = useState<string>("");
  const [action, setAction] = useState<BombAction>({ type: "tap", required: 12 });
  const [gamePhase, setGamePhase] = useState<"playing" | "exploded">("playing");
  const [loserId, setLoserId] = useState<string | null>(null);
  const [loserName, setLoserName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [timerMs, setTimerMs] = useState(90000);
  const [gameStartTime, setGameStartTime] = useState(0);
  const [watchProgress, setWatchProgress] = useState<InputProgress | null>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on("bomb:lobby-update", (data: { players: BombPlayer[]; adminId: string }) => {
      setPlayers(data.players);
    });

    socket.on("bomb:game-started", (data: { bombHolderId: string; action: BombAction; players: BombPlayer[]; timerMs: number }) => {
      setPlayers(data.players);
      setBombHolderId(data.bombHolderId);
      setAction(data.action);
      setTimerMs(data.timerMs);
      setGameStartTime(Date.now());
      setGamePhase("playing");
      setLoserId(null);
      setLoserName(null);
      setWatchProgress(null);
      setPhase("game");
    });

    socket.on("bomb:passed", (data: { newHolderId: string; newHolderName: string; newAction: BombAction }) => {
      setBombHolderId(data.newHolderId);
      setAction(data.newAction);
      setWatchProgress(null);
    });

    socket.on("bomb:explode", (data: { loserId: string; loserName: string; players: BombPlayer[] }) => {
      setPlayers(data.players);
      setLoserId(data.loserId);
      setLoserName(data.loserName);
      setGamePhase("exploded");
    });

    socket.on("bomb:error", (data: { message: string }) => {
      setErrorMsg(data.message);
    });

    socket.on("bomb:room-closed", () => {
      alert("Host left. Room closed.");
      setPhase("home");
      setSession(null);
    });

    socket.on("bomb:progress-update", (progress: InputProgress) => {
      setWatchProgress(progress);
    });

    return () => {
      ["bomb:lobby-update","bomb:game-started","bomb:passed","bomb:explode",
       "bomb:error","bomb:room-closed","bomb:progress-update"]
        .forEach(e => socket.off(e));
    };
  }, []);

  const handleJoined = (code: string, playerId: string, _name: string, isAdmin: boolean) => {
    setSession({ code, playerId, isAdmin });
    setPhase("lobby");
  };

  const startGame = () => {
    if (!session) return;
    getSocket().emit("bomb:start-game", { code: session.code });
  };

  const completeAction = () => {
    if (!session) return;
    getSocket().emit("bomb:complete-action", { code: session.code });
  };

  const playAgain = () => {
    if (!session) return;
    getSocket().emit("bomb:play-again", { code: session.code });
    setGamePhase("playing");
  };

  const handleProgress = useCallback((progress: InputProgress) => {
    if (!session) return;
    getSocket().emit("bomb:input-progress", { code: session.code, progress });
  }, [session]);

  if (phase === "game" && session) {
    return (
      <BombGame
        playerId={session.playerId}
        isAdmin={session.isAdmin}
        players={players}
        bombHolderId={bombHolderId}
        action={action}
        gamePhase={gamePhase}
        loserId={loserId}
        loserName={loserName}
        timerMs={timerMs}
        gameStartTime={gameStartTime}
        onCompleteAction={completeAction}
        onPlayAgain={playAgain}
        onProgress={handleProgress}
        watchProgress={watchProgress}
      />
    );
  }

  if (phase === "lobby" && session) {
    return (
      <BombLobby
        code={session.code}
        playerId={session.playerId}
        isAdmin={session.isAdmin}
        players={players}
        errorMsg={errorMsg}
        onStartGame={startGame}
        onBack={() => { setPhase("home"); setSession(null); }}
      />
    );
  }

  return <BombHome onBack={onBack} onJoined={handleJoined} />;
}
