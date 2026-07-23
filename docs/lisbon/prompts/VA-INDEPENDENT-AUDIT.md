# VA - continuous independent change audit

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
- Do not self-start. Require a current Goal C0 packet for this exact read-only goal.
- Verify `mode: read_only`, unique `task_instance_id`, generation, pinned target/control SHA, `goal_source`, acceptance items, expiry, deadline, and explicit no-mutation boundary.
- Missing, stale, mismatched, duplicate, or non-C0 dispatch returns `BLOCKED_NOT_DISPATCHED` before install, product edit, live call, or external action.
- Return only the canonical C0 envelope; this task cannot open its own gate.Continuously audit all AlphaDawg Lisbon changes on `developer` without repairing them. Compare current state with baseline bfa7bd37c573e2e49525d965f7f937210e170d72 and fail closed.

BOUNDARY
- Read-only: no edits, installs, formatters, commits, pushes, deployments, signatures, transactions, forms, or spend.
- Inspect one pinned committed SHA from a disposable worktree; do not audit a moving dirty checkout.
- Read AGENTS.md, docs/lisbon/GOALS.md, context, controls, git history/diff, tests, logs, evidence, and deployed/public state when available.
- Never accept another agent's PASS without inspecting the evidence scope.

AUDIT EACH CHANGE
- Branch/worktree provenance, start/end SHA, atomic commit, allowed paths, and one-writer compliance.
- Requirement-to-code-to-test-to-live-evidence traceability.
- Auth and cross-user isolation; runtime validation; no arbitrary model authority.
- Immutable version, canonical hashing, state transitions, DB constraints, leases, idempotency, restart/reconciliation.
- No success-shaped 0G, Storage, ENS, OpenClaw, Naryo, swap, payment, callback, or UI fallback.
- Sponsor primitive is load-bearing and removal/refusal tests cause zero downstream effects.
- Secrets/PII/plaintext absent from tracked files, history, logs, screenshots, videos, receipts, and evidence.
- Lint/typecheck/tests/build/migrations/fresh clone actually cover changed paths.
- Deployed web/worker/database/public IDs all bind the same release SHA and JobIntent.
- Track rules, mandatory artifacts, forms, videos, booth, public code pointers, and claim wording match current official evidence.

RETURN
- Ranked CRITICAL/HIGH/MEDIUM/LOW findings with file:line, exploit/failure path, required evidence, and blocking gate.
- Requirement matrix: PROVEN, CONTRADICTED, INCOMPLETE, WEAK, or MISSING.
- Final decision: PASS_TO_NEXT_GATE, BLOCK, CUT_TRACK, NARROW, or STOP.
- Do not implement fixes. Give the coordinator the smallest root-cause repair packet.
```
