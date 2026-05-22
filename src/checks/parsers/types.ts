export interface ParseResult {
  passed: number;
  failed: number;
  total: number;
  coverage_pct: number | null;
}
