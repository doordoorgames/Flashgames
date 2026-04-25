import { useState, useEffect } from "react";
import type { YNSession, YNPlayer, YNRoundState } from "./YesNoApp";

interface RoundResult {
  passed: boolean;
  answersGiven: number;
  violation: string;
  isLastPair: boolean;
  nextAskedName: string | null;
}

interface Props {
  session: YNSession;
  gamePhase: "round" | "between-rounds" | "gameover";
  roundState: YNRoundState | null;
  currentQuestion: string;
  currentQuestionNumber: number;
  answersThisRound: string[];
  lastViolation: { type: string; answer: string } | null;
  roundResult: RoundResult | null;
  finalLeaderboard: YNPlayer[];
  lobbyPlayers: YNPlayer[];
  onSubmitAnswer: (answer: string) => void;
  onNextQuestion: () => void;
  onFailPlayer: () => void;
  onEndGame: () => void;
  onReturnToLobby: () => void;
  onNextPlayer: () => void;
}

export default function YesNoGame({
  session, gamePhase, roundState, currentQuestion, currentQuestionNumber,
  answersThisRound, lastViolation, roundResult, finalLeaderboard, lobbyPlayers,
  onNextQuestion, onFailPlayer, onEndGame, onNextPlayer,
}: Props) {
  const [shake, setShake] = useState(false);
  const isAsker = roundState?.askerPlayerId === session.playerId;
  const isHotSeat = roundState?.hotSeatPlayerId === session.playerId;
  const questionCount = answersThisRound.length;

  useEffect(() => {
    if (lastViolation) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  }, [lastViolation]);

  const last3 = answersThisRound.slice(-3);

  if (gamePhase === "gameover") {
    return (
      <div className="yn-gameover">
        <div className="yn-gameover-card">
          <h2 className="yn-gameover-title">Final Results</h2>
          <p className="yn-gameover-sub">Yes / No · نعم / لا</p>
          <div className="final-lb">
            {finalLeaderboard.map((p, i) => (
              <div key={p.id} className={`final-lb-row ${i === 0 ? "winner" : ""} ${p.id === session.playerId ? "lb-me" : ""}`}>
                <span className="final-rank">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                <span className="final-name">{p.name}</span>
                <span className="final-score">{p.score} pts</span>
              </div>
            ))}
          </div>
          <button className="yn-submit-btn" onClick={() => window.location.reload()}>Play Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`yn-room-scene ${shake ? "yn-shake" : ""} ${questionCount >= 8 ? "yn-edge-pulse" : ""}`}>
      <div className="yn-scene-bg" />
      <div className="yn-grain" />
      <div className="yn-spotlight" />
      <div className="yn-silhouettes">
        <svg viewBox="0 0 600 400" className="yn-silhouette-svg" aria-hidden="true">
          <rect x="0" y="220" width="600" height="8" fill="rgba(30,50,35,0.9)" rx="2" />
          <ellipse cx="170" cy="210" rx="22" ry="22" fill="#0b1510" />
          <rect x="150" y="230" width="40" height="80" fill="#0b1510" rx="4" />
          <rect x="130" y="250" width="18" height="50" fill="#0b1510" rx="3" />
          <rect x="452" y="170" width="44" height="55" fill="#0b1510" rx="4" />
          <ellipse cx="474" cy="160" rx="22" ry="22" fill="#0b1510" />
          <rect x="452" y="222" width="44" height="60" fill="#0b1510" rx="4" />
          <rect x="490" y="240" width="16" height="40" fill="#0b1510" rx="3" />
        </svg>
      </div>

      <div className="yn-rec"><span className="yn-rec-dot" />REC</div>

      <div className="yn-forbidden">
        <span className="yn-forbid-word">YES ✖</span>
        <span className="yn-forbid-word">NO ✖</span>
      </div>

      <div className="yn-top-ui">
        <div className="yn-roles-display">
          <div className="yn-role-chip yn-role-asker">
            <span className="yn-role-label">ASKING</span>
            <span className="yn-role-name">{roundState?.askerPlayerName}</span>
          </div>
          <div className="yn-role-arrow">→</div>
          <div className="yn-role-chip yn-role-asked">
            <span className="yn-role-label">ANSWERING</span>
            <span className="yn-role-name">{roundState?.hotSeatPlayerName}</span>
          </div>
          {roundState && (
            <div className="yn-pair-counter">{roundState.pairNumber}/{roundState.totalPairs}</div>
          )}
        </div>

        <div className="yn-scoreboard">
          {lobbyPlayers.slice(0, 4).map((p, i) => (
            <div key={p.id} className={`yn-score-row ${p.id === session.playerId ? "yn-score-me" : ""}`}>
              <span className="yn-score-rank">#{i + 1}</span>
              <span className="yn-score-name">{p.name}</span>
              <span className="yn-score-val">{p.score}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="yn-question-area">
        <div className={`yn-question-panel ${isHotSeat ? "yn-question-panel--hotseat" : ""}`}>
          <div className="yn-q-number">Q{currentQuestionNumber}</div>
          <p className="yn-q-text">{currentQuestion}</p>
          <div className="yn-scanline" />
        </div>

        <div className="yn-memory-tracker">
          {last3.length === 0 ? (
            <span className="yn-memory-empty">No answers yet</span>
          ) : last3.map((ans, i) => (
            <span key={i} className="yn-memory-chip">{ans}</span>
          ))}
        </div>

        <div className="yn-progress-label-only">{questionCount} / 10</div>
      </div>

      {gamePhase === "round" && (
        <div className="yn-bottom-zone">
          {isAsker && (
            <div className="yn-asker-controls">
              <div className="yn-asker-badge">You are asking</div>
              <div className="yn-asker-btns">
                <button className="yn-next-q-btn" onClick={onNextQuestion}>Next Question →</button>
                <button className="yn-fail-btn-red" onClick={onFailPlayer}>Fail</button>
              </div>
            </div>
          )}
          {isHotSeat && (
            <div className="yn-hotseat-badge">
              You are being questioned — answer verbally!
            </div>
          )}
          {!isAsker && !isHotSeat && (
            <div className="yn-spectator-label">
              {session.isAdmin
                ? <span>Admin · <button className="yn-end-inline-btn" onClick={onEndGame}>End Game</button></span>
                : `Watching · ${roundState?.askerPlayerName} is asking`
              }
            </div>
          )}
          {session.isAdmin && !isAsker && (
            <div className="yn-admin-override">
              <button className="yn-next-q-btn yn-next-q-sm" onClick={onNextQuestion}>Next Q</button>
              <button className="yn-fail-btn-red yn-fail-sm" onClick={onFailPlayer}>Fail</button>
            </div>
          )}
        </div>
      )}

      {gamePhase === "between-rounds" && (
        <div className="yn-result-overlay">
          <div className="yn-result-card">
            {roundResult?.passed ? (
              <>
                <div className="yn-result-icon pass">🎉</div>
                <h3 className="yn-result-title pass-text">Point Scored!</h3>
                <p className="yn-result-sub">{roundState?.hotSeatPlayerName} answered all 10 questions!</p>
              </>
            ) : (
              <>
                <div className="yn-result-icon fail">💀</div>
                <h3 className="yn-result-title fail-text">Eliminated!</h3>
                <p className="yn-result-sub">
                  {roundResult?.violation === "yes" && "They said YES"}
                  {roundResult?.violation === "no" && "They said NO"}
                  {roundResult?.violation === "repeat" && "Repeated an answer"}
                  {roundResult?.violation === "manual" && "Failed by host"}
                  {" "}after {roundResult?.answersGiven} question{roundResult?.answersGiven !== 1 ? "s" : ""}
                </p>
              </>
            )}

            <p className="yn-role-swap-note">
              <strong>{roundState?.hotSeatPlayerName}</strong> is now the Asker
              {roundResult?.nextAskedName && <> · <strong>{roundResult.nextAskedName}</strong> is next in the hot seat</>}
            </p>

            <div className="yn-mini-lb">
              {lobbyPlayers.map((p, i) => (
                <div key={p.id} className={`mini-lb-row ${p.id === session.playerId ? "lb-me" : ""}`}>
                  <span className="mini-rank">#{i + 1}</span>
                  <span className="mini-name">{p.name}</span>
                  <span className="mini-score">{p.score} pts</span>
                </div>
              ))}
            </div>

            {session.isAdmin && (
              <div className="yn-between-admin">
                {roundResult?.isLastPair ? (
                  <button className="yn-submit-btn" onClick={onEndGame}>
                    See Final Results →
                  </button>
                ) : (
                  <>
                    <button className="yn-submit-btn" onClick={onNextPlayer}>
                      Next Round →
                    </button>
                    <button className="yn-end-btn" style={{ marginTop: 8 }} onClick={onEndGame}>End Game</button>
                  </>
                )}
              </div>
            )}
            {!session.isAdmin && (
              <p className="wait-host">Waiting for host to continue...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
