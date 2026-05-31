import type { Player } from "@/lib/types";
import RoomJoinQR from "@/components/RoomJoinQR";
import FloatingStartBtn from "@/components/FloatingStartBtn";

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
        <div className="lobby-brand">Flash / لمحة</div>

        <div className="room-code-display">
          <p className="rcd-label">Room Code</p>
          <p className="rcd-code">{code}</p>
          <p className="rcd-hint">Share this with your players</p>
          <RoomJoinQR roomCode={code} />
        </div>

        <div className="lobby-players">
          <p className="lobby-players-title">Players in room ({players.length})</p>
          <div className="lobby-players-list">
            {players.map((p) => (
              <div key={p.id} className="lobby-player">
                <span className="lobby-dot" />
                <span className="lobby-pname">{p.name}</span>
                {p.isAdmin && <span className="lobby-host-tag">HOST</span>}
              </div>
            ))}
          </div>
        </div>

        {isAdmin ? (
          <div className="lobby-admin-area">
            <p className="lobby-items-info">{itemCount} game items loaded</p>
          </div>
        ) : (
          <p className="lobby-waiting">The host will start the game soon...</p>
        )}
        {isAdmin && <FloatingStartBtn onClick={onStartGame} />}
      </div>
    </div>
  );
}
