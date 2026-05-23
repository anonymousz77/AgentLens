import pc from "picocolors";
import type { ScoreResult } from "./score";
import type { DetectedRegression } from "./regressions";

function scoreColor(score: number): string {
  if (score >= 80) return pc.green(String(score));
  if (score >= 60) return pc.yellow(String(score));
  return pc.red(String(score));
}

function deltaColor(delta: number): string {
  const formatted =
    delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2);
  return delta >= 0 ? pc.green(formatted) : pc.red(formatted);
}

function severityLabel(s: DetectedRegression["severity"]): string {
  switch (s) {
    case "critical": return pc.red("[critical]");
    case "high":     return pc.red("[high]    ");
    case "medium":   return pc.yellow("[medium]  ");
    case "low":      return pc.dim("[low]     ");
  }
}

export function printScoreReport(
  result: ScoreResult,
  regressions: DetectedRegression[]
): void {
  const sep = pc.dim("─".repeat(48));

  console.log("");
  console.log(
    pc.bold("Score: ") + scoreColor(result.score) + pc.dim(" / 100")
  );
  console.log(sep);

  if (result.breakdown.length === 0) {
    console.log(pc.dim("  (no adjustments — baseline unchanged)"));
  } else {
    for (const item of result.breakdown) {
      const reason = item.reason.padEnd(36);
      console.log(`  ${reason} ${deltaColor(item.delta)}`);
    }
  }

  console.log(sep);

  if (regressions.length === 0) {
    console.log(pc.dim("  No regressions detected."));
  } else {
    console.log(
      pc.bold(`Regressions (${regressions.length}):`)
    );
    for (const reg of regressions) {
      console.log(`  ${severityLabel(reg.severity)} ${reg.description}`);
      if (reg.file !== null) {
        const hunkPart = reg.hunk !== null ? `  ${pc.dim(reg.hunk)}` : "";
        console.log(`             ${pc.cyan(reg.file)}${hunkPart}`);
      }
    }
  }
}
