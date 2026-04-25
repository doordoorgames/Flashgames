import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Router as WouterRouter } from "wouter";
import Home from "@/pages/Home";
import CreateRoom from "@/pages/CreateRoom";
import JoinRoom from "@/pages/JoinRoom";
import Lobby from "@/pages/Lobby";
import GameView from "@/pages/GameView";
import AdminPage from "@/pages/AdminPage";
import { getSocket } from "@/lib/socket";
import type { Player } from "@/lib/types";

const queryClient = new QueryClient();

type AppPhase = "home" | "create" | "join" | "lobby" | "game";

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
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    const socket = getSocket();

    socket.on("lobby-update", (data: { players: Player[]; adminId: string; itemCount: number }) => {
      setLobbyPlayers(data.players);
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

  const handleStartGame = () => {
    if (!session) return;
    getSocket().emit("start-game", { code: session.code });
  };

  return (
    <div className="app-root">
      {phase === "home" && (
        <Home
          onCreateGame={() => setPhase("create")}
          onJoinGame={() => setPhase("join")}
        />
      )}
      {phase === "create" && (
        <CreateRoom
          onBack={() => setPhase("home")}
          onRoomCreated={(code, playerId, name) => handleJoined(code, playerId, name, true)}
        />
      )}
      {phase === "join" && (
        <JoinRoom
          onBack={() => setPhase("home")}
          onJoined={(code, playerId, name) => handleJoined(code, playerId, name, false)}
        />
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
      <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""}>
        <Switch>
          <Route path="/admin" component={AdminPage} />
          <Route>
            <FlashApp />
          </Route>
        </Switch>
      </WouterRouter>
    </QueryClientProvider>
  );
}
