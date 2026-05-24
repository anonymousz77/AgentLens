import { describe, it, expect } from "vitest";
import { bisectFirstBad } from "./bisect";

// Helper: track all isBad calls and delegate to a predicate.
function tracked(pred: (i: number) => boolean): {
  fn: (i: number) => boolean;
  calls: number[];
} {
  const calls: number[] = [];
  return {
    fn: (i: number) => {
      calls.push(i);
      return pred(i);
    },
    calls,
  };
}

describe("bisectFirstBad — correctness", () => {
  it("finds first bad at index 1 (bad from index 1)", () => {
    expect(bisectFirstBad(5, (i) => i >= 1)).toBe(1);
  });

  it("finds first bad at last index when only index n-1 is bad", () => {
    expect(bisectFirstBad(8, (i) => i === 7)).toBe(7);
  });

  it("finds first bad at a middle index", () => {
    expect(bisectFirstBad(10, (i) => i >= 5)).toBe(5);
  });

  it("n=2 single candidate: returns 1 with zero isBad calls", () => {
    const t = tracked(() => true);
    const result = bisectFirstBad(2, t.fn);
    expect(result).toBe(1);
    expect(t.calls).toHaveLength(0); // culprit by elimination, no probing needed
  });

  it("n=1 degenerate: returns -1", () => {
    expect(bisectFirstBad(1, () => false)).toBe(-1);
  });

  it("n=0 degenerate: returns -1", () => {
    expect(bisectFirstBad(0, () => false)).toBe(-1);
  });

  it("all intermediates bad (bad from index 1): returns 1", () => {
    expect(bisectFirstBad(6, (i) => i >= 1)).toBe(1);
  });

  it("n=3 bad only at index 2: returns 2 with one probe", () => {
    const t = tracked((i) => i >= 2);
    const result = bisectFirstBad(3, t.fn);
    expect(result).toBe(2);
    expect(t.calls).toHaveLength(1);
    expect(t.calls[0]).toBe(1);
  });
});

describe("bisectFirstBad — O(log n) proof", () => {
  it("n=1000: isBad calls ≤ ceil(log2(1000)) + 2", () => {
    const n = 1000;
    const culprit = 731; // arbitrary mid-range culprit
    const t = tracked((i) => i >= culprit);
    const result = bisectFirstBad(n, t.fn);
    expect(result).toBe(culprit);

    const maxAllowed = Math.ceil(Math.log2(n)) + 2; // = 12
    expect(t.calls.length).toBeLessThanOrEqual(maxAllowed);
  });

  it("no index is probed twice across a large search", () => {
    const n = 500;
    const t = tracked((i) => i >= 200);
    bisectFirstBad(n, t.fn);

    const seen = new Set(t.calls);
    expect(seen.size).toBe(t.calls.length); // no duplicates
  });
});

describe("bisectFirstBad — duplicate probe guard", () => {
  it("does not throw for a well-behaved search (no duplicates generated)", () => {
    // Standard binary search never revisits an index; guard should stay silent.
    expect(() => bisectFirstBad(16, (i) => i >= 8)).not.toThrow();
  });
});
