import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDatabase } from "./database";

// Builds a v2-schema DB (sessions table without task/cost_estimated) to simulate
// a database created before Phase 7c (schema v3).
function buildV2Db(dbFile: string): void {
  const db = new Database(dbFile);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (
      id           TEXT PRIMARY KEY,
      repo_path    TEXT NOT NULL,
      agent_name   TEXT,
      started_at   TEXT NOT NULL,
      ended_at     TEXT,
      git_base_sha TEXT,
      git_head_sha TEXT,
      score        REAL,
      tokens       INTEGER,
      cost_usd     REAL,
      notes        TEXT
    );
    CREATE TABLE IF NOT EXISTS diffs (
      id            TEXT PRIMARY KEY,
      session_id    TEXT NOT NULL REFERENCES sessions(id),
      files_changed INTEGER NOT NULL DEFAULT 0,
      lines_added   INTEGER NOT NULL DEFAULT 0,
      lines_removed INTEGER NOT NULL DEFAULT 0,
      patch         TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS checks (
      id           TEXT PRIMARY KEY,
      session_id   TEXT NOT NULL REFERENCES sessions(id),
      kind         TEXT NOT NULL,
      phase        TEXT NOT NULL DEFAULT 'final',
      passed       INTEGER NOT NULL DEFAULT 0,
      failed       INTEGER NOT NULL DEFAULT 0,
      total        INTEGER NOT NULL DEFAULT 0,
      coverage_pct REAL,
      runtime_ms   INTEGER,
      raw_output   TEXT
    );
    CREATE TABLE IF NOT EXISTS regressions (
      id          TEXT PRIMARY KEY,
      session_id  TEXT NOT NULL REFERENCES sessions(id),
      description TEXT NOT NULL,
      file        TEXT,
      hunk        TEXT,
      severity    TEXT NOT NULL DEFAULT 'medium'
    );
    CREATE TABLE IF NOT EXISTS judge_scores (
      id         TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      dimension  TEXT NOT NULL,
      score      REAL NOT NULL,
      confidence REAL NOT NULL,
      rationale  TEXT
    );
    INSERT INTO meta (key, value) VALUES ('schema_version', '2');
    INSERT INTO sessions (id, repo_path, agent_name, started_at)
      VALUES ('test-session-001', '/repo', 'aider', '2025-01-01T00:00:00.000Z');
  `);
  db.close();
}

describe("schema migration v2 → v3", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-migrate-test-"));
    // openDatabase looks for .agentlens/agentlens.db under the given repoRoot
    fs.mkdirSync(path.join(tmpDir, ".agentlens"));
    buildV2Db(path.join(tmpDir, ".agentlens", "agentlens.db"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("adds task and cost_estimated columns to existing DB", () => {
    const db = openDatabase(tmpDir);

    const columns = db
      .prepare("PRAGMA table_info(sessions)")
      .all() as Array<{ name: string }>;
    const names = columns.map((c) => c.name);

    expect(names).toContain("task");
    expect(names).toContain("cost_estimated");

    db.close();
  });

  it("preserves existing session rows after migration", () => {
    const db = openDatabase(tmpDir);

    const row = db
      .prepare("SELECT id, repo_path FROM sessions WHERE id = 'test-session-001'")
      .get() as { id: string; repo_path: string } | undefined;

    expect(row).toBeDefined();
    expect(row?.id).toBe("test-session-001");
    expect(row?.repo_path).toBe("/repo");

    db.close();
  });

  it("sets cost_estimated to 1 (default) for pre-existing sessions", () => {
    const db = openDatabase(tmpDir);

    const row = db
      .prepare("SELECT cost_estimated FROM sessions WHERE id = 'test-session-001'")
      .get() as { cost_estimated: number } | undefined;

    expect(row?.cost_estimated).toBe(1);

    db.close();
  });

  it("sets task to null for pre-existing sessions", () => {
    const db = openDatabase(tmpDir);

    const row = db
      .prepare("SELECT task FROM sessions WHERE id = 'test-session-001'")
      .get() as { task: string | null } | undefined;

    expect(row?.task).toBeNull();

    db.close();
  });

  it("updates schema_version to 3 in meta", () => {
    const db = openDatabase(tmpDir);

    const meta = db
      .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
      .get() as { value: string } | undefined;

    expect(meta?.value).toBe("3");

    db.close();
  });
});
