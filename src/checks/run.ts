import { spawnSync } from "node:child_process";
import type { CommandSpec } from "./detect";

export interface RunResult {
  exitCode: number;
  output: string;
  runtime_ms: number;
}

const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes
const MAX_BUFFER = 10 * 1024 * 1024; // 10 MB

export function runCommand(
  spec: CommandSpec,
  cwd: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): RunResult {
  const start = Date.now();
  const result = spawnSync(spec.cmd, spec.args, {
    cwd,
    encoding: "utf8",
    // shell:true is required on Windows so that npm/npx resolve to .cmd wrappers
    shell: true,
    timeout: timeoutMs,
    maxBuffer: MAX_BUFFER,
  });
  const runtime_ms = Date.now() - start;

  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const stderr = typeof result.stderr === "string" ? result.stderr : "";
  const output = [stdout, stderr].filter(Boolean).join("\n");
  const exitCode = result.status ?? 1;

  return { exitCode, output, runtime_ms };
}
