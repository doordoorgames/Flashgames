import { useEffect } from "react";
import RoomJoinQR from "@/components/RoomJoinQR";
import FloatingStartBtn from "@/components/FloatingStartBtn";

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

const SUPABASE_BASE = "https://qvzxjtyvbfexuhmmqbzl.supabase.co/storage/v1/object/public/backgrounds";
const COUNTRY_NAMES = [
  "Italy","Japan","United Kingdom","India","Australia",
  "United States","Canada","China","Brazil","Mexico",
  "South Africa","France","Spain","Madagascar","Greenland",
  "Argentina","Chile","New Zealand","Saudi Arabia","Egypt",
];
const BOMB_PRELOAD_URLS = [
  `${SUPABASE_BASE}/Wires.png`,
  ...COUNTRY_NAMES.map(c => `${SUPABASE_BASE}/${encodeURIComponent(c)}.jpeg`),
];

export default function BombLobby({ code, playerId, isAdmin, players, errorMsg, onStartGame, onBack }: Props) {
  // Silently prefetch all game images while players are entering nicknames in the lobby
  useEffect(() => {
    BOMB_PRELOAD_URLS.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }, []);

  return (
    <div className="bomb-crt-device">
      <div className="screen-safe-area">
        <div className="bomb-screen-content bomb-screen-centered">
          <div className="bomb-lobby-card">
            <div className="bomb-lobby-brand">[ THE BOMB ]</div>

            <div className="room-code-display bomb-room-code">
              <p className="rcd-label">Room Code</p>
              <p className="rcd-code">{code}</p>
              <p className="rcd-hint">Share with players</p>
              <RoomJoinQR roomCode={code} />
            </div>

            <div className="lobby-players">
              <p className="lobby-players-title">Players ({players.length})</p>
              <div className="lobby-players-list">
                {players.map(p => (
                  <div key={p.id} className="lobby-player">
                    <span className="lobby-dot" style={{ background: "rgba(255,255,255,0.6)" }} />
                    <span className="lobby-pname">{p.name}</span>
                    {p.isAdmin && <span className="lobby-host-tag">HOST</span>}
                    {p.id === playerId && <span className="bomb-me-tag">you</span>}
                    {p.losses > 0 && <span className="bomb-loss-tag">x{p.losses}</span>}
                  </div>
                ))}
              </div>
            </div>

            {errorMsg && <div className="bomb-error-banner">{errorMsg}</div>}

            {isAdmin ? (
              <div className="bomb-lobby-admin">
                {players.length < 2 && (
                  <p className="bomb-waiting-hint">Waiting for at least 2 players...</p>
                )}
              </div>
            ) : (
              <p className="lobby-waiting">Waiting for the host to start...</p>
            )}
            {isAdmin && <FloatingStartBtn onClick={onStartGame} disabled={players.length < 2} />}

            <button className="back-btn" style={{ marginTop: 12 }} onClick={onBack}>← Change Game</button>
          </div>
        </div>
      </div>
    </div>
  );
}
