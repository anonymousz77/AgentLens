import path from "node:path";
import pc from "picocolors";
import { isInitialized } from "../db/database";
import { agentlensDir, openDatabase } from "../db/database";
import { getDiff, getJudgeScoresBySession, getLatestSession, getSessionById, insertJudgeScore } from "../db/sessions";
import { loadJudgeConfig } from "../config";
import { selectProvider, MockProvider } from "../judge/provider";
import { judgeSession } from "../judge/judge";
import { calibrate } from "../judge/calibrate";
import { DEFAULT_CONFIG } from "../types";

// ─── agentlens judge [--task <desc>] [sessionId] ──────────────────────────────

export async function runJudge(
  cwd: string,
  sessionId: string | undefined,
  opts: { task?: string }
): Promise<void> {
  if (!isInitialized(cwd)) {
    console.error(pc.red("Not initialized. Run `agentlens init` first."));
    process.exit(1);
  }

  const db = openDatabase(cwd);
  const judgeConfig = loadJudgeConfig(cwd);

  const provider = selectProvider(judgeConfig);
  if (!provider) {
    console.log(
      pc.yellow("No judge provider configured.") +
        "\n\nTo enable the LLM judge, add a `judge` block to .agentlens/config.json:\n" +
        pc.dim(
          JSON.stringify(
            { judge: { provider: "anthropic", model: "claude-haiku-4-5-20251001", baseURL: null } },
            null,
            2
          )
        ) +
        "\n\nThen set your API key:\n  export ANTHROPIC_API_KEY=sk-ant-..." +
        "\n\nFor offline local models (Ollama, LM Studio) use provider \"local\" with a baseURL." +
        "\nFor testing without a key use provider \"mock\"."
    );
    db.close();
    process.exit(0);
  }

  const session = sessionId
    ? getSessionById(db, sessionId)
    : getLatestSession(db);

  if (!session) {
    console.error(
      pc.red(sessionId ? `Session ${sessionId} not found.` : "No sessions recorded yet.")
    );
    db.close();
    process.exit(1);
  }

  const diff = getDiff(db, session.id);
  if (!diff || !diff.patch) {
    console.error(pc.red("No diff found for this session. Was `session end` called?"));
    db.close();
    process.exit(1);
  }

  const cacheDir = path.join(agentlensDir(cwd), "judge-cache");

  console.log(
    pc.bold("LLM Judge") +
      pc.dim(` — session ${session.id.slice(0, 8)}…  [provider: ${judgeConfig.provider}]`)
  );
  if (opts.task) {
    console.log(pc.dim(`Task: ${opts.task}`));
  }
  console.log();

  const results = await judgeSession(
    diff.patch,
    { task: opts.task, cacheDir },
    provider,
    judgeConfig
  );

  // Print results table.
  const labelW = 18;
  const scoreW = 7;
  const confW = 12;
  console.log(
    pc.bold(
      "Dimension".padEnd(labelW) +
        "Score".padEnd(scoreW) +
        "Confidence".padEnd(confW) +
        "Rationale"
    )
  );
  console.log("─".repeat(80));

  for (const r of results) {
    const scoreColor = r.score >= 70 ? pc.green : r.score >= 40 ? pc.yellow : pc.red;
    console.log(
      r.dimension.padEnd(labelW) +
        scoreColor(String(r.score).padEnd(scoreW)) +
        String((r.confidence * 100).toFixed(0) + "%").padEnd(confW) +
        pc.dim(r.rationale)
    );
    insertJudgeScore(db, {
      session_id: session.id,
      dimension: r.dimension,
      score: r.score,
      confidence: r.confidence,
      rationale: r.rationale,
    });
  }

  console.log();
  console.log(
    pc.dim(
      "Qualitative scores only — not blended into the deterministic 0-100 score.\n" +
        "Run `agentlens judge calibrate` to measure judge reliability."
    )
  );

  // Show if prior scores exist for this session.
  const existingScores = getJudgeScoresBySession(db, session.id);
  const priorCount = existingScores.length - results.length;
  if (priorCount > 0) {
    console.log(pc.dim(`(${priorCount} prior judge score(s) also stored for this session)`));
  }

  db.close();
}

// ─── agentlens judge calibrate ────────────────────────────────────────────────

export async function runJudgeCalibrate(cwd: string): Promise<void> {
  // Load config if initialized; fall back to defaults gracefully.
  const judgeConfig = isInitialized(cwd)
    ? loadJudgeConfig(cwd)
    : { ...DEFAULT_CONFIG.judge };

  let provider = selectProvider(judgeConfig);
  let usingMock = false;

  if (!provider) {
    // No provider configured — fall back to MockProvider so calibration is always demoable.
    provider = new MockProvider();
    usingMock = true;
  }

  // Also fall back to mock if provider is Anthropic but key is absent.
  if (judgeConfig.provider === "anthropic" && !process.env["ANTHROPIC_API_KEY"]) {
    provider = new MockProvider();
    usingMock = true;
  }

  const cacheDir = isInitialized(cwd)
    ? path.join(agentlensDir(cwd), "judge-cache")
    : undefined;

  if (usingMock) {
    console.log(
      pc.yellow(
        "Calibrating against MockProvider — configure a real provider for true calibration."
      ) +
        "\nMAE and correlation reflect mock scores, not a real model.\n"
    );
  } else {
    console.log(
      pc.bold(`Calibrating judge`) +
        pc.dim(` [provider: ${judgeConfig.provider}, model: ${judgeConfig.model}]\n`)
    );
  }

  const report = await calibrate(provider, judgeConfig, cacheDir);

  // ── Print per-dimension table ──────────────────────────────────────────────
  const dimW = 20;
  const maeW = 10;
  const nW = 8;
  console.log(pc.bold("Dimension".padEnd(dimW) + "MAE".padEnd(maeW) + "N".padEnd(nW)));
  console.log("─".repeat(40));

  for (const d of report.perDimension) {
    const maeStr = d.mae.toFixed(2);
    const maeColor = d.mae < 10 ? pc.green : d.mae < 20 ? pc.yellow : pc.red;
    console.log(
      d.dimension.padEnd(dimW) + maeColor(maeStr.padEnd(maeW)) + String(d.n).padEnd(nW)
    );
  }

  console.log();
  const corrColor =
    report.overallCorrelation >= 0.7
      ? pc.green
      : report.overallCorrelation >= 0.4
        ? pc.yellow
        : pc.red;
  console.log(
    "Overall Spearman correlation: " + corrColor(report.overallCorrelation.toFixed(3))
  );
  console.log("Sample count:               " + report.sampleCount);
  console.log();

  if (!usingMock) {
    if (report.overallCorrelation >= 0.7) {
      console.log(pc.green("✓ Judge shows good agreement with human labels (ρ ≥ 0.7)"));
    } else if (report.overallCorrelation >= 0.4) {
      console.log(pc.yellow("~ Moderate agreement — treat judge scores as advisory"));
    } else {
      console.log(pc.red("✗ Low agreement — do not rely on judge scores without further tuning"));
    }
  }
}
