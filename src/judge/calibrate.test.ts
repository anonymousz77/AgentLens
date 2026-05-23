import { describe, it, expect } from "vitest";
import { calibrateWithFixtures } from "./calibrate";
import type { CalibrationFixture } from "./calibrate";
import type { JudgeProvider } from "./provider";
import { DEFAULT_CONFIG } from "../types";

const config = DEFAULT_CONFIG.judge;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Provider that always returns a fixed score for every dimension. */
class ConstantScoreProvider implements JudgeProvider {
  readonly modelId = "constant";
  constructor(private readonly score: number) {}
  async complete(prompt: string): Promise<string> {
    const dims: string[] = ["readability", "scope_discipline"];
    if (prompt.includes("task_match")) dims.push("task_match");
    return JSON.stringify(
      dims.map((d) => ({ dimension: d, score: this.score, confidence: 0.8, rationale: "fixed" }))
    );
  }
}

/** Provider that returns a scripted sequence of full JSON responses per call. */
class ScriptedProvider implements JudgeProvider {
  readonly modelId = "scripted";
  private idx = 0;
  constructor(private readonly responses: string[]) {}
  async complete(_prompt: string): Promise<string> {
    const r = this.responses[this.idx % this.responses.length] ?? "[]";
    this.idx++;
    return r;
  }
}

// ── MAE tests ─────────────────────────────────────────────────────────────────

describe("calibrateWithFixtures — MAE", () => {
  it("computes MAE correctly when judge always returns 50", async () => {
    // Human readability scores: 40, 60, 80
    // Judge always returns 50
    // MAE = mean(|40-50|, |60-50|, |80-50|) = mean(10, 10, 30) = 16.67
    const fixtures: CalibrationFixture[] = [
      { id: "a", diffPatch: "+a", task: null, humanScores: { readability: 40 }, notes: "" },
      { id: "b", diffPatch: "+b", task: null, humanScores: { readability: 60 }, notes: "" },
      { id: "c", diffPatch: "+c", task: null, humanScores: { readability: 80 }, notes: "" },
    ];

    const provider = new ConstantScoreProvider(50);
    const report = await calibrateWithFixtures(fixtures, provider, config);

    expect(report.sampleCount).toBe(3);
    const rd = report.perDimension.find((d) => d.dimension === "readability");
    expect(rd).toBeDefined();
    expect(rd!.n).toBe(3);
    expect(rd!.mae).toBeCloseTo(50 / 3, 1); // 16.67
  });

  it("MAE is 0 when judge matches human exactly", async () => {
    const fixtures: CalibrationFixture[] = [
      { id: "a", diffPatch: "+a", task: null, humanScores: { readability: 72, scope_discipline: 78 }, notes: "" },
    ];
    const provider = new ConstantScoreProvider(72);
    const report = await calibrateWithFixtures(fixtures, provider, config);
    // readability: human=72, judge=72 → MAE=0
    const rd = report.perDimension.find((d) => d.dimension === "readability");
    expect(rd!.mae).toBeCloseTo(0, 5);
  });

  it("counts samples per dimension correctly", async () => {
    // 2 fixtures with readability, 1 has task_match too
    const fixtures: CalibrationFixture[] = [
      { id: "a", diffPatch: "+a", task: null, humanScores: { readability: 50 }, notes: "" },
      { id: "b", diffPatch: "+b", task: "do X", humanScores: { readability: 70, task_match: 80 }, notes: "" },
    ];
    const provider = new ConstantScoreProvider(50);
    const report = await calibrateWithFixtures(fixtures, provider, config);

    const rd = report.perDimension.find((d) => d.dimension === "readability");
    const tm = report.perDimension.find((d) => d.dimension === "task_match");
    expect(rd!.n).toBe(2);
    expect(tm!.n).toBe(1);
  });
});

// ── Spearman tests ────────────────────────────────────────────────────────────

