import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { CoverageOverTimePoint } from "../api/types";

interface Props {
  data: CoverageOverTimePoint[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const cov = payload[0]?.value as number | null;
  return (
    <div
      className="rounded px-3 py-2"
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
      <p style={{ color: "var(--text-primary)" }}>
        Coverage: {cov !== null ? `${cov.toFixed(1)}%` : "—"}
      </p>
    </div>
  );
}

export default function CoverageChart({ data }: Props) {
  const hasData = data.some((d) => d.coverage_pct !== null);

  if (!hasData || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: "var(--text-dim)", fontSize: "13px" }}>
        No coverage data
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, value: d.coverage_pct }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="covGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--score-hi)" stopOpacity={0.22} />
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
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fill: "var(--text-dim)", fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--score-hi)"
          strokeWidth={2}
          fill="url(#covGrad)"
          dot={{ r: 3, fill: "var(--score-hi)", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "var(--score-hi)", strokeWidth: 0 }}
          connectNulls
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
