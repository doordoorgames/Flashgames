import { useState } from "react";
import { getSocket } from "@/lib/socket";
import type { GameItem } from "@/lib/types";

interface HomeProps {
  onAdminSetup: () => void;
  onJoined: (code: string, playerId: string, name: string, isAdmin: boolean) => void;
}

export default function Home({ onAdminSetup, onJoined }: HomeProps) {
  const [tab, setTab] = useState<"join" | "admin">("join");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");

  const handleJoin = () => {
    if (!playerName.trim()) { setError("Enter your name"); return; }
    if (!roomCode.trim() || roomCode.length !== 5) { setError("Enter valid 5-digit code"); return; }
    const socket = getSocket();
    socket.emit("join-room", { code: roomCode, playerName: playerName.trim() }, (res: { success: boolean; error?: string; playerId?: string }) => {
      if (!res.success) {
        setError(res.error || "Failed to join");
      } else {
        onJoined(roomCode, res.playerId!, playerName.trim(), false);
      }
    });
  };

  return (
    <div className="home-screen">
      <div className="home-card">
        <h1 className="game-title">
          <span className="title-en">Flash</span>
          <span className="title-divider">/</span>
          <span className="title-ar">لمحة</span>
        </h1>
        <p className="game-subtitle">The ultimate memory flash game</p>

        <div className="tab-row">
          <button
            className={`tab-btn ${tab === "join" ? "active" : ""}`}
            onClick={() => setTab("join")}
          >
            Join Game
          </button>
          <button
            className={`tab-btn ${tab === "admin" ? "active" : ""}`}
            onClick={() => setTab("admin")}
          >
            Host Game
          </button>
        </div>

        {tab === "join" && (
          <div className="form-group">
            <input
              className="game-input"
              placeholder="Your name"
              value={playerName}
              onChange={(e) => { setPlayerName(e.target.value); setError(""); }}
              maxLength={20}
            />
            <input
              className="game-input code-input"
              placeholder="5-digit room code"
              value={roomCode}
              onChange={(e) => { setRoomCode(e.target.value.replace(/\D/g, "").slice(0, 5)); setError(""); }}
              maxLength={5}
            />
            {error && <p className="error-msg">{error}</p>}
            <button className="btn-primary" onClick={handleJoin}>
              Join Room
            </button>
          </div>
        )}

        {tab === "admin" && (
          <div className="form-group">
            <p className="admin-hint">As host, you'll upload content and manage the game</p>
            <button className="btn-primary" onClick={onAdminSetup}>
              Setup & Host Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
