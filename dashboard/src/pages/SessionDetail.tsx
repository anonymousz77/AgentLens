import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useAppStore } from "../store/app";
import { scoreColor } from "../components/ScoreBadge";
import RegressionCard from "../components/RegressionCard";
import CheckDeltaRow from "../components/CheckDeltaRow";
import DiffViewer from "../components/DiffViewer";
import LoadingSpinner from "../components/LoadingSpinner";

function useAnimatedValue(target: number, duration = 1100): number {
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

function AnimatedScore({ score }: { score: number }) {
  const displayed = useAnimatedValue(score);
  const color = scoreColor(score);
  return (
    <span style={{ color, fontVariantNumeric: "tabular-nums" }}>{displayed}</span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fetchDetail = useAppStore((s) => s.fetchDetail);
  const detail = useAppStore((s) => s.detail);
  const detailId = useAppStore((s) => s.detailId);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);

  useEffect(() => {
    if (id) void fetchDetail(id);
  }, [id, fetchDetail]);

  const isLoading = loading.detail || (id !== undefined && detailId !== id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height: "60vh" }}>
        <LoadingSpinner size={28} />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ height: "60vh" }}>
        <p style={{ color: "var(--score-lo)", fontSize: "14px" }}>
          {error ?? "Session not found"}
        </p>
        <button
          onClick={() => navigate("/sessions")}
          className="text-sm"
          style={{ color: "var(--text-muted)", textDecoration: "underline", cursor: "pointer" }}
        >
          Back to sessions
        </button>
      </div>
    );
  }

  const { session, diff, deltas, regressions, score_breakdown, score } = detail;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="p-6 space-y-6 max-w-screen-xl mx-auto"
    >
      {/* Back nav */}
      <button
        onClick={() => navigate("/sessions")}
        className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
        style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}
        aria-label="Back to sessions"
      >
        <ArrowLeft size={14} />
        Sessions
      </button>

      {/* Two-column hero */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left: score hero + breakdown + regressions ── */}
        <div className="space-y-4">

          {/* Score hero */}
          <motion.div
            className="surface p-8 text-center"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <p className="label mb-3">Session score</p>
            <div
              className="font-semibold leading-none"
              style={{
                fontFamily: "Archivo, sans-serif",
                fontStretch: "expanded",
                fontSize: "clamp(80px, 12vw, 112px)",
              }}
            >
              <AnimatedScore score={score} />
            </div>
            <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>
              out of 100
            </p>
          </motion.div>

          {/* Score breakdown */}
          {score_breakdown.length > 0 && (
            <div className="surface overflow-hidden">
              <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="label">Score breakdown</p>
              </div>
              <div>
                {score_breakdown.map((item, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center justify-between px-4 py-2.5 border-b"
                    style={{ borderColor: "var(--border-muted)" }}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 + i * 0.04 }}
                  >
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                      {item.reason}
                    </span>
                    <span
                      className="mono-sm font-semibold"
                      style={{
                        color: item.delta >= 0 ? "var(--score-hi)" : "var(--score-lo)",
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      {item.delta > 0 ? "+" : ""}{item.delta}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Regressions */}
          {regressions.length > 0 && (
            <div className="surface overflow-hidden">
              <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="label">
                  Regressions{" "}
                  <span style={{ color: "var(--score-lo)" }}>({regressions.length})</span>
                </p>
              </div>
              <div className="p-3 space-y-2">
                {regressions.map((r) => (
                  <RegressionCard key={r.id} regression={r} />
                ))}
              </div>
            </div>
          )}

          {regressions.length === 0 && (
            <div
              className="surface px-4 py-3 text-sm"
              style={{ color: "var(--score-hi)" }}
            >
              No regressions detected
            </div>
          )}
        </div>

        {/* ── Right: metadata + deltas + diff ── */}
        <div className="space-y-4">

          {/* Metadata */}
          <div className="surface p-4 space-y-3">
            <p className="label">Session metadata</p>
            <dl className="space-y-2 text-sm">
              {([
                { label: "Agent", value: session.agent_name ?? "unknown", mono: false },
                { label: "Started", value: formatDate(session.started_at), mono: false },
                { label: "Ended", value: session.ended_at ? formatDate(session.ended_at) : "ongoing", mono: false },
                { label: "Base SHA", value: session.git_base_sha ?? "—", mono: true },
                { label: "Head SHA", value: session.git_head_sha ?? "—", mono: true },
                ...(session.cost_usd !== null ? [{ label: "Cost", value: `$${session.cost_usd.toFixed(4)}`, mono: false }] : []),
                ...(session.tokens !== null ? [{ label: "Tokens", value: session.tokens.toLocaleString(), mono: false }] : []),
                ...(diff !== null ? [{ label: "Files changed", value: String(diff.files_changed), mono: false }] : []),
              ] as Array<{ label: string; value: string; mono: boolean }>).map(({ label, value, mono }) => (
                <div key={label} className="flex gap-3">
                  <dt
                    className="w-24 shrink-0 label"
                    style={{ color: "var(--text-dim)", paddingTop: "1px" }}
                  >
                    {label}
                  </dt>
                  <dd
                    className={mono ? "mono-sm break-all" : ""}
                    style={{ color: "var(--text-primary)", margin: 0 }}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Check deltas */}
          {deltas.length > 0 && (
            <div className="surface overflow-hidden">
              <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="label">Check deltas</p>
              </div>
              <div className="p-3 space-y-2">
                {deltas.map((d) => (
                  <CheckDeltaRow key={d.kind} delta={d} />
                ))}
              </div>
            </div>
          )}

          {/* Diff */}
          <div className="surface overflow-hidden">
            <div className="px-4 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
              <p className="label">
                Diff
                {diff !== null && (
                  <span style={{ fontWeight: 400, marginLeft: "8px" }}>
                    <span style={{ color: "var(--score-hi)" }}>+{diff.lines_added}</span>
                    {" "}
                    <span style={{ color: "var(--score-lo)" }}>−{diff.lines_removed}</span>
                  </span>
                )}
              </p>
            </div>
            <div className="p-3">
              <DiffViewer patch={diff?.patch ?? null} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
