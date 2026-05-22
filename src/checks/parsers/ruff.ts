import type { ParseResult } from "./types";

export function parse(output: string, exitCode: number): ParseResult {
  // "Found 5 errors."
  const foundRe = /Found (\d+) errors?/;
  const fm = output.match(foundRe);
  if (fm) {
    const failed = parseInt(fm[1]!, 10);
    return { passed: 0, failed, total: failed, coverage_pct: null };
  }

  // Fallback: count per-line diagnostics "path:line:col: CODE message"
  const diagLines = output.split("\n").filter((l) =>
    /^.+:\d+:\d+: [A-Z]\d+/.test(l)
  );
  if (diagLines.length > 0) {
    return { passed: 0, failed: diagLines.length, total: diagLines.length, coverage_pct: null };
  }

  if (exitCode === 0) {
    return { passed: 0, failed: 0, total: 0, coverage_pct: null };
  }
  return { passed: 0, failed: 1, total: 1, coverage_pct: null };
}
