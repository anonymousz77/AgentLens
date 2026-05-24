import pc from "picocolors";
import { isInitialized, openDatabase } from "../db/database";
import { getSessionById } from "../db/sessions";
import { getChecksByPhase } from "../db/sessions";
import { executeBisect } from "../bisect/run";
import type { CheckKind } from "../types";

export interface BisectCommandOpts {
  checkFilter?: CheckKind;
  retries: number;
  json: boolean;
}

export async function runBisect(
  cwd: string,
  sessionId: string,
  opts: BisectCommandOpts
): Promise<void> {
  if (!isInitialized(cwd)) {
    throw new Error(
      "AgentLens is not initialized here. Run `agentlens init` first."
    );
  }

  const db = openDatabase(cwd);
  const session = getSessionById(db, sessionId);

  if (session === undefined) {
    db.close();
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (!session.git_base_sha || !session.git_head_sha) {
    db.close();
    throw new Error(
      `Session ${sessionId} has no git SHAs recorded — was it captured with git integration enabled?`
    );
  }

  if (session.ended_at === null) {
    console.log(
      pc.yellow("⚠") +
        " Session is still active — bisecting against partial data."
    );
  }

  const baseline = getChecksByPhase(db, sessionId, "baseline");
  const final = getChecksByPhase(db, sessionId, "final");
  db.close();

  await executeBisect(
    session.repo_path,
    session.git_base_sha,
    session.git_head_sha,
    baseline,
    final,
    opts
  );
}
