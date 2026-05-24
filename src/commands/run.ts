import { spawn } from "node:child_process";
import pc from "picocolors";
import { isInitialized, openDatabase } from "../db/database";
import { assertGitRepo } from "../git/snapshot";
import { captureBaseline, finalizeSession } from "../pipeline";
import { printScoreReport } from "../scoring/format";

export interface RunOptions {
  agent: string;
  task?: string;
  tokensIn?: number;
  tokensOut?: number;
}

export function runAgentRun(cwd: string, command: string[], opts: RunOptions): void {
  if (command.length === 0) {
    console.error(pc.red("No command provided. Usage: agentlens run --agent <name> -- <command...>"));
    process.exit(1);
  }

  assertGitRepo(cwd);

  if (!isInitialized(cwd)) {
    console.error(pc.red("Not initialized. Run `agentlens init` first."));
    process.exit(1);
  }

  const db = openDatabase(cwd);

  console.log(pc.dim("  capturing baseline..."));
  const handle = captureBaseline(cwd, db, {
    agentName: opts.agent,
    task: opts.task ?? null,
    notes: null,
  });

  console.log(
    pc.dim(`  session #${handle.sessionId.slice(0, 8)} started — running: ${command.join(" ")}`)
  );

  const costOverride =
    opts.tokensIn !== undefined && opts.tokensOut !== undefined
      ? { tokensIn: opts.tokensIn, tokensOut: opts.tokensOut }
      : undefined;

  let finalized = false;
  function finalize(exitCode: number): void {
    if (finalized) return;
    finalized = true;

    console.log(pc.dim("\n  finalizing session..."));
    try {
      const result = finalizeSession(cwd, db, handle, costOverride);
      db.close();

      const sid = pc.cyan("#" + handle.sessionId.slice(0, 8));
      if (result.filesChanged === 0) {
        console.log(pc.yellow("⚠") + " Session " + sid + " ended with no changes.");
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

      printScoreReport(result.scoreResult, result.regressions);

      const costPrefix = result.cost_estimated ? "~$" : "$";
      console.log(
        pc.dim(
          `Cost: ${costPrefix}${result.cost_usd.toFixed(4)}` +
            (result.cost_estimated ? " est." : "") +
            ` (${result.tokens} tokens)`
        )
      );
    } catch (err) {
      console.error(pc.red("  finalization error: " + String(err)));
      try { db.close(); } catch { /* ignore */ }
    }

    process.exit(exitCode);
  }

  // shell:true is required on Windows so npm/npx/.cmd wrappers resolve correctly.
  const [cmd, ...args] = command;
  const child = spawn(cmd!, args, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  // Suppress the default SIGINT handler so we can finalize before exiting.
  // The child (in the same console session) will also receive Ctrl+C, exit,
  // and fire the 'close' event which triggers finalize.
  process.on("SIGINT", () => {});

  child.on("error", (err) => {
    console.error(pc.red(`\nFailed to spawn command: ${err.message}`));
    finalize(1);
  });

  child.on("close", (code) => {
    finalize(code ?? 1);
  });
}
