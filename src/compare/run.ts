import Database from "better-sqlite3";
import pc from "picocolors";
import { isInitialized, dbPath } from "../db/database";
import { getAgentSessions } from "../db/sessions";
import {
  descriptiveStats,
  welchTTest,
  effectSizeLabel,
  MIN_N_FOR_SIGNIFICANCE,
  type DescriptiveStats,
  type PairwiseResult,
} from "./stats";

export interface CompareOptions {
  agent?: string;
  vs?: string;
  metric?: "score" | "cost";
  json?: boolean;
}

interface AgentGroup {
  agentName: string;
  stats: DescriptiveStats;
  insufficientData: boolean;
}

interface AnnotatedPairwise extends PairwiseResult {
  agentA: string;
  agentB: string;
}

interface CompareOutput {
  metric: "score" | "cost";
  higherIsBetter: boolean;
  agents: AgentGroup[];
  pairwise: AnnotatedPairwise[];
}

function openReadonly(repoRoot: string): Database.Database {
  return new Database(dbPath(repoRoot), { readonly: true });
}

function groupByAgent(
  sessions: ReturnType<typeof getAgentSessions>,
  metric: "score" | "cost"
): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const row of sessions) {
    const value = metric === "score" ? row.score : row.cost_usd;
    if (value === null) continue;
    const arr = groups.get(row.agent_name) ?? [];
    arr.push(value);
    groups.set(row.agent_name, arr);
  }
  return groups;
}

function fmt(n: number, decimals = 1): string {
  return isNaN(n) ? "—" : n.toFixed(decimals);
}

function fmtCI(ci: readonly [number, number]): string {
  if (isNaN(ci[0]) || isNaN(ci[1])) return "         —";
  return `[${fmt(ci[0])}, ${fmt(ci[1])}]`;
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("\x00");
}

function buildCompareOutput(
  groups: Map<string, number[]>,
  metric: "score" | "cost",
  filterA?: string,
  filterB?: string
): CompareOutput {
  const higherIsBetter = metric === "score";

  let entries = [...groups.entries()];
  if (filterA !== undefined && filterB !== undefined) {
    const keep = new Set([filterA, filterB]);
    entries = entries.filter(([name]) => keep.has(name));
  }

  const agents: AgentGroup[] = entries.map(([agentName, values]) => ({
    agentName,
    stats: descriptiveStats(values),
    insufficientData: values.length < MIN_N_FOR_SIGNIFICANCE,
  }));

  // Rank: higher mean first for score, lower mean first for cost
  agents.sort((a, b) =>
    higherIsBetter ? b.stats.mean - a.stats.mean : a.stats.mean - b.stats.mean
  );

  // Compute pairwise comparisons
  const seen = new Set<string>();
  const pairwise: AnnotatedPairwise[] = [];
  const agentList = filterA && filterB ? [filterA, filterB] : agents.map((a) => a.agentName);

  for (let i = 0; i < agentList.length; i++) {
    for (let j = i + 1; j < agentList.length; j++) {
      const nameA = agentList[i]!;
      const nameB = agentList[j]!;
      const key = pairKey(nameA, nameB);
      if (seen.has(key)) continue;
      seen.add(key);

      const valA = groups.get(nameA);
      const valB = groups.get(nameB);
      if (!valA || !valB) continue;

      const result = welchTTest(valA, valB);
      pairwise.push({ ...result, agentA: nameA, agentB: nameB });
    }
  }

  return { metric, higherIsBetter, agents, pairwise };
}

