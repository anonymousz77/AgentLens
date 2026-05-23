import Database from "better-sqlite3";
import { isInitialized, dbPath } from "../db/database";
import {
  listSessions,
  getSessionById,
  getLatestSession,
  getDiff,
  getChecksByPhase,
  getRegressionsBySession,
} from "../db/sessions";
import { computeScore } from "../scoring/score";
import { detectRegressions } from "../scoring/regressions";
import { loadScoringConfig } from "../config";
import type { AgentStats, CheckDelta, CoverageOverTimePoint, ScoreOverTimePoint, SessionDetail, SessionSummary } from "./types";

function openReadonlyDb(repoRoot: string): Database.Database {
  return new Database(dbPath(repoRoot), { readonly: true });
}

export function listSessionsSummary(repoRoot: string): SessionSummary[] {
  if (!isInitialized(repoRoot)) return [];

  const db = openReadonlyDb(repoRoot);
  try {
    const rows = listSessions(db);
    return rows.map((row) => ({
      id: row.id,
      agent_name: row.agent_name,
      started_at: row.started_at,
      ended_at: row.ended_at,
      score: row.score,
      files_changed: row.files_changed ?? 0,
      lines_added: row.lines_added ?? 0,
      lines_removed: row.lines_removed ?? 0,
      regressions_count: getRegressionsBySession(db, row.id).length,
    }));
  } finally {
    db.close();
  }
}

export function getSessionDetail(
  repoRoot: string,
  sessionId: string | undefined
): SessionDetail | null {
  if (!isInitialized(repoRoot)) return null;

  const db = openReadonlyDb(repoRoot);
  try {
    const session =
      sessionId !== undefined
        ? getSessionById(db, sessionId)
        : getLatestSession(db);

    if (session === undefined) return null;

    const diff = getDiff(db, session.id) ?? null;
    const baseline = getChecksByPhase(db, session.id, "baseline");
    const final = getChecksByPhase(db, session.id, "final");
    const regressions = getRegressionsBySession(db, session.id);

    const allKinds = Array.from(
      new Set([...baseline.map((c) => c.kind), ...final.map((c) => c.kind)])
    );

    const deltas: CheckDelta[] = allKinds.map((kind) => {
      const b = baseline.find((c) => c.kind === kind) ?? null;
      const f = final.find((c) => c.kind === kind) ?? null;
      const coverage_delta =
        b !== null &&
        b.coverage_pct !== null &&
        f !== null &&
        f.coverage_pct !== null
          ? f.coverage_pct - b.coverage_pct
          : null;
      return {
        kind,
        baseline: b,
        final: f,
        passed_delta: (f?.passed ?? 0) - (b?.passed ?? 0),
        failed_delta: (f?.failed ?? 0) - (b?.failed ?? 0),
        coverage_delta,
      };
    });

    const config = loadScoringConfig(repoRoot);
    const { score, breakdown } = computeScore({ baseline, final }, config);

    return {
      session,
      diff,
      baseline_checks: baseline,
      final_checks: final,
      deltas,
      regressions,
      score_breakdown: breakdown,
      score,
    };
  } finally {
    db.close();
  }
}

export function getStats(repoRoot: string): AgentStats {
  if (!isInitialized(repoRoot)) {
    return {
      sessions_count: 0,
      avg_score: null,
      total_regressions_caught: 0,
      avg_cost_usd: null,
      avg_tokens: null,
      score_over_time: [],
      coverage_over_time: [],
    };
  }

  const db = openReadonlyDb(repoRoot);
  try {
    const rows = listSessions(db);

    let scoreSum = 0;
    let scoreCount = 0;
    let costSum = 0;
    let costCount = 0;
    let tokenSum = 0;
    let tokenCount = 0;
    let total_regressions_caught = 0;

    for (const row of rows) {
      if (row.score !== null) {
        scoreSum += row.score;
        scoreCount++;
      }
      total_regressions_caught += getRegressionsBySession(db, row.id).length;

      const full = getSessionById(db, row.id);
      if (full !== undefined) {
        if (full.cost_usd !== null) {
          costSum += full.cost_usd;
          costCount++;
        }
        if (full.tokens !== null) {
          tokenSum += full.tokens;
          tokenCount++;
        }
      }
    }

    // listSessions returns DESC; reverse for oldest → newest.
    const chronological = [...rows].reverse();

    const score_over_time: ScoreOverTimePoint[] = chronological.map((r) => ({
      started_at: r.started_at,
      score: r.score,
    }));

    const coverage_over_time: CoverageOverTimePoint[] = chronological.map((r) => {
      const finalChecks = getChecksByPhase(db, r.id, "final");
      const covCheck =
        finalChecks.find((c) => c.kind === "coverage") ??
        finalChecks.find((c) => c.kind === "test" && c.coverage_pct !== null);
      return {
        started_at: r.started_at,
        coverage_pct: covCheck?.coverage_pct ?? null,
      };
    });

    return {
      sessions_count: rows.length,
      avg_score: scoreCount > 0 ? scoreSum / scoreCount : null,
      total_regressions_caught,
      avg_cost_usd: costCount > 0 ? costSum / costCount : null,
      avg_tokens: tokenCount > 0 ? tokenSum / tokenCount : null,
      score_over_time,
      coverage_over_time,
    };
  } finally {
    db.close();
  }
}
