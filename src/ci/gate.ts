import type { DetectedRegression } from "../scoring/regressions";

export function shouldFail(
  score: number,
  regressions: DetectedRegression[],
  minScore: number,
  noFail: boolean
): boolean {
  if (noFail) return false;
  if (score < minScore) return true;
  if (regressions.some((r) => r.severity === "critical")) return true;
  return false;
}
