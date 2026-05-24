// Deterministic in-memory demo data generator.
// Never reads from or writes to the real SQLite database.

import type { Session, Check, Diff, Regression } from "../types";
import type {
  SessionSummary,
  SessionDetail,
  CheckDelta,
  AgentStats,
  ScoreOverTimePoint,
  CoverageOverTimePoint,
} from "../api/types";
import type { BreakdownItem } from "../scoring/score";

// ── Seeded LCG PRNG ───────────────────────────────────────────────────────────

function makeLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Fixed anchor keeps screenshots reproducible across runs.
const ANCHOR_MS = Date.parse("2026-05-24T00:00:00Z");
const SPAN_MS = 30 * 24 * 60 * 60 * 1000;

const AGENTS = ["claude-code", "cursor", "aider", "copilot", "windsurf"] as const;

const TASKS = [
  "Refactor authentication middleware",
  "Add pagination to sessions list",
  "Fix null pointer in session scoring",
  "Implement dark mode toggle",
  "Migrate database to new schema",
  "Add unit tests for scoring engine",
  "Optimize query performance",
  "Update TypeScript to strict mode",
  "Implement file watcher service",
  "Add rate limiting to API",
  "Fix memory leak in constellation view",
  "Implement session comparison view",
  "Add CSV export for sessions",
  "Refactor component architecture",
  "Fix flaky test in CI pipeline",
  "Add keyboard shortcuts",
  "Implement undo/redo system",
  "Fix race condition in watcher",
  "Add session tags feature",
  "Optimize bundle size",
  "Add error boundary components",
  "Implement session filtering",
  "Fix accessibility issues",
  "Add localization support",
  "Implement session replay",
  "Add metrics dashboard",
  "Fix websocket reconnection",
  "Implement code coverage tracking",
];

const REG_DESCRIPTIONS = [
  "TestUserAuth.test_login_failure: AssertionError: expected 401 got 200",
  "TypeError: Cannot read property 'score' of undefined",
  "test_session_scoring: score mismatch — expected 85, got 52",
  "ESLint: 'useEffect' has missing dependency array",
  "TS2345: Argument of type 'string' is not assignable to 'number'",
  "test_db_migration: foreign key constraint violation on sessions",
  "test_api_sessions: expected array, got null",
  "TestWatcher.test_reconnect: TimeoutError after 5000ms",
  "test_coverage_delta: coverage dropped below threshold",
  "TS2339: Property 'id' does not exist on type 'unknown'",
];

const REG_FILES = [
  "src/auth/user_auth.py",
  "src/api/sessions.ts",
  "src/scoring/score.ts",
  "src/db/sessions.ts",
  "src/components/StatCard.tsx",
  "src/server/api.ts",
  "tests/integration/test_sessions.py",
  "src/watchers/file_watcher.ts",
];

// ── Score band helpers ────────────────────────────────────────────────────────

type Band = "green" | "amber" | "red";

function bandForIndex(i: number): Band {
  if (i < 22) return "green"; // 22/36 ≈ 61 %
  if (i < 31) return "amber"; //  9/36 ≈ 25 %
  return "red";               //  5/36 ≈ 14 %
}

function scoreForBand(band: Band, rng: () => number): number {
  if (band === "green") return 80 + Math.floor(rng() * 21); // 80-100
  if (band === "amber") return 50 + Math.floor(rng() * 29); // 50-78
  return 10 + Math.floor(rng() * 38);                       // 10-47
}

// ── Check helpers ─────────────────────────────────────────────────────────────

function makeCheck(
  sid: string,
  kind: "test" | "type" | "lint",
  phase: "baseline" | "final",
  passed: number,
  failed: number,
  coveragePct: number | null,
  rng: () => number
): Check {
  return {
    id: `demo-check-${sid}-${kind}-${phase}`,
    session_id: sid,
    kind,
    phase,
    passed,
    failed,
    total: passed + failed,
    coverage_pct: coveragePct,
    runtime_ms: Math.floor(500 + rng() * 7500),
    raw_output: null,
  };
}

// ── Regression helpers ────────────────────────────────────────────────────────

