/**
 * Canonical AgentLens database schema.
 *
 * Kept as an inlined string (rather than a separate .sql file) so it survives
 * compilation/bundling without any runtime file-path resolution. This is the
 * single source of truth for the DB shape; src/types.ts mirrors it.
 *
 * Bump SCHEMA_VERSION whenever the shape changes and add a migration step.
 */

export const SCHEMA_VERSION = 3;

export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  repo_path     TEXT NOT NULL,
  agent_name    TEXT,
  started_at    TEXT NOT NULL,
  ended_at      TEXT,
  git_base_sha  TEXT,
  git_head_sha  TEXT,
  score          REAL,
  tokens         INTEGER,
  cost_usd       REAL,
  cost_estimated INTEGER NOT NULL DEFAULT 1,
  notes          TEXT,
  task           TEXT
);

CREATE TABLE IF NOT EXISTS diffs (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  files_changed INTEGER NOT NULL DEFAULT 0,
  lines_added   INTEGER NOT NULL DEFAULT 0,
  lines_removed INTEGER NOT NULL DEFAULT 0,
  patch         TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS checks (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('test','type','lint','coverage')),
  phase        TEXT NOT NULL DEFAULT 'final' CHECK (phase IN ('baseline','final')),
  passed       INTEGER NOT NULL DEFAULT 0,
  failed       INTEGER NOT NULL DEFAULT 0,
  total        INTEGER NOT NULL DEFAULT 0,
  coverage_pct REAL,
  runtime_ms   INTEGER,
  raw_output   TEXT
);

CREATE TABLE IF NOT EXISTS regressions (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  file        TEXT,
  hunk        TEXT,
  severity    TEXT NOT NULL DEFAULT 'medium'
                CHECK (severity IN ('low','medium','high','critical'))
);

CREATE TABLE IF NOT EXISTS judge_scores (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  dimension  TEXT NOT NULL,
  score      REAL NOT NULL,
  confidence REAL NOT NULL,
  rationale  TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_repo    ON sessions(repo_path);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_diffs_session    ON diffs(session_id);
CREATE INDEX IF NOT EXISTS idx_checks_session   ON checks(session_id);
CREATE INDEX IF NOT EXISTS idx_regr_session     ON regressions(session_id);
`;
