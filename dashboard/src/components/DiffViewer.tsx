import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface DiffLine {
  type: "+" | "-" | " " | "@@" | "header";
  content: string;
}

interface DiffFile {
  filename: string;
  lines: DiffLine[];
}

function parseDiff(patch: string): DiffFile[] {
  const files: DiffFile[] = [];
  let current: DiffFile | null = null;

  for (const raw of patch.split("\n")) {
    if (raw.startsWith("diff --git ") || raw.startsWith("--- a/") && current === null) {
      // New file section
      if (raw.startsWith("diff --git ")) {
        const m = /diff --git a\/.+ b\/(.+)/.exec(raw);
        current = { filename: m ? m[1]! : raw, lines: [] };
        files.push(current);
      }
      continue;
    }

    if (raw.startsWith("+++ b/")) {
      if (current) {
        const m = /^\+\+\+ b\/(.+)/.exec(raw);
        if (m) current.filename = m[1]!;
      }
      continue;
    }

    if (raw.startsWith("--- ") || raw.startsWith("index ") || raw.startsWith("new file") || raw.startsWith("deleted file")) {
      continue;
    }

    if (!current) {
      current = { filename: "patch", lines: [] };
      files.push(current);
    }

    if (raw.startsWith("@@")) {
      current.lines.push({ type: "@@", content: raw });
    } else if (raw.startsWith("+")) {
      current.lines.push({ type: "+", content: raw.slice(1) });
    } else if (raw.startsWith("-")) {
      current.lines.push({ type: "-", content: raw.slice(1) });
    } else if (raw.startsWith("\\")) {
      // "\ No newline at end of file" — skip
    } else {
      current.lines.push({ type: " ", content: raw.slice(1) });
    }
  }

  return files.filter((f) => f.lines.length > 0);
}

const MAX_LINES = 1000;

function DiffFileSection({ file }: { file: DiffFile }) {
  const [open, setOpen] = useState(true);
  const truncated = file.lines.length > MAX_LINES;
  const lines = truncated ? file.lines.slice(0, MAX_LINES) : file.lines;

  return (
    <div
      className="rounded overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      {/* File header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:opacity-80 transition-opacity"
        style={{ background: "var(--bg-raised)", cursor: "pointer" }}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown size={13} style={{ color: "var(--text-dim)" }} />
        ) : (
          <ChevronRight size={13} style={{ color: "var(--text-dim)" }} />
        )}
        <span
          className="mono-sm"
          style={{ color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}
        >
          {file.filename}
        </span>
        <span className="ml-auto mono-sm" style={{ color: "var(--text-dim)" }}>
          {file.lines.filter((l) => l.type === "+").length}+{" "}
          {file.lines.filter((l) => l.type === "-").length}−
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs" style={{ fontFamily: "JetBrains Mono, monospace" }}>
            <tbody>
              {lines.map((line, i) => {
                let bg = "transparent";
                let color = "var(--text-muted)";

                if (line.type === "+") {
                  bg = "rgba(34,197,94,0.07)";
                  color = "var(--text-primary)";
                } else if (line.type === "-") {
                  bg = "rgba(239,68,68,0.07)";
                  color = "var(--text-primary)";
                } else if (line.type === "@@") {
                  bg = "var(--bg-raised)";
                  color = "var(--text-dim)";
                }

                return (
                  <tr key={i} style={{ background: bg }}>
                    <td
                      className="select-none w-6 text-center py-px px-1"
                      style={{ color: "var(--text-dim)", userSelect: "none", fontSize: "10px" }}
                    >
                      {line.type === "+" ? "+" : line.type === "-" ? "−" : ""}
                    </td>
                    <td
                      className="py-px px-2 whitespace-pre"
                      style={{ color }}
                    >
                      {line.content}
                    </td>
                  </tr>
                );
              })}
              {truncated && (
                <tr>
                  <td colSpan={2} className="py-2 px-3 text-center" style={{ color: "var(--text-dim)", fontSize: "11px" }}>
                    … {file.lines.length - MAX_LINES} more lines truncated
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface Props {
  patch: string | null;
}

export default function DiffViewer({ patch }: Props) {
  if (!patch || patch.trim() === "") {
    return (
      <p className="text-sm" style={{ color: "var(--text-dim)" }}>
        No diff recorded for this session.
      </p>
    );
  }

  const files = parseDiff(patch);

  if (files.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-dim)" }}>
        Patch is empty or could not be parsed.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file, i) => (
        <DiffFileSection key={i} file={file} />
      ))}
    </div>
  );
}
