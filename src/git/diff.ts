import { execFileSync } from "node:child_process";

export interface DiffResult {
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  patch: string;
}

export function computeDiff(
  repoRoot: string,
  s0Sha: string,
  s1Sha: string
): DiffResult {
  const git = (args: string[]): string =>
    execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

  const numstatRaw = git(["diff", "--numstat", s0Sha, s1Sha]);

  let filesChanged = 0;
  let linesAdded = 0;
  let linesRemoved = 0;

  if (numstatRaw.length > 0) {
    const lines = numstatRaw.split("\n").filter((l) => l.length > 0);
    for (const line of lines) {
      const tab1 = line.indexOf("\t");
      if (tab1 === -1) continue;
      const tab2 = line.indexOf("\t", tab1 + 1);
      if (tab2 === -1) continue;

      const addedStr = line.substring(0, tab1);
      const removedStr = line.substring(tab1 + 1, tab2);

      filesChanged++;

      if (addedStr !== "-") {
        const n = parseInt(addedStr, 10);
        if (!isNaN(n)) linesAdded += n;
      }
      if (removedStr !== "-") {
        const n = parseInt(removedStr, 10);
        if (!isNaN(n)) linesRemoved += n;
      }
    }
  }

  const patch = git(["diff", s0Sha, s1Sha]);

  return { filesChanged, linesAdded, linesRemoved, patch };
}
