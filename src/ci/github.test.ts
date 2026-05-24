import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseGHContext, chooseCommentAction, formatMarkdownReport } from "./github";
import type { CIPRResult } from "./scorePR";

// ── parseGHContext ────────────────────────────────────────────────────────────

describe("parseGHContext", () => {
  let tmpFile: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `agentlens-test-event-${Date.now()}.json`);
  });

  afterEach(() => {
    process.env = { ...origEnv };
    try { fs.rmSync(tmpFile, { force: true }); } catch { /* ok */ }
  });

  it("returns prNumber/owner/repo from a valid event file", () => {
    const event = { pull_request: { number: 42 } };
    fs.writeFileSync(tmpFile, JSON.stringify(event));
    process.env["GITHUB_EVENT_PATH"] = tmpFile;
    process.env["GITHUB_REPOSITORY"] = "acme/myrepo";

    const ctx = parseGHContext();
    expect(ctx).not.toBeNull();
    expect(ctx!.prNumber).toBe(42);
    expect(ctx!.owner).toBe("acme");
    expect(ctx!.repo).toBe("myrepo");
  });

  it("returns null when env vars are absent", () => {
    delete process.env["GITHUB_EVENT_PATH"];
    delete process.env["GITHUB_REPOSITORY"];
    expect(parseGHContext()).toBeNull();
  });

  it("returns null when event file has no pull_request field", () => {
    const event = { push: { ref: "refs/heads/main" } };
    fs.writeFileSync(tmpFile, JSON.stringify(event));
    process.env["GITHUB_EVENT_PATH"] = tmpFile;
    process.env["GITHUB_REPOSITORY"] = "acme/myrepo";
    expect(parseGHContext()).toBeNull();
  });
});

// ── chooseCommentAction ───────────────────────────────────────────────────────

describe("chooseCommentAction", () => {
  it("returns PATCH with id when marker comment exists", () => {
    const comments = [
      { id: 1, body: "unrelated comment" },
      { id: 2, body: "<!-- agentlens-report -->\n## AgentLens CI Report" },
    ];
    const result = chooseCommentAction(comments);
    expect(result.action).toBe("patch");
    if (result.action === "patch") expect(result.id).toBe(2);
  });

  it("returns POST when no marker comment exists", () => {
    const comments = [
      { id: 1, body: "unrelated comment" },
      { id: 2, body: "another comment without the marker" },
    ];
    const result = chooseCommentAction(comments);
    expect(result.action).toBe("post");
  });

  it("returns POST when comment list is empty", () => {
    expect(chooseCommentAction([])).toEqual({ action: "post" });
  });
});

// ── formatMarkdownReport ──────────────────────────────────────────────────────

function makeResult(overrides: Partial<CIPRResult> = {}): CIPRResult {
  return {
    score: 85,
    breakdown: [{ reason: "test regression", delta: -15 }],
    regressions: [],
    finalChecks: [],
    baselineMode: "clean",
    ...overrides,
  };
}

describe("formatMarkdownReport", () => {
  it("contains the sticky-comment marker", () => {
    const md = formatMarkdownReport(makeResult(), true);
    expect(md).toContain("<!-- agentlens-report -->");
  });

  it("contains the score", () => {
    const md = formatMarkdownReport(makeResult({ score: 72 }), true);
    expect(md).toContain("72/100");
  });

  it("shows PASS badge when passing", () => {
    expect(formatMarkdownReport(makeResult(), true)).toContain("PASS");
  });

  it("shows FAIL badge when failing", () => {
    expect(formatMarkdownReport(makeResult(), false)).toContain("FAIL");
  });

  it("includes regression description when regressions present", () => {
    const result = makeResult({
      regressions: [
        { description: "test suite broke", file: "src/foo.ts", hunk: null, severity: "critical" },
      ],
    });
    const md = formatMarkdownReport(result, false);
    expect(md).toContain("test suite broke");
    expect(md).toContain("src/foo.ts");
  });

  it("includes delta mode note", () => {
    const md = formatMarkdownReport(makeResult({ baselineMode: "delta" }), true);
    expect(md).toContain("delta");
  });
});
