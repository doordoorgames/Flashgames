import { useState, useEffect, useCallback } from "react";
import { getSocket } from "@/lib/socket";

interface Pos { x: number; y: number }

interface GameState {
  role: "thief" | "catcher";
  thiefPos?: Pos;
  catcherPos: Pos;
  jewelPos?: Pos;
  currentTurn: "thief" | "catcher";
  catcherTimerEnd: number;
  playerNames: Record<string, string>;
  thiefId: string;
  catcherId: string;
}

interface DistanceData {
  distance: number;
  feedback: string;
}

interface Props {
  code: string;
  playerId: string;
  role: "thief" | "catcher";
  thiefId: string;
  catcherId: string;
  playerNames: Record<string, string>;
  initialState: GameState;
}

const COLS = 5;
const ROWS = 9;
const COL_LABELS = ["A", "B", "C", "D", "E"];
const TEST_MODE = true;

function posKey(p: Pos) { return `${p.x},${p.y}`; }
function colLabel(x: number) { return COL_LABELS[x] ?? "?"; }
function rowLabel(y: number) { return String(y + 1); }
function cellLabel(p: Pos)   { return `${colLabel(p.x)}${rowLabel(p.y)}`; }

function manhattan(a: Pos, b: Pos) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

function feedbackClass(fb: string) {
  if (fb === "CAUGHT!")     return "nws-fb-caught";
  if (fb === "VERY CLOSE")  return "nws-fb-very-close";
  if (fb === "CLOSE")       return "nws-fb-close";
  return "nws-fb-far";
}

export default function NawasitGame({ code, playerId, role, thiefId, catcherId, playerNames, initialState }: Props) {
  const [state,    setState]    = useState<GameState>(initialState);
  const [distance, setDistance] = useState<DistanceData | null>(null);
  const [timer,    setTimer]    = useState(0);

  const isMyTurn = state.currentTurn === role;
  const myName   = playerNames[playerId] ?? "You";
  const thiefName  = playerNames[thiefId]  ?? "Thief";
  const catcherName = playerNames[catcherId] ?? "Catcher";

  useEffect(() => {
    const socket = getSocket();

    socket.on("nws:state", (data: GameState) => {
      setState(data);
      if (data.currentTurn !== "catcher") setDistance(null);
    });

    socket.on("nws:distance", (data: DistanceData) => {
      setDistance(data);
    });

    return () => {
      socket.off("nws:state");
      socket.off("nws:distance");
    };
  }, []);

  useEffect(() => {
    if (state.currentTurn !== "catcher" || state.catcherTimerEnd === 0) {
      setTimer(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((state.catcherTimerEnd - Date.now()) / 1000));
      setTimer(remaining);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [state.currentTurn, state.catcherTimerEnd]);

  const move = useCallback((dir: string) => {
    if (!isMyTurn) return;
    getSocket().emit("nws:move", { code, dir });
  }, [code, isMyTurn]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isMyTurn) return;
      const map: Record<string, string> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right",
      };
      const dir = map[e.key];
      if (dir) { e.preventDefault(); move(dir); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isMyTurn, move]);

  const thiefPos   = state.thiefPos;
  const catcherPos = state.catcherPos;
  const jewelPos   = state.jewelPos;
  const myPos      = role === "thief" ? thiefPos : catcherPos;

  const debugDist = thiefPos && catcherPos ? manhattan(thiefPos, catcherPos) : null;

  return (
    <div className="nws-game">

      <div className="nws-header">
        <div className="nws-role-badge" data-role={role}>
          {role === "thief" ? "🕵️ Thief" : "🚔 Catcher"}
          <span className="nws-role-name">· {myName}</span>
        </div>
        <div className={`nws-turn-chip ${isMyTurn ? "nws-my-turn" : "nws-wait-turn"}`}>
          {isMyTurn ? "YOUR MOVE" : `${state.currentTurn === "thief" ? thiefName : catcherName}'s turn`}
        </div>
      </div>

      {role === "catcher" && state.currentTurn === "catcher" && (
        <div className={`nws-timer ${timer <= 2 ? "nws-timer-danger" : ""}`}>
          ⏱ {timer}s
        </div>
      )}

      {distance && (
        <div className={`nws-distance-feedback ${feedbackClass(distance.feedback)}`}>
          {distance.feedback}
        </div>
      )}

      <div className="nws-grid-wrap">
        <div className="nws-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
          {Array.from({ length: ROWS }, (_, rowIdx) => ROWS - 1 - rowIdx).flatMap((y) =>
            Array.from({ length: COLS }, (_, x) => {
              const key = `${x},${y}`;
              const isThief  = thiefPos  && posKey(thiefPos)  === key;
              const isCatcher = catcherPos && posKey(catcherPos) === key;
              const isJewel  = jewelPos  && posKey(jewelPos)  === key;
              const isMe     = myPos     && posKey(myPos)     === key;

              return (
                <div key={key} className={`nws-cell ${isMe ? "nws-cell-me" : ""}`}>
                  {TEST_MODE && (
                    <span className="nws-cell-coord">{colLabel(x)}{rowLabel(y)}</span>
                  )}
                  {isThief && role === "thief" && (
                    <span className="nws-dot nws-thief-dot" title={`Thief: ${cellLabel(thiefPos!)}`} />
                  )}
                  {isCatcher && (
                    <span className="nws-dot nws-catcher-dot" title={`Catcher: ${cellLabel(catcherPos!)}`} />
                  )}
                  {isJewel && role === "thief" && !isThief && (
                    <span className="nws-dot nws-jewel-dot" title={`Jewel: ${cellLabel(jewelPos!)}`} />
                  )}
                  {isJewel && isThief && (
                    <span className="nws-dot nws-jewel-dot nws-thief-dot nws-overlap" title="Thief on jewel!" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className={`nws-dpad ${!isMyTurn ? "nws-dpad-disabled" : ""}`}>
        <div className="nws-dpad-row">
          <button className="nws-dpad-btn nws-dpad-up"    onClick={() => move("up")}    aria-label="Up">▲</button>
        </div>
        <div className="nws-dpad-row">
          <button className="nws-dpad-btn nws-dpad-left"  onClick={() => move("left")}  aria-label="Left">◀</button>
          <div className="nws-dpad-center" />
          <button className="nws-dpad-btn nws-dpad-right" onClick={() => move("right")} aria-label="Right">▶</button>
        </div>
        <div className="nws-dpad-row">
          <button className="nws-dpad-btn nws-dpad-down"  onClick={() => move("down")}  aria-label="Down">▼</button>
        </div>
      </div>

      {TEST_MODE && (
        <div className="nws-dev-panel">
          <p className="nws-dev-title">🧪 Dev Panel</p>
          <div className="nws-dev-grid">
            <span>Thief</span>
            <span>{thiefPos ? cellLabel(thiefPos) : "?"}</span>
            <span>Catcher</span>
            <span>{cellLabel(catcherPos)}</span>
            <span>Jewel</span>
            <span>{jewelPos ? cellLabel(jewelPos) : "?"}</span>
            <span>Distance</span>
            <span>{debugDist ?? "?"}</span>
            <span>Turn</span>
            <span>{state.currentTurn}</span>
          </div>
        </div>
      )}
    </div>
  );
}
