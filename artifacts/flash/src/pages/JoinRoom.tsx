import { useState } from "react";
import { getSocket } from "@/lib/socket";

interface JoinRoomProps {
  onBack: () => void;
  onJoined: (code: string, playerId: string, name: string) => void;
}

export default function JoinRoom({ onBack, onJoined }: JoinRoomProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = () => {
    if (!name.trim()) { setError("Enter your name"); return; }
    if (code.trim().length !== 5) { setError("Enter the 5-digit room code"); return; }
    setLoading(true);
    setError("");
    const socket = getSocket();
    socket.timeout(8000).emit("join-room", { code: code.trim(), playerName: name.trim() }, (err: Error | null, res: { success: boolean; error?: string; playerId?: string }) => {
      setLoading(false);
      if (err) { setError("Connection timed out. Check your internet and try again."); return; }
      if (!res.success) { setError(res.error || "Room not found. Double-check the code."); return; }
      onJoined(code.trim(), res.playerId!, name.trim());
    });
  };

  return (
    <div className="entry-screen">
      <div className="entry-card">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2 className="entry-title">Join Game</h2>
        <p className="entry-sub">Enter the room code from your host</p>

        <div className="entry-fields">
          <input
            className="entry-input"
            placeholder="Your name"
            value={name}
            maxLength={20}
            onChange={(e) => { setName(e.target.value); setError(""); }}
          />
          <input
            className="entry-input entry-code"
            placeholder="Room code"
            value={code}
            maxLength={5}
            inputMode="numeric"
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 5)); setError(""); }}
          />
          {error && <p className="entry-error">{error}</p>}
          <button
            className="entry-btn"
            onClick={handleJoin}
            disabled={loading || !name.trim() || code.length !== 5}
          >
            {loading ? "Joining..." : "Join Room"}
          </button>
        </div>
      </div>
    </div>
  );
}
