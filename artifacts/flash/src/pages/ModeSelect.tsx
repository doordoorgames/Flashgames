import { Link } from "wouter";

export default function ModeSelect() {
  return (
    <div className="mode-screen">
      <div className="mode-inner">
        <h1 className="mode-title">Choose Your Game</h1>
        <p className="mode-sub">Four games, one room code system</p>

        <div className="mode-cards">
          <Link href="/flash" className="mode-card mode-card-flash">
            <div className="mode-card-icon">⚡</div>
            <div className="mode-card-content">
              <span className="mode-card-name">Flash</span>
              <span className="mode-card-ar">لمحة</span>
              <p className="mode-card-desc">Watch the billboard flash. Guess what you saw before time runs out.</p>
              <div className="mode-card-tags">
                <span className="mode-tag">9 rounds</span>
                <span className="mode-tag">300 → 100ms</span>
                <span className="mode-tag">Memory</span>
              </div>
            </div>
          </Link>

          <Link href="/yesno" className="mode-card mode-card-yesno">
            <div className="mode-card-icon">🚫</div>
            <div className="mode-card-content">
              <span className="mode-card-name">Yes / No</span>
              <span className="mode-card-ar">نعم / لا</span>
              <p className="mode-card-desc">Answer 10 questions without saying "yes" or "no". One slip and you're out.</p>
              <div className="mode-card-tags">
                <span className="mode-tag yn-tag">Interrogation</span>
                <span className="mode-tag yn-tag">10 questions</span>
                <span className="mode-tag yn-tag">Under pressure</span>
              </div>
            </div>
          </Link>

          <Link href="/bomb" className="mode-card mode-card-bomb">
            <div className="mode-card-icon">💣</div>
            <div className="mode-card-content">
              <span className="mode-card-name">The Bomb</span>
              <span className="mode-card-ar">القنبلة</span>
              <p className="mode-card-desc">Pass the bomb before it explodes! Complete the challenge fast or boom — you lose.</p>
              <div className="mode-card-tags">
                <span className="mode-tag bomb-tag">Hot potato</span>
                <span className="mode-tag bomb-tag">Hidden timer</span>
                <span className="mode-tag bomb-tag">Challenges</span>
              </div>
            </div>
          </Link>

          <Link href="/reactor" className="mode-card mode-card-bomb2">
            <div className="mode-card-icon mode-card-icon-reactor">☢</div>
            <div className="mode-card-content">
              <span className="mode-card-name">Reactor</span>
              <span className="mode-card-ar">BOMB 2.0</span>
              <p className="mode-card-desc">Reactor meltdown panic. One player defuses. Everyone else causes chaos. Deflect the bomb or detonate.</p>
              <div className="mode-card-tags">
                <span className="mode-tag b2-tag">Control Room</span>
                <span className="mode-tag b2-tag">Sabotage</span>
                <span className="mode-tag b2-tag">Meltdown</span>
              </div>
            </div>
          </Link>
        </div>

        <p className="mode-admin-note">
          Manage game content at <a href="/admin" className="admin-link">/admin</a>
        </p>
      </div>
    </div>
  );
}
