import pc from "picocolors";
import { detectChecks } from "../checks/detect";
import { runCommand } from "../checks/run";
import { selectParsers } from "../checks/parsers/index";
import type { ParseResult } from "../checks/parsers/types";

export function runCheck(cwd: string): void {
  const detected = detectChecks(cwd);

  if (!detected.test && !detected.type && !detected.lint) {
    console.log(pc.yellow("No checks detected in this directory."));
    return;
  }

  const parsers = selectParsers(detected.ecosystem);

  if (detected.test) {
    console.log(pc.dim("  running test: " + [detected.test.cmd, ...detected.test.args].join(" ")));
    try {
      const res = runCommand(detected.test, cwd);
      const r = parsers.test(res.output, res.exitCode) as ParseResult;
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
      const r = parsers.type(res.output, res.exitCode);
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
      const r = parsers.lint(res.output, res.exitCode);
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