function makeRegression(
  sid: string,
  idx: number,
  severity: "low" | "medium" | "high" | "critical",
  descIdx: number,
  fileIdx: number,
  rng: () => number
): Regression {
  const lineA = Math.floor(20 + rng() * 100);
  const lenA  = Math.floor(5 + rng() * 10);
  const lineB = Math.floor(20 + rng() * 100);
  const lenB  = Math.floor(5 + rng() * 10);
  return {
    id: `demo-reg-${sid}-${idx}`,
    session_id: sid,
    description: REG_DESCRIPTIONS[descIdx % REG_DESCRIPTIONS.length]!,
    file: REG_FILES[fileIdx % REG_FILES.length]!,
    hunk: `@@ -${lineA},${lenA} +${lineB},${lenB} @@`,
    severity,
  };
}

// ── Per-session generation ────────────────────────────────────────────────────

interface DemoSession {
  summary: SessionSummary;
  detail: SessionDetail;
}

function generateSession(i: number, rng: () => number): DemoSession {
  const sid  = `demo-${String(i).padStart(4, "0")}`;
  const band  = bandForIndex(i);
  const score = scoreForBand(band, rng);

  const agent = AGENTS[i % AGENTS.length] as string;
  const task  = i < TASKS.length ? (TASKS[i] ?? null) : null;

  // Timestamps — evenly spaced with small jitter so spread reads as real usage.
  const baseMs     = ANCHOR_MS - SPAN_MS + (i / 35) * SPAN_MS;
  const jitter     = (rng() - 0.5) * 4 * 60 * 60 * 1000; // ±2 h
  const startedMs  = baseMs + jitter;
  const durationMs = (8 + rng() * 82) * 60 * 1000;        // 8-90 min
  const startedAt  = new Date(startedMs).toISOString();
  const endedAt    = new Date(startedMs + durationMs).toISOString();

  // Diff size — bigger / riskier changes correlate with lower scores.
  const cx         = band === "red" ? 3 : band === "amber" ? 1.8 : 1;
  const filesChanged = Math.floor(1 + rng() * 6 * cx);
  const linesAdded   = Math.floor(20 + rng() * 200 * cx);
  const linesRemoved = Math.floor(5 + rng() * 80 * cx);

  // Tokens / cost (70 % have real token counts, rest are diff-estimated).
  const hasTokens    = rng() < 0.7;
  const tokens       = hasTokens ? Math.floor(8_000 + rng() * 120_000) : null;
  const costUsd      = hasTokens ? (tokens! / 1_000_000) * 3 : null;
  const costEstimated = hasTokens ? 0 : 1;

  // Git SHAs — 7-char hex strings.
  const sha    = () => Math.floor(rng() * 0xfffffff).toString(16).padStart(7, "0");
  const baseSha = sha();
  const headSha = sha();

  // ── Baseline checks (clean starting state) ──────────────────────────────────
  const baseTestPassed = Math.floor(80 + rng() * 100);     // 80-179
  const baseTypeFailed = rng() < 0.2 ? Math.floor(rng() * 3) : 0;
  const baseLintFailed = Math.floor(rng() * 8);
  const hasCoverage    = rng() < 0.6;
  const baseCovPct     = hasCoverage ? Math.round(60 + rng() * 30) : null;

  // ── Final checks — diverge by band ──────────────────────────────────────────
  let finalTestPassed = baseTestPassed;
  let finalTestFailed = 0;
  let finalTypeFailed = baseTypeFailed;
  let finalLintFailed = baseLintFailed;
  let finalCovPct     = baseCovPct;

  if (band === "green") {
    finalTestPassed = baseTestPassed + Math.floor(rng() * 4); // up to +3 new passes
    finalTypeFailed = Math.max(0, baseTypeFailed - Math.floor(rng() * 2));
    finalLintFailed = Math.max(0, baseLintFailed - Math.floor(rng() * 3));
    if (baseCovPct !== null) finalCovPct = Math.min(100, baseCovPct + Math.floor(rng() * 4));
  } else if (band === "amber") {
    const newFails  = 1 + Math.floor(rng() * 4); // 1-4 new failures
    finalTestFailed = newFails;
    finalTestPassed = Math.max(0, baseTestPassed - newFails);
    finalTypeFailed = baseTypeFailed + (rng() < 0.4 ? Math.floor(rng() * 3) : 0);
    if (baseCovPct !== null) finalCovPct = Math.max(0, baseCovPct - Math.floor(rng() * 5));
  } else {
    const newFails  = 3 + Math.floor(rng() * 6); // 3-8 new failures
    finalTestFailed = newFails;
    finalTestPassed = Math.max(0, baseTestPassed - newFails);
    finalTypeFailed = baseTypeFailed + Math.floor(rng() * 5);
    finalLintFailed = baseLintFailed + Math.floor(rng() * 6);
    if (baseCovPct !== null) finalCovPct = Math.max(0, baseCovPct - Math.floor(rng() * 12));
  }

  const baselineChecks: Check[] = [
    makeCheck(sid, "test", "baseline", baseTestPassed, 0,             baseCovPct, rng),
    makeCheck(sid, "type", "baseline", 0,              baseTypeFailed, null,       rng),
    makeCheck(sid, "lint", "baseline", 0,              baseLintFailed, null,       rng),
  ];

  const finalChecks: Check[] = [
    makeCheck(sid, "test", "final", finalTestPassed, finalTestFailed, finalCovPct, rng),
    makeCheck(sid, "type", "final", 0,               finalTypeFailed, null,        rng),
    makeCheck(sid, "lint", "final", 0,               finalLintFailed, null,        rng),
  ];

  // Deltas (mirrors what src/api/read.ts computes from DB rows).
  const deltas: CheckDelta[] = (["test", "type", "lint"] as const).map((kind) => {
    const b = baselineChecks.find((c) => c.kind === kind) ?? null;
    const f = finalChecks.find((c) => c.kind === kind)    ?? null;
    const coverage_delta =
      b?.coverage_pct != null && f?.coverage_pct != null
        ? f.coverage_pct - b.coverage_pct
        : null;
    return {
      kind,
      baseline: b,
      final: f,
      passed_delta:  (f?.passed ?? 0) - (b?.passed ?? 0),
      failed_delta:  (f?.failed ?? 0) - (b?.failed ?? 0),
      coverage_delta,
    };
  });

  // ── Regressions ──────────────────────────────────────────────────────────────
  const regressions: Regression[] = [];
  const regCount =
    band === "green" ? 0
    : band === "amber" ? 1 + Math.floor(rng() * 2)  // 1-2
    :                    3 + Math.floor(rng() * 3);  // 3-5

  for (let r = 0; r < regCount; r++) {
    const severity =
      band === "red"
        ? (["medium", "high", "critical"] as const)[Math.floor(rng() * 3)]!
        : (["low",    "medium"]            as const)[Math.floor(rng() * 2)]!;
    regressions.push(
      makeRegression(
        sid, r, severity,
        Math.floor(rng() * REG_DESCRIPTIONS.length),
        Math.floor(rng() * REG_FILES.length),
        rng,
      )
    );
  }

  // ── Score breakdown (plausible, consistent with score band) ─────────────────
  const breakdown: BreakdownItem[] = [];
  if (band === "green") {
    const newPasses = finalTestPassed - baseTestPassed;
    if (newPasses > 0) {
      breakdown.push({ reason: `${newPasses} new test${newPasses > 1 ? "s" : ""} passing`, delta: 0 });
    } else {
      breakdown.push({ reason: "All checks pass — no regressions", delta: 0 });
    }
  } else if (band === "amber") {
    breakdown.push({
      reason: `${finalTestFailed} new test failure${finalTestFailed > 1 ? "s" : ""}`,
      delta: -(finalTestFailed * 8),
    });
    const typeAdded = finalTypeFailed - baseTypeFailed;
    if (typeAdded > 0) {
      breakdown.push({
        reason: `${typeAdded} type error${typeAdded > 1 ? "s" : ""} introduced`,
        delta: -(typeAdded * 3),
      });
    }
  } else {
    const testRegs = Math.min(regressions.length, 5);
    breakdown.push({
      reason: `${testRegs} test regression${testRegs > 1 ? "s" : ""}`,
      delta: -(testRegs * 15),
    });
    if (finalTestFailed > 0) {
      breakdown.push({
        reason: `${finalTestFailed} new test failure${finalTestFailed > 1 ? "s" : ""}`,
        delta: -(finalTestFailed * 8),
      });
    }
    const typeAdded = finalTypeFailed - baseTypeFailed;
    if (typeAdded > 0) {
      breakdown.push({
        reason: `${typeAdded} type error${typeAdded > 1 ? "s" : ""} introduced`,
        delta: -(typeAdded * 3),
      });
    }
  }

  // ── Assemble objects conforming to the type contract ─────────────────────────

  const diff: Diff = {
    id: `demo-diff-${sid}`,
    session_id: sid,
    files_changed: filesChanged,
    lines_added:   linesAdded,
    lines_removed: linesRemoved,
    patch: `--- a/src/example.ts\n+++ b/src/example.ts\n@@ -1,4 +1,4 @@\n-old code\n+new code\n`,
  };

  const session: Session = {
    id: sid,
    repo_path: "/demo/my-project",
    agent_name: agent,
    started_at: startedAt,
    ended_at:   endedAt,
    git_base_sha: baseSha,
    git_head_sha: headSha,
    score,
    tokens,
    cost_usd: costUsd,
    cost_estimated: costEstimated,
    notes: null,
    task,
  };

  const summary: SessionSummary = {
    id: sid,
    agent_name: agent,
    started_at: startedAt,
    ended_at:   endedAt,
    score,
    files_changed:    filesChanged,
    lines_added:      linesAdded,
    lines_removed:    linesRemoved,
    regressions_count: regressions.length,
    task,
    cost_estimated: costEstimated,
  };

  const detail: SessionDetail = {
    session,
    diff,
    baseline_checks: baselineChecks,
    final_checks:    finalChecks,
    deltas,
    regressions,
    score_breakdown: breakdown,
    score,
  };

  return { summary, detail };
}

