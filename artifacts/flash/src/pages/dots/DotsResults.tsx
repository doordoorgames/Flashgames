import { useEffect } from "react";
import { DotsAudio } from "./DotsAudio";

interface Props {
  round1ThiefId: string;
  round1ThiefName: string;
  round1Score: number;
  round2ThiefId: string;
  round2ThiefName: string;
  round2Score: number;
  winnerId: string | null;
  winnerName: string | null;
  caught: boolean;
  playerId: string;
  isAdmin: boolean;
  onRematch: () => void;
  onBack: () => void;
}

export default function DotsResults({
  round1ThiefName, round1Score,
  round2ThiefName, round2Score,
  winnerId, winnerName, caught,
  playerId, isAdmin, onRematch, onBack,
}: Props) {
  const iWon = winnerId === playerId;
  const tie = winnerId === null;

  useEffect(() => {
    if (iWon || tie) DotsAudio.victory();
  }, [iWon, tie]);

  return (
    <div className="dots-results-screen">
      <div className="dots-results-card">
        <div className="dots-results-header">
          {tie
            ? "🤝 TIE GAME"
            : `🏆 ${winnerName ?? "Winner"}!`}
        </div>

        {caught && (
          <div className="dots-results-caught-banner">
            Caught! Round ended early
          </div>
        )}

        <div className="dots-results-rounds">
          <div className="dots-results-round">
            <p className="dots-results-round-label">Round 1 — Thief</p>
            <p className="dots-results-round-player">{round1ThiefName}</p>
            <p className="dots-results-round-score">{round1Score}</p>
            <p className="dots-results-round-unit">windows claimed</p>
          </div>
          <div className="dots-results-vs">VS</div>
          <div className="dots-results-round">
            <p className="dots-results-round-label">Round 2 — Thief</p>
            <p className="dots-results-round-player">{round2ThiefName}</p>
            <p className="dots-results-round-score">{round2Score}</p>
            <p className="dots-results-round-unit">windows claimed</p>
          </div>
        </div>

        {!tie && (
          <div className="dots-results-winner-banner">
            {iWon ? "YOU WIN! 🎉" : `${winnerName} wins!`}
          </div>
        )}
        {tie && (
          <div className="dots-results-winner-banner dots-results-tie">
            TIED — {round1Score} each!
          </div>
        )}

        <div className="dots-results-actions">
          {isAdmin && (
            <button className="dots-action-btn" onClick={onRematch}>
              🔄 Rematch
            </button>
          )}
          <button className="back-btn" style={{ marginTop: 8 }} onClick={onBack}>
            ← Change Game
          </button>
        </div>
      </div>
    </div>
  );
}
