import { useState, useEffect, useRef, useCallback } from "react";

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
}

const ARROW_MAP: Record<string, string> = { up: "↑", down: "↓", left: "←", right: "→" };
const ARROW_LABEL: Record<string, string> = { up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT" };

/* ── Bomb Health Bar ── */
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

  const danger = pct < 0.25;

  return (
    <div className="bomb-health-wrap">
      <div className="bomb-health-label">
        <span className="bomb-health-title">DETONATION TIMER</span>
        <span className={`bomb-health-secs ${danger ? "bomb-health-secs-danger" : ""}`}>{secsLeft}s</span>
      </div>
      <div className="bomb-health-track">
        <div className={`bomb-health-fill ${danger ? "bomb-health-fill-danger" : ""}`} style={{ width: `${pct * 100}%` }} />
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

  const danger = secs <= 3;
  const pct = secs / timeLimit;

  return (
    <div className={`chal-timer-wrap ${danger ? "chal-timer-danger" : ""}`}>
      <div className="chal-timer-label">⚠ CHALLENGE TIMER</div>
      <div className="chal-timer-num">{secs}</div>
      <div className="chal-timer-bar-track">
        <div className="chal-timer-bar-fill" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

/* ── Tap Action ── */
function TapAction({ required, onComplete, onPunishment, onGlitch }: {
  required: number;
  onComplete: () => void;
  onPunishment: () => void;
  onGlitch: () => void;
}) {
  const [taps, setTaps] = useState(0);
  const [flash, setFlash] = useState(false);
  const [pendingStop, setPendingStop] = useState(false);
  const done = useRef(false);
  const lastFiredAt = useRef(0);
  const tapsRef = useRef(0);
  const completeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dotSize = required > 20 ? 10 : required > 16 ? 12 : 14;

  const handleTap = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastFiredAt.current < 120) return;
    lastFiredAt.current = now;
    if (done.current) return;

    tapsRef.current += 1;
    const count = tapsRef.current;
    setFlash(true);
    setTimeout(() => setFlash(false), 80);

    if (count < required) {
      setTaps(count);
    } else if (count === required) {
      setTaps(count);
      setPendingStop(true);
      completeTimer.current = setTimeout(() => {
        if (!done.current) {
          done.current = true;
          onGlitch();
          setTimeout(onComplete, 400);
        }
      }, 1200);
    } else {
      if (completeTimer.current) clearTimeout(completeTimer.current);
      done.current = true;
      onPunishment();
    }
  }, [required, onComplete, onPunishment, onGlitch]);

  return (
    <div className="bomb-action-tap">
      <p className="bomb-action-label">{pendingStop ? "🛑 STOP TAPPING!" : `TAP  ${required}  TIMES`}</p>
      <div className="bomb-tap-progress" style={{ gap: dotSize > 12 ? 6 : 4 }}>
        {Array.from({ length: required }).map((_, i) => (
          <div
            key={i}
            className={`bomb-tap-dot ${i < taps ? "filled" : ""} ${pendingStop ? "filled-stop" : ""}`}
            style={{ width: dotSize, height: dotSize }}
          />
        ))}
      </div>
      <button
        className={`bomb-tap-btn ${flash ? "bomb-tap-flash" : ""} ${pendingStop ? "bomb-tap-stop" : ""}`}
        onPointerDown={handleTap}
      >
        {pendingStop ? "STOP" : "TAP"}
      </button>
    </div>
  );
}

