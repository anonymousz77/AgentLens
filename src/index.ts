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
import { runCI, runCIInit, parseCICommandOpts } from "./commands/ci";
import { runAgentRun } from "./commands/run";
import { runAdapter } from "./commands/adapter";
import { runBisect } from "./commands/bisect";
import { runCompare, type CompareOptions } from "./compare/run";
import type { CheckKind } from "./types";

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
  .option("--task <description>", "task description for this session")
  .option("--notes <text>", "free-form notes for this session")
  .action((opts: { agent?: string; task?: string; notes?: string }) => {
    runSessionStart(process.cwd(), opts);
  });

sessionCmd
  .command("end")
  .description("snapshot the repo, compute diff, and close the session")
  .option("--tokens-in <n>", "actual input token count — overrides diff-based cost estimate", parseInt)
  .option("--tokens-out <n>", "actual output token count — overrides diff-based cost estimate", parseInt)
  .action((opts: { tokensIn?: number; tokensOut?: number }) => {
    runSessionEnd(process.cwd(), opts);
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

const ciCmd = program
  .command("ci")
  .description("score the current PR/commit and gate the build (CI mode)")
  .option("--base <ref>", "base ref for delta mode (default: GITHUB_BASE_REF env var)")
  .option("--min-score <n>", "minimum passing score (default: 70)")
  .option("--comment", "post a sticky PR comment (requires GITHUB_TOKEN)", false)
  .option("--no-fail", "always exit 0 — report-only mode")
  .option("--json", "output machine-readable JSON", false)
  .action((opts: { base?: string; minScore?: string; comment?: boolean; fail?: boolean; json?: boolean }) => {
    runCI(process.cwd(), parseCICommandOpts(opts)).catch((err: unknown) => {
      console.error(pc.red("agentlens ci: " + String(err)));
      process.exit(1);
    });
  });

ciCmd
  .command("init")
  .description("write a starter .github/workflows/agentlens.yml")
  .option("-f, --force", "overwrite an existing workflow file", false)
  .action((opts: { force?: boolean }) => {
    runCIInit(process.cwd(), { force: opts.force });
  });

program
  .command("run")
  .description("wrap a CLI agent command and auto-record the session (baseline → run → finalize)")
  .requiredOption("--agent <name>", "agent name (e.g. aider, claude-code)")
  .option("--task <description>", "task description for this session")
  .option("--tokens-in <n>", "actual input token count — overrides diff-based cost estimate", parseInt)
  .option("--tokens-out <n>", "actual output token count — overrides diff-based cost estimate", parseInt)
  .argument("[args...]", "command to run (pass after --)")
  .action((args: string[], opts: { agent: string; task?: string; tokensIn?: number; tokensOut?: number }) => {
    runAgentRun(process.cwd(), args, opts);
  });

program
  .command("adapter <tool>")
  .description("print integration recipe for a supported agent tool (aider, claude-code)")
  .action((tool: string) => {
    runAdapter(process.cwd(), tool);
  });

program
  .command("bisect <session-id>")
  .description(
    "binary-search git history to find the first commit that introduced a check regression"
  )
  .option(
    "--check <name>",
    "check kind to bisect: test, type, or lint (default: auto-select by severity)"
  )
  .option(
    "--retries <n>",
    "retry count per commit to guard against flaky checks (default: 1)",
    "1"
  )
  .option("--json", "output machine-readable JSON", false)
  .action(
    (
      sessionId: string,
      opts: { check?: string; retries?: string; json?: boolean }
    ) => {
      runBisect(process.cwd(), sessionId, {
        checkFilter: opts.check as CheckKind | undefined,
        retries: opts.retries ? parseInt(opts.retries, 10) : 1,
        json: opts.json ?? false,
      }).catch((err: unknown) => {
        console.error(pc.red("agentlens bisect: " + String(err)));
        process.exit(1);
      });
    }
  );

program
  .command("compare")
  .description("compare agent quality statistics across recorded sessions")
  .option("--agent <name>", "first agent for pairwise comparison")
  .option("--vs <name>", "second agent for pairwise comparison")
  .option("--metric <m>", "score or cost (default: score)", "score")
  .option("--json", "output structured JSON")
  .action((opts: CompareOptions) => {
    runCompare(process.cwd(), opts);
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
