import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getSocket } from "@/lib/socket";
import { DotsAudio } from "./DotsAudio";
import darkBuilding from "@assets/D97470E6-AE6E-4295-84E3-A56D3F3E15D5_1780489207343.png";
import litBuilding from "@assets/8FB02617-28A8-4F70-9E10-F24EE18E0E04_1780489207343.png";

// ─── Grid constants (% of image dimensions) ──────────────────────────────────
// Adjust these if the hit areas need fine-tuning to match the building windows
const COLS = 5;
const ROWS = 9;
const GRID_LEFT  = 19.5;  // left edge of column 0 (% of image width)
const GRID_TOP   = 9.2;   // top edge of row 0 (% of image height)
const COL_W      = 12.2;  // width per column  (% of image width)
const ROW_H      =  6.0;  // height per row    (% of image height)
const PAD        =  0.4;  // inset padding for mask reveal (avoids concrete frame)

const HOLD_MS   = 950;
const RING_CIRC = 113.1;  // 2π × 18

interface Pos { x: number; y: number }

interface Props {
  code: string;
  playerId: string;
  role: "thief" | "catcher";
  cellColors?: string[];   // kept for API compat, not used
  initialThiefPos?: Pos;
  roundEndTime: number;
  round: 1 | 2;
  thiefId: string;
  catcherId: string;
  playerNames: Record<string, string>;
}

function cellKey(x: number, y: number) { return `${x},${y}`; }

function getWindowPct(col: number, row: number) {
  const left = GRID_LEFT + col * COL_W;
  const top  = GRID_TOP  + row * ROW_H;
  return {
    left, top, w: COL_W, h: ROW_H,
    maskLeft: left + PAD,
    maskTop:  top  + PAD,
    maskW: COL_W - PAD * 2,
    maskH: ROW_H  - PAD * 2,
  };
}

export default function DotsGame({
  code, playerId, role, roundEndTime, round,
  thiefId, catcherId, playerNames,
}: Props) {
  const [claimedCells, setClaimedCells] = useState<Set<string>>(new Set());
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

  const thiefName  = playerNames[thiefId]  ?? "Thief";
  const catcherName = playerNames[catcherId] ?? "Catcher";
  const myName     = playerNames[playerId]  ?? "You";

  // ── Timer ────────────────────────────────────────────────────────────────
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

  // ── Socket events ────────────────────────────────────────────────────────
  useEffect(() => {
    const onClaimed = ({ x, y, score: s }: { x: number; y: number; score: number }) => {
      setClaimedCells(prev => new Set([...prev, cellKey(x, y)]));
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

  // ── Hold mechanics ────────────────────────────────────────────────────────
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
      socket.emit("dots:claim",  { code, x, y });
    } else {
      socket.emit("dots:search", { code, x, y });
    }
  }, [role, code]);

  const startHold = useCallback((key: string) => {
    cancelHold();
    holdTargetRef.current = key;
    holdStartRef.current  = Date.now();
    setHoldKey(key);
    setHoldProgress(0);

    const animate = () => {
      const prog = Math.min(1, (Date.now() - holdStartRef.current) / HOLD_MS);
      setHoldProgress(prog);
      if (prog < 1) {
        holdRafRef.current = requestAnimationFrame(animate);
      } else {
        const target = holdTargetRef.current;
        holdTargetRef.current = null;
        setHoldKey(null);
        setHoldProgress(0);
        if (target) completeHold(target);
      }
    };
    holdRafRef.current = requestAnimationFrame(animate);
  }, [cancelHold, completeHold]);

  const handlePointerDown = useCallback((col: number, row: number) => {
    if (!active) return;
    const key = cellKey(col, row);
    if (role === "thief") {
      if (!claimedCells.has(key)) startHold(key);
    } else {
      startHold(key);
    }
  }, [active, role, claimedCells, startHold]);

  // ── CSS mask for lit-building reveal ─────────────────────────────────────
  const litMask = useMemo(() => {
    if (claimedCells.size === 0) return "";
    return [...claimedCells].map(key => {
      const [c, r] = key.split(",").map(Number);
      const { maskLeft, maskTop, maskW, maskH } = getWindowPct(c, r);
      return `linear-gradient(#fff 0 0) ${maskLeft}% ${maskTop}% / ${maskW}% ${maskH}% no-repeat`;
    }).join(", ");
  }, [claimedCells]);

  // ── Timer display ─────────────────────────────────────────────────────────
  const urgent    = timeLeft <= 10;
  const timerStr  = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}`;

  // ── Window cells ──────────────────────────────────────────────────────────
  const windowCells = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const key              = cellKey(c, r);
        const { left, top, w, h } = getWindowPct(c, r);
        const isHolding        = holdKey === key;
        const isMiss           = flashKeys.has(key);

        out.push(
          <div
            key={key}
            className={`window-cell${isMiss ? " window-cell-miss" : ""}${isHolding ? " window-cell-holding" : ""}`}
            style={{ left: `${left}%`, top: `${top}%`, width: `${w}%`, height: `${h}%` }}
            onPointerDown={(e) => { e.preventDefault(); handlePointerDown(c, r); }}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
          >
            {isHolding && (
              <svg className="dots-progress-ring" viewBox="0 0 44 44">
                <circle
                  cx="22" cy="22" r="18"
                  fill="none"
                  stroke="rgba(255,255,255,0.92)"
                  strokeWidth="3.5"
                  strokeDasharray={`${holdProgress * RING_CIRC} ${RING_CIRC}`}
                  strokeLinecap="round"
                  style={{ transform: "rotate(-90deg)", transformOrigin: "22px 22px" }}
                />
              </svg>
            )}
          </div>
        );
      }
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdKey, holdProgress, flashKeys, handlePointerDown, cancelHold]);

  return (
    <div className="dots-game-screen" style={{ touchAction: "none" }}>
      {/* ── Header ── */}
      <div className="dots-game-header">
        <div className="dots-role-badge" data-role={role}>
          {role === "thief" ? "🔴 THIEF" : "🔵 CATCHER"}
        </div>
        <div className={`dots-timer${urgent ? " dots-timer-urgent" : ""}`}>
          {timerStr}
        </div>
        <div className="dots-round-badge">ROUND {round}/2</div>
      </div>

      {/* ── Score bar ── */}
      <div className="dots-score-bar">
        <div className="dots-score-item">
          <span className="dots-score-label">{role === "thief" ? "WINDOWS" : "THIEF"}</span>
          <span className="dots-score-val">{score}</span>
        </div>
        <div className="dots-score-divider" />
        <div className="dots-score-item">
          <span className="dots-score-label">{role === "thief" ? thiefName : catcherName}</span>
          <span className="dots-score-name">{myName}</span>
        </div>
      </div>

      {/* ── Building grid ── */}
      <div className="building-wrap">
        <div className="building-container">
          {/* Dark building – always visible base */}
          <img
            src={darkBuilding}
            className="building-img"
            alt=""
            draggable={false}
          />

          {/* Lit building – revealed only for claimed windows via CSS mask */}
          {litMask && (
            <img
              src={litBuilding}
              className="building-img building-lit"
              style={{ mask: litMask, WebkitMask: litMask } as React.CSSProperties}
              alt=""
              draggable={false}
            />
          )}

          {/* Interaction overlay – invisible touch/click cells */}
          {windowCells}

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
