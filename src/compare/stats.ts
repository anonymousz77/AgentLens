/**
 * Pure statistical functions for agent comparison.
 * No I/O, no DB, fully deterministic. All math verified against known textbook values.
 *
 * Key choices documented:
 *  - Welch's t-test (unequal variances) — the correct default; never assume equal variances.
 *  - t-distribution CDF via regularized incomplete beta (Numerical Recipes §6.4).
 *  - 95% CI uses t critical value (bisection on CDF), not the large-sample z=1.96.
 *  - Cohen's d uses the pooled-SD formula; see note in welchTTest for the caveat.
 *  - MIN_N_FOR_SIGNIFICANCE: below this threshold we refuse to report a p-value as meaningful.
 */

export interface DescriptiveStats {
  n: number;
  mean: number;
  median: number;
  sd: number;
  min: number;
  max: number;
  /** 95% CI for the mean, t-distribution based. [NaN, NaN] when n < 2. */
  ci95: readonly [number, number];
}

export interface PairwiseResult {
  meanA: number;
  meanB: number;
  /** meanA - meanB */
  delta: number;
  t: number;
  /** Welch-Satterthwaite approximate degrees of freedom */
  df: number;
  p: number;
  /**
   * Cohen's d (pooled-SD form: sqrt(((nA-1)*sA² + (nB-1)*sB²) / (nA+nB-2))).
   * Assumes comparable group variances; interpret cautiously when variances differ markedly.
   * We use Welch's t (which handles unequal variances) but Cohen's d is still defined here
   * as a standardized effect size for practical interpretation.
   */
  cohensD: number;
  sufficientData: boolean;
  /** Set when sufficientData is false; explains which group falls below the threshold. */
  insufficientReason?: string;
}

/**
 * Both groups must have at least this many observations before we report
 * p-values and significance claims. Below this threshold the comparison is
 * "directional only" — the direction of the effect may be real but we cannot
 * make statistically meaningful claims from so few samples.
 */
export const MIN_N_FOR_SIGNIFICANCE = 5;

// ---------------------------------------------------------------------------
// Internal math: logGamma, regularized incomplete beta, t-distribution CDF
// ---------------------------------------------------------------------------

/**
 * Lanczos approximation for log Γ(x), x > 0.
 * Coefficients: g=7, from Numerical Recipes §6.1.
 */
function logGamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  // Reflection formula for x < 0.5
  if (x < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = c[0]!;
  const t = x + g + 0.5;
  for (let i = 1; i < c.length; i++) {
    a += c[i]! / (x + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

const FPMIN = 1e-30;
const BETA_EPS = 1e-10;
const BETA_MAXIT = 200;

/**
 * Continued fraction expansion for the regularized incomplete beta function.
 * Modified Lentz algorithm. Numerical Recipes §6.4 (betacf).
 */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= BETA_MAXIT; m++) {
    const m2 = 2 * m;
    // Even step
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    // Odd step
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < BETA_EPS) break;
  }
  return h;
}

/**
 * Regularized incomplete beta function I_x(a, b).
 * Numerical Recipes §6.4 (betai).
 * Returns 0 for x=0, 1 for x=1, undefined behavior for x outside [0,1].
 */
