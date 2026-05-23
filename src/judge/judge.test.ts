import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { judgeSession } from "./judge";
import type { JudgeProvider } from "./provider";
import { MockProvider } from "./provider";
import { DEFAULT_CONFIG } from "../types";

const config = DEFAULT_CONFIG.judge;

// ── Helpers ───────────────────────────────────────────────────────────────────

class FixedProvider implements JudgeProvider {
  readonly modelId = "fixed";
  constructor(private readonly response: string) {}
  async complete(_prompt: string): Promise<string> {
    return this.response;
  }
}

class SequenceProvider implements JudgeProvider {
  readonly modelId = "seq";
  private calls = 0;
  constructor(private readonly responses: string[]) {}
  async complete(_prompt: string): Promise<string> {
    const r = this.responses[this.calls % this.responses.length] ?? "[]";
    this.calls++;
    return r;
  }
}

const VALID_JSON = JSON.stringify([
  { dimension: "readability", score: 75, confidence: 0.8, rationale: "Clear names" },
  { dimension: "scope_discipline", score: 85, confidence: 0.9, rationale: "Focused change" },
]);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("judgeSession — parsing", () => {
  it("parses well-formed JSON from provider", async () => {
    const provider = new FixedProvider(VALID_JSON);
    const result = await judgeSession("+hello world", {}, provider, config);
    expect(result).toHaveLength(2);
    expect(result[0]?.dimension).toBe("readability");
    expect(result[0]?.score).toBe(75);
    expect(result[0]?.confidence).toBe(0.8);
  });

  it("strips markdown fences and parses", async () => {
    const fenced = "```json\n" + VALID_JSON + "\n```";
    const provider = new FixedProvider(fenced);
    const result = await judgeSession("+hello world", {}, provider, config);
    expect(result).toHaveLength(2);
    expect(result[0]?.dimension).toBe("readability");
  });

  it("strips bare code fences and parses", async () => {
    const fenced = "```\n" + VALID_JSON + "\n```";
    const provider = new FixedProvider(fenced);
    const result = await judgeSession("+a", {}, provider, config);
    expect(result[0]?.score).toBe(75);
  });

  it("clamps score above 100 to 100", async () => {
    const overMax = JSON.stringify([
      { dimension: "readability", score: 150, confidence: 0.9, rationale: "ok" },
    ]);
    const provider = new FixedProvider(overMax);
    const result = await judgeSession("+a", {}, provider, config);
    expect(result[0]?.score).toBe(100);
  });

  it("clamps score below 0 to 0", async () => {
    const belowMin = JSON.stringify([
      { dimension: "readability", score: -10, confidence: 0.5, rationale: "ok" },
    ]);
    const provider = new FixedProvider(belowMin);
    const result = await judgeSession("+a", {}, provider, config);
    expect(result[0]?.score).toBe(0);
  });

  it("clamps confidence above 1 to 1", async () => {
    const over = JSON.stringify([
      { dimension: "readability", score: 50, confidence: 2.5, rationale: "ok" },
    ]);
    const provider = new FixedProvider(over);
    const result = await judgeSession("+a", {}, provider, config);
    expect(result[0]?.confidence).toBe(1);
  });

  it("clamps confidence below 0 to 0", async () => {
    const under = JSON.stringify([
      { dimension: "readability", score: 50, confidence: -0.5, rationale: "ok" },
    ]);
    const provider = new FixedProvider(under);
    const result = await judgeSession("+a", {}, provider, config);
    expect(result[0]?.confidence).toBe(0);
  });
});

describe("judgeSession — retry and graceful degrade", () => {
  it("returns valid result when first response is bad but retry succeeds", async () => {
    const provider = new SequenceProvider(["not json {{{", VALID_JSON]);
    const result = await judgeSession("+a", {}, provider, config);
    expect(result).toHaveLength(2);
    expect(result[0]?.dimension).toBe("readability");
  });

  it("returns unparseable dimension when both attempts fail", async () => {
    const provider = new FixedProvider("definitely not json at all");
    const result = await judgeSession("+a", {}, provider, config);
    expect(result).toHaveLength(1);
    expect(result[0]?.dimension).toBe("unparseable");
    expect(result[0]?.score).toBe(0);
    expect(result[0]?.confidence).toBe(0);
  });

  it("does not throw when both attempts fail", async () => {
    const provider = new FixedProvider("{{broken}}");
    await expect(judgeSession("+a", {}, provider, config)).resolves.toBeDefined();
  });
});

describe("judgeSession — task_match dimension", () => {
  it("does NOT include task_match when no task is given", async () => {
    const provider = new MockProvider();
    const result = await judgeSession("+a", {}, provider, config);
    const hasTM = result.some((r) => r.dimension === "task_match");
    expect(hasTM).toBe(false);
  });

  it("includes task_match when task is given", async () => {
    const provider = new MockProvider();
    const result = await judgeSession("+a", { task: "Add email validation" }, provider, config);
    const hasTM = result.some((r) => r.dimension === "task_match");
    expect(hasTM).toBe(true);
  });
});

describe("judgeSession — caching", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "judge-cache-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("does not call provider a second time on cache hit", async () => {
    const provider = new MockProvider();

    await judgeSession("+same diff", { cacheDir: tmpDir }, provider, config);
    expect(provider.callCount).toBe(1);

    await judgeSession("+same diff", { cacheDir: tmpDir }, provider, config);
    expect(provider.callCount).toBe(1); // cache hit — provider not called again
  });

  it("calls provider again for a different diff", async () => {
    const provider = new MockProvider();

    await judgeSession("+diff A", { cacheDir: tmpDir }, provider, config);
    await judgeSession("+diff B", { cacheDir: tmpDir }, provider, config);
    expect(provider.callCount).toBe(2);
  });
});
