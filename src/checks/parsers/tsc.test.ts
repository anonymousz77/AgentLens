import { describe, it, expect } from "vitest";
import { parse } from "./tsc";

describe("tsc parser", () => {
  it("returns zero errors for clean output", () => {
    const r = parse("", 0);
    expect(r.failed).toBe(0);
    expect(r.total).toBe(0);
  });

  it("counts two type errors", () => {
    const output = `
src/index.ts(5,7): error TS2322: Type 'string' is not assignable to type 'number'.
src/foo.ts(12,3): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.
`;
    const r = parse(output, 1);
    expect(r.failed).toBe(2);
    expect(r.total).toBe(2);
    expect(r.passed).toBe(0);
  });

  it("counts many errors exactly", () => {
    const lines = Array.from(
      { length: 7 },
      (_, i) => `src/x.ts(${i},1): error TS2304: Cannot find name 'x'.`
    ).join("\n");
    const r = parse(lines, 1);
    expect(r.failed).toBe(7);
  });
});
