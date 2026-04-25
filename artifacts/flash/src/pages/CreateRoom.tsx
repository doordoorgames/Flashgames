import { useState } from "react";
import { getSocket } from "@/lib/socket";

interface CreateRoomProps {
  onBack: () => void;
  onRoomCreated: (code: string, playerId: string, name: string) => void;
}

export default function CreateRoom({ onBack, onRoomCreated }: CreateRoomProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = () => {
    if (!name.trim()) { setError("Enter your name"); return; }
    setLoading(true);
    const socket = getSocket();
    socket.emit("create-room", { playerName: name.trim() }, (res: { code: string; playerId: string; error?: string }) => {
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else {
        onRoomCreated(res.code, res.playerId, name.trim());
      }
    });
  };

  return (
    <div className="entry-screen">
      <div className="entry-card">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h2 className="entry-title">Create Game</h2>
        <p className="entry-sub">You'll be the host. Players join with your room code.</p>

        <div className="entry-fields">
          <input
            className="entry-input"
            placeholder="Your name (host)"
            value={name}
            maxLength={20}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          />
          {error && (
            <div className="entry-error-box">
              <p className="entry-error">{error}</p>
              {error.includes("admin") && (
                <p className="entry-error-hint">
                  Go to <a href="/admin" className="admin-link">/admin</a> to upload game content first.
                </p>
              )}
            </div>
          )}
          <button
            className="entry-btn"
            onClick={handleCreate}
            disabled={loading || !name.trim()}
          >
            {loading ? "Creating..." : "Create Room"}
          </button>
        </div>

        <p className="entry-note">
          Game content is managed at <a href="/admin" className="admin-link">/admin</a>
        </p>
      </div>
    </div>
  );
}
