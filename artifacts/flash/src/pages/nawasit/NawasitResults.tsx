interface Pos { x: number; y: number }

interface Props {
  winner: "thief" | "catcher";
  reason: string;
  thiefPos: Pos;
  catcherPos: Pos;
  jewelPos: Pos;
  thiefName: string;
  catcherName: string;
  playerId: string;
  thiefId: string;
  catcherId: string;
  isAdmin: boolean;
  onRematch: () => void;
  onBack: () => void;
}

const COL_LABELS = ["A", "B", "C", "D", "E"];

function label(pos: Pos): string {
  return `${COL_LABELS[pos.x]}${pos.y + 1}`;
}

export default function NawasitResults({
  winner, reason,
  thiefPos, catcherPos, jewelPos,
  thiefName, catcherName,
  playerId, thiefId,
  isAdmin, onRematch, onBack,
}: Props) {
  const myRole = playerId === thiefId ? "thief" : "catcher";
  const iWon   = myRole === winner;

  return (
    <div className="nws-results">
      <div className="nws-results-inner">
        <div className={`nws-result-banner ${iWon ? "nws-winner" : "nws-loser"}`}>
          <div className="nws-result-emoji">{iWon ? "🏆" : "💀"}</div>
          <h1 className="nws-result-title">{iWon ? "You Win!" : "You Lose"}</h1>
          <p className="nws-result-reason">{reason}</p>
        </div>

        <div className="nws-result-roles">
          <div className="nws-result-role">
            <span className="nws-role-dot nws-thief-dot" />
            <strong>{thiefName}</strong>
            <span className="nws-role-label">Thief · {label(thiefPos)}</span>
            {winner === "thief" && <span className="nws-winner-tag">WINNER</span>}
          </div>
          <div className="nws-result-role">
            <span className="nws-role-dot nws-catcher-dot" />
            <strong>{catcherName}</strong>
            <span className="nws-role-label">Catcher · {label(catcherPos)}</span>
            {winner === "catcher" && <span className="nws-winner-tag">WINNER</span>}
          </div>
          <div className="nws-result-role">
            <span className="nws-role-dot nws-jewel-dot" />
            <strong>Jewel</strong>
            <span className="nws-role-label">{label(jewelPos)}</span>
          </div>
        </div>

        <div className="nws-result-actions">
          {isAdmin && (
            <button className="nawafeth-btn nawafeth-btn-create" onClick={onRematch}>
              <span className="nawafeth-btn-label">Play Again (swap roles)</span>
              <span className="nawafeth-btn-arrow">→</span>
            </button>
          )}
          {!isAdmin && <p className="nws-waiting-msg">Waiting for host to rematch…</p>}
          <button className="nawafeth-back-btn" style={{ marginTop: 12 }} onClick={onBack}>
            ← Back to menu
          </button>
        </div>
      </div>
    </div>
  );
}
