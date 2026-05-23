import pc from "picocolors";
import { computeDiff } from "./git/diff";
import { takeSnapshot, currentHead } from "./git/snapshot";
import {
  insertSession,
  updateSession,
  insertDiff,
  insertCheck,
  getChecksByPhase,
  getDiff,
  insertRegression,
  updateSessionScore,
  updateSessionCost,
} from "./db/sessions";
import { loadScoringConfig, loadCostConfig } from "./config";
import { computeScore } from "./scoring/score";
import { detectRegressions } from "./scoring/regressions";
import { detectChecks } from "./checks/detect";
import { runCommand } from "./checks/run";
import { selectParsers } from "./checks/parsers/index";
import { estimateCost } from "./cost/estimate";
import type { Check, CheckKind, CheckPhase } from "./types";
import type { ScoreResult } from "./scoring/score";
import type { DetectedRegression } from "./scoring/regressions";
import type Database from "better-sqlite3";

export interface PreCheckResult {
  kind: CheckKind;
  passed: number;
  failed: number;
  total: number;
  coverage_pct: number | null;
  runtime_ms: number; // always populated from runCommand
  raw_output: string; // always populated from runCommand
}

export interface WatchPreBaseline {
  s0Sha: string;
  headSha: string;
  checkResults: PreCheckResult[];
}

export interface BaselineHandle {
  sessionId: string;
  s0Sha: string;
}

export interface SessionFinalResult {
  sessionId: string;
  score: number;
  tokens: number;
  cost_usd: number;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  scoreResult: ScoreResult;
  regressions: DetectedRegression[];
  baseline: Check[];
  final: Check[];
}

function runChecks(repoRoot: string): PreCheckResult[] {
  const detected = detectChecks(repoRoot);
  const parsers = selectParsers(detected.ecosystem);
  const results: PreCheckResult[] = [];

  const tasks: Array<{
    kind: "test" | "type" | "lint";
    spec: NonNullable<ReturnType<typeof detectChecks>["test"]>;
    parse: (output: string, exitCode: number) => { passed: number; failed: number; total: number; coverage_pct?: number | null };
  }> = [];

  if (detected.test) tasks.push({ kind: "test", spec: detected.test, parse: parsers.test });
  if (detected.type) tasks.push({ kind: "type", spec: detected.type, parse: parsers.type });
  if (detected.lint) tasks.push({ kind: "lint", spec: detected.lint, parse: parsers.lint });

  for (const task of tasks) {
    try {
      const res = runCommand(task.spec, repoRoot);
      const r = task.parse(res.output, res.exitCode);
      results.push({
        kind: task.kind,
        passed: r.passed,
        failed: r.failed,
        total: r.total,
        coverage_pct: r.coverage_pct ?? null,
        runtime_ms: res.runtime_ms,
        raw_output: res.output,
      });
    } catch (e) {
      console.warn(pc.yellow(`  ⚠ ${task.kind} check failed: ${String(e)}`));
    }
  }

  return results;
}

function storeChecks(
  db: Database.Database,
  sessionId: string,
  results: PreCheckResult[],
  phase: CheckPhase
): void {
  for (const r of results) {
    insertCheck(db, {
      session_id: sessionId,
      kind: r.kind,
      phase,
      passed: r.passed,
      failed: r.failed,
      total: r.total,
      coverage_pct: r.coverage_pct,
      runtime_ms: r.runtime_ms,
      raw_output: r.raw_output,
    });
  }
}

export function captureWatchPreBaseline(repoRoot: string): WatchPreBaseline {
  const s0Sha = takeSnapshot(repoRoot);
  const headSha = currentHead(repoRoot);
  const checkResults = runChecks(repoRoot);
  return { s0Sha, headSha, checkResults };
}

export function openSessionFromPreBaseline(
  db: Database.Database,
  repoRoot: string,
  pre: WatchPreBaseline,
  agentName: string | null = null
): BaselineHandle {
  const sessionId = insertSession(db, {
    repo_path: repoRoot,
    agent_name: agentName,
    git_base_sha: pre.headSha,
    notes: null,
  });
  storeChecks(db, sessionId, pre.checkResults, "baseline");
  return { sessionId, s0Sha: pre.s0Sha };
}

export function captureBaseline(
  repoRoot: string,
  db: Database.Database,
  opts?: { agentName?: string | null; notes?: string | null }
): BaselineHandle {
  const pre = captureWatchPreBaseline(repoRoot);
  const sessionId = insertSession(db, {
    repo_path: repoRoot,
    agent_name: opts?.agentName ?? null,
    git_base_sha: pre.headSha,
    notes: opts?.notes ?? null,
  });
  storeChecks(db, sessionId, pre.checkResults, "baseline");
  return { sessionId, s0Sha: pre.s0Sha };
}

export function finalizeSession(
  repoRoot: string,
  db: Database.Database,
  handle: BaselineHandle
): SessionFinalResult {
  const s1Sha = takeSnapshot(repoRoot);
  const { filesChanged, linesAdded, linesRemoved, patch } = computeDiff(
    repoRoot,
    handle.s0Sha,
    s1Sha
  );
  const headSha = currentHead(repoRoot);
  const endedAt = new Date().toISOString();

  const finalCheckResults = runChecks(repoRoot);
  storeChecks(db, handle.sessionId, finalCheckResults, "final");

  db.transaction(() => {
    updateSession(db, {
      id: handle.sessionId,
      ended_at: endedAt,
      git_head_sha: headSha,
    });
    insertDiff(db, {
      session_id: handle.sessionId,
      files_changed: filesChanged,
      lines_added: linesAdded,
      lines_removed: linesRemoved,
      patch,
    });
  })();

  const baseline = getChecksByPhase(db, handle.sessionId, "baseline");
  const final = getChecksByPhase(db, handle.sessionId, "final");
  const diff = getDiff(db, handle.sessionId);

  const scoringConfig = loadScoringConfig(repoRoot);
  const scoreResult = computeScore({ baseline, final }, scoringConfig);
  const regressions = detectRegressions(baseline, final, diff?.patch ?? "");

  db.transaction(() => {
    updateSessionScore(db, handle.sessionId, scoreResult.score);
    for (const reg of regressions) {
      insertRegression(db, {
        session_id: handle.sessionId,
        description: reg.description,
        file: reg.file,
        hunk: reg.hunk,
        severity: reg.severity,
      });
    }
  })();

  const costConfig = loadCostConfig(repoRoot);
  const { tokens, cost_usd } = estimateCost(
    { lines_added: linesAdded, lines_removed: linesRemoved },
    costConfig
  );
  updateSessionCost(db, handle.sessionId, tokens, cost_usd);

  return {
    sessionId: handle.sessionId,
    score: scoreResult.score,
    tokens,
    cost_usd,
    filesChanged,
    linesAdded,
    linesRemoved,
    scoreResult,
    regressions,
    baseline,
    final,
  };
}
