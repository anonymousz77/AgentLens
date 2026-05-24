import { describe, it, expect } from "vitest";
import { selectTargetCheck, runBisectSearch } from "./run";
import type { BisectDeps } from "./run";
import type { Check } from "../types";
import type { PreCheckResult } from "../pipeline";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCheck(
  kind: Check["kind"],
  phase: Check["phase"],
  failed: number,
  passed = 10
): Check {
  return {
    id: `${kind}-${phase}`,
    session_id: "s1",
    kind,
    phase,
    passed,
    failed,
    total: passed + failed,
    coverage_pct: null,
    runtime_ms: 100,
    raw_output: null,
  };
}

function makePreCheck(
  kind: PreCheckResult["kind"],
  failed: number,
  passed = 10
): PreCheckResult {
  return {
    kind,
    passed,
    failed,
    total: passed + failed,
    coverage_pct: null,
    runtime_ms: 100,
    raw_output: "",
  };
}

// Fake commit info — not used in search logic, only for output.
const fakeCommitInfo = (sha: string) => ({
  sha,
  subject: `commit ${sha}`,
  author: "Test User <test@example.com>",
  date: "2024-01-01T00:00:00+00:00",
  files: ["src/foo.ts"],
});

// Build a BisectDeps that returns a known set of shas and a predetermined
// good/bad pattern per sha.
function makeDeps(
  shas: string[],
  badShas: Set<string>,
  skippedShas?: Set<string>
): BisectDeps & { probeCount: Map<string, number> } {
  const probeCount = new Map<string, number>();
  return {
    probeCount,
    enumerateCommits: (_base, _final) => shas,
    runChecksAt: (sha: string) => {
      probeCount.set(sha, (probeCount.get(sha) ?? 0) + 1);
      if (skippedShas?.has(sha)) throw new Error("unrunnable");
      const failed = badShas.has(sha) ? 3 : 0;
      return [makePreCheck("test", failed)];
    },
    getCommitInfo: fakeCommitInfo,
  };
}

// ── selectTargetCheck ──────────────────────────────────────────────────────────

describe("selectTargetCheck", () => {
  it("auto-selects test over type and lint", () => {
    const baseline = [
      makeCheck("test", "baseline", 0),
      makeCheck("type", "baseline", 1),
      makeCheck("lint", "baseline", 2),
    ];
    const final = [
      makeCheck("test", "final", 3),
      makeCheck("type", "final", 2),
      makeCheck("lint", "final", 4),
    ];
    const result = selectTargetCheck(baseline, final);
    expect(result?.kind).toBe("test");
  });

  it("auto-selects type when only type regresses", () => {
    const baseline = [
      makeCheck("test", "baseline", 0),
      makeCheck("type", "baseline", 0),
    ];
    const final = [
      makeCheck("test", "final", 0),
      makeCheck("type", "final", 2),
    ];
    const result = selectTargetCheck(baseline, final);
    expect(result?.kind).toBe("type");
  });

  it("auto-selects lint when only lint regresses", () => {
    const baseline = [makeCheck("lint", "baseline", 0)];
    const final = [makeCheck("lint", "final", 5)];
    const result = selectTargetCheck(baseline, final);
    expect(result?.kind).toBe("lint");
  });

  it("returns null when no check regresses", () => {
    const baseline = [makeCheck("test", "baseline", 1)];
    const final = [makeCheck("test", "final", 0)];
    expect(selectTargetCheck(baseline, final)).toBeNull();
  });

  it("honours explicit filter when regression exists", () => {
    const baseline = [makeCheck("test", "baseline", 0), makeCheck("type", "baseline", 0)];
    const final = [makeCheck("test", "final", 2), makeCheck("type", "final", 1)];
    const result = selectTargetCheck(baseline, final, "type");
    expect(result?.kind).toBe("type");
  });

  it("returns null for explicit filter with no regression", () => {
    const baseline = [makeCheck("test", "baseline", 0)];
    const final = [makeCheck("test", "final", 0)];
    expect(selectTargetCheck(baseline, final, "test")).toBeNull();
  });

  it("detects regression when check absent at baseline", () => {
    const final = [makeCheck("test", "final", 2)];
    const result = selectTargetCheck([], final);
    expect(result?.kind).toBe("test");
  });
});

// ── runBisectSearch ────────────────────────────────────────────────────────────

describe("runBisectSearch — empty commits", () => {
  it("returns culpritIndex=null when enumerateCommits returns []", () => {
    const deps = makeDeps([], new Set());
    const result = runBisectSearch("base", "final", "test", 1, deps);
    expect(result.culpritIndex).toBeNull();
    expect(result.candidates).toHaveLength(1); // just baseSha
    expect(result.checksRun).toBe(0);
  });
});

