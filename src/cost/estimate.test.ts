import { describe, it, expect } from "vitest";
import { estimateCost } from "./estimate";
import type { CostConfig } from "../types";

const defaultConfig: CostConfig = {
  tokens_per_line: 8,
  base_overhead: 200,
  usd_per_million_tokens: 3,
};

describe("estimateCost", () => {
  it("produces deterministic output for known diff stats", () => {
    const result = estimateCost({ lines_added: 50, lines_removed: 20 }, defaultConfig);
    // tokens = (50 + 20) * 8 + 200 = 560 + 200 = 760
    expect(result.tokens).toBe(760);
    // cost_usd = 760 / 1_000_000 * 3 = 0.00228
    expect(result.cost_usd).toBeCloseTo(0.00228, 8);
  });

  it("config override changes result proportionally", () => {
    const doubledConfig: CostConfig = { ...defaultConfig, tokens_per_line: 16 };
    const base = estimateCost({ lines_added: 10, lines_removed: 10 }, defaultConfig);
    const doubled = estimateCost({ lines_added: 10, lines_removed: 10 }, doubledConfig);
    // doubled tokens_per_line should yield more tokens (diff portion doubles)
    expect(doubled.tokens).toBeGreaterThan(base.tokens);
    expect(doubled.cost_usd).toBeGreaterThan(base.cost_usd);
    // base: (20 * 8 + 200) = 360; doubled: (20 * 16 + 200) = 520
    expect(base.tokens).toBe(360);
    expect(doubled.tokens).toBe(520);
  });

  it("zero-diff returns base_overhead tokens only", () => {
    const result = estimateCost({ lines_added: 0, lines_removed: 0 }, defaultConfig);
    expect(result.tokens).toBe(200);
    expect(result.cost_usd).toBeGreaterThan(0);
    // cost_usd = 200 / 1_000_000 * 3 = 0.0006
    expect(result.cost_usd).toBeCloseTo(0.0006, 8);
  });
});
