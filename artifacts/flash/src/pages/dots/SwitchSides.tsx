import { useEffect, useState } from "react";
import { DotsAudio } from "./DotsAudio";
import litBuilding from "@assets/8FB02617-28A8-4F70-9E10-F24EE18E0E04_1780489207343.png";

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
      {/* Blurred lit-building background — same as home/lobby */}
      <div
        className="dots-switch-bg-blur"
        style={{ backgroundImage: `url(${litBuilding})` }}
      />
      {/* Dark overlay for text readability */}
      <div className="dots-switch-bg-overlay" />
      <div className="dots-switch-inner">

        <div className="dots-switch-content">
          <p className="dots-switch-label">ROUND 1 RESULT</p>
          <p className="dots-switch-score-line">
            <span className="dots-switch-name">{thiefName}</span>
            <span className="dots-switch-pts">{round1Score} pts</span>
          </p>

          <div className="dots-switch-title">
            <span className="dots-switch-word-left">SWITCH</span>
            <span className="dots-switch-word-right">SIDES</span>
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