/* ── Swipe Action ── */
function SwipeAction({ pattern, onComplete, onPunishment }: {
  pattern: string[];
  onComplete: () => void;
  onPunishment: () => void;
}) {
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const done = useRef(false);
  void onPunishment;

  const handleSwipe = useCallback((dir: string) => {
    if (done.current) return;
    if (dir === pattern[step]) {
      const next = step + 1;
      setStep(next);
      if (next >= pattern.length) {
        done.current = true;
        setTimeout(onComplete, 300);
      }
    } else {
      setFailed(true);
      setTimeout(() => setFailed(false), 600);
    }
  }, [step, pattern, onComplete]);

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

  return (
    <div className="bomb-action-swipe">
      <p className="bomb-action-label">SWIPE THE SEQUENCE</p>
      <div className="bomb-swipe-sequence-wrap">
        <div className="bomb-swipe-sequence">
          {row1.map((dir, i) => (
            <span key={i} className={`bomb-swipe-arrow ${i < step ? "done" : i === step ? "current" : "pending"}`}>
              {ARROW_MAP[dir]}
            </span>
          ))}
        </div>
        <div className="bomb-swipe-sequence">
          {row2.map((dir, i) => {
            const gi = i + 5;
            return (
              <span key={i} className={`bomb-swipe-arrow ${gi < step ? "done" : gi === step ? "current" : "pending"}`}>
                {ARROW_MAP[dir]}
              </span>
            );
          })}
        </div>
      </div>
      <div
        className={`bomb-swipe-pad ${failed ? "bomb-swipe-fail" : ""}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="bomb-swipe-hint">
          {failed ? "WRONG — TRY AGAIN" : `SWIPE  ${ARROW_LABEL[pattern[Math.min(step, pattern.length - 1)]] ?? ""}`}
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
function CodeAction({ digits, direction, onComplete, onPunishment }: {
  digits: string;
  direction: "ltr" | "rtl";
  onComplete: () => void;
  onPunishment: () => void;
}) {
  const [entered, setEntered] = useState("");
  const [failed, setFailed] = useState(false);
  const done = useRef(false);
  const isRtl = direction === "rtl";
  const targetAnswer = isRtl ? digits.split("").reverse().join("") : digits;
  void onPunishment;

  const handleKey = useCallback((k: string) => {
    if (done.current) return;
    if (k === "del") { setEntered(prev => prev.slice(0, -1)); return; }
    setEntered(prev => {
      if (prev.length >= 8) return prev;
      const next = prev + k;
      if (next.length === 8) {
        if (next === targetAnswer) {
          done.current = true;
          setTimeout(onComplete, 300);
        } else {
          setFailed(true);
          setTimeout(() => { setFailed(false); setEntered(""); }, 700);
        }
      }
      return next;
    });
  }, [targetAnswer, onComplete]);

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
      <p className="bomb-action-label">TYPE THE CODE</p>
      <div className="bomb-code-direction-label">
        {isRtl ? "⬅ ENTER RIGHT TO LEFT" : "ENTER LEFT TO RIGHT ➡"}
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
          <button key={i} className={`bomb-numpad-btn ${k === "del" ? "bomb-numpad-del" : ""}`} onPointerDown={() => handleKey(k)}>
            {k === "del" ? "⌫" : k}
          </button>
        ))}
      </div>
      {failed && <p className="bomb-code-err">WRONG CODE — TRY AGAIN</p>}
    </div>
  );
}

/* ── Watch Challenge Display ── */
function WatchChallenge({ action }: { action: BombAction }) {
  if (action.type === "tap") {
    return (
      <div className="watch-challenge-content">
        <span className="watch-challenge-type">TAP</span>
        <span className="watch-challenge-value">× {action.required}</span>
      </div>
    );
  }
  if (action.type === "swipe") {
    const half = Math.ceil(action.pattern.length / 2);
    const row1 = action.pattern.slice(0, half).map(d => ARROW_MAP[d]).join("  ");
    const row2 = action.pattern.slice(half).map(d => ARROW_MAP[d]).join("  ");
    return (
      <div className="watch-challenge-content">
        <span className="watch-challenge-type">SWIPE</span>
        <span className="watch-challenge-arrows">{row1}</span>
        {row2 && <span className="watch-challenge-arrows">{row2}</span>}
      </div>
    );
  }
  if (action.type === "code") {
    return (
      <div className="watch-challenge-content">
        <span className="watch-challenge-type">CODE  {action.direction === "rtl" ? "←" : "→"}</span>
        <span className="watch-challenge-value">{action.digits.slice(0, 4)}  {action.digits.slice(4)}</span>
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
}: Props) {
  const [isGlitching, setIsGlitching] = useState(false);
  const [glitchCountdown, setGlitchCountdown] = useState(3);
  const [challengeAttempt, setChallengeAttempt] = useState(0);
  const [completionGlitch, setCompletionGlitch] = useState(false);
  const [challengeTimeLimit, setChallengeTimeLimit] = useState(10);

  const isGlitchingRef = useRef(false);
  const glitchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isHolder = playerId === bombHolderId;
  const holder = players.find(p => p.id === bombHolderId);

  useEffect(() => {
    void gameStartTime;
    setChallengeTimeLimit(15);
  }, [bombHolderId, challengeAttempt, gameStartTime]);

  useEffect(() => {
    if (glitchTimerRef.current) clearInterval(glitchTimerRef.current);
    isGlitchingRef.current = false;
    setIsGlitching(false);
    setGlitchCountdown(3);
    setChallengeAttempt(0);
  }, [bombHolderId]);

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

  return (
    <div className={`bomb-crt-device ${completionGlitch ? "bomb-screen-glitch" : ""} ${isGlitching ? "bomb-punishment-active" : ""} ${!isHolder && gamePhase !== "exploded" ? "bomb-crt-watching" : ""}`}>
      <div className="screen-safe-area">
        <div className={`bomb-screen-content ${isHolder ? "bomb-screen-is-holder" : ""}`}>

          {isGlitching && isHolder && <PunishmentOverlay countdown={glitchCountdown} />}

          {gamePhase === "exploded" ? (
            /* ── Explosion Screen ── */
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
                      <span>{i === 0 ? "01" : `0${i + 1}`}</span>
                      <span className="bomb-score-name">{p.name.toUpperCase()}</span>
                      <span className="bomb-score-losses">×{p.losses}</span>
                    </div>
                  ))}
                </div>
                {isAdmin && <button className="bomb-submit-btn" onClick={onPlayAgain}>PLAY AGAIN</button>}
                {!isAdmin && <p className="bomb-watch-log">WAITING FOR HOST TO RESTART...</p>}
              </div>
            </div>
          ) : (
            <>
              {/* ── Player Strip ── */}
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

              {/* ── Bomb Health Bar (always visible) ── */}
              <BombHealthBar timerMs={timerMs} gameStartTime={gameStartTime} />

              {/* ── Holder Zone ── */}
              {isHolder ? (
                <div className="bomb-holder-zone">
                  <div className="bomb-visual">
                    <div className="bomb-body">💣</div>
                    <div className="bomb-fuse-text">YOU HAVE THE BOMB</div>
                  </div>

                  {!isGlitching && (
                    <div className="bomb-action-zone" key={`${bombHolderId}-${challengeAttempt}`}>
                      <ChallengeTimer timeLimit={challengeTimeLimit} onExpire={triggerPunishment} />
                      {action.type === "tap" && (
                        <TapAction
                          required={action.required}
                          onComplete={onCompleteAction}
                          onPunishment={triggerPunishment}
                          onGlitch={handleCompletionGlitch}
                        />
                      )}
                      {action.type === "swipe" && (
                        <SwipeAction
                          pattern={action.pattern}
                          onComplete={onCompleteAction}
                          onPunishment={triggerPunishment}
                        />
                      )}
                      {action.type === "code" && (
                        <CodeAction
                          digits={action.digits}
                          direction={action.direction}
                          onComplete={onCompleteAction}
                          onPunishment={triggerPunishment}
                        />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Watching Zone ── */
                <div className="bomb-watching-zone">
                  <p className="bomb-watch-log">[ MONITORING CHANNEL ACTIVE ]</p>
                  <div className="bomb-watch-challenge-wrap">
                    <p className="bomb-watch-holder-label">{(holder?.name ?? "???").toUpperCase()}</p>
                    <WatchChallenge action={action} />
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
