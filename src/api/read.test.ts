import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/database";
import {
  insertSession,
  insertDiff,
  insertCheck,
  insertRegression,
  updateSession,
  updateSessionScore,
} from "../db/sessions";
import { listSessionsSummary, getSessionDetail, getStats } from "./read";

function makeTempRepo(): string {
  return mkdtempSync(join(tmpdir(), "agentlens-test-"));
}

function seedSession(
  repoRoot: string,
  opts: {
    agent?: string;
    score?: number;
    withChecks?: boolean;
    withCoverage?: boolean;
    withRegressions?: number;
    cost_usd?: number;
    tokens?: number;
  } = {}
): string {
  const db = openDatabase(repoRoot);

  const sessionId = insertSession(db, {
    repo_path: repoRoot,
    agent_name: opts.agent ?? null,
    git_base_sha: "abc123",
    notes: null,
  });

  updateSession(db, {
    id: sessionId,
    ended_at: new Date().toISOString(),
    git_head_sha: "def456",
  });

  insertDiff(db, {
    session_id: sessionId,
    files_changed: 3,
    lines_added: 20,
    lines_removed: 5,
    patch: "diff --git a/foo.ts b/foo.ts\n--- a/foo.ts\n+++ b/foo.ts\n@@ -1 +1 @@\n-old\n+new\n",
  });

  if (opts.withChecks !== false) {
    insertCheck(db, {
      session_id: sessionId,
      kind: "test",
      phase: "baseline",
      passed: 10,
      failed: 0,
      total: 10,
      coverage_pct: opts.withCoverage ? 80.0 : null,
      runtime_ms: 500,
      raw_output: "",
    });
    insertCheck(db, {
      session_id: sessionId,
      kind: "test",
      phase: "final",
      passed: 9,
      failed: 1,
      total: 10,
      coverage_pct: opts.withCoverage ? 78.0 : null,
      runtime_ms: 510,
      raw_output: "",
    });
    insertCheck(db, {
      session_id: sessionId,
      kind: "type",
      phase: "baseline",
      passed: 0,
      failed: 0,
      total: 0,
      coverage_pct: null,
      runtime_ms: 200,
      raw_output: "",
    });
    insertCheck(db, {
      session_id: sessionId,
      kind: "type",
      phase: "final",
      passed: 0,
      failed: 2,
      total: 2,
      coverage_pct: null,
      runtime_ms: 210,
      raw_output: "",
    });
  }

  for (let i = 0; i < (opts.withRegressions ?? 0); i++) {
    insertRegression(db, {
      session_id: sessionId,
      description: `regression ${i}`,
      file: "src/foo.ts",
      hunk: null,
      severity: "medium",
    });
  }

  if (opts.score !== undefined) {
    updateSessionScore(db, sessionId, opts.score);
  }

  // Manually set tokens/cost since the public helpers don't expose them.
  if (opts.cost_usd !== undefined || opts.tokens !== undefined) {
    db.prepare("UPDATE sessions SET cost_usd = ?, tokens = ? WHERE id = ?").run(
      opts.cost_usd ?? null,
      opts.tokens ?? null,
      sessionId
    );
  }

  db.close();
  return sessionId;
}

const repos: string[] = [];

function tempRepo(): string {
  const r = makeTempRepo();
  repos.push(r);
  return r;
}

