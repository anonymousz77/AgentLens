import { describe, it, expect } from "vitest";
import { parseCICommandOpts } from "../commands/ci";
import { shouldFail } from "./gate";

describe("parseCICommandOpts + gate wiring", () => {
  it("string minScore '101' with score 73 → shouldFail returns true", () => {
    const parsed = parseCICommandOpts({ minScore: "101", fail: true });
    expect(shouldFail(73, [], parsed.minScore!, parsed.noFail!)).toBe(true);
  });

  it("string minScore '50' with score 73 → shouldFail returns false", () => {
    const parsed = parseCICommandOpts({ minScore: "50", fail: true });
    expect(shouldFail(73, [], parsed.minScore!, parsed.noFail!)).toBe(false);
  });

  it("parsed minScore is a number, not a string", () => {
    const parsed = parseCICommandOpts({ minScore: "101", fail: true });
    expect(typeof parsed.minScore).toBe("number");
    expect(parsed.minScore).toBe(101);
  });

  it("fail=true (--no-fail absent) → noFail is false", () => {
    const parsed = parseCICommandOpts({ minScore: "70", fail: true });
    expect(parsed.noFail).toBe(false);
  });

  it("fail=false (--no-fail passed) → noFail is true, gate ignores threshold", () => {
    const parsed = parseCICommandOpts({ minScore: "101", fail: false });
    expect(parsed.noFail).toBe(true);
    expect(shouldFail(73, [], parsed.minScore!, parsed.noFail!)).toBe(false);
  });
});
