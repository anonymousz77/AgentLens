# AgentLens — Project Specification

> Master spec for the AgentLens build. Self-contained. This is the source of truth for scope, architecture, data model, and build order. Working name is **AgentLens**; rename freely.

---

## 1. What this is

AgentLens is an open-source, local-first CLI tool plus dashboard that instruments AI coding-agent sessions (Claude Code, Cursor, Aider, Copilot agents, etc.). Every time an agent works on a codebase, AgentLens snapshots the repo before and after, runs the project's existing test suite, type-checker, and linter, then computes a **session quality score** answering one question: *did this agent session make the codebase better or quietly worse?* It tracks regressions, test pass-rate deltas, coverage deltas, and token/cost per task, and surfaces everything in a local web dashboard. It is language-agnostic on the host side: because it runs the *project's own* test command, it works for Python, Go, Rust, or TypeScript codebases equally.

## 2. The problem

AI coding agents generate large volumes of code fast. Teams adopt them with zero visibility into whether a given session improved or degraded the codebase. The failure mode is silent: an agent "fixes" something, tests appear to pass locally, but coverage dropped, a type error was suppressed, or an unrelated module broke. There is no "Sentry for coding agents" — no standard way to measure agent output quality, catch regressions a session introduced, or track what each task cost. AgentLens makes agent work measurable and accountable.

**Target users:** individual developers using coding agents daily, and small teams adopting agents who need quality/cost guardrails.

## 3. Product priorities (these shape every decision)

Value comes from public, verifiable traction, not internal cleverness. The metrics that matter: GitHub stars, npm download count, real issues filed by strangers, and (opt-in) total sessions tracked across users. Every product decision therefore optimizes for:

- **Trivial installation** — `npx agentlens`, zero-config first run.
- **Instant first-run value** — a user sees a real score on their own repo within 60 seconds.
- **Shareability** — clean dashboard, demo-able output, copy-pasteable results.

Building the tool is ~30% of the work. Docs, landing page, demo GIF, and distribution are the other 70%.

## 4. Core features

### MVP (ship first, fully working)

- **`agentlens watch`** — wraps/monitors an agent session. Detects when the agent starts and stops modifying files; snapshots the git working tree before and after.
- **Test/check orchestration** — auto-detects and runs the project's test command, type-checker, and linter; captures pass/fail counts, coverage %, type errors, lint errors, and runtime.
- **Session diff capture** — records the exact diff the session produced (files changed, +/- lines).
- **Session quality score** — single 0–100 score combining test pass-rate delta, coverage delta, type-error delta, lint-error delta. Regressions (green→red) weighted heavily.
- **Regression detection & alerts** — explicit list of "this session broke X" with the relevant diff hunk.
- **Cost/token tracking** — parse the agent's usage logs where available (Claude Code emits usage; others vary), else estimate from diff size; show tokens and $ per session.
- **Local dashboard** — local web UI: timeline of sessions, per-session score, diff viewer, test results, regressions, cost. Launched via `agentlens dashboard`.
- **Local-first storage** — everything in a local SQLite DB. No data leaves the machine by default.

### Post-MVP (depth — add after MVP works)

- **LLM-as-judge layer** — optional, configurable judge scoring diff *quality* (readability, scope creep, task match). Must be calibrated: validate scores against a hand-labeled set, report agreement, expose confidence.
- **CI mode** — `agentlens ci` runs on a PR (especially agent-authored PRs), posts score + regressions as a check. This is the feature that drives team adoption.
- **Adapters** — first-class hooks for tools that expose them (Claude Code hooks, Aider) for richer signal, with the git/filesystem method as the universal fallback.
- **Opt-in anonymous telemetry** — to publish "N sessions tracked across M users." Transparent, off-by-default-with-prompt.

## 5. System architecture

```
+-------------------+        +------------------------+
|  Coding agent      |       |  AgentLens CLI (core)   |
|  (Claude Code,     |       |                         |
|   Cursor, Aider…)  |       |  - session lifecycle    |
+---------+----------+       |  - git snapshot/diff     |
          | modifies files   |  - runner orchestration  |
          v                  |  - scoring engine        |
+-------------------+        |  - cost parser           |
|   Git working tree | <----- |  - (opt) LLM judge       |
+-------------------+        +-----------+------------+
                                          |
                                          v
                              +-----------------------+
                              |  SQLite (local)        |
                              |  sessions, diffs,       |
                              |  results, scores        |
                              +-----------+-----------+
                                          |
                                          v
                              +-----------------------+
                              |  Local web dashboard   |
                              |  (React, served by CLI) |
                              +-----------------------+
```

**Data flow:** CLI detects session boundaries → snapshots HEAD/working tree → after the session, computes git diff → runs test/type/lint commands in a controlled subprocess, parsing structured output → computes deltas vs the pre-session baseline → writes a session record to SQLite → dashboard reads SQLite and renders.

## 6. Tech stack (decisions)

