import type { ParseResult } from "./types";

const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function parse(output: string, exitCode: number): ParseResult {
  const plain = output.replace(ANSI_RE, "");

  // "5 passed, 2 failed in 0.3s" or "10 passed in 1.2s" or "3 failed, 1 error in 0.5s"
  const summaryRe =
    /(\d+) passed(?:,\s*(\d+) failed)?(?:,\s*\d+ errors?)?.*?in [\d.]+s/;
  const m = plain.match(summaryRe);

  let passed: number;
  let failed: number;
  let total: number;

  if (m) {
    passed = parseInt(m[1]!, 10);
    failed = m[2] !== undefined ? parseInt(m[2], 10) : 0;
    total = passed + failed;
  } else {
    // "3 failed in 0.3s" with no passed count
    const failOnlyRe = /(\d+) failed.*?in [\d.]+s/;
    const fm = plain.match(failOnlyRe);
    if (fm) {
      passed = 0;
      failed = parseInt(fm[1]!, 10);
      total = failed;
    } else {
      if (exitCode === 0) {
        return { passed: 0, failed: 0, total: 0, coverage_pct: null };
      }
      return { passed: 0, failed: 1, total: 1, coverage_pct: null };
    }
  }

  const coverage_pct = parseCoverage(plain);
  return { passed, failed, total, coverage_pct };
}

function parseCoverage(plain: string): number | null {
  // pytest-cov: "TOTAL    100     10     90    15    85%"
  const m = plain.match(/^TOTAL\s+\d+\s+\d+\s+\d+\s+\d+\s+([\d.]+)%/m);
  if (!m || m[1] === undefined) return null;
  const pct = parseFloat(m[1]);
  return isNaN(pct) ? null : pct;
}
