#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { runInit } from "./commands/init";
import { runSessionStart, runSessionEnd } from "./commands/session";
import { runSessions } from "./commands/sessions";
import { runCheck } from "./commands/check";
import { runScore } from "./commands/score";
import { runStats } from "./commands/stats";

const program = new Command();

program
  .name("agentlens")
  .description(
    "Observability & evaluation for AI coding agents — measure whether an agent session improved or quietly degraded your codebase."
  )
  .version("0.0.1", "-v, --version", "print version");

program
  .command("init")
  .description("initialize AgentLens in the current repository")
  .option("-f, --force", "reset config (session data is preserved)", false)
  .action((opts: { force?: boolean }) => {
    runInit(process.cwd(), { force: opts.force });
  });

const sessionCmd = program
  .command("session")
  .description("start or end a tracked agent session");

sessionCmd
  .command("start")
  .description("snapshot the repo and begin a session")
  .option("--agent <name>", "name of the agent (e.g. claude-code)")
  .option("--notes <text>", "free-form notes for this session")
  .action((opts: { agent?: string; notes?: string }) => {
    runSessionStart(process.cwd(), opts);
  });

sessionCmd
  .command("end")
  .description("snapshot the repo, compute diff, and close the session")
  .action(() => {
    runSessionEnd(process.cwd());
  });

program
  .command("sessions")
  .description("list all recorded sessions")
  .option("--json", "output machine-readable JSON", false)
  .action((opts: { json?: boolean }) => {
    runSessions(process.cwd(), opts);
  });

program
  .command("check")
  .description("detect and run checks once (no session) — for debugging detection")
  .action(() => {
    runCheck(process.cwd());
  });

program
  .command("score [session-id]")
  .description("recompute and display score for a session (default: latest)")
  .option("--json", "output machine-readable JSON", false)
  .action((sessionId: string | undefined, opts: { json?: boolean }) => {
    runScore(process.cwd(), sessionId, opts);
  });

program
  .command("stats")
  .description("aggregate stats across all recorded sessions")
  .option("--json", "output machine-readable JSON", false)
  .action((opts: { json?: boolean }) => {
    runStats(process.cwd(), opts);
  });

// Placeholder commands wired in later phases. Declared now so `--help` shows
// the roadmap and so the surface area is stable.
program
  .command("watch")
  .description("[coming soon] monitor an agent session and score it")
  .action(() => {
    console.log(pc.dim("`agentlens watch` lands in Phase 5. Not implemented yet."));
  });

program
  .command("dashboard")
  .description("[coming soon] launch the local web dashboard")
  .action(() => {
    console.log(pc.dim("`agentlens dashboard` lands in Phase 4. Not implemented yet."));
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(pc.red("agentlens: unexpected error"));
  console.error(err);
  process.exit(1);
});
