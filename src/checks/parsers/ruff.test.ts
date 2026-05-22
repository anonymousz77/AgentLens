import { describe, it, expect } from "vitest";
import { parse } from "./ruff";

describe("ruff parser", () => {
  it("returns zeros for clean output with exit 0", () => {
    const r = parse("All checks passed.", 0);
    expect(r.passed).toBe(0);
    expect(r.failed).toBe(0);
    expect(r.total).toBe(0);
    expect(r.coverage_pct).toBeNull();
  });

  it("parses 'Found N errors' summary", () => {
    const output = `
src/foo.py:3:1: F401 \`os\` imported but unused
src/bar.py:10:5: E501 Line too long (92 > 88 characters)
Found 2 errors.
`;
    const r = parse(output, 1);
    expect(r.failed).toBe(2);
    expect(r.total).toBe(2);
    expect(r.coverage_pct).toBeNull();
  });

  it("falls back to counting per-line diagnostics when no Found line", () => {
    const output = `src/foo.py:3:1: F401 \`os\` imported but unused
src/foo.py:7:1: E302 Expected 2 blank lines, got 1
`;
    const r = parse(output, 1);
    expect(r.failed).toBe(2);
  });

  it("returns zeros for empty output with exit 0", () => {
    const r = parse("", 0);
    expect(r.failed).toBe(0);
    expect(r.total).toBe(0);
  });

  it("returns 0/1 fallback for unparseable non-zero exit", () => {
    const r = parse("ruff: command not found", 1);
    expect(r.failed).toBe(1);
    expect(r.total).toBe(1);
  });
});
