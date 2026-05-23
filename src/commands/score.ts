import pc from "picocolors";
import { isInitialized, openDatabase } from "../db/database";
import {
  getChecksByPhase,
  getDiff,
  getLatestSession,
  getSessionById,
} from "../db/sessions";
import { loadScoringConfig } from "../config";
import { computeScore } from "../scoring/score";
import { detectRegressions } from "../scoring/regressions";
import { printScoreReport } from "../scoring/format";

export function runScore(cwd: string, sessionId?: string): void {
  if (!isInitialized(cwd)) {
    throw new Error(
      "AgentLens is not initialized here. Run `agentlens init` first."
    );
  }

  const db = openDatabase(cwd);

  const session =
    sessionId !== undefined
      ? getSessionById(db, sessionId)
      : getLatestSession(db);

  if (session === undefined) {
    db.close();
    if (sessionId !== undefined) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    throw new Error("No sessions recorded yet. Run `agentlens session start` first.");
  }

  if (session.ended_at === null) {
    console.log(
      pc.yellow("⚠") +
        " Session is still active — score reflects baseline data only."
    );
  }

  const baseline = getChecksByPhase(db, session.id, "baseline");
  const final    = getChecksByPhase(db, session.id, "final");
  const diff     = getDiff(db, session.id);

  db.close();

  const config = loadScoringConfig(cwd);
  const scoreResult = computeScore({ baseline, final }, config);
  const regressions = detectRegressions(baseline, final, diff?.patch ?? "");

  const sid = pc.cyan("#" + session.id.substring(0, 8));
  console.log(pc.dim(`Session ${sid}`));
  printScoreReport(scoreResult, regressions);
}
