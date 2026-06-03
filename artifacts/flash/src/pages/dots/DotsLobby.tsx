import RoomJoinQR from "@/components/RoomJoinQR";
import FloatingStartBtn from "@/components/FloatingStartBtn";
import litBuilding from "@assets/8FB02617-28A8-4F70-9E10-F24EE18E0E04_1780489207343.png";

interface DotsLobbyPlayer {
  id: string;
  name: string;
  isAdmin: boolean;
}

interface Props {
  code: string;
  playerId: string;
  isAdmin: boolean;
  players: DotsLobbyPlayer[];
  onStartGame: () => void;
  onBack: () => void;
}

export default function DotsLobby({ code, playerId, isAdmin, players, onStartGame, onBack }: Props) {
  const ready = players.length === 2;

  return (
    <div className="nawafeth-home">
      <div className="nawafeth-bg" style={{ backgroundImage: `url(${litBuilding})` }} />

      <div className="nawafeth-content nawafeth-lobby-content">
        {/* Brand */}
        <div className="nawafeth-title-wrap" style={{ marginBottom: 16 }}>
          <h1 className="nawafeth-title" style={{ fontSize: "3.2rem" }}>نوافذ</h1>
          <p className="nawafeth-subtitle">NAWAFETH · LOBBY</p>
        </div>

        {/* Lobby card */}
        <div className="nawafeth-card">
          {/* Room code + QR */}
          <div className="nawafeth-room-code-wrap">
            <p className="nawafeth-rcd-label">Room Code</p>
            <p className="nawafeth-rcd-code">{code}</p>
            <p className="nawafeth-rcd-hint">Share with your opponent</p>
            <div className="nawafeth-qr-wrap">
              <RoomJoinQR roomCode={code} />
            </div>
          </div>

          {/* Players */}
          <div className="nawafeth-players">
            <p className="nawafeth-players-title">
              Players ({players.length}/2)
              {ready && <span className="nawafeth-ready-tag">READY</span>}
            </p>
            <div className="nawafeth-players-list">
              {players.map((p) => (
                <div key={p.id} className="nawafeth-player-row">
                  <span className="nawafeth-player-dot" />
                  <span className="nawafeth-player-name">{p.name}</span>
                  {p.isAdmin && <span className="nawafeth-tag nawafeth-tag-host">HOST</span>}
                  {p.id === playerId && <span className="nawafeth-tag nawafeth-tag-you">YOU</span>}
                </div>
              ))}
              {players.length < 2 && (
                <div className="nawafeth-player-row nawafeth-player-waiting">
                  <span className="nawafeth-player-dot" style={{ background: "rgba(44,10,74,0.2)" }} />
                  <span className="nawafeth-player-name" style={{ opacity: 0.45 }}>Waiting for opponent…</span>
                </div>
              )}
            </div>
          </div>

          {/* Rules */}
          <div className="nawafeth-rules">
            <p className="nawafeth-rule-line">🔴 Thief — hold windows to light them</p>
            <p className="nawafeth-rule-line">🔵 Catcher — find where the thief is hiding</p>
            <p className="nawafeth-rule-line">⏱ 45 seconds · 2 rounds · swap roles</p>
          </div>

          {/* Status */}
          {isAdmin ? (
            !ready && <p className="nawafeth-waiting">Waiting for 2nd player…</p>
          ) : (
            <p className="nawafeth-waiting">Waiting for host to start…</p>
          )}
        </div>

        {isAdmin && <FloatingStartBtn onClick={onStartGame} disabled={!ready} />}

        <button className="nawafeth-back-btn" style={{ marginTop: 12 }} onClick={onBack}>
          ← Change Game
        </button>
      </div>
    </div>
  );
}
