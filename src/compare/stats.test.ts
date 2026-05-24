import { describe, it, expect } from "vitest";
import {
  descriptiveStats,
  welchTTest,
  effectSizeLabel,
  MIN_N_FOR_SIGNIFICANCE,
} from "./stats";

// ---------------------------------------------------------------------------
// descriptiveStats
// ---------------------------------------------------------------------------

describe("descriptiveStats", () => {
  // Wikipedia variance example: [2,4,4,4,5,5,7,9]
  // Agent sessions are a SAMPLE of agent behavior, so sample SD (/(n-1)) is correct.
  // n=8, mean=5, sample SD = sqrt(32/7) ≈ 2.138, median=4.5, min=2, max=9
  it("computes correct stats for the Wikipedia variance example (sample SD)", () => {
    const s = descriptiveStats([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(s.n).toBe(8);
    expect(s.mean).toBeCloseTo(5, 10);
    // sample variance = 32/7 ≈ 4.571, sample SD ≈ 2.138 (Bessel's correction, /(n-1))
    expect(s.sd).toBeCloseTo(2.138, 2);
    expect(s.median).toBeCloseTo(4.5, 10);
    expect(s.min).toBe(2);
    expect(s.max).toBe(9);
  });

  it("95% CI for Wikipedia example uses sample SD: approximately [3.21, 6.79]", () => {
    // CI = mean ± t_{0.025, df=7} * sampleSD/sqrt(n) = 5 ± 2.365 * 2.138/sqrt(8) ≈ [3.21, 6.79]
    const s = descriptiveStats([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(s.ci95[0]).toBeCloseTo(3.21, 1);
    expect(s.ci95[1]).toBeCloseTo(6.79, 1);
  });

  it("returns n=0 with NaN fields for empty array", () => {
    const s = descriptiveStats([]);
    expect(s.n).toBe(0);
    expect(isNaN(s.mean)).toBe(true);
    expect(isNaN(s.ci95[0])).toBe(true);
  });

  it("returns NaN CI for n=1", () => {
    const s = descriptiveStats([42]);
    expect(s.n).toBe(1);
    expect(s.mean).toBe(42);
    expect(isNaN(s.ci95[0])).toBe(true);
    expect(isNaN(s.ci95[1])).toBe(true);
  });

  it("handles a single-element repeated array (sd=0)", () => {
    const s = descriptiveStats([7, 7, 7, 7, 7]);
    expect(s.mean).toBe(7);
    expect(s.sd).toBe(0);
    // CI collapses to [7, 7] when sd=0
    expect(s.ci95[0]).toBeCloseTo(7, 5);
    expect(s.ci95[1]).toBeCloseTo(7, 5);
  });
});

// ---------------------------------------------------------------------------
// welchTTest — textbook verification
// ---------------------------------------------------------------------------

describe("welchTTest", () => {
  /**
   * Textbook example (hand-computed and verified against scipy.stats.ttest_ind equal_var=False):
   *   A = [2.3, 2.1, 2.5, 2.4, 2.2]  n=5, mean=2.30, s²=0.025
   *   B = [1.8, 1.9, 2.0, 2.1, 1.7]  n=5, mean=1.90, s²=0.025
   *
   * By hand:
   *   se = sqrt(0.025/5 + 0.025/5) = sqrt(0.01) = 0.1
   *   t  = (2.30 - 1.90) / 0.1 = 4.00 (exact)
   *   df = (0.005+0.005)² / ((0.005²/4) + (0.005²/4)) = 0.0001/0.0000125 = 8.0 (exact)
   *   p  ≈ 0.0039 (two-tailed, verified via scipy)
   *   Cohen's d = 0.40 / sqrt(0.025) ≈ 2.530
   */
  const A = [2.3, 2.1, 2.5, 2.4, 2.2];
  const B = [1.8, 1.9, 2.0, 2.1, 1.7];

  it("t statistic matches textbook value of 4.00", () => {
    const r = welchTTest(A, B);
    expect(r.t).toBeCloseTo(4.0, 3);
  });

  it("Welch-Satterthwaite df matches textbook value of 8.0", () => {
    const r = welchTTest(A, B);
    expect(r.df).toBeCloseTo(8.0, 2);
  });

  it("p-value is significant (< 0.01) — matches scipy p≈0.0039", () => {
    const r = welchTTest(A, B);
    expect(r.p).toBeLessThan(0.01);
    expect(r.p).toBeGreaterThan(0.001); // not astronomically small
    expect(r.p).toBeCloseTo(0.0039, 3);
  });

  it("sufficientData is true when both groups have n=MIN_N_FOR_SIGNIFICANCE", () => {
    const r = welchTTest(A, B); // both n=5 = MIN_N_FOR_SIGNIFICANCE
    expect(r.sufficientData).toBe(true);
    expect(r.insufficientReason).toBeUndefined();
  });

  it("delta is meanA - meanB = +0.40", () => {
    const r = welchTTest(A, B);
    expect(r.delta).toBeCloseTo(0.4, 10);
  });

  it("Cohen's d is approximately 2.53 (pooled-SD)", () => {
    // pooledSd = sqrt(((4*0.025 + 4*0.025)/8)) = sqrt(0.025) ≈ 0.1581
    // d = 0.40/0.1581 ≈ 2.530
    const r = welchTTest(A, B);
    expect(r.cohensD).toBeCloseTo(2.53, 1);
  });
});

// ---------------------------------------------------------------------------
// Honesty gate (insufficient data)
// ---------------------------------------------------------------------------

describe("welchTTest — honesty gate", () => {
  const small = [80, 85, 75, 90]; // n=4 < MIN_N_FOR_SIGNIFICANCE=5
  const ok = [70, 75, 80, 72, 68]; // n=5 = threshold

  it("flags as insufficient when group A is below threshold", () => {
    const r = welchTTest(small, ok);
    expect(r.sufficientData).toBe(false);
    expect(r.insufficientReason).toBeDefined();
    expect(r.insufficientReason).toContain("nA=4");
  });

  it("flags as insufficient when group B is below threshold", () => {
    const r = welchTTest(ok, small);
    expect(r.sufficientData).toBe(false);
    expect(r.insufficientReason).toContain("nB=4");
  });

  it("flags both groups when both are below threshold", () => {
    const r = welchTTest([1, 2, 3], [4, 5, 6]); // both n=3
    expect(r.sufficientData).toBe(false);
    expect(r.insufficientReason).toContain("both");
  });

  it("p-value is still computed even with insufficient data (math doesn't stop)", () => {
    const r = welchTTest(small, ok);
    expect(isNaN(r.p)).toBe(false); // math runs but sufficientData=false means don't trust it
  });
});

// ---------------------------------------------------------------------------
// Identical samples → no difference, p≈1, d=0
// ---------------------------------------------------------------------------

describe("welchTTest — identical samples", () => {
  const vals = [80, 85, 75, 90, 70];

  it("delta is 0 for identical samples", () => {
    const r = welchTTest(vals, vals);
    expect(r.delta).toBeCloseTo(0, 10);
  });

  it("p-value is approximately 1 for identical samples (t=0)", () => {
    const r = welchTTest(vals, vals);
    expect(r.p).toBeCloseTo(1, 3);
  });

  it("Cohen's d is 0 for identical samples", () => {
    const r = welchTTest(vals, vals);
    expect(r.cohensD).toBe(0);
  });

  it("t statistic is 0 for identical samples", () => {
    const r = welchTTest(vals, vals);
    expect(r.t).toBeCloseTo(0, 10);
  });
});

// ---------------------------------------------------------------------------
// effectSizeLabel
// ---------------------------------------------------------------------------

describe("effectSizeLabel", () => {
  it("labels d < 0.2 as negligible", () => expect(effectSizeLabel(0.1)).toBe("negligible"));
  it("labels 0.2 ≤ d < 0.5 as small", () => expect(effectSizeLabel(0.3)).toBe("small"));
  it("labels 0.5 ≤ d < 0.8 as medium", () => expect(effectSizeLabel(0.65)).toBe("medium"));
  it("labels d ≥ 0.8 as large", () => expect(effectSizeLabel(1.5)).toBe("large"));
  it("works with negative d (uses absolute value)", () => expect(effectSizeLabel(-1.0)).toBe("large"));
});
