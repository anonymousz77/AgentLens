import { describe, it, expect } from "vitest";
import { parse } from "./eslint";

describe("eslint parser", () => {
  it("returns zero errors for clean run", () => {
    const r = parse("", 0);
    expect(r.failed).toBe(0);
    expect(r.total).toBe(0);
  });

  it("parses 1 error from '2 problems (1 error, 1 warning)'", () => {
    const output = `
/project/src/foo.ts
  5:3  warning  'x' is defined but never used  no-unused-vars
  8:1  error    Unexpected console statement    no-console

✖ 2 problems (1 error, 1 warning)
`;
    const r = parse(output, 1);
    expect(r.failed).toBe(1);
    expect(r.total).toBe(1);
    expect(r.passed).toBe(0);
  });

  it("parses multiple errors", () => {
    const output = "✖ 5 problems (4 errors, 1 warning)";
    const r = parse(output, 1);
    expect(r.failed).toBe(4);
    expect(r.total).toBe(4);
  });
});
