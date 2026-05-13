import { useState, useEffect, useRef, useCallback } from "react";
import type { B2Player, B2Task, ReactorPhase, HolderInputEvent } from "./Bomb2App";

// ── Sound ─────────────────────────────────────────────────────────────────────
const audioCtx = (() => {
  try { return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); }
  catch { return null; }
})();
let humNode: OscillatorNode | null = null;
let humGain: GainNode | null = null;

function beep(freq: number, dur: number, vol = 0.18, type: OscillatorType = "square") {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.start(); o.stop(audioCtx.currentTime + dur);
}
function startHum(stability: number) {
  if (!audioCtx || humNode) return;
  humNode = audioCtx.createOscillator(); humGain = audioCtx.createGain();
  humNode.connect(humGain); humGain.connect(audioCtx.destination);
  humNode.type = "sawtooth"; humNode.frequency.value = 60 + (1 - stability / 100) * 80;
  humGain.gain.value = 0.04; humNode.start();
}
function updateHum(stability: number) {
  if (!humNode || !humGain) return;
  humNode.frequency.value = 60 + (1 - stability / 100) * 120;
  humGain.gain.value = 0.03 + (1 - stability / 100) * 0.06;
}
function stopHum() { humNode?.stop(); humNode = null; humGain = null; }
function alertBeep() { beep(880, 0.12); setTimeout(() => beep(660, 0.1), 140); }
function successBeep() { beep(520, 0.08, 0.15, "sine"); setTimeout(() => beep(780, 0.12, 0.15, "sine"), 80); }
function failBeep() { beep(220, 0.3, 0.2, "sawtooth"); }
function explodeSound() {
  beep(120, 0.5, 0.3, "sawtooth"); beep(80, 0.8, 0.25, "sawtooth");
  setTimeout(() => beep(60, 0.6, 0.2, "sawtooth"), 100);
}
function sabotageSound() { beep(1200, 0.06, 0.12, "square"); setTimeout(() => beep(300, 0.08, 0.1, "sawtooth"), 60); }
function stickerSound(type: "action" | "reactive" | "drama") {
  if (!audioCtx) return;
  if (type === "reactive") {
    beep(1100, 0.04, 0.14, "sawtooth"); setTimeout(() => beep(550, 0.06, 0.1, "square"), 45);
  } else if (type === "action") {
    beep(660, 0.05, 0.07, "square");
  } else {
    beep(280, 0.07, 0.07, "triangle");
  }
}
function bannerSound() {
  beep(180, 0.04, 0.1, "sawtooth"); setTimeout(() => beep(900, 0.09, 0.08, "square"), 55);
}

// ── Commentary pools ──────────────────────────────────────────────────────────
const DRAMA_EARLY = ["HE'S PANICKING", "EVERYONE IS WATCHING", "THE CLOCK IS TICKING", "WATCH CAREFULLY", "TENSION RISING"];
const DRAMA_LATE  = ["HE'S COOKED", "TOTAL DISASTER", "NOBODY IS SAFE", "THIS IS BAD", "PURE PANIC", "CHAOS DETECTED", "THIS ROUND IS CURSED", "SHE'S CHOKING", "SOMEONE STOP HIM", "THE ROOM IS TURNING"];
const SPECTATOR_EARLY = ["EVERYONE CAN SABOTAGE", "WATCH HIS INPUTS LIVE", "USE OVERHEAT TO DESTABILIZE", "HE CAN STILL FIGHT BACK"];
const SPECTATOR_LATE  = ["BLOCK HIM BEFORE HE FINISHES", "THEY'RE TURNING ON EACH OTHER", "SABOTAGE NOW", "GANG UP ON THE HOLDER"];
const TASK_HOLDER_STICKERS: Record<string, [string, string]> = {
  mash:   ["MASH IT BEFORE IT BLOWS",     "MASH FASTER — IT'S SLIPPING"],
  swipe:  ["FOLLOW THE SEQUENCE",          "WRONG ONE AND YOU BURN"],
  freeze: ["DO NOT TOUCH ANYTHING",        "STAY PERFECTLY STILL"],
  wires:  ["CUT THE CORRECT WIRE",         "ONE WRONG MOVE AND IT BLOWS"],
  code:   ["MEMORIZE — THEN ENTER IT",     "DON'T FORGET THE CODE"],
};

// ── Sticker system ────────────────────────────────────────────────────────────
interface Sticker { id: number; text: string; type: "action" | "reactive" | "drama"; side: "left" | "right"; rot: number; exiting: boolean; }

