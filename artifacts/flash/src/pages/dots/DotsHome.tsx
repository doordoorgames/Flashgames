import { useState, useRef } from "react";
import { getSocket } from "@/lib/socket";

interface Props {
  initialCode?: string;
  onCreated: (code: string, playerId: string, name: string) => void;
  onJoined: (code: string, playerId: string, name: string) => void;
  onBack?: () => void;
}

export default function DotsHome({ initialCode = "", onCreated, onJoined, onBack }: Props) {
  const [view, setView] = useState<"main" | "create" | "join">(initialCode ? "join" : "main");
  const [name, setName] = useState("");
  const [code, setCode] = useState(initialCode);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const socket = getSocket();

  const handleCreate = () => {
    const n = name.trim();
    if (!n) { setErr("Enter your name first."); return; }
    setLoading(true);
    setErr("");

    const onCreatedEvt = (data: { code: string; playerId: string }) => {
      setLoading(false);
      onCreated(data.code, data.playerId, n);
    };
    const onErr = (data: { message: string }) => {
      setLoading(false);
      setErr(data.message);
      socket.off("dots:room-created", onCreatedEvt);
      socket.off("dots:error", onErr);
    };

    socket.once("dots:room-created", onCreatedEvt);
    socket.once("dots:error", onErr);
    socket.emit("dots:create-room", { playerName: n });
  };

  const handleJoin = () => {
    const n = name.trim();
    const c = code.replace(/\D/g, "").slice(0, 5);
    if (!n) { setErr("Enter your name first."); return; }
    if (c.length !== 5) { setErr("Enter a valid 5-digit room code."); return; }
    setLoading(true);
    setErr("");

    const onJoinedEvt = (data: { code: string; playerId: string }) => {
      setLoading(false);
      onJoined(data.code, data.playerId, n);
    };
    const onErr = (data: { message: string }) => {
      setLoading(false);
      setErr(data.message);
      socket.off("dots:room-joined", onJoinedEvt);
      socket.off("dots:error", onErr);
    };

    socket.once("dots:room-joined", onJoinedEvt);
    socket.once("dots:error", onErr);
    socket.emit("dots:join-room", { code: c, playerName: n });
  };

  return (
    <div className="home-screen dots-home-bg">
      <div className="home-inner">
        {onBack && (
          <button className="back-btn" style={{ alignSelf: "flex-start" }} onClick={onBack}>
            ← Games
          </button>
        )}

        <div className="dots-logo-wrap">
          <div className="dots-logo-circles">
            {["#FF6B9D","#FECA57","#54A0FF","#10AC84","#D980FA"].map((c, i) => (
              <span key={i} className="dots-logo-dot" style={{ background: c }} />
            ))}
          </div>
          <span className="dots-logo-title">DOTS</span>
          <p className="dots-logo-sub">1v1 Chase · نقاط</p>
        </div>

        {view === "main" && (
          <div className="dots-name-wrap">
            <input
              ref={nameRef}
              className="dots-name-input"
              placeholder="Your name"
              value={name}
              maxLength={20}
              onChange={(e) => { setName(e.target.value); setErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && setView("create")}
              autoFocus
            />
            {err && <p className="dots-err">{err}</p>}
            <div className="home-buttons" style={{ marginTop: 8 }}>
              <button className="home-btn home-btn-join" onClick={() => {
                if (!name.trim()) { setErr("Enter your name first."); return; }
                setErr("");
                setView("join");
              }}>
                <span className="home-btn-tag">JOIN</span>
                <div className="home-btn-text">
                  <span className="home-btn-label">Join Game</span>
                  <span className="home-btn-sub">Enter a room code</span>
                </div>
                <span className="home-btn-arrow">→</span>
              </button>
              <button className="home-btn home-btn-create" onClick={() => {
                if (!name.trim()) { setErr("Enter your name first."); return; }
                setErr("");
                setView("create");
              }}>
                <span className="home-btn-tag">HOST</span>
                <div className="home-btn-text">
                  <span className="home-btn-label">Create Game</span>
                  <span className="home-btn-sub">Start a new room</span>
                </div>
                <span className="home-btn-arrow">→</span>
              </button>
            </div>
          </div>
        )}

        {view === "create" && (
          <div className="dots-entry-card">
            <p className="dots-entry-label">Playing as</p>
            <input
              className="dots-name-input"
              placeholder="Your name"
              value={name}
              maxLength={20}
              onChange={(e) => { setName(e.target.value); setErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            {err && <p className="dots-err">{err}</p>}
            <button
              className="dots-action-btn"
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? "Creating…" : "Create Room →"}
            </button>
            <button className="back-btn" style={{ marginTop: 8 }} onClick={() => { setView("main"); setErr(""); }}>
              ← Back
            </button>
          </div>
        )}

        {view === "join" && (
          <div className="dots-entry-card">
            <p className="dots-entry-label">Playing as</p>
            <input
              className="dots-name-input"
              placeholder="Your name"
              value={name}
              maxLength={20}
              onChange={(e) => { setName(e.target.value); setErr(""); }}
            />
            <p className="dots-entry-label" style={{ marginTop: 14 }}>Room code</p>
            <input
              className="dots-code-input"
              placeholder="12345"
              value={code}
              maxLength={5}
              inputMode="numeric"
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 5)); setErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              autoFocus={!initialCode}
            />
            {err && <p className="dots-err">{err}</p>}
            <button
              className="dots-action-btn"
              onClick={handleJoin}
              disabled={loading}
            >
              {loading ? "Joining…" : "Join Room →"}
            </button>
            <button className="back-btn" style={{ marginTop: 8 }} onClick={() => { setView("main"); setErr(""); }}>
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
