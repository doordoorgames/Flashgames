import { useState, useEffect, useRef, useCallback } from "react";
import { bombSounds } from "./BombSounds";
const SUPABASE_MAP_BASE = "https://qvzxjtyvbfexuhmmqbzl.supabase.co/storage/v1/object/public/backgrounds";
function countryMapUrl(name: string) { return `${SUPABASE_MAP_BASE}/${encodeURIComponent(name)}.jpeg`; }

export interface BombPlayer {
  id: string;
  name: string;
  losses: number;
  isAdmin: boolean;
}

export type BombAction =
  | { type: "tap"; required: number }
  | { type: "memory"; letters: string[] }
  | { type: "reactor"; safeMin: number; safeMax: number; startTemp: number }
  | { type: "code"; digits: string; direction: "ltr" | "rtl" }
  | { type: "wire"; words: string[]; taskType: "color" | "word"; target: string }
  | { type: "country"; target: string; choices: string[] };

export type InputProgress =
  | { type: "tap"; taps: number; required: number }

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

const FLAP_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const FLAP_KEYBOARD = Array.from(FLAP_CHARS);

// Fixed physical colors per position (0=top-left … 5=bottom-right) — matches IMG_2019.png
const WIRE_PHYSICAL = ["Red", "Blue", "Green", "Yellow", "Purple", "Orange"] as const;
const WIRE_LABEL_CSS: Record<string, string> = {
  Red: "#ff3344", Blue: "#3388ff", Green: "#00ff88",
  Yellow: "#ffee00", Purple: "#cc44ff", Orange: "#ff8800",
};
const WIRE_IMAGE = "https://qvzxjtyvbfexuhmmqbzl.supabase.co/storage/v1/object/public/backgrounds/Wires.png";

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
      {muted ? "MUTE" : "SND"}
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
    action.type === "wire" ? "CUT  THE  CORRECT  WIRE" :
    action.type === "country" ? `ASK  ${action.target.toUpperCase()}  FOR  HELP` :
    action.type === "memory" ? "MEMORIZE  THE  SEQUENCE" :
    action.type === "reactor" ? "CONTROL  THE  REACTOR" :
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
        <span className="bomb-health-title">// DETONATION TIMER</span>
        <span className="bomb-health-secs">{secsLeft}s</span>
      </div>
      <div className="bomb-health-track">
        <div className="bomb-health-fill" style={{ width: `${pct * 100}%`, background: fillColor }} />
      </div>
    </div>
  );
}