function usePhaseBanner() {
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);
  const keyRef = useRef(0);
  const showBanner = useCallback((text: string, durationMs = 2200) => {
    const key = ++keyRef.current;
    setBanner({ text, key });
    bannerSound();
    setTimeout(() => setBanner(b => (b?.key === key ? null : b)), durationMs);
  }, []);
  return { banner, showBanner };
}

function useStickers() {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const idRef = useRef(0);
  const addSticker = useCallback((text: string, type: Sticker["type"], durationMs = 3000) => {
    const id = ++idRef.current;
    const side: "left" | "right" = Math.random() < 0.5 ? "left" : "right";
    const rot = (Math.random() - 0.5) * 10;
    stickerSound(type);
    setStickers(prev => [...prev.slice(-1), { id, text, type, side, rot, exiting: false }]);
    setTimeout(() => setStickers(prev => prev.map(s => s.id === id ? { ...s, exiting: true } : s)), durationMs - 420);
    setTimeout(() => setStickers(prev => prev.filter(s => s.id !== id)), durationMs);
  }, []);
  return { stickers, addSticker };
}

// ── Phase Banner display ───────────────────────────────────────────────────────
function PhaseBannerDisplay({ banner }: { banner: { text: string; key: number } | null }) {
  if (!banner) return null;
  return (
    <div key={banner.key} className="b2-phase-banner">
      <span className="b2-phase-banner-text">{banner.text}</span>
    </div>
  );
}

// ── Sticker layer ─────────────────────────────────────────────────────────────
function StickerLayer({ stickers }: { stickers: Sticker[] }) {
  return (
    <div className="b2-sticker-layer" aria-hidden="true">
      {stickers.map((s, idx) => (
        <div
          key={s.id}
          className={[
            "b2-sticker",
            `b2-sticker-${s.type}`,
            `b2-sticker-${s.side}`,
            s.exiting ? "b2-sticker-exit" : "b2-sticker-enter",
          ].join(" ")}
          style={{
            "--rot": `${s.rot}deg`,
            "--sticker-offset": `${idx * 90}px`,
          } as React.CSSProperties}
        >
          {s.text}
        </div>
      ))}
    </div>
  );
}

