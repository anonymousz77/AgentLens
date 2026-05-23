import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG } from "./types";
import type { CostConfig, ScoringConfig } from "./types";

export function loadScoringConfig(repoRoot: string): ScoringConfig {
  const configPath = path.join(repoRoot, ".agentlens", "config.json");

  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG.scoring };
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) {
      return { ...DEFAULT_CONFIG.scoring };
    }

    const asRecord = parsed as Record<string, unknown>;
    const scoringOverride = asRecord["scoring"];

    if (typeof scoringOverride !== "object" || scoringOverride === null) {
      return { ...DEFAULT_CONFIG.scoring };
    }

    const override = scoringOverride as Record<string, unknown>;
    const result: ScoringConfig = { ...DEFAULT_CONFIG.scoring };

    for (const key of Object.keys(DEFAULT_CONFIG.scoring) as Array<
      keyof ScoringConfig
    >) {
      const val = override[key];
      if (typeof val === "number" && isFinite(val)) {
        (result as unknown as Record<string, number>)[key] = val;
      }
    }

    return result;
  } catch {
    return { ...DEFAULT_CONFIG.scoring };
  }
}

export function loadCostConfig(repoRoot: string): CostConfig {
  const configPath = path.join(repoRoot, ".agentlens", "config.json");

  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG.cost };
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) {
      return { ...DEFAULT_CONFIG.cost };
    }

    const costOverride = (parsed as Record<string, unknown>)["cost"];

    if (typeof costOverride !== "object" || costOverride === null) {
      return { ...DEFAULT_CONFIG.cost };
    }

    const override = costOverride as Record<string, unknown>;
    const result: CostConfig = { ...DEFAULT_CONFIG.cost };

    for (const key of Object.keys(DEFAULT_CONFIG.cost) as Array<keyof CostConfig>) {
      const val = override[key];
      if (typeof val === "number" && isFinite(val)) {
        (result as unknown as Record<string, number>)[key] = val;
      }
    }

    return result;
  } catch {
    return { ...DEFAULT_CONFIG.cost };
  }
}
