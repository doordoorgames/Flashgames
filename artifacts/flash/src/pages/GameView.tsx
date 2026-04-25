import { useState, useEffect, useRef } from "react";
import type { GameItem, Player, PlayerAnswer, Difficulty } from "@/lib/types";
import { getSocket } from "@/lib/socket";

interface RoundInfo {
  roundNumber: number;
  totalRounds: number;
  difficulty: Difficulty;
  flashDurationMs: number;
  item: GameItem;
}

interface RevealData {
  item: GameItem;
  answers: PlayerAnswer[];
  leaderboard: Player[];
  isLastRound: boolean;
}

interface GameViewProps {
  code: string;
  playerId: string;
  isAdmin: boolean;
  playerName: string;
}

type Phase =
  | "waiting"
  | "round-info"
  | "countdown"
  | "flash"
  | "answering"
  | "reveal"
  | "gameover";

export default function GameView({ code, playerId, isAdmin, playerName }: GameViewProps) {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [roundInfo, setRoundInfo] = useState<RoundInfo | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [currentItem, setCurrentItem] = useState<GameItem | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const [revealData, setRevealData] = useState<RevealData | null>(null);
  const [adminAnswers, setAdminAnswers] = useState<{ playerId: string; playerName: string; answer: string }[]>([]);
  const [finalLeaderboard, setFinalLeaderboard] = useState<Player[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on("round-start", (data: RoundInfo) => {
      setRoundInfo(data);
      setCurrentItem(data.item);
      setAnswer("");
      setSubmitted(false);
      setAdminAnswers([]);
      setRevealData(null);
      setPhase("round-info");
    });

    socket.on("countdown-tick", (data: { count: number }) => {
      setCountdown(data.count);
      setPhase("countdown");
    });

    socket.on("flash-show", (data: { item: GameItem }) => {
      setCurrentItem(data.item);
      setPhase("flash");
    });

    socket.on("flash-hide", () => {
      setPhase("answering");
      setTimeLeft(10);
      setTimeout(() => inputRef.current?.focus(), 100);
    });

    socket.on("answering-start", (data: { timeLimit: number }) => {
      setTimeLeft(data.timeLimit);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    });

    socket.on("answer-received", (data: { playerId: string; playerName: string; answer: string }) => {
      if (isAdmin) {
        setAdminAnswers((prev) => [...prev, data]);
      }
    });

    socket.on("round-reveal", (data: RevealData) => {
      if (timerRef.current) clearInterval(timerRef.current);
      setRevealData(data);
      setPhase("reveal");
    });

    socket.on("game-over", (data: { players: Player[] }) => {
      setFinalLeaderboard(data.players);
      setPhase("gameover");
    });

    socket.on("error-msg", (data: { message: string }) => {
      setErrorMsg(data.message);
    });

    return () => {
      socket.off("round-start");
      socket.off("countdown-tick");
      socket.off("flash-show");
      socket.off("flash-hide");
      socket.off("answering-start");
      socket.off("answer-received");
      socket.off("round-reveal");
      socket.off("game-over");
      socket.off("error-msg");
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAdmin]);

  const submitAnswer = () => {
    if (submitted || !answer.trim()) return;
    const socket = getSocket();
    socket.emit("submit-answer", { code, answer: answer.trim() });
    setSubmitted(true);
  };

  const handleNextRound = () => {
    const socket = getSocket();
    socket.emit("next-round", { code });
  };

  const handleStartGame = () => {
    const socket = getSocket();
    socket.emit("start-game", { code });
  };

  if (phase === "waiting") {
    return (
      <div className="game-screen">
        <div className="billboard-scene">
          <img src="/billboard-bg.png" className="billboard-bg" alt="" />
          <div className="billboard-panel">
            <div className="billboard-content">
              {isAdmin ? (
                <div className="admin-start-box">
                  <p className="billboard-text">Ready to play!</p>
                  {errorMsg && <p className="error-msg">{errorMsg}</p>}
                  <button className="btn-primary" onClick={handleStartGame} style={{ marginTop: 16 }}>
                    Start Game
                  </button>
                </div>
              ) : (
                <p className="billboard-text waiting-dots">Waiting for host</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "round-info" && roundInfo) {
    return (
      <div className="game-screen">
        <div className="billboard-scene">
          <img src="/billboard-bg.png" className="billboard-bg" alt="" />
          <div className="billboard-panel">
            <div className="billboard-content round-info-content">
              <div className={`difficulty-badge diff-${roundInfo.difficulty.toLowerCase()}`}>
                {roundInfo.difficulty}
              </div>
              <p className="round-label">Round {roundInfo.roundNumber} / {roundInfo.totalRounds}</p>
              <p className="flash-duration-hint">Flash: {roundInfo.flashDurationMs}ms</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="game-screen">
        <div className="billboard-scene">
          <img src="/billboard-bg.png" className="billboard-bg" alt="" />
          <div className="billboard-panel">
            <div className="billboard-content">
              <div className="countdown-number">{countdown}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "flash" && currentItem) {
    return (
      <div className="game-screen">
        <div className="billboard-scene">
          <img src="/billboard-bg.png" className="billboard-bg" alt="" />
          <div className="billboard-panel">
            <div className="billboard-content flash-content">
              {currentItem.type === "image" && currentItem.mediaUrl ? (
                <img
                  src={currentItem.mediaUrl}
                  alt="flash"
                  className="flash-image"
                  draggable={false}
                />
              ) : (
                <p className="flash-text">{currentItem.prompt}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "answering") {
    return (
      <div className="game-screen answering-screen">
        <div className="billboard-scene answering-bg">
          <img src="/billboard-bg.png" className="billboard-bg dimmed" alt="" />
          <div className="billboard-panel billboard-empty">
            <div className="billboard-content">
              <p className="billboard-gone-text">?</p>
            </div>
          </div>
        </div>
        <div className="answer-overlay">
          <div className="answer-box">
            <div className="timer-bar-wrap">
              <div className="timer-bar" style={{ width: `${(timeLeft / 10) * 100}%` }} />
            </div>
            <p className="time-left">{timeLeft}s</p>
            {submitted ? (
              <p className="submitted-msg">Answer submitted!</p>
            ) : (
              <>
                <input
                  ref={inputRef}
                  className="answer-input"
                  placeholder="Type your answer..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitAnswer(); }}
                  autoFocus
                  disabled={timeLeft === 0}
                />
                <button
                  className="btn-primary btn-submit"
                  onClick={submitAnswer}
                  disabled={!answer.trim() || timeLeft === 0}
                >
                  Submit
                </button>
              </>
            )}
            {isAdmin && adminAnswers.length > 0 && (
              <div className="admin-live-answers">
                <p className="admin-answers-title">Live Answers:</p>
                {adminAnswers.map((a, i) => (
                  <div key={i} className="admin-answer-row">
                    <span className="ans-player">{a.playerName}</span>
                    <span className="ans-val">{a.answer}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "reveal" && revealData) {
    const myAnswer = revealData.answers.find((a) => a.playerId === playerId);
    const myScore = revealData.leaderboard.find((p) => p.id === playerId)?.score ?? 0;

    return (
      <div className="game-screen">
        <div className="billboard-scene">
          <img src="/billboard-bg.png" className="billboard-bg" alt="" />
          <div className="billboard-panel">
            <div className="billboard-content reveal-content">
              <p className="correct-answer-label">Correct Answer</p>
              {revealData.item.type === "image" && revealData.item.mediaUrl ? (
                <img src={revealData.item.mediaUrl} alt="answer" className="reveal-image" />
              ) : (
                <p className="correct-answer-text">{revealData.item.correctAnswer}</p>
              )}
            </div>
          </div>
        </div>

        <div className="reveal-overlay">
          <div className="reveal-panel">
            {myAnswer && (
              <div className={`my-result ${myAnswer.isCorrect ? "correct" : "wrong"}`}>
                {myAnswer.isCorrect ? (
                  <p>Correct! +{myAnswer.pointsEarned} pts</p>
                ) : (
                  <p>Wrong — better luck next time!</p>
                )}
                <p className="my-score">Your total: {myScore} pts</p>
              </div>
            )}

            <div className="answers-grid">
              {revealData.answers.map((a, i) => (
                <div
                  key={i}
                  className={`answer-card ${a.isCorrect ? "ans-correct" : "ans-wrong"}`}
                >
                  <span className="ans-name">{a.playerName}</span>
                  <span className="ans-answer">{a.answer}</span>
                  {a.isCorrect && <span className="ans-points">+{a.pointsEarned}</span>}
                </div>
              ))}
            </div>

            <div className="leaderboard-mini">
              <h4>Leaderboard</h4>
              {revealData.leaderboard.slice(0, 5).map((p, i) => (
                <div key={p.id} className={`lb-row ${p.id === playerId ? "lb-me" : ""}`}>
                  <span className="lb-rank">#{i + 1}</span>
                  <span className="lb-name">{p.name}</span>
                  <span className="lb-score">{p.score} pts</span>
                </div>
              ))}
            </div>

            {isAdmin && (
              <button className="btn-primary btn-next" onClick={handleNextRound}>
                {revealData.isLastRound ? "Show Final Results" : "Next Round →"}
              </button>
            )}
            {!isAdmin && (
              <p className="waiting-next">Waiting for host...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "gameover") {
    return (
      <div className="gameover-screen">
        <div className="gameover-card">
          <h2 className="gameover-title">Final Results</h2>
          <p className="gameover-subtitle">Flash / لمحة</p>
          <div className="final-leaderboard">
            {finalLeaderboard.map((p, i) => (
              <div key={p.id} className={`final-lb-row ${i === 0 ? "winner" : ""} ${p.id === playerId ? "lb-me" : ""}`}>
                <span className="final-rank">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                <span className="final-name">{p.name}</span>
                <span className="final-score">{p.score} pts</span>
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}