/* ── Challenge Timer ── */
function ChallengeTimer({ timeLimit, onExpire, penaltyCount = 0 }: {
  timeLimit: number;
  onExpire: () => void;
  penaltyCount?: number;
}) {
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
      <div className="chal-timer-label-row">
        <span className="chal-timer-label">[T] CHALLENGE</span>
      </div>
      {penaltyCount > 0 && (
        <div className="chal-penalty-stack">
          {Array.from({ length: penaltyCount }).map((_, i) => (
            <span key={i} className="chal-penalty-badge">-1 Second</span>
          ))}
        </div>
      )}
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
        {pendingStop ? "[STOP]  TAPPING!" : `TAP  ${required}  TIMES`}
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

/* ── Memory Scramble ── */
function MemoryScramble({ letters, onComplete, onPunishment }: {
  letters: string[];
  onComplete: () => void;
  onPunishment: () => void;
}) {
  const [phase, setPhase] = useState<"show" | "recall">("show");
  const [display, setDisplay] = useState<string[]>(letters.map(() => FLAP_CHARS[0]));
  const [settled, setSettled] = useState<boolean[]>(Array(6).fill(false));
  const [input, setInput] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const buf = [...display];
    const ivs: ReturnType<typeof setInterval>[] = [];
    const tos: ReturnType<typeof setTimeout>[] = [];

    letters.forEach((letter, i) => {
      const iv = setInterval(() => {
        buf[i] = FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];
        setDisplay([...buf]);
        bombSounds.flapClick();
      }, 55);
      ivs.push(iv);

      const settleAt = 500 + i * 300 + Math.random() * 100;
      tos.push(setTimeout(() => {
        clearInterval(ivs[i]);
        buf[i] = letter;
        setDisplay([...buf]);
        setSettled(prev => { const n = [...prev]; n[i] = true; return n; });
      }, settleAt));
    });

    const lastSettle = 500 + 5 * 300 + 100;
    tos.push(setTimeout(() => {
      ivs.forEach(clearInterval);
      setPhase("recall");
    }, lastSettle + 1800));

    return () => { ivs.forEach(clearInterval); tos.forEach(clearTimeout); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addLetter = useCallback((ch: string) => {
    if (submitted || done.current) return;
    setInput(prev => {
      if (prev.length >= 6) return prev;
      const next = [...prev, ch];
      if (next.length === 6) {
        done.current = true;
        setSubmitted(true);
        const ok = next.join("") === letters.join("");
        if (ok) {
          bombSounds.memoryCorrect();
          setTimeout(onComplete, 700);
        } else {
          bombSounds.memoryWrong();
          setWrongFlash(true);
          setTimeout(() => { setWrongFlash(false); setSubmitted(false); done.current = false; setInput([]); }, 800);
          onPunishment();
        }
      }
      return next;
    });
  }, [letters, onComplete, onPunishment, submitted]);

  const delLetter = useCallback(() => {
    if (submitted) return;
    setInput(prev => prev.slice(0, -1));
  }, [submitted]);

  if (phase === "show") {
    return (
      <div className="memory-show">
        <div className="memory-label">MEMORIZE THE SEQUENCE</div>
        <div className="memory-flap-row">
          {letters.map((_, i) => (
            <div key={i} className={`memory-flap-cell ${settled[i] ? "memory-flap-settled" : "memory-flap-cycling"}`}>
              {display[i]}
            </div>
          ))}
        </div>
        <div className="memory-sublabel">sequence will vanish…</div>
      </div>
    );
  }

  const slots = Array(6).fill(null).map((_, i) => input[i] ?? "");

  return (
    <div className="memory-recall">
      <div className="memory-label">ENTER THE SEQUENCE</div>
      <div className="memory-flap-row">
        {slots.map((ch, i) => (
          <div
            key={i}
            className={`memory-flap-cell memory-flap-recall ${wrongFlash ? "memory-flap-wrong" : ""} ${i === input.length && !submitted ? "memory-flap-cursor" : ""}`}
          >
            {ch}
          </div>
        ))}
      </div>
      <div className="memory-keyboard">
        {FLAP_KEYBOARD.map(ch => (
          <button key={ch} className="memory-key" onPointerDown={() => addLetter(ch)}>{ch}</button>
        ))}
        <button className="memory-key memory-key-del" onPointerDown={delLetter}>⌫</button>
      </div>
    </div>
  );
}

/* ── Reactor Temperature Control ── */
const REACTOR_DELTAS = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];

