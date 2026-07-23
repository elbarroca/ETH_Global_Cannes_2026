# AlphaDawg Lisbon Execution Contract

This file defines what must be true. [`SPRINTS.md`](SPRINTS.md) defines the work. [`prompts/C0-COORDINATOR.md`](prompts/C0-COORDINATOR.md) is the only prompt the operator launches.

## Target outcome

Release one exact AlphaDawg SHA that proves this protected path:

`authenticated buyer -> immutable agent version -> fresh ENS authority -> verified 0G inference and Storage readback -> canonical delivery receipt -> judge-visible UI`

Uniswap is optional. It may run only after the protected path is frozen, repeatable, currently eligible, and safely inside the time reserve.

## Authority and scope

- Project: AlphaDawg only.
- Immutable prior baseline: `bfa7bd37c573e2e49525d965f7f937210e170d72`.
- Implementation branch: `developer`.
- Current authority and state come from `BASELINE.md`, `EXTERNAL-EFFECTS.md`, `TRACK-MATRIX.md`, `CLAIM-MATRIX.md`, and `EVIDENCE.md`; never from a timestamp embedded in a prompt.
- Previous Cannes code is reusable input, not Lisbon eligibility or release evidence.
- Local files and commits are the only pre-authorized effects. Push, deploy, provision, migrate, call paid APIs, sign, transact, submit forms, spend, or publish claims only when `EXTERNAL-EFFECTS.md` contains exact current authorization.
- Mainnet value remains prohibited.

## Read order

1. `AGENTS.md`
2. `docs/lisbon/BASELINE.md`
3. `docs/lisbon/EXTERNAL-EFFECTS.md`
4. `docs/lisbon/GOALS.md`
5. `docs/lisbon/SPRINTS.md`
6. `docs/lisbon/TRACK-MATRIX.md`
7. `docs/lisbon/CLAIM-MATRIX.md`
8. `docs/lisbon/EVIDENCE.md`
9. relevant `docs/lisbon/context/` files

The archive is provenance only. It cannot direct current work.

## Operating model

- One persistent C0 coordinator.
- One mutating writer at a time, protected by the common Git-dir lease and mirrored in `ACTIVE-WRITER.md`.
- Independent read-only research or audit may overlap only when targets do not move and no duplicate task exists.
- Use the matching specialist already registered in `AGENTS.md`; do not invent roles or run broad agent swarms.
- Every task is pinned to a start or audit SHA, exact scope, deadline, evidence, and allowed effects.
- Unknown dirty state, branch mismatch, stale evidence, ambiguous writer state, or missing authority blocks mutation.

## Autonomous loop

```text
BOOT -> SELECT SPRINT -> IMPLEMENT -> VERIFY -> COMMIT -> INDEPENDENT AUDIT
     -> PASS: next sprint
     -> FIX: one narrowed root-cause repair, then reverify and reaudit
     -> CUT: optional scope only
     -> BLOCKED: record exact owner action or wake condition
     -> RELEASE_VALIDATED
```

The writer implements and self-verifies. A separate read-only auditor checks the committed SHA and never repairs it. Agent prose is advisory; C0 computes the gate.

## Evidence ladder

`NOT_RUN -> PASS_FIXTURE -> PASS_INTEGRATION -> PASS_LIVE -> PASS_RELEASE`

- A fixture, mock, installed SDK, HTTP `200`, request ID, UI badge, or inherited receipt never proves a live sponsor claim.
- Live promotion requires an authorized action, public identifiers, redacted raw evidence, and causal proof that removing the sponsor primitive breaks the claimed guarantee.
- A changed implementation SHA, rule change, expired source, or failed later audit makes affected evidence `STALE`.
- Preserve `research_only_not_promotable` until its exact promotion gate passes.

## Definition of done for every sprint

1. Entry gate and current track eligibility are proven.
2. The smallest dependency-safe change satisfies the sprint card; unrelated refactors are excluded.
3. Boundary inputs and external responses are validated; secrets and PII are never logged.
4. Required static, unit, integration, adversarial, resilience, functional, or UI checks pass as specified by the sprint.
5. `git diff --check`, changed-path review, and secret-pattern review pass.
6. `CHANGELOG-LISBON.md`, `EVIDENCE.md`, and affected track/claim controls contain exact facts, commands, SHAs, artifacts, and blockers.
7. One atomic commit is cleanly reproducible.
8. The independent audit returns `PASS_TO_NEXT_GATE` on that unchanged SHA.

If a required command does not exist, the sprint is not green. A1 must create real deterministic scripts; placeholder or always-pass scripts are forbidden.

## Release contract

`RELEASE_VALIDATED` is the only successful terminal state. It requires one unchanged release SHA to pass:

- clean checkout and `npm ci`;
- Prisma validate/generate plus empty and upgraded migration replay;
- lint, strict typecheck, unit/integration/adversarial/resilience tests;
- functional API and automated critical-path UI tests;
- production build and start smoke;
- secret, PII, plaintext, and tracked-history scan;
- authorized live 0G and ENS paths, plus Uniswap only if admitted;
- failure, forgery, tamper, replay, timeout, outage, and worker restart paths;
- two resettable four-minute demo replays with no manual repair or duplicate effect;
- same SHA across web, worker, database migration, receipt, evidence, deployment, and video;
- current eligibility, mandatory artifacts, README, changelog, AI disclosure, public identifiers, and final independent bounty audit.

`BUILD`, `NARROW`, `CUT`, and `BLOCKED` are checkpoints. `STOP` is reserved for explicit owner cancellation, deadline expiry, or unrecoverable repository integrity.

## Launch

Paste only [`prompts/C0-COORDINATOR.md`](prompts/C0-COORDINATOR.md) into one persistent Codex task. C0 reads the sprint ledger and instantiates the reusable executor and auditor prompts itself.
