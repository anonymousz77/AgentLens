import type { Check, Diff, Regression, Session } from "../types";
import type { BreakdownItem } from "../scoring/score";

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
  task: string | null;
  cost_estimated: number;
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
  /** One entry per check kind present in either phase. */
  deltas: CheckDelta[];
  /** Regressions as stored in the DB. */
  regressions: Regression[];
  /** Score breakdown recomputed live via computeScore. */
  score_breakdown: BreakdownItem[];
  /** Score recomputed live — always up to date with current config. */
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
  /** Ordered oldest → newest. */
  score_over_time: ScoreOverTimePoint[];
  /** Ordered oldest → newest. */
  coverage_over_time: CoverageOverTimePoint[];
}
