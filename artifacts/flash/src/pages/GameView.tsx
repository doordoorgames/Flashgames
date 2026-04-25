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

type Phase = "waiting" | "round-info" | "countdown" | "flash" | "answering" | "reveal" | "gameover";

export default function GameView({ code, playerId, isAdmin }: GameViewProps) {
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
      setTimeout(() => inputRef.current?.focus(), 80);
    });

    socket.on("answering-start", (data: { timeLimit: number }) => {
      setTimeLeft(data.timeLimit);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) { clearInterval(timerRef.current!); return 0; }
          return t - 1;
        });
      }, 1000);
    });

    socket.on("answer-received", (data: { playerId: string; playerName: string; answer: string }) => {
      if (isAdmin) setAdminAnswers((prev) => [...prev, data]);
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
      ["round-start","countdown-tick","flash-show","flash-hide","answering-start",
       "answer-received","round-reveal","game-over","error-msg"].forEach(e => socket.off(e));
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAdmin]);

  const submitAnswer = () => {
    if (submitted || !answer.trim()) return;
    getSocket().emit("submit-answer", { code, answer: answer.trim() });
    setSubmitted(true);
  };

  const handleNextRound = () => getSocket().emit("next-round", { code });
  const handleStartGame = () => getSocket().emit("start-game", { code });

  if (phase === "gameover") {
    return (
      <div className="gameover-screen">
        <div className="gameover-card">
          <h2 className="gameover-title">Final Results</h2>
          <p className="gameover-sub">Flash / لمحة</p>
          <div className="final-lb">
            {finalLeaderboard.map((p, i) => (
              <div key={p.id} className={`final-lb-row ${i === 0 ? "winner" : ""} ${p.id === playerId ? "lb-me" : ""}`}>
                <span className="final-rank">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                <span className="final-name">{p.name}</span>
                <span className="final-score">{p.score} pts</span>
              </div>
            ))}
          </div>
          <button className="entry-btn" onClick={() => window.location.reload()}>Play Again</button>
        </div>
      </div>
    );
  }

  const billboardContent = (() => {
    if (phase === "waiting") {
      if (isAdmin) {
        return (
          <div className="bb-center">
            {errorMsg && <p className="bb-error">{errorMsg}</p>}
            <button className="bb-start-btn" onClick={handleStartGame}>Begin!</button>
          </div>
        );
      }
      return <p className="bb-wait">Waiting...</p>;
    }
    if (phase === "round-info" && roundInfo) {
      return (
        <div className="bb-center">
          <div className={`bb-diff diff-${roundInfo.difficulty.toLowerCase()}`}>{roundInfo.difficulty}</div>
          <p className="bb-round">Round {roundInfo.roundNumber} / {roundInfo.totalRounds}</p>
        </div>
      );
    }
    if (phase === "countdown") {
      return <div className="bb-countdown">{countdown}</div>;
    }
    if (phase === "flash" && currentItem) {
      return currentItem.type === "image" && currentItem.mediaUrl
        ? <img src={currentItem.mediaUrl} alt="" className="bb-flash-img" draggable={false} />
        : (
          <div className="bb-flash-wrap">
            <p className="bb-flash-text">{currentItem.prompt}</p>
          </div>
        );
    }
    if (phase === "answering") {
      return <p className="bb-question-mark">?</p>;
    }
    if (phase === "reveal" && revealData) {
      return revealData.item.type === "image" && revealData.item.mediaUrl
        ? (
          <div className="bb-center">
            <p className="bb-answer-label">Answer</p>
            <img src={revealData.item.mediaUrl} alt="" className="bb-reveal-img" />
          </div>
        )
        : (
          <div className="bb-center">
            <p className="bb-answer-label">Answer</p>
            <p className="bb-answer-text">{revealData.item.correctAnswer}</p>
          </div>
        );
    }
    return null;
  })();

  return (
    <div className="game-screen">
      <img src="/billboard-bg.png" className="game-bg" alt="" />

      {roundInfo && phase !== "waiting" && (
        <div className="game-hud">
          <span className="hud-round">Round {roundInfo.roundNumber}/9</span>
          <span className={`hud-diff diff-${roundInfo.difficulty.toLowerCase()}`}>{roundInfo.difficulty}</span>
        </div>
      )}

      <div className="bb-overlay">
        {billboardContent}
      </div>

      {phase === "answering" && (
        <div className="answer-dock">
          {submitted ? (
            <p className="submitted-ok">✓ Answer submitted!</p>
          ) : (
            <div className="answer-row">
              <input
                ref={inputRef}
                className="answer-field"
                placeholder="Type your answer..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitAnswer(); }}
                disabled={timeLeft === 0}
                autoFocus
              />
              <button
                className="submit-btn"
                onClick={submitAnswer}
                disabled={!answer.trim() || timeLeft === 0}
              >Go</button>
            </div>
          )}
          <div className="timer-track">
            <div className="timer-fill" style={{ width: `${(timeLeft / 10) * 100}%` }} />
          </div>
          <div className="timer-num">{timeLeft}s</div>
          {isAdmin && adminAnswers.length > 0 && (
            <div className="admin-live">
              <p className="admin-live-title">Live answers:</p>
              {adminAnswers.map((a, i) => (
                <div key={i} className="admin-live-row">
                  <span>{a.playerName}</span>
                  <span className="live-ans">{a.answer}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === "reveal" && revealData && (
        <div className="reveal-dock">
          {(() => {
            const myAns = revealData.answers.find((a) => a.playerId === playerId);
            const myScore = revealData.leaderboard.find((p) => p.id === playerId)?.score ?? 0;
            return (
              <>
                {myAns && (
                  <div className={`my-result ${myAns.isCorrect ? "result-correct" : "result-wrong"}`}>
                    {myAns.isCorrect ? `✓ Correct! +${myAns.pointsEarned} pts` : "✗ Wrong!"}
                    <span className="my-total"> Total: {myScore} pts</span>
                  </div>
                )}
                <div className="answers-list">
                  {revealData.answers.map((a, i) => (
                    <div key={i} className={`ans-pill ${a.isCorrect ? "ans-right" : "ans-wrong"}`}>
                      <span className="ans-who">{a.playerName}</span>
                      <span className="ans-what">{a.answer}</span>
                      {a.isCorrect && <span className="ans-pts">+{a.pointsEarned}</span>}
                    </div>
                  ))}
                </div>
                <div className="mini-lb">
                  {revealData.leaderboard.slice(0, 5).map((p, i) => (
                    <div key={p.id} className={`mini-lb-row ${p.id === playerId ? "lb-me" : ""}`}>
                      <span className="mini-rank">#{i + 1}</span>
                      <span className="mini-name">{p.name}</span>
                      <span className="mini-score">{p.score}</span>
                    </div>
                  ))}
                </div>
                {isAdmin ? (
                  <button className="entry-btn next-btn" onClick={handleNextRound}>
                    {revealData.isLastRound ? "See Final Results" : "Next Round →"}
                  </button>
                ) : (
                  <p className="wait-host">Waiting for host...</p>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
