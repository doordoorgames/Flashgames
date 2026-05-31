import { useState } from "react";
import { getSocket } from "@/lib/socket";

interface Props {
  onBack: () => void;
  onJoined: (code: string, playerId: string, name: string, isAdmin: boolean) => void;
  initialCode?: string;
}

type SubPhase = "choose" | "create" | "join";

export default function BombHome({ onBack, onJoined, initialCode = "" }: Props) {
  const [sub, setSub] = useState<SubPhase>(initialCode ? "join" : "choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = () => {
    if (!name.trim()) { setError("Enter your name"); return; }
    setLoading(true);
    setError("");
    const socket = getSocket();
    socket.timeout(8000).emit("bomb:create-room", { playerName: name.trim() }, (err: Error | null, res: { code: string; playerId: string }) => {
      setLoading(false);
      if (err) { setError("Connection timed out. Check your internet and try again."); return; }
      onJoined(res.code, res.playerId, name.trim(), true);
    });
  };

  const handleJoin = () => {
    if (!name.trim()) { setError("Enter your name"); return; }
    if (code.trim().length !== 5) { setError("Enter the 5-digit room code"); return; }
    setLoading(true);
    setError("");
    const socket = getSocket();
    socket.timeout(8000).emit("bomb:join-room", { code: code.trim(), playerName: name.trim() }, (err: Error | null, res: { success: boolean; playerId?: string; error?: string }) => {
      setLoading(false);
      if (err) { setError("Connection timed out. Check your internet and try again."); return; }
      if (!res.success) { setError(res.error || "Room not found. Double-check the code."); return; }
      onJoined(code.trim(), res.playerId!, name.trim(), false);
    });
  };

  return (
    <div className="bomb-crt-device">
      <div className="screen-safe-area">
        <div className="bomb-screen-content bomb-screen-centered">
          <div className="bomb-entry-card">
            <button className="back-btn" onClick={sub === "choose" ? onBack : () => { setSub("choose"); setError(""); }}>← Back</button>

            {sub === "choose" && (
              <>
                <div className="bomb-entry-header">
                  <span className="bomb-entry-icon">◉</span>
                  <span className="bomb-entry-title">The Bomb</span>
                  <p className="bomb-entry-desc">Pass the bomb before it explodes! Complete the challenge fast or you're holding it when time runs out.</p>
                </div>
                <div className="bomb-entry-btns">
                  <button className="bomb-choice-btn" onClick={() => setSub("join")}>&gt; Join Room</button>
                  <button className="bomb-choice-btn bomb-choice-primary" onClick={() => setSub("create")}>&gt; Create Room</button>
                </div>
              </>
            )}

            {(sub === "create" || sub === "join") && (
              <>
                <h2 className="bomb-entry-title">{sub === "create" ? "Create Room" : "Join Room"}</h2>
                <div className="entry-fields">
                  <input
                    className="bomb-input"
                    placeholder="Your name"
                    value={name}
                    maxLength={20}
                    onChange={e => { setName(e.target.value); setError(""); }}
                    onKeyDown={e => { if (e.key === "Enter" && sub === "create") handleCreate(); }}
                  />
                  {sub === "join" && (
                    <input
                      className="bomb-input bomb-code-input"
                      placeholder="5-digit room code"
                      value={code}
                      maxLength={5}
                      inputMode="numeric"
                      onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 5)); setError(""); }}
                      onKeyDown={e => { if (e.key === "Enter") handleJoin(); }}
                    />
                  )}
                  {error && <p className="entry-error">{error}</p>}
                  <button className="bomb-submit-btn" onClick={sub === "create" ? handleCreate : handleJoin} disabled={loading}>
                    {loading ? "..." : sub === "create" ? "Create Room" : "Join Room"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
