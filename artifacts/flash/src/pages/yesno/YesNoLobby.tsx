import type { YNSession, YNPlayer } from "./YesNoApp";
import RoomJoinQR from "@/components/RoomJoinQR";
import FloatingStartBtn from "@/components/FloatingStartBtn";

interface LobbyState {
  players: YNPlayer[];
  adminId: string;
  questionCount: number;
}

interface Props {
  session: YNSession;
  lobbyState: LobbyState;
  errorMsg: string;
  onStartGame: () => void;
  onBack: () => void;
}

export default function YesNoLobby({ session, lobbyState, errorMsg, onStartGame, onBack }: Props) {
  const { players, questionCount } = lobbyState;
  const isReady = questionCount >= 1 && players.length >= 1;

  return (
    <div className="yn-lobby-screen">
      <div className="yn-lobby-card">
        <div className="yn-lobby-brand">Yes / No <span>· نعم / لا</span></div>

        <div className="room-code-display yn-room-code">
          <p className="rcd-label">Room Code</p>
          <p className="rcd-code">{session.code}</p>
          <p className="rcd-hint">Share with players</p>
          <RoomJoinQR roomCode={session.code} />
        </div>

        <div className="lobby-players">
          <p className="lobby-players-title">Players ({players.length})</p>
          <div className="lobby-players-list">
            {players.map(p => (
              <div key={p.id} className="lobby-player">
                <span className="lobby-dot" />
                <span className="lobby-pname">{p.name}</span>
                {p.isAdmin && <span className="lobby-host-tag">HOST</span>}
                <span className="yn-score-badge">{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>

        {errorMsg && <div className="yn-error-banner">{errorMsg}</div>}

        {session.isAdmin ? (
          <div className="yn-lobby-admin">
            <p className={`yn-q-count ${questionCount >= 1 ? "yn-q-ready" : "yn-q-warn"}`}>
              {questionCount >= 1 ? `✓ ${questionCount} questions loaded` : `⚠ No questions loaded — upload at /admin`}
            </p>
            {!isReady && (
              <p className="yn-waiting-hint">
                {questionCount < 1 ? "Upload questions at /admin first." : "Waiting for players to join..."}
              </p>
            )}
          </div>
        ) : (
          <p className="lobby-waiting">Waiting for the host to start...</p>
        )}
        {session.isAdmin && <FloatingStartBtn onClick={onStartGame} disabled={!isReady} />}

        <button className="back-btn" style={{ marginTop: 12 }} onClick={onBack}>← Back to Dordor.games</button>
      </div>
    </div>
  );
}
