import { execFileSync } from "node:child_process";
import pc from "picocolors";
import { bisectFirstBad } from "./bisect";
import { createWorktree, removeWorktree } from "../ci/worktree";
import { runChecks } from "../pipeline";
import type { Check, CheckKind } from "../types";
import type { PreCheckResult } from "../pipeline";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CommitInfo {
  sha: string;
  subject: string;
  author: string;
  date: string;
  files: string[];
}

export interface BisectDeps {
  enumerateCommits: (baseSha: string, finalSha: string) => string[];
  runChecksAt: (sha: string) => PreCheckResult[];
  getCommitInfo: (sha: string) => CommitInfo;
}

export interface BisectOptions {
  checkFilter?: CheckKind;
  retries: number;
  json: boolean;
}

export interface BisectResult {
  target_check: CheckKind;
  culprit: CommitInfo | null;
  range: { after: string; at_or_before: string } | null;
  skipped: string[];
  commits_searched: number;
  checks_run: number;
  baseline_sha: string;
  final_sha: string;
}

// ── Target-check selection ────────────────────────────────────────────────────

export interface TargetCheck {
  kind: CheckKind;
  reason: string;
}

// Exported pure function for testability. No IO.
export function selectTargetCheck(
  baseline: Check[],
  final: Check[],
  filter?: CheckKind
): TargetCheck | null {
  const priority: CheckKind[] = ["test", "type", "lint"];
  const kinds = filter ? [filter] : priority;

  for (const kind of kinds) {
    const b = baseline.find((c) => c.kind === kind);
    const f = final.find((c) => c.kind === kind);

    if (!b && !f) continue;

    if (!b && f && f.failed > 0) {
      return {
        kind,
        reason: `${kind} check absent at baseline but has ${f.failed} failure(s) at final`,
      };
    }
    if (b && f && f.failed > b.failed) {
      return {
        kind,
        reason: `${kind} failures increased from ${b.failed} to ${f.failed}`,
      };
    }
    if (filter) return null; // explicit filter matched no regression
  }
  return null;
}

// ── Real dependency implementations ──────────────────────────────────────────