function printTable(output: CompareOutput, pairwiseMode: boolean): void {
  const { metric, higherIsBetter, agents, pairwise } = output;
  const metricLabel = metric === "score" ? "score (0–100, higher is better)" : "cost in USD (lower is better)";

  if (pairwiseMode && agents.length === 2) {
    // Detailed pairwise view
    const [a, b] = agents as [AgentGroup, AgentGroup];
    const pw = pairwise[0];

    console.log();
    console.log(pc.bold(`AgentLens — pairwise comparison  (metric: ${metricLabel})`));
    console.log();

    for (const agent of [a, b]) {
      const flag = agent.insufficientData ? pc.yellow(" †") : "  ";
      const ciStr = fmtCI(agent.stats.ci95);
      console.log(
        `  ${pc.cyan(agent.agentName.padEnd(20))}${flag}  n=${agent.stats.n}   mean=${fmt(agent.stats.mean)}   95% CI ${ciStr}`
      );
    }
    if (a.insufficientData || b.insufficientData) {
      console.log();
      console.log(pc.yellow("  † n < " + MIN_N_FOR_SIGNIFICANCE + ": insufficient data — directional only."));
    }

    if (!pw) {
      console.log();
      console.log(pc.dim("  (no pairwise result — one or both agents have no data)"));
      return;
    }

    const sign = pw.delta >= 0 ? "+" : "";
    const dirLabel = higherIsBetter
      ? pw.delta >= 0 ? pc.cyan(a.agentName) + " scores higher than " + pc.cyan(b.agentName)
                      : pc.cyan(b.agentName) + " scores higher than " + pc.cyan(a.agentName)
      : pw.delta <= 0 ? pc.cyan(a.agentName) + " costs less than " + pc.cyan(b.agentName)
                      : pc.cyan(b.agentName) + " costs less than " + pc.cyan(a.agentName);

    const diffLabel = metric === "score" ? "points" : "USD";

    console.log();
    console.log(`  Difference (${a.agentName} − ${b.agentName}): ${sign}${fmt(pw.delta)} ${diffLabel}`);
    console.log(
      `  Welch's t = ${fmt(pw.t, 3)}    df = ${fmt(pw.df, 1)}    p = ${fmt(pw.p, 4)}`
    );
    console.log(
      `  Cohen's d = ${fmt(pw.cohensD, 2)} (${effectSizeLabel(pw.cohensD)}, pooled-SD; interpret cautiously if group variances differ markedly)`
    );
    console.log();

    // Plain-English verdict
    const absDiff = Math.abs(pw.delta);
    const diffStr = `${fmt(absDiff)} ${diffLabel}`;
    if (!pw.sufficientData) {
      console.log(
        `  ${pc.bold("Conclusion:")} ${dirLabel} by ${diffStr}, but the difference is`
      );
      console.log(
        `  ${pc.yellow("NOT statistically significant")} — insufficient data (${pw.insufficientReason ?? "n too small"}).`
      );
    } else if (pw.p < 0.05) {
      console.log(
        `  ${pc.bold("Conclusion:")} ${dirLabel} by ${diffStr}.`
      );
      console.log(
        `  This difference ${pc.green("IS statistically significant")} (p=${fmt(pw.p, 4)}, ${effectSizeLabel(pw.cohensD)} effect).`
      );
    } else {
      console.log(
        `  ${pc.bold("Conclusion:")} ${dirLabel} by ${diffStr}, but the difference is`
      );
      console.log(
        `  ${pc.yellow("NOT statistically significant")} given the sample sizes (p=${fmt(pw.p, 4)}).`
      );
    }
    console.log();
    return;
  }

  // Summary table
  console.log();
  console.log(pc.bold(`AgentLens — agent comparison  (metric: ${metricLabel})`));
  console.log();

  const col = {
    agent: 20,
    n: 5,
    mean: 8,
    median: 8,
    sd: 9,
    ci: 18,
  };

  const header =
    "  " +
    "Agent".padEnd(col.agent) +
    "  " +
    "n".padStart(col.n) +
    "   " +
    "Mean".padStart(col.mean) +
    "   " +
    "Median".padStart(col.median) +
    "   " +
    "Std Dev".padStart(col.sd) +
    "   " +
    "95% CI";
  console.log(pc.dim(header));
  console.log(pc.dim("  " + "─".repeat(header.length - 2)));

  let hasInsufficient = false;
  for (const agent of agents) {
    const flag = agent.insufficientData ? pc.yellow("†") : " ";
    const name = pc.cyan(agent.agentName.slice(0, col.agent).padEnd(col.agent));
    const n = String(agent.stats.n).padStart(col.n);
    const mean = fmt(agent.stats.mean).padStart(col.mean);
    const median = fmt(agent.stats.median).padStart(col.median);
    const sd = fmt(agent.stats.sd).padStart(col.sd);
    const ci = fmtCI(agent.stats.ci95);
    console.log(`  ${name} ${flag} ${n}   ${mean}   ${median}   ${sd}   ${ci}`);
    if (agent.insufficientData) hasInsufficient = true;
  }

  if (hasInsufficient) {
    console.log();
    console.log(
      pc.yellow(`  † n < ${MIN_N_FOR_SIGNIFICANCE}: insufficient data — directional only, do not infer significance.`)
    );
  }

  // Significant pairwise differences
  const significant = pairwise.filter((pw) => pw.sufficientData && pw.p < 0.05);
  if (significant.length > 0) {
    console.log();
    console.log(pc.bold("  Statistically significant differences (p < 0.05):"));
    for (const pw of significant) {
      const sign = pw.delta >= 0 ? "+" : "";
      const diffLabel = metric === "score" ? "pts" : "USD";
      console.log(
        `    ${pc.cyan(pw.agentA)} vs ${pc.cyan(pw.agentB)}: diff=${sign}${fmt(pw.delta)}, p=${fmt(pw.p, 4)}, Cohen's d=${fmt(pw.cohensD, 2)} (${effectSizeLabel(pw.cohensD)})`
      );
    }
  } else if (pairwise.length > 0) {
    console.log();
    const allInsufficient = pairwise.every((pw) => !pw.sufficientData);
    if (allInsufficient) {
      console.log(pc.dim("  No statistically significant pairwise differences reported (all comparisons have insufficient data)."));
    } else {
      console.log(pc.dim("  No statistically significant pairwise differences found (p ≥ 0.05 for all pairs with sufficient data)."));
    }
  }

  console.log();
}

