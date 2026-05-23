import pc from "picocolors";
import { isInitialized } from "../db/database";
import { getStats } from "../api/read";

function fmt(label: string, value: string): string {
  return pc.bold(label.padEnd(20)) + value;
}

export function runStats(cwd: string, opts: { json?: boolean } = {}): void {
  if (!isInitialized(cwd)) {
    throw new Error(
      "AgentLens is not initialized here. Run `agentlens init` first."
    );
  }

  const stats = getStats(cwd);

  if (opts.json) {
    process.stdout.write(JSON.stringify(stats, null, 2) + "\n");
    return;
  }

  console.log(fmt("Sessions", String(stats.sessions_count)));

  if (stats.avg_score !== null) {
    const s = Math.round(stats.avg_score);
    const colored =
      s >= 80 ? pc.green(String(s)) : s >= 60 ? pc.yellow(String(s)) : pc.red(String(s));
    console.log(fmt("Avg score", colored));
  } else {
    console.log(fmt("Avg score", pc.dim("—")));
  }

  console.log(fmt("Regressions", stats.total_regressions_caught + " caught"));

  if (stats.avg_cost_usd !== null) {
    console.log(fmt("Avg cost", "$" + stats.avg_cost_usd.toFixed(4)));
  } else {
    console.log(fmt("Avg cost", pc.dim("—")));
  }

  if (stats.avg_tokens !== null) {
    console.log(fmt("Avg tokens", Math.round(stats.avg_tokens).toLocaleString()));
  } else {
    console.log(fmt("Avg tokens", pc.dim("—")));
  }

  const recentScores = stats.score_over_time
    .slice(-10)
    .map((p) => (p.score !== null ? String(Math.round(p.score)) : pc.dim("—")))
    .join("  ");

  if (recentScores.length > 0) {
    console.log("");
    console.log(pc.dim("Recent scores (oldest → newest):"));
    console.log(recentScores);
  }
}
