import type { Player } from "@/lib/types";

interface LobbyProps {
  code: string;
  players: Player[];
  isAdmin: boolean;
  playerId: string;
  itemCount: number;
  onStartGame: () => void;
}

export default function Lobby({ code, players, isAdmin, itemCount, onStartGame }: LobbyProps) {
  return (
    <div className="lobby-screen">
      <div className="lobby-card">
        <h2 className="lobby-title">Flash / لمحة</h2>
        <div className="room-code-box">
          <p className="room-code-label">Room Code</p>
          <p className="room-code">{code}</p>
          <p className="room-code-hint">Share this code with players</p>
        </div>

        <div className="players-section">
          <h3 className="players-title">Players ({players.length})</h3>
          <div className="players-list">
            {players.map((p) => (
              <div key={p.id} className="player-chip">
                <span className="player-dot" />
                <span className="player-name">{p.name}</span>
                {p.isAdmin && <span className="admin-badge">HOST</span>}
              </div>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="admin-controls">
            <p className="item-count-info">{itemCount} items loaded · 9 rounds</p>
            <button
              className="btn-primary btn-large"
              onClick={onStartGame}
              disabled={players.length < 1}
            >
              Start Game
            </button>
          </div>
        )}

        {!isAdmin && (
          <p className="waiting-msg">Waiting for host to start the game...</p>
        )}
      </div>
    </div>
  );
}