function ReactorControl({ safeMin, safeMax, startTemp, onComplete, onPunishment, onSafeChange }: {
  safeMin: number;
  safeMax: number;
  startTemp: number;
  onComplete: () => void;
  onPunishment: () => void;
  onSafeChange?: (inSafe: boolean) => void;
}) {
  const [temp, setTemp] = useState(startTemp);
  const done = useRef(false);
  const hasEnteredSafe = useRef(false);
  const outsideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insideTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors temp state so timer callbacks can read the current value without stale closures
  const tempRef = useRef(startTemp);

  // Stable refs so timer callbacks never capture stale closures
  const onCompleteRef   = useRef(onComplete);
  const onPunishmentRef = useRef(onPunishment);
  useEffect(() => { onCompleteRef.current   = onComplete;   }, [onComplete]);
  useEffect(() => { onPunishmentRef.current = onPunishment; }, [onPunishment]);

  // Chaotic drift: random up/down, random size, random timing — player must fight it
  useEffect(() => {
    let cancelled = false;
    function tick() {
      if (cancelled || done.current) return;
      setTemp(prev => {
        const dir = Math.random() < 0.5 ? 1 : -1;
        // 15 % chance of a big surge (5–9), otherwise a small nudge (1–4)
        const mag = Math.random() < 0.15
          ? 5 + Math.floor(Math.random() * 5)
          : 1 + Math.floor(Math.random() * 4);
        return Math.min(99, Math.max(0, prev + dir * mag));
      });
      // Next tick in 150–450 ms — unpredictable rhythm
      setTimeout(tick, 150 + Math.floor(Math.random() * 300));
    }
    tick();
    return () => { cancelled = true; };
  }, []);

  // Win / lose timers — lose only activates after player reaches safe zone first
  // NOTE: onComplete / onPunishment intentionally NOT in deps — use refs instead
  useEffect(() => {
    tempRef.current = temp; // keep ref in sync for use inside timer callbacks
    if (done.current) return;
    const inSafe = temp >= safeMin && temp <= safeMax;
    onSafeChange?.(inSafe); // let parent know current safe status for challenge-timer expiry
    if (inSafe) {
      hasEnteredSafe.current = true;
      if (outsideTimer.current) { clearTimeout(outsideTimer.current); outsideTimer.current = null; }
      if (!insideTimer.current) {
        insideTimer.current = setTimeout(() => {
          if (!done.current) { done.current = true; bombSounds.reactorCorrect(); setTimeout(() => onCompleteRef.current(), 500); }
          insideTimer.current = null;
        }, 10000);
      }
    } else {
      if (insideTimer.current) { clearTimeout(insideTimer.current); insideTimer.current = null; }
      // only penalise after player has first reached safe zone
      if (hasEnteredSafe.current && !outsideTimer.current) {
        outsideTimer.current = setTimeout(() => {
          if (!done.current) {
            // If player managed to get back into the safe zone before the 3s expired, pass instead of punish
            const stillInSafe = tempRef.current >= safeMin && tempRef.current <= safeMax;
            done.current = true;
            if (stillInSafe) {
              bombSounds.reactorCorrect();
              setTimeout(() => onCompleteRef.current(), 500);
            } else {
              bombSounds.reactorWrong();
              setTimeout(() => onPunishmentRef.current(), 200);
            }
          }
          outsideTimer.current = null;
        }, 3000);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temp, safeMin, safeMax]);

  // Clean up timers on unmount
  useEffect(() => () => {
    if (outsideTimer.current) clearTimeout(outsideTimer.current);
    if (insideTimer.current)  clearTimeout(insideTimer.current);
  }, []);

  const heat = useCallback(() => {
    if (done.current) return;
    const delta = 1 + Math.floor(Math.random() * 3); // 1–3 (smaller zone needs finer control)
    setTemp(prev => Math.min(99, prev + delta));
    bombSounds.reactorClick();
  }, []);

  const cool = useCallback(() => {
    if (done.current) return;
    const delta = 1 + Math.floor(Math.random() * 3); // 1–3
    setTemp(prev => Math.max(1, prev - delta));
    bombSounds.reactorClick();
  }, []);

  const inSafe = temp >= safeMin && temp <= safeMax;
  const pct = temp;
  const fillColor = temp < safeMin
    ? `hsl(${210 + Math.min((safeMin - temp) * 3, 30)},100%,58%)`
    : temp > safeMax
    ? `hsl(${Math.max(0, 28 - (temp - safeMax) * 2)},100%,55%)`
    : `hsl(145,100%,55%)`;

  return (
    <div className={`reactor-control ${inSafe ? "reactor-stable" : "reactor-unstable"}`}>
      <div className="reactor-header">REACTOR TEMPERATURE CONTROL</div>
      <div className="reactor-center-layout">
        <div className="reactor-gauge-wrapper">
          <div className="reactor-gauge-big">
            <div className="reactor-safe-zone" style={{ bottom: `${safeMin}%`, height: `${safeMax - safeMin}%` }} />
            <div className="reactor-fill" style={{ height: `${pct}%`, background: fillColor }} />
            <div className="reactor-indicator" style={{ bottom: `${pct}%`, borderColor: fillColor, boxShadow: `0 0 14px ${fillColor}, 0 0 4px #fff` }} />
          </div>
          <div className="reactor-sweet-label" style={{ bottom: `${(safeMin + safeMax) / 2}%` }}>
            <span className="reactor-sweet-arrow">◄</span>
            <div className="reactor-plaster">MAKE IT<br/>STAY HERE</div>
          </div>
        </div>
        <div className="reactor-temp-big" style={{ color: fillColor }}>{temp}°</div>
        <div className={`reactor-status ${inSafe ? "reactor-status-ok" : "reactor-status-danger"}`}>
          {inSafe ? "■ STABLE" : "▲ DANGER"}
        </div>
      </div>
      <div className="reactor-anime-buttons">
        <button className="reactor-anime-btn reactor-cool-btn" onPointerDown={cool}>
          ❄ COOL IT
        </button>
        <button className="reactor-anime-btn reactor-heat-btn" onPointerDown={heat}>
          🔥 HEAT IT
        </button>
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
            {k === "del" ? "DEL" : k}
          </button>
        ))}
      </div>
      {failed && <p className="bomb-code-err">✗ WRONG CODE — RETRY</p>}
    </div>
  );
}

