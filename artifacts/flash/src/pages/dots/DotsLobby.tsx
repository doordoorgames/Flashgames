import RoomJoinQR from "@/components/RoomJoinQR";
import FloatingStartBtn from "@/components/FloatingStartBtn";
import litBuilding from "@assets/8FB02617-28A8-4F70-9E10-F24EE18E0E04_1780489207343.png";
import nawafethLogo from "@assets/726E20E0-2EB9-4A9A-8E8C-FD46A4093A1E_1780495624232.png";

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
        {/* Brand — compact, no subtitle */}
        <div className="nawafeth-title-wrap" style={{ marginBottom: 10, marginTop: 0 }}>
          <img src={nawafethLogo} alt="نوافذ" className="nawafeth-logo nawafeth-logo-sm" />
        </div>

        {/* Lobby card — code + players only, no QR inside */}
        <div className="nawafeth-card">
          {/* Room code */}
          <div className="nawafeth-room-code-wrap" style={{ paddingBottom: 12 }}>
            <p className="nawafeth-rcd-label">Room Code</p>
            <p className="nawafeth-rcd-code">{code}</p>
            <p className="nawafeth-rcd-hint">Share with your opponent</p>
          </div>

          {/* Players */}
          <div className="nawafeth-players" style={{ paddingTop: 10, paddingBottom: 10 }}>
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
            {isAdmin ? (
              !ready && <p className="nawafeth-waiting" style={{ marginTop: 6 }}>Waiting for 2nd player…</p>
            ) : (
              <p className="nawafeth-waiting" style={{ marginTop: 6 }}>Waiting for host to start…</p>
            )}
          </div>
        </div>

        {/* QR code — standalone, no box, generous size */}
        <div className="nawafeth-qr-standalone">
          <RoomJoinQR roomCode={code} />
        </div>

        {isAdmin && <FloatingStartBtn onClick={onStartGame} disabled={!ready} />}

        <button className="nawafeth-back-btn" style={{ marginTop: 8 }} onClick={onBack}>
          ← Change Game
        </button>
      </div>
    </div>
  );
}
