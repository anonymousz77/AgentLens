import pc from "picocolors";
import { detectChecks } from "../checks/detect";
import { runCommand } from "../checks/run";
import { parse as parseVitest } from "../checks/parsers/vitest";
import { parse as parseTsc } from "../checks/parsers/tsc";
import { parse as parseEslint } from "../checks/parsers/eslint";
import type { ParseResult } from "../checks/parsers/types";

export function runCheck(cwd: string): void {
  const detected = detectChecks(cwd);

  if (!detected.test && !detected.type && !detected.lint) {
    console.log(pc.yellow("No checks detected in this directory."));
    return;
  }

  if (detected.test) {
    console.log(pc.dim("  running test: " + [detected.test.cmd, ...detected.test.args].join(" ")));
    try {
      const res = runCommand(detected.test, cwd);
      const r = parseVitest(res.output, res.exitCode) as ParseResult;
      console.log(
        "  " + pc.bold("tests") + "  " +
        formatTestResult(r) +
        pc.dim(` (${res.runtime_ms}ms)`)
      );
    } catch (e) {
      console.log("  " + pc.bold("tests") + "  " + pc.red(String(e)));
    }
  }

  if (detected.type) {
    console.log(pc.dim("  running type: " + [detected.type.cmd, ...detected.type.args].join(" ")));
    try {
      const res = runCommand(detected.type, cwd);
      const r = parseTsc(res.output, res.exitCode);
      console.log(
        "  " + pc.bold("type") + "   " +
        (r.failed === 0 ? pc.green("0 errors") : pc.red(r.failed + " error(s)")) +
        pc.dim(` (${res.runtime_ms}ms)`)
      );
    } catch (e) {
      console.log("  " + pc.bold("type") + "   " + pc.red(String(e)));
    }
  }

  if (detected.lint) {
    console.log(pc.dim("  running lint: " + [detected.lint.cmd, ...detected.lint.args].join(" ")));
    try {
      const res = runCommand(detected.lint, cwd);
      const r = parseEslint(res.output, res.exitCode);
      console.log(
        "  " + pc.bold("lint") + "   " +
        (r.failed === 0 ? pc.green("0 errors") : pc.red(r.failed + " error(s)")) +
        pc.dim(` (${res.runtime_ms}ms)`)
      );
    } catch (e) {
      console.log("  " + pc.bold("lint") + "   " + pc.red(String(e)));
    }
  }
}

function formatTestResult(r: ParseResult): string {
  if (r.failed === 0) {
    return pc.green(`${r.passed}/${r.total} passed`);
  }
  return pc.red(`${r.passed}/${r.total} passed, ${r.failed} failed`);
}
