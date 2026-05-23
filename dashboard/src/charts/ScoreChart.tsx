import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
        background: "rgba(14,16,20,0.85)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: "12px",
      }}
    >
      <p style={{ color: "var(--text-muted)", marginBottom: "2px" }}>{formatDate(label as string)}</p>
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
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--score-hi)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--score-hi)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border-muted)" strokeDasharray="4 2" vertical={false} />
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
        <Area
          type="monotone"
          dataKey="score"
          stroke="var(--score-hi)"
          strokeWidth={2}
          fill="url(#scoreGrad)"
          dot={{ r: 3, fill: "var(--score-hi)", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "var(--score-hi)", strokeWidth: 0 }}
          connectNulls
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
