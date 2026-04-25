import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "@/pages/Home";
import AdminSetup from "@/pages/AdminSetup";
import Lobby from "@/pages/Lobby";
import GameView from "@/pages/GameView";
import { getSocket } from "@/lib/socket";
import type { Player } from "@/lib/types";

const queryClient = new QueryClient();

type AppPhase = "home" | "admin-setup" | "lobby" | "game";

interface GameSession {
  code: string;
  playerId: string;
  playerName: string;
  isAdmin: boolean;
}

function FlashApp() {
  const [phase, setPhase] = useState<AppPhase>("home");
  const [session, setSession] = useState<GameSession | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<Player[]>([]);
  const [lobbyAdminId, setLobbyAdminId] = useState("");
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    const socket = getSocket();

    socket.on("lobby-update", (data: { players: Player[]; adminId: string; itemCount: number }) => {
      setLobbyPlayers(data.players);
      setLobbyAdminId(data.adminId);
      setItemCount(data.itemCount);
    });

    socket.on("room-closed", () => {
      alert("The host has left. Room closed.");
      setPhase("home");
      setSession(null);
    });

    socket.on("round-start", () => {
      setPhase("game");
    });

    return () => {
      socket.off("lobby-update");
      socket.off("room-closed");
      socket.off("round-start");
    };
  }, []);

  const handleJoined = (code: string, playerId: string, name: string, isAdmin: boolean) => {
    setSession({ code, playerId, playerName: name, isAdmin });
    setPhase("lobby");
  };

  const handleRoomCreated = (code: string, playerId: string, name: string) => {
    setSession({ code, playerId, playerName: name, isAdmin: true });
    setPhase("lobby");
  };

  const handleStartGame = () => {
    if (!session) return;
    const socket = getSocket();
    socket.emit("start-game", { code: session.code });
  };

  return (
    <div className="app-root">
      {phase === "home" && (
        <Home
          onAdminSetup={() => setPhase("admin-setup")}
          onJoined={handleJoined}
        />
      )}
      {phase === "admin-setup" && (
        <AdminSetup onRoomCreated={handleRoomCreated} />
      )}
      {phase === "lobby" && session && (
        <Lobby
          code={session.code}
          players={lobbyPlayers}
          isAdmin={session.isAdmin}
          playerId={session.playerId}
          itemCount={itemCount}
          onStartGame={handleStartGame}
        />
      )}
      {phase === "game" && session && (
        <GameView
          code={session.code}
          playerId={session.playerId}
          isAdmin={session.isAdmin}
          playerName={session.playerName}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FlashApp />
    </QueryClientProvider>
  );
}
