import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function assertGitRepo(repoRoot: string): void {
  try {
    execFileSync("git", ["rev-parse", "--git-dir"], {
      cwd: repoRoot,
      stdio: "ignore",
    });
  } catch {
    throw new Error("Not a git repository. Run git init first.");
  }
}

export function takeSnapshot(repoRoot: string): string {
  const tmpIdx = path.join(
    os.tmpdir(),
    `agentlens-idx-${crypto.randomBytes(8).toString("hex")}`
  );

  const git = (args: string[], extraEnv?: NodeJS.ProcessEnv): string =>
    execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...extraEnv },
    }).trim();

  const gitEnv: NodeJS.ProcessEnv = { GIT_INDEX_FILE: tmpIdx };

  try {
    git(["add", "-A"], gitEnv);
    const treeSha = git(["write-tree"], gitEnv);
    const headSha = git(["rev-parse", "HEAD"]);
    const commitSha = git([
      "commit-tree",
      treeSha,
      "-p",
      headSha,
      "-m",
      "agentlens snapshot",
    ]);
    return commitSha;
  } finally {
    try {
      fs.rmSync(tmpIdx, { force: true });
    } catch {
      // cleanup failure is non-fatal
    }
  }
}
