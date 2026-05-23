import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import SparkLine from "./SparkLine";

const SCORE_COLORS = new Set(["var(--score-hi)", "var(--score-mid)", "var(--score-lo)"]);

function useAnimatedValue(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);

    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(ease * target));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

function isAnimatableInt(v: string | number): boolean {
  return /^\d+$/.test(String(v));
}

interface Props {
  label: string;
  value: string | number;
  sparkData?: Array<{ value: number | null }>;
  sparkColor?: string;
  valueColor?: string;
  index?: number;
}

function AnimatedNumber({ value, color }: { value: number; color: string }) {
  const displayed = useAnimatedValue(value);
  return (
    <span style={{ color, fontVariantNumeric: "tabular-nums" }}>{displayed}</span>
  );
}

export default function StatCard({
  label,
  value,
  sparkData,
  sparkColor,
  valueColor = "var(--text-primary)",
  index = 0,
}: Props) {
  const isScoreColor = SCORE_COLORS.has(valueColor);
  const isInt = isAnimatableInt(value);

  return (
    <motion.div
      className="surface p-4 flex flex-col gap-1 min-w-0 relative overflow-hidden"
      data-magnetic
      data-cursor-color={isScoreColor ? valueColor : undefined}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: "0 8px 28px rgba(0,0,0,0.55)" }}
      transition={{ duration: 0.25, delay: index * 0.06, ease: "easeOut" }}
      style={{
        background: "linear-gradient(145deg, var(--bg-surface) 0%, var(--bg-overlay) 100%)",
        borderTop: isScoreColor ? `1px solid ${valueColor}30` : undefined,
      }}
    >
      {/* Score glow behind value number */}
      {isScoreColor && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "70%",
            background: `radial-gradient(ellipse 70% 60% at 50% 0%, ${valueColor}14, transparent 100%)`,
            pointerEvents: "none",
          }}
          aria-hidden="true"
        />
      )}

      <p className="label">{label}</p>

      <p
        className="tabular-nums tracking-tight relative"
        style={{
          fontFamily: "Archivo, sans-serif",
          fontWeight: 800,
          fontSize: "clamp(26px, 3.5vw, 38px)",
          lineHeight: 1.05,
          color: isScoreColor ? undefined : valueColor,
          filter: isScoreColor ? `drop-shadow(0 0 10px ${valueColor}80)` : undefined,
        }}
      >
        {isInt && isScoreColor ? (
          <AnimatedNumber value={Number(value)} color={valueColor} />
        ) : isInt ? (
          <AnimatedNumber value={Number(value)} color={valueColor} />
        ) : (
          <span style={{ color: valueColor }}>{value}</span>
        )}
      </p>

      {sparkData && sparkData.length >= 2 && (
        <div className="mt-1 -mx-1">
          <SparkLine data={sparkData} color={sparkColor} height={28} />
        </div>
      )}
    </motion.div>
  );
}