function betai(a: number, b: number, x: number): number {
  if (x === 0) return 0;
  if (x === 1) return 1;
  const lbeta = logGamma(a + b) - logGamma(a) - logGamma(b);
  const bt = Math.exp(lbeta + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b;
}

/**
 * Two-tailed p-value for the t-distribution.
 * Uses the identity: p = I_{df/(df+t²)}(df/2, 1/2)
 * Source: Abramowitz & Stegun §26.7.2; Numerical Recipes §6.4.
 */
function tPValue(t: number, df: number): number {
  const x = df / (df + t * t);
  return betai(df / 2, 0.5, x);
}

/**
 * t quantile — find t_crit such that tPValue(t_crit, df) = alpha.
 * Implemented via bisection on tPValue. Used for CI construction.
 * alpha=0.05 → 95% CI (two-tailed, so 97.5th percentile each side).
 */
function tQuantile(df: number, alpha: number): number {
  let lo = 0;
  let hi = 200;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tPValue(mid, df) > alpha) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Exported statistical functions
// ---------------------------------------------------------------------------

/** Descriptive statistics for a numeric sample. */
export function descriptiveStats(values: readonly number[]): DescriptiveStats {
  const n = values.length;
  if (n === 0) {
    return { n: 0, mean: NaN, median: NaN, sd: NaN, min: NaN, max: NaN, ci95: [NaN, NaN] };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[n - 1]!;

  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;

  const median =
    n % 2 === 1
      ? sorted[(n - 1) / 2]!
      : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;

  if (n === 1) {
    return { n, mean, median, sd: NaN, min, max, ci95: [NaN, NaN] };
  }

  // Sample variance (Bessel's correction, n-1 denominator): agent sessions are a sample,
  // not the full population of that agent's behavior. Consistent with welchTTest below.
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);

  const tCrit = tQuantile(n - 1, 0.05); // 95% CI, two-tailed → α=0.05
  const se = sd / Math.sqrt(n);
  const ci95: readonly [number, number] = [mean - tCrit * se, mean + tCrit * se];

  return { n, mean, median, sd, min, max, ci95 };
}

/**
 * Welch's two-sample t-test (unequal variances).
 * Returns structured results including honesty flags for small samples.
 */
export function welchTTest(a: readonly number[], b: readonly number[]): PairwiseResult {
  const nA = a.length;
  const nB = b.length;

  const meanA = a.reduce((s, v) => s + v, 0) / nA;
  const meanB = b.reduce((s, v) => s + v, 0) / nB;

  // Sample variances (Bessel's correction: n-1 denominator)
  const varA = nA > 1 ? a.reduce((s, v) => s + (v - meanA) ** 2, 0) / (nA - 1) : NaN;
  const varB = nB > 1 ? b.reduce((s, v) => s + (v - meanB) ** 2, 0) / (nB - 1) : NaN;

  const seA = varA / nA; // variance of the mean estimate for group A
  const seB = varB / nB; // variance of the mean estimate for group B
  const se = Math.sqrt(seA + seB);

  const t = (meanA - meanB) / se;

  // Welch-Satterthwaite degrees of freedom
  const df = (seA + seB) ** 2 / (seA ** 2 / (nA - 1) + seB ** 2 / (nB - 1));

  const p = tPValue(Math.abs(t), df);

  const delta = meanA - meanB;

  // Cohen's d: pooled-SD form weighted by sample sizes.
  // We use Welch's t for inference (handles unequal variances) but Cohen's d is
  // the standard standardized effect size for practical interpretation.
  // Pooled SD: sqrt(((nA-1)*sA² + (nB-1)*sB²) / (nA+nB-2))
  // When variances are markedly unequal, interpret d cautiously (see output note).
  const pooledVar = ((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2);
  const cohensD = Math.abs(delta) / Math.sqrt(pooledVar);

  // Honesty gate: refuse to assert significance for small samples.
  const smallA = nA < MIN_N_FOR_SIGNIFICANCE;
  const smallB = nB < MIN_N_FOR_SIGNIFICANCE;
  const sufficientData = !smallA && !smallB;
  let insufficientReason: string | undefined;
  if (smallA && smallB) {
    insufficientReason = `both groups have n < ${MIN_N_FOR_SIGNIFICANCE} (nA=${nA}, nB=${nB})`;
  } else if (smallA) {
    insufficientReason = `group A has nA=${nA} < ${MIN_N_FOR_SIGNIFICANCE}`;
  } else if (smallB) {
    insufficientReason = `group B has nB=${nB} < ${MIN_N_FOR_SIGNIFICANCE}`;
  }

  return { meanA, meanB, delta, t, df, p, cohensD, sufficientData, insufficientReason };
}

/** Classify Cohen's d magnitude using conventional thresholds (Cohen 1988). */
export function effectSizeLabel(d: number): string {
  const abs = Math.abs(d);
  if (abs < 0.2) return "negligible";
  if (abs < 0.5) return "small";
  if (abs < 0.8) return "medium";
  return "large";
}
