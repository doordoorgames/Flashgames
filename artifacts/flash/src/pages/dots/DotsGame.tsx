import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getSocket } from "@/lib/socket";
import { DotsAudio } from "./DotsAudio";
import darkBuilding from "@assets/D97470E6-AE6E-4295-84E3-A56D3F3E15D5_1780489207343.png";
import litBuilding from "@assets/8FB02617-28A8-4F70-9E10-F24EE18E0E04_1780489207343.png";

// ─── Exact window measurements (pixel-analysed from 936 × 1681 source images) ─
//
// GLASS_COLS / GLASS_ROWS  →  actual lit-glass area per cell (for CSS mask)
// CELL_COLS  / CELL_ROWS   →  interactive hitbox per cell (glass + half-gutter)
//
// All values in % of the image's natural dimensions.

const GLASS_COLS = [
  { left: 26.92, w: 7.05 },   // col 0 – px 252–317 / 936
  { left: 36.97, w: 7.05 },   // col 1 – px 346–411 / 936
  { left: 47.12, w: 6.94 },   // col 2 – px 441–505 / 936
  { left: 57.16, w: 6.94 },   // col 3 – px 535–599 / 936
  { left: 67.31, w: 6.94 },   // col 4 – px 630–694 / 936
] as const;

const GLASS_ROWS = [
  { top: 12.61, h: 5.77 },    // row 0 – px 212–308  / 1681
  { top: 20.29, h: 5.71 },    // row 1 – px 341–436  / 1681
  { top: 27.96, h: 5.65 },    // row 2 – px 470–564  / 1681
  { top: 35.57, h: 5.71 },    // row 3 – px 598–693  / 1681
  { top: 43.19, h: 5.71 },    // row 4 – px 726–821  / 1681
  { top: 50.80, h: 5.65 },    // row 5 – px 854–948  / 1681
  { top: 58.42, h: 5.65 },    // row 6 – px 982–1076 / 1681
  { top: 66.03, h: 5.65 },    // row 7 – px 1110–1204 / 1681
  { top: 73.65, h: 5.65 },    // row 8 – px 1238–1332 / 1681
] as const;

// Hitbox cells: midpoints of gutters between windows (contiguous, no gaps)
const CELL_COLS = [
  { left: 25.32, w: 10.10 },
  { left: 35.41, w: 10.10 },
  { left: 45.51, w: 10.04 },
  { left: 55.56, w: 10.10 },
  { left: 65.65, w: 10.10 },
] as const;

const CELL_ROWS = [
  { top: 11.63, h: 7.68 },
  { top: 19.31, h: 7.64 },
  { top: 26.95, h: 7.61 },
  { top: 34.56, h: 7.64 },
  { top: 42.21, h: 7.61 },
  { top: 49.82, h: 7.59 },
  { top: 57.41, h: 7.61 },
  { top: 65.02, h: 7.61 },
  { top: 72.63, h: 7.59 },
] as const;

const COLS           = 5;
const ROWS           = 9;
const THIEF_HOLD_MS  = 1000;
const CATCHER_HOLD_MS = 500;
const RING_CIRC      = 113.1; // 2π × 18

// ─── Role icons (flat vector silhouettes) ────────────────────────────────────
function ThiefIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="dots-role-svg" aria-hidden="true">
      {/* balaclava head */}
      <path d="M12 3C7.5 3 5 7 5 11c0 4 1.2 6 3 7v2h8v-2c1.8-1 3-3 3-7 0-4-2.5-8-7-8z" fill="white"/>
      {/* mask band */}
      <rect x="5" y="9.5" width="14" height="3.5" rx="1.75" fill="rgba(20,0,50,0.7)"/>
      {/* eye holes */}
      <ellipse cx="9" cy="11.25" rx="1.4" ry="1.2" fill="rgba(20,0,50,0.9)"/>
      <ellipse cx="15" cy="11.25" rx="1.4" ry="1.2" fill="rgba(20,0,50,0.9)"/>
    </svg>
  );
}

function CatcherIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="dots-role-svg" aria-hidden="true">
      {/* shield */}
      <path d="M12 3L20 7v6c0 4.5-3.5 7.5-8 9-4.5-1.5-8-4.5-8-9V7z" fill="white"/>
      {/* 5-point star */}
      <path d="M12 8.5l.9 2.8H16l-2.4 1.7.9 2.8L12 14l-2.5 1.8.9-2.8L8 11.3h3.1z" fill="rgba(50,30,0,0.55)"/>
    </svg>
  );
}

// ─── CSS mask-position correction ───────────────────────────────────────────
// mask-position: X% Y% follows the background-position formula:
//   actual_offset = (container_size − mask_size) × X / 100
// To place a mask with its top-left at "desired_pct" of the container:
//   corrected = desired_pct / (1 − mask_size_pct / 100)
function maskPos(desiredPct: number, maskSizePct: number) {
  return desiredPct / (1 - maskSizePct / 100);
}

interface Pos { x: number; y: number }

interface Props {
  code: string;
  playerId: string;
  role: "thief" | "catcher";
  cellColors?: string[];
  initialThiefPos?: Pos;
  roundEndTime: number;
  round: 1 | 2;
  thiefId: string;
  catcherId: string;
  playerNames: Record<string, string>;
}

function cellKey(x: number, y: number) { return `${x},${y}`; }

