import { estimateCost } from "../cost/estimate";
import type { CostConfig } from "../types";

export interface CostOpts {
  tokensIn?: number;
  tokensOut?: number;
  linesAdded: number;
  linesRemoved: number;
}

export interface ResolvedCost {
  tokens: number;
  cost_usd: number;
  cost_estimated: 0 | 1;
}

/**
 * Resolves token count and cost from either real token counts or a diff-based estimate.
 * When both tokensIn and tokensOut are provided, uses real counts (cost_estimated=0).
 * Otherwise falls back to the diff-based estimate (cost_estimated=1).
 */
export function resolveCost(opts: CostOpts, config: CostConfig): ResolvedCost {
  if (opts.tokensIn !== undefined && opts.tokensOut !== undefined) {
    const tokens = opts.tokensIn + opts.tokensOut;
    const cost_usd = (tokens / 1_000_000) * config.usd_per_million_tokens;
    return { tokens, cost_usd, cost_estimated: 0 };
  }
  const { tokens, cost_usd } = estimateCost(
    { lines_added: opts.linesAdded, lines_removed: opts.linesRemoved },
    config
  );
  return { tokens, cost_usd, cost_estimated: 1 };
}
