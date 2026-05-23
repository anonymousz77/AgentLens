// Mirrors src/api/types.ts from the CLI — duplicated to avoid CJS/ESM coupling.
// Keep in sync if the backend types change.

export interface SessionSummary {
  id: string;
  agent_name: string | null;
  started_at: string;
  ended_at: string | null;
  score: number | null;
  files_changed: number;
  lines_added: number;
  lines_removed: number;
  regressions_count: number;
}

export interface Check {
  id: string;
  session_id: string;
  kind: string;
  phase: string;
  passed: number;
  failed: number;
  total: number;
  coverage_pct: number | null;
  runtime_ms: number | null;
  raw_output: string | null;
}

export interface Diff {
  id: string;
  session_id: string;
  files_changed: number;
  lines_added: number;
  lines_removed: number;
  patch: string | null;
}

export interface Session {
  id: string;
  repo_path: string;
  agent_name: string | null;
  started_at: string;
  ended_at: string | null;
  git_base_sha: string | null;
  git_head_sha: string | null;
  score: number | null;
  tokens: number | null;
  cost_usd: number | null;
  notes: string | null;
}

export interface Regression {
  id: string;
  session_id: string;
  description: string;
  file: string | null;
  hunk: string | null;
  severity: "low" | "medium" | "high" | "critical";
}

export interface BreakdownItem {
  reason: string;
  delta: number;
}

export interface CheckDelta {
  kind: string;
  baseline: Check | null;
  final: Check | null;
  passed_delta: number;
  failed_delta: number;
  coverage_delta: number | null;
}

export interface SessionDetail {
  session: Session;
  diff: Diff | null;
  baseline_checks: Check[];
  final_checks: Check[];
  deltas: CheckDelta[];
  regressions: Regression[];
  score_breakdown: BreakdownItem[];
  score: number;
}

export interface ScoreOverTimePoint {
  started_at: string;
  score: number | null;
}

export interface CoverageOverTimePoint {
  started_at: string;
  coverage_pct: number | null;
}

export interface AgentStats {
  sessions_count: number;
  avg_score: number | null;
  total_regressions_caught: number;
  avg_cost_usd: number | null;
  avg_tokens: number | null;
  score_over_time: ScoreOverTimePoint[];
  coverage_over_time: CoverageOverTimePoint[];
}
