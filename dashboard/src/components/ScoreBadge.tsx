interface Props {
  score: number | null;
  size?: "sm" | "md";
}

export function scoreColor(score: number | null): string {
  if (score === null) return "var(--text-dim)";
  if (score >= 80) return "var(--score-hi)";
  if (score >= 50) return "var(--score-mid)";
  return "var(--score-lo)";
}

export function scoreBg(score: number | null): string {
  if (score === null) return "rgba(64,69,79,0.15)";
  if (score >= 80) return "rgba(34,197,94,0.12)";
  if (score >= 50) return "rgba(245,158,11,0.12)";
  return "rgba(239,68,68,0.12)";
}

export default function ScoreBadge({ score, size = "md" }: Props) {
  const label = score !== null ? String(Math.round(score)) : "—";
  const color = scoreColor(score);
  const bg = scoreBg(score);
  const px = size === "sm" ? "6px" : "8px";
  const py = size === "sm" ? "2px" : "3px";
  const fontSize = size === "sm" ? "11px" : "12px";

  return (
    <span
      className="inline-block rounded font-mono font-semibold tabular-nums"
      style={{
        color,
        background: bg,
        padding: `${py} ${px}`,
        fontSize,
        fontFamily: "JetBrains Mono, monospace",
        letterSpacing: "-0.02em",
        minWidth: size === "sm" ? "32px" : "38px",
        textAlign: "center",
      }}
    >
      {label}
    </span>
  );
}
