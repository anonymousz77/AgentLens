export type { ParseResult } from "./types";
import type { ParseResult } from "./types";

export function parse(output: string, _exitCode: number): ParseResult {
  const matches = output.match(/error TS\d+:/g);
  const errorCount = matches ? matches.length : 0;
  return {
    passed: 0,
    failed: errorCount,
    total: errorCount,
    coverage_pct: null,
  };
}
