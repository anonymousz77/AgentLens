import { LineChart, Line, ResponsiveContainer } from "recharts";

interface Props {
  data: Array<{ value: number | null }>;
  color?: string;
  height?: number;
}

export default function SparkLine({ data, color = "var(--text-dim)", height = 28 }: Props) {
  const filtered = data.filter((d) => d.value !== null);
  if (filtered.length < 2) return <div style={{ height }} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