export default function DotsGame({
  code, playerId, role, roundEndTime, round,
  thiefId, catcherId, playerNames,
}: Props) {
  // Server-confirmed cells (driven by socket events from all players)
  const [claimedCells,   setClaimedCells]   = useState<Set<string>>(new Set());
  // Optimistic cells: lit immediately on thief's screen, before server confirmation
  const [optimisticCells, setOptimisticCells] = useState<Set<string>>(new Set());
  // Cells awaiting confirmation — block double-tap
  const pendingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Small error badge for rollbacks
  const [rollbackErr, setRollbackErr] = useState<string | null>(null);

  const [score,        setScore]        = useState(0);
  const [timeLeft,     setTimeLeft]     = useState(() =>
    Math.max(0, Math.floor((roundEndTime - Date.now()) / 1000))
  );
  const [holdKey,      setHoldKey]      = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [flashKeys,    setFlashKeys]    = useState<Map<string, number>>(new Map());
  const [overlay,      setOverlay]      = useState<"caught" | "timeup" | null>(null);
  const [active,       setActive]       = useState(true);

  const holdStartRef  = useRef<number>(0);
  const holdRafRef    = useRef<number>(0);
  const holdTargetRef = useRef<string | null>(null);
  const timerRef      = useRef(0);
  const socket = getSocket();

  // Merged view: everything lit on screen (confirmed ∪ optimistic)
  const litCells = useMemo(
    () => new Set([...claimedCells, ...optimisticCells]),
    [claimedCells, optimisticCells]
  );

  const thiefName   = playerNames[thiefId]   ?? "Thief";
  const catcherName = playerNames[catcherId] ?? "Catcher";
  const myName      = playerNames[playerId]  ?? "You";

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.floor((roundEndTime - Date.now()) / 1000));
      setTimeLeft(left);
      if (left <= 10 && left > 0 && left % 2 === 0) DotsAudio.timerWarn();
      timerRef.current = window.setTimeout(tick, 200);
    };
    timerRef.current = window.setTimeout(tick, 200);
    return () => clearTimeout(timerRef.current);
  }, [roundEndTime]);

  // ── Socket events ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onClaimed = ({ x, y, score: s }: { x: number; y: number; score: number }) => {
      const k = cellKey(x, y);
      // Move from optimistic → confirmed. Clear any pending rollback timer.
      const pt = pendingTimeoutsRef.current.get(k);
      if (pt !== undefined) {
        clearTimeout(pt);
        pendingTimeoutsRef.current.delete(k);
      }
      setOptimisticCells(prev => { const n = new Set(prev); n.delete(k); return n; });
      setClaimedCells(prev => new Set([...prev, k]));
      setScore(s);
      DotsAudio.claim();
    };

    const onMiss = ({ x, y }: { x: number; y: number }) => {
      const k = cellKey(x, y);
      DotsAudio.searchMiss();
      const id = Date.now();
      setFlashKeys(prev => new Map([...prev, [k, id]]));
      setTimeout(() => {
        setFlashKeys(prev => {
          if (prev.get(k) !== id) return prev;
          const next = new Map(prev);
          next.delete(k);
          return next;
        });
      }, 700);
    };

    const onRoundOver = ({ caught }: { caught: boolean }) => {
      setActive(false);
      setOverlay(caught ? "caught" : "timeup");
      if (caught) DotsAudio.caught();
    };

    socket.on("dots:cell-claimed", onClaimed);
    socket.on("dots:search-miss",  onMiss);
    socket.on("dots:round-over",   onRoundOver);
    return () => {
      socket.off("dots:cell-claimed", onClaimed);
      socket.off("dots:search-miss",  onMiss);
      socket.off("dots:round-over",   onRoundOver);
    };
  }, []);

  // ── Hold mechanics ─────────────────────────────────────────────────────────
  const cancelHold = useCallback(() => {
    if (holdRafRef.current) cancelAnimationFrame(holdRafRef.current);
    holdTargetRef.current = null;
    setHoldKey(null);
    setHoldProgress(0);
  }, []);

  const completeHold = useCallback((key: string) => {
    const [xs, ys] = key.split(",");
    const x = Number(xs), y = Number(ys);

    if (role === "thief") {
      // ── Optimistic update: light the window NOW, before the socket round-trip ──
      setOptimisticCells(prev => new Set([...prev, key]));

      // Schedule a rollback if the server doesn't confirm within 6 s
      const rollbackTimer = setTimeout(() => {
        pendingTimeoutsRef.current.delete(key);
        setOptimisticCells(prev => { const n = new Set(prev); n.delete(key); return n; });
        setRollbackErr("Window not saved — try again");
        setTimeout(() => setRollbackErr(null), 2500);
      }, 6000);
      pendingTimeoutsRef.current.set(key, rollbackTimer);

      // Fire-and-forget — UI is already updated above
      requestAnimationFrame(() => {
        socket.emit("dots:claim", { code, x, y });
      });
    } else {
      socket.emit("dots:search", { code, x, y });
    }
  }, [role, code]);

  const startHold = useCallback((key: string) => {
    // Spec: only one active action at a time — no implicit cancel of existing hold
    if (holdTargetRef.current !== null) return;
    holdTargetRef.current = key;
    holdStartRef.current  = Date.now();
    setHoldKey(key);
    setHoldProgress(0);

    const holdMs = role === "thief" ? THIEF_HOLD_MS : CATCHER_HOLD_MS;

    const animate = () => {
      if (holdTargetRef.current !== key) return; // cancelled externally
      const prog = Math.min(1, (Date.now() - holdStartRef.current) / holdMs);
      setHoldProgress(prog);
      if (prog < 1) {
        holdRafRef.current = requestAnimationFrame(animate);
      } else {
        holdTargetRef.current = null;
        setHoldKey(null);
        setHoldProgress(0);
        completeHold(key);
      }
    };
    holdRafRef.current = requestAnimationFrame(animate);
  }, [completeHold, role]);

  const handlePointerDown = useCallback((col: number, row: number) => {
    if (!active) return;
    if (holdKey !== null) return; // one ring at a time
    const key = cellKey(col, row);
    if (role === "thief") {
      // Block if already confirmed OR already optimistically lit (pending)
      if (!claimedCells.has(key) && !optimisticCells.has(key)) startHold(key);
    } else {
      startHold(key);
    }
  }, [active, role, claimedCells, optimisticCells, startHold, holdKey]);

  // ── CSS mask for precise lit-building reveal ───────────────────────────────
  // Each claimed cell unmasks exactly the glass area from the lit building image.
  // Uses the corrected mask-position formula so the reveal aligns pixel-perfectly.
  const litMask = useMemo(() => {
    if (litCells.size === 0) return "";
    return [...litCells].map(key => {
      const [c, r] = key.split(",").map(Number);
      const col = GLASS_COLS[c];
      const row = GLASS_ROWS[r];
      const px = maskPos(col.left, col.w);
      const py = maskPos(row.top,  row.h);
      return `linear-gradient(#fff 0 0) ${px.toFixed(4)}% ${py.toFixed(4)}% / ${col.w}% ${row.h}% no-repeat`;
    }).join(", ");
  }, [litCells]);

  // ── Timer display ──────────────────────────────────────────────────────────
  const urgent   = timeLeft <= 10;
  const timerStr = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}`;

  // ── Window cells ───────────────────────────────────────────────────────────
  const ringStroke  = role === "thief"
    ? "rgba(190,80,255,0.95)"   // purple for thief
    : "rgba(255,195,30,0.95)";  // gold  for catcher

  const windowCells = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const key       = cellKey(c, r);
        const cell      = CELL_COLS[c];
        const cellRow   = CELL_ROWS[r];
        const isHolding = holdKey === key;
        const isMiss    = flashKeys.has(key);

        const holdClass = isHolding
          ? ` window-cell-holding window-cell-holding-${role}`
          : "";

        out.push(
          <div
            key={key}
            className={`window-cell${isMiss ? " window-cell-miss" : ""}${holdClass}`}
            style={{
              left:   `${cell.left}%`,
              top:    `${cellRow.top}%`,
              width:  `${cell.w}%`,
              height: `${cellRow.h}%`,
            }}
            onPointerDown={(e) => { e.preventDefault(); handlePointerDown(c, r); }}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
          >
            {isHolding && (
              <>
                {/* Role icon — appears immediately on tap */}
                <div className={`dots-window-icon dots-window-icon-${role}`}>
                  {role === "thief" ? <ThiefIcon /> : <CatcherIcon />}
                </div>
                {/* Progress ring filling over hold duration */}
                <svg className="dots-progress-ring" viewBox="0 0 44 44">
                  {/* Faint track */}
                  <circle
                    cx="22" cy="22" r="18"
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="3"
                  />
                  {/* Filling arc */}
                  <circle
                    cx="22" cy="22" r="18"
                    fill="none"
                    stroke={ringStroke}
                    strokeWidth="3.5"
                    strokeDasharray={`${holdProgress * RING_CIRC} ${RING_CIRC}`}
                    strokeLinecap="round"
                    style={{ transform: "rotate(-90deg)", transformOrigin: "22px 22px" }}
                  />
                </svg>
              </>
            )}
          </div>
        );
      }
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdKey, holdProgress, flashKeys, handlePointerDown, cancelHold, role, ringStroke]);

  return (
    <div className="dots-game-screen" style={{ touchAction: "none" }}>
      {/* ── Building (full height) ── */}
      <div className="building-wrap">
        <div className="building-container">
          {/* Dark building – always-visible base layer */}
          <img
            src={darkBuilding}
            className="building-img"
            alt=""
            draggable={false}
          />

          {/* Lit building – stacked on top, revealed only through CSS mask */}
          {litMask && (
            <img
              src={litBuilding}
              className="building-img building-lit"
              style={{ mask: litMask, WebkitMask: litMask } as React.CSSProperties}
              alt=""
              draggable={false}
            />
          )}

          {/* Invisible interaction cells */}
          {windowCells}

          {/* ── Floating HUD stickers ── */}
          <div className="hud-role" data-role={role} aria-label="role">
            {role === "thief" ? "THIEF" : "CATCHER"}
          </div>

          <div className={`hud-timer${urgent ? " hud-timer-urgent" : ""}`} aria-label="timer">
            {timerStr}
          </div>

          <div className="hud-round" aria-label="round">
            {round}/2
          </div>

          {/* Optimistic rollback error */}
          {rollbackErr && (
            <div className="dots-rollback-err">{rollbackErr}</div>
          )}

          {/* Round-end overlay */}
          {overlay && (
            <div className="building-overlay">
              {overlay === "caught" ? (
                <>
                  <div className="dots-overlay-title dots-overlay-caught">CAUGHT!</div>
                  <p className="dots-overlay-sub">The thief was found</p>
                </>
              ) : (
                <>
                  <div className="dots-overlay-title">TIME'S UP!</div>
                  <p className="dots-overlay-sub">{score} window{score !== 1 ? "s" : ""} claimed</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Hint ── */}
      <div className="dots-hint-bar">
        {role === "thief"
          ? "Hold any window to light it up · Claim as many as you can!"
          : "Hold any window to search · Find where the thief is hiding!"}
      </div>
    </div>
  );
}
