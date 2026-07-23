# A2R - cleanup, Crawbot/OpenClaw isolation, and measured optimization writer

C0-owned task template. Do not launch it manually.

```text
/goal

PROJECT PACKET
- project_id: alphadawg
- repo_root: resolve with `git rev-parse --show-toplevel`
- baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
- branch: developer
- dispatcher: Goal C0 only
- dispatch_capability: required; C0 supplies task_instance_id, generation, dispatch/target/control SHA, goal source, dependencies, deadline, acceptance items, and retry budget
- writer_admission: sole writers additionally require admitted_at_sha, prerequisite digest, allowed paths, and unconsumed single-use admission
- read_first: AGENTS.md, docs/lisbon/README.md, docs/lisbon/BASELINE.md, docs/lisbon/ALPHADAWG-FILE-MAP.md, docs/lisbon/context/README.md, docs/lisbon/context/RUNBOOK.md, docs/lisbon/context/MASTER.md, docs/lisbon/GOALS.md
- writer_lock_mirror: docs/lisbon/ACTIVE-WRITER.md
- atomic_lease: <git-common-dir>/alphadawg-lisbon-writer.lock
- external_effects: denied unless exact current project-owner authorization passes
- evidence: docs/lisbon/EVIDENCE.md and docs/lisbon/evidence/
- canonical_return_envelope: required by C0
- no live identifier, no live claim

DISPATCH GUARD
- Do not self-start. Require a current single-use Goal C0 packet for this exact goal.
- Verify `mode: sole_writer`, unique `task_instance_id`, generation, `dispatch_sha`, target/control SHA, `goal_source`, `admitted_at_sha` equal to current admitted HEAD, prerequisite verdict digest, exact allowed paths, deadline, and unconsumed admission.
- Missing, stale, mismatched, reused, non-C0, or already-terminal admission returns `BLOCKED_NOT_DISPATCHED` before lease acquisition, edit, install, command, or external action.
- Return only the canonical C0 envelope; this task cannot open its own gate.Own the sole writer slot for the post-A2 cleanup gate. Remove dead or unsafe critical-path behavior, isolate OpenClaw/Crawbot legacy surfaces, and optimize only measured demo bottlenecks without changing the A2 contract.

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
