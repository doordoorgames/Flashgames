import { useState } from "react";
import { getSocket } from "@/lib/socket";

interface Props {
  onBack: () => void;
  onJoined: (code: string, playerId: string, name: string, isAdmin: boolean) => void;
}

type SubPhase = "choose" | "create" | "join";

export default function YesNoHome({ onBack, onJoined }: Props) {
  const [sub, setSub] = useState<SubPhase>("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = () => {
    if (!name.trim()) { setError("Enter your name"); return; }
    setLoading(true);
    setError("");
    getSocket().timeout(8000).emit("yn:create-room", { playerName: name.trim() }, (err: Error | null, res: { code: string; playerId: string; error?: string }) => {
      setLoading(false);
      if (err) { setError("Connection timed out. Check your internet and try again."); return; }
      if (res.error) { setError(res.error); return; }
      onJoined(res.code, res.playerId, name.trim(), true);
    });
  };

  const handleJoin = () => {
    if (!name.trim()) { setError("Enter your name"); return; }
    if (code.trim().length !== 5) { setError("Enter the 5-digit room code"); return; }
    setLoading(true);
    setError("");
    getSocket().timeout(8000).emit("yn:join-room", { code: code.trim(), playerName: name.trim() }, (err: Error | null, res: { success: boolean; playerId?: string; error?: string }) => {
      setLoading(false);
      if (err) { setError("Connection timed out. Check your internet and try again."); return; }
      if (!res.success) { setError(res.error || "Room not found. Double-check the code."); return; }
      onJoined(code.trim(), res.playerId!, name.trim(), false);
    });
  };

  return (
    <div className="yn-entry-screen">
      <div className="yn-entry-card">
        <button className="back-btn" onClick={sub === "choose" ? onBack : () => { setSub("choose"); setError(""); }}>← Back</button>

        {sub === "choose" && (
          <>
            <div className="yn-entry-header">
              <span className="yn-entry-title">Yes / No</span>
              <span className="yn-entry-subtitle">نعم / لا</span>
              <p className="yn-entry-desc">Answer questions without saying "yes" or "no". 10 questions to score a point.</p>
            </div>
            <div className="yn-entry-btns">
              <button className="yn-choice-btn" onClick={() => setSub("join")}>🎮 Join Room</button>
              <button className="yn-choice-btn yn-choice-primary" onClick={() => setSub("create")}>🎯 Create Room</button>
            </div>
          </>
        )}

        {(sub === "create" || sub === "join") && (
          <>
            <h2 className="yn-entry-title">{sub === "create" ? "Create Room" : "Join Room"}</h2>
            <div className="entry-fields">
              <input
                className="yn-input"
                placeholder="Your name"
                value={name}
                maxLength={20}
                onChange={e => { setName(e.target.value); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter" && sub === "create") handleCreate(); }}
              />
              {sub === "join" && (
                <input
                  className="yn-input yn-code-input"
                  placeholder="Room code"
                  value={code}
                  maxLength={5}
                  inputMode="numeric"
                  onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 5)); setError(""); }}
                />
              )}
              {error && <p className="entry-error">{error}</p>}
              <button
                className="yn-submit-btn"
                onClick={sub === "create" ? handleCreate : handleJoin}
                disabled={loading}
              >
                {loading ? "..." : sub === "create" ? "Create Room" : "Join Room"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
