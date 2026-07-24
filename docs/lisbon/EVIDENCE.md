# Lisbon Evidence Ledger

Status: `research_only_not_promotable`

## Baseline

- Commit: `bfa7bd37c573e2e49525d965f7f937210e170d72`
- Tree: `f39cc7e865d8e3ffaa02ea3e2397cee1bbed8c0a`
- Lock SHA-256: `b4a1aed30a52a74d1b4396da9f1d6535a5e475da1b40a99a6c744aae1a8c6b33`
- Prior showcase: `https://ethglobal.com/showcase/alpha-dawg-fh6vm`

## Entry schema

```text
evidence_id:
gate:
release_sha:
observed_at_utc:
environment_or_network:
command_or_action:
expected:
observed:
public_identifiers:
artifact_paths:
redactions:
status: PASS | FAIL | BLOCKED
```

| Evidence ID | Gate | State | Evidence |
|---|---|---|---|
| `A0-BASELINE-001` | Baseline | `PASS` | `BASELINE.md` and Git object/hash checks. |
| `A0-AUTH-001` | Local start | `PASS_LOCAL_ONLY` | Thread authorization; external effects remain denied. |
| `A0-LOCAL-BUILD-ADMISSION-005` | A0_LOCAL | `PASS` | Git provenance, local project-owner authority, and atomic writer serialization admit A1 and authorize later A2/offline A3 after their sequential prerequisites pass. Independent states are `LOCAL_BUILD_AUTHORIZED`, `RELEASE_BLOCKED`, and `LIVE_EFFECT_BLOCKED`. Exact packet: `evidence/A0-LOCAL-BUILD-ADMISSION.md`. |
| `A0-LOCAL-ADMISSION-AUDIT-006` | Independent audit | `FIX` | Audit of `36783c69f249387943f6f4b89286e2b27660337e` found that `prompts/C0-COORDINATOR.md` still blocked A1 on release-only gaps and that the first evidence packet overstated its stale-language check. |
| `A0-LOCAL-ADMISSION-REMEDIATION-007` | A0 remediation G1 | `PASS_TO_AUDIT` | The stale C0 gate now uses the exact A0_LOCAL split; the first check is corrected to `FAIL`, and all active non-archive Lisbon controls/prompts pass the contradiction scan. Exact repair evidence is appended to `evidence/A0-LOCAL-BUILD-ADMISSION.md`. |
| `A0-PROMPT-001` | Historical prompt pack | `PASS_SUPERSEDED` | The former all-in-one contract and 12 split prompts passed their original checks; `A0-PROMPT-LEAN-002` replaces this architecture. |
| `A0-PROMPT-LEAN-002` | Lean prompt pack | `PASS` | `GOALS.md` is the canonical contract, `SPRINTS.md` defines A0-A7, and `prompts/` contains only C0 plus reusable executor/auditor templates. Nine-file Markdown links/fences, sprint/header coverage, deleted-prompt reference checks, `git diff --check`, added-line secret patterns, and physical/mirrored lock-token equality passed. Independent read-only audit findings were reconciled. |
| `A0-LOCK-001` | Writer serialization | `PASS` | Atomic common-dir lease exists; physical and mirrored tokens match. |
| `A0-AUDIT-001` | Independent prompt audit | `PASS` | Concurrency, live-probe, naming, and lock-mirror findings reconciled; independent result was `PASS_IF_A0_CLOSED`; A0 content commit `41325b6564c338d8b681c2756228add3a7b4dac3` satisfied the condition. |
| `A0-ARCHIVE-001` | Repo-local context | `PASS` | All 244 research-vault files mirrored byte-for-byte and indexed in `ALPHADAWG-FILE-MANIFEST.csv`; 1,033 internal file links resolve; two preserved stale heading names have repo-local redirects in `ALPHADAWG-FILE-MAP.md`; the only two direct root-level research files were archived safely. |
| `A0-MIRROR-001` | Internal accessibility | `PASS` | Content commit `11de852d0ca89563634f0512b45f1ca987670447`; exact results in `evidence/A0-CONTEXT-MIRROR-VALIDATION.md`; independent read-only audit returned `PASS_IF_COMMITTED_AND_LOCK_RELEASED`. |
| `A0-MIRROR-AUDIT-002` | Mirror post-commit audit | `BLOCKED` | Final SHA `2adaa1c165cdb76a762acea1e9177ba08cd65558` was clean and hash/link/lock checks passed, but full-range `git diff --check` found 156 source whitespace defects inside the intentionally byte-preserved archive. Acceptance is repaired by hash-verifying the archive and whitespace-checking authored controls separately; re-audit required. |
| `A0-LIVE-AUTHORITY-002` | Live rules/authority | `BLOCKED_SUPERSEDED_IN_PART` | The historical local-H0 conclusion is superseded by `A0-CONTINUITY-CLARIFICATION-004`; rights/license/team/owners/access remain incomplete. Exact historical ledger: `evidence/A0-LIVE-RECONCILIATION.md`. |
| `A0-EXIT-AUDIT-002` | Historical A0 release audit | `BLOCKED_SUPERSEDED_FOR_LOCAL_ADMISSION` | The pinned audit of `b000ba993e753a580f2c0b09d4fec8f0eac8d337` predates local admission. Its remaining clearance, evidence, handoff, and privacy findings block release/claims, not safe local A1/A2/offline A3. |
| `A0-LIVE-RECONCILE-003` | Historical live authority and probe reconciliation | `BLOCKED_SUPERSEDED_FOR_LOCAL_ADMISSION` | Content commit `fa8bebbc624599f7ef1277a2a466ef72863b3142` records A0/P0/E0/U0 and the archive acceptance repair. Its unresolved items remain release/claim/live-effect gates, not a later-writer gate. |
| `A0-CONTINUITY-CLARIFICATION-004` | Local Continuity timing | `PASS_LOCAL_ONLY` | Project-owner clarification and current official rules clear H0 as a local Continuity-build blocker. Pre-H0 work remains disclosed prior/pre-window work, not Lisbon-window evidence. Rights/license/team/access/static integration and independent release-audit gaps remain release/claim/live blockers only. Exact packet: `evidence/A0-CONTINUITY-CLARIFICATION.md`. |
| `A1-FOUNDATION-001` | Foundation | `PASS_LOCAL_ONLY; AUDIT_FIX` | Commit `c2359f766e61ea0d5b8735992de971101ee962bd` passed the local engineering gate, but independent audit found four documentation/test/UI gaps requiring the single permitted remediation generation. |
| `A1-FOUNDATION-PREFLIGHT-002` | Foundation preflight | `FAIL_SUPERSEDED` | Historical preflight exposed 23 lint errors, 28 warnings, and a missing test script. A1 repaired every error and supplied real tests; 23 warnings remain explicit but do not fail lint. |
| `A1-FOUNDATION-AUDIT-003` | Independent audit | `FIX` | Canonical setup still used `prisma:push`; the synthetic sentinel was not hash-compared; inherited Cannes bounty claims read as current; malformed no-anchor timestamps rendered epoch zero. |
| `A1-FOUNDATION-REMEDIATION-004` | A1 remediation G1 | `PASS_TO_AUDIT` | Canonical migration setup, exact pre/post sentinel SHA-256 equality, inherited-claim labeling, and unavailable no-anchor timestamps are repaired. Exact findings, boundary, and full rerun: [`evidence/A1-DETERMINISTIC-FOUNDATION.md`](evidence/A1-DETERMINISTIC-FOUNDATION.md). |
| `A1-REMEDIATION-AUDIT-005` | A1 remediation audit | `FIX_RELEASE_CLAIM_DRIFT` | Engineering checks and the exact sentinel replay passed, but independent audit found the first-viewport README `~$27K Target Pool` wording still unqualified. It remains outside A2 scope and blocks release/claim promotion only. |
| `A2-AUTHENTICATED-KERNEL-001` | Authenticated commerce kernel | `PASS_TO_AUDIT; LOCAL_ONLY` | Canonical SIWE, hash-only sessions, DB-only onboarding, immutable agent versions, atomic 20-way idempotency, deterministic effect/recovery, exclusive outcomes, singleton four-slot worker, protected boot, and full cold gate pass locally. Production execution remains `A3_NOT_CONFIGURED`; exact packet: [`evidence/A2-AUTHENTICATED-KERNEL.md`](evidence/A2-AUTHENTICATED-KERNEL.md). |
| `P0-0G-001` | 0G compatibility | `FAIL` | Current Compute response binding is fail-open and Storage SDK `1.2.10` ignores proof-enabled download. Live subgate `BLOCKED`; no Lisbon live ID. |
| `P0-0G-002` | 0G proof-path refresh | `PASS_STATIC_PATH; LOCAL_A3_AUTHORIZED; LIVE_EFFECT_BLOCKED` | Official Go client `v1.3.0` verifies segment proofs and the final file root. The current TS SDK still ignores proof, no Go verifier is integrated, and Compute content remains unbound; those are offline A3 implementation work, while live use and claim promotion remain blocked. Exact packet: `evidence/P0-0G-PROOF-PATH-REFRESH.md`. |
| `E0-ENS-001` | ENS compatibility | `PASS` | Stable viem/Registry/Public Resolver/Universal Resolver path passed live reads and local-fork refusal tests; public write subgate `BLOCKED`; direct ENSv2 `BLOCKED`. |
| `U0-UNISWAP-001` | Uniswap admission | `PASS` | `ADMIT_STACK_CONTINUITY` only for a reusable upstream Node 22 ESM SDK fix; existing Arc/custom-router path rejected; optional writer remains closed. |

