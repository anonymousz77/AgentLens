/**
 * Core domain types for AgentLens.
 * These mirror the SQLite schema (see src/db/schema.ts) one-to-one.
 */

export type CheckKind = "test" | "type" | "lint" | "coverage";
export type CheckPhase = "baseline" | "final";
export type RegressionSeverity = "low" | "medium" | "high" | "critical";

export interface Session {
  id: string;
  repo_path: string;
  agent_name: string | null;
  started_at: string; // ISO 8601
  ended_at: string | null;
  git_base_sha: string | null;
  git_head_sha: string | null;
  score: number | null; // 0-100
  tokens: number | null;
  cost_usd: number | null;
  notes: string | null;
}

export interface Diff {
  id: string;
  session_id: string;
  files_changed: number;
  lines_added: number;
  lines_removed: number;
  patch: string;
}

export interface Check {
  id: string;
  session_id: string;
  kind: CheckKind;
  phase: CheckPhase;
  passed: number;
  failed: number;
  total: number;
  coverage_pct: number | null;
  runtime_ms: number | null;
  raw_output: string | null;
}

export interface Regression {
  id: string;
  session_id: string;
  description: string;
  file: string | null;
  hunk: string | null;
  severity: RegressionSeverity;
}

export interface JudgeScore {
  id: string;
  session_id: string;
  dimension: string;
  score: number;
  confidence: number;
  rationale: string | null;
}

/**
 * Scoring weights. Persisted in .agentlens/config.json so users can tune them.
 * Used by the scoring engine (Phase 3).
 */
export interface ScoringConfig {
  base_score: number;
  test_regression_penalty: number; // per test that went green -> red
  new_failure_penalty: number; // per brand-new failing test
  build_break_penalty: number;
  coverage_delta_weight: number; // points per +/- 1% coverage
  type_error_delta_weight: number; // points per type error added/removed
  lint_error_delta_weight: number; // points per lint error added/removed
}

/**
 * Cost estimation parameters. Used to produce a transparent diff-based estimate.
 * Real per-agent token tracking is a Phase 7 adapter concern.
 */
export interface CostConfig {
  tokens_per_line: number; // estimated tokens per changed line
  base_overhead: number; // minimum tokens charged per session (context/prompt overhead)
  usd_per_million_tokens: number; // blended rate (input+output mix)
}

export interface AgentLensConfig {
  version: number;
  scoring: ScoringConfig;
  cost: CostConfig;
}

export const DEFAULT_CONFIG: AgentLensConfig = {
  version: 1,
  scoring: {
    base_score: 100,
    test_regression_penalty: 15,
    new_failure_penalty: 8,
    build_break_penalty: 40,
    coverage_delta_weight: 0.5,
    type_error_delta_weight: 3,
    lint_error_delta_weight: 1,
  },
  cost: {
    tokens_per_line: 8,
    base_overhead: 200,
    usd_per_million_tokens: 3,
  },
};
