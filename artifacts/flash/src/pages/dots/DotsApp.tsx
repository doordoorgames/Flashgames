import { useState, useEffect } from "react";
import { getSocket } from "@/lib/socket";
import DotsHome from "./DotsHome";
import DotsLobby from "./DotsLobby";
import DotsGame from "./DotsGame";
import SwitchSides from "./SwitchSides";
import DotsResults from "./DotsResults";

type DotsPhase = "home" | "lobby" | "game" | "switch" | "results";

interface DotsSession {
  code: string;
  playerId: string;
  playerName: string;
  isAdmin: boolean;
}

interface DotsLobbyPlayer {
  id: string;
  name: string;
  isAdmin: boolean;
}

interface RoundData {
  role: "thief" | "catcher";
  thiefPos?: { x: number; y: number };
  cellColors: string[];
  roundEndTime: number;
  round: 1 | 2;
  playerNames: Record<string, string>;
  thiefId: string;
  catcherId: string;
}

interface SwitchData {
  round1Score: number;
  round1ThiefId: string;
}

interface GameResult {
  round1ThiefId: string;
  round1ThiefName: string;
  round1Score: number;
  round2ThiefId: string;
  round2ThiefName: string;
  round2Score: number;
  winnerId: string | null;
  winnerName: string | null;
  caught: boolean;
  thiefPos: { x: number; y: number };
}

interface Props { onBack: () => void }

export default function DotsApp({ onBack }: Props) {
  const [initialCode] = useState(() =>
    new URLSearchParams(window.location.search).get("room")?.replace(/\D/g, "").slice(0, 5) ?? ""
  );
  const [phase, setPhase] = useState<DotsPhase>("home");
  const [session, setSession] = useState<DotsSession | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<DotsLobbyPlayer[]>([]);
  const [roundData, setRoundData] = useState<RoundData | null>(null);
  const [switchData, setSwitchData] = useState<SwitchData | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on("dots:lobby-update", (data: { players: DotsLobbyPlayer[]; adminId: string }) => {
      setLobbyPlayers(data.players);
    });

    socket.on("dots:room-closed", () => {
      alert("The other player left. Game ended.");
      setPhase("home");
      setSession(null);
    });

    socket.on("dots:round-started", (data: RoundData) => {
      setRoundData(data);
      setPhase("game");
    });

    socket.on("dots:switch-sides", (data: SwitchData) => {
      setSwitchData(data);
      setPhase("switch");
    });

    socket.on("dots:game-over", (data: GameResult) => {
      setGameResult(data);
      setPhase("results");
    });

    socket.on("dots:rematch-ready", () => {
      setRoundData(null);
      setSwitchData(null);
      setGameResult(null);
      setPhase("lobby");
    });

    return () => {
      socket.off("dots:lobby-update");
      socket.off("dots:room-closed");
      socket.off("dots:round-started");
      socket.off("dots:switch-sides");
      socket.off("dots:game-over");
      socket.off("dots:rematch-ready");
    };
  }, []);

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
    getSocket().emit("dots:start-game", { code: session.code });
  };

  const handleSwitchAck = () => {
    if (!session) return;
    getSocket().emit("dots:switch-ack", { code: session.code });
  };

  const handleRematch = () => {
    if (!session) return;
    getSocket().emit("dots:rematch", { code: session.code });
  };

  const handleBackToHome = () => {
    setPhase("home");
    setSession(null);
    setRoundData(null);
    setSwitchData(null);
    setGameResult(null);
    setLobbyPlayers([]);
  };

  if (phase === "home") {
    return (
      <DotsHome
        initialCode={initialCode}
        onCreated={handleCreated}
        onJoined={handleJoined}
        onBack={onBack}
      />
    );
  }

  if (phase === "lobby" && session) {
    return (
      <DotsLobby
        code={session.code}
        playerId={session.playerId}
        isAdmin={session.isAdmin}
        players={lobbyPlayers}
        onStartGame={handleStartGame}
        onBack={handleBackToHome}
      />
    );
  }

  if (phase === "game" && session && roundData) {
    return (
      <DotsGame
        key={roundData.round}
        code={session.code}
        playerId={session.playerId}
        role={roundData.role}
        cellColors={roundData.cellColors}
        initialThiefPos={roundData.thiefPos}
        roundEndTime={roundData.roundEndTime}
        round={roundData.round}
        thiefId={roundData.thiefId}
        catcherId={roundData.catcherId}
        playerNames={roundData.playerNames}
      />
    );
  }

  if (phase === "switch" && switchData && roundData) {
    return (
      <SwitchSides
        round1Score={switchData.round1Score}
        round1ThiefId={switchData.round1ThiefId}
        playerNames={roundData.playerNames}
        onAcknowledge={handleSwitchAck}
      />
    );
  }

  if (phase === "results" && session && gameResult && roundData) {
    return (
      <DotsResults
        {...gameResult}
        playerId={session.playerId}
        isAdmin={session.isAdmin}
        onRematch={handleRematch}
        onBack={handleBackToHome}
      />
    );
  }

  return null;
}
