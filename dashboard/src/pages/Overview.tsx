import { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/app";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
import ScoreBadge, { scoreColor } from "../components/ScoreBadge";
import ScoreChart from "../charts/ScoreChart";
import CoverageChart from "../charts/CoverageChart";
import LoadingSpinner from "../components/LoadingSpinner";

const ConstellationScene = lazy(() => import("../three/ConstellationScene"));

function formatCost(v: number | null) {
  if (v === null) return "—";
  return `$${v.toFixed(4)}`;
}

function formatScore(v: number | null) {
  if (v === null) return "—";
  return Math.round(v).toString();
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

function ConstellationFallback() {
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "var(--bg-surface)", borderRadius: "6px" }}
    >
      <LoadingSpinner size={24} />
    </div>
  );
}

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.18 } },
};

const headingVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, delay: 0.05, ease: [0.22, 1, 0.36, 1] } },
};

export default function Overview() {
  const sessions = useAppStore((s) => s.sessions);
  const stats    = useAppStore((s) => s.stats);
  const loading  = useAppStore((s) => s.loading);
  const navigate = useNavigate();

  const isEmpty = !loading.sessions && !loading.stats && sessions.length === 0;

  if (isEmpty) {
    return (
      <div className="h-full">
        <EmptyState />
      </div>
    );
  }

  const avgScoreColor  = scoreColor(stats?.avg_score ?? null);
  const scoreSparkData = (stats?.score_over_time ?? []).map((p) => ({ value: p.score }));
  const recentSessions = sessions.slice(0, 10);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="p-6 space-y-6 max-w-screen-xl mx-auto"
    >
      {/* Kinetic page heading */}
      <motion.div variants={headingVariants} initial="initial" animate="animate">
        <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Overview
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Quality at a glance across all recorded sessions
        </p>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Sessions tracked"
          value={stats?.sessions_count ?? "—"}
          sparkData={scoreSparkData}
          sparkColor="var(--text-dim)"
          index={0}
        />
        <StatCard
          label="Regressions caught"
          value={stats?.total_regressions_caught ?? "—"}
          index={1}
        />
        <StatCard
          label="Avg score"
          value={formatScore(stats?.avg_score ?? null)}
          valueColor={avgScoreColor}
          sparkData={scoreSparkData}
          sparkColor={avgScoreColor}
          index={2}
        />
        <StatCard
          label="Avg session cost"
          value={formatCost(stats?.avg_cost_usd ?? null)}
          index={3}
        />
      </div>

      {/* 3D Constellation — hero treatment */}
      <div
        className="overflow-hidden"
        style={{
          height: "480px",
          position: "relative",
          borderRadius: "6px",
          border: "1px solid rgba(34,197,94,0.13)",
          boxShadow: "0 0 48px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.03)",
          background: "var(--bg-surface)",
        }}
      >
        <p
          className="label absolute top-3 left-4 z-10"
          style={{ pointerEvents: "none" }}
        >
          Session constellation
        </p>
        <Suspense fallback={<ConstellationFallback />}>
          <ConstellationScene
            sessions={sessions}
            onSelect={(id) => navigate(`/sessions/${id}`)}
          />
        </Suspense>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <motion.div
          className="surface p-4"
          style={{ height: "200px" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18 }}
        >
          <p className="label mb-3">Score over time</p>
          <div style={{ height: "calc(100% - 28px)" }}>
            <ScoreChart data={stats?.score_over_time ?? []} />
          </div>
        </motion.div>

        <motion.div
          className="surface p-4"
          style={{ height: "200px" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.22 }}
        >
          <p className="label mb-3">Coverage over time</p>
          <div style={{ height: "calc(100% - 28px)" }}>
            <CoverageChart data={stats?.coverage_over_time ?? []} />
          </div>
        </motion.div>
      </div>

      {/* Recent sessions */}
      <motion.div
        className="surface overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.28 }}
      >
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="label">Recent sessions</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-muted)" }}>
              {["Score", "Agent", "Started", "Files Δ", "Lines +/−", "Regressions"].map((h) => (
                <th key={h} className="px-4 py-2 text-left label">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentSessions.map((s) => (
              <tr
                key={s.id}
                data-magnetic
                className="cursor-pointer transition-colors"
                style={{ borderBottom: "1px solid var(--border-muted)" }}
                onClick={() => navigate(`/sessions/${s.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-raised)";
                  e.currentTarget.style.boxShadow  = "inset 3px 0 0 var(--score-hi)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "";
                  e.currentTarget.style.boxShadow  = "";
                }}
              >
                <td className="px-4 py-2.5">
                  <ScoreBadge score={s.score} size="sm" />
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--text-muted)" }}>
                  {s.agent_name ?? <span style={{ color: "var(--text-dim)" }}>unknown</span>}
                </td>
                <td className="px-4 py-2.5 mono-sm" style={{ color: "var(--text-muted)" }}>
                  {formatRelative(s.started_at)}
                </td>
                <td className="px-4 py-2.5 mono-sm" style={{ color: "var(--text-primary)" }}>
                  {s.files_changed}
                </td>
                <td className="px-4 py-2.5 mono-sm">
                  <span style={{ color: "var(--score-hi)" }}>+{s.lines_added}</span>
                  {" "}
                  <span style={{ color: "var(--score-lo)" }}>−{s.lines_removed}</span>
                </td>
                <td
                  className="px-4 py-2.5 mono-sm"
                  style={{ color: s.regressions_count > 0 ? "var(--score-lo)" : "var(--text-dim)" }}
                >
                  {s.regressions_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </motion.div>
  );
}
