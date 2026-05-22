import crypto from "node:crypto";
import Database from "better-sqlite3";

export interface InsertSessionParams {
  repo_path: string;
  agent_name: string | null;
  git_base_sha: string | null;
  notes: string | null;
}

export interface UpdateSessionParams {
  id: string;
  ended_at: string;
  git_head_sha: string | null;
}

export interface InsertDiffParams {
  session_id: string;
  files_changed: number;
  lines_added: number;
  lines_removed: number;
  patch: string;
}

export interface SessionListRow {
  id: string;
  agent_name: string | null;
  started_at: string;
  ended_at: string | null;
  files_changed: number | null;
  lines_added: number | null;
  lines_removed: number | null;
}

export function insertSession(
  db: Database.Database,
  params: InsertSessionParams
): string {
  const id = crypto.randomUUID();
  const started_at = new Date().toISOString();
  db.prepare(
    "INSERT INTO sessions (id, repo_path, agent_name, started_at, git_base_sha, notes) " +
      "VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    params.repo_path,
    params.agent_name,
    started_at,
    params.git_base_sha,
    params.notes
  );
  return id;
}

export function updateSession(
  db: Database.Database,
  params: UpdateSessionParams
): void {
  db.prepare(
    "UPDATE sessions SET ended_at = ?, git_head_sha = ? WHERE id = ?"
  ).run(params.ended_at, params.git_head_sha, params.id);
}

export function insertDiff(
  db: Database.Database,
  params: InsertDiffParams
): string {
  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO diffs (id, session_id, files_changed, lines_added, lines_removed, patch) " +
      "VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    params.session_id,
    params.files_changed,
    params.lines_added,
    params.lines_removed,
    params.patch
  );
  return id;
}

export function listSessions(db: Database.Database): SessionListRow[] {
  return db
    .prepare<[], SessionListRow>(
      "SELECT s.id, s.agent_name, s.started_at, s.ended_at, " +
        "d.files_changed, d.lines_added, d.lines_removed " +
        "FROM sessions s " +
        "LEFT JOIN diffs d ON d.session_id = s.id " +
        "ORDER BY s.started_at DESC"
    )
    .all() as SessionListRow[];
}