HTTP `200`, a database flag, UI badge, inherited receipt, or mock is not terminal evidence.

## A0 verification scope

This gate changed documentation and control state only. The first commit ran Markdown structure/link, exact status-vocabulary, common-dir lock/token, branch/baseline/remote, changed-line secret-pattern, and authored-control `git diff --check` checks. Its stale-A1 check was too narrow and missed `prompts/C0-COORDINATOR.md`; independent audit returned `FIX`. Remediation G1 checks every active non-archive Lisbon control/prompt for the contradiction. The intentionally byte-preserved `docs/lisbon/archive/research-vault/**` corpus remains excluded from authored-control checks. Application lint, typecheck, tests, build, and migrations were not run by that A0 correction; current A1 evidence follows below. Live sponsor smokes remain `NOT_RUN` and blocked.

## A1 verification scope

A1 adds the deterministic local engineering foundation and is `PASS_LOCAL_ONLY`. Its migration upgrade test is explicitly synthetic Cannes-shaped because no live dump or prior migration history was available. The production build uses a deliberately non-live public Dynamic UUID, and database schema commands use non-connecting loopback placeholders; neither is sponsor or shared-system evidence. The effectful legacy `npm run validate` command was not executed. npm's inherited audit findings and every release, claim, live sponsor, managed-database, push, deployment, signature, transaction, form, spend, and mainnet gate remain outside A1 and fail closed.

The remediation audit subsequently found one README banner claim-drift issue. This does not invalidate the proven local engineering checks or block authorized A2 work, but it remains release/claim-blocking and is not silently repaired under A2.

## A2 verification scope

A2 is `PASS_TO_AUDIT; LOCAL_ONLY`. Its PostgreSQL clusters, EOA signatures, concurrency, kill/restart, and adapter results are deterministic local fixtures. Protected startup performs no sponsor call, and production adapter execution terminates `A3_NOT_CONFIGURED`. No live browser signature, external effect, shared database, public identifier, or sponsor proof was obtained. Details and exact counts are in [`evidence/A2-AUTHENTICATED-KERNEL.md`](evidence/A2-AUTHENTICATED-KERNEL.md).

## Downstream boundary

`A0_LOCAL` opened Goal A1. A1's proven local engineering gate opened A2. A2 may open offline A3 only after independent audit accepts this packet. Rights/license/team/owner gaps, required access and caps, event-window evidence, live P0 proof, inherited README claim drift, and independent release audit remain `RELEASE_BLOCKED`, claim-blocked, or `LIVE_EFFECT_BLOCKED`. Pre-H0 work remains disclosed prior/pre-window work and cannot be classified as Lisbon-window evidence.
