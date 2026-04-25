import type { YNSession, YNPlayer } from "./YesNoApp";

interface LobbyState {
  players: YNPlayer[];
  adminId: string;
  questionCount: number;
}

interface Props {
  session: YNSession;
  lobbyState: LobbyState;
  errorMsg: string;
  onStartRound: (hotSeatPlayerId: string) => void;
  onBack: () => void;
}

export default function YesNoLobby({ session, lobbyState, errorMsg, onStartRound, onBack }: Props) {
  const { players, questionCount } = lobbyState;
  const isReady = questionCount >= 1;

  return (
    <div className="yn-lobby-screen">
      <div className="yn-lobby-card">
        <div className="yn-lobby-brand">Yes / No <span>· نعم / لا</span></div>

        <div className="room-code-display yn-room-code">
          <p className="rcd-label">Room Code</p>
          <p className="rcd-code">{session.code}</p>
          <p className="rcd-hint">Share with players</p>
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
            <p className={`yn-q-count ${isReady ? "yn-q-ready" : "yn-q-warn"}`}>
              {isReady ? `✓ ${questionCount} questions loaded` : `⚠ No questions loaded — upload at /admin`}
            </p>
            {players.length >= 1 && isReady ? (
              <>
                <p className="yn-select-label">Select who goes in the hot seat:</p>
                <div className="yn-player-select">
                  {players.map(p => (
                    <button
                      key={p.id}
                      className="yn-player-select-btn"
                      onClick={() => onStartRound(p.id)}
                    >
                      <span className="yn-player-icon">🔍</span>
                      <span>{p.name}</span>
                      {p.id === session.playerId && <span className="yn-me-tag">you</span>}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="yn-waiting-hint">
                {!isReady ? "Upload questions at /admin first." : "Waiting for players to join..."}
              </p>
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
