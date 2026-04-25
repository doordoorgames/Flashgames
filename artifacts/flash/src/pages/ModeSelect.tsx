interface ModeSelectProps {
  onSelectFlash: () => void;
  onSelectYesNo: () => void;
}

export default function ModeSelect({ onSelectFlash, onSelectYesNo }: ModeSelectProps) {
  return (
    <div className="mode-screen">
      <div className="mode-inner">
        <h1 className="mode-title">Choose Your Game</h1>
        <p className="mode-sub">Two games, one room code system</p>

        <div className="mode-cards">
          <button className="mode-card mode-card-flash" onClick={onSelectFlash}>
            <div className="mode-card-icon">⚡</div>
            <div className="mode-card-content">
              <span className="mode-card-name">Flash</span>
              <span className="mode-card-ar">لمحة</span>
              <p className="mode-card-desc">
                Watch the billboard flash. Guess what you saw before time runs out.
              </p>
              <div className="mode-card-tags">
                <span className="mode-tag">9 rounds</span>
                <span className="mode-tag">600 → 150ms</span>
                <span className="mode-tag">Memory</span>
              </div>
            </div>
          </button>

          <button className="mode-card mode-card-yesno" onClick={onSelectYesNo}>
            <div className="mode-card-icon">🚫</div>
            <div className="mode-card-content">
              <span className="mode-card-name">Yes / No</span>
              <span className="mode-card-ar">نعم / لا</span>
              <p className="mode-card-desc">
                Answer 10 questions without saying "yes" or "no". One slip and you're out.
              </p>
              <div className="mode-card-tags">
                <span className="mode-tag yn-tag">Interrogation</span>
                <span className="mode-tag yn-tag">10 questions</span>
                <span className="mode-tag yn-tag">Under pressure</span>
              </div>
            </div>
          </button>
        </div>

        <p className="mode-admin-note">
          Manage game content at <a href="/admin" className="admin-link">/admin</a>
        </p>
      </div>
    </div>
  );
}
