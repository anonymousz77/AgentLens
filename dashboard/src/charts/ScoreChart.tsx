import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { ScoreOverTimePoint } from "../api/types";
import { scoreColor } from "../components/ScoreBadge";

interface Props {
  data: ScoreOverTimePoint[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const score = payload[0]?.value as number | null;
  return (
    <div
      className="rounded px-3 py-2 text-sm"
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--border)",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "12px",
      }}
    >
      <p style={{ color: "var(--text-muted)" }}>{formatDate(label as string)}</p>
      <p style={{ color: scoreColor(score) }}>Score: {score ?? "—"}</p>
    </div>
  );
}

export default function ScoreChart({ data }: Props) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--text-dim)", fontSize: "13px" }}>
        Not enough data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="4 2" vertical={false} />
        <XAxis
          dataKey="started_at"
          tickFormatter={formatDate}
          tick={{ fill: "var(--text-dim)", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "var(--text-dim)", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="var(--score-hi)"
          strokeWidth={1.5}
          dot={{ r: 3, fill: "var(--score-hi)", strokeWidth: 0 }}
          activeDot={{ r: 4, fill: "var(--score-hi)", strokeWidth: 0 }}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
