import type { JudgeConfig } from "../types";
import type { JudgeProvider } from "./provider";
import { computeCacheKey, getCached, setCached } from "./cache";

export interface JudgeDimension {
  dimension: string;
  score: number;       // 0–100
  confidence: number;  // 0–1
  rationale: string;
}

// ─── Prompt building ──────────────────────────────────────────────────────────

function buildPrompt(diffPatch: string, task?: string): string {
  const dimensions = [
    "- readability: Is the code easy to read and understand? Consider naming clarity, structure, complexity, and whether intent is obvious.",
    "- scope_discipline: Did the change stay focused on its purpose? High = tight scope; low = scope creep (touches unrelated files or concerns).",
  ];

  if (task) {
    dimensions.push(
      "- task_match: How well does this diff implement the stated task? High = complete and correct; low = off-target or incomplete."
    );
  }

  const rubric = [
    "Scoring rubric (apply consistently):",
    "  readability  — 90-100: exemplary; 70-89: good; 50-69: readable but issues; 30-49: hard to follow; 0-29: very poor",
    "  scope_discipline — 90-100: perfectly focused; 70-89: mostly focused; 50-69: some wandering; 30-49: significant creep; 0-29: sprawling",
  ];

  if (task) {
    rubric.push(
      "  task_match  — 90-100: fully implements the task; 70-89: mostly implements; 50-69: partial; 30-49: off-target; 0-29: unrelated"
    );
  }

  const taskSection = task
    ? `\nStated task: ${task}\n`
    : "";

  return [
    "You are a code review assistant. Analyze the following git diff and score its quality.",
    "",
    "Score ONLY these dimensions:",
    ...dimensions,
    "",
    ...rubric,
    "",
    "Return STRICT JSON only — a JSON array with NO prose, NO markdown fences, NO explanation outside the JSON.",
    'Each element must match exactly: { "dimension": "<name>", "score": <0-100>, "confidence": <0.0-1.0>, "rationale": "<one sentence>" }',
    taskSection,
    "Diff:",
    diffPatch,
  ].join("\n");
}

function buildRetryPrompt(diffPatch: string, task?: string): string {
  return (
    "IMPORTANT: Your previous response was not valid JSON. You MUST return a raw JSON array " +
    "with NO markdown, NO code fences, NO explanation — just the JSON array starting with [ and ending with ].\n\n" +
    buildPrompt(diffPatch, task)
  );
}

// ─── Response parsing ─────────────────────────────────────────────────────────

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

function parseResponse(raw: string): JudgeDimension[] {
  const cleaned = stripFences(raw);
  const parsed: unknown = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error("Response is not a JSON array");
  }

  return parsed.map((item: unknown, i: number): JudgeDimension => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`Element ${i} is not an object`);
    }
    const obj = item as Record<string, unknown>;

    if (
      typeof obj["dimension"] !== "string" ||
      typeof obj["score"] !== "number" ||
      typeof obj["confidence"] !== "number" ||
      typeof obj["rationale"] !== "string"
    ) {
      throw new Error(`Element ${i} missing required fields`);
    }

    return {
      dimension: obj["dimension"],
      score: Math.max(0, Math.min(100, obj["score"])),
      confidence: Math.max(0, Math.min(1, obj["confidence"])),
      rationale: obj["rationale"],
    };
  });
}

// ─── Main engine ──────────────────────────────────────────────────────────────

// Do NOT blend judge scores into the deterministic 0-100 score.
// Only consider blending after calibration confirms the judge is reliable.

export async function judgeSession(
  diffPatch: string,
  opts: { task?: string; cacheDir?: string },
  provider: JudgeProvider,
  _config: JudgeConfig
): Promise<JudgeDimension[]> {
  const prompt = buildPrompt(diffPatch, opts.task);
  const cacheKey = computeCacheKey(diffPatch, prompt, provider.modelId);

  // ── First attempt (possibly from cache) ──────────────────────────────────
  let raw: string;
  if (opts.cacheDir) {
    const hit = getCached(cacheKey, opts.cacheDir);
    if (hit !== null) {
      raw = hit;
    } else {
      raw = await provider.complete(prompt);
      setCached(cacheKey, raw, opts.cacheDir);
    }
  } else {
    raw = await provider.complete(prompt);
  }

  try {
    return parseResponse(raw);
  } catch {
    // First parse failed — retry once with a stricter prompt.
  }

  // ── Retry (bypasses cache — different prompt means different key) ─────────
  try {
    const retryPrompt = buildRetryPrompt(diffPatch, opts.task);
    const raw2 = await provider.complete(retryPrompt);
    return parseResponse(raw2);
  } catch {
    return [
      {
        dimension: "unparseable",
        score: 0,
        confidence: 0,
        rationale:
          "Judge returned invalid JSON after two attempts. Check provider output manually.",
      },
    ];
  }
}
