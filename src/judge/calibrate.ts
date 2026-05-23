import fs from "node:fs";
import path from "node:path";
import type { JudgeConfig } from "../types";
import type { JudgeProvider } from "./provider";
import { judgeSession } from "./judge";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalibrationFixture {
  id: string;
  diffPatch: string;
  task: string | null;
  humanScores: Record<string, number>;
  notes: string;
}

export interface CalibrationReport {
  sampleCount: number;
  perDimension: Array<{ dimension: string; mae: number; n: number }>;
  overallCorrelation: number; // Spearman rho across all (human, judge) pairs
}

// ─── Statistics ───────────────────────────────────────────────────────────────

function rankArray(arr: number[]): number[] {
  const n = arr.length;
  const indexed = arr.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);

  const ranks = new Array<number>(n);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    const baseVal = indexed[i]!.v;
    while (j < indexed.length && indexed[j]!.v === baseVal) j++;
    // Ties receive the average of their 1-indexed positions.
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[indexed[k]!.i] = avgRank;
    }
    i = j;
  }
  return ranks;
}

function spearmanCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 2) return 0;
  const rx = rankArray(x);
  const ry = rankArray(y);
  let sumD2 = 0;
  for (let i = 0; i < n; i++) {
    const d = rx[i]! - ry[i]!;
    sumD2 += d * d;
  }
  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

// ─── Core (accepts fixtures directly — used by tests) ────────────────────────

export async function calibrateWithFixtures(
  fixtures: CalibrationFixture[],
  provider: JudgeProvider,
  config: JudgeConfig,
  cacheDir?: string
): Promise<CalibrationReport> {
  const dimensionPairs = new Map<string, Array<[number, number]>>();
  const allHuman: number[] = [];
  const allJudge: number[] = [];

  for (const fixture of fixtures) {
    const results = await judgeSession(
      fixture.diffPatch,
      { task: fixture.task ?? undefined, cacheDir },
      provider,
      config
    );

    for (const result of results) {
      if (result.dimension === "unparseable") continue;

      const humanScore = fixture.humanScores[result.dimension];
      if (humanScore === undefined) continue;

      const pairs = dimensionPairs.get(result.dimension) ?? [];
      pairs.push([humanScore, result.score]);
      dimensionPairs.set(result.dimension, pairs);

      allHuman.push(humanScore);
      allJudge.push(result.score);
    }
  }

  const perDimension = Array.from(dimensionPairs.entries()).map(
    ([dimension, pairs]) => ({
      dimension,
      mae: pairs.reduce((sum, [h, j]) => sum + Math.abs(h - j), 0) / pairs.length,
      n: pairs.length,
    })
  );

  return {
    sampleCount: fixtures.length,
    perDimension,
    overallCorrelation: spearmanCorrelation(allHuman, allJudge),
  };
}

// ─── Public (loads fixtures from disk) ───────────────────────────────────────

export async function calibrate(
  provider: JudgeProvider,
  config: JudgeConfig,
  cacheDir?: string
): Promise<CalibrationReport> {
  const fixturesPath = path.join(__dirname, "fixtures", "labeled.json");
  const raw = fs.readFileSync(fixturesPath, "utf8");
  const fixtures = JSON.parse(raw) as CalibrationFixture[];
  return calibrateWithFixtures(fixtures, provider, config, cacheDir);
}
