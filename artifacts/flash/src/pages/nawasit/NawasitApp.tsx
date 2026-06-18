import { useState, useEffect } from "react";
import { getSocket } from "@/lib/socket";
import NawasitHome from "./NawasitHome";
import NawasitLobby from "./NawasitLobby";
import NawasitGame from "./NawasitGame";
import NawasitResults from "./NawasitResults";

type Phase = "home" | "lobby" | "game" | "gameover";

interface Pos { x: number; y: number }

interface Session {
  code: string;
  playerId: string;
  playerName: string;
  isAdmin: boolean;
}

interface LobbyPlayer { id: string; name: string; isAdmin: boolean }

interface GameState {
  role: "thief" | "catcher";
  thiefPos?: Pos;
  catcherPos: Pos;
  jewelPos?: Pos;
  currentTurn: "thief" | "catcher";
  catcherTimerEnd: number;
  playerNames: Record<string, string>;
  thiefId: string;
  catcherId: string;
}

interface GameResult {
  winner: "thief" | "catcher";
  reason: string;
  thiefPos: Pos;
  catcherPos: Pos;
  jewelPos: Pos;
  thiefName: string;
  catcherName: string;
}

interface Props { onBack: () => void }

export default function NawasitApp({ onBack }: Props) {
  const [initialCode] = useState(() =>
    new URLSearchParams(window.location.search).get("room")?.replace(/\D/g, "").slice(0, 5) ?? ""
  );
  const [phase,        setPhase]        = useState<Phase>("home");
  const [session,      setSession]      = useState<Session | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [gameState,    setGameState]    = useState<GameState | null>(null);
  const [gameResult,   setGameResult]   = useState<GameResult | null>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on("nws:lobby-update", (data: { players: LobbyPlayer[]; adminId: string }) => {
      setLobbyPlayers(data.players);
    });

    socket.on("nws:room-closed", () => {
      alert("The other player left. Game ended.");
      setPhase("home");
      setSession(null);
    });

    socket.on("nws:game-started", () => {
      setGameResult(null);
    });

    socket.on("nws:state", (data: GameState) => {
      setGameState(data);
      if (phase !== "game") setPhase("game");
    });

    socket.on("nws:game-over", (data: GameResult) => {
      setGameResult(data);
      setPhase("gameover");
    });

    return () => {
      socket.off("nws:lobby-update");
      socket.off("nws:room-closed");
      socket.off("nws:game-started");
      socket.off("nws:state");
      socket.off("nws:game-over");
    };
  }, [phase]);

  const handleCreated = (code: string, playerId: string, name: string) => {
    setSession({ code, playerId, playerName: name, isAdmin: true });
    setPhase("lobby");
  };

  const handleJoined = (code: string, playerId: string, name: string) => {
    setSession({ code, playerId, playerName: name, isAdmin: false });
    setPhase("lobby");
  };

  const handleStartGame = () => {
    if (!session) return;
    getSocket().emit("nws:start-game", { code: session.code });
  };

  const handleRematch = () => {
    if (!session) return;
    getSocket().emit("nws:rematch", { code: session.code });
  };

  const handleBack = () => {
    setPhase("home");
    setSession(null);
    setGameState(null);
    setGameResult(null);
    setLobbyPlayers([]);
  };

  if (phase === "home") {
    return (
      <NawasitHome
        initialCode={initialCode}
        onCreated={handleCreated}
        onJoined={handleJoined}
        onBack={onBack}
      />
    );
  }

  if (phase === "lobby" && session) {
    return (
      <NawasitLobby
        code={session.code}
        playerId={session.playerId}
        isAdmin={session.isAdmin}
        players={lobbyPlayers}
        onStartGame={handleStartGame}
        onBack={handleBack}
      />
    );
  }

  if ((phase === "game" || phase === "lobby") && session && gameState) {
    return (
      <NawasitGame
        key={`${gameState.thiefId}-${gameState.catcherId}`}
        code={session.code}
        playerId={session.playerId}
        role={gameState.role}
        thiefId={gameState.thiefId}
        catcherId={gameState.catcherId}
        playerNames={gameState.playerNames}
        initialState={gameState}
      />
    );
  }

  if (phase === "gameover" && session && gameResult && gameState) {
    return (
      <NawasitResults
        {...gameResult}
        playerId={session.playerId}
        thiefId={gameState.thiefId}
        catcherId={gameState.catcherId}
        isAdmin={session.isAdmin}
        onRematch={handleRematch}
        onBack={handleBack}
      />
    );
  }

  return null;
}