// ── Module-level cache (generated once, reused across requests) ───────────────

let _sessions: DemoSession[] | null = null;

function getAll(): DemoSession[] {
  if (_sessions !== null) return _sessions;
  const rng = makeLcg(0xdeadbeef);
  _sessions = Array.from({ length: 36 }, (_, i) => generateSession(i, rng));
  return _sessions;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getDemoSessions(): SessionSummary[] {
  return getAll().map((s) => s.summary);
}

export function getDemoSession(id: string): SessionDetail | null {
  return getAll().find((s) => s.summary.id === id)?.detail ?? null;
}

export function getDemoStats(): AgentStats {
  const all = getAll();

  // Chronological order (oldest → newest) for time-series charts.
  const sorted = [...all].sort(
    (a, b) =>
      new Date(a.summary.started_at).getTime() -
      new Date(b.summary.started_at).getTime()
  );

  let scoreSum = 0, scoreCount = 0;
  let costSum  = 0, costCount  = 0;
  let tokenSum = 0, tokenCount = 0;
  let totalRegressions = 0;

  for (const s of all) {
    const sess = s.detail.session;
    if (s.summary.score !== null) { scoreSum += s.summary.score; scoreCount++; }
    totalRegressions += s.summary.regressions_count;
    if (sess.cost_usd !== null) { costSum += sess.cost_usd; costCount++; }
    if (sess.tokens  !== null) { tokenSum += sess.tokens;  tokenCount++; }
  }

  const score_over_time: ScoreOverTimePoint[] = sorted.map((s) => ({
    started_at: s.summary.started_at,
    score: s.summary.score,
  }));

  const coverage_over_time: CoverageOverTimePoint[] = sorted.map((s) => {
    const finalChecks = s.detail.final_checks;
    const covCheck =
      finalChecks.find((c) => c.kind === "coverage") ??
      finalChecks.find((c) => c.kind === "test" && c.coverage_pct !== null);
    return {
      started_at: s.summary.started_at,
      coverage_pct: covCheck?.coverage_pct ?? null,
    };
  });

  return {
    sessions_count: 36,
    avg_score:    scoreCount > 0 ? scoreSum / scoreCount : null,
    total_regressions_caught: totalRegressions,
    avg_cost_usd: costCount  > 0 ? costSum  / costCount  : null,
    avg_tokens:   tokenCount > 0 ? tokenSum / tokenCount : null,
    score_over_time,
    coverage_over_time,
  };
}
