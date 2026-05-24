import { describe, it, expect } from "vitest";
import { resolveCost } from "./wiring";
import type { CostConfig } from "../types";

const config: CostConfig = {
  tokens_per_line: 8,
  base_overhead: 200,
  usd_per_million_tokens: 3,
};

describe("resolveCost", () => {
  it("uses real tokens when both tokensIn and tokensOut are provided", () => {
    const result = resolveCost(
      { tokensIn: 1000, tokensOut: 500, linesAdded: 100, linesRemoved: 50 },
      config
    );
    expect(result.tokens).toBe(1500);
    expect(result.cost_estimated).toBe(0);
    expect(result.cost_usd).toBeCloseTo((1500 / 1_000_000) * 3, 10);
  });

  it("marks cost as real (0) when real tokens are supplied", () => {
    const result = resolveCost(
      { tokensIn: 100, tokensOut: 100, linesAdded: 0, linesRemoved: 0 },
      config
    );
    expect(result.cost_estimated).toBe(0);
  });

  it("falls back to estimate when only tokensIn is provided (no tokensOut)", () => {
    const result = resolveCost(
      { tokensIn: 1000, linesAdded: 10, linesRemoved: 5 },
      config
    );
    expect(result.cost_estimated).toBe(1);
    // tokens = (10+5)*8 + 200 = 320
    expect(result.tokens).toBe(320);
  });

  it("falls back to estimate when only tokensOut is provided (no tokensIn)", () => {
    const result = resolveCost(
      { tokensOut: 500, linesAdded: 10, linesRemoved: 5 },
      config
    );
    expect(result.cost_estimated).toBe(1);
  });

  it("uses diff-based estimate when no token counts provided", () => {
    const result = resolveCost(
      { linesAdded: 50, linesRemoved: 20 },
      config
    );
    expect(result.cost_estimated).toBe(1);
    // tokens = (50+20)*8 + 200 = 760
    expect(result.tokens).toBe(760);
    expect(result.cost_usd).toBeCloseTo((760 / 1_000_000) * 3, 10);
  });

  it("applies the configured rate when computing real cost", () => {
    const customConfig: CostConfig = { ...config, usd_per_million_tokens: 15 };
    const result = resolveCost(
      { tokensIn: 500_000, tokensOut: 500_000, linesAdded: 0, linesRemoved: 0 },
      customConfig
    );
    expect(result.tokens).toBe(1_000_000);
    expect(result.cost_usd).toBeCloseTo(15, 6);
    expect(result.cost_estimated).toBe(0);
  });
});
