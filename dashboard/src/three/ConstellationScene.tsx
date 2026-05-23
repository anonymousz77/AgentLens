import { lazy, Suspense, useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { SessionSummary } from "../api/types";
import { scoreColor } from "../components/ScoreBadge";

const SessionConstellation = lazy(() => import("./SessionConstellation"));

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return (
      canvas.getContext("webgl2") !== null ||
      canvas.getContext("webgl") !== null
    );
  } catch {
    return false;
  }
}

// 2D scatter fallback when WebGL is unavailable
function ScatterFallback({ sessions }: { sessions: SessionSummary[] }) {
  const data = sessions.map((s) => ({
    score: s.score ?? 0,
    lines: s.lines_added + s.lines_removed,
    id: s.id,
  }));

  return (
    <div style={{ width: "100%", height: "100%", padding: "12px 0" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 2" />
          <XAxis
            dataKey="score"
            name="Score"
            domain={[0, 100]}
            tick={{ fill: "var(--text-dim)", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
            axisLine={false}
            tickLine={false}
            label={{ value: "Score", position: "insideBottom", offset: -2, fill: "var(--text-dim)", fontSize: 11 }}
          />
          <YAxis
            dataKey="lines"
            name="Lines changed"
            tick={{ fill: "var(--text-dim)", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: "var(--border)" }}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0]?.payload as { score: number; lines: number } | undefined;
              if (!d) return null;
              return (
                <div
                  style={{
                    background: "rgba(14,16,20,0.85)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "4px",
                    padding: "6px 10px",
                    fontSize: "11px",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  <p style={{ color: scoreColor(d.score) }}>Score: {d.score}</p>
                  <p style={{ color: "var(--text-muted)" }}>Lines: {d.lines}</p>
                </div>
              );
            }}
          />
          <Scatter data={data} fill="var(--score-hi)" opacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function LoadingCanvas() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-dim)",
        fontSize: "12px",
        fontFamily: "Hanken Grotesk, sans-serif",
      }}
    >
      Loading 3D scene…
    </div>
  );
}

interface Props {
  sessions: SessionSummary[];
  onSelect: (id: string) => void;
}

export default function ConstellationScene({ sessions, onSelect }: Props) {
  const reducedMotion = useReducedMotion() ?? false;
  const webgl = useMemo(() => hasWebGL(), []);

  if (!webgl || reducedMotion) {
    return <ScatterFallback sessions={sessions} />;
  }

  return (
    /* Vignette overlay sits above the Canvas */
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Suspense fallback={<LoadingCanvas />}>
        <SessionConstellation
          sessions={sessions}
          onSelect={onSelect}
          reducedMotion={reducedMotion}
        />
      </Suspense>
      {/* Cinematic vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 80% 75% at 50% 50%, transparent 35%, #07080a 100%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
        aria-hidden="true"
      />
    </div>
  );
}
