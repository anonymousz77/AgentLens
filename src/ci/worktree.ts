import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function createWorktree(repoRoot: string, baseSha: string): string {
  const wtPath = path.join(
    os.tmpdir(),
    `agentlens-wt-${crypto.randomBytes(8).toString("hex")}`
  );

  execFileSync("git", ["worktree", "add", "--detach", wtPath, baseSha], {
    cwd: repoRoot,
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Symlink node_modules so check runners can execute without a fresh install.
  // Best-effort: if deps differ the checks will fail and scorePR degrades gracefully.
  const srcModules = path.join(repoRoot, "node_modules");
  const dstModules = path.join(wtPath, "node_modules");
  if (fs.existsSync(srcModules) && !fs.existsSync(dstModules)) {
    try {
      fs.symlinkSync(srcModules, dstModules, "junction");
    } catch {
      // symlink failure is non-fatal
    }
  }

  return wtPath;
}

export function removeWorktree(repoRoot: string, wtPath: string): void {
  try {
    execFileSync("git", ["worktree", "remove", wtPath, "--force"], {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    // fallback: manual removal
  }
  try {
    fs.rmSync(wtPath, { recursive: true, force: true });
  } catch {
    // cleanup failure is non-fatal
  }
}
