import { Html } from "@react-three/drei";
import type { SessionSummary } from "../api/types";
import { scoreColor } from "../components/ScoreBadge";

interface Props {
  session: SessionSummary;
  position: [number, number, number];
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NodeTooltip({ session, position }: Props) {
  const color = scoreColor(session.score);

  return (
    <Html
      position={position}
      distanceFactor={18}
      occlude={false}
      style={{ pointerEvents: "none" }}
    >
      <div
        style={{
          background: "rgba(11,13,16,0.82)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow:
            "0 0 28px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)",
          borderRadius: "7px",
          padding: "10px 13px",
          minWidth: "148px",
          fontSize: "11px",
          fontFamily: "JetBrains Mono, monospace",
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            color,
            fontSize: "20px",
            fontWeight: 700,
            lineHeight: 1,
            marginBottom: "6px",
            fontFamily: "Archivo, sans-serif",
            textShadow: `0 0 16px ${color}`,
          }}
        >
          {session.score !== null ? Math.round(session.score) : "—"}
        </div>
        <div style={{ color: "#7a8394", marginBottom: "2px" }}>
          {session.agent_name ?? "unknown"}
        </div>
        <div style={{ color: "#40454f" }}>
          {formatRelative(session.started_at)}
        </div>
        <div style={{ color: "#40454f", marginTop: "3px" }}>
          {session.files_changed} file{session.files_changed !== 1 ? "s" : ""}
          {" · "}
          <span style={{ color: "#22c55e" }}>+{session.lines_added}</span>
          {" "}
          <span style={{ color: "#ef4444" }}>−{session.lines_removed}</span>
        </div>
      </div>
    </Html>
  );
}
