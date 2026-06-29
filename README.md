# AgentLens

> Local-first observability and scoring for AI coding-agent sessions.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](#license)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-252%20passing-brightgreen.svg)](#)

## What is AgentLens

AgentLens instruments AI coding-agent sessions (Claude Code, Cursor, Aider, …): it snapshots your repo before and after an agent works, runs your project's own tests, type-checker, and linter, and computes a **0–100 session quality score** answering whether the session made the codebase better or quietly worse. Everything stays on your machine in local SQLite — no data leaves by default.

## Quickstart

```bash
npx agentlens init          # initialize .agentlens/ in the current repo (or: npm i -g agentlens)
agentlens watch             # auto-record sessions while an agent works
agentlens dashboard         # open the local dashboard (http://localhost:4319)
agentlens dashboard --demo  # explore with synthetic data — no setup required
```

## Features

- **Session Capture** — git-based before/after snapshots and diffs of each agent session.
- **Test · Type · Lint** — auto-detects and runs your project's own test, type-check, and lint commands (pytest, vitest, tsc, eslint, mypy, ruff) and parses the results.
- **Deterministic Scoring** — a transparent, config-weighted 0–100 score; same inputs always yield the same number.
- **Regression Attribution** — `O(log n)` git bisection pinpoints the exact commit that introduced a check regression.
- **Calibrated LLM-as-Judge** — an opt-in qualitative judge, measured against hand-labeled fixtures for reliability.
- **CI Mode** — score a PR/commit and gate the build, with optional sticky PR comments.

## How it works

1. **Snapshot** — capture the repo state (git tree) at the start of a session.
2. **Run Checks** — execute the detected test/type/lint commands and parse pass/fail counts.
3. **Score** — compute the 0–100 quality score from check deltas, regressions, and coverage.
4. **Compare** — diff against the baseline to surface what improved and what regressed.

## CI mode

```bash
agentlens ci --min-score 80              # exit 1 if score < 80 or a critical regression
agentlens ci --base main --comment       # delta vs base ref, post a sticky PR comment
agentlens ci --min-score 80 --no-fail    # report-only: always exit 0
```

The gate exits `0` when the score is at or above `--min-score` (default `70`) and there are no critical regressions, otherwise `1`. Pass `--no-fail` to always exit `0` (report-only). Run `agentlens ci init` to scaffold a starter `.github/workflows/agentlens.yml`.

## Architecture

```
  agent session
       │
       ▼
  ┌─────────┐   reads/writes   ┌──────────────────────────┐
  │   CLI   │ ───────────────▶ │  SQLite                  │
  │agentlens│                  │  .agentlens/agentlens.db │
  └─────────┘                  └──────────────────────────┘
                                          │ serves
                                          ▼
                               ┌──────────────────────────┐
                               │  Dashboard               │
                               │  (Vite static @ :4319)   │
                               └──────────────────────────┘
```

## Demo mode

```bash
agentlens dashboard --demo
```

Launches the dashboard backed by ~36 deterministic, in-memory synthetic sessions (seeded, so screenshots are reproducible). It never reads or writes your real database — handy for trying AgentLens with zero setup.

## Roadmap

- [x] Regression attribution via bisection
- [x] Agent comparison statistics
- [x] Calibrated LLM judge
- [x] Landing page
- [ ] npm publish (next)
- [ ] Opt-in telemetry (next)

## Contributing

Issues and PRs are welcome — please open them on the [project repository](https://github.com/anonymousz77/AgentLens).

## License

MIT
