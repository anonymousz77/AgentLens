import crypto from "node:crypto";
import Database from "better-sqlite3";
import type {
  Check,
  CheckKind,
  CheckPhase,
  Diff,
  JudgeScore,
  Regression,
  RegressionSeverity,
  Session,
} from "../types";

export interface InsertSessionParams {
  repo_path: string;
  agent_name: string | null;
  git_base_sha: string | null;
  notes: string | null;
  task?: string | null;
}

export interface UpdateSessionParams {
  id: string;
  ended_at: string;
  git_head_sha: string | null;
}

export interface InsertDiffParams {
  session_id: string;
  files_changed: number;
  lines_added: number;
  lines_removed: number;
  patch: string;
}

export interface SessionListRow {
  id: string;
  agent_name: string | null;
  started_at: string;
  ended_at: string | null;
  score: number | null;
  files_changed: number | null;
  lines_added: number | null;
  lines_removed: number | null;
  task: string | null;
  cost_estimated: number;
}

export interface InsertRegressionParams {
  session_id: string;
  description: string;
  file: string | null;
  hunk: string | null;
  severity: RegressionSeverity;
}

export function insertSession(
  db: Database.Database,
  params: InsertSessionParams
): string {
  const id = crypto.randomUUID();
  const started_at = new Date().toISOString();
  db.prepare(
    "INSERT INTO sessions (id, repo_path, agent_name, started_at, git_base_sha, notes, task) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    params.repo_path,
    params.agent_name,
    started_at,
    params.git_base_sha,
    params.notes,
    params.task ?? null
  );
  return id;
}

export function updateSession(
  db: Database.Database,
  params: UpdateSessionParams
): void {
  db.prepare(
    "UPDATE sessions SET ended_at = ?, git_head_sha = ? WHERE id = ?"
  ).run(params.ended_at, params.git_head_sha, params.id);
}

export function insertDiff(
  db: Database.Database,
  params: InsertDiffParams
): string {
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO diffs (id, session_id, files_changed, lines_added, lines_removed, patch) " +
      "VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    params.session_id,
    params.files_changed,
    params.lines_added,
    params.lines_removed,
    params.patch
  );
  return id;
}

export interface InsertCheckParams {
  session_id: string;
  kind: CheckKind;
  phase: CheckPhase;
  passed: number;
  failed: number;
  total: number;
  coverage_pct: number | null;
  runtime_ms: number;
  raw_output: string;
}

export function insertCheck(
  db: Database.Database,
  params: InsertCheckParams
): string {
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO checks (id, session_id, kind, phase, passed, failed, total, coverage_pct, runtime_ms, raw_output) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    params.session_id,
    params.kind,
    params.phase,
    params.passed,
    params.failed,
    params.total,
    params.coverage_pct ?? null,
    params.runtime_ms,
    params.raw_output
  );
  return id;
}

export function getChecksByPhase(
  db: Database.Database,
  sessionId: string,
  phase: CheckPhase
): Check[] {
  return db
    .prepare("SELECT * FROM checks WHERE session_id = ? AND phase = ?")
    .all(sessionId, phase) as Check[];
}

export function listSessions(db: Database.Database): SessionListRow[] {
  return db
    .prepare<[], SessionListRow>(
      "SELECT s.id, s.agent_name, s.started_at, s.ended_at, s.score, " +
        "s.task, s.cost_estimated, " +
        "d.files_changed, d.lines_added, d.lines_removed " +
        "FROM sessions s " +
        "LEFT JOIN diffs d ON d.session_id = s.id " +
        "ORDER BY s.started_at DESC"
    )
    .all() as SessionListRow[];
}

export function getDiff(
  db: Database.Database,
  sessionId: string
): Diff | undefined {
  return db
    .prepare("SELECT * FROM diffs WHERE session_id = ?")
    .get(sessionId) as Diff | undefined;
}

export function insertRegression(
  db: Database.Database,
  params: InsertRegressionParams
): string {
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO regressions (id, session_id, description, file, hunk, severity) " +
      "VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    params.session_id,
    params.description,
    params.file,
    params.hunk,
    params.severity
  );
  return id;
}

export function updateSessionScore(
  db: Database.Database,
  sessionId: string,
  score: number
): void {
  db.prepare("UPDATE sessions SET score = ? WHERE id = ?").run(score, sessionId);
}

export function updateSessionCost(
  db: Database.Database,
  sessionId: string,
  tokens: number,
  cost_usd: number,
  cost_estimated: 0 | 1 = 1
): void {
  db
    .prepare("UPDATE sessions SET tokens = ?, cost_usd = ?, cost_estimated = ? WHERE id = ?")
    .run(tokens, cost_usd, cost_estimated, sessionId);
}

export function getSessionById(
  db: Database.Database,
  id: string
): Session | undefined {
  return db
    .prepare("SELECT * FROM sessions WHERE id = ?")
    .get(id) as Session | undefined;
}

export function getLatestSession(
  db: Database.Database
): Session | undefined {
  return db
    .prepare("SELECT * FROM sessions ORDER BY started_at DESC LIMIT 1")
    .get() as Session | undefined;
}

export function getRegressionsBySession(
  db: Database.Database,
  sessionId: string
): Regression[] {
  return db
    .prepare(
      "SELECT * FROM regressions WHERE session_id = ? ORDER BY severity, description"
    )
    .all(sessionId) as Regression[];
}

export interface InsertJudgeScoreParams {
  session_id: string;
  dimension: string;
  score: number;
  confidence: number;
  rationale: string | null;
}

export function insertJudgeScore(
  db: Database.Database,
  params: InsertJudgeScoreParams
): string {
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO judge_scores (id, session_id, dimension, score, confidence, rationale) " +
      "VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    params.session_id,
    params.dimension,
    params.score,
    params.confidence,
    params.rationale
  );
  return id;
}

export function getJudgeScoresBySession(
  db: Database.Database,
  sessionId: string
): JudgeScore[] {
  return db
    .prepare("SELECT * FROM judge_scores WHERE session_id = ?")
    .all(sessionId) as JudgeScore[];
}

export interface AgentSessionRow {
  agent_name: string;
  score: number | null;
  cost_usd: number | null;
}

/** Fetch all sessions that have an agent_name set, for use in agent comparison. */
export function getAgentSessions(db: Database.Database): AgentSessionRow[] {
  return db
    .prepare(
      "SELECT agent_name, score, cost_usd FROM sessions WHERE agent_name IS NOT NULL ORDER BY started_at DESC"
    )
    .all() as AgentSessionRow[];
}
