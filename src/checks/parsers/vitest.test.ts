import { describe, it, expect } from "vitest";
import { parse } from "./vitest";

describe("vitest parser", () => {
  it("parses passing output (no failures)", () => {
    const output = `
 ✓ src/foo.test.ts (3)
 ✓ src/bar.test.ts (2)

 Test Files  2 passed (2)
 Tests  5 passed (5)
 Duration  1.23s
`;
    const r = parse(output, 0);
    expect(r.passed).toBe(5);
    expect(r.failed).toBe(0);
    expect(r.total).toBe(5);
    expect(r.coverage_pct).toBeNull();
  });

  it("parses output with failures", () => {
    const output = `
 ✓ src/foo.test.ts (3)
 × src/bar.test.ts (2)

 Test Files  1 passed | 1 failed (2)
 Tests  3 passed | 2 failed (5)
 Duration  1.50s
`;
    const r = parse(output, 1);
    expect(r.passed).toBe(3);
    expect(r.failed).toBe(2);
    expect(r.total).toBe(5);
  });

  it("returns zeros when exit 0 and no test summary found", () => {
    const r = parse("No tests found", 0);
    expect(r.passed).toBe(0);
    expect(r.failed).toBe(0);
    expect(r.total).toBe(0);
  });

  it("parses coverage percentage from table", () => {
    const output = `
 Tests  4 passed (4)

----------------------|---------|----------|---------|---------|
File                  | % Stmts | % Branch | % Funcs | % Lines |
----------------------|---------|----------|---------|---------|
All files             |   82.50 |    75.00 |   90.00 |   82.50 |
 src/index.ts         |   82.50 |    75.00 |   90.00 |   82.50 |
----------------------|---------|----------|---------|---------|
`;
    const r = parse(output, 0);
    expect(r.passed).toBe(4);
    expect(r.coverage_pct).toBeCloseTo(82.5);
  });
});