export function runCompare(cwd: string, opts: CompareOptions): void {
  // Self-comparison guard — checked before DB access so it fires regardless of init state.
  if (opts.agent && opts.vs && opts.agent === opts.vs) {
    throw new Error(`cannot compare an agent to itself: '${opts.agent}'`);
  }

  if (!isInitialized(cwd)) {
    throw new Error("AgentLens is not initialized here. Run `agentlens init` first.");
  }

  const metric = opts.metric === "cost" ? "cost" : "score";
  const pairwiseMode = opts.agent !== undefined && opts.vs !== undefined;

  const db = openReadonly(cwd);
  let sessions: ReturnType<typeof getAgentSessions>;
  try {
    sessions = getAgentSessions(db);
  } finally {
    db.close();
  }

  const groups = groupByAgent(sessions, metric);

  if (groups.size === 0) {
    console.log(pc.dim("No sessions with agent_name recorded yet."));
    console.log(pc.dim("Start a session with `agentlens session start --agent <name>` or use `agentlens run`."));
    return;
  }

  // Validate named agents exist when doing pairwise
  if (pairwiseMode) {
    const missing = [opts.agent!, opts.vs!].filter((n) => !groups.has(n));
    if (missing.length > 0) {
      throw new Error(
        `Agent(s) not found in recorded sessions (metric=${metric}): ${missing.map((n) => `'${n}'`).join(", ")}`
      );
    }
  }

  const output = buildCompareOutput(groups, metric, opts.agent, opts.vs);

  if (opts.json) {
    process.stdout.write(
      JSON.stringify(
        {
          ...output,
          pairwise: output.pairwise.map((pw) => ({
            ...pw,
            cohensD_note:
              "pooled-SD form; interpret cautiously if group variances differ markedly",
          })),
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  printTable(output, pairwiseMode);
}
