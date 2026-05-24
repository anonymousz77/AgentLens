import { describe, it, expect } from "vitest";
import { shouldFail } from "./gate";
import type { DetectedRegression } from "../scoring/regressions";

const noRegressions: DetectedRegression[] = [];
const criticalRegression: DetectedRegression[] = [
  { description: "build break", file: null, hunk: null, severity: "critical" },
];
const highRegression: DetectedRegression[] = [
  { description: "test regression", file: "src/foo.ts", hunk: null, severity: "high" },
];

describe("shouldFail", () => {
  it("passes when score >= minScore and no critical regressions", () => {
    expect(shouldFail(85, noRegressions, 70, false)).toBe(false);
  });

  it("passes at exact minScore boundary", () => {
    expect(shouldFail(70, noRegressions, 70, false)).toBe(false);
  });

  it("fails when score < minScore", () => {
    expect(shouldFail(60, noRegressions, 70, false)).toBe(true);
  });

  it("fails when critical regression present regardless of score", () => {
    expect(shouldFail(90, criticalRegression, 70, false)).toBe(true);
  });

  it("does not fail for non-critical (high) regressions when score passes", () => {
    expect(shouldFail(85, highRegression, 70, false)).toBe(false);
  });

  it("noFail overrides score failure", () => {
    expect(shouldFail(40, noRegressions, 70, true)).toBe(false);
  });

  it("noFail overrides critical regression", () => {
    expect(shouldFail(40, criticalRegression, 70, true)).toBe(false);
  });
});
