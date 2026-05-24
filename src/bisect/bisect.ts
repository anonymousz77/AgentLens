// Pure binary search — NO imports from git, checks, db, or fs layers.
// Preconditions (caller's responsibility):
//   n >= 2, isBad(0) === false (known-good), isBad(n-1) === true (known-bad).
// Returns the first index i ∈ [1, n-1] where isBad(i) === true.
// Returns -1 if n < 2 (degenerate).
export function bisectFirstBad(
  n: number,
  isBad: (index: number) => boolean
): number {
  if (n < 2) return -1;

  // Guard: detect duplicate probes — binary search should never revisit an index.
  const probed = new Set<number>();
  const probe = (i: number): boolean => {
    if (probed.has(i)) {
      throw new Error(`bisect: duplicate probe at index ${i}`);
    }
    probed.add(i);
    return isBad(i);
  };

  // Classic lower-bound binary search over [1, n-1].
  // lo=1: skip index 0 (known-good, never probed).
  // hi=n-1: known-bad ceiling, never probed (returned by convergence).
  let lo = 1;
  let hi = n - 1;

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (probe(mid)) {
      hi = mid; // mid or earlier is the first bad
    } else {
      lo = mid + 1; // mid is good, look higher
    }
  }

  // lo === hi: the first bad index.
  // When n=2, lo=hi=1 immediately — zero isBad calls, culprit is index 1 by elimination.
  return lo;
}
