import { describe, it, expect } from "vitest";
import { scorePR, toChecks } from "./scorePR";
import type { PreCheckResult } from "../pipeline";

function makeTestCheck(overrides: Partial<PreCheckResult> = {}): PreCheckResult {
  return {
    kind: "test",
    passed: 10,
    failed: 0,
    total: 10,
    coverage_pct: null,
    runtime_ms: 500,
    raw_output: "",
    ...overrides,
  };
}

function makeTypeCheck(overrides: Partial<PreCheckResult> = {}): PreCheckResult {
  return {
    kind: "type",
    passed: 0,
    failed: 0,
    total: 0,
    coverage_pct: null,
    runtime_ms: 200,
    raw_output: "",
    ...overrides,
  };
}

// ── toChecks helper ───────────────────────────────────────────────────────────

describe("toChecks", () => {
  it("converts PreCheckResult[] to Check[] with synthetic ids", () => {
    const results = [makeTestCheck()];
    const checks = toChecks(results, "final");
    expect(checks).toHaveLength(1);
    expect(checks[0]!.id).toBe("ci-final-0");
    expect(checks[0]!.session_id).toBe("ci");
    expect(checks[0]!.phase).toBe("final");
    expect(checks[0]!.kind).toBe("test");
    expect(checks[0]!.passed).toBe(10);
    expect(checks[0]!.failed).toBe(0);
    expect(checks[0]!.total).toBe(10);
  });

  it("preserves coverage_pct", () => {
    const results = [makeTestCheck({ coverage_pct: 75.5 })];
    const checks = toChecks(results, "baseline");
    expect(checks[0]!.coverage_pct).toBe(75.5);
  });
});

// ── scorePR — clean baseline mode ────────────────────────────────────────────

describe("scorePR (clean baseline)", () => {
  it("returns score=100 when all tests pass and no errors", () => {
    const result = scorePR("/fake/repo", {
      runChecksOverride: () => [makeTestCheck({ passed: 5, failed: 0, total: 5 })],
    });
    expect(result.score).toBe(100);
    expect(result.regressions).toHaveLength(0);
    expect(result.baselineMode).toBe("clean");
  });

  it("penalizes failing tests as new failures", () => {
    // 2 out of 5 tests fail → new_failure_penalty applied
    const result = scorePR("/fake/repo", {
      runChecksOverride: () => [makeTestCheck({ passed: 3, failed: 2, total: 5 })],
    });
    expect(result.score).toBeLessThan(100);
    expect(result.breakdown.some((b) => b.delta < 0)).toBe(true);
  });

  it("penalizes type errors", () => {
    const result = scorePR("/fake/repo", {
      runChecksOverride: () => [makeTypeCheck({ passed: 0, failed: 3, total: 3 })],
    });
    expect(result.score).toBeLessThan(100);
    // type_error_delta_weight=3 per error → 3 errors = -9 points
    const typeItem = result.breakdown.find((b) => b.reason.toLowerCase().includes("type"));
    expect(typeItem).toBeDefined();
    expect(typeItem!.delta).toBeLessThan(0);
  });

  it("returns finalChecks in the result", () => {
    const fakeChecks = [makeTestCheck()];
    const result = scorePR("/fake/repo", {
      runChecksOverride: () => fakeChecks,
    });
    expect(result.finalChecks).toEqual(fakeChecks);
  });

  it("handles empty check results (no detectable checks)", () => {
    const result = scorePR("/fake/repo", {
      runChecksOverride: () => [],
    });
    expect(result.score).toBe(100);
    expect(result.regressions).toHaveLength(0);
  });

  it("returns no regressions when multiple checks all pass", () => {
    const result = scorePR("/fake/repo", {
      runChecksOverride: () => [
        makeTestCheck({ passed: 10, failed: 0, total: 10 }),
        makeTypeCheck({ passed: 0, failed: 0, total: 0 }),
      ],
    });
    expect(result.score).toBe(100);
    expect(result.regressions).toHaveLength(0);
  });
});
