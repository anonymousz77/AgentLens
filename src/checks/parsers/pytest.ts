import type { ParseResult } from "./types";

const ANSI_RE = /\x1b\[[0-9;]*m/g;

// pytest's final summary line, e.g. "3 failed, 19 passed, 2 warnings in 0.12s".
// pytest orders outcomes itself (failed before passed), so counts are read by
// name rather than by position.
const SUMMARY_LINE_RE = /\d+ (?:passed|failed)\b.*\bin [\d.]+s/;

function countOf(line: string, outcome: string): number {
  const m = line.match(new RegExp(`(\\d+) ${outcome}\\b`));
  return m ? parseInt(m[1]!, 10) : 0;
}

export function parse(output: string, exitCode: number): ParseResult {
  const plain = output.replace(ANSI_RE, "");

  const summary = plain
    .split(/\r?\n/)
    .reverse()
    .find((line) => SUMMARY_LINE_RE.test(line));

  if (summary === undefined) {
    if (exitCode === 0) {
      return { passed: 0, failed: 0, total: 0, coverage_pct: null };
    }
    return { passed: 0, failed: 1, total: 1, coverage_pct: null };
  }

  const passed = countOf(summary, "passed");
  const failed = countOf(summary, "failed");
  const coverage_pct = parseCoverage(plain);
  return { passed, failed, total: passed + failed, coverage_pct };
}

function parseCoverage(plain: string): number | null {
  // pytest-cov TOTAL row, with or without branch columns:
  //   "TOTAL    100     10    90%"
  //   "TOTAL    100     10     20     3    85%"
  const m = plain.match(/^TOTAL(?:\s+\d+)+\s+([\d.]+)%/m);
  if (!m || m[1] === undefined) return null;
  const pct = parseFloat(m[1]);
  return isNaN(pct) ? null : pct;
}
