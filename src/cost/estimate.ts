import type { CostConfig } from "../types";

export interface DiffStats {
  lines_added: number;
  lines_removed: number;
}

export interface CostEstimate {
  tokens: number; // estimated token count (integer)
  cost_usd: number; // estimated cost in USD
}

// TRANSPARENT ESTIMATE — not actual per-agent token usage.
// Heuristic: tokens ≈ (lines_added + lines_removed) × tokens_per_line + base_overhead.
// base_overhead covers prompt/context tokens present in every session regardless of diff size.
// cost_usd = tokens / 1_000_000 × usd_per_million_tokens (blended input+output rate).
// Real per-agent usage parsing is a Phase 7 adapter concern.
export function estimateCost(stats: DiffStats, config: CostConfig): CostEstimate {
  const tokens = Math.round(
    (stats.lines_added + stats.lines_removed) * config.tokens_per_line +
      config.base_overhead
  );
  const cost_usd = (tokens / 1_000_000) * config.usd_per_million_tokens;
  return { tokens, cost_usd };
}
