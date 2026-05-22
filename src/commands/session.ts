import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { agentlensDir, isInitialized, openDatabase } from "../db/database";
import { computeDiff } from "../git/diff";
import { assertGitRepo, takeSnapshot } from "../git/snapshot";
import { insertDiff, insertSession, updateSession } from "../db/sessions";

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
  db.close();

  const payload: ActiveSession = { sessionId, s0Sha };
  fs.writeFileSync(active, JSON.stringify(payload, null, 2) + "\n");

  console.log(
    pc.green(pc.bold("✓")) +
      " Session " +
      pc.cyan("#" + shortId(sessionId)) +
      " started. Run your agent, then " +
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
}
