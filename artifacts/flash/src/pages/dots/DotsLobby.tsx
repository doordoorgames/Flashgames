import RoomJoinQR from "@/components/RoomJoinQR";
import FloatingStartBtn from "@/components/FloatingStartBtn";

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
    <div className="lobby-screen">
      <div className="lobby-card">
        <div className="lobby-brand" style={{ background: "#0d1a2e", color: "#54A0FF" }}>
          DOTS · نقاط
        </div>

        <div className="room-code-display" style={{ background: "#0a1428" }}>
          <p className="rcd-label">Room Code</p>
          <p className="rcd-code" style={{ color: "#54A0FF" }}>{code}</p>
          <p className="rcd-hint">Share with your opponent</p>
          <RoomJoinQR roomCode={code} />
        </div>

        <div className="lobby-players">
          <p className="lobby-players-title">
            Players ({players.length}/2)
            {ready && <span style={{ marginLeft: 8, color: "#10AC84", fontWeight: 900 }}>READY</span>}
          </p>
          <div className="lobby-players-list">
            {players.map((p) => (
              <div key={p.id} className="lobby-player">
                <span className="lobby-dot" />
                <span className="lobby-pname">{p.name}</span>
                {p.isAdmin && <span className="lobby-host-tag">HOST</span>}
                {p.id === playerId && (
                  <span style={{
                    fontSize: "0.52rem", fontWeight: 900, textTransform: "uppercase",
                    color: "#54A0FF", background: "rgba(84,160,255,0.12)",
                    padding: "2px 6px", borderRadius: 2,
                  }}>YOU</span>
                )}
              </div>
            ))}
            {players.length < 2 && (
              <div className="lobby-player" style={{ opacity: 0.4, borderStyle: "dashed" }}>
                <span className="lobby-dot" style={{ background: "#555" }} />
                <span className="lobby-pname" style={{ color: "#888" }}>Waiting for opponent…</span>
              </div>
            )}
          </div>
        </div>

        <div className="dots-lobby-rules">
          <p className="dots-rule-line">🔴 Thief steals dots — hold to claim</p>
          <p className="dots-rule-line">🔵 Catcher hunts — hold to search</p>
          <p className="dots-rule-line">⏱ 45 seconds · 2 rounds · swap roles</p>
        </div>

        {isAdmin ? (
          <div className="lobby-admin-area">
            {!ready && <p className="lobby-items-info">Waiting for 2nd player…</p>}
          </div>
        ) : (
          <p className="lobby-waiting">Waiting for host to start…</p>
        )}

        {isAdmin && <FloatingStartBtn onClick={onStartGame} disabled={!ready} />}

        <button className="back-btn" style={{ margin: "4px 22px 18px" }} onClick={onBack}>
          ← Change Game
        </button>
      </div>
    </div>
  );
}
