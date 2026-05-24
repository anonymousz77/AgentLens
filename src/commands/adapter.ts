import pc from "picocolors";

const AIDER_RECIPE = `
# ─── AgentLens × Aider Integration ──────────────────────────────────────────
#
# RECOMMENDED: Universal wrapper (works with any Aider version)
# ─────────────────────────────────────────────────────────────
# Wrap your aider invocation with \`agentlens run\`. AgentLens captures a
# baseline before aider runs, then diffs/scores/stores the session when it exits.
#
# TEMPLATE — verify aider flags against your installed version:
#   https://aider.chat/docs/usage/options.html

agentlens run --agent aider --task "describe the task here" -- \\
  aider --message "describe the task here" [other aider flags]

# Examples:
#   agentlens run --agent aider --task "fix login bug" -- \\
#     aider --message "fix the login bug" --yes

#   agentlens run --agent aider --task "add unit tests" -- \\
#     aider --message "add unit tests for the auth module"

# If you know the actual token usage after the session, pass it to override
# the diff-based cost estimate:
#   agentlens session end --tokens-in 12000 --tokens-out 3000

# ─── Note on native Aider hooks ──────────────────────────────────────────────
# Aider does not expose a session-lifecycle hook that maps cleanly to AgentLens
# session start/end semantics. The wrapper above is the robust default.
# ─────────────────────────────────────────────────────────────────────────────
`.trim();

const CLAUDE_CODE_RECIPE = `
# ─── AgentLens × Claude Code Integration ────────────────────────────────────
#
# RECOMMENDED: Universal wrapper (works with any Claude Code version)
# ────────────────────────────────────────────────────────────────────────────
# Wrap your claude invocation with \`agentlens run\`. AgentLens captures a
# baseline before claude runs, then diffs/scores/stores the session when it exits.
#
# TEMPLATE — verify claude flags against your installed Claude Code version:
#   claude --help

agentlens run --agent claude-code --task "describe the task here" -- \\
  claude --print "describe the task here" [other claude flags]

# Examples:
#   agentlens run --agent claude-code --task "refactor auth module" -- \\
#     claude --print "refactor the auth module to use JWT"

#   agentlens run --agent claude-code --task "fix failing tests" -- \\
#     claude --print "fix the failing tests in src/auth/"

# ─── Optional: Claude Code hooks (advanced, tool-specific) ───────────────────
# Claude Code supports hooks in ~/.claude/settings.json (or project-level
# .claude/settings.json). You can use PreToolUse/PostToolUse hooks to add
# lightweight instrumentation, but these fire per-tool-call, not per session.
# The wrapper above is simpler for session-level tracking.
#
# TEMPLATE — verify this schema against your installed Claude Code version
# before using. Hook schemas change across releases.
#
# ~/.claude/settings.json:
# {
#   "hooks": {
#     "Stop": [
#       {
#         "matcher": "",
#         "hooks": [
#           {
#             "type": "command",
#             "command": "agentlens session end"
#           }
#         ]
#       }
#     ]
#   }
# }
#
# If using hooks, start the session manually first:
#   agentlens session start --agent claude-code --task "your task"
#   claude [flags]
#   # hook fires agentlens session end on Stop
# ─────────────────────────────────────────────────────────────────────────────
`.trim();

const GENERIC_RECIPE = (tool: string) => `
# ─── AgentLens × ${tool} Integration ─────────────────────────────────────────
#
# Universal wrapper — works with any CLI agent tool
# ─────────────────────────────────────────────────
# Wrap your ${tool} invocation with \`agentlens run\`. AgentLens captures a
# baseline before ${tool} runs, then diffs/scores/stores the session when it exits.
#
# TEMPLATE — adapt flags to match your tool's CLI:

agentlens run --agent ${tool} --task "describe the task here" -- \\
  ${tool} [flags and arguments]

# If you know the actual token usage after the session, pass it to override
# the diff-based cost estimate:
#   agentlens session end --tokens-in <n> --tokens-out <n>

# For tool-specific hook integration, consult your tool's documentation
# and verify any hook schema against your installed version.
`.trim();

/**
 * Returns a clearly-commented integration recipe for the given agent tool.
 * This is a pure function, suitable for testing.
 */
export function generateAdapterRecipe(tool: string): string {
  switch (tool) {
    case "aider":
      return AIDER_RECIPE;
    case "claude-code":
      return CLAUDE_CODE_RECIPE;
    default:
      return GENERIC_RECIPE(tool);
  }
}

export function runAdapter(cwd: string, tool: string): void {
  const recipe = generateAdapterRecipe(tool);

  const supportedTools = ["aider", "claude-code"];
  if (!supportedTools.includes(tool)) {
    console.log(
      pc.yellow(`Unknown tool "${tool}". Showing generic recipe.`) +
        ` Supported: ${supportedTools.join(", ")}\n`
    );
  }

  console.log(recipe);
  console.log();
  console.log(
    pc.dim(
      "Run `agentlens run --help` for full wrapper options.\n" +
        "Run `agentlens sessions` to view recorded sessions."
    )
  );

  void cwd; // cwd reserved for future --write support
}
