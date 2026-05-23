import chokidar from "chokidar";
import pc from "picocolors";
import { isInitialized, openDatabase } from "../db/database";
import { assertGitRepo } from "../git/snapshot";
import {
  captureWatchPreBaseline,
  openSessionFromPreBaseline,
  finalizeSession,
} from "../pipeline";
import { SessionWatcher, realTimer } from "../watch/watcher";
import type { WatchPreBaseline, BaselineHandle } from "../pipeline";

export interface WatchOptions {
  agent?: string;
  quiet?: number; // seconds, default 45
}

export function runWatch(cwd: string, opts: WatchOptions = {}): Promise<void> {
  if (!isInitialized(cwd)) {
    throw new Error(
      "AgentLens is not initialized here. Run `agentlens init` first."
    );
  }
  assertGitRepo(cwd);

  const quietMs = (opts.quiet ?? 45) * 1000;
  const agentName = opts.agent ?? "watch";

  console.log(pc.dim("agentlens watch: capturing baseline..."));
  let preBaseline: WatchPreBaseline = captureWatchPreBaseline(cwd);
  let currentHandle: BaselineHandle | null = null;

  console.log(
    pc.dim(`watching ${cwd}`) +
      pc.dim(` (quiet: ${opts.quiet ?? 45}s) — `) +
      pc.dim("Ctrl+C to stop")
  );

  const machine = new SessionWatcher(
    quietMs,
    {
      onSessionStart: () => {
        const db = openDatabase(cwd);
        try {
          currentHandle = openSessionFromPreBaseline(db, cwd, preBaseline, agentName);
        } finally {
          db.close();
        }
        console.log(pc.green("▶") + " session started");
      },
      onSessionEnd: () => {
        if (!currentHandle) return;
        const handle = currentHandle;
        currentHandle = null;

        const db = openDatabase(cwd);
        try {
          const result = finalizeSession(cwd, db, handle);
          const costStr = `est. $${result.cost_usd.toFixed(4)}`;
          const diffStr = `${result.filesChanged} file(s) changed`;
          console.log(
            pc.green("◼") +
              ` scored ${pc.bold(String(result.score))}/100` +
              pc.dim(` · ${diffStr} · ${costStr}`)
          );
        } catch (e) {
          console.error(pc.red("⚠ session finalization failed:"), String(e));
        } finally {
          db.close();
        }

        // Re-arm baseline for the next session while the event loop is blocked
        // by spawnSync inside captureWatchPreBaseline — chokidar events queue
        // and fire only after preBaseline is updated, preventing stale baselines.
        console.log(pc.dim("watching..."));
        preBaseline = captureWatchPreBaseline(cwd);
      },
    },
    realTimer
  );

  const fsWatcher = chokidar.watch(cwd, {
    ignored: [
      "**/.git/**",
      "**/.agentlens/**",
      "**/node_modules/**",
      "**/dist/**",
    ],
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  fsWatcher.on("all", (_event, _filePath) => {
    machine.fileChanged();
  });

  process.on("SIGINT", () => {
    console.log(pc.dim("\nshutting down..."));
    machine.stop();
    fsWatcher
      .close()
      .then(() => {
        console.log(pc.dim("agentlens watch stopped."));
        process.exit(0);
      })
      .catch(() => {
        process.exit(0);
      });
  });

  // Return a promise that never resolves — watch runs until SIGINT
  return new Promise(() => {});
}
