# A2R - cleanup, Crawbot/OpenClaw isolation, and measured optimization writer

Copy the block into a dedicated Codex project/thread.

```text
/goal

PROJECT PACKET
- project_id: alphadawg
- repo_root: resolve with `git rev-parse --show-toplevel`
- baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
- branch: developer
- read_first: AGENTS.md, docs/lisbon/README.md, docs/lisbon/BASELINE.md, docs/lisbon/ALPHADAWG-FILE-MAP.md, docs/lisbon/context/README.md, docs/lisbon/context/RUNBOOK.md, docs/lisbon/context/MASTER.md, docs/lisbon/GOALS.md
- writer_lock_mirror: docs/lisbon/ACTIVE-WRITER.md
- atomic_lease: <git-common-dir>/alphadawg-lisbon-writer.lock
- external_effects: denied unless the exact row in docs/lisbon/EXTERNAL-EFFECTS.md is AUTHORIZED
- evidence: docs/lisbon/EVIDENCE.md and docs/lisbon/evidence/
- no live identifier, no live claim
Own the sole writer slot for the post-A2 cleanup gate. Remove dead or unsafe critical-path behavior, isolate OpenClaw/Crawbot legacy surfaces, and optimize only measured demo bottlenecks without changing the A2 contract.

PRECONDITIONS
- A1 and A2 pass.
- Claim ACTIVE-WRITER with exact cleanup paths. Do not overlap Goal A3.
- Search all callers before deleting or moving anything. Preserve useful Cannes code outside the Lisbon runtime.

CLEANUP AND SHARED RUNTIME
- Prove whether Crawbot exists. If it does not, record `NO_CRAWBOT_INTEGRATION_FOUND`; do not invent work.
- Require authentication for any retained OpenClaw gateway; missing token fails closed.
- Make the Lisbon worker boot and complete local fixtures with OpenClaw, Telegram, Naryo, payment, trading, and per-agent servers disabled.
- Implement one shared long-running worker that claims PostgreSQL jobs by immutable `agentVersionId`, short leases, `FOR UPDATE SKIP LOCKED` or the existing safe equivalent, bounded concurrency, heartbeat, and expired-lease recovery.
- The worker loads frozen schemas/policy by version and invokes fixed allowlisted adapters. It never launches one server/container per marketplace agent.
- Remove success-shaped fallbacks: provider failure, swap failure, fake callbacks, local signals, or cached flags cannot become verified completion.
- Remove/repair dead scripts, stale config, generated tracked artifacts, and duplicate code only when call/reference evidence supports it.

OPTIMIZE
- Measure install/build time, API validation/quote p95, queue claim p95, worker heartbeat/recovery, and demo cold start first.
- Fix only bottlenecks that threaten the four-minute demo or reliability. No Redis, generic plugin framework, new cache layer, or broad UI rewrite without measurement.
- Keep accessibility, error states, structured redacted logs, and deterministic reset behavior.

VERIFY
- legacy-disabled boot
- four simultaneous fixture jobs through one shared worker and one version-bound execution path
- worker kill/restart reclaims expired leases with zero duplicate terminal effects
- auth-required OpenClaw probe
- failure paths produce zero success receipts/effects
- baseline regression checks
- before/after measurements on the same SHA/environment
- lint, typecheck, tests, build

EXIT
- Atomic `refactor:` or `fix:` commit, evidence/changelog, release ACTIVE-WRITER.
```
