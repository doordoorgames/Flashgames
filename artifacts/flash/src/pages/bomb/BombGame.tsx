import { useState, useEffect, useRef, useCallback } from "react";
import { bombSounds } from "./BombSounds";

export interface BombPlayer {
  id: string;
  name: string;
  losses: number;
  isAdmin: boolean;
}

export type BombAction =
  | { type: "tap"; required: number }
  | { type: "swipe"; pattern: string[] }
  | { type: "code"; digits: string; direction: "ltr" | "rtl" };

export type InputProgress =
  | { type: "tap"; taps: number; required: number }
  | { type: "swipe"; step: number; total: number }
  | { type: "code"; entered: number; total: number };

interface Props {
  playerId: string;
  isAdmin: boolean;
  players: BombPlayer[];
  bombHolderId: string;
  action: BombAction;
  gamePhase: "playing" | "exploded";
  loserId: string | null;
  loserName: string | null;
  timerMs: number;
  gameStartTime: number;
  onCompleteAction: () => void;
  onPlayAgain: () => void;
  onProgress: (p: InputProgress) => void;
  watchProgress: InputProgress | null;
}

const ARROW_MAP: Record<string, string> = { up: "↑", down: "↓", left: "←", right: "→" };
const ARROW_LABEL: Record<string, string> = { up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT" };

/* ── Mute Button ── */
function MuteButton() {
  const [muted, setMuted] = useState(bombSounds.muted);
  const toggle = () => {
    bombSounds.muted = !bombSounds.muted;
    if (bombSounds.muted) bombSounds.stopTicking();
    setMuted(bombSounds.muted);
  };
  return (
    <button className="bomb-mute-btn" onClick={toggle} title={muted ? "Unmute" : "Mute"}>
      {muted ? "🔇" : "🔊"}
    </button>
  );
}

/* ── Mission Briefing overlay ── */
function MissionBriefing({ holderName, action, onDismiss }: {
  holderName: string;
  action: BombAction;
  onDismiss: () => void;
}) {
  const [typed, setTyped] = useState("");
  const instruction =
    action.type === "tap" ? `TAP  ${action.required}  TIMES` :
    action.type === "swipe" ? "SWIPE  THE  SEQUENCE" :
    "ENTER  THE  CODE";

  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      setTyped(instruction.slice(0, ++i));
      if (i >= instruction.length) clearInterval(iv);
    }, 38);
    return () => clearInterval(iv);
  }, [instruction]);

  useEffect(() => {
    const t = setTimeout(onDismiss, 2600);
    return () => clearTimeout(t);
  }, [onDismiss]);

  useEffect(() => { bombSounds.roundStart(); }, []);

  return (
    <div className="bomb-briefing-overlay" onClick={onDismiss}>
      <div className="bomb-briefing-card">
        <div className="bomb-briefing-eyebrow">MISSION ASSIGNED</div>
        <div className="bomb-briefing-holder">{holderName.toUpperCase()}</div>
        <div className="bomb-briefing-has">HAS THE BOMB</div>
        <div className="bomb-briefing-divider" />
        <div className="bomb-briefing-instruction">
          {typed}<span className="bomb-briefing-cursor">█</span>
        </div>
        <div className="bomb-briefing-sub">Complete before the challenge timer ends</div>
        <div className="bomb-briefing-tap">TAP TO SKIP</div>
      </div>
    </div>
  );
}

/* ── Bomb Health Bar (global detonation timer) ── */
function BombHealthBar({ timerMs, gameStartTime }: { timerMs: number; gameStartTime: number }) {
  const [pct, setPct] = useState(1);
  const [secsLeft, setSecsLeft] = useState(Math.ceil(timerMs / 1000));

  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - gameStartTime;
      const remaining = Math.max(0, timerMs - elapsed);
      setPct(remaining / timerMs);
      setSecsLeft(Math.ceil(remaining / 1000));
    };
    update();
    const iv = setInterval(update, 250);
    return () => clearInterval(iv);
  }, [timerMs, gameStartTime]);

  const stage = pct < 0.25 ? "crit" : pct < 0.5 ? "warn" : "safe";
  const fillColor = stage === "crit" ? "#ff2200" : stage === "warn" ? "#ff8800" : "#00ff41";

  return (
    <div className={`bomb-health-wrap bomb-health-${stage}`}>
      <div className="bomb-health-label">
        <span className="bomb-health-title">⚡ DETONATION TIMER</span>
        <span className="bomb-health-secs">{secsLeft}s</span>
      </div>
      <div className="bomb-health-track">
        <div className="bomb-health-fill" style={{ width: `${pct * 100}%`, background: fillColor }} />
      </div>
    </div>
  );
}