afterEach(() => {
  for (const r of repos.splice(0)) {
    try {
      rmSync(r, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors in tests
    }
  }
});

// ── listSessionsSummary ───────────────────────────────────────────────────────

describe("listSessionsSummary", () => {
  it("returns empty array when DB is not initialized", () => {
    const repo = tempRepo();
    expect(listSessionsSummary(repo)).toEqual([]);
  });

  it("returns one summary per session with correct fields", () => {
    const repo = tempRepo();
    seedSession(repo, { agent: "claude-code", score: 85, withRegressions: 2 });
    seedSession(repo, { agent: "cursor", score: 60, withRegressions: 1 });

    const summaries = listSessionsSummary(repo);
    expect(summaries).toHaveLength(2);

    // listSessions returns DESC, so first entry is most recent
    const first = summaries[0]!;
    expect(first.agent_name).toBe("cursor");
    expect(first.score).toBe(60);
    expect(first.regressions_count).toBe(1);
    expect(first.files_changed).toBe(3);
    expect(first.lines_added).toBe(20);
    expect(first.lines_removed).toBe(5);
    expect(first.ended_at).not.toBeNull();

    const second = summaries[1]!;
    expect(second.agent_name).toBe("claude-code");
    expect(second.score).toBe(85);
    expect(second.regressions_count).toBe(2);
  });

  it("handles session with no diff (active session)", () => {
    const repo = tempRepo();
    // Insert session without closing it (no diff, no ended_at)
    const db = openDatabase(repo);
    insertSession(db, {
      repo_path: repo,
      agent_name: null,
      git_base_sha: null,
      notes: null,
    });
    db.close();

    const summaries = listSessionsSummary(repo);
    expect(summaries).toHaveLength(1);
    const s = summaries[0]!;
    expect(s.ended_at).toBeNull();
    expect(s.score).toBeNull();
    expect(s.files_changed).toBe(0);
    expect(s.regressions_count).toBe(0);
  });

  it("is JSON-serialisable (no non-serialisable values)", () => {
    const repo = tempRepo();
    seedSession(repo, { score: 90 });
    const summaries = listSessionsSummary(repo);
    expect(JSON.parse(JSON.stringify(summaries))).toEqual(summaries);
  });
});

// ── getSessionDetail ──────────────────────────────────────────────────────────

describe("getSessionDetail", () => {
  it("returns null for unknown session id", () => {
    const repo = tempRepo();
    openDatabase(repo).close(); // initialize DB
    expect(getSessionDetail(repo, "nonexistent-id")).toBeNull();
  });

  it("returns null when DB is not initialized", () => {
    const repo = tempRepo();
    expect(getSessionDetail(repo, undefined)).toBeNull();
  });

  it("returns latest session when sessionId is undefined", () => {
    const repo = tempRepo();
    seedSession(repo, { agent: "first", score: 70 });
    seedSession(repo, { agent: "second", score: 80 });

    const detail = getSessionDetail(repo, undefined);
    expect(detail).not.toBeNull();
    expect(detail!.session.agent_name).toBe("second");
  });

  it("computes deltas correctly from baseline and final checks", () => {
    const repo = tempRepo();
    seedSession(repo, { withChecks: true, withCoverage: false });

    const detail = getSessionDetail(repo, undefined);
    expect(detail).not.toBeNull();

    const testDelta = detail!.deltas.find((d) => d.kind === "test");
    expect(testDelta).toBeDefined();
    // baseline: 10 passed, 0 failed → final: 9 passed, 1 failed
    expect(testDelta!.passed_delta).toBe(-1);
    expect(testDelta!.failed_delta).toBe(1);

    const typeDelta = detail!.deltas.find((d) => d.kind === "type");
    expect(typeDelta).toBeDefined();
    // baseline: 0 failed → final: 2 failed
    expect(typeDelta!.failed_delta).toBe(2);
  });

  it("computes coverage_delta when coverage data is present", () => {
    const repo = tempRepo();
    seedSession(repo, { withChecks: true, withCoverage: true });

    const detail = getSessionDetail(repo, undefined);
    expect(detail).not.toBeNull();

    const testDelta = detail!.deltas.find((d) => d.kind === "test");
    expect(testDelta).toBeDefined();
    // baseline 80% → final 78% = delta -2
    expect(testDelta!.coverage_delta).toBeCloseTo(-2.0);
  });

  it("includes score_breakdown from computeScore", () => {
    const repo = tempRepo();
    seedSession(repo, { withChecks: true });

    const detail = getSessionDetail(repo, undefined);
    expect(detail).not.toBeNull();
    expect(detail!.score_breakdown.length).toBeGreaterThan(0);
    // Score should be less than 100 due to test regressions + type errors
    expect(detail!.score).toBeLessThan(100);
  });

  it("includes stored regressions", () => {
    const repo = tempRepo();
    seedSession(repo, { withRegressions: 3 });

    const detail = getSessionDetail(repo, undefined);
    expect(detail).not.toBeNull();
    expect(detail!.regressions).toHaveLength(3);
    expect(detail!.regressions[0]!.severity).toBe("medium");
  });

  it("is JSON-serialisable", () => {
    const repo = tempRepo();
    seedSession(repo, { withChecks: true, withRegressions: 1 });
    const detail = getSessionDetail(repo, undefined);
    expect(detail).not.toBeNull();
    expect(JSON.parse(JSON.stringify(detail))).toEqual(detail);
  });
});

// ── getStats ─────────────────────────────────────────────────────────────────

describe("getStats", () => {
  it("returns zero stats for uninitialized repo", () => {
    const repo = tempRepo();
    const stats = getStats(repo);
    expect(stats.sessions_count).toBe(0);
    expect(stats.avg_score).toBeNull();
    expect(stats.total_regressions_caught).toBe(0);
    expect(stats.score_over_time).toHaveLength(0);
    expect(stats.coverage_over_time).toHaveLength(0);
  });

  it("returns zero stats for initialized but empty DB", () => {
    const repo = tempRepo();
    openDatabase(repo).close();
    const stats = getStats(repo);
    expect(stats.sessions_count).toBe(0);
    expect(stats.avg_score).toBeNull();
  });

  it("aggregates sessions_count, avg_score, total_regressions_caught", () => {
    const repo = tempRepo();
    seedSession(repo, { score: 80, withRegressions: 2 });
    seedSession(repo, { score: 60, withRegressions: 1 });
    seedSession(repo, { score: 100, withRegressions: 0 });

    const stats = getStats(repo);
    expect(stats.sessions_count).toBe(3);
    expect(stats.avg_score).toBeCloseTo((80 + 60 + 100) / 3);
    expect(stats.total_regressions_caught).toBe(3);
  });

  it("handles sessions with no score in avg_score", () => {
    const repo = tempRepo();
    seedSession(repo, { score: 70 });
    // Active session: no score
    const db = openDatabase(repo);
    insertSession(db, { repo_path: repo, agent_name: null, git_base_sha: null, notes: null });
    db.close();

    const stats = getStats(repo);
    expect(stats.sessions_count).toBe(2);
    // avg_score should only count the session that has a score
    expect(stats.avg_score).toBeCloseTo(70);
  });

  it("aggregates avg_cost_usd and avg_tokens when present", () => {
    const repo = tempRepo();
    seedSession(repo, { cost_usd: 0.10, tokens: 1000 });
    seedSession(repo, { cost_usd: 0.20, tokens: 2000 });

    const stats = getStats(repo);
    expect(stats.avg_cost_usd).toBeCloseTo(0.15);
    expect(stats.avg_tokens).toBeCloseTo(1500);
  });

  it("returns null avg_cost_usd when no sessions have cost data", () => {
    const repo = tempRepo();
    seedSession(repo, { score: 80 });

    const stats = getStats(repo);
    expect(stats.avg_cost_usd).toBeNull();
    expect(stats.avg_tokens).toBeNull();
  });

  it("returns score_over_time in chronological order (oldest first)", () => {
    const repo = tempRepo();
    seedSession(repo, { score: 70 });
    seedSession(repo, { score: 85 });
    seedSession(repo, { score: 90 });

    const stats = getStats(repo);
    expect(stats.score_over_time).toHaveLength(3);
    // listSessions returns DESC and we reverse, so first should be earliest inserted
    expect(stats.score_over_time[0]!.score).toBe(70);
    expect(stats.score_over_time[2]!.score).toBe(90);
  });

  it("returns coverage_over_time with null when no coverage data", () => {
    const repo = tempRepo();
    seedSession(repo, { withChecks: true, withCoverage: false });

    const stats = getStats(repo);
    expect(stats.coverage_over_time).toHaveLength(1);
    expect(stats.coverage_over_time[0]!.coverage_pct).toBeNull();
  });

  it("extracts coverage_pct from final test check", () => {
    const repo = tempRepo();
    seedSession(repo, { withChecks: true, withCoverage: true });

    const stats = getStats(repo);
    expect(stats.coverage_over_time).toHaveLength(1);
    expect(stats.coverage_over_time[0]!.coverage_pct).toBeCloseTo(78.0);
  });

  it("is JSON-serialisable", () => {
    const repo = tempRepo();
    seedSession(repo, { score: 80, withRegressions: 1 });
    const stats = getStats(repo);
    expect(JSON.parse(JSON.stringify(stats))).toEqual(stats);
  });
});
