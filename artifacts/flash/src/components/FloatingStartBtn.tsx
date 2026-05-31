interface Props {
  onClick: () => void;
  disabled?: boolean;
}

export default function FloatingStartBtn({ onClick, disabled }: Props) {
  return (
    <button
      className={`fsb-btn${disabled ? " fsb-disabled" : ""}`}
      onClick={disabled ? undefined : onClick}
      aria-label="Start game"
    >
      ✓
    </button>
  );
}
