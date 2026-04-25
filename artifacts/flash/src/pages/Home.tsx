interface HomeProps {
  onCreateGame: () => void;
  onJoinGame: () => void;
  onBack?: () => void;
}

export default function Home({ onCreateGame, onJoinGame, onBack }: HomeProps) {
  return (
    <div className="home-screen">
      <div className="home-inner">
        {onBack && <button className="back-btn" style={{ alignSelf: "flex-start" }} onClick={onBack}>← Games</button>}
        <div className="home-logo">
          <span className="logo-flash">Flash</span>
          <span className="logo-sep">/</span>
          <span className="logo-ar">لمحة</span>
        </div>
        <p className="home-tagline">How fast is your memory?</p>

        <div className="home-buttons">
          <button className="home-btn home-btn-join" onClick={onJoinGame}>
            <span className="home-btn-icon">🎮</span>
            <span className="home-btn-label">Join Game</span>
            <span className="home-btn-sub">Enter a room code</span>
          </button>
          <button className="home-btn home-btn-create" onClick={onCreateGame}>
            <span className="home-btn-icon">🎯</span>
            <span className="home-btn-label">Create Game</span>
            <span className="home-btn-sub">Host a new room</span>
          </button>
        </div>
      </div>
    </div>
  );
}
