# Lean Prompt Pack

Current A4-A7 reconciliation and release continuation: launch only [`C0-A4-CONTINUATION.md`](C0-A4-CONTINUATION.md). It reconstructs the observed frontier, passes agent readiness, reconciles A4/A5, then continues through A6/A7.

[`C0-COORDINATOR.md`](C0-COORDINATOR.md) is disabled launch provenance for
the original A0-A7 sequence. It must not dispatch current work.

C0 combines the selected card from [`../SPRINTS.md`](../SPRINTS.md) with:

- [`SPRINT-EXECUTOR.md`](SPRINT-EXECUTOR.md) for the matching sole-writer `agent_type` from `.codex/agents/*.toml`;
- [`SPRINT-AUDIT.md`](SPRINT-AUDIT.md) for the read-only `bounty-auditor` against an immutable SHA.

C0 spawns these Codex project agents directly. The operator never pastes executor/auditor prompts into peer tasks, `.claude/**` never dispatches, and converted source-command skills are workflows rather than agents. Historical prompts under `../archive/` are provenance only.
