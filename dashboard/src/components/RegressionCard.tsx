import type { Regression } from "../api/types";

const SEVERITY_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: "Critical", color: "var(--score-lo)", bg: "rgba(239,68,68,0.1)" },
  high:     { label: "High",     color: "var(--score-lo)", bg: "rgba(239,68,68,0.07)" },
  medium:   { label: "Medium",   color: "var(--score-mid)", bg: "rgba(245,158,11,0.1)" },
  low:      { label: "Low",      color: "var(--text-muted)", bg: "rgba(122,131,148,0.1)" },
};

interface Props {
  regression: Regression;
}

export default function RegressionCard({ regression }: Props) {
  const sev = SEVERITY_STYLE[regression.severity] ?? SEVERITY_STYLE["low"]!;

  return (
    <div
      className="rounded p-3 space-y-2"
      style={{
        background: "var(--bg-overlay)",
        border: "1px solid var(--border-muted)",
        borderLeft: `3px solid ${sev.color}`,
        boxShadow: `inset 3px 0 14px ${sev.color}20`,
      }}
    >
      <div className="flex items-start gap-2">
        <span
          className="shrink-0 text-xs font-semibold rounded px-1.5 py-0.5 mt-0.5"
          style={{
            color: sev.color,
            background: sev.bg,
            fontFamily: "Archivo, sans-serif",
            letterSpacing: "0.04em",
          }}
        >
          {sev.label}
        </span>
        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
          {regression.description}
        </p>
      </div>

      {regression.file && (
        <p className="mono-sm truncate" style={{ color: "var(--text-muted)" }}>
          {regression.file}
        </p>
      )}

      {regression.hunk && (
        <pre
          className="text-xs rounded p-2 overflow-x-auto"
          style={{
            background: "var(--bg-base)",
            color: "var(--text-muted)",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            lineHeight: 1.6,
            maxHeight: "120px",
          }}
        >
          {regression.hunk.trim()}
        </pre>
      )}
    </div>
  );
}
