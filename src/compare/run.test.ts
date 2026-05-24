import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../db/database";
import { insertSession, updateSession, updateSessionScore, updateSessionCost } from "../db/sessions";
import { runCompare } from "./run";

// ---------------------------------------------------------------------------
// Temp repo management
// ---------------------------------------------------------------------------

const repos: string[] = [];

function tempRepo(): string {
  const r = mkdtempSync(join(tmpdir(), "agentlens-compare-test-"));
  repos.push(r);
  return r;
}

afterEach(() => {
  for (const r of repos.splice(0)) {
    try { rmSync(r, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

function seedSession(
  repoRoot: string,
  agent: string,
  score: number | null,
  costUsd: number | null = null
): string {
  const db = openDatabase(repoRoot);
  const sessionId = insertSession(db, {
    repo_path: repoRoot,
    agent_name: agent,
    git_base_sha: "abc123",
    notes: null,
  });
  updateSession(db, { id: sessionId, ended_at: new Date().toISOString(), git_head_sha: "def456" });
  if (score !== null) updateSessionScore(db, sessionId, score);
  if (costUsd !== null) updateSessionCost(db, sessionId, 1000, costUsd, 0);
  db.close();
  return sessionId;
}

// ---------------------------------------------------------------------------
// Self-comparison guard
// ---------------------------------------------------------------------------

describe("runCompare — self-comparison guard", () => {
  it("throws when --agent and --vs are the same", () => {
    const repo = tempRepo();
    expect(() => runCompare(repo, { agent: "claude-code", vs: "claude-code" })).toThrow(
      /cannot compare an agent to itself/
    );
  });
});

// ---------------------------------------------------------------------------
// Uninitialized DB
// ---------------------------------------------------------------------------

describe("runCompare — uninitialized DB", () => {
  it("throws when AgentLens is not initialized", () => {
    const repo = tempRepo(); // no openDatabase called — not initialized
    expect(() => runCompare(repo, {})).toThrow(/not initialized/i);
  });
});

// ---------------------------------------------------------------------------
// Grouping and metric extraction
// ---------------------------------------------------------------------------

describe("runCompare — grouping", () => {
  it("runs without error with sessions from two agents", () => {
    const repo = tempRepo();
    seedSession(repo, "claude-code", 80);
    seedSession(repo, "claude-code", 85);
    seedSession(repo, "cursor", 60);
    seedSession(repo, "cursor", 65);
    seedSession(repo, "cursor", 70);
    // Should not throw
    expect(() => runCompare(repo, { json: true })).not.toThrow();
  });

  it("JSON output contains both agents", () => {
    const repo = tempRepo();
    seedSession(repo, "claude-code", 80);
    seedSession(repo, "cursor", 60);
    let output = "";
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s: string) => { output += s; return true; };
    try {
      runCompare(repo, { json: true });
    } finally {
      process.stdout.write = orig;
    }
    const json = JSON.parse(output) as { agents: Array<{ agentName: string }> };
    const names = json.agents.map((a) => a.agentName);
    expect(names).toContain("claude-code");
    expect(names).toContain("cursor");
  });

  it("null scores are excluded from metric values", () => {
    const repo = tempRepo();
    seedSession(repo, "claude-code", 80);
    seedSession(repo, "claude-code", null); // no score — should be skipped
    let output = "";
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s: string) => { output += s; return true; };
    try {
      runCompare(repo, { json: true });
    } finally {
      process.stdout.write = orig;
    }
    const json = JSON.parse(output) as { agents: Array<{ agentName: string; stats: { n: number } }> };
    const cc = json.agents.find((a) => a.agentName === "claude-code");
    expect(cc?.stats.n).toBe(1); // only the non-null score
  });

  it("--metric cost extracts cost_usd instead of score", () => {
    const repo = tempRepo();
    seedSession(repo, "claude-code", null, 0.05);
    seedSession(repo, "claude-code", null, 0.08);
    seedSession(repo, "cursor", null, 0.12);
    seedSession(repo, "cursor", null, 0.10);
    let output = "";
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s: string) => { output += s; return true; };
    try {
      runCompare(repo, { json: true, metric: "cost" });
    } finally {
      process.stdout.write = orig;
    }
    const json = JSON.parse(output) as {
      metric: string;
      agents: Array<{ agentName: string; stats: { n: number; mean: number } }>;
    };
    expect(json.metric).toBe("cost");
    const cc = json.agents.find((a) => a.agentName === "claude-code");
    expect(cc?.stats.n).toBe(2);
    expect(cc?.stats.mean).toBeCloseTo(0.065, 5);
  });

  it("agents are ranked by mean score descending in score mode", () => {
    const repo = tempRepo();
    seedSession(repo, "low-agent", 40);
    seedSession(repo, "low-agent", 45);
    seedSession(repo, "low-agent", 42);
    seedSession(repo, "high-agent", 90);
    seedSession(repo, "high-agent", 88);
    seedSession(repo, "high-agent", 92);
    let output = "";
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s: string) => { output += s; return true; };
    try {
      runCompare(repo, { json: true });
    } finally {
      process.stdout.write = orig;
    }
    const json = JSON.parse(output) as { agents: Array<{ agentName: string }> };
    expect(json.agents[0]!.agentName).toBe("high-agent");
    expect(json.agents[1]!.agentName).toBe("low-agent");
  });

  it("agents are ranked by mean cost ascending in cost mode", () => {
    const repo = tempRepo();
    seedSession(repo, "cheap", null, 0.01);
    seedSession(repo, "cheap", null, 0.02);
    seedSession(repo, "cheap", null, 0.015);
    seedSession(repo, "expensive", null, 0.10);
    seedSession(repo, "expensive", null, 0.12);
    seedSession(repo, "expensive", null, 0.11);
    let output = "";
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s: string) => { output += s; return true; };
    try {
      runCompare(repo, { json: true, metric: "cost" });
    } finally {
      process.stdout.write = orig;
    }
    const json = JSON.parse(output) as { agents: Array<{ agentName: string }> };
    expect(json.agents[0]!.agentName).toBe("cheap");
    expect(json.agents[1]!.agentName).toBe("expensive");
  });
});