function realEnumerateCommits(
  baseSha: string,
  finalSha: string,
  repoRoot: string
): string[] {
  const out = execFileSync(
    "git",
    ["rev-list", "--reverse", `${baseSha}..${finalSha}`],
    { cwd: repoRoot, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  ).trim();
  return out ? out.split("\n").map((s) => s.trim()).filter(Boolean) : [];
}

function realRunChecksAt(sha: string, repoRoot: string): PreCheckResult[] {
  let wtPath: string | null = null;
  try {
    wtPath = createWorktree(repoRoot, sha);
    return runChecks(wtPath);
  } finally {
    if (wtPath) removeWorktree(repoRoot, wtPath);
  }
}

function realGetCommitInfo(sha: string, repoRoot: string): CommitInfo {
  const log = execFileSync(
    "git",
    ["log", "-1", "--format=%H%n%s%n%an <%ae>%n%ai", sha],
    { cwd: repoRoot, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  ).trim();
  const [fullSha = sha, subject = "", author = "", date = ""] = log.split("\n");

  const filesOut = execFileSync(
    "git",
    ["diff-tree", "--no-commit-id", "-r", "--name-only", sha],
    { cwd: repoRoot, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  ).trim();
  const files = filesOut ? filesOut.split("\n").filter(Boolean) : [];

  return { sha: fullSha, subject, author, date, files };
}

// ── Check classification ──────────────────────────────────────────────────────

function isResultBad(results: PreCheckResult[], kind: CheckKind): boolean {
  const r = results.find((x) => x.kind === kind);
  // If the relevant check kind wasn't produced, treat as bad (check didn't run).
  return !r || r.failed > 0;
}

// ── Core bisect search ────────────────────────────────────────────────────────

export interface BisectSearchResult {
  culpritIndex: number | null;
  skippedShas: string[];
  checksRun: number;
  candidates: string[];
}

export function runBisectSearch(
  baseSha: string,
  finalSha: string,
  targetKind: CheckKind,
  retries: number,
  deps: BisectDeps
): BisectSearchResult {
  const intermediateShas = deps.enumerateCommits(baseSha, finalSha);

  if (intermediateShas.length === 0) {
    return { culpritIndex: null, skippedShas: [], checksRun: 0, candidates: [baseSha] };
  }

  // candidates[0] = baseSha (known-good, never probed by bisectFirstBad).
  // candidates[n-1] = last of intermediateShas = finalSha (known-bad, never probed).
  const candidates = [baseSha, ...intermediateShas];
  const n = candidates.length;

  // Per-sha probe cache: avoids re-running checks on a sha already evaluated.
  const probeCache = new Map<string, boolean | null>(); // null = skipped
  const skippedShas: string[] = [];
  let checksRun = 0;

  // Probe a single sha. Returns true=bad, false=good, null=skip (unrunnable).
  //
  // Retry policy: run up to `retries` times. ANY pass ⇒ GOOD (avoids blaming
  // flaky failures on a commit). Only when ALL retries fail do we classify BAD.
  //
  // Skip policy: if runChecksAt throws (build broken, worktree failure, etc.),
  // classify as SKIP rather than BAD or GOOD. Treating as BAD would make the
  // search converge on the wrong culprit when a build break is unrelated to the
  // tracked regression. Treating as GOOD would silently discard real regressions.
  // SKIP mirrors `git bisect skip` — we defer to a neighbor instead.
  function probeSha(sha: string): boolean | null {
    if (probeCache.has(sha)) return probeCache.get(sha)!;

    const attempts = Math.max(1, retries);
    let anySucceeded = false;

    for (let attempt = 0; attempt < attempts; attempt++) {
      let results: PreCheckResult[];
      try {
        results = deps.runChecksAt(sha);
        checksRun++;
        anySucceeded = true;
      } catch {
        // Threw — almost certainly unrunnable. Do not retry after a throw.
        break;
      }

      if (!isResultBad(results, targetKind)) {
        // Any pass within retries ⇒ GOOD.
        probeCache.set(sha, false);
        return false;
      }
    }

    if (!anySucceeded) {
      // No successful run — SKIP.
      probeCache.set(sha, null);
      skippedShas.push(sha);
      return null;
    }

    // All retries ran and all failed → BAD.
    probeCache.set(sha, true);
    return true;
  }

  // Track which indices the skip-substitution has already resolved, to avoid
  // re-using the same substitute neighbor across multiple bisect steps.
  const resolvedIndices = new Set<number>();

  // isBad wrapper passed to bisectFirstBad. When a sha is unrunnable (SKIP),
  // substitute the nearest unresolved neighbor, preferring the higher index
  // (toward the "bad" side). This mirrors `git bisect skip`.
  function isBad(index: number): boolean {
    resolvedIndices.add(index);
    const sha = candidates[index]!;
    const result = probeSha(sha);

    if (result !== null) return result;

    // SHA is unrunnable — find nearest usable neighbor.
    for (let delta = 1; delta < n; delta++) {
      for (const neighbor of [index + delta, index - delta]) {
        // Never substitute the known endpoints (0 = known-good, n-1 = known-bad).
        if (neighbor <= 0 || neighbor >= n - 1) continue;
        if (resolvedIndices.has(neighbor)) continue;
        resolvedIndices.add(neighbor);
        const sha2 = candidates[neighbor]!;
        const result2 = probeSha(sha2);
        if (result2 !== null) return result2;
        // That neighbor was also skipped — keep searching.
      }
    }

    // No usable neighbor. Return false (treat as good for this step) so the
    // search continues; the result will be a range, not a unique culprit.
    return false;
  }

  const firstBadIndex = bisectFirstBad(n, isBad);

  return {
    culpritIndex: firstBadIndex > 0 ? firstBadIndex : null,
    skippedShas,
    checksRun,
    candidates,
  };
}

// ── Human-readable output ─────────────────────────────────────────────────────

function printBisectResult(result: BisectResult): void {
  if (result.culprit === null && result.range === null) {
    console.log(
      pc.yellow("agentlens bisect: no regression found in the bisected range.")
    );
    return;
  }

  if (result.culprit === null && result.range !== null) {
    console.log(
      pc.yellow(
        "agentlens bisect: culprit could not be uniquely identified — skipped commits straddle the transition."
      )
    );
    console.log(
      `  First bad commit is within: ${pc.dim(result.range.after.slice(0, 12))}..${pc.dim(result.range.at_or_before.slice(0, 12))}`
    );
    if (result.skipped.length > 0) {
      console.log(
        `  Skipped (unrunnable): ${result.skipped.map((s) => s.slice(0, 12)).join(", ")}`
      );
    }
    return;
  }

  const c = result.culprit!;
  const log2n = result.commits_searched > 1 ? Math.log2(result.commits_searched) : 0;

  console.log(`\n${pc.green("First bad commit")} (${pc.cyan(result.target_check)}):\n`);
  console.log(`  Commit:  ${pc.yellow(c.sha.slice(0, 16))}`);
  console.log(`  Subject: ${c.subject}`);
  console.log(`  Author:  ${c.author}`);
  console.log(`  Date:    ${c.date}`);
  if (c.files.length > 0) {
    console.log(`  Files:   ${c.files[0]}`);
    for (const f of c.files.slice(1)) {
      console.log(`           ${f}`);
    }
  }
  console.log(``);
  console.log(`  Target check:     ${result.target_check}`);
  console.log(`  Commits in range: ${result.commits_searched}`);
  console.log(
    `  Check-runs:       ${result.checks_run}  (log₂(${result.commits_searched}) ≈ ${log2n.toFixed(1)})`
  );
  if (result.skipped.length > 0) {
    console.log(
      `  Skipped:          ${result.skipped.map((s) => s.slice(0, 12)).join(", ")}`
    );
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function executeBisect(
  repoRoot: string,
  baseSha: string,
  finalSha: string,
  baseline: Check[],
  final: Check[],
  opts: BisectOptions,
  overrideDeps?: Partial<BisectDeps>
): Promise<BisectResult | null> {
  const realDeps: BisectDeps = {
    enumerateCommits: (b, f) => realEnumerateCommits(b, f, repoRoot),
    runChecksAt: (sha) => realRunChecksAt(sha, repoRoot),
    getCommitInfo: (sha) => realGetCommitInfo(sha, repoRoot),
  };
  const deps: BisectDeps = { ...realDeps, ...overrideDeps };

  const target = selectTargetCheck(baseline, final, opts.checkFilter);

  if (target === null) {
    const msg = opts.checkFilter
      ? `no regression detected for check '${opts.checkFilter}' in this session — nothing to bisect`
      : "no check regressions detected in this session — nothing to bisect";
    if (opts.json) {
      process.stdout.write(JSON.stringify({ error: msg }) + "\n");
    } else {
      console.log(pc.yellow(`agentlens bisect: ${msg}`));
    }
    return null;
  }

  if (!opts.json) {
    console.log(
      `agentlens bisect: target check: ${pc.cyan(target.kind)}  (${target.reason})`
    );
    console.log(
      `agentlens bisect: bisecting commits between ${pc.dim(baseSha.slice(0, 12))}..${pc.dim(finalSha.slice(0, 12))}`
    );
  }

  const { culpritIndex, skippedShas, checksRun, candidates } =
    runBisectSearch(baseSha, finalSha, target.kind, opts.retries, deps);

  const intermediateShas = candidates.slice(1); // strip base
  const commitsSearched = intermediateShas.length;

  if (commitsSearched === 0) {
    const msg =
      "no intermediate commits to bisect — base and final are adjacent or identical";
    if (opts.json) {
      process.stdout.write(
        JSON.stringify({
          target_check: target.kind,
          culprit: null,
          range: null,
          skipped: [],
          commits_searched: 0,
          checks_run: 0,
          baseline_sha: baseSha,
          final_sha: finalSha,
        }) + "\n"
      );
    } else {
      console.log(pc.yellow(`agentlens bisect: ${msg}`));
    }
    return null;
  }

  let culprit: CommitInfo | null = null;
  let range: { after: string; at_or_before: string } | null = null;

  if (culpritIndex !== null && culpritIndex < candidates.length) {
    const culpritSha = candidates[culpritIndex]!;
    if (skippedShas.includes(culpritSha)) {
      // The index returned by the search landed on a skipped sha (the skip
      // substitution ran out of neighbors and returned index n-1 indirectly).
      // Cannot uniquely determine — report the range around the skipped block.
      const goodSha = culpritIndex > 0 ? (candidates[culpritIndex - 1] ?? baseSha) : baseSha;
      range = { after: goodSha, at_or_before: culpritSha };
    } else {
      culprit = deps.getCommitInfo(culpritSha);
    }
  } else if (skippedShas.length > 0) {
    // Skips prevented a unique answer — report the narrowest provable bounds.
    const lastConfirmedGood = candidates
      .slice(0, culpritIndex ?? candidates.length)
      .reverse()
      .find((s) => !skippedShas.includes(s));
    const firstConfirmedBad = candidates
      .slice(1)
      .find((s) => !skippedShas.includes(s));
    range = {
      after: lastConfirmedGood ?? baseSha,
      at_or_before: firstConfirmedBad ?? finalSha,
    };
  }

  const bisectResult: BisectResult = {
    target_check: target.kind,
    culprit,
    range,
    skipped: skippedShas,
    commits_searched: commitsSearched,
    checks_run: checksRun,
    baseline_sha: baseSha,
    final_sha: finalSha,
  };

  if (opts.json) {
    process.stdout.write(JSON.stringify(bisectResult, null, 2) + "\n");
  } else {
    printBisectResult(bisectResult);
  }

  return bisectResult;
}
