import { describe, it, expect } from "vitest";
import { detectRegressions } from "./regressions";
import type { Check, CheckKind, CheckPhase } from "../types";

function c(
  kind: CheckKind,
  phase: CheckPhase,
  passed: number,
  failed: number,
  total: number
): Check {
  return {
    id: "id",
    session_id: "sid",
    kind,
    phase,
    passed,
    failed,
    total,
    coverage_pct: null,
    runtime_ms: null,
    raw_output: null,
  };
}

const SAMPLE_PATCH = `diff --git a/src/index.ts b/src/index.ts
index abc..def 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -12,7 +12,6 @@ function foo() {
-  const x = 1;
+  const x = "oops";
 }
diff --git a/src/index.test.ts b/src/index.test.ts
index 111..222 100644
--- a/src/index.test.ts
+++ b/src/index.test.ts
@@ -5,3 +5,3 @@ describe("foo", () => {
-  it("works", () => expect(1).toBe(1));
+  it("works", () => expect("oops").toBe(1));
 });`;

describe("detectRegressions", () => {
  it("returns empty array when no regressions", () => {
    const baseline = [c("test", "baseline", 10, 0, 10)];
    const final    = [c("test", "final",    10, 0, 10)];
    expect(detectRegressions(baseline, final, "")).toEqual([]);
  });

  it("detects build break as critical severity", () => {
    const baseline = [c("test", "baseline", 10, 0, 10)];
    const final    = [c("test", "final",     0, 0,  0)];
    const result = detectRegressions(baseline, final, "");
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("critical");
    expect(result[0]!.description).toMatch(/build break/i);
  });

  it("attributes build break to a source file (not test file)", () => {
    const baseline = [c("test", "baseline", 10, 0, 10)];
    const final    = [c("test", "final",     0, 0,  0)];
    const result = detectRegressions(baseline, final, SAMPLE_PATCH);
    expect(result[0]!.file).toBe("src/index.ts");
  });

  it("detects test regression as high severity", () => {
    const baseline = [c("test", "baseline", 10, 0, 10)];
    const final    = [c("test", "final",     9, 1, 10)];
    const result = detectRegressions(baseline, final, "");
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("high");
    expect(result[0]!.description).toMatch(/1 test\(s\) regressed/);
  });

  it("attributes test regression to test file preferentially", () => {
    const baseline = [c("test", "baseline", 10, 0, 10)];
    const final    = [c("test", "final",     9, 1, 10)];
    const result = detectRegressions(baseline, final, SAMPLE_PATCH);
    expect(result[0]!.file).toBe("src/index.test.ts");
  });

  it("detects new test failures as high severity", () => {
    const baseline = [c("test", "baseline", 8, 0, 8)];
    const final    = [c("test", "final",    8, 2, 10)];
    const result = detectRegressions(baseline, final, "");
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("high");
    expect(result[0]!.description).toMatch(/2 new test failure/);
  });

  it("build break and individual test regressions are mutually exclusive", () => {
    const baseline = [c("test", "baseline", 10, 0, 10)];
    const final    = [c("test", "final",     0, 0,  0)];
    const result = detectRegressions(baseline, final, SAMPLE_PATCH);
    // Only the critical build break — no high severity test entries
    expect(result.filter((r) => r.severity === "critical")).toHaveLength(1);
    expect(result.filter((r) => r.severity === "high")).toHaveLength(0);
  });

  it("detects type error increase as medium severity", () => {
    const baseline = [c("type", "baseline", 0, 0, 0)];
    const final    = [c("type", "final",    0, 3, 3)];
    const result = detectRegressions(baseline, final, "");
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("medium");
    expect(result[0]!.description).toMatch(/3 type error/);
  });

  it("does not report type error improvement as regression", () => {
    const baseline = [c("type", "baseline", 0, 5, 5)];
    const final    = [c("type", "final",    0, 2, 2)];
    expect(detectRegressions(baseline, final, "")).toHaveLength(0);
  });

  it("detects lint error increase as low severity", () => {
    const baseline = [c("lint", "baseline", 0, 0, 0)];
    const final    = [c("lint", "final",    0, 2, 2)];
    const result = detectRegressions(baseline, final, "");
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("low");
    expect(result[0]!.description).toMatch(/2 lint error/);
  });

  it("type and lint increases together produce two entries", () => {
    const baseline = [
      c("type", "baseline", 0, 0, 0),
      c("lint", "baseline", 0, 0, 0),
    ];
    const final = [
      c("type", "final", 0, 2, 2),
      c("lint", "final", 0, 3, 3),
    ];
    const result = detectRegressions(baseline, final, "");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.severity).sort()).toEqual(["low", "medium"]);
  });

  it("test regression and type increase together produce two entries", () => {
    const baseline = [
      c("test", "baseline", 10, 0, 10),
      c("type", "baseline",  0, 0,  0),
    ];
    const final = [
      c("test", "final",  9, 1, 10),
      c("type", "final",  0, 1,  1),
    ];
    const result = detectRegressions(baseline, final, "");
    expect(result).toHaveLength(2);
    const severities = result.map((r) => r.severity);
    expect(severities).toContain("high");
    expect(severities).toContain("medium");
  });

  it("sets file and hunk to null when patch is empty", () => {
    const baseline = [c("type", "baseline", 0, 0, 0)];
    const final    = [c("type", "final",    0, 3, 3)];
    const result = detectRegressions(baseline, final, "");
    expect(result[0]!.file).toBeNull();
    expect(result[0]!.hunk).toBeNull();
  });

  it("extracts first hunk header from matched file", () => {
    const baseline = [c("test", "baseline", 10, 0, 10)];
    const final    = [c("test", "final",     9, 1, 10)];
    const result = detectRegressions(baseline, final, SAMPLE_PATCH);
    // Test file comes second in SAMPLE_PATCH; hunk should be from that section
    expect(result[0]!.hunk).toMatch(/^@@/);
  });

  it("never attributes a file outside the diff", () => {
    const baseline = [c("type", "baseline", 0, 0, 0)];
    const final    = [c("type", "final",    0, 5, 5)];
    const result = detectRegressions(baseline, final, "");
    expect(result[0]!.file).toBeNull();
  });

  it("sorts by severity then description (deterministic)", () => {
    const baseline = [
      c("test", "baseline", 10, 0, 10),
      c("type", "baseline",  0, 0,  0),
      c("lint", "baseline",  0, 0,  0),
    ];
    const final = [
      c("test", "final",  9, 1, 10), // high
      c("type", "final",  0, 2,  2), // medium
      c("lint", "final",  0, 3,  3), // low
    ];
    const result = detectRegressions(baseline, final, "");
    expect(result[0]!.severity).toBe("high");
    expect(result[1]!.severity).toBe("medium");
    expect(result[2]!.severity).toBe("low");
  });

  it("no baseline check means no regression", () => {
    const final = [c("test", "final", 0, 10, 10)];
    expect(detectRegressions([], final, SAMPLE_PATCH)).toHaveLength(0);
  });

  it("does not count regression when total shrinks (conservative)", () => {
    const baseline = [c("test", "baseline", 10, 0, 10)];
    const final    = [c("test", "final",     8, 0,  8)]; // 2 tests removed
    expect(detectRegressions(baseline, final, "")).toHaveLength(0);
  });

  it("parses renamed file using b/ path", () => {
    const patch = `diff --git a/old.ts b/new.ts
index abc..def 100644
--- a/old.ts
+++ b/new.ts
@@ -1,3 +1,3 @@
-const x = 1;
+const x = "bad";`;
    const baseline = [c("type", "baseline", 0, 0, 0)];
    const final    = [c("type", "final",    0, 1, 1)];
    const result = detectRegressions(baseline, final, patch);
    expect(result[0]!.file).toBe("new.ts");
  });
});
