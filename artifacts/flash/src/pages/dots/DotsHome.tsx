import { useState, useRef } from "react";
import { getSocket } from "@/lib/socket";
import litBuilding from "@assets/8FB02617-28A8-4F70-9E10-F24EE18E0E04_1780489207343.png";
import nawafethLogo from "@assets/726E20E0-2EB9-4A9A-8E8C-FD46A4093A1E_1780495624232.png";

interface Props {
  initialCode?: string;
  onCreated: (code: string, playerId: string, name: string) => void;
  onJoined:  (code: string, playerId: string, name: string) => void;
  onBack?: () => void;
}

type AckRes = { success: boolean; code?: string; playerId?: string; error?: string };

export default function DotsHome({ initialCode = "", onCreated, onJoined, onBack }: Props) {
  const [view,    setView]    = useState<"main" | "create" | "join">(initialCode ? "join" : "main");
  const [name,    setName]    = useState("");
  const [code,    setCode]    = useState(initialCode);
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const handleCreate = () => {
    const n = name.trim();
    if (!n) { setErr("Enter your name first."); return; }
    setLoading(true); setErr("");
    getSocket().timeout(8000).emit(
      "dots:create-room", { playerName: n },
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
      "dots:join-room", { code: c, playerName: n },
      (timeoutErr: Error | null, res: AckRes) => {
        setLoading(false);
        if (timeoutErr) { setErr("Connection timed out. Try again."); return; }
        if (!res.success) { setErr(res.error ?? "Could not join room."); return; }
        onJoined(res.code!, res.playerId!, n);
      },
    );
  };

  return (
    <div className="nawafeth-home">
      {/* Blurred building background */}
      <div className="nawafeth-bg" style={{ backgroundImage: `url(${litBuilding})` }} />

      {/* Content */}
      <div className="nawafeth-content">
        {onBack && (
          <button className="nawafeth-back-btn" onClick={onBack}>
            ← Back to Dordor.games
          </button>
        )}

        {/* Title */}
        <div className="nawafeth-title-wrap">
          <img src={nawafethLogo} alt="نوافذ" className="nawafeth-logo" />
          <p className="nawafeth-subtitle">NAWAFETH · 1v1</p>
        </div>

        {/* ── Main view ── */}
        {view === "main" && (
          <div className="nawafeth-form">
            <input
              ref={nameRef}
              className="nawafeth-input"
              placeholder="Your name / اسمك"
              value={name}
              maxLength={20}
              onChange={(e) => { setName(e.target.value); setErr(""); }}
              autoFocus
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

        {/* ── Create view ── */}
        {view === "create" && (
          <div className="nawafeth-form">
            <p className="nawafeth-field-label">Playing as</p>
            <input
              className="nawafeth-input"
              placeholder="Your name"
              value={name}
              maxLength={20}
              onChange={(e) => { setName(e.target.value); setErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            {err && <p className="nawafeth-err">{err}</p>}
            <button className="nawafeth-btn nawafeth-btn-create" onClick={handleCreate} disabled={loading}>
              <span className="nawafeth-btn-label">{loading ? "Creating…" : "Create Room"}</span>
              <span className="nawafeth-btn-arrow">→</span>
            </button>
            <button className="nawafeth-back-btn" onClick={() => { setView("main"); setErr(""); }}>
              ← Back
            </button>
          </div>
        )}

        {/* ── Join view ── */}
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
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 5)); setErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              autoFocus={!initialCode}
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
            <button className="nawafeth-back-btn" onClick={() => { setView("main"); setErr(""); }}>
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
