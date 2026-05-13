import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Router as WouterRouter } from "wouter";
import ModeSelect from "@/pages/ModeSelect";
import Home from "@/pages/Home";
import CreateRoom from "@/pages/CreateRoom";
import JoinRoom from "@/pages/JoinRoom";
import Lobby from "@/pages/Lobby";
import GameView from "@/pages/GameView";
import AdminPage from "@/pages/AdminPage";
import YesNoApp from "@/pages/yesno/YesNoApp";
import BombApp from "@/pages/bomb/BombApp";
import Bomb2App from "@/pages/bomb2/Bomb2App";
import { getSocket } from "@/lib/socket";
import type { Player } from "@/lib/types";

const queryClient = new QueryClient();

type AppMode = "select" | "flash" | "yesno" | "bomb" | "bomb2";
type FlashPhase = "home" | "create" | "join" | "lobby" | "game";

interface GameSession {
  code: string;
  playerId: string;
  playerName: string;
  isAdmin: boolean;
}

function FlashApp({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<FlashPhase>("home");
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
    socket.on("round-start", () => setPhase("game"));
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

  if (phase === "home") return <Home onCreateGame={() => setPhase("create")} onJoinGame={() => setPhase("join")} onBack={onBack} />;
  if (phase === "create") return <CreateRoom onBack={() => setPhase("home")} onRoomCreated={(code, playerId, name) => handleJoined(code, playerId, name, true)} />;
  if (phase === "join") return <JoinRoom onBack={() => setPhase("home")} onJoined={(code, playerId, name) => handleJoined(code, playerId, name, false)} />;
  if (phase === "lobby" && session) return <Lobby code={session.code} players={lobbyPlayers} isAdmin={session.isAdmin} playerId={session.playerId} itemCount={itemCount} onStartGame={handleStartGame} />;
  if (phase === "game" && session) return <GameView code={session.code} playerId={session.playerId} isAdmin={session.isAdmin} playerName={session.playerName} />;
  return null;
}

function MainApp() {
  const [mode, setMode] = useState<AppMode>("select");

  return (
    <div className="app-root">
      {mode === "select" && <ModeSelect onSelectFlash={() => setMode("flash")} onSelectYesNo={() => setMode("yesno")} onSelectBomb={() => setMode("bomb")} onSelectBomb2={() => setMode("bomb2")} />}
      {mode === "flash" && <FlashApp onBack={() => setMode("select")} />}
      {mode === "yesno" && <YesNoApp onBack={() => setMode("select")} />}
      {mode === "bomb" && <BombApp onBack={() => setMode("select")} />}
      {mode === "bomb2" && <Bomb2App onBack={() => setMode("select")} />}
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
            <MainApp />
          </Route>
        </Switch>
      </WouterRouter>
    </QueryClientProvider>
  );
}
