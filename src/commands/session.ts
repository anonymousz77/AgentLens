import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { agentlensDir, isInitialized, openDatabase } from "../db/database";
import { assertGitRepo } from "../git/snapshot";
import { captureBaseline, finalizeSession } from "../pipeline";
import { getChecksByPhase } from "../db/sessions";
import { printScoreReport } from "../scoring/format";
import type { Check } from "../types";
import type { BaselineHandle } from "../pipeline";

export interface SessionStartOptions {
  agent?: string;
  notes?: string;
}

interface ActiveSession {
  sessionId: string;
  s0Sha: string;
}

function activePath(repoRoot: string): string {
  return path.join(agentlensDir(repoRoot), "active.json");
}

function shortId(id: string): string {
  return id.substring(0, 8);
}

function printDeltas(baseline: Check[], final: Check[]): void {
  const kinds: Array<"test" | "type" | "lint"> = ["test", "type", "lint"];
  const lines: string[] = [];

  for (const kind of kinds) {
    const b = baseline.find((c) => c.kind === kind);
    const f = final.find((c) => c.kind === kind);
    if (!b || !f) continue;

    if (kind === "test") {
      const change =
        f.passed === b.passed && f.total === b.total
          ? pc.dim("(no change)")
          : f.passed < b.passed
          ? pc.red("↓")
          : pc.green("↑");
      lines.push(
        `  tests:       ${b.passed}/${b.total} → ${f.passed}/${f.total} ${change}`
      );
      if (b.coverage_pct !== null || f.coverage_pct !== null) {
        const bCov = b.coverage_pct !== null ? b.coverage_pct.toFixed(1) + "%" : "n/a";
        const fCov = f.coverage_pct !== null ? f.coverage_pct.toFixed(1) + "%" : "n/a";
        lines.push(`  coverage:    ${bCov} → ${fCov}`);
      }
    } else if (kind === "type") {
      const change =
        f.failed === b.failed
          ? pc.dim("(no change)")
          : f.failed > b.failed
          ? pc.red("↑")
          : pc.green("↓");
      lines.push(`  type errors: ${b.failed} → ${f.failed} ${change}`);
    } else {
      const change =
        f.failed === b.failed
          ? pc.dim("(no change)")
          : f.failed > b.failed
          ? pc.red("↑")
          : pc.green("↓");
      lines.push(`  lint errors: ${b.failed} → ${f.failed} ${change}`);
    }
  }

  if (lines.length > 0) {
    console.log(pc.bold("Deltas:"));
    for (const line of lines) console.log(line);
  }
}

export function runSessionStart(
  cwd: string,
  opts: SessionStartOptions = {}
): void {
  assertGitRepo(cwd);

  if (!isInitialized(cwd)) {
    throw new Error(
      "AgentLens is not initialized here. Run `agentlens init` first."
    );
  }

  const active = activePath(cwd);
  if (fs.existsSync(active)) {
    throw new Error(
      "A session is already active. Run `agentlens session end` first."
    );
  }

  console.log(pc.dim("  running baseline checks..."));
  const db = openDatabase(cwd);
  const handle: BaselineHandle = captureBaseline(cwd, db, {
    agentName: opts.agent ?? null,
    notes: opts.notes ?? null,
  });

  const baselineChecks = getChecksByPhase(db, handle.sessionId, "baseline");
  db.close();

  const summaryLines: string[] = [];
  const bTest = baselineChecks.find((c) => c.kind === "test");
  const bType = baselineChecks.find((c) => c.kind === "type");
  const bLint = baselineChecks.find((c) => c.kind === "lint");
  if (bTest) {
    summaryLines.push(`tests: ${bTest.passed}/${bTest.total}`);
    if (bTest.coverage_pct !== null) summaryLines.push(`coverage: ${bTest.coverage_pct.toFixed(1)}%`);
  }
  if (bType) summaryLines.push(`type errors: ${bType.failed}`);
  if (bLint) summaryLines.push(`lint errors: ${bLint.failed}`);

  const payload: ActiveSession = { sessionId: handle.sessionId, s0Sha: handle.s0Sha };
  fs.writeFileSync(active, JSON.stringify(payload, null, 2) + "\n");

  const sid = pc.cyan("#" + shortId(handle.sessionId));
  const baselineSummary = summaryLines.length > 0 ? " " + summaryLines.join(", ") : "";
  console.log(
    pc.green(pc.bold("✓")) +
      " Session " +
      sid +
      " started." +
      (baselineSummary ? pc.dim(" Baseline:" + baselineSummary + ".") : "") +
      " Run your agent, then " +
      pc.bold("agentlens session end") +
      "."
  );
}

export function runSessionEnd(cwd: string): void {
  const active = activePath(cwd);

  if (!fs.existsSync(active)) {
    throw new Error(
      "No active session. Run `agentlens session start` first."
    );
  }

  assertGitRepo(cwd);

  const raw = fs.readFileSync(active, "utf8");
  const { sessionId, s0Sha } = JSON.parse(raw) as ActiveSession;

  console.log(pc.dim("  running final checks..."));
  const db = openDatabase(cwd);
  const result = finalizeSession(cwd, db, { sessionId, s0Sha });
  db.close();

  fs.unlinkSync(active);

  const sid = pc.cyan("#" + shortId(sessionId));
  if (result.filesChanged === 0) {
    console.log(
      pc.yellow("⚠") + " Session " + sid + " ended with no changes."
    );
  } else {
    console.log(
      pc.green(pc.bold("✓")) +
        " Session " +
        sid +
        " ended. " +
        pc.bold(String(result.filesChanged)) +
        " file(s) changed, " +
        pc.green("+" + String(result.linesAdded)) +
        " / " +
        pc.red("-" + String(result.linesRemoved))
    );
  }

  printDeltas(result.baseline, result.final);
  printScoreReport(result.scoreResult, result.regressions);
}
