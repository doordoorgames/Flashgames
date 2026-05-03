import { useState, useRef, useCallback } from "react";

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
  onCompleteAction: () => void;
  onPlayAgain: () => void;
}

const ARROW_MAP: Record<string, string> = { up: "↑", down: "↓", left: "←", right: "→" };
const ARROW_LABEL: Record<string, string> = { up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT" };

function TapAction({ required, onComplete, onGlitch }: { required: number; onComplete: () => void; onGlitch: () => void }) {
  const [taps, setTaps] = useState(0);
  const [flash, setFlash] = useState(false);
  const done = useRef(false);

  const dotSize = required > 20 ? 10 : required > 16 ? 13 : 16;

  const handleTap = useCallback(() => {
    if (done.current) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 80);
    setTaps(prev => {
      const next = prev + 1;
      if (next >= required && !done.current) {
        done.current = true;
        onGlitch();
        setTimeout(onComplete, 500);
      }
      return next;
    });
  }, [required, onComplete, onGlitch]);

  return (
    <div className="bomb-action-tap">
      <p className="bomb-action-label">Tap {required} times!</p>
      <div className="bomb-tap-progress" style={{ gap: dotSize > 13 ? 6 : 4 }}>
        {Array.from({ length: required }).map((_, i) => (
          <div
            key={i}
            className={`bomb-tap-dot ${i < taps ? "filled" : ""}`}
            style={{ width: dotSize, height: dotSize }}
          />
        ))}
      </div>
      <button
        className={`bomb-tap-btn ${flash ? "bomb-tap-flash" : ""}`}
        onPointerDown={handleTap}
      >
        TAP!
      </button>
    </div>
  );
}

function SwipeAction({ pattern, onComplete }: { pattern: string[]; onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const done = useRef(false);

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
    if (Math.abs(dx) > Math.abs(dy)) {
      handleSwipe(dx > 0 ? "right" : "left");
    } else {
      handleSwipe(dy > 0 ? "down" : "up");
    }
  };

  const row1 = pattern.slice(0, 5);
  const row2 = pattern.slice(5);

  return (
    <div className="bomb-action-swipe">
      <p className="bomb-action-label">Swipe the sequence!</p>
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
            const globalI = i + 5;
            return (
              <span key={i} className={`bomb-swipe-arrow ${globalI < step ? "done" : globalI === step ? "current" : "pending"}`}>
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
          {failed ? "Wrong! Try again" : `Swipe ${ARROW_LABEL[pattern[step]] ?? ""}`}
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

function CodeAction({ digits, direction, onComplete }: { digits: string; direction: "ltr" | "rtl"; onComplete: () => void }) {
  const [entered, setEntered] = useState("");
  const [failed, setFailed] = useState(false);
  const done = useRef(false);

  const isRtl = direction === "rtl";
  const targetAnswer = isRtl ? digits.split("").reverse().join("") : digits;

  const handleKey = useCallback((k: string) => {
    if (done.current) return;
    if (k === "del") {
      setEntered(prev => prev.slice(0, -1));
      return;
    }
    setEntered(prev => {
      if (prev.length >= 8) return prev;
      const next = prev + k;
      if (next.length === 8) {
        if (next === targetAnswer) {
          done.current = true;
          setTimeout(onComplete, 300);
        } else {
          setTimeout(() => { setFailed(false); setEntered(""); }, 700);
          setFailed(true);
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
      <p className="bomb-action-label">Type the code!</p>
      <div className="bomb-code-direction-label">
        {isRtl ? "⬅ Enter right to left" : "Enter left to right ➡"}
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
      {failed && <p className="bomb-code-err">Wrong code! Try again</p>}
    </div>
  );
}

export default function BombGame({ playerId, isAdmin, players, bombHolderId, action, gamePhase, loserId, loserName, onCompleteAction, onPlayAgain }: Props) {
  const [actionKey, setActionKey] = useState(0);
  const [glitching, setGlitching] = useState(false);
  const isHolder = playerId === bombHolderId;
  const holder = players.find(p => p.id === bombHolderId);

  const handleGlitch = useCallback(() => {
    setGlitching(true);
    setTimeout(() => setGlitching(false), 700);
  }, []);

  if (actionKey !== actionKey) void actionKey;

  if (gamePhase === "exploded") {
    const isLoser = playerId === loserId;
    return (
      <div className="bomb-explode-screen">
        <div className="bomb-explode-card">
          <div className="bomb-explode-icon">💥</div>
          <h2 className="bomb-explode-title">{isLoser ? "You were holding the bomb!" : "BOOM!"}</h2>
          <p className="bomb-explode-sub">
            <strong>{loserName}</strong> was holding the bomb when it exploded!
          </p>
          <div className="bomb-score-list">
            {[...players].sort((a, b) => a.losses - b.losses).map((p, i) => (
              <div key={p.id} className={`bomb-score-row ${p.id === playerId ? "bomb-score-me" : ""} ${p.id === loserId ? "bomb-score-loser" : ""}`}>
                <span>{i === 0 ? "🏆" : `#${i + 1}`}</span>
                <span className="bomb-score-name">{p.name}</span>
                <span className="bomb-score-losses">💥 {p.losses}</span>
              </div>
            ))}
          </div>
          {isAdmin && (
            <button className="bomb-submit-btn" onClick={onPlayAgain}>Play Again 💣</button>
          )}
          {!isAdmin && <p className="wait-host">Waiting for host to start again...</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`bomb-game-screen ${isHolder ? "bomb-holder-bg" : ""} ${glitching ? "bomb-screen-glitch" : ""}`}>
      <div className="bomb-top-bar">
        <div className="bomb-player-strip">
          {players.map(p => (
            <div key={p.id} className={`bomb-player-pill ${p.id === bombHolderId ? "bomb-pill-active" : ""} ${p.id === playerId ? "bomb-pill-me" : ""}`}>
              {p.id === bombHolderId && <span className="bomb-pill-icon">💣</span>}
              <span>{p.name}</span>
              {p.losses > 0 && <span className="bomb-pill-losses">×{p.losses}</span>}
            </div>
          ))}
        </div>
      </div>

      {isHolder ? (
        <div className="bomb-holder-zone">
          <div className="bomb-visual">
            <div className="bomb-body">💣</div>
            <div className="bomb-fuse-text">YOU HAVE THE BOMB</div>
          </div>
          <div className="bomb-action-zone" key={bombHolderId}>
            {action.type === "tap" && (
              <TapAction
                required={action.required}
                onComplete={onCompleteAction}
                onGlitch={handleGlitch}
              />
            )}
            {action.type === "swipe" && (
              <SwipeAction pattern={action.pattern} onComplete={onCompleteAction} />
            )}
            {action.type === "code" && (
              <CodeAction
                digits={action.digits}
                direction={action.direction}
                onComplete={onCompleteAction}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="bomb-watching-zone">
          <div className="bomb-watch-visual">💣</div>
          <p className="bomb-watch-name">{holder?.name ?? "..."}</p>
          <p className="bomb-watch-label">has the bomb</p>
          <div className="bomb-watching-players">
            {players.filter(p => p.id !== bombHolderId).map(p => (
              <span key={p.id} className={`bomb-watch-pill ${p.id === playerId ? "bomb-watch-me" : ""}`}>{p.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
