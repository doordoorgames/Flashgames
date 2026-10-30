import { Link } from "wouter";

export default function ModeSelect() {
  return (
    <div className="mode-screen">
      <div className="mode-inner">
        <h1 className="mode-title">Choose Your Game</h1>
        <p className="mode-sub">Seven games, one room code system</p>

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

          <Link href="/bomb-v3" className="mode-card mode-card-bomb" style={{borderColor:"#d9aa5b",background:"linear-gradient(140deg,#273038,#15191d)"}}>
            <div className="mode-card-icon" aria-hidden="true">⚙</div>
            <div className="mode-card-content">
              <span className="mode-card-name" style={{color:"#f5cf88"}}>Bomb 3.0</span>
              <span className="mode-card-ar">MIDNIGHT WORKSHOP</span>
              <p className="mode-card-desc">A dangerous little machine with terrible manners. Pass it, beat the challenge, and pray it doesn’t choose you.</p>
              <div className="mode-card-tags"><span className="mode-tag">Workshop</span><span className="mode-tag">Multiplayer</span><span className="mode-tag">Experimental</span></div>
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

          <Link href="/nawasit" className="mode-card mode-card-nawasit">
            <div className="mode-card-icon">🕵️</div>
            <div className="mode-card-content">
              <span className="mode-card-name">Nawasit</span>
              <span className="mode-card-ar">نواصيت</span>
              <p className="mode-card-desc">1v1 hide-and-seek on a 5×9 grid. Thief steals the jewel. Catcher hunts blind with distance clues.</p>
              <div className="mode-card-tags">
                <span className="mode-tag nws-tag">1v1</span>
                <span className="mode-tag nws-tag">Turn-based</span>
                <span className="mode-tag nws-tag">Hidden info</span>
              </div>
            </div>
          </Link>

          <Link href="/dots" className="mode-card mode-card-dots">
            <div className="mode-card-icon">🎯</div>
            <div className="mode-card-content">
              <span className="mode-card-name">Dots</span>
              <span className="mode-card-ar">نقاط</span>
              <p className="mode-card-desc">1v1 chase. Thief steals dots, Catcher hunts blind. Swap roles after 45s. Highest score wins.</p>
              <div className="mode-card-tags">
                <span className="mode-tag dots-tag">1v1</span>
                <span className="mode-tag dots-tag">2 rounds</span>
                <span className="mode-tag dots-tag">Chase</span>
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