describe("calibrateWithFixtures — Spearman correlation", () => {
  it("returns correlation 1.0 for perfect rank agreement", async () => {
    // human=[10,20,30,40], judge=[10,20,30,40] → perfect rho=1
    const fixtures: CalibrationFixture[] = [10, 20, 30, 40].map((h, i) => ({
      id: String(i),
      diffPatch: `+patch${i}`,
      task: null,
      humanScores: { readability: h },
      notes: "",
    }));
    const responses = [10, 20, 30, 40].map((s) =>
      JSON.stringify([{ dimension: "readability", score: s, confidence: 0.8, rationale: "ok" }])
    );
    const provider = new ScriptedProvider(responses);
    const report = await calibrateWithFixtures(fixtures, provider, config);
    expect(report.overallCorrelation).toBeCloseTo(1.0, 5);
  });

  it("returns correlation -1.0 for perfectly inverse rank order", async () => {
    // human=[10,20,30,40], judge=[40,30,20,10] → rho=-1
    const humanScores = [10, 20, 30, 40];
    const judgeScores = [40, 30, 20, 10];
    const fixtures: CalibrationFixture[] = humanScores.map((h, i) => ({
      id: String(i),
      diffPatch: `+patch${i}`,
      task: null,
      humanScores: { readability: h },
      notes: "",
    }));
    const responses = judgeScores.map((s) =>
      JSON.stringify([{ dimension: "readability", score: s, confidence: 0.8, rationale: "ok" }])
    );
    const provider = new ScriptedProvider(responses);
    const report = await calibrateWithFixtures(fixtures, provider, config);
    expect(report.overallCorrelation).toBeCloseTo(-1.0, 5);
  });

  it("computes rho=0.8 for a hand-verified case", async () => {
    // human=[10,30,20,40], judge=[15,35,5,45]
    // rx: 10→1, 20→2 wait... 10(i=0)→rank1, 20(i=2)→rank2 wrong
    // Actually: sorted human = 10(i=0), 20(i=2), 30(i=1), 40(i=3)
    // rx[0]=1, rx[2]=2, rx[1]=3, rx[3]=4
    // sorted judge = 5(i=2), 15(i=0), 35(i=1), 45(i=3)
    // ry[2]=1, ry[0]=2, ry[1]=3, ry[3]=4
    // d = rx-ry = [1-2, 3-3, 2-1, 4-4] = [-1, 0, 1, 0]
    // sumD2 = 1+0+1+0 = 2
    // rho = 1 - 6*2/(4*15) = 1 - 12/60 = 0.8
    const humanScores = [10, 30, 20, 40];
    const judgeScores = [15, 35, 5, 45];
    const fixtures: CalibrationFixture[] = humanScores.map((h, i) => ({
      id: String(i),
      diffPatch: `+patch${i}`,
      task: null,
      humanScores: { readability: h },
      notes: "",
    }));
    const responses = judgeScores.map((s) =>
      JSON.stringify([{ dimension: "readability", score: s, confidence: 0.8, rationale: "ok" }])
    );
    const provider = new ScriptedProvider(responses);
    const report = await calibrateWithFixtures(fixtures, provider, config);
    expect(report.overallCorrelation).toBeCloseTo(0.8, 5);
  });

  it("returns 0 correlation with only 1 sample", async () => {
    const fixtures: CalibrationFixture[] = [
      { id: "a", diffPatch: "+a", task: null, humanScores: { readability: 70 }, notes: "" },
    ];
    const provider = new ConstantScoreProvider(70);
    const report = await calibrateWithFixtures(fixtures, provider, config);
    expect(report.overallCorrelation).toBe(0);
  });
});

// ── Structure tests ───────────────────────────────────────────────────────────

describe("calibrateWithFixtures — report structure", () => {
  it("reports correct sampleCount", async () => {
    const fixtures: CalibrationFixture[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      diffPatch: `+patch${i}`,
      task: null,
      humanScores: { readability: 50 + i * 5 },
      notes: "",
    }));
    const provider = new ConstantScoreProvider(50);
    const report = await calibrateWithFixtures(fixtures, provider, config);
    expect(report.sampleCount).toBe(5);
  });

  it("skips unparseable dimensions in metric computation", async () => {
    const fixtures: CalibrationFixture[] = [
      { id: "a", diffPatch: "+a", task: null, humanScores: { readability: 70 }, notes: "" },
    ];
    // Provider returns malformed JSON both times → unparseable dimension
    const provider: JudgeProvider = {
      modelId: "bad",
      complete: async () => "not json",
    };
    const report = await calibrateWithFixtures(fixtures, provider, config);
    // "unparseable" is not in humanScores, so perDimension should be empty
    const unparseable = report.perDimension.find((d) => d.dimension === "unparseable");
    expect(unparseable).toBeUndefined();
    expect(report.perDimension).toHaveLength(0);
  });
});
