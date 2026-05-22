import { describe, it, expect } from "vitest";
import { parse } from "./mypy";

describe("mypy parser", () => {
  it("parses clean output with 'Success' message", () => {
    const output = "Success: no issues found in 3 source files";
    const r = parse(output, 0);
    expect(r.passed).toBe(0);
    expect(r.failed).toBe(0);
    expect(r.total).toBe(0);
    expect(r.coverage_pct).toBeNull();
  });

  it("parses 'Found N errors' summary", () => {
    const output = `
src/foo.py:10: error: Incompatible types in assignment
src/bar.py:22: error: Argument 1 to "f" has incompatible type "str"; expected "int"
Found 2 errors in 2 files (checked 5 source files)
`;
    const r = parse(output, 1);
    expect(r.failed).toBe(2);
    expect(r.total).toBe(2);
    expect(r.coverage_pct).toBeNull();
  });

  it("falls back to counting error: occurrences when no Found line", () => {
    const output = `
src/foo.py:5: error: Name "x" is not defined
src/foo.py:9: error: Return type mismatch
`;
    const r = parse(output, 1);
    expect(r.failed).toBe(2);
  });

  it("returns zeros for empty output with exit 0", () => {
    const r = parse("", 0);
    expect(r.passed).toBe(0);
    expect(r.failed).toBe(0);
    expect(r.total).toBe(0);
  });

  it("returns 0/1 fallback for unparseable output with exit 1", () => {
    const r = parse("mypy: command not found", 1);
    expect(r.failed).toBe(1);
    expect(r.total).toBe(1);
  });
});
