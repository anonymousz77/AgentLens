import { describe, it, expect } from "vitest";
import { computeScore } from "./score";
import type { ScoreInput } from "./score";
import type { Check, CheckKind, CheckPhase, ScoringConfig } from "../types";
import { DEFAULT_CONFIG } from "../types";

const W = DEFAULT_CONFIG.scoring;

function c(
  kind: CheckKind,
  phase: CheckPhase,
  passed: number,
  failed: number,
  total: number,
  coverage_pct: number | null = null
): Check {
  return {
    id: "id",
    session_id: "sid",
    kind,
    phase,
    passed,
    failed,
    total,
    coverage_pct,
    runtime_ms: null,
    raw_output: null,
  };
}

function score(input: ScoreInput, config: ScoringConfig = W): number {
  return computeScore(input, config).score;
}

function breakdown(input: ScoreInput, config: ScoringConfig = W) {
  return computeScore(input, config).breakdown;
}

describe("computeScore", () => {
  it("returns 100 when nothing changed", () => {
    const input: ScoreInput = {
      baseline: [c("test", "baseline", 10, 0, 10)],
      final:    [c("test", "final",    10, 0, 10)],
    };
    expect(score(input)).toBe(100);
    expect(breakdown(input)).toHaveLength(0);
  });

  it("penalises 1 test regression by test_regression_penalty", () => {
    const input: ScoreInput = {
      baseline: [c("test", "baseline", 10, 0, 10)],
      final:    [c("test", "final",     9, 1, 10)],
    };
    expect(score(input)).toBe(100 - W.test_regression_penalty);
  });

  it("penalises 2 test regressions", () => {
    const input: ScoreInput = {
      baseline: [c("test", "baseline", 10, 0, 10)],
      final:    [c("test", "final",     8, 2, 10)],
    };
    expect(score(input)).toBe(100 - 2 * W.test_regression_penalty);
  });

  it("penalises new test failures (total grew, passed unchanged)", () => {
    // 8 tests before, 2 added (total=10), both new tests fail
    const input: ScoreInput = {
      baseline: [c("test", "baseline", 8, 0, 8)],
      final:    [c("test", "final",    8, 2, 10)],
    };
    // regressionCount = max(0, 8-8) = 0; newFailureCount = max(0, 2-0-0) = 2
    expect(score(input)).toBe(100 - 2 * W.new_failure_penalty);
  });

  it("applies build break penalty when final.total drops to 0", () => {
    const input: ScoreInput = {
      baseline: [c("test", "baseline", 10, 0, 10)],
      final:    [c("test", "final",     0, 0,  0)],
    };
    expect(score(input)).toBe(100 - W.build_break_penalty);
  });

  it("does NOT apply build break when baseline already had failures", () => {
    // baseline had failures → not "clean baseline" — treated as regressions
    const input: ScoreInput = {
      baseline: [c("test", "baseline", 8, 2, 10)],
      final:    [c("test", "final",    0, 0,  0)],
    };
    // total dropped (0 < 10) → regressionCount = 0 (conservative)
    expect(score(input)).toBe(100);
  });

  it("rewards coverage improvement", () => {
    const input: ScoreInput = {
      baseline: [c("test", "baseline", 10, 0, 10, 80)],
      final:    [c("test", "final",    10, 0, 10, 84)],
    };
    // +4pp * 0.5 weight = +2; raw = 102, clamped = 100
    expect(score(input)).toBe(100);
  });

  it("penalises coverage drop", () => {
    const input: ScoreInput = {
      baseline: [c("test", "baseline", 10, 0, 10, 80)],
      final:    [c("test", "final",    10, 0, 10, 74)],
    };
    // -6pp * 0.5 = -3; score = 97
    expect(score(input)).toBe(97);
  });

  it("skips coverage when baseline coverage_pct is null", () => {
    const input: ScoreInput = {
      baseline: [c("test", "baseline", 10, 0, 10, null)],
      final:    [c("test", "final",    10, 0, 10,  80)],
    };
    expect(score(input)).toBe(100);
    expect(breakdown(input)).toHaveLength(0);
  });

  it("skips coverage when final coverage_pct is null", () => {
    const input: ScoreInput = {
      baseline: [c("test", "baseline", 10, 0, 10, 80)],
      final:    [c("test", "final",    10, 0, 10, null)],
    };
    expect(score(input)).toBe(100);
    expect(breakdown(input)).toHaveLength(0);
  });

  it("penalises type errors added", () => {
    const input: ScoreInput = {
      baseline: [c("type", "baseline", 0, 0, 0)],
      final:    [c("type", "final",    0, 2, 2)],
    };
    // -2 * 3 = -6
    expect(score(input)).toBe(94);
  });

  it("rewards type errors removed", () => {
    const input: ScoreInput = {
      baseline: [c("type", "baseline", 0, 5, 5)],
      final:    [c("type", "final",    0, 2, 2)],
    };
    // +3 * 3 = +9; raw = 109, clamped = 100
    expect(score(input)).toBe(100);
  });

  it("penalises lint errors added", () => {
    const input: ScoreInput = {
      baseline: [c("lint", "baseline", 0, 0, 0)],
      final:    [c("lint", "final",    0, 5, 5)],
    };
    // -5 * 1 = -5
    expect(score(input)).toBe(95);
  });

  it("rewards lint errors removed", () => {
    const input: ScoreInput = {
      baseline: [c("lint", "baseline", 0, 3, 3)],
      final:    [c("lint", "final",    0, 1, 1)],
    };
    // +2 * 1 = +2; raw = 102, clamped = 100
    expect(score(input)).toBe(100);
  });

  it("returns 100 when baseline has no test check (neutral)", () => {
    const input: ScoreInput = {
      baseline: [],
      final:    [c("test", "final", 5, 5, 10)],
    };
    expect(score(input)).toBe(100);
    expect(breakdown(input)).toHaveLength(0);
  });

  it("skips type scoring when baseline type check is missing", () => {
    const input: ScoreInput = {
      baseline: [],
      final:    [c("type", "final", 0, 3, 3)],
    };
    expect(score(input)).toBe(100);
  });

  it("does not penalise when total shrinks (conservative, tests removed)", () => {
    const input: ScoreInput = {
      baseline: [c("test", "baseline", 10, 0, 10)],
      final:    [c("test", "final",     8, 0,  8)],
    };
    // total < baseline.total → regressionCount = 0
    expect(score(input)).toBe(100);
  });

  it("clamps to 0 under heavy penalties", () => {
    const input: ScoreInput = {
      baseline: [
        c("test", "baseline", 10, 0, 10),
        c("type", "baseline",  0, 0,  0),
        c("lint", "baseline",  0, 0,  0),
      ],
      final: [
        c("test", "final",  0, 0,  0), // build break = -40
        c("type", "final",  0, 20, 20), // -60
        c("lint", "final",  0, 10, 10), // -10
      ],
    };
    // raw = 100 - 40 - 60 - 10 = -10, clamped to 0
    expect(score(input)).toBe(0);
  });

  it("respects custom weights", () => {
    const custom: ScoringConfig = {
      ...W,
      test_regression_penalty: 20,
    };
    const input: ScoreInput = {
      baseline: [c("test", "baseline", 10, 0, 10)],
      final:    [c("test", "final",     9, 1, 10)],
    };
    expect(score(input, custom)).toBe(80);
  });

  it("is deterministic — identical inputs produce identical output", () => {
    const input: ScoreInput = {
      baseline: [
        c("test", "baseline", 10, 0, 10, 80),
        c("type", "baseline",  0, 1,  1),
        c("lint", "baseline",  0, 2,  2),
      ],
      final: [
        c("test", "final",  8, 2, 10, 75),
        c("type", "final",  0, 3,  3),
        c("lint", "final",  0, 4,  4),
      ],
    };
    const r1 = computeScore(input, W);
    const r2 = computeScore(input, W);
    expect(r1).toEqual(r2);
  });

  it("sorts breakdown by reason string", () => {
    const input: ScoreInput = {
      baseline: [
        c("test", "baseline", 10, 0, 10),
        c("type", "baseline",  0, 0,  0),
        c("lint", "baseline",  0, 0,  0),
      ],
      final: [
        c("test", "final",  9, 1, 10),
        c("type", "final",  0, 2,  2),
        c("lint", "final",  0, 3,  3),
      ],
    };
    const { breakdown: bd } = computeScore(input, W);
    const reasons = bd.map((b) => b.reason);
    expect(reasons).toEqual([...reasons].sort());
  });

  it("breakdown deltas sum to (raw - base_score) before clamping", () => {
    const input: ScoreInput = {
      baseline: [
        c("test", "baseline", 10, 0, 10, 80),
        c("type", "baseline",  0, 1,  1),
      ],
      final: [
        c("test", "final",  8, 2, 10, 77),
        c("type", "final",  0, 3,  3),
      ],
    };
    const { breakdown: bd } = computeScore(input, W);
    const sumDeltas = bd.reduce((acc, b) => acc + b.delta, 0);
    // regressions: -30, coverage: -1.5, type: -6 → adjustment = -37.5
    expect(sumDeltas).toBeCloseTo(-37.5, 5);
  });
});
