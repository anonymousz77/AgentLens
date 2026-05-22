export type { ParseResult } from "./types";
import type { ParseResult } from "./types";

export function parse(output: string, exitCode: number): ParseResult {
  // "2 problems (1 error, 1 warning)" or "1 problem (1 error, 0 warnings)"
  const m = output.match(/(\d+)\s+problems?\s*\((\d+)\s+errors?/);
  if (m && m[2] !== undefined) {
    const errors = parseInt(m[2], 10);
    return { passed: 0, failed: errors, total: errors, coverage_pct: null };
  }
  // Clean run
  if (exitCode === 0) {
    return { passed: 0, failed: 0, total: 0, coverage_pct: null };
  }
  // Non-zero exit but no parseable problem line — treat as 1 error
  return { passed: 0, failed: 1, total: 1, coverage_pct: null };
}
