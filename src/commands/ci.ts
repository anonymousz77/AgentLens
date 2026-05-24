import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { scorePR } from "../ci/scorePR";
import { shouldFail } from "../ci/gate";
import { appendJobSummary, formatMarkdownReport, parseGHContext, postStickyComment } from "../ci/github";
import { loadCiConfig } from "../config";
import { printScoreReport } from "../scoring/format";

export interface CIOptions {
  base?: string;
  minScore?: number;
  comment?: boolean;
  noFail?: boolean;
  json?: boolean;
}

// Raw opts shape exactly as Commander delivers them for the `ci` command
export interface RawCICommandOpts {
  base?: string;
  minScore?: string;  // Commander passes option values as strings
  comment?: boolean;
  fail?: boolean;     // Commander negation: true = absent, false = --no-fail passed
  json?: boolean;
}

export function parseCICommandOpts(raw: RawCICommandOpts): CIOptions {
  return {
    base: raw.base,
    minScore: raw.minScore !== undefined ? parseInt(raw.minScore, 10) : undefined,
    comment: raw.comment,
    noFail: raw.fail === false,
    json: raw.json,
  };
}

export async function runCI(cwd: string, opts: CIOptions): Promise<void> {
  const result = scorePR(cwd, { baseRef: opts.base });

  const ciConfig = loadCiConfig(cwd);
  const minScore = opts.minScore ?? ciConfig.min_score;
  const noFail = opts.noFail ?? false;

  const pass = !shouldFail(result.score, result.regressions, minScore, noFail);

  if (opts.json) {
    process.stdout.write(
      JSON.stringify(
        {
          score: result.score,
          breakdown: result.breakdown,
          regressions: result.regressions,
          pass,
          baselineMode: result.baselineMode,
          ...(result.baselineNote ? { baselineNote: result.baselineNote } : {}),
        },
        null,
        2
      ) + "\n"
    );
    process.exit(pass ? 0 : 1);
  }

  // Human-readable output
  const modeLabel =
    result.baselineMode === "delta"
      ? pc.cyan("delta mode")
      : pc.dim("clean baseline");

  console.log("");
  console.log(pc.bold("AgentLens CI") + "  " + modeLabel);
  if (result.baselineNote) {
    console.log(pc.yellow(`  note: ${result.baselineNote}`));
  }

  printScoreReport(
    { score: result.score, breakdown: result.breakdown },
    result.regressions
  );

  const gateLabel = pass
    ? pc.green("✓ PASS") + pc.dim(` (score ${result.score} ≥ min ${minScore})`)
    : pc.red("✗ FAIL") + pc.dim(` (score ${result.score} < min ${minScore})`);
  console.log("");
  console.log(pc.bold("Gate: ") + gateLabel);

  // GitHub Actions job summary
  appendJobSummary(formatMarkdownReport(result, pass));

  // Sticky PR comment
  if (opts.comment) {
    const token = process.env["GITHUB_TOKEN"];
    const ctx = parseGHContext();
    if (token && ctx) {
      await postStickyComment(
        ctx.prNumber,
        ctx.owner,
        ctx.repo,
        token,
        formatMarkdownReport(result, pass)
      );
    } else if (opts.comment) {
      console.warn(
        pc.dim("  (skipping PR comment — GITHUB_TOKEN or PR context not available)")
      );
    }
  }

  process.exit(pass ? 0 : 1);
}

const WORKFLOW_TEMPLATE = `name: AgentLens CI
on:
  pull_request:
    branches: [main, master]
jobs:
  agentlens:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npx agentlens ci --comment
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

export function runCIInit(cwd: string, opts: { force?: boolean } = {}): void {
  const workflowDir = path.join(cwd, ".github", "workflows");
  const workflowPath = path.join(workflowDir, "agentlens.yml");

  if (fs.existsSync(workflowPath) && !opts.force) {
    console.log(
      pc.yellow("  .github/workflows/agentlens.yml already exists.") +
        " Pass --force to overwrite."
    );
    return;
  }

  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(workflowPath, WORKFLOW_TEMPLATE, "utf8");
  console.log(pc.green("✓") + " wrote .github/workflows/agentlens.yml");
  console.log(pc.dim("  Commit it and open a PR to see AgentLens CI in action."));
}
