import fs from "node:fs";
import path from "node:path";

export interface CommandSpec {
  cmd: string;
  args: string[];
}

export interface DetectionResult {
  test: CommandSpec | null;
  type: CommandSpec | null;
  lint: CommandSpec | null;
  ecosystem: "js" | "python" | null;
}

// npm default test stub — not a real test command
const NPM_DEFAULT_TEST = "echo \"Error: no test specified\" && exit 1";

export function detectChecks(repoRoot: string): DetectionResult {
  let pkg: Record<string, unknown> = {};
  try {
    const raw = fs.readFileSync(path.join(repoRoot, "package.json"), "utf8");
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // no package.json — try Python
    return detectPython(repoRoot);
  }

  const scripts = (pkg["scripts"] ?? {}) as Record<string, string>;
  const deps = {
    ...(pkg["dependencies"] ?? {}),
    ...(pkg["devDependencies"] ?? {}),
  } as Record<string, string>;

  return {
    test: detectTest(repoRoot, scripts, deps),
    type: detectType(repoRoot, deps),
    lint: detectLint(repoRoot, deps),
    ecosystem: "js",
  };
}

function detectTest(
  repoRoot: string,
  scripts: Record<string, string>,
  deps: Record<string, string>
): CommandSpec | null {
  try {
    const testScript = scripts["test"];
    if (testScript && testScript.trim() !== NPM_DEFAULT_TEST.trim()) {
      return { cmd: "npm", args: ["test"] };
    }
    if (
      "vitest" in deps ||
      hasConfigFile(repoRoot, /^vitest\.config\.(ts|js|mts|mjs|cts|cjs)$/)
    ) {
      return { cmd: "npx", args: ["vitest", "run"] };
    }
    if ("jest" in deps) {
      return { cmd: "npx", args: ["jest"] };
    }
    return null;
  } catch {
    return null;
  }
}

function detectType(
  repoRoot: string,
  deps: Record<string, string>
): CommandSpec | null {
  try {
    if (
      fs.existsSync(path.join(repoRoot, "tsconfig.json")) &&
      "typescript" in deps
    ) {
      return { cmd: "npx", args: ["tsc", "--noEmit"] };
    }
    return null;
  } catch {
    return null;
  }
}

function detectLint(
  repoRoot: string,
  deps: Record<string, string>
): CommandSpec | null {
  try {
    if (
      "eslint" in deps ||
      hasConfigFile(repoRoot, /^\.eslintrc(\.(js|cjs|yaml|yml|json))?$/) ||
      hasConfigFile(repoRoot, /^eslint\.config\.(js|mjs|cjs|ts|mts|cts)$/)
    ) {
      return { cmd: "npx", args: ["eslint", "."] };
    }
    return null;
  } catch {
    return null;
  }
}

function hasConfigFile(dir: string, pattern: RegExp): boolean {
  try {
    return fs.readdirSync(dir).some((f) => pattern.test(f));
  } catch {
    return false;
  }
}

function detectPython(repoRoot: string): DetectionResult {
  const markers = [
    "pyproject.toml",
    "setup.py",
    "setup.cfg",
    "requirements.txt",
    "conftest.py",
  ];
  const hasPythonMarker =
    markers.some((m) => fs.existsSync(path.join(repoRoot, m))) ||
    hasConfigFile(repoRoot, /^test_.*\.py$/);

  if (!hasPythonMarker) {
    return { test: null, type: null, lint: null, ecosystem: null };
  }

  return {
    test: { cmd: "python", args: ["-m", "pytest"] },
    type: { cmd: "python", args: ["-m", "mypy", "."] },
    lint: { cmd: "python", args: ["-m", "ruff", "check", "."] },
    ecosystem: "python",
  };
}
