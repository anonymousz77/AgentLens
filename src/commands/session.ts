import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { agentlensDir, isInitialized, openDatabase } from "../db/database";
import { computeDiff } from "../git/diff";
import { assertGitRepo, takeSnapshot } from "../git/snapshot";
import {
  insertDiff,
  insertSession,
  updateSession,
  insertCheck,
  getChecksByPhase,
} from "../db/sessions";
import { detectChecks } from "../checks/detect";
import { runCommand } from "../checks/run";
import { selectParsers } from "../checks/parsers/index";
import type { Check, CheckPhase } from "../types";
import type { ParseResult } from "../checks/parsers/types";
import Database from "better-sqlite3";

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

function currentHead(repoRoot: string): string {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
}

function runAndStoreChecks(
  db: Database.Database,
  sessionId: string,
  cwd: string,
  phase: CheckPhase
): string[] {
  const detected = detectChecks(cwd);
  const summaryLines: string[] = [];
  const parsers = selectParsers(detected.ecosystem);

  const tasks: Array<{
    kind: "test" | "type" | "lint";
    spec: NonNullable<ReturnType<typeof detectChecks>["test"]>;
    parse: (output: string, exitCode: number) => ParseResult;
  }> = [];

  if (detected.test) tasks.push({ kind: "test", spec: detected.test, parse: parsers.test });
  if (detected.type) tasks.push({ kind: "type", spec: detected.type, parse: parsers.type });
  if (detected.lint) tasks.push({ kind: "lint", spec: detected.lint, parse: parsers.lint });

  for (const task of tasks) {
    try {
      const res = runCommand(task.spec, cwd);
      const r = task.parse(res.output, res.exitCode);
      insertCheck(db, {
        session_id: sessionId,
        kind: task.kind,
        phase,
        passed: r.passed,
        failed: r.failed,
        total: r.total,
        coverage_pct: r.coverage_pct ?? null,
        runtime_ms: res.runtime_ms,
        raw_output: res.output,
      });

      if (task.kind === "test") {
        summaryLines.push(`tests: ${r.passed}/${r.total}`);
        if (r.coverage_pct !== null) {
          summaryLines.push(`coverage: ${r.coverage_pct.toFixed(1)}%`);
        }
      } else if (task.kind === "type") {
        summaryLines.push(`type errors: ${r.failed}`);
      } else {
        summaryLines.push(`lint errors: ${r.failed}`);
      }
    } catch (e) {
      console.warn(pc.yellow(`  ⚠ ${task.kind} check failed: ${String(e)}`));
    }
  }

  return summaryLines;
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

  const s0Sha = takeSnapshot(cwd);
  const headSha = currentHead(cwd);

  const db = openDatabase(cwd);
  const sessionId = insertSession(db, {
    repo_path: cwd,
    agent_name: opts.agent ?? null,
    git_base_sha: headSha,
    notes: opts.notes ?? null,
  });

  console.log(pc.dim("  running baseline checks..."));
  const summary = runAndStoreChecks(db, sessionId, cwd, "baseline");
  db.close();

  const payload: ActiveSession = { sessionId, s0Sha };
  fs.writeFileSync(active, JSON.stringify(payload, null, 2) + "\n");

  const sid = pc.cyan("#" + shortId(sessionId));
  const baselineSummary = summary.length > 0 ? " " + summary.join(", ") : "";
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

  const s1Sha = takeSnapshot(cwd);
  const { filesChanged, linesAdded, linesRemoved, patch } = computeDiff(
    cwd,
    s0Sha,
    s1Sha
  );
  const headSha = currentHead(cwd);
  const endedAt = new Date().toISOString();

  const db = openDatabase(cwd);

  console.log(pc.dim("  running final checks..."));
  runAndStoreChecks(db, sessionId, cwd, "final");

  db.transaction(() => {
    updateSession(db, { id: sessionId, ended_at: endedAt, git_head_sha: headSha });
    insertDiff(db, {
      session_id: sessionId,
      files_changed: filesChanged,
      lines_added: linesAdded,
      lines_removed: linesRemoved,
      patch,
    });
  })();

  const baseline = getChecksByPhase(db, sessionId, "baseline");
  const final = getChecksByPhase(db, sessionId, "final");
  db.close();

  fs.unlinkSync(active);

  const sid = pc.cyan("#" + shortId(sessionId));
  if (filesChanged === 0) {
    console.log(
      pc.yellow("⚠") + " Session " + sid + " ended with no changes."
    );
  } else {
    console.log(
      pc.green(pc.bold("✓")) +
        " Session " +
        sid +
        " ended. " +
        pc.bold(String(filesChanged)) +
        " file(s) changed, " +
        pc.green("+" + String(linesAdded)) +
        " / " +
        pc.red("-" + String(linesRemoved))
    );
  }

  printDeltas(baseline, final);
}
