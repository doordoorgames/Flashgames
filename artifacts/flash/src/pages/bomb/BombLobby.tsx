interface BombPlayer {
  id: string;
  name: string;
  losses: number;
  isAdmin: boolean;
}

interface Props {
  code: string;
  playerId: string;
  isAdmin: boolean;
  players: BombPlayer[];
  errorMsg: string;
  onStartGame: () => void;
  onBack: () => void;
}

export default function BombLobby({ code, playerId, isAdmin, players, errorMsg, onStartGame, onBack }: Props) {
  return (
    <div className="bomb-lobby-screen">
      <div className="bomb-lobby-card">
        <div className="bomb-lobby-brand">💣 The Bomb</div>

        <div className="room-code-display bomb-room-code">
          <p className="rcd-label">Room Code</p>
          <p className="rcd-code">{code}</p>
          <p className="rcd-hint">Share with players</p>
        </div>

        <div className="lobby-players">
          <p className="lobby-players-title">Players ({players.length})</p>
          <div className="lobby-players-list">
            {players.map(p => (
              <div key={p.id} className="lobby-player">
                <span className="lobby-dot" style={{ background: "#ff6b35" }} />
                <span className="lobby-pname">{p.name}</span>
                {p.isAdmin && <span className="lobby-host-tag">HOST</span>}
                {p.id === playerId && <span className="bomb-me-tag">you</span>}
                {p.losses > 0 && <span className="bomb-loss-tag">💥 {p.losses}</span>}
              </div>
            ))}
          </div>
        </div>

        {errorMsg && <div className="bomb-error-banner">{errorMsg}</div>}

        {isAdmin ? (
          <div className="bomb-lobby-admin">
            {players.length >= 2 ? (
              <button className="bomb-submit-btn" onClick={onStartGame}>
                Start Game 💣
              </button>
            ) : (
              <p className="bomb-waiting-hint">Waiting for at least 2 players...</p>
            )}
          </div>
        ) : (
          <p className="lobby-waiting">Waiting for the host to start...</p>
        )}

        <button className="back-btn" style={{ marginTop: 12 }} onClick={onBack}>← Change Game</button>
      </div>
    </div>
  );
}
