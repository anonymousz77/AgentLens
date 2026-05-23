import { motion } from "framer-motion";

export default function EmptyState() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full min-h-80 gap-6 text-center px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="20" stroke="var(--border)" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="7" stroke="var(--text-dim)" strokeWidth="1.5" />
        <circle cx="24" cy="8" r="2.5" fill="var(--text-dim)" />
        <circle cx="24" cy="40" r="2.5" fill="var(--text-dim)" />
        <circle cx="8" cy="24" r="2.5" fill="var(--text-dim)" />
        <circle cx="40" cy="24" r="2.5" fill="var(--text-dim)" />
      </svg>

      <div className="space-y-1">
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: "Archivo, sans-serif", color: "var(--text-primary)" }}
        >
          No sessions recorded yet
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)", maxWidth: "28rem" }}>
          Record your first session to see scores, regressions, and quality trends here.
        </p>
      </div>

      <div
        className="rounded p-4 text-left"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          maxWidth: "28rem",
          width: "100%",
        }}
      >
        <p className="label mb-3">Getting started</p>
        <div className="space-y-1 mono-sm" style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>
          <p>
            <span style={{ color: "var(--text-dim)" }}>$</span>{" "}
            <span style={{ color: "var(--text-primary)" }}>agentlens session start</span>
          </p>
          <p style={{ color: "var(--text-dim)", paddingLeft: "12px" }}>
            # let your agent work...
          </p>
          <p>
            <span style={{ color: "var(--text-dim)" }}>$</span>{" "}
            <span style={{ color: "var(--text-primary)" }}>agentlens session end</span>
          </p>
          <p>
            <span style={{ color: "var(--text-dim)" }}>$</span>{" "}
            <span style={{ color: "var(--text-primary)" }}>agentlens dashboard</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
