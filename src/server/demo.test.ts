import { describe, it, expect } from "vitest";
import { getDemoSessions, getDemoSession, getDemoStats } from "./demo";

describe("getDemoSessions", () => {
  it("returns exactly 36 sessions", () => {
    expect(getDemoSessions()).toHaveLength(36);
  });

  it("all session IDs are prefixed with 'demo-'", () => {
    const sessions = getDemoSessions();
    expect(sessions.every((s) => s.id.startsWith("demo-"))).toBe(true);
  });

  it("score distribution matches spec: ≥18 green, ≥6 amber, ≥3 red", () => {
    const sessions = getDemoSessions();
    const green = sessions.filter((s) => s.score !== null && s.score >= 80);
    const amber = sessions.filter((s) => s.score !== null && s.score >= 50 && s.score < 80);
    const red   = sessions.filter((s) => s.score !== null && s.score < 50);
    expect(green.length).toBeGreaterThanOrEqual(18);
    expect(amber.length).toBeGreaterThanOrEqual(6);
    expect(red.length).toBeGreaterThanOrEqual(3);
  });

  it("is deterministic — two calls return identical arrays", () => {
    expect(getDemoSessions()).toEqual(getDemoSessions());
  });

  it("SessionSummary shape: all required fields present with correct types", () => {
    const sessions = getDemoSessions();
    for (const s of sessions) {
      expect(typeof s.id).toBe("string");
      expect(typeof s.started_at).toBe("string");
      expect(s.ended_at === null || typeof s.ended_at === "string").toBe(true);
      expect(s.score === null || typeof s.score === "number").toBe(true);
      expect(typeof s.files_changed).toBe("number");
      expect(typeof s.lines_added).toBe("number");
      expect(typeof s.lines_removed).toBe("number");
      expect(typeof s.regressions_count).toBe("number");
      expect(s.task === null || typeof s.task === "string").toBe(true);
      expect(typeof s.cost_estimated).toBe("number");
    }
  });

  it("started_at values are valid ISO 8601 timestamps", () => {
    const sessions = getDemoSessions();
    for (const s of sessions) {
      const ms = Date.parse(s.started_at);
      expect(Number.isNaN(ms)).toBe(false);
    }
  });

  it("agents are drawn from the expected pool", () => {
    const allowed = new Set(["claude-code", "cursor", "aider", "copilot", "windsurf"]);
    const sessions = getDemoSessions();
    for (const s of sessions) {
      if (s.agent_name !== null) {
        expect(allowed.has(s.agent_name)).toBe(true);
      }
    }
  });
});

describe("getDemoSession", () => {
  it("returns a non-null SessionDetail for any valid demo session ID", () => {
    const sessions = getDemoSessions();
    const first = sessions[0];
    expect(first).toBeDefined();
    const detail = getDemoSession(first!.id);
    expect(detail).not.toBeNull();
  });

  it("returns null for an unknown ID", () => {
    expect(getDemoSession("nonexistent-id")).toBeNull();
  });

  it("SessionDetail shape: all top-level fields present", () => {
    const sessions = getDemoSessions();
    const detail = getDemoSession(sessions[0]!.id);
    expect(detail).not.toBeNull();
    expect(detail!.session).toBeDefined();
    expect(detail!.diff).toBeDefined();
    expect(Array.isArray(detail!.baseline_checks)).toBe(true);
    expect(Array.isArray(detail!.final_checks)).toBe(true);
    expect(Array.isArray(detail!.deltas)).toBe(true);
    expect(Array.isArray(detail!.regressions)).toBe(true);
    expect(Array.isArray(detail!.score_breakdown)).toBe(true);
    expect(typeof detail!.score).toBe("number");
  });

  it("detail.session conforms to Session type", () => {
    const sessions = getDemoSessions();
    const detail = getDemoSession(sessions[0]!.id);
    const sess = detail!.session;
    expect(typeof sess.id).toBe("string");
    expect(typeof sess.repo_path).toBe("string");
    expect(sess.git_base_sha === null || typeof sess.git_base_sha === "string").toBe(true);
    expect(sess.git_head_sha === null || typeof sess.git_head_sha === "string").toBe(true);
    expect(sess.score === null || typeof sess.score === "number").toBe(true);
  });

  it("deltas are consistent with baseline and final checks", () => {
    const sessions = getDemoSessions();
    for (const summary of sessions.slice(0, 5)) {
      const detail = getDemoSession(summary.id)!;
      for (const delta of detail.deltas) {
        const b = delta.baseline;
        const f = delta.final;
        expect(delta.passed_delta).toBe((f?.passed ?? 0) - (b?.passed ?? 0));
        expect(delta.failed_delta).toBe((f?.failed ?? 0) - (b?.failed ?? 0));
      }
    }
  });
});

describe("getDemoStats", () => {
  it("sessions_count is 36", () => {
    expect(getDemoStats().sessions_count).toBe(36);
  });

  it("score_over_time has 36 entries", () => {
    expect(getDemoStats().score_over_time).toHaveLength(36);
  });

  it("coverage_over_time has 36 entries", () => {
    expect(getDemoStats().coverage_over_time).toHaveLength(36);
  });

  it("avg_score is between 0 and 100", () => {
    const { avg_score } = getDemoStats();
    expect(avg_score).not.toBeNull();
    expect(avg_score!).toBeGreaterThanOrEqual(0);
    expect(avg_score!).toBeLessThanOrEqual(100);
  });

  it("score_over_time is ordered oldest → newest", () => {
    const { score_over_time } = getDemoStats();
    for (let i = 1; i < score_over_time.length; i++) {
      const prev = Date.parse(score_over_time[i - 1]!.started_at);
      const curr = Date.parse(score_over_time[i]!.started_at);
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });
});