/* ── Challenge Timer ── */
function ChallengeTimer({ timeLimit, onExpire }: { timeLimit: number; onExpire: () => void }) {
  const [secs, setSecs] = useState(timeLimit);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    expiredRef.current = false;
    setSecs(timeLimit);
    const start = Date.now();
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, timeLimit - Math.floor(elapsed / 1000));
      setSecs(remaining);
      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(iv);
        onExpireRef.current();
      }
    }, 200);
    return () => clearInterval(iv);
  }, [timeLimit]);

  const pct = secs / timeLimit;
  const stage = pct < 0.25 ? "crit" : pct < 0.5 ? "warn" : "safe";

  return (
    <div className={`chal-timer-wrap chal-timer-${stage}`}>
      <div className="chal-timer-label">◈ CHALLENGE TIMER</div>
      <div className="chal-timer-num">{secs}</div>
      <div className="chal-timer-bar-track">
        <div className="chal-timer-bar-fill" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

/* ── Tap Action ── */
function TapAction({ required, onComplete, onPunishment, onGlitch, onProgress }: {
  required: number;
  onComplete: () => void;
  onPunishment: () => void;
  onGlitch: () => void;
  onProgress: (p: InputProgress) => void;
}) {
  const [taps, setTaps] = useState(0);
  const [pendingStop, setPendingStop] = useState(false);
  const [correctFlash, setCorrectFlash] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const done = useRef(false);
  const lastFiredAt = useRef(0);
  const tapsRef = useRef(0);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dotSize = required > 20 ? 9 : required > 16 ? 11 : 13;

  const flash = (type: "correct" | "wrong") => {
    if (type === "correct") {
      setCorrectFlash(true);
      setTimeout(() => setCorrectFlash(false), 110);
      bombSounds.correctInput();
    } else {
      setWrongFlash(true);
      setTimeout(() => setWrongFlash(false), 300);
      bombSounds.wrongInput();
    }
  };

  const handleTap = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastFiredAt.current < 110) return;
    lastFiredAt.current = now;
    if (done.current) return;

    tapsRef.current += 1;
    const count = tapsRef.current;

    if (count < required) {
      setTaps(count);
      flash("correct");
      onProgress({ type: "tap", taps: count, required });
    } else if (count === required) {
      setTaps(count);
      setPendingStop(true);
      flash("correct");
      onProgress({ type: "tap", taps: count, required });
      completeTimer.current = setTimeout(() => {
        if (!done.current) {
          done.current = true;
          onGlitch();
          bombSounds.transferSuccess();
          setTimeout(onComplete, 400);
        }
      }, 1100);
    } else {
      if (completeTimer.current) clearTimeout(completeTimer.current);
      done.current = true;
      flash("wrong");
      onPunishment();
    }
  }, [required, onComplete, onPunishment, onGlitch, onProgress]);

  return (
    <div className="bomb-action-tap">
      <p className="bomb-action-label">
        {pendingStop ? "🛑  STOP  TAPPING!" : `TAP  ${required}  TIMES`}
      </p>
      <div className="bomb-tap-progress" style={{ gap: dotSize > 11 ? 5 : 3 }}>
        {Array.from({ length: required }).map((_, i) => (
          <div
            key={i}
            className={`bomb-tap-dot ${i < taps ? "filled" : ""} ${pendingStop ? "filled-stop" : ""}`}
            style={{ width: dotSize, height: dotSize }}
          />
        ))}
      </div>
      <button
        className={`bomb-tap-btn ${correctFlash ? "btn-correct-flash" : ""} ${wrongFlash ? "btn-wrong-flash" : ""} ${pendingStop ? "bomb-tap-stop" : ""}`}
        onPointerDown={handleTap}
      >
        {pendingStop ? "STOP" : "TAP"}
      </button>
    </div>
  );
}

