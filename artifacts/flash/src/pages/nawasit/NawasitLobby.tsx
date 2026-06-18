interface LobbyPlayer { id: string; name: string; isAdmin: boolean }

interface Props {
  code: string;
  playerId: string;
  isAdmin: boolean;
  players: LobbyPlayer[];
  onStartGame: () => void;
  onBack: () => void;
}

export default function NawasitLobby({ code, isAdmin, players, onStartGame, onBack }: Props) {
  const ready = players.length === 2;

  return (
    <div className="nws-lobby">
      <button className="nawafeth-back-btn" onClick={onBack}>← Leave</button>

      <div className="nws-lobby-inner">
        <h2 className="nws-lobby-title">🕵️ Nawasit Lobby</h2>

        <div className="nws-code-block">
          <p className="nws-code-label">Room Code</p>
          <p className="nws-code-value">{code}</p>
          <p className="nws-code-hint">Share this code with the other player</p>
        </div>

        <div className="nws-players-list">
          {players.map((p) => (
            <div key={p.id} className="nws-player-row">
              <span className="nws-player-dot" />
              <span className="nws-player-name">{p.name}</span>
              {p.isAdmin && <span className="nws-player-badge">HOST</span>}
            </div>
          ))}
          {players.length < 2 && (
            <div className="nws-player-row nws-player-waiting">
              <span className="nws-player-dot nws-dot-empty" />
              <span className="nws-player-name">Waiting for opponent…</span>
            </div>
          )}
        </div>

        <div className="nws-role-preview">
          <div className="nws-role-chip thief-chip">
            <span className="nws-role-dot nws-thief-dot" />
            Thief — steal the jewel
          </div>
          <div className="nws-role-chip catcher-chip">
            <span className="nws-role-dot nws-catcher-dot" />
            Catcher — hunt blind
          </div>
          <div className="nws-role-chip">
            <span className="nws-role-dot nws-jewel-dot" />
            Jewel — the prize
          </div>
        </div>

        {isAdmin && (
          <button
            className="nawafeth-btn nawafeth-btn-create nws-start-btn"
            onClick={onStartGame}
            disabled={!ready}
          >
            <span className="nawafeth-btn-label">{ready ? "Start Game" : "Waiting for 2 players…"}</span>
            {ready && <span className="nawafeth-btn-arrow">→</span>}
          </button>
        )}
        {!isAdmin && (
          <p className="nws-waiting-msg">Waiting for host to start…</p>
        )}
      </div>
    </div>
  );
}
