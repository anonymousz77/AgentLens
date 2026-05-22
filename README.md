# AgentLens

> Observability & evaluation for AI coding agents. *Did this agent session make your codebase better or quietly worse?*

AgentLens snapshots your repo before and after an AI coding agent works, runs your project's own tests + type-checker + linter, and computes a **0–100 session quality score** — flagging regressions, coverage drops, and cost per task. Local-first: everything stays on your machine in SQLite.

> 🚧 Early development. Phase 0 (skeleton) complete.

## Quickstart (dev)

```bash
npm install
npm run build
node dist/index.js init     # initializes .agentlens/ in the current repo
```

## Roadmap

- [x] Phase 0 — Skeleton + `agentlens init`
- [ ] Phase 1 — Session capture (git diff)
- [ ] Phase 2 — Test/type/lint orchestration
- [ ] Phase 3 — Scoring + regression detection
- [ ] Phase 4 — Local dashboard
- [ ] Phase 5 — Cost tracking + `watch` automation
- [ ] Phase 6 — Packaging + docs
- [ ] Phase 7 — LLM judge, CI mode, adapters

## License

MIT
