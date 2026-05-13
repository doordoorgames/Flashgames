import type { B2Player } from "./Bomb2App";

interface Props {
  code: string;
  playerId: string;
  isAdmin: boolean;
  players: B2Player[];
  errorMsg: string;
  onStartGame: () => void;
  onBack: () => void;
}

export default function Bomb2Lobby({ code, playerId, isAdmin, players, errorMsg, onStartGame, onBack }: Props) {
  return (
    <div className="b2-device">
      <div className="b2-scanlines" />
      <div className="b2-vignette" />
      <div className="b2-safe">
        <div className="b2-lobby-wrap">
          <div className="b2-reactor-ring b2-ring-1" />
          <div className="b2-reactor-ring b2-ring-2" />
          <div className="b2-lobby-card">
            <button className="b2-back-btn" onClick={onBack}>← ABORT</button>
            <div className="b2-lobby-header">
              <span className="b2-lobby-icon">☢</span>
              <h1 className="b2-lobby-title">REACTOR ONLINE</h1>
              <p className="b2-lobby-sub">BOMB 2.0</p>
            </div>
            <div className="b2-lobby-code-block">
              <span className="b2-lobby-code-label">REACTOR CODE</span>
              <span className="b2-lobby-code">{code}</span>
              <span className="b2-lobby-code-hint">Share with operatives</span>
            </div>
            <div className="b2-lobby-players">
              <p className="b2-lobby-players-label">OPERATIVES CONNECTED — {players.length}</p>
              {players.map(p => (
                <div key={p.id} className={`b2-lobby-player-row ${p.id === playerId ? "b2-lobby-me" : ""}`}>
                  <span className="b2-lobby-player-icon">{p.isAdmin ? "⬡" : "◈"}</span>
                  <span className="b2-lobby-player-name">{p.name.toUpperCase()}</span>
                  {p.id === playerId && <span className="b2-lobby-you-tag">YOU</span>}
                  {p.isAdmin && <span className="b2-lobby-admin-tag">HOST</span>}
                </div>
              ))}
            </div>
            {errorMsg && <p className="b2-input-error">[!] {errorMsg}</p>}
            {isAdmin ? (
              <button
                className="b2-submit-btn"
                onClick={onStartGame}
                disabled={players.length < 2}
              >
                {players.length < 2 ? "WAITING FOR OPERATIVES..." : "▶ INITIATE MELTDOWN"}
              </button>
            ) : (
              <p className="b2-lobby-waiting">[ AWAITING HOST AUTHORIZATION ]</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
