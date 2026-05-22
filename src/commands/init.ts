import path from "node:path";
import fs from "node:fs";
import pc from "picocolors";
import { openDatabase, agentlensDir, isInitialized } from "../db/database";
import { DEFAULT_CONFIG } from "../types";

const CONFIG_FILENAME = "config.json";

export interface InitOptions {
  force?: boolean;
}

/**
 * `agentlens init` — prepare the current repo for tracking.
 *
 * Creates .agentlens/ with a SQLite database and a default config.json.
 * Idempotent unless --force is passed (which only rewrites config, never
 * touches existing session data).
 */
export function runInit(cwd: string, opts: InitOptions = {}): void {
  const repoRoot = cwd;
  const dir = agentlensDir(repoRoot);
  const configPath = path.join(dir, CONFIG_FILENAME);

  const alreadyInitialized = isInitialized(repoRoot);

  if (alreadyInitialized && !opts.force) {
    console.log(
      pc.yellow("AgentLens is already initialized here.") +
        `\n  ${pc.dim("db:")}     ${pc.cyan(path.join(dir, "agentlens.db"))}` +
        `\n  ${pc.dim("config:")} ${pc.cyan(configPath)}` +
        `\n\nRun ${pc.bold("agentlens init --force")} to reset the config (session data is preserved).`
    );
    return;
  }

  // Open (creates dir + db + schema).
  const db = openDatabase(repoRoot);
  db.close();

  // Exclude .agentlens/ from git so DB writes don't pollute session diffs.
  const gitignorePath = path.join(dir, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, "*\n");
  }

  // Write default config if missing or forced.
  if (!fs.existsSync(configPath) || opts.force) {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
  }

  console.log(
    pc.green(pc.bold("✓ AgentLens initialized")) +
      `\n  ${pc.dim("repo:")}   ${pc.cyan(repoRoot)}` +
      `\n  ${pc.dim("db:")}     ${pc.cyan(path.join(dir, "agentlens.db"))}` +
      `\n  ${pc.dim("config:")} ${pc.cyan(configPath)}` +
      `\n\nNext: run your coding agent, then ${pc.bold("agentlens watch")} (coming soon).`
  );
}
