import type { Check, CheckKind, ScoringConfig } from "../types";

export interface BreakdownItem {
  reason: string;
  delta: number;
}

export interface ScoreInput {
  baseline: Check[];
  final: Check[];
}

export interface ScoreResult {
  score: number;
  breakdown: BreakdownItem[];
}

function findCheck(checks: Check[], kind: CheckKind): Check | undefined {
  return checks.find((c) => c.kind === kind);
}

export function computeScore(
  input: ScoreInput,
  config: ScoringConfig
): ScoreResult {
  const { baseline, final } = input;
  const breakdown: BreakdownItem[] = [];
  let adjustment = 0;

  function push(reason: string, delta: number): void {
    if (delta !== 0) {
      breakdown.push({ reason, delta });
      adjustment += delta;
    }
  }

  // ── TEST + COVERAGE ───────────────────────────────────────────────────────
  const bTest = findCheck(baseline, "test");
  const fTest = findCheck(final, "test");

  if (bTest !== undefined && fTest !== undefined) {
    // Build break: baseline had tests, final suite produced zero results —
    // the test runner itself crashed or the suite was unreachable.
    if (bTest.failed === 0 && bTest.total > 0 && fTest.total === 0) {
      push("build break (test suite failed to run)", -config.build_break_penalty);
    } else {
      // NOTE: We infer regressions from aggregate passed/failed/total deltas
      // only — we do not have per-test names. Conservative rule: count a drop
      // in passed as regressions only when total did not shrink (a shrinking
      // total likely means tests were intentionally removed). False positives
      // are possible when tests are renamed or reordered in the same run.
      const regressionCount =
        fTest.total >= bTest.total
          ? Math.max(0, bTest.passed - fTest.passed)
          : 0;

      // New failures beyond the regressed tests.
      const newFailureCount = Math.max(
        0,
        fTest.failed - bTest.failed - regressionCount
      );

      if (regressionCount > 0) {
        push(
          `test regressions (${regressionCount})`,
          -(regressionCount * config.test_regression_penalty)
        );
      }
      if (newFailureCount > 0) {
        push(
          `new test failures (${newFailureCount})`,
          -(newFailureCount * config.new_failure_penalty)
        );
      }
    }

    // Coverage: prefer a dedicated "coverage" kind check; fall back to the
    // coverage_pct field on the test check. Skip entirely if either side is
    // null — missing coverage data is never penalised.
    const bCov = findCheck(baseline, "coverage") ?? bTest;
    const fCov = findCheck(final, "coverage") ?? fTest;

    if (bCov.coverage_pct !== null && fCov.coverage_pct !== null) {
      const covDiff = fCov.coverage_pct - bCov.coverage_pct;
      const covDelta = covDiff * config.coverage_delta_weight;
      const sign = covDiff >= 0 ? "+" : "";
      push(`coverage delta (${sign}${covDiff.toFixed(1)}pp)`, covDelta);
    }
  }
  // If baseline has no test check, skip test/coverage scoring entirely.
  // Missing baseline data is never penalised.

  // ── TYPE ERRORS ───────────────────────────────────────────────────────────
  // delta = (baseline.failed - final.failed) * weight
  // Positive delta = errors removed = improvement; negative = errors added.
  const bType = findCheck(baseline, "type");
  const fType = findCheck(final, "type");

  if (bType !== undefined && fType !== undefined) {
    const added = fType.failed - bType.failed;
    if (added > 0) {
      push(`type errors added (${added})`, -added * config.type_error_delta_weight);
    } else if (added < 0) {
      push(
        `type errors removed (${-added})`,
        -added * config.type_error_delta_weight
      );
    }
  }

  // ── LINT ERRORS ───────────────────────────────────────────────────────────
  const bLint = findCheck(baseline, "lint");
  const fLint = findCheck(final, "lint");

  if (bLint !== undefined && fLint !== undefined) {
    const added = fLint.failed - bLint.failed;
    if (added > 0) {
      push(`lint errors added (${added})`, -added * config.lint_error_delta_weight);
    } else if (added < 0) {
      push(
        `lint errors removed (${-added})`,
        -added * config.lint_error_delta_weight
      );
    }
  }

  // ── FINAL SCORE ───────────────────────────────────────────────────────────
  const raw = config.base_score + adjustment;
  const clamped = Math.min(100, Math.max(0, raw));

  // Sort by reason string for determinism across identical inputs.
  breakdown.sort((a, b) => a.reason.localeCompare(b.reason));

  return { score: Math.round(clamped), breakdown };
}