// ---------------------------------------------------------------------------
// Pairwise mode
// ---------------------------------------------------------------------------

describe("runCompare — pairwise mode", () => {
  it("JSON pairwise result contains the two named agents", () => {
    const repo = tempRepo();
    for (let i = 0; i < 5; i++) seedSession(repo, "claude-code", 80 + i);
    for (let i = 0; i < 5; i++) seedSession(repo, "cursor", 60 + i);
    let output = "";
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s: string) => { output += s; return true; };
    try {
      runCompare(repo, { json: true, agent: "claude-code", vs: "cursor" });
    } finally {
      process.stdout.write = orig;
    }
    const json = JSON.parse(output) as {
      pairwise: Array<{ agentA: string; agentB: string }>;
    };
    expect(json.pairwise).toHaveLength(1);
    const pw = json.pairwise[0]!;
    expect([pw.agentA, pw.agentB]).toContain("claude-code");
    expect([pw.agentA, pw.agentB]).toContain("cursor");
  });

  it("throws a clear error when a named agent has no sessions", () => {
    const repo = tempRepo();
    seedSession(repo, "claude-code", 80);
    expect(() =>
      runCompare(repo, { agent: "claude-code", vs: "ghost-agent" })
    ).toThrow(/ghost-agent/);
  });

  it("pairwise JSON sets sufficientData=false when n < MIN_N_FOR_SIGNIFICANCE", () => {
    const repo = tempRepo();
    seedSession(repo, "agent-a", 80); // n=1 — below threshold
    seedSession(repo, "agent-b", 60); // n=1 — below threshold
    let output = "";
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s: string) => { output += s; return true; };
    try {
      runCompare(repo, { json: true, agent: "agent-a", vs: "agent-b" });
    } finally {
      process.stdout.write = orig;
    }
    const json = JSON.parse(output) as { pairwise: Array<{ sufficientData: boolean }> };
    expect(json.pairwise[0]!.sufficientData).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// No sessions
// ---------------------------------------------------------------------------

describe("runCompare — no sessions", () => {
  it("does not throw when DB is initialized but has no sessions", () => {
    const repo = tempRepo();
    const db = openDatabase(repo);
    db.close();
    expect(() => runCompare(repo, {})).not.toThrow();
  });
});
