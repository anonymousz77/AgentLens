interface Props {
  size?: number;
}

export default function LoadingSpinner({ size = 20 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--text-dim)"
      strokeWidth="2"
      strokeLinecap="round"
      aria-label="Loading"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
      <path d="M12 2 a10 10 0 0 1 10 10" />
    </svg>
  );
}