/* ── Cut the Wire Action (Stroop image version) ── */
function CutWireAction({ words, taskType, target, onComplete, onPunishment }: {
  words: string[];
  taskType: "color" | "word";
  target: string;
  onComplete: () => void;
  onPunishment: () => void;
}) {
  const [tappedIdx, setTappedIdx] = useState<number | null>(null);
  const [wrongIdx, setWrongIdx]   = useState<number | null>(null);
  const [showInstr, setShowInstr] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setShowInstr(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Color task → correct position is the fixed physical slot; word task → find which slot has that label
  const correctIdx = taskType === "color"
    ? (WIRE_PHYSICAL as readonly string[]).indexOf(target)
    : words.indexOf(target);

  const handleTap = useCallback((idx: number) => {
    if (done.current || tappedIdx !== null || wrongIdx !== null) return;
    if (idx === correctIdx) {
      done.current = true;
      setTappedIdx(idx);
      bombSounds.wireSlice();
      setTimeout(onComplete, 750);
    } else {
      setWrongIdx(idx);
      bombSounds.wireWrong();
      setTimeout(() => setWrongIdx(null), 600);
      onPunishment();
    }
  }, [correctIdx, onComplete, onPunishment, tappedIdx, wrongIdx]);

  const accentColor = WIRE_LABEL_CSS[target] ?? "#ffffff";

  return (
    <div className="bomb-action-wire">
      <div className={`wire-instruction ${showInstr ? "wire-instruction-visible" : ""}`}>
        {taskType === "color"
          ? <>CUT THE{" "}<span className="wire-target-word" style={{ color: accentColor, textShadow: `0 0 16px ${accentColor}` }}>{target.toUpperCase()}</span>{" "}WIRE</>
          : <>CUT THE WIRE THAT SAYS{" "}<span className="wire-target-word" style={{ color: accentColor, textShadow: `0 0 16px ${accentColor}` }}>{target.toUpperCase()}</span></>
        }
      </div>
      {/* Full image — no cropping, natural proportions, object-fit: contain */}
      <div className="wire-image-container">
        <img src={WIRE_IMAGE} alt="" className="wire-bg-img" draggable={false} />
        {/* 6 invisible hitboxes, percentage-positioned over the actual wire bundles.
            Top row (0-2): Red / Blue / Green  |  Bottom row (3-5): Yellow / Purple / Orange */}
        {[0, 1, 2, 3, 4, 5].map(idx => {
          const isCorrect = tappedIdx === idx;
          const isWrong   = wrongIdx  === idx;
          return (
            <div
              key={idx}
              className={`wire-hitbox wire-hitbox-${idx}${isCorrect ? " wire-hitbox-correct" : ""}${isWrong ? " wire-hitbox-wrong" : ""}`}
              onPointerDown={() => handleTap(idx)}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── Ask Country Action ── */
function AskCountryAction({ target, choices, onComplete, onPunishment }: {
  target: string;
  choices: string[];
  onComplete: () => void;
  onPunishment: () => void;
}) {
  const [phase, setPhase] = useState<"intro" | "active">("intro");
  const [result, setResult] = useState<{ idx: number; correct: boolean } | null>(null);
  const done = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setPhase("active"), 1100);
    return () => clearTimeout(t);
  }, []);

  const handleChoice = useCallback((country: string, idx: number) => {
    if (done.current || result !== null) return;
    if (country === target) {
      done.current = true;
      setResult({ idx, correct: true });
      bombSounds.countryCorrect();
      setTimeout(onComplete, 700);
    } else {
      setResult({ idx, correct: false });
      bombSounds.countryWrong();
      setTimeout(() => setResult(null), 600);
      onPunishment();
    }
  }, [target, onComplete, onPunishment, result]);

  if (phase === "intro") {
    return (
      <div className="country-intro">
        <div className="country-intro-line1">WE NEED INTERNATIONAL ASSISTANCE</div>
        <div className="country-intro-line2">CONTACTING {target.toUpperCase()}…</div>
        <div className="country-radar-spin" />
      </div>
    );
  }

  return (
    <div className="bomb-action-country">
      <div className="country-instruction">
        LET'S ASK <span className="country-target-name">{target.toUpperCase()}</span> FOR HELP
      </div>
      <div className="country-grid">
        {choices.map((country, idx) => {
          const isCorrect = result?.idx === idx && result.correct;
          const isWrong   = result?.idx === idx && !result.correct;
          return (
            <div
              key={country}
              className={`country-card ${isCorrect ? "country-card-correct" : ""} ${isWrong ? "country-card-wrong" : ""}`}
              onPointerDown={() => handleChoice(country, idx)}
            >
              <div className="country-map-wrap">
                <img
                  src={countryMapUrl(country)}
                  alt=""
                  className="country-map-img"
                  draggable={false}
                />
                <div className="country-crt-overlay" />
              </div>
            </div>
          );
        })}
      </div>
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
  if (action.type === "memory") {
    return (
      <div className="watch-challenge-content">
        <span className="watch-challenge-type">MEMORY SCRAMBLE</span>
        <div className="watch-memory-row">
          {action.letters.map((l, i) => (
            <span key={i} className="watch-memory-letter">{l}</span>
          ))}
        </div>
      </div>
    );
  }
  if (action.type === "reactor") {
    return (
      <div className="watch-challenge-content">
        <span className="watch-challenge-type">REACTOR</span>
        <span className="watch-challenge-value">ZONE {action.safeMin}–{action.safeMax}°</span>
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
  if (action.type === "wire") {
    const accentColor = WIRE_LABEL_CSS[action.target] ?? "#fff";
    return (
      <div className="watch-challenge-content">
        <span className="watch-challenge-type">CUT THE WIRE</span>
        <span className="watch-challenge-value" style={{ color: accentColor, textShadow: `0 0 12px ${accentColor}` }}>
          {action.target.toUpperCase()}
        </span>
        <span className="watch-challenge-type" style={{ fontSize: "0.6rem", opacity: 0.6 }}>
          BY {action.taskType.toUpperCase()}
        </span>
      </div>
    );
  }
  if (action.type === "country") {
    return (
      <div className="watch-challenge-content">
        <span className="watch-challenge-type">ASK COUNTRY</span>
        <span className="watch-challenge-value">{action.target.toUpperCase()}</span>
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
        <div className="bomb-punishment-icon">!!</div>
        <div className="bomb-punishment-title">PENALTY</div>
        <div className="bomb-punishment-countdown">{countdown}</div>
        <div className="bomb-punishment-sub">// BOMB STILL ARMED //</div>
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
  const [penaltyCount, setPenaltyCount] = useState(0);

  const isGlitchingRef = useRef(false);
  const glitchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickStageRef = useRef(-1);
  // Tracks reactor safe state so the challenge-timer expiry can pass instead of punish
  const reactorInSafeRef = useRef(false);

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

  // Reset personal penalty count on new game
  useEffect(() => {
    setPenaltyCount(0);
  }, [gameStartTime]);

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
    setPenaltyCount(p => p + 1);
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

  // For the reactor task: if the challenge timer runs out while the gauge is in the
  // green zone, treat it as a success instead of punishing the player.
  const handleChallengeExpire = useCallback(() => {
    if (action?.type === "reactor" && reactorInSafeRef.current) {
      bombSounds.reactorCorrect();
      setTimeout(() => onCompleteAction(), 500);
    } else {
      triggerPunishment();
    }
  }, [action?.type, onCompleteAction, triggerPunishment]);

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

          <MuteButton />

          {gamePhase === "exploded" ? (
            <div className="bomb-explode-screen">
              <div className="bomb-explode-card">
                <div className="bomb-explode-icon">[!]</div>
                <div className="bomb-rip-block">
                  <div className="bomb-rip-text">RIP</div>
                  <div className="bomb-rip-name">"{loserName}"</div>
                </div>
                <p className="bomb-explode-sub">
                  was holding the bomb when it detonated
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
              {/* Hide player names during wire task — full image needs all the space */}
              {action?.type !== "wire" && (
                <div className="bomb-top-bar">
                  <div className="bomb-player-strip">
                    {players.map(p => (
                      <div key={p.id} className={`bomb-player-pill ${p.id === bombHolderId ? "bomb-pill-active" : ""} ${p.id === playerId ? "bomb-pill-me" : ""}`}>
                        {p.id === bombHolderId && <span className="bomb-pill-icon">◉</span>}
                        <span>{p.name.toUpperCase()}</span>
                        {p.losses > 0 && <span className="bomb-pill-losses">×{p.losses}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isHolder ? (
                <div className="bomb-holder-zone">
                  {isBriefing && (
                    <MissionBriefing
                      holderName={holder?.name ?? "???"}
                      action={action}
                      onDismiss={() => setIsBriefing(false)}
                    />
                  )}
                  <div className="bomb-play-container">
                    <div className="bomb-corners" aria-hidden="true" />
                    {isGlitching && <PunishmentOverlay countdown={glitchCountdown} />}
                    {/* Hide bomb body + fuse text during wire task to reclaim vertical space */}
                    {action?.type !== "wire" && (
                      <div className="bomb-visual">
                        <div className={`bomb-body ${timerClass}`}>◉</div>
                        <div className="bomb-fuse-text">// ARMED //</div>
                      </div>
                    )}
                    {!isBriefing && !isGlitching && (
                      <div className="bomb-action-zone" key={`${bombHolderId}-${challengeAttempt}`}>
                        {/* Hide challenge timer during wire task */}
                        {action?.type !== "wire" && (
                          <ChallengeTimer
                            timeLimit={Math.max(1, 16 - penaltyCount)}
                            onExpire={handleChallengeExpire}
                            penaltyCount={penaltyCount}
                          />
                        )}
                        {action.type === "tap" && (
                          <TapAction
                            required={action.required}
                            onComplete={onCompleteAction}
                            onPunishment={triggerPunishment}
                            onGlitch={handleCompletionGlitch}
                            onProgress={onProgress}
                          />
                        )}
                        {action.type === "memory" && (
                          <MemoryScramble
                            letters={action.letters}
                            onComplete={onCompleteAction}
                            onPunishment={triggerPunishment}
                          />
                        )}
                        {action.type === "reactor" && (
                          <ReactorControl
                            safeMin={action.safeMin}
                            safeMax={action.safeMax}
                            startTemp={action.startTemp}
                            onComplete={onCompleteAction}
                            onPunishment={triggerPunishment}
                            onSafeChange={(s) => { reactorInSafeRef.current = s; }}
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
                        {action.type === "wire" && (
                          <CutWireAction
                            words={action.words}
                            taskType={action.taskType}
                            target={action.target}
                            onComplete={onCompleteAction}
                            onPunishment={triggerPunishment}
                          />
                        )}
                        {action.type === "country" && (
                          <AskCountryAction
                            target={action.target}
                            choices={action.choices}
                            onComplete={onCompleteAction}
                            onPunishment={triggerPunishment}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bomb-watching-zone">
                  <div className="bomb-watch-container">
                    <div className="bomb-corners" aria-hidden="true" />
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
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
