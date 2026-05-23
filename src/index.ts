#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { runInit } from "./commands/init";
import { runSessionStart, runSessionEnd } from "./commands/session";
import { runSessions } from "./commands/sessions";
import { runCheck } from "./commands/check";
import { runScore } from "./commands/score";
import { runStats } from "./commands/stats";
import { runDashboard } from "./commands/dashboard";
import { runWatch } from "./commands/watch";
import { runJudge, runJudgeCalibrate } from "./commands/judge";

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

program
  .command("watch")
  .description("watch the repo and auto-record sessions when an agent works")
  .option("--agent <name>", "name of the agent (e.g. claude-code)")
  .option("--quiet <seconds>", "quiet period before session close (default: 45)", "45")
  .action((opts: { agent?: string; quiet?: string }) => {
    runWatch(process.cwd(), {
      agent: opts.agent,
      quiet: opts.quiet ? parseInt(opts.quiet, 10) : undefined,
    }).catch((err: unknown) => {
      console.error(pc.red("agentlens watch: " + String(err)));
      process.exit(1);
    });
  });

const judgeCmd = program
  .command("judge")
  .description(
    "run the LLM judge on a session diff (qualitative scores — separate from deterministic score)"
  )
  .argument("[session-id]", "session to judge (default: latest)")
  .option("--task <description>", "task description — activates task_match scoring dimension")
  .action((sessionId: string | undefined, opts: { task?: string }) => {
    runJudge(process.cwd(), sessionId, opts).catch((err: unknown) => {
      console.error(pc.red("agentlens judge: " + String(err)));
      process.exit(1);
    });
  });

judgeCmd
  .command("calibrate")
  .description(
    "measure judge reliability against hand-labeled fixtures (runs offline with MockProvider if no provider configured)"
  )
  .action(() => {
    runJudgeCalibrate(process.cwd()).catch((err: unknown) => {
      console.error(pc.red("agentlens judge calibrate: " + String(err)));
      process.exit(1);
    });
  });

program
  .command("dashboard")
  .description("launch the local web dashboard")
  .option("-p, --port <number>", "port to listen on", String(4319))
  .action((opts: { port?: string }) => {
    runDashboard(process.cwd(), { port: opts.port ? parseInt(opts.port, 10) : undefined });
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(pc.red("agentlens: unexpected error"));
  console.error(err);
  process.exit(1);
});
