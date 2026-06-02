import { useEffect, useState } from "react";
import { DotsAudio } from "./DotsAudio";

interface Props {
  round1Score: number;
  round1ThiefId: string;
  playerNames: Record<string, string>;
  onAcknowledge: () => void;
}

export default function SwitchSides({ round1Score, round1ThiefId, playerNames, onAcknowledge }: Props) {
  const [countdown, setCountdown] = useState(3);
  const [acked, setAcked] = useState(false);
  const thiefName = playerNames[round1ThiefId] ?? "Player";

  useEffect(() => {
    DotsAudio.switchSides();
  }, []);

  useEffect(() => {
    if (acked) return;
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          setAcked(true);
          onAcknowledge();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [acked, onAcknowledge]);

  const handleTap = () => {
    if (acked) return;
    setAcked(true);
    onAcknowledge();
  };

  return (
    <div className="dots-switch-screen" onClick={handleTap}>
      <div className="dots-switch-inner">
        <div className="dots-switch-flash-bg" />

        <div className="dots-switch-content">
          <p className="dots-switch-label">ROUND 1 RESULT</p>
          <p className="dots-switch-score-line">
            <span className="dots-switch-name">{thiefName}</span>
            <span className="dots-switch-pts">{round1Score} pts</span>
          </p>

          <div className="dots-switch-title">
            SWITCH<br />SIDES
          </div>

          <p className="dots-switch-roles">
            🔴 Thief → Catcher &nbsp;·&nbsp; 🔵 Catcher → Thief
          </p>

          <div className="dots-switch-countdown">
            {acked ? (
              <span className="dots-switch-waiting">WAITING FOR OPPONENT…</span>
            ) : (
              <>
                <span className="dots-switch-count-num">{countdown}</span>
                <span className="dots-switch-tap">or tap to continue</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
