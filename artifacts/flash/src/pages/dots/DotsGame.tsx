import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import { DotsAudio } from "./DotsAudio";

const COLS = 5;
const ROWS = 9;
const HOLD_MS = 950;
const RING_CIRC = 113.1; // 2π × 18

interface Pos { x: number; y: number }

interface Props {
  code: string;
  playerId: string;
  role: "thief" | "catcher";
  cellColors: string[];
  initialThiefPos?: Pos;
  roundEndTime: number;
  round: 1 | 2;
  thiefId: string;
  catcherId: string;
  playerNames: Record<string, string>;
}

function cellKey(x: number, y: number) { return `${x},${y}`; }

export default function DotsGame({
  code, playerId, role, cellColors,
  roundEndTime, round,
  thiefId, catcherId, playerNames,
}: Props) {
  const [claimedCells, setClaimedCells] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, Math.floor((roundEndTime - Date.now()) / 1000))
  );
  const [holdKey, setHoldKey] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [flashKeys, setFlashKeys] = useState<Map<string, number>>(new Map());
  const [overlay, setOverlay] = useState<"caught" | "timeup" | null>(null);
  const [active, setActive] = useState(true);

  const holdStartRef = useRef<number>(0);
  const holdRafRef = useRef<number>(0);
  const holdTargetRef = useRef<string | null>(null);
  const timerRef = useRef(0);
  const socket = getSocket();

  const thiefName = playerNames[thiefId] ?? "Thief";
  const catcherName = playerNames[catcherId] ?? "Catcher";
  const myName = playerNames[playerId] ?? "You";

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

  useEffect(() => {
    const onClaimed = ({ x, y, score: s }: { x: number; y: number; score: number }) => {
      setClaimedCells((prev) => new Set([...prev, cellKey(x, y)]));
      setScore(s);
      DotsAudio.claim();
    };
    const onMiss = ({ x, y }: { x: number; y: number }) => {
      const k = cellKey(x, y);
      DotsAudio.searchMiss();
      const id = Date.now();
      setFlashKeys((prev) => new Map([...prev, [k, id]]));
      setTimeout(() => {
        setFlashKeys((prev) => {
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
    socket.on("dots:search-miss", onMiss);
    socket.on("dots:round-over", onRoundOver);
    return () => {
      socket.off("dots:cell-claimed", onClaimed);
      socket.off("dots:search-miss", onMiss);
      socket.off("dots:round-over", onRoundOver);
    };
  }, []);

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
      socket.emit("dots:claim", { code, x, y });
    } else {
      socket.emit("dots:search", { code, x, y });
      DotsAudio.searchMiss();
    }
  }, [role, code]);

  const startHold = useCallback((key: string) => {
    cancelHold();
    holdTargetRef.current = key;
    holdStartRef.current = Date.now();
    setHoldKey(key);
    setHoldProgress(0);

    const animate = () => {
      const elapsed = Date.now() - holdStartRef.current;
      const prog = Math.min(1, elapsed / HOLD_MS);
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

  const handlePointerDown = useCallback((x: number, y: number) => {
    if (!active) return;
    const key = cellKey(x, y);
    if (role === "thief") {
      if (!claimedCells.has(key)) startHold(key);
    } else {
      startHold(key);
    }
  }, [active, role, claimedCells, startHold]);

  const urgent = timeLeft <= 10;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timerStr = `${minutes}:${String(seconds).padStart(2, "0")}`;

  const cells: React.ReactNode[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const idx = y * COLS + x;
      const key = cellKey(x, y);
      const isClaimed = claimedCells.has(key);
      const isHolding = holdKey === key;
      const isFlash = flashKeys.has(key);
      const color = cellColors[idx];

      let bg = "";
      let opacity = 1;
      let extraClass = "";

      if (role === "thief") {
        bg = color;
        if (isClaimed) {
          opacity = 1;
          extraClass = "dots-cell-claimed";
        } else {
          opacity = isHolding ? 0.85 : 0.4;
        }
      } else {
        if (isFlash) {
          bg = "#2a6aaa";
          extraClass = "dots-cell-flash";
        } else if (isClaimed) {
          bg = color;
          opacity = 0.9;
          extraClass = "dots-cell-claimed";
        } else {
          bg = "#0d1a2e";
        }
        if (isHolding) extraClass += " dots-cell-scanning";
      }

      cells.push(
        <div
          key={key}
          className={`dots-cell ${extraClass}`}
          style={{ background: bg, opacity }}
          onPointerDown={(e) => { e.preventDefault(); handlePointerDown(x, y); }}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onPointerCancel={cancelHold}
        >
          {isHolding && (
            <svg className="dots-progress-ring" viewBox="0 0 44 44">
              <circle
                cx="22" cy="22" r="18"
                fill="none"
                stroke="rgba(255,255,255,0.95)"
                strokeWidth="3.5"
                strokeDasharray={`${holdProgress * RING_CIRC} ${RING_CIRC}`}
                strokeLinecap="round"
                style={{ transform: "rotate(-90deg)", transformOrigin: "22px 22px" }}
              />
            </svg>
          )}
          {isClaimed && (
            <span className="dots-claim-check">✓</span>
          )}
        </div>
      );
    }
  }

  return (
    <div className="dots-game-screen" style={{ touchAction: "none" }}>
      <div className="dots-game-header">
        <div className="dots-role-badge" data-role={role}>
          {role === "thief" ? "🔴 THIEF" : "🔵 CATCHER"}
        </div>
        <div className={`dots-timer ${urgent ? "dots-timer-urgent" : ""}`}>
          {timerStr}
        </div>
        <div className="dots-round-badge">ROUND {round}/2</div>
      </div>

      <div className="dots-score-bar">
        <div className="dots-score-item">
          <span className="dots-score-label">
            {role === "thief" ? "SCORE" : "THIEF"}
          </span>
          <span className="dots-score-val">{score}</span>
        </div>
        <div className="dots-score-divider" />
        <div className="dots-score-item">
          <span className="dots-score-label">
            {role === "thief" ? thiefName : catcherName}
          </span>
          <span className="dots-score-name">{myName}</span>
        </div>
      </div>

      <div className="dots-grid-wrap">
        <div className="dots-grid">
          {cells}
        </div>
      </div>

      <div className="dots-hint-bar">
        {role === "thief"
          ? "Hold any dot to claim it · Claim as many as you can!"
          : "Hold any dot to search · Find the thief's last dot!"}
      </div>

      {overlay && (
        <div className="dots-overlay">
          {overlay === "caught" ? (
            <>
              <div className="dots-overlay-title dots-overlay-caught">CAUGHT!</div>
              <p className="dots-overlay-sub">The thief was found</p>
            </>
          ) : (
            <>
              <div className="dots-overlay-title">TIME'S UP!</div>
              <p className="dots-overlay-sub">Score: {score} dots</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