// ── Live input feed (spectators) ──────────────────────────────────────────────
function HolderInputFeed({ inputs, holderName }: { inputs: HolderInputEvent[]; holderName: string }) {
  if (inputs.length === 0) return null;
  return (
    <div className="b2-input-feed">
      <span className="b2-input-feed-label">LIVE — {holderName.toUpperCase()}</span>
      <div className="b2-input-pills">
        {inputs.slice(-6).map((ev, i) => (
          <span key={i} className={`b2-input-pill ${ev.correct ? "b2-pill-correct" : "b2-pill-wrong"}`}>
            {ev.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Stability Bar ─────────────────────────────────────────────────────────────
function StabilityDisplay({ stability, reactorPhase }: { stability: number; reactorPhase: ReactorPhase }) {
  const bars = 10;
  const filled = Math.round((stability / 100) * bars);
  const stateLabel = reactorPhase === "calm" ? "STABLE" : reactorPhase === "heating" ? "HEATING UP" : reactorPhase === "critical" ? "!! CRITICAL !!" : "⚠ MELTDOWN ⚠";
  return (
    <div className={`b2-stability b2-stability-${reactorPhase}`}>
      <div className="b2-stability-label">{stateLabel}</div>
      <div className="b2-stability-bars">
        {Array.from({ length: bars }).map((_, i) => (
          <div key={i} className={`b2-stability-bar ${i < filled ? "b2-bar-filled" : "b2-bar-empty"}`} />
        ))}
      </div>
    </div>
  );
}

// ── Mash Task ─────────────────────────────────────────────────────────────────
function MashTask({ task, onComplete, onFail, reactorPhase, onInput }: {
  task: B2Task & { type: "mash" }; onComplete: () => void; onFail: () => void; reactorPhase: ReactorPhase; onInput: (ev: HolderInputEvent) => void;
}) {
  const [taps, setTaps] = useState(0);
  const done = useRef(false);
  const deadline = useRef(Date.now() + 10000);
  useEffect(() => {
    const iv = setInterval(() => { if (!done.current && Date.now() > deadline.current) { done.current = true; clearInterval(iv); failBeep(); onFail(); } }, 200);
    return () => clearInterval(iv);
  }, [onFail]);
  const tap = () => {
    if (done.current) return;
    const next = taps + 1; setTaps(next);
    beep(440 + next * 20, 0.04, 0.1, "square");
    onInput({ taskType: "mash", correct: true, label: `×${next}` });
    if (next >= task.target) { done.current = true; successBeep(); onComplete(); }
  };
  const pct = Math.min(1, taps / task.target);
  return (
    <div className="b2-task-wrap">
      <p className="b2-task-label">OVERHEAT CONTROL</p>
      <p className="b2-task-instruction">MASH THE BUTTON</p>
      <div className="b2-mash-progress"><div className="b2-mash-fill" style={{ width: `${pct * 100}%` }} /></div>
      <p className="b2-mash-count">{taps} / {task.target}</p>
      <button className={`b2-mash-btn b2-mash-${reactorPhase}`} onPointerDown={tap}>MASH</button>
    </div>
  );
}

// ── Swipe Task ────────────────────────────────────────────────────────────────
const SWIPE_ICONS: Record<string, string> = { up: "↑", down: "↓", left: "←", right: "→" };
function SwipeTask({ task, onComplete, onFail, onInput }: {
  task: B2Task & { type: "swipe" }; onComplete: () => void; onFail: () => void; onInput: (ev: HolderInputEvent) => void;
}) {
  const [step, setStep] = useState(0);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const done = useRef(false);
  const deadline = useRef(Date.now() + 12000);
  useEffect(() => {
    const iv = setInterval(() => { if (!done.current && Date.now() > deadline.current) { done.current = true; clearInterval(iv); failBeep(); onFail(); } }, 200);
    return () => clearInterval(iv);
  }, [onFail]);
  const press = (dir: string) => {
    if (done.current) return;
    const correct = dir === task.pattern[step];
    onInput({ taskType: "swipe", correct, label: SWIPE_ICONS[dir] });
    if (correct) {
      beep(660, 0.05, 0.12, "square"); setFlash("correct");
      const next = step + 1;
      if (next >= task.pattern.length) { done.current = true; successBeep(); onComplete(); return; }
      setStep(next);
    } else {
      setFlash("wrong"); failBeep();
      setTimeout(() => { if (!done.current) { done.current = true; onFail(); } }, 400);
    }
    setTimeout(() => setFlash(null), 180);
  };
  return (
    <div className="b2-task-wrap">
      <p className="b2-task-label">ALIGNMENT SEQUENCE</p>
      <p className="b2-task-instruction">FOLLOW THE PATTERN</p>
      <div className="b2-swipe-sequence">
        {task.pattern.map((d, i) => (<span key={i} className={`b2-seq-arrow ${i === step ? "b2-seq-active" : i < step ? "b2-seq-done" : "b2-seq-pending"}`}>{SWIPE_ICONS[d]}</span>))}
      </div>
      <div className={`b2-dir-grid ${flash === "correct" ? "b2-flash-correct" : flash === "wrong" ? "b2-flash-wrong" : ""}`}>
        {["up","left","right","down"].map(d => (<button key={d} className={`b2-dir-btn b2-dir-${d}`} onPointerDown={() => press(d)}>{SWIPE_ICONS[d]}</button>))}
      </div>
    </div>
  );
}

// ── Freeze Task ───────────────────────────────────────────────────────────────
function FreezeTask({ task, onComplete, onFail, onInput }: {
  task: B2Task & { type: "freeze" }; onComplete: () => void; onFail: () => void; onInput: (ev: HolderInputEvent) => void;
}) {
  const [status, setStatus] = useState<"holding" | "broken" | "done">("holding");
  const holdStart = useRef(Date.now());
  const done = useRef(false);
  const deadline = useRef(Date.now() + task.holdMs + 3500);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => {
      if (done.current) { clearInterval(iv); return; }
      if (Date.now() > deadline.current) { done.current = true; clearInterval(iv); failBeep(); onFail(); return; }
      if (status === "holding") {
        const elapsed = Date.now() - holdStart.current;
        setPct(Math.min(1, elapsed / task.holdMs));
        if (elapsed >= task.holdMs) { done.current = true; clearInterval(iv); setStatus("done"); successBeep(); onComplete(); }
      }
    }, 80);
    return () => clearInterval(iv);
  }, [status, task.holdMs, onComplete, onFail]);
  const touched = () => {
    if (done.current || status === "broken") return;
    done.current = true; setStatus("broken"); failBeep();
    onInput({ taskType: "freeze", correct: false, label: "MOVED" });
    setTimeout(() => onFail(), 400);
  };
  return (
    <div className="b2-task-wrap b2-freeze-wrap" onPointerDown={touched} onPointerMove={touched}>
      <p className="b2-task-label">CORE FREEZE PROTOCOL</p>
      <p className="b2-task-instruction" style={{ fontSize: status === "broken" ? "3rem" : "2.6rem", color: status === "broken" ? "#ff2200" : "#00e5ff" }}>
        {status === "broken" ? "BREACH DETECTED" : status === "done" ? "FROZEN" : "DO NOT TOUCH"}
      </p>
      {status === "holding" && <div className="b2-freeze-bar-track"><div className="b2-freeze-bar-fill" style={{ height: `${pct * 100}%` }} /></div>}
    </div>
  );
}

// ── Wires Task ────────────────────────────────────────────────────────────────
const WIRE_COLORS: Record<string, string> = { RED: "#ff2200", GREEN: "#00ff41", BLUE: "#00e5ff", YELLOW: "#ffcc00" };
function WiresTask({ task, onComplete, onFail, onInput }: {
  task: B2Task & { type: "wires" }; onComplete: () => void; onFail: () => void; onInput: (ev: HolderInputEvent) => void;
}) {
  const [cut, setCut] = useState<string | null>(null);
  const done = useRef(false);
  const deadline = useRef(Date.now() + 10000);
  useEffect(() => {
    const iv = setInterval(() => { if (!done.current && Date.now() > deadline.current) { done.current = true; clearInterval(iv); failBeep(); onFail(); } }, 200);
    return () => clearInterval(iv);
  }, [onFail]);
  const cutWire = (wire: string) => {
    if (done.current) return;
    const correct = wire === task.correctWire;
    setCut(wire); done.current = true;
    onInput({ taskType: "wires", correct, label: wire });
    if (correct) { successBeep(); setTimeout(onComplete, 350); }
    else { failBeep(); setTimeout(onFail, 350); }
  };
  return (
    <div className="b2-task-wrap">
      <p className="b2-task-label">WIRE DISCONNECT</p>
      <p className="b2-task-instruction">CUT THE <span style={{ color: WIRE_COLORS[task.correctWire] ?? "#fff" }}>{task.correctWire}</span> WIRE</p>
      <div className="b2-wires-grid">
        {task.wires.map(w => (
          <button key={w} className={`b2-wire-btn ${cut === w ? (w === task.correctWire ? "b2-wire-correct" : "b2-wire-wrong") : ""}`}
            style={{ "--wire-color": WIRE_COLORS[w] ?? "#fff" } as React.CSSProperties} onPointerDown={() => cutWire(w)} disabled={cut !== null}>
            <span className="b2-wire-line" /><span className="b2-wire-label">{w}</span><span className="b2-wire-line" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Code Task ─────────────────────────────────────────────────────────────────
function CodeTask({ task, onComplete, onFail, onInput }: {
  task: B2Task & { type: "code" }; onComplete: () => void; onFail: () => void; onInput: (ev: HolderInputEvent) => void;
}) {
  const [showing, setShowing] = useState(true);
  const [entered, setEntered] = useState("");
  const [failed, setFailed] = useState(false);
  const done = useRef(false);
  const deadline = useRef(Date.now() + task.showMs + 15000);
  useEffect(() => { const t = setTimeout(() => setShowing(false), task.showMs); return () => clearTimeout(t); }, [task.showMs]);
  useEffect(() => {
    const iv = setInterval(() => { if (!done.current && Date.now() > deadline.current) { done.current = true; clearInterval(iv); failBeep(); onFail(); } }, 200);
    return () => clearInterval(iv);
  }, [onFail]);
  const press = (k: string) => {
    if (done.current || showing) return;
    if (k === "del") { setEntered(e => e.slice(0, -1)); return; }
    const next = entered + k; setEntered(next);
    beep(440, 0.04, 0.08, "square");
    if (next.length === task.code.length) {
      const correct = next === task.code;
      onInput({ taskType: "code", correct, label: correct ? "✓" : "✗" });
      if (correct) { done.current = true; successBeep(); onComplete(); }
      else { failBeep(); setFailed(true); setTimeout(() => { setEntered(""); setFailed(false); }, 500); }
    }
  };
  return (
    <div className="b2-task-wrap">
      <p className="b2-task-label">REACTOR ACCESS CODE</p>
      {showing ? (
        <div className="b2-code-show"><p className="b2-task-instruction">MEMORIZE</p><p className="b2-code-reveal">{task.code}</p></div>
      ) : (
        <>
          <p className="b2-task-instruction">ENTER CODE</p>
          <div className={`b2-code-display ${failed ? "b2-code-fail" : ""}`}>
            {Array.from({ length: task.code.length }).map((_, i) => (<span key={i} className="b2-code-digit">{entered[i] ?? "_"}</span>))}
          </div>
          <div className="b2-numpad">
            {["1","2","3","4","5","6","7","8","9","","0","del"].map((k, i) => (
              <button key={i} className={`b2-numpad-btn ${k === "" ? "b2-numpad-empty" : ""}`} onPointerDown={() => k && press(k)} disabled={!k}>{k === "del" ? "⌫" : k}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Sabotage Button ───────────────────────────────────────────────────────────
function SabotageButton({ label, sub, type, color, onSabotage }: {
  label: string; sub: string; type: string; color: string; onSabotage: (t: string) => void;
}) {
  const [cooldown, setCooldown] = useState(false);
  const [fired, setFired] = useState(false);
  const fire = () => {
    if (cooldown) return; sabotageSound(); onSabotage(type);
    setFired(true); setCooldown(true);
    setTimeout(() => { setCooldown(false); setFired(false); }, 2500);
  };
  return (
    <button className={`b2-sab-btn ${cooldown ? "b2-sab-cooldown" : ""} ${fired ? "b2-sab-fired" : ""}`}
      style={{ "--sab-color": color } as React.CSSProperties} onPointerDown={fire} disabled={cooldown}>
      <span className="b2-sab-label">{label}</span>
      <span className="b2-sab-sub">{sub}</span>
      {cooldown && <div className="b2-sab-cooldown-bar" />}
    </button>
  );
}

// ── Main Game ─────────────────────────────────────────────────────────────────
interface Props {
  playerId: string; isAdmin: boolean; players: B2Player[];
  bombHolderId: string; task: B2Task | null;
  gamePhase: "playing" | "exploded"; roomPhase: "task" | "passing" | "catching" | "exploded";
  loserId: string | null; loserName: string | null;
  stability: number; reactorPhase: ReactorPhase;
  passCandidates: B2Player[]; passWindowMs: number;
  catchData: { fromName: string; windowMs: number; threshold: number } | null;
  catchTaps: number;
  holderInputLog: HolderInputEvent[];
  roundCount: number;
  onTaskComplete: () => void; onTaskFail: () => void;
  onThrowBomb: (targetId: string) => void; onCatchTap: () => void;
  onSabotage: (type: string) => void; onPlayAgain: () => void;
  onHolderInput: (ev: HolderInputEvent) => void;
  code: string;
}

export default function Bomb2Game({
  playerId, isAdmin, players, bombHolderId, task,
  gamePhase, roomPhase, loserId, loserName,
  stability, reactorPhase,
  passCandidates, catchData, catchTaps,
  holderInputLog, roundCount,
  onTaskComplete, onTaskFail, onThrowBomb, onCatchTap,
  onSabotage, onPlayAgain, onHolderInput, code,
}: Props) {
  const [localStability, setLocalStability] = useState(stability);
  const [localPhase, setLocalPhase] = useState(reactorPhase);
  const [shaking, setShaking] = useState(false);
  const [staticBurst, setStaticBurst] = useState(false);
  const [taskKey, setTaskKey] = useState(0);
  const muted = useRef(false);
  const prevRoomPhase = useRef<string>("");
  const prevStabilityBand = useRef<"calm" | "heating" | "critical" | "meltdown">("calm");
  const panicBannerShown = useRef(false);
  const meltdownBannerShown = useRef(false);
  const gameStartTime = useRef(Date.now());

  const { stickers, addSticker } = useStickers();
  const { banner, showBanner } = usePhaseBanner();

  const isHolder = playerId === bombHolderId;
  const holderName = players.find(p => p.id === bombHolderId)?.name ?? "???";
  const latestInput = holderInputLog[holderInputLog.length - 1] ?? null;

  // ── Sync stability ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLocalStability(stability); setLocalPhase(reactorPhase);
    if (!muted.current) updateHum(stability);
  }, [stability, reactorPhase]);

  // ── Game start hum ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (gamePhase === "playing") { startHum(stability); alertBeep(); gameStartTime.current = Date.now(); panicBannerShown.current = false; meltdownBannerShown.current = false; }
    return () => stopHum();
  }, []); // eslint-disable-line

  useEffect(() => { if (gamePhase === "exploded") { stopHum(); explodeSound(); } }, [gamePhase]);

  // ── Room phase transitions → banners + stickers ─────────────────────────────
  useEffect(() => {
    if (roomPhase === prevRoomPhase.current) return;
    prevRoomPhase.current = roomPhase;
    if (roomPhase === "task") {
      showBanner(isHolder ? "DEFUSE NOW" : "LIVE INPUT PHASE");
      if (isHolder && task) {
        const strs = TASK_HOLDER_STICKERS[task.type];
        setTimeout(() => addSticker(strs[roundCount < 2 ? 0 : 1], "action"), 900);
      } else {
        const pool = roundCount < 2 ? SPECTATOR_EARLY : SPECTATOR_LATE;
        setTimeout(() => addSticker(pool[Math.floor(Math.random() * pool.length)], "action"), 1200);
      }
      setTaskKey(k => k + 1);
    } else if (roomPhase === "passing") {
      showBanner("SELECT YOUR TARGET");
      if (isHolder) addSticker("THROW THE BOMB TO ANY PLAYER", "action");
    } else if (roomPhase === "catching") {
      showBanner("STEAL WINDOW ACTIVE");
      if (!isHolder) {
        const iTarget = catchData !== null;
        addSticker(iTarget ? "TAP FAST TO DEFLECT" : "HE CAN STILL FIGHT BACK", "action");
      }
    }
  }, [roomPhase]); // eslint-disable-line

  // ── Stability band transitions → drama banners ──────────────────────────────
  useEffect(() => {
    const band = localPhase;
    if (band === prevStabilityBand.current) return;
    prevStabilityBand.current = band;
    if (band === "critical" && !panicBannerShown.current) {
      panicBannerShown.current = true;
      showBanner("PANIC MODE");
      addSticker("THIS IS BAD", "drama", 3500);
    } else if (band === "meltdown" && !meltdownBannerShown.current) {
      meltdownBannerShown.current = true;
      showBanner("SUDDEN DEATH", 3000);
      addSticker(isHolder ? "YOU'RE RUNNING OUT OF TIME" : "HE'S COOKED", "drama", 4000);
    }
  }, [localPhase]); // eslint-disable-line

  // ── Spectator periodic drama stickers ───────────────────────────────────────
  useEffect(() => {
    if (gamePhase !== "playing" || isHolder) return;
    let cancelled = false;
    const fire = () => {
      if (cancelled) return;
      const pool = roundCount < 2 ? DRAMA_EARLY : DRAMA_LATE;
      addSticker(pool[Math.floor(Math.random() * pool.length)], "drama");
      const next = 9000 + Math.random() * 8000;
      setTimeout(fire, next);
    };
    const t = setTimeout(fire, 11000 + Math.random() * 6000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [gamePhase, isHolder]); // eslint-disable-line

  // ── Reactive stickers from holder inputs (for spectators) ───────────────────
  useEffect(() => {
    if (!latestInput || isHolder) return;
    if (latestInput.taskType === "swipe" && !latestInput.correct) addSticker("HE MISSED", "reactive", 2000);
    else if (latestInput.taskType === "swipe" && latestInput.correct && Math.random() < 0.25) addSticker("PERFECT HIT", "reactive", 1800);
    else if (latestInput.taskType === "freeze" && !latestInput.correct) addSticker("DEFUSE INTERRUPTED", "reactive", 2200);
    else if (latestInput.taskType === "wires" && !latestInput.correct) addSticker("WRONG WIRE", "reactive", 2200);
    else if (latestInput.taskType === "code" && !latestInput.correct) addSticker("WRONG CODE", "reactive", 2200);
  }, [latestInput]); // eslint-disable-line

  // ── Shake / static on sabotage ──────────────────────────────────────────────
  const prevSabRef = useRef<HolderInputEvent | null>(null);
  // (sabotage effects come through holderInputLog from parent — we handle via incoming prop instead)

  // ── Sabotage alert reactive stickers (triggered via separate prop mechanism) ─
  // handled in the useEffect below via the sabotageAlert string from parent
  // We don't have sabotageAlert prop now — we derive it from socket events in App
  // So we watch holderInputLog length changes for spectator stickers already above.

  // Shake + static from parent prop was removed — we use event-driven approach instead
  // Parent now passes sabotage effects as holderInputLog items with taskType "sabotage"

  // ── Shake trigger (detect sabotage events in holderInputLog) ────────────────
  useEffect(() => {
    if (!latestInput) return;
    if (latestInput.taskType === "sabotage_surge") {
      setShaking(true); setTimeout(() => setShaking(false), 600);
      if (isHolder) addSticker("POWER SURGE — BRACE", "reactive", 1800);
    } else if (latestInput.taskType === "sabotage_static") {
      setStaticBurst(true); setTimeout(() => setStaticBurst(false), 800);
      if (isHolder) addSticker("STATIC BURST", "reactive", 1800);
    } else if (latestInput.taskType === "sabotage_overheat") {
      addSticker("OVERHEAT DEPLOYED", "reactive", 2000);
    } else if (latestInput.taskType === "sabotage_coolant") {
      addSticker("COOLANT — STABILITY UP", "reactive", 2000);
    } else if (latestInput.taskType === "bomb_thrown") {
      showBanner("BOMB TRANSFERRED");
      addSticker(`${latestInput.label} THROWS IT`, "reactive", 2200);
    } else if (latestInput.taskType === "bomb_deflected") {
      showBanner("BOMB STOLEN");
      addSticker("CLOSE CALL — DEFLECTED", "reactive", 2200);
    } else if (latestInput.taskType === "task_fail") {
      showBanner("CRITICAL ERROR", 1800);
      addSticker("TASK FAILED", "reactive", 2200);
    } else if (latestInput.taskType === "task_success") {
      addSticker(Math.random() < 0.5 ? "PERFECT INPUT" : "CLEAN RECOVERY", "reactive", 2200);
    }
  }, [latestInput]); // eslint-disable-line

  const devClass = [
    "b2-device", `b2-reactor-${localPhase}`,
    shaking ? "b2-shake" : "",
    staticBurst ? "b2-static-burst" : "",
    gamePhase === "exploded" ? "b2-exploded" : "",
  ].filter(Boolean).join(" ");

  void code; void prevSabRef;

  return (
    <div className={devClass}>
      <div className="b2-scanlines" />
      <div className="b2-vignette" />
      <div className="b2-safe">
        <div className="b2-reactor-ring b2-ring-1" />
        <div className="b2-reactor-ring b2-ring-2" />
        <div className="b2-reactor-ring b2-ring-3" />

        {/* Sticker layer — pointer-events: none, never blocks gameplay */}
        <StickerLayer stickers={stickers} />

        <div className="b2-game-inner">
          {/* Mute */}
          <button className="b2-mute-btn" onPointerDown={() => { muted.current = !muted.current; if (muted.current) stopHum(); else startHum(localStability); }}>
            {muted.current ? "⊗ SFX" : "♪ SFX"}
          </button>

          {/* Phase banner */}
          {gamePhase !== "exploded" && <PhaseBannerDisplay banner={banner} />}

          {/* Stability */}
          {gamePhase !== "exploded" && <StabilityDisplay stability={localStability} reactorPhase={localPhase} />}

          {/* Player strip */}
          {gamePhase !== "exploded" && (
            <div className="b2-player-strip">
              {players.map(p => (
                <div key={p.id} className={`b2-player-pip ${p.id === bombHolderId ? "b2-pip-holder" : ""} ${p.id === playerId ? "b2-pip-me" : ""}`}>
                  {p.id === bombHolderId && <span className="b2-pip-bomb">☢</span>}
                  <span>{p.name.toUpperCase()}</span>
                  {p.losses > 0 && <span className="b2-pip-losses">×{p.losses}</span>}
                </div>
              ))}
            </div>
          )}

          {/* EXPLODED */}
          {gamePhase === "exploded" && (
            <div className="b2-explode-screen">
              <div className="b2-explode-card">
                <div className="b2-explode-icon">☢</div>
                <h2 className="b2-explode-title">REACTOR DETONATED</h2>
                <p className="b2-explode-sub"><strong>{loserName}</strong> WAS HOLDING THE BOMB</p>
                <div className="b2-score-list">
                  {[...players].sort((a, b) => a.losses - b.losses).map((p, i) => (
                    <div key={p.id} className={`b2-score-row ${p.id === playerId ? "b2-score-me" : ""} ${p.id === loserId ? "b2-score-loser" : ""}`}>
                      <span className="b2-score-rank">0{i + 1}</span>
                      <span className="b2-score-name">{p.name.toUpperCase()}</span>
                      <span className="b2-score-losses">×{p.losses}</span>
                    </div>
                  ))}
                </div>
                {isAdmin && <button className="b2-cyber-btn" onPointerDown={onPlayAgain}>▶ NEW REACTOR</button>}
                {!isAdmin && <p className="b2-waiting-log">[ AWAITING HOST ]</p>}
              </div>
            </div>
          )}

          {/* HOLDER — TASK */}
          {gamePhase !== "exploded" && isHolder && roomPhase === "task" && task && (
            <div className="b2-holder-zone">
              <div className="b2-holder-label">// YOU HOLD THE BOMB //</div>
              <div className="b2-task-container" key={taskKey}>
                {task.type === "mash"   && <MashTask   task={task} onComplete={onTaskComplete} onFail={onTaskFail} reactorPhase={localPhase} onInput={onHolderInput} />}
                {task.type === "swipe"  && <SwipeTask  task={task} onComplete={onTaskComplete} onFail={onTaskFail} onInput={onHolderInput} />}
                {task.type === "freeze" && <FreezeTask task={task} onComplete={onTaskComplete} onFail={onTaskFail} onInput={onHolderInput} />}
                {task.type === "wires"  && <WiresTask  task={task} onComplete={onTaskComplete} onFail={onTaskFail} onInput={onHolderInput} />}
                {task.type === "code"   && <CodeTask   task={task} onComplete={onTaskComplete} onFail={onTaskFail} onInput={onHolderInput} />}
              </div>
            </div>
          )}

          {/* HOLDER — PASS SELECTION */}
          {gamePhase !== "exploded" && isHolder && roomPhase === "passing" && (
            <div className="b2-pass-zone">
              <p className="b2-pass-title">// CHOOSE YOUR TARGET //</p>
              <p className="b2-pass-sub">THROW THE BOMB — PICK SOMEONE</p>
              <div className="b2-pass-targets">
                {passCandidates.map(p => (
                  <button key={p.id} className="b2-target-card" onPointerDown={() => onThrowBomb(p.id)}>
                    <span className="b2-target-icon">◎</span>
                    <span className="b2-target-name">{p.name.toUpperCase()}</span>
                    {p.losses > 0 && <span className="b2-target-losses">×{p.losses} deaths</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CATCH WINDOW (target) */}
          {gamePhase !== "exploded" && !isHolder && roomPhase === "catching" && catchData && (
            <div className="b2-catch-zone">
              <p className="b2-catch-title">INCOMING BOMB</p>
              <p className="b2-catch-from">FROM: {catchData.fromName.toUpperCase()}</p>
              <p className="b2-catch-sub">TAP FAST TO DEFLECT</p>
              <div className="b2-catch-progress"><div className="b2-catch-fill" style={{ width: `${Math.min(1, catchTaps / catchData.threshold) * 100}%` }} /></div>
              <p className="b2-catch-count">{catchTaps} / {catchData.threshold}</p>
              <button className="b2-catch-btn" onPointerDown={onCatchTap}>DEFLECT</button>
            </div>
          )}

          {/* CONTROL ROOM — task phase */}
          {gamePhase !== "exploded" && !isHolder && roomPhase === "task" && (
            <div className="b2-control-room">
              <p className="b2-cr-title">// CONTROL ROOM //</p>
              <p className="b2-cr-holder-label">ACTIVE OPERATIVE: <span className="b2-cr-holder-name">{holderName.toUpperCase()}</span></p>
              <HolderInputFeed inputs={holderInputLog} holderName={holderName} />
              <p className="b2-cr-sub">DEPLOY INTERFERENCE</p>
              <div className="b2-sab-grid">
                <SabotageButton label="OVERHEAT" sub="DESTABILIZE CORE" type="overheat" color="#ff3300" onSabotage={onSabotage} />
                <SabotageButton label="POWER SURGE" sub="SCREEN SHOCK" type="power_surge" color="#ff8800" onSabotage={onSabotage} />
                <SabotageButton label="STATIC BURST" sub="VISUAL NOISE" type="static_burst" color="#cc00ff" onSabotage={onSabotage} />
                <SabotageButton label="COOLANT" sub="HELP STABILITY" type="coolant" color="#00e5ff" onSabotage={onSabotage} />
              </div>
            </div>
          )}

          {/* Watching during pass/catch (spectators) */}
          {gamePhase !== "exploded" && !isHolder && (roomPhase === "passing" || (roomPhase === "catching" && !catchData)) && (
            <div className="b2-watching-zone">
              <p className="b2-cr-title">// CONTROL ROOM //</p>
              <p className="b2-watching-msg">
                {roomPhase === "passing" ? `${holderName.toUpperCase()} IS CHOOSING A TARGET...` : "BOMB IN TRANSIT..."}
              </p>
              <div className="b2-reactor-core-anim">
                <div className="b2-core-ring-a" /><div className="b2-core-ring-b" /><div className="b2-core-icon">☢</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
