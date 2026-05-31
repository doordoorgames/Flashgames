import { useState } from "react";
import { getSocket } from "@/lib/socket";

interface Props {
  onBack: () => void;
  onJoined: (code: string, playerId: string, name: string, isAdmin: boolean) => void;
  initialCode?: string;
}

type Sub = "choose" | "create" | "join";

export default function Bomb2Home({ onBack, onJoined, initialCode = "" }: Props) {
  const [sub, setSub] = useState<Sub>(initialCode ? "join" : "choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = () => {
    if (!name.trim()) { setError("ENTER YOUR NAME"); return; }
    setLoading(true); setError("");
    getSocket().timeout(8000).emit("b2:create-room", { playerName: name.trim() },
      (err: Error | null, res: { code: string; playerId: string }) => {
        setLoading(false);
        if (err) { setError("CONNECTION FAILED"); return; }
        onJoined(res.code, res.playerId, name.trim(), true);
      });
  };

  const handleJoin = () => {
    if (!name.trim()) { setError("ENTER YOUR NAME"); return; }
    if (code.trim().length !== 5) { setError("ENTER 5-DIGIT CODE"); return; }
    setLoading(true); setError("");
    getSocket().timeout(8000).emit("b2:join-room", { code: code.trim(), playerName: name.trim() },
      (err: Error | null, res: { success: boolean; playerId?: string; error?: string }) => {
        setLoading(false);
        if (err || !res.success) { setError(res?.error?.toUpperCase() ?? "ROOM NOT FOUND"); return; }
        onJoined(code.trim(), res.playerId!, name.trim(), false);
      });
  };

  return (
    <div className="b2-device">
      <div className="b2-scanlines" />
      <div className="b2-vignette" />
      <div className="b2-safe">
        <div className="b2-entry-wrap">
          <div className="b2-reactor-ring b2-ring-1" />
          <div className="b2-reactor-ring b2-ring-2" />
          <div className="b2-reactor-ring b2-ring-3" />
          <div className="b2-entry-card">
            <button className="b2-back-btn" onClick={sub === "choose" ? onBack : () => { setSub("choose"); setError(""); }}>
              ← ABORT
            </button>
            {sub === "choose" && (
              <div className="b2-entry-choose">
                <div className="b2-entry-core-icon">☢</div>
                <h1 className="b2-entry-title">REACTOR</h1>
                <p className="b2-entry-sub">BOMB 2.0</p>
                <p className="b2-entry-desc">
                  One player holds the bomb.<br />
                  Everyone else controls the chaos.<br />
                  Complete tasks or the reactor detonates.
                </p>
                <div className="b2-entry-btns">
                  <button className="b2-choice-btn" onClick={() => setSub("join")}>▶ JOIN ROOM</button>
                  <button className="b2-choice-btn b2-choice-primary" onClick={() => setSub("create")}>☢ CREATE ROOM</button>
                </div>
              </div>
            )}
            {(sub === "create" || sub === "join") && (
              <div className="b2-entry-form">
                <h2 className="b2-form-title">{sub === "create" ? "// INITIALIZE REACTOR" : "// CONNECT TO REACTOR"}</h2>
                <input
                  className="b2-input"
                  placeholder="OPERATIVE NAME"
                  value={name}
                  maxLength={20}
                  onChange={e => { setName(e.target.value); setError(""); }}
                  onKeyDown={e => { if (e.key === "Enter" && sub === "create") handleCreate(); }}
                />
                {sub === "join" && (
                  <input
                    className="b2-input b2-code-input"
                    placeholder="REACTOR CODE"
                    value={code}
                    maxLength={5}
                    inputMode="numeric"
                    onChange={e => { setCode(e.target.value.replace(/\D/g, "").slice(0, 5)); setError(""); }}
                    onKeyDown={e => { if (e.key === "Enter") handleJoin(); }}
                  />
                )}
                {error && <p className="b2-input-error">[!] {error}</p>}
                <button
                  className="b2-submit-btn"
                  onClick={sub === "create" ? handleCreate : handleJoin}
                  disabled={loading}
                >
                  {loading ? "CONNECTING..." : sub === "create" ? "INITIALIZE" : "CONNECT"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
