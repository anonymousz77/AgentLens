import { motion } from "framer-motion";
import SparkLine from "./SparkLine";

interface Props {
  label: string;
  value: string | number;
  sparkData?: Array<{ value: number | null }>;
  sparkColor?: string;
  valueColor?: string;
  index?: number;
}

export default function StatCard({
  label,
  value,
  sparkData,
  sparkColor,
  valueColor = "var(--text-primary)",
  index = 0,
}: Props) {
  return (
    <motion.div
      className="surface p-4 flex flex-col gap-1 min-w-0"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06, ease: "easeOut" }}
    >
      <p className="label">{label}</p>
      <p
        className="text-2xl font-semibold tabular-nums tracking-tight"
        style={{
          fontFamily: "Archivo, sans-serif",
          color: valueColor,
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      {sparkData && sparkData.length >= 2 && (
        <div className="mt-1 -mx-1">
          <SparkLine data={sparkData} color={sparkColor} height={28} />
        </div>
      )}
    </motion.div>
  );
}
