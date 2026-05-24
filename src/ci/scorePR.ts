import { execFileSync } from "node:child_process";
import pc from "picocolors";
import { runChecks } from "../pipeline";
import { computeScore } from "../scoring/score";
import { detectRegressions } from "../scoring/regressions";
import { loadScoringConfig } from "../config";
import { createWorktree, removeWorktree } from "./worktree";
import type { Check, CheckPhase } from "../types";
import type { PreCheckResult } from "../pipeline";
import type { BreakdownItem } from "../scoring/score";
import type { DetectedRegression } from "../scoring/regressions";

export type BaselineMode = "clean" | "delta";

export interface CIPRResult {
  score: number;
  breakdown: BreakdownItem[];
  regressions: DetectedRegression[];
  finalChecks: PreCheckResult[];
  baselineMode: BaselineMode;
  baselineNote?: string;
}

// Converts PreCheckResult[] to Check[] with synthetic ids for use with the scoring engine.
export function toChecks(results: PreCheckResult[], phase: CheckPhase): Check[] {
  return results.map((r, i) => ({
    id: `ci-${phase}-${i}`,
    session_id: "ci",
    kind: r.kind,
    phase,
    passed: r.passed,
    failed: r.failed,
    total: r.total,
    coverage_pct: r.coverage_pct,
    runtime_ms: r.runtime_ms,
    raw_output: r.raw_output,
  }));
}

// Synthesizes a "clean" baseline from final checks: all tests passing, zero type/lint errors.
function synthesizeBaseline(finalChecks: PreCheckResult[]): Check[] {
  return finalChecks.map((r, i) => {
    if (r.kind === "test") {
      return {
        id: `ci-baseline-synth-${i}`,
        session_id: "ci",
        kind: r.kind,
        phase: "baseline" as const,
        passed: r.total,
        failed: 0,
        total: r.total,
        coverage_pct: null,
        runtime_ms: null,
        raw_output: null,
      };
    }
    // type / lint: clean state has zero errors
    return {
      id: `ci-baseline-synth-${i}`,
      session_id: "ci",
      kind: r.kind,
      phase: "baseline" as const,
      passed: 0,
      failed: 0,
      total: 0,
      coverage_pct: null,
      runtime_ms: null,
      raw_output: null,
    };
  });
}

function getRefDiff(repoRoot: string, baseRef: string): string {
  try {
    return execFileSync("git", ["diff", `${baseRef}...HEAD`], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

function getLastCommitDiff(repoRoot: string): string {
  try {
    // Check if HEAD has a parent
    execFileSync("git", ["rev-parse", "HEAD~1"], {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return execFileSync("git", ["diff", "HEAD~1", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

export interface ScorePROptions {
  baseRef?: string;
  // Injectable for testing: replaces the real runChecks call
  runChecksOverride?: (repoRoot: string) => PreCheckResult[];
}

export function scorePR(repoRoot: string, opts: ScorePROptions = {}): CIPRResult {
  const runner = opts.runChecksOverride ?? runChecks;
  const effectiveBase =
    opts.baseRef ?? process.env["GITHUB_BASE_REF"] ?? undefined;

  let baselineChecks: Check[];
  let finalChecks: PreCheckResult[];
  let patch: string;
  let baselineMode: BaselineMode;
  let baselineNote: string | undefined;

  if (effectiveBase) {
    // ── DELTA MODE ─────────────────────────────────────────────────────────
    let baseSha: string;
    try {
      baseSha = execFileSync("git", ["rev-parse", effectiveBase], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch {
      console.warn(
        pc.yellow(
          `agentlens ci: cannot resolve base ref "${effectiveBase}", falling back to clean baseline`
        )
      );
      baseSha = "";
    }

    if (baseSha) {
      let wtPath: string | null = null;
      let baselinePreChecks: PreCheckResult[] = [];
      try {
        wtPath = createWorktree(repoRoot, baseSha);
        baselinePreChecks = runner(wtPath);
      } catch (e) {
        console.warn(
          pc.yellow(`agentlens ci: worktree checks failed (${String(e)}), falling back to clean baseline`)
        );
      } finally {
        if (wtPath) {
          try {
            removeWorktree(repoRoot, wtPath);
          } catch {
            // non-fatal
          }
        }
      }

      if (baselinePreChecks.length > 0) {
        baselineChecks = toChecks(baselinePreChecks, "baseline");
        finalChecks = runner(repoRoot);
        patch = getRefDiff(repoRoot, baseSha);
        baselineMode = "delta";
      } else {
        // Degrade to clean mode
        finalChecks = runner(repoRoot);
        baselineChecks = synthesizeBaseline(finalChecks);
        patch = getLastCommitDiff(repoRoot);
        baselineMode = "clean";
        baselineNote = `delta mode degraded — base checks produced no results for ${effectiveBase}`;
      }
    } else {
      // baseSha resolution failed
      finalChecks = runner(repoRoot);
      baselineChecks = synthesizeBaseline(finalChecks);
      patch = getLastCommitDiff(repoRoot);
      baselineMode = "clean";
      baselineNote = `delta mode degraded — could not resolve ${effectiveBase}`;
    }
  } else {
    // ── CLEAN MODE ─────────────────────────────────────────────────────────
    finalChecks = runner(repoRoot);
    baselineChecks = synthesizeBaseline(finalChecks);
    patch = getLastCommitDiff(repoRoot);
    baselineMode = "clean";
  }

  const finalCheckObjs = toChecks(finalChecks, "final");
  const scoringConfig = loadScoringConfig(repoRoot);
  const scoreResult = computeScore({ baseline: baselineChecks, final: finalCheckObjs }, scoringConfig);
  const regressions = detectRegressions(baselineChecks, finalCheckObjs, patch);

  return {
    score: scoreResult.score,
    breakdown: scoreResult.breakdown,
    regressions,
    finalChecks,
    baselineMode,
    ...(baselineNote !== undefined ? { baselineNote } : {}),
  };
}
