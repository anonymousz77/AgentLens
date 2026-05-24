import { describe, it, expect } from "vitest";
import { generateAdapterRecipe } from "../commands/adapter";

describe("generateAdapterRecipe", () => {
  it("aider recipe is non-empty and contains agentlens run", () => {
    const recipe = generateAdapterRecipe("aider");
    expect(recipe.length).toBeGreaterThan(0);
    expect(recipe).toContain("agentlens run");
  });

  it("aider recipe references the aider tool", () => {
    const recipe = generateAdapterRecipe("aider");
    expect(recipe).toContain("aider");
  });

  it("aider recipe includes a TEMPLATE notice", () => {
    const recipe = generateAdapterRecipe("aider");
    expect(recipe).toContain("TEMPLATE");
  });

  it("claude-code recipe is non-empty and contains agentlens run", () => {
    const recipe = generateAdapterRecipe("claude-code");
    expect(recipe.length).toBeGreaterThan(0);
    expect(recipe).toContain("agentlens run");
  });

  it("claude-code recipe includes a TEMPLATE notice", () => {
    const recipe = generateAdapterRecipe("claude-code");
    expect(recipe).toContain("TEMPLATE");
  });

  it("unknown tool returns a non-empty generic recipe", () => {
    const recipe = generateAdapterRecipe("some-unknown-tool");
    expect(recipe.length).toBeGreaterThan(0);
    expect(recipe).toContain("agentlens run");
    expect(recipe).toContain("some-unknown-tool");
  });

  it("two different tools return different recipes", () => {
    const aider = generateAdapterRecipe("aider");
    const claudeCode = generateAdapterRecipe("claude-code");
    expect(aider).not.toBe(claudeCode);
  });
});
