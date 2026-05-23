import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronUp, ChevronDown, Search } from "lucide-react";
import { useAppStore } from "../store/app";
import ScoreBadge from "../components/ScoreBadge";
import EmptyState from "../components/EmptyState";
import type { SessionSummary } from "../api/types";

type SortKey = keyof Pick<SessionSummary, "score" | "started_at" | "files_changed" | "lines_added" | "regressions_count">;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatDuration(start: string, end: string | null) {
  if (!end) return "ongoing";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "<1m";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: "asc" | "desc" }) {
  if (col !== sortKey) return <ChevronDown size={11} style={{ color: "var(--text-dim)", opacity: 0.4 }} />;
  return dir === "asc"
    ? <ChevronUp size={11} style={{ color: "var(--text-muted)" }} />
    : <ChevronDown size={11} style={{ color: "var(--text-muted)" }} />;
}

const columns: { key: SortKey; label: string }[] = [
  { key: "score",             label: "Score" },
  { key: "started_at",        label: "Started" },
  { key: "files_changed",     label: "Files" },
  { key: "lines_added",       label: "+Lines" },
  { key: "regressions_count", label: "Regressions" },
];

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export default function SessionsList() {
  const sessions = useAppStore((s) => s.sessions);
  const loading = useAppStore((s) => s.loading);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const sortKey = (params.get("sort") as SortKey | null) ?? "started_at";
  const sortDir = (params.get("dir") as "asc" | "desc" | null) ?? "desc";
  const [filter, setFilter] = useState(params.get("q") ?? "");

  function setSort(key: SortKey) {
    const newDir = sortKey === key && sortDir === "desc" ? "asc" : "desc";
    setParams({ sort: key, dir: newDir, q: filter });
  }

  const sorted = useMemo(() => {
    let list = [...sessions];

    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(
        (s) =>
          (s.agent_name ?? "").toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const aVal = a[sortKey] ?? -Infinity;
      const bVal = b[sortKey] ?? -Infinity;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [sessions, filter, sortKey, sortDir]);

  const isEmpty = !loading.sessions && sessions.length === 0;

  if (isEmpty) return <EmptyState />;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="p-6 space-y-4 max-w-screen-xl mx-auto"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Sessions
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {sorted.length} session{sorted.length !== 1 ? "s" : ""}
            {filter ? ` matching "${filter}"` : ""}
          </p>
        </div>

        {/* Filter */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-dim)" }}
          />
          <input
            type="search"
            placeholder="Filter by agent or ID…"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setParams({ sort: sortKey, dir: sortDir, q: e.target.value });
            }}
            className="pl-8 pr-3 py-1.5 text-sm rounded"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              outline: "none",
              width: "220px",
              fontFamily: "Hanken Grotesk, sans-serif",
            }}
            aria-label="Filter sessions"
          />
        </div>
      </div>

      <div className="surface overflow-hidden">
        <table className="w-full text-sm" aria-label="Sessions table">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {columns.map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-2.5 text-left"
                  style={{ whiteSpace: "nowrap" }}
                >
                  <button
                    onClick={() => setSort(key)}
                    className="flex items-center gap-1 label hover:opacity-80 transition-opacity"
                    style={{ cursor: "pointer" }}
                    aria-label={`Sort by ${label}`}
                  >
                    {label}
                    <SortIcon col={key} sortKey={sortKey} dir={sortDir} />
                  </button>
                </th>
              ))}
              <th className="px-4 py-2.5 text-left label">Agent</th>
              <th className="px-4 py-2.5 text-left label">Duration</th>
              <th className="px-4 py-2.5 text-left label">−Lines</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <motion.tr
                key={s.id}
                className="cursor-pointer"
                style={{ borderBottom: "1px solid var(--border-muted)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.025, 0.3) }}
                onClick={() => navigate(`/sessions/${s.id}`)}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-raised)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/sessions/${s.id}`)}
                aria-label={`Session ${s.id}`}
              >
                <td className="px-4 py-2.5">
                  <ScoreBadge score={s.score} size="sm" />
                </td>
                <td className="px-4 py-2.5 mono-sm" style={{ color: "var(--text-muted)" }}>
                  {formatDate(s.started_at)}
                </td>
                <td className="px-4 py-2.5 mono-sm tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {s.files_changed}
                </td>
                <td className="px-4 py-2.5 mono-sm tabular-nums" style={{ color: "var(--score-hi)" }}>
                  +{s.lines_added}
                </td>
                <td
                  className="px-4 py-2.5 mono-sm tabular-nums"
                  style={{ color: s.regressions_count > 0 ? "var(--score-lo)" : "var(--text-dim)" }}
                >
                  {s.regressions_count}
                </td>
                <td className="px-4 py-2.5 text-sm" style={{ color: "var(--text-muted)" }}>
                  {s.agent_name ?? <span style={{ color: "var(--text-dim)" }}>unknown</span>}
                </td>
                <td className="px-4 py-2.5 mono-sm" style={{ color: "var(--text-dim)" }}>
                  {formatDuration(s.started_at, s.ended_at)}
                </td>
                <td className="px-4 py-2.5 mono-sm tabular-nums" style={{ color: "var(--score-lo)" }}>
                  −{s.lines_removed}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        {sorted.length === 0 && filter && (
          <div className="py-12 text-center text-sm" style={{ color: "var(--text-dim)" }}>
            No sessions match "{filter}"
          </div>
        )}
      </div>
    </motion.div>
  );
}
