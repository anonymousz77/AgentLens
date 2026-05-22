import pc from "picocolors";
import { isInitialized, openDatabase } from "../db/database";
import { listSessions, SessionListRow } from "../db/sessions";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStats(row: SessionListRow): string {
  if (row.ended_at === null) {
    return pc.yellow("(active)");
  }
  if (row.files_changed === null) {
    return pc.dim("—");
  }
  return (
    String(row.files_changed) +
    " files  " +
    pc.green("+" + String(row.lines_added ?? 0)) +
    " / " +
    pc.red("-" + String(row.lines_removed ?? 0))
  );
}

export function runSessions(cwd: string): void {
  if (!isInitialized(cwd)) {
    throw new Error(
      "AgentLens is not initialized here. Run `agentlens init` first."
    );
  }

  const db = openDatabase(cwd);
  const rows = listSessions(db);
  db.close();

  if (rows.length === 0) {
    console.log(pc.dim("No sessions recorded yet."));
    return;
  }

  const header =
    pc.bold("id      ") +
    "  " +
    pc.bold("agent           ") +
    "  " +
    pc.bold("started             ") +
    "  " +
    pc.bold("changes");
  console.log(header);
  console.log(pc.dim("─".repeat(72)));

  for (const row of rows) {
    const id = row.id.substring(0, 8).padEnd(8);
    const agent = (row.agent_name ?? "—").substring(0, 16).padEnd(16);
    const started = formatDate(row.started_at).padEnd(20);
    const stats = formatStats(row);
    console.log(`${pc.cyan(id)}  ${agent}  ${pc.dim(started)}  ${stats}`);
  }
}
