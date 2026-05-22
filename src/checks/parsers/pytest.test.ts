import { describe, it, expect } from "vitest";
import { parse } from "./pytest";

describe("pytest parser", () => {
  it("parses all-passing output", () => {
    const output = `
============================= test session starts ==============================
collected 5 items

test_foo.py .....                                                        [100%]

============================== 5 passed in 0.31s ===============================
`;
    const r = parse(output, 0);
    expect(r.passed).toBe(5);
    expect(r.failed).toBe(0);
    expect(r.total).toBe(5);
    expect(r.coverage_pct).toBeNull();
  });

  it("parses mixed pass/fail output", () => {
    const output = `
============================= test session starts ==============================
collected 7 items

test_foo.py ...                                                          [ 42%]
test_bar.py ..FF                                                         [100%]

=================================== FAILURES ===================================
FAILED test_bar.py::test_one - AssertionError
FAILED test_bar.py::test_two - AssertionError

========================= 5 passed, 2 failed in 1.23s ==========================
`;
    const r = parse(output, 1);
    expect(r.passed).toBe(5);
    expect(r.failed).toBe(2);
    expect(r.total).toBe(7);
  });

  it("parses failure-only output (no passed count in summary)", () => {
    const output = `
============================= test session starts ==============================
collected 3 items

test_foo.py FFF                                                          [100%]

========================= 3 failed in 0.45s ============================
`;
    const r = parse(output, 1);
    expect(r.passed).toBe(0);
    expect(r.failed).toBe(3);
    expect(r.total).toBe(3);
  });

  it("returns zeros for empty output with exit 0", () => {
    const r = parse("", 0);
    expect(r.passed).toBe(0);
    expect(r.failed).toBe(0);
    expect(r.total).toBe(0);
    expect(r.coverage_pct).toBeNull();
  });

  it("returns 0/1 fallback for unparseable output with exit 1", () => {
    const r = parse("something went wrong", 1);
    expect(r.passed).toBe(0);
    expect(r.failed).toBe(1);
    expect(r.total).toBe(1);
  });

  it("parses coverage percentage from pytest-cov TOTAL line", () => {
    const output = `
============================== 4 passed in 0.52s ===============================

----------- coverage: platform linux, python 3.11 -----------
Name            Stmts   Miss Branch BrPart  Cover
---------------------------------------------------
src/foo.py         45      7     12      2    78%
TOTAL             100     12     20      3    85%
`;
    const r = parse(output, 0);
    expect(r.passed).toBe(4);
    expect(r.coverage_pct).toBeCloseTo(85);
  });

  it("strips ANSI codes before parsing", () => {
    const output = "\x1b[32m5 passed\x1b[0m in 0.10s";
    const r = parse(output, 0);
    expect(r.passed).toBe(5);
    expect(r.failed).toBe(0);
  });
});