/* ── Swipe Action ── */
function SwipeAction({ pattern, onComplete, onPunishment, onProgress }: {
  pattern: string[];
  onComplete: () => void;
  onPunishment: () => void;
  onProgress: (p: InputProgress) => void;
}) {
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [lastCorrectIdx, setLastCorrectIdx] = useState(-1);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const done = useRef(false);
  void onPunishment;

  const handleSwipe = useCallback((dir: string) => {
    if (done.current) return;
    if (dir === pattern[step]) {
      const next = step + 1;
      setLastCorrectIdx(step);
      setTimeout(() => setLastCorrectIdx(-1), 200);
      bombSounds.correctInput();
      setStep(next);
      onProgress({ type: "swipe", step: next, total: pattern.length });
      if (next >= pattern.length) {
        done.current = true;
        bombSounds.transferSuccess();
        setTimeout(onComplete, 300);
      }
    } else {
      setFailed(true);
      bombSounds.wrongInput();
      setTimeout(() => setFailed(false), 500);
    }
  }, [step, pattern, onComplete, onProgress]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) handleSwipe(dx > 0 ? "right" : "left");
    else handleSwipe(dy > 0 ? "down" : "up");
  };

  const row1 = pattern.slice(0, 5);
  const row2 = pattern.slice(5);

  const arrowClass = (gi: number) => {
    if (gi < step) return "done";
    if (gi === step) return "current";
    if (gi === lastCorrectIdx) return "correct-flash";
    return "pending";
  };

  return (
    <div className="bomb-action-swipe">
      <p className="bomb-action-label">SWIPE  THE  SEQUENCE</p>
      <div className="bomb-swipe-sequence-wrap">
        <div className="bomb-swipe-sequence">
          {row1.map((dir, i) => (
            <span key={i} className={`bomb-swipe-arrow ${arrowClass(i)}`}>{ARROW_MAP[dir]}</span>
          ))}
        </div>
        {row2.length > 0 && (
          <div className="bomb-swipe-sequence">
            {row2.map((dir, i) => (
              <span key={i} className={`bomb-swipe-arrow ${arrowClass(i + 5)}`}>{ARROW_MAP[dir]}</span>
            ))}
          </div>
        )}
      </div>
      <div
        className={`bomb-swipe-pad ${failed ? "bomb-swipe-fail" : ""}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="bomb-swipe-hint">
          {failed ? "✗ WRONG — RETRY" : `SWIPE  ${ARROW_LABEL[pattern[Math.min(step, pattern.length - 1)]] ?? ""}`}
        </div>
        <div className="bomb-swipe-arrows-big">
          <button className="bomb-dir-btn" onPointerDown={() => handleSwipe("up")}>↑</button>
          <div className="bomb-dir-row">
            <button className="bomb-dir-btn" onPointerDown={() => handleSwipe("left")}>←</button>
            <div className="bomb-dir-center" />
            <button className="bomb-dir-btn" onPointerDown={() => handleSwipe("right")}>→</button>
          </div>
          <button className="bomb-dir-btn" onPointerDown={() => handleSwipe("down")}>↓</button>
        </div>
      </div>
    </div>
  );
}

/* ── Code Action ── */
function CodeAction({ digits, direction, onComplete, onPunishment, onProgress }: {
  digits: string;
  direction: "ltr" | "rtl";
  onComplete: () => void;
  onPunishment: () => void;
  onProgress: (p: InputProgress) => void;
}) {
  const [entered, setEntered] = useState("");
  const [failed, setFailed] = useState(false);
  const [lastKeyFlash, setLastKeyFlash] = useState("");
  const done = useRef(false);
  const isRtl = direction === "rtl";
  const targetAnswer = isRtl ? digits.split("").reverse().join("") : digits;
  void onPunishment;

  const handleKey = useCallback((k: string) => {
    if (done.current) return;
    if (k === "del") { setEntered(prev => prev.slice(0, -1)); return; }
    setLastKeyFlash(k);
    setTimeout(() => setLastKeyFlash(""), 160);
    setEntered(prev => {
      if (prev.length >= 8) return prev;
      const next = prev + k;
      onProgress({ type: "code", entered: next.length, total: 8 });
      bombSounds.correctInput();
      if (next.length === 8) {
        if (next === targetAnswer) {
          done.current = true;
          bombSounds.transferSuccess();
          setTimeout(onComplete, 300);
        } else {
          setFailed(true);
          bombSounds.wrongInput();
          setTimeout(() => { setFailed(false); setEntered(""); }, 700);
        }
      }
      return next;
    });
  }, [targetAnswer, onComplete, onProgress]);

  let displayStr: string;
  if (isRtl) {
    const reversed = entered.split("").reverse().join("");
    displayStr = "_".repeat(8 - entered.length) + reversed;
  } else {
    displayStr = entered + "_".repeat(8 - entered.length);
  }
  const part1 = displayStr.slice(0, 4);
  const part2 = displayStr.slice(4);

  return (
    <div className="bomb-action-code">
      <p className="bomb-action-label">ENTER  THE  CODE</p>
      <div className="bomb-code-direction-label">
        {isRtl ? "◄  RIGHT TO LEFT" : "LEFT TO RIGHT  ►"}
      </div>
      <div className="bomb-code-display-row">
        <span className="bomb-code-target">{digits.slice(0, 4)} {digits.slice(4)}</span>
      </div>
      <div className={`bomb-code-entered ${failed ? "bomb-code-fail" : ""}`}>
        <span>{part1}</span>
        <span className="bomb-code-sep"> </span>
        <span>{part2}</span>
      </div>
      <div className="bomb-numpad">
        {["1","2","3","4","5","6","7","8","9","","0","del"].map((k, i) => (
          k === "" ? <div key={i} /> :
          <button
            key={i}
            className={`bomb-numpad-btn ${k === "del" ? "bomb-numpad-del" : ""} ${lastKeyFlash === k ? "btn-correct-flash" : ""}`}
            onPointerDown={() => handleKey(k)}
          >
            {k === "del" ? "⌫" : k}
          </button>
        ))}
      </div>
      {failed && <p className="bomb-code-err">✗ WRONG CODE — RETRY</p>}
    </div>
  );
}

/* ── Watch Challenge (spectator live view) ── */
function WatchChallenge({ action, progress }: { action: BombAction; progress: InputProgress | null }) {
  if (action.type === "tap") {
    const taps = progress?.type === "tap" ? progress.taps : 0;
    return (
      <div className="watch-challenge-content">
        <span className="watch-challenge-type">TAP</span>
        <span className="watch-challenge-value">× {action.required}</span>
        <div className="watch-progress-dots">
          {Array.from({ length: Math.min(action.required, 20) }).map((_, i) => (
            <div key={i} className={`watch-progress-dot ${i < taps ? "filled" : ""}`} />
          ))}
          {action.required > 20 && (
            <span className="watch-challenge-type">{taps}/{action.required}</span>
          )}
        </div>
      </div>
    );
  }
  if (action.type === "swipe") {
    const step = progress?.type === "swipe" ? progress.step : 0;
    const half = Math.ceil(action.pattern.length / 2);
    return (
      <div className="watch-challenge-content">
        <span className="watch-challenge-type">SWIPE</span>
        <div className="watch-swipe-sequence">
          {action.pattern.slice(0, half).map((d, i) => (
            <span key={i} className={`watch-swipe-arrow ${i < step ? "done" : i === step ? "current" : "pending"}`}>
              {ARROW_MAP[d]}
            </span>
          ))}
        </div>
        {action.pattern.length > half && (
          <div className="watch-swipe-sequence">
            {action.pattern.slice(half).map((d, i) => {
              const gi = i + half;
              return (
                <span key={i} className={`watch-swipe-arrow ${gi < step ? "done" : gi === step ? "current" : "pending"}`}>
                  {ARROW_MAP[d]}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  if (action.type === "code") {
    const entered = progress?.type === "code" ? progress.entered : 0;
    return (
      <div className="watch-challenge-content">
        <span className="watch-challenge-type">CODE  {action.direction === "rtl" ? "◄" : "►"}</span>
        <span className="watch-challenge-value">{action.digits.slice(0, 4)}  {action.digits.slice(4)}</span>
        <div className="watch-progress-dots">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`watch-progress-dot ${i < entered ? "filled" : ""}`} />
          ))}
        </div>
      </div>
    );
  }
  return null;
}

/* ── Punishment Overlay ── */
function PunishmentOverlay({ countdown }: { countdown: number }) {
  return (
    <div className="bomb-punishment-overlay">
      <div className="bomb-punishment-content">
        <div className="bomb-punishment-icon">⚡</div>
        <div className="bomb-punishment-title">PENALTY</div>
        <div className="bomb-punishment-countdown">{countdown}</div>
        <div className="bomb-punishment-sub">YOU STILL HAVE THE BOMB</div>
      </div>
    </div>
  );
}

/* ── Main BombGame ── */
export default function BombGame({
  playerId, isAdmin, players, bombHolderId, action, gamePhase,
  loserId, loserName, timerMs, gameStartTime, onCompleteAction, onPlayAgain,
  onProgress, watchProgress,
}: Props) {
  const [isGlitching, setIsGlitching] = useState(false);
  const [glitchCountdown, setGlitchCountdown] = useState(3);
  const [challengeAttempt, setChallengeAttempt] = useState(0);
  const [completionGlitch, setCompletionGlitch] = useState(false);
  const [isBriefing, setIsBriefing] = useState(true);
  const [globalPct, setGlobalPct] = useState(1);

  const isGlitchingRef = useRef(false);
  const glitchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickStageRef = useRef(-1);

  const isHolder = playerId === bombHolderId;
  const holder = players.find(p => p.id === bombHolderId);

  useEffect(() => {
    setIsBriefing(true);
    if (glitchTimerRef.current) clearInterval(glitchTimerRef.current);
    isGlitchingRef.current = false;
    setIsGlitching(false);
    setGlitchCountdown(3);
    setChallengeAttempt(0);
    tickStageRef.current = -1;
  }, [bombHolderId]);

  useEffect(() => {
    if (gamePhase !== "playing") {
      bombSounds.stopTicking();
      return;
    }
    const stage = globalPct < 0.25 ? 2 : globalPct < 0.5 ? 1 : 0;
    if (stage !== tickStageRef.current) {
      tickStageRef.current = stage;
      bombSounds.setTickStage(stage as 0 | 1 | 2);
    }
  }, [globalPct, gamePhase]);

  useEffect(() => {
    if (gamePhase !== "playing") return;
    const iv = setInterval(() => {
      const elapsed = Date.now() - gameStartTime;
      setGlobalPct(Math.max(0, 1 - elapsed / timerMs));
    }, 400);
    return () => clearInterval(iv);
  }, [timerMs, gameStartTime, gamePhase]);

  useEffect(() => {
    if (gamePhase === "exploded") {
      bombSounds.stopTicking();
      bombSounds.explosion();
    }
  }, [gamePhase]);

  useEffect(() => () => { bombSounds.stopTicking(); }, []);

  const triggerPunishment = useCallback(() => {
    if (isGlitchingRef.current) return;
    isGlitchingRef.current = true;
    setIsGlitching(true);
    setGlitchCountdown(3);
    let count = 2;
    glitchTimerRef.current = setInterval(() => {
      setGlitchCountdown(count);
      count--;
      if (count < 0) {
        clearInterval(glitchTimerRef.current!);
        glitchTimerRef.current = null;
        isGlitchingRef.current = false;
        setIsGlitching(false);
        setGlitchCountdown(3);
        setChallengeAttempt(a => a + 1);
      }
    }, 1000);
  }, []);

  const handleCompletionGlitch = useCallback(() => {
    setCompletionGlitch(true);
    setTimeout(() => setCompletionGlitch(false), 700);
  }, []);

  const timerClass = globalPct < 0.25 ? "bomb-timer-crit" : globalPct < 0.5 ? "bomb-timer-warn" : "";
  const isWatching = !isHolder && gamePhase !== "exploded";

  return (
    <div className={[
      "bomb-crt-device",
      completionGlitch ? "bomb-screen-glitch" : "",
      isGlitching ? "bomb-punishment-active" : "",
      isWatching ? "bomb-crt-watching" : "",
      timerClass,
    ].filter(Boolean).join(" ")}>
      <div className="screen-safe-area">
        <div className={`bomb-screen-content ${isHolder ? "bomb-screen-is-holder" : ""}`}>

          {isGlitching && isHolder && <PunishmentOverlay countdown={glitchCountdown} />}
          <MuteButton />

          {gamePhase === "exploded" ? (
            <div className="bomb-explode-screen">
              <div className="bomb-explode-card">
                <div className="bomb-explode-icon">💥</div>
                <h2 className="bomb-explode-title">
                  {playerId === loserId ? "YOU HELD THE BOMB" : "DETONATED"}
                </h2>
                <p className="bomb-explode-sub">
                  <strong>{loserName}</strong> was holding the bomb when it exploded
                </p>
                <div className="bomb-score-list">
                  {[...players].sort((a, b) => a.losses - b.losses).map((p, i) => (
                    <div key={p.id} className={`bomb-score-row ${p.id === playerId ? "bomb-score-me" : ""} ${p.id === loserId ? "bomb-score-loser" : ""}`}>
                      <span className="bomb-score-rank">0{i + 1}</span>
                      <span className="bomb-score-name">{p.name.toUpperCase()}</span>
                      <span className="bomb-score-losses">×{p.losses}</span>
                    </div>
                  ))}
                </div>
                {isAdmin && <button className="bomb-cyber-btn" onClick={onPlayAgain}>▶ PLAY AGAIN</button>}
                {!isAdmin && <p className="bomb-watch-log">[ WAITING FOR HOST ]</p>}
              </div>
            </div>
          ) : (
            <>
              <div className="bomb-top-bar">
                <div className="bomb-player-strip">
                  {players.map(p => (
                    <div key={p.id} className={`bomb-player-pill ${p.id === bombHolderId ? "bomb-pill-active" : ""} ${p.id === playerId ? "bomb-pill-me" : ""}`}>
                      {p.id === bombHolderId && <span className="bomb-pill-icon">💣</span>}
                      <span>{p.name.toUpperCase()}</span>
                      {p.losses > 0 && <span className="bomb-pill-losses">×{p.losses}</span>}
                    </div>
                  ))}
                </div>
              </div>

              <BombHealthBar timerMs={timerMs} gameStartTime={gameStartTime} />

              {isHolder ? (
                <div className="bomb-holder-zone">
                  {isBriefing && (
                    <MissionBriefing
                      holderName={holder?.name ?? "???"}
                      action={action}
                      onDismiss={() => setIsBriefing(false)}
                    />
                  )}

                  <div className="bomb-visual">
                    <div className={`bomb-body ${timerClass}`}>💣</div>
                    <div className="bomb-fuse-text">YOU HAVE THE BOMB</div>
                  </div>

                  {!isBriefing && !isGlitching && (
                    <div className="bomb-action-zone" key={`${bombHolderId}-${challengeAttempt}`}>
                      <ChallengeTimer timeLimit={15} onExpire={triggerPunishment} />
                      {action.type === "tap" && (
                        <TapAction
                          required={action.required}
                          onComplete={onCompleteAction}
                          onPunishment={triggerPunishment}
                          onGlitch={handleCompletionGlitch}
                          onProgress={onProgress}
                        />
                      )}
                      {action.type === "swipe" && (
                        <SwipeAction
                          pattern={action.pattern}
                          onComplete={onCompleteAction}
                          onPunishment={triggerPunishment}
                          onProgress={onProgress}
                        />
                      )}
                      {action.type === "code" && (
                        <CodeAction
                          digits={action.digits}
                          direction={action.direction}
                          onComplete={onCompleteAction}
                          onPunishment={triggerPunishment}
                          onProgress={onProgress}
                        />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bomb-watching-zone">
                  <p className="bomb-watch-log">[ MONITORING CHANNEL ACTIVE ]</p>
                  <div className="bomb-watch-challenge-wrap">
                    <p className="bomb-watch-holder-label">{(holder?.name ?? "???").toUpperCase()}</p>
                    <WatchChallenge action={action} progress={watchProgress} />
                  </div>
                  <div className="bomb-watching-players">
                    {players.filter(p => p.id !== bombHolderId).map(p => (
                      <span key={p.id} className={`bomb-watch-pill ${p.id === playerId ? "bomb-watch-me" : ""}`}>
                        {p.name.toUpperCase()}
                      </span>
                    ))}
                  </div>
                  <p className="bomb-watch-log">[ STANDBY — AWAITING TRANSFER ]</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