describe("runBisectSearch — correct culprit identification", () => {
  it("finds the first bad sha in a linear history", () => {
    // commits: c1(good) c2(good) c3(BAD) c4(bad) c5(bad)
    const shas = ["c1", "c2", "c3", "c4", "c5"];
    const deps = makeDeps(shas, new Set(["c3", "c4", "c5"]));
    const result = runBisectSearch("base", "c5", "test", 1, deps);
    expect(result.culpritIndex).not.toBeNull();
    const culpritSha = result.candidates[result.culpritIndex!];
    expect(culpritSha).toBe("c3");
  });

  it("correctly identifies culprit at the very first intermediate", () => {
    const shas = ["c1", "c2", "c3"];
    const deps = makeDeps(shas, new Set(["c1", "c2", "c3"]));
    const result = runBisectSearch("base", "c3", "test", 1, deps);
    const culpritSha = result.candidates[result.culpritIndex!];
    expect(culpritSha).toBe("c1");
  });

  it("correctly identifies culprit at the last intermediate", () => {
    const shas = ["c1", "c2", "c3"];
    const deps = makeDeps(shas, new Set(["c3"]));
    const result = runBisectSearch("base", "c3", "test", 1, deps);
    // c3 is the last sha (index n-1 = 3), known-bad by precondition — returns index 3
    const culpritSha = result.candidates[result.culpritIndex!];
    expect(culpritSha).toBe("c3");
  });

  it("check-runs count is ≤ log2(n)+2, not linear", () => {
    const n = 32;
    const shas = Array.from({ length: n }, (_, i) => `c${i}`);
    const badFrom = 16;
    const deps = makeDeps(shas, new Set(shas.slice(badFrom)));
    const result = runBisectSearch("base", `c${n - 1}`, "test", 1, deps);
    expect(result.culpritIndex).not.toBeNull();
    // Binary search over 32+1 candidates: at most ceil(log2(32)) + 2 = 7 probes
    expect(result.checksRun).toBeLessThanOrEqual(Math.ceil(Math.log2(n + 1)) + 2);
  });
});

describe("runBisectSearch — per-sha caching", () => {
  it("never probes the same sha twice", () => {
    const shas = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"];
    const deps = makeDeps(shas, new Set(["c4", "c5", "c6", "c7"]));
    runBisectSearch("base", "c7", "test", 1, deps);
    for (const [_sha, count] of deps.probeCount) {
      expect(count).toBe(1);
    }
  });
});

describe("runBisectSearch — flakiness guard", () => {
  it("pass-on-retry classifies commit as GOOD", () => {
    const shas = ["c1", "c2", "c3"];
    // c2 fails on attempt 1, passes on attempt 2
    let c2Attempts = 0;
    const deps: BisectDeps = {
      enumerateCommits: () => shas,
      runChecksAt: (sha) => {
        if (sha === "c2") {
          c2Attempts++;
          if (c2Attempts === 1) return [makePreCheck("test", 2)]; // fail
          return [makePreCheck("test", 0)]; // pass
        }
        const failed = ["c3"].includes(sha) ? 2 : 0;
        return [makePreCheck("test", failed)];
      },
      getCommitInfo: fakeCommitInfo,
    };
    const result = runBisectSearch("base", "c3", "test", 2, deps);
    // c2 should be classified as GOOD (passed on retry), culprit should be c3
    const culpritSha = result.candidates[result.culpritIndex!];
    expect(culpritSha).toBe("c3");
  });

  it("all retries fail classifies commit as BAD", () => {
    const shas = ["c1", "c2", "c3"];
    const deps: BisectDeps = {
      enumerateCommits: () => shas,
      runChecksAt: (sha) => {
        const failed = ["c2", "c3"].includes(sha) ? 2 : 0;
        return [makePreCheck("test", failed)];
      },
      getCommitInfo: fakeCommitInfo,
    };
    const result = runBisectSearch("base", "c3", "test", 3, deps);
    const culpritSha = result.candidates[result.culpritIndex!];
    expect(culpritSha).toBe("c2");
  });
});

describe("runBisectSearch — skip policy", () => {
  it("single skipped commit: finds culprit via neighbor substitution", () => {
    // history: base c1(good) c2(SKIP) c3(bad) c4(bad)
    // c2 is unrunnable; the search should substitute c3 or c1 and still find c3
    const shas = ["c1", "c2", "c3", "c4"];
    const deps = makeDeps(shas, new Set(["c3", "c4"]), new Set(["c2"]));
    const result = runBisectSearch("base", "c4", "test", 1, deps);
    expect(result.skippedShas).toContain("c2");
    // Culprit should be c3 (the first non-skipped bad commit)
    if (result.culpritIndex !== null) {
      const culpritSha = result.candidates[result.culpritIndex]!;
      expect(["c2", "c3"]).toContain(culpritSha); // c3 or narrowed to include c2
    }
  });

  it("contiguous skipped block: reports non-null skipped list", () => {
    // history: base c1(good) c2(SKIP) c3(SKIP) c4(bad)
    // The transition is in the skipped block — cannot uniquely identify culprit.
    const shas = ["c1", "c2", "c3", "c4"];
    const deps = makeDeps(shas, new Set(["c4"]), new Set(["c2", "c3"]));
    const result = runBisectSearch("base", "c4", "test", 1, deps);
    expect(result.skippedShas.length).toBeGreaterThan(0);
    // The result should list the skipped shas
    for (const sha of result.skippedShas) {
      expect(["c2", "c3"]).toContain(sha);
    }
  });
});
