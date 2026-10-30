import BombApp from "../bomb/BombApp";
import "./BombV2.css";

/**
 * Separate experimental skin for the original multiplayer Bomb engine.
 * Socket events, rooms, challenges and timers are deliberately shared,
 * so the original /bomb and the existing /reactor remain unchanged.
 */
export default function BombV2App({ onBack }: { onBack: () => void }) {
  return (
    <main className="bomb-v2" aria-label="Bomb 3.0 — Midnight Workshop">
      <div className="bomb-v2-masthead" aria-hidden="true">
        <span className="bomb-v2-bolt">✦</span>
        <span>BOMB 3.0 · MIDNIGHT WORKSHOP</span>
        <span className="bomb-v2-bolt">✦</span>
      </div>
      <BombApp gameTitle="Bomb 3.0" onBack={onBack} />
    </main>
  );
}
