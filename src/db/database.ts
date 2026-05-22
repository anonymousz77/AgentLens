import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

export const AGENTLENS_DIR = ".agentlens";
export const DB_FILENAME = "agentlens.db";

/**
 * Returns the path to the .agentlens directory for a given repo root.
 */
export function agentlensDir(repoRoot: string): string {
  return path.join(repoRoot, AGENTLENS_DIR);
}

/**
 * Returns the path to the SQLite database file for a given repo root.
 */
export function dbPath(repoRoot: string): string {
  return path.join(agentlensDir(repoRoot), DB_FILENAME);
}

/**
 * Opens (creating if needed) the AgentLens database for a repo root,
 * applies the schema idempotently, and records the schema version.
 *
 * Safe to call repeatedly — uses CREATE TABLE IF NOT EXISTS throughout.
 */
export function openDatabase(repoRoot: string): Database.Database {
  const dir = agentlensDir(repoRoot);
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(dbPath(repoRoot));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Apply schema (idempotent).
  db.exec(SCHEMA_SQL);

  // Record schema version in meta.
  db.prepare(
    "INSERT INTO meta (key, value) VALUES ('schema_version', ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(String(SCHEMA_VERSION));

  return db;
}

/**
 * Returns true if a repo root already has an initialized AgentLens database.
 */
export function isInitialized(repoRoot: string): boolean {
  return fs.existsSync(dbPath(repoRoot));
}
