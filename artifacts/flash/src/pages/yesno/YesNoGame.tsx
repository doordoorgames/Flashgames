import { useState, useRef, useEffect } from "react";
import type { YNSession, YNPlayer } from "./YesNoApp";

interface RoundState {
  hotSeatPlayerId: string;
  hotSeatPlayerName: string;
  question: string;
  questionNumber: number;
  leaderboard: YNPlayer[];
}

interface RoundResult {
  passed: boolean;
  answersGiven: number;
  violation: string;
}

interface Props {
  session: YNSession;
  gamePhase: "selecting" | "round" | "between-rounds" | "gameover";
  roundState: RoundState | null;
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
  onSelectPlayer: (id: string) => void;
}

export default function YesNoGame({
  session, gamePhase, roundState, currentQuestion, currentQuestionNumber,
  answersThisRound, lastViolation, roundResult, finalLeaderboard, lobbyPlayers,
  onSubmitAnswer, onNextQuestion, onFailPlayer, onEndGame, onReturnToLobby, onSelectPlayer,
}: Props) {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isHotSeat = roundState?.hotSeatPlayerId === session.playerId;
  const questionCount = answersThisRound.length;

  useEffect(() => {
    setInput("");
    setSubmitted(false);
    if (isHotSeat && gamePhase === "round") {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [currentQuestion, gamePhase, isHotSeat]);

  useEffect(() => {
    if (lastViolation) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  }, [lastViolation]);

  const handleSubmit = () => {
    const ans = input.trim();
    if (!ans) return;
    onSubmitAnswer(ans);
    setInput("");
  };

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

  if (gamePhase === "selecting") {
    return (
      <div className="yn-room-scene yn-selecting">
        <div className="yn-scene-bg" />
        <div className="yn-grain" />
        <div className="yn-spotlight" />
        <div className="yn-rec"><span className="yn-rec-dot" />REC</div>
        <div className="yn-select-screen">
          <p className="yn-select-title">Select next player for the hot seat</p>
          <div className="yn-player-select">
            {lobbyPlayers.map(p => (
              <button key={p.id} className="yn-player-select-btn" onClick={() => onSelectPlayer(p.id)}>
                <span className="yn-player-icon">🔍</span>
                <span>{p.name}</span>
                <span className="yn-score-badge">{p.score} pts</span>
              </button>
            ))}
          </div>
          <button className="yn-end-btn" onClick={onEndGame}>End Game</button>
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
        <div className="yn-player-indicator">
          <span className="yn-indicator-label">UNDER QUESTIONING</span>
          <span className="yn-indicator-name">{roundState?.hotSeatPlayerName}</span>
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
        <div className="yn-question-panel">
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

        <div className="yn-progress-track">
          <div className="yn-progress-fill" style={{ width: `${(questionCount / 10) * 100}%` }} />
          <span className="yn-progress-label">{questionCount} / 10</span>
        </div>
      </div>

      {gamePhase === "round" && isHotSeat && (
        <div className="yn-answer-area">
          <div className="yn-answer-row">
            <input
              ref={inputRef}
              className="yn-answer-input"
              placeholder="Your answer (not yes or no)..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
              maxLength={120}
              disabled={submitted}
            />
            <button className="yn-go-btn" onClick={handleSubmit} disabled={!input.trim() || submitted}>
              Answer
            </button>
          </div>
          {lastViolation && (
            <div className="yn-violation-banner">
              {lastViolation.type === "yes" && `❌ You said "yes"!`}
              {lastViolation.type === "no" && `❌ You said "no"!`}
              {lastViolation.type === "repeat" && `❌ Repeated answer!`}
              {lastViolation.type === "manual" && `❌ Failed by host`}
            </div>
          )}
        </div>
      )}

      {gamePhase === "round" && !isHotSeat && (
        <div className="yn-watching">
          <p className="yn-watching-label">
            {session.isAdmin ? "Admin Controls" : `Watching ${roundState?.hotSeatPlayerName}...`}
          </p>
          {answersThisRound.length > 0 && (
            <div className="yn-answers-feed">
              {answersThisRound.slice(-5).map((a, i) => (
                <span key={i} className="yn-feed-item">{a}</span>
              ))}
            </div>
          )}
          {session.isAdmin && (
            <div className="yn-admin-controls">
              <button className="yn-next-q-btn" onClick={onNextQuestion}>Next Question →</button>
              <button className="yn-fail-btn" onClick={onFailPlayer}>✗ Fail Player</button>
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
                <p className="yn-select-label" style={{ marginBottom: 8 }}>Select next player:</p>
                {lobbyPlayers.map(p => (
                  <button key={p.id} className="yn-player-select-btn" onClick={() => onSelectPlayer(p.id)}>
                    <span>🔍</span>
                    <span>{p.name}</span>
                    <span className="yn-score-badge">{p.score} pts</span>
                  </button>
                ))}
                <button className="yn-end-btn" style={{ marginTop: 10 }} onClick={onEndGame}>End Game</button>
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
