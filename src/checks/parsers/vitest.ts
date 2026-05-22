export type { ParseResult } from "./types";
import type { ParseResult } from "./types";

// Vitest colorizes output even when not in a TTY; strip ANSI before parsing.
const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function parse(output: string, exitCode: number): ParseResult {
  const plain = output.replace(ANSI_RE, "");
  // Match: "Tests  5 passed (5)" or "Tests  3 passed | 2 failed (5)"
  const summaryRe = /Tests\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+failed)?\s*\((\d+)\)/;
  const m = plain.match(summaryRe);

  let passed: number;
  let failed: number;
  let total: number;

  if (m) {
    passed = parseInt(m[1]!, 10);
    failed = m[2] !== undefined ? parseInt(m[2], 10) : 0;
    total = parseInt(m[3]!, 10);
  } else {
    // No summary found
    if (exitCode === 0) {
      return { passed: 0, failed: 0, total: 0, coverage_pct: null };
    }
    return { passed: 0, failed: 1, total: 1, coverage_pct: null };
  }

  const coverage_pct = parseCoverage(plain);
  return { passed, failed, total, coverage_pct };
}

function parseCoverage(plain: string): number | null {
  // Coverage table row: "All files |  82.50 | ..."
  const m = plain.match(/All files\s*\|\s*([\d.]+)/);
  if (!m || m[1] === undefined) return null;
  const pct = parseFloat(m[1]);
  return isNaN(pct) ? null : pct;
}
