import type { Check, CheckKind, RegressionSeverity } from "../types";

export interface DetectedRegression {
  description: string;
  file: string | null;
  hunk: string | null;
  severity: RegressionSeverity;
}

interface DiffFile {
  path: string;
  section: string;
}

// Parse unified diff into per-file sections. Uses the b/ path (post-change
// filename) from the "diff --git a/... b/..." header line.
function parseDiffFiles(patch: string): DiffFile[] {
  const result: DiffFile[] = [];
  const headerRe = /^diff --git a\/.+ b\/(.+)$/gm;
  const positions: Array<{ path: string; start: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = headerRe.exec(patch)) !== null) {
    positions.push({ path: match[1]!, start: match.index });
  }

  for (let i = 0; i < positions.length; i++) {
    const entry = positions[i]!;
    const next = positions[i + 1];
    const section = next
      ? patch.slice(entry.start, next.start)
      : patch.slice(entry.start);
    result.push({ path: entry.path, section });
  }

  return result;
}

// Extract the first hunk header (@@...@@) from a file's diff section, or null.
function extractFirstHunk(section: string): string | null {
  const m = section.match(/^(@@[^@]*@@.*)$/m);
  return m?.[1] ?? null;
}

function isTestFile(filePath: string): boolean {
  return (
    /\.(test|spec)\.[^.]+$/.test(filePath) ||
    /\/(test|tests|__tests__)\//.test(filePath)
  );
}

// Best-effort attribution: finds the most plausible file from the diff.
// When preferTest is true, favours test files; otherwise source files.
// Falls back to the first file of any type when no preferred file exists.
// Returns { file: null, hunk: null } only when the diff has no files at all.
// Never returns a file not present in the diff.
function attributeFile(
  diffFiles: DiffFile[],
  preferTest: boolean
): { file: string | null; hunk: string | null } {
  if (diffFiles.length === 0) {
    return { file: null, hunk: null };
  }

  const preferred = diffFiles.filter((f) =>
    preferTest ? isTestFile(f.path) : !isTestFile(f.path)
  );
  const candidates = preferred.length > 0 ? preferred : diffFiles;
  const chosen = candidates[0]!;

  return { file: chosen.path, hunk: extractFirstHunk(chosen.section) };
}

function findCheck(checks: Check[], kind: CheckKind): Check | undefined {
  return checks.find((c) => c.kind === kind);
}

const SEVERITY_ORDER: Record<RegressionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function detectRegressions(
  baseline: Check[],
  final: Check[],
  diffPatch: string
): DetectedRegression[] {
  const results: DetectedRegression[] = [];
  const diffFiles = parseDiffFiles(diffPatch);

  // ── TEST DIMENSION (build break and individual regressions are mutually
  // exclusive — a build break subsumes all other test signals) ───────────────
  const bTest = findCheck(baseline, "test");
  const fTest = findCheck(final, "test");

  if (bTest !== undefined && fTest !== undefined) {
    if (bTest.failed === 0 && bTest.total > 0 && fTest.total === 0) {
      // Build break: the entire suite failed to start.
      const { file, hunk } = attributeFile(diffFiles, false);
      results.push({
        description: "Test suite failed to run (build break)",
        file,
        hunk,
        severity: "critical",
      });
    } else {
      // NOTE: aggregate-only inference — per-test names unavailable at this
      // phase (see score.ts). Conservative: only count regressions when total
      // did not shrink (a smaller total likely means tests were removed).
      const regressionCount =
        fTest.total >= bTest.total
          ? Math.max(0, bTest.passed - fTest.passed)
          : 0;

      if (regressionCount > 0) {
        const { file, hunk } = attributeFile(diffFiles, true);
        results.push({
          description: `${regressionCount} test(s) regressed (were passing, now failing)`,
          file,
          hunk,
          severity: "high",
        });
      }

      const newFailureCount = Math.max(
        0,
        fTest.failed - bTest.failed - regressionCount
      );

      if (newFailureCount > 0) {
        const { file, hunk } = attributeFile(diffFiles, true);
        results.push({
          description: `${newFailureCount} new test failure(s) introduced`,
          file,
          hunk,
          severity: "high",
        });
      }
    }
  }

  // ── TYPE ERRORS (independent dimension — always evaluated) ─────────────────
  const bType = findCheck(baseline, "type");
  const fType = findCheck(final, "type");

  if (bType !== undefined && fType !== undefined && fType.failed > bType.failed) {
    const added = fType.failed - bType.failed;
    const { file, hunk } = attributeFile(diffFiles, false);
    results.push({
      description: `${added} type error(s) introduced`,
      file,
      hunk,
      severity: "medium",
    });
  }

  // ── LINT ERRORS (independent dimension — always evaluated) ─────────────────
  const bLint = findCheck(baseline, "lint");
  const fLint = findCheck(final, "lint");

  if (bLint !== undefined && fLint !== undefined && fLint.failed > bLint.failed) {
    const added = fLint.failed - bLint.failed;
    const { file, hunk } = attributeFile(diffFiles, false);
    results.push({
      description: `${added} lint error(s) introduced`,
      file,
      hunk,
      severity: "low",
    });
  }

  // Stable sort: severity order (critical → high → medium → low), then
  // description alphabetically within each severity.
  results.sort((a, b) => {
    const sd = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return sd !== 0 ? sd : a.description.localeCompare(b.description);
  });

  return results;
}
