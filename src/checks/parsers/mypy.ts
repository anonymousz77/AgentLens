import type { ParseResult } from "./types";

export function parse(output: string, exitCode: number): ParseResult {
  if (/Success: no issues found/.test(output)) {
    return { passed: 0, failed: 0, total: 0, coverage_pct: null };
  }

  // "Found 3 errors in 2 files (checked 5 source files)"
  const foundRe = /Found (\d+) error/;
  const fm = output.match(foundRe);
  if (fm) {
    const failed = parseInt(fm[1]!, 10);
    return { passed: 0, failed, total: failed, coverage_pct: null };
  }

  // Fallback: count "error:" occurrences in output
  const errorCount = (output.match(/\berror:/g) ?? []).length;
  if (errorCount > 0) {
    return { passed: 0, failed: errorCount, total: errorCount, coverage_pct: null };
  }

  if (exitCode === 0) {
    return { passed: 0, failed: 0, total: 0, coverage_pct: null };
  }
  return { passed: 0, failed: 1, total: 1, coverage_pct: null };
}