- **Engine + CLI: TypeScript / Node.js.** npm is the largest distribution channel for dev tools (`npx agentlens` = zero-install trial), one language spans CLI and dashboard, and the contributor pool is large. The host project can be any language — AgentLens runs the project's own test command, so this choice does not limit users.
- **Dashboard: React + Vite**, served locally by the CLI. Fast dev/build, simple static output the CLI can serve.
- **Storage: SQLite via `better-sqlite3`.** Zero-config, local-first, synchronous and fast for this workload. No server to run.
- **Diffing: git plumbing** (`git diff`, tree snapshots). Git is present in every target repo; reusing it is robust and tool-agnostic.
- **Test runner orchestration: subprocess execution** of auto-detected commands (pytest, jest/vitest, go test, cargo test) with per-framework output parsers.
- **LLM judge (optional): provider-agnostic client with caching**, supporting hosted and local models, to avoid lock-in, control cost, and allow privacy-sensitive local runs.

## 7. Data model (SQLite tables)

- `sessions`: id, repo_path, agent_name, started_at, ended_at, git_base_sha, git_head_sha, score, tokens, cost_usd, notes
- `diffs`: id, session_id, files_changed, lines_added, lines_removed, patch (text)
- `checks`: id, session_id, kind (test|type|lint|coverage), passed, failed, total, coverage_pct, runtime_ms, raw_output
- `regressions`: id, session_id, description, file, hunk, severity
- `judge_scores` (post-MVP): id, session_id, dimension, score, confidence, rationale

## 8. Instrumentation (core engineering)

Reliably knowing what the agent did and whether it helped, across tools that work differently:

1. **Baseline capture:** on `watch` start, record git SHA, run the full test/type/lint suite once to establish the baseline (cache it so repeated sessions are cheap).
2. **Session boundary detection:** detect activity via filesystem watchers + git status polling; a session ends after a quiet period or an explicit stop. Handle messy cases: agent runs its own tests mid-session, partial saves, uncommitted state.
3. **Post-session evaluation:** recompute checks, diff against baseline, compute deltas, attribute regressions to specific diff hunks where possible.
4. **Robustness requirements:** must not corrupt the user's repo, must handle missing test commands gracefully, must be fast enough not to annoy.

## 9. Scoring / evaluation engine

Transparent, defensible formula — not a black box:

- Start at 100.
- Test regressions (green→red): heavy penalty per test.
- New failures / build break: heavy penalty.
- Coverage delta: proportional reward/penalty.
- Type-error and lint-error deltas: moderate.
- (Post-MVP) LLM-judge quality dimensions blended in only after calibration.

Document the weights and let users configure them.

## 10. Metrics

**Reported to users (screenshot these in the README):** session quality score distribution, regressions caught, test pass-rate and coverage deltas over time, cost/tokens per session and trend, time-to-evaluate.

**Project traction metrics (track and display on the repo):** GitHub stars, npm weekly downloads, contributor count, open/closed issues from real users, and (opt-in) total sessions tracked across all users.

## 11. Build order (ship each phase end-to-end before the next)

1. **Phase 0 — Skeleton:** TS monorepo, CLI scaffold, SQLite layer, `agentlens init`.
2. **Phase 1 — Capture:** git baseline + snapshot + diff for a single manual session. Record one session's diff to SQLite.
3. **Phase 2 — Checks:** detect & run test/type/lint for at least 2 ecosystems (pytest + vitest), parse results, store deltas.
4. **Phase 3 — Scoring + regressions:** score formula and regression attribution.
5. **Phase 4 — Dashboard:** React UI reading SQLite — timeline, session detail, diff viewer, charts. This is the demo; make it clean.
6. **Phase 5 — Cost tracking + `watch` automation** (auto session boundaries).
7. **Phase 6 — Polish + package:** `npx agentlens`, README with demo GIF, docs.
8. **Phase 7 — Depth features:** calibrated LLM judge, CI mode, adapters, opt-in telemetry.

Ship Phases 0–6 as a complete, usable v1 before touching Phase 7.

## 12. Deployment & distribution

- Publish to **npm** (runnable via `npx`), repo on **GitHub** with CI, a docs site (Docusaurus or simple static site), and a one-page landing site with the demo GIF and install command.
- The README is the product: hero GIF, one-line install, "what problem this solves," dashboard screenshots, real metrics, 60-second quickstart.

## 13. Traction plan

- Polished README + animated demo GIF + live dashboard screenshot.
- Launch posts where developers are (dev communities, Show-HN-style posts, relevant subreddits, X/LinkedIn dev circles), framed around the pain.
- Respond to every issue fast; ship small improvements weekly; add a CONTRIBUTING guide.
- Add opt-in telemetry to later report "tracked N sessions across M developers."

## 14. Stretch goals

Team mode with shared history, a hosted version (open-core), a public "agent quality leaderboard," more language ecosystems, IDE-panel integration, per-task regression bisection.
