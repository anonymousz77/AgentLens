import fs from "node:fs";
import type { CIPRResult } from "./scorePR";

export interface GHContext {
  prNumber: number;
  owner: string;
  repo: string;
}

export function parseGHContext(): GHContext | null {
  const eventPath = process.env["GITHUB_EVENT_PATH"];
  const repository = process.env["GITHUB_REPOSITORY"];

  if (!eventPath || !repository) return null;

  try {
    const raw = fs.readFileSync(eventPath, "utf8");
    const event = JSON.parse(raw) as Record<string, unknown>;
    const pr = event["pull_request"] as Record<string, unknown> | undefined;
    if (!pr || typeof pr["number"] !== "number") return null;

    const [owner, repo] = repository.split("/");
    if (!owner || !repo) return null;

    return { prNumber: pr["number"], owner, repo };
  } catch {
    return null;
  }
}

export function appendJobSummary(markdown: string): void {
  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (!summaryPath) return;
  try {
    fs.appendFileSync(summaryPath, markdown + "\n");
  } catch {
    // non-fatal
  }
}

const COMMENT_MARKER = "<!-- agentlens-report -->";

interface GHComment {
  id: number;
  body: string;
}

export function chooseCommentAction(
  comments: GHComment[]
): { action: "patch"; id: number } | { action: "post" } {
  const existing = comments.find((c) => c.body.includes(COMMENT_MARKER));
  if (existing) return { action: "patch", id: existing.id };
  return { action: "post" };
}

export async function postStickyComment(
  prNumber: number,
  owner: string,
  repo: string,
  token: string,
  body: string
): Promise<void> {
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    const listRes = await fetch(
      `${base}/issues/${prNumber}/comments?per_page=100`,
      { headers }
    );
    if (!listRes.ok) {
      console.warn(`agentlens ci: could not list PR comments (${listRes.status})`);
      return;
    }
    const comments = (await listRes.json()) as GHComment[];
    const decision = chooseCommentAction(comments);

    if (decision.action === "patch") {
      const patchRes = await fetch(
        `${base}/issues/comments/${decision.id}`,
        { method: "PATCH", headers, body: JSON.stringify({ body }) }
      );
      if (!patchRes.ok) {
        console.warn(`agentlens ci: could not update PR comment (${patchRes.status})`);
      }
    } else {
      const postRes = await fetch(
        `${base}/issues/${prNumber}/comments`,
        { method: "POST", headers, body: JSON.stringify({ body }) }
      );
      if (!postRes.ok) {
        console.warn(`agentlens ci: could not post PR comment (${postRes.status})`);
      }
    }
  } catch (e) {
    console.warn(`agentlens ci: comment error — ${String(e)}`);
  }
}

export function formatMarkdownReport(result: CIPRResult, pass: boolean): string {
  const badge = pass ? "✅ **PASS**" : "❌ **FAIL**";
  const modeNote =
    result.baselineMode === "delta"
      ? "delta (base vs HEAD)"
      : result.baselineNote
      ? `clean baseline (${result.baselineNote})`
      : "clean baseline (synthesized)";

  const lines: string[] = [
    COMMENT_MARKER,
    "## AgentLens CI Report",
    "",
    `${badge} &nbsp; Score: **${result.score}/100** &nbsp; Mode: ${modeNote}`,
    "",
  ];

  if (result.breakdown.length > 0) {
    lines.push("### Score Breakdown");
    lines.push("");
    lines.push("| Reason | Delta |");
    lines.push("|--------|-------|");
    for (const item of result.breakdown) {
      const sign = item.delta >= 0 ? "+" : "";
      lines.push(`| ${item.reason} | ${sign}${item.delta.toFixed(2)} |`);
    }
    lines.push("");
  }

  if (result.regressions.length > 0) {
    lines.push(`### Regressions (${result.regressions.length})`);
    lines.push("");
    lines.push("| Severity | Description | File |");
    lines.push("|----------|-------------|------|");
    for (const reg of result.regressions) {
      const file = reg.file ?? "—";
      lines.push(`| ${reg.severity} | ${reg.description} | \`${file}\` |`);
    }
    lines.push("");
  } else {
    lines.push("_No regressions detected._");
    lines.push("");
  }

  return lines.join("\n");
}
