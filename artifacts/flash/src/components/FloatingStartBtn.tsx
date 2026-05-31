interface Props {
  onClick: () => void;
  disabled?: boolean;
}

export default function FloatingStartBtn({ onClick, disabled }: Props) {
  return (
    <div className="fsb-wrap">
      {!disabled && <span className="fsb-badge">BEGIN GAME?</span>}
      <button
        className={`fsb-btn${disabled ? " fsb-disabled" : ""}`}
        onClick={disabled ? undefined : onClick}
        aria-label="Start game"
      >
        ✓
      </button>
    </div>
  );
}
