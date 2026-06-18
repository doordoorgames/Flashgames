import { useState } from "react";
import { getSocket } from "@/lib/socket";

interface Props {
  initialCode?: string;
  onCreated: (code: string, playerId: string, name: string) => void;
  onJoined:  (code: string, playerId: string, name: string) => void;
  onBack?: () => void;
}

type AckRes = { success: boolean; code?: string; playerId?: string; error?: string };

export default function NawasitHome({ initialCode = "", onCreated, onJoined, onBack }: Props) {
  const [view,    setView]    = useState<"main" | "create" | "join">(initialCode ? "join" : "main");
  const [name,    setName]    = useState("");
  const [code,    setCode]    = useState(initialCode);
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = () => {
    const n = name.trim();
    if (!n) { setErr("Enter your name first."); return; }
    setLoading(true); setErr("");
    getSocket().timeout(8000).emit(
      "nws:create-room", { playerName: n },
      (timeoutErr: Error | null, res: AckRes) => {
        setLoading(false);
        if (timeoutErr) { setErr("Connection timed out. Try again."); return; }
        if (!res.success) { setErr(res.error ?? "Could not create room."); return; }
        onCreated(res.code!, res.playerId!, n);
      },
    );
  };

  const handleJoin = () => {
    const n = name.trim();
    const c = code.replace(/\D/g, "").slice(0, 5);
    if (!n) { setErr("Enter your name first."); return; }
    if (c.length !== 5) { setErr("Enter a valid 5-digit room code."); return; }
    setLoading(true); setErr("");
    getSocket().timeout(8000).emit(
      "nws:join-room", { code: c, playerName: n },
      (timeoutErr: Error | null, res: AckRes) => {
        setLoading(false);
        if (timeoutErr) { setErr("Connection timed out. Try again."); return; }
        if (!res.success) { setErr(res.error ?? "Could not join room."); return; }
        onJoined(res.code!, res.playerId!, n);
      },
    );
  };

  return (
    <div className="nws-home">
      <div className="nws-home-content">
        {onBack && (
          <button className="nawafeth-back-btn" onClick={onBack}>
            ← Back to Dordor.games
          </button>
        )}

        <div className="nws-title-wrap">
          <div className="nws-title-icon">🕵️</div>
          <h1 className="nws-title">Nawasit</h1>
          <p className="nws-title-ar">نواصيت</p>
          <p className="nws-subtitle">1v1 · Thief vs Catcher · 5×9 grid</p>
        </div>

        {view === "main" && (
          <div className="nawafeth-form">
            <input
              className="nawafeth-input"
              placeholder="Your name / اسمك"
              value={name}
              maxLength={20}
              autoFocus
              onChange={(e) => { setName(e.target.value); setErr(""); }}
            />
            {err && <p className="nawafeth-err">{err}</p>}
            <div className="nawafeth-btns">
              <button
                className="nawafeth-btn nawafeth-btn-join"
                onClick={() => {
                  if (!name.trim()) { setErr("Enter your name first."); return; }
                  setErr(""); setView("join");
                }}
              >
                <span className="nawafeth-btn-tag">JOIN</span>
                <span className="nawafeth-btn-label">Join Game</span>
                <span className="nawafeth-btn-arrow">→</span>
              </button>
              <button
                className="nawafeth-btn nawafeth-btn-create"
                onClick={() => {
                  if (!name.trim()) { setErr("Enter your name first."); return; }
                  setErr(""); setView("create");
                }}
              >
                <span className="nawafeth-btn-tag">HOST</span>
                <span className="nawafeth-btn-label">Create Game</span>
                <span className="nawafeth-btn-arrow">→</span>
              </button>
            </div>
          </div>
        )}

        {view === "create" && (
          <div className="nawafeth-form">
            <p className="nawafeth-field-label">Playing as</p>
            <input
              className="nawafeth-input"
              placeholder="Your name"
              value={name}
              maxLength={20}
              autoFocus
              onChange={(e) => { setName(e.target.value); setErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            {err && <p className="nawafeth-err">{err}</p>}
            <button className="nawafeth-btn nawafeth-btn-create" onClick={handleCreate} disabled={loading}>
              <span className="nawafeth-btn-label">{loading ? "Creating…" : "Create Room"}</span>
              <span className="nawafeth-btn-arrow">→</span>
            </button>
            <button className="nawafeth-back-btn" onClick={() => { setView("main"); setErr(""); }}>← Back</button>
          </div>
        )}

        {view === "join" && (
          <div className="nawafeth-form">
            <p className="nawafeth-field-label">Playing as</p>
            <input
              className="nawafeth-input"
              placeholder="Your name"
              value={name}
              maxLength={20}
              onChange={(e) => { setName(e.target.value); setErr(""); }}
            />
            <p className="nawafeth-field-label" style={{ marginTop: 14 }}>Room code</p>
            <input
              className="nawafeth-input nawafeth-input-code"
              placeholder="12345"
              value={code}
              maxLength={5}
              inputMode="numeric"
              autoFocus={!initialCode}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 5)); setErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
            {err && <p className="nawafeth-err">{err}</p>}
            <button
              className="nawafeth-btn nawafeth-btn-join"
              onClick={handleJoin}
              disabled={loading || code.length !== 5 || !name.trim()}
            >
              <span className="nawafeth-btn-label">{loading ? "Joining…" : "Join Room"}</span>
              <span className="nawafeth-btn-arrow">→</span>
            </button>
            <button className="nawafeth-back-btn" onClick={() => { setView("main"); setErr(""); }}>← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}
