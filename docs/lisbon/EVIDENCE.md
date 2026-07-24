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
| `A0-PROMPT-LEAN-002` | Lean prompt pack | `PASS_SUPERSEDED_BY_A3_CONTINUATION` | At acceptance, `GOALS.md` was the canonical contract and `prompts/` contained the original C0 plus reusable executor/auditor templates. The post-A3 continuation entry below supersedes only the launch prompt, not the contract or templates. |
| `A3-CONTINUATION-PROMPT-007` | Post-A3 continuation control | `PASS_DOCS_ONLY` | `prompts/C0-A4-CONTINUATION.md` preserves independently accepted A0-A3 state, starts A4 from exact engineering SHA `9a4f41f8c679469dc230cba584bce84fcc3c65e5`, enumerates remaining setup and A4-A7 gates, and keeps every live/release effect fail-closed. The original C0 remains provenance. |
| `R0-CODEX-AGENT-READINESS-008` | Codex agent and prompt readiness | `PASS_TO_AUDIT; LOCAL_ONLY` | Nine Codex-native agents give every protected domain one owner; two source commands are converted into bounded Codex skills; current paths, installed versions, commands, official Lisbon rules, and ENS static guidance are reconciled. Exact packet: [`evidence/R0-AGENT-READINESS.md`](evidence/R0-AGENT-READINESS.md). |
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
| `A2-AUTHENTICATED-KERNEL-001` | Authenticated commerce kernel | `PASS_LOCAL_ONLY; AUDIT_FIX` | Original exit `2f623a25fbbf4d226657a439a3ed3bbf47cfc7a7` passed its local gate, but independent audit found stale-worker claim fencing, retry/cancellation effect terminality, auth-action, malformed-cookie, and evidence-precision defects. |
| `A2-AUTHENTICATED-KERNEL-AUDIT-002` | Independent A2 audit | `FIX` | A stale worker could persist/finalize after lease takeover; transient requeue plus queued cancel could refund with a nonterminal effect; authenticate action could onboard; malformed percent cookies could throw. |
| `A2-AUTHENTICATED-KERNEL-REMEDIATION-003` | A2 remediation G1 | `PASS_REAUDIT; LOCAL_ONLY` | Owner+epoch+claim-version+expiry fencing guards every worker mutation; expired-version reconciliation is separate; heartbeat loss suppresses terminal persistence; retry cancellation terminalizes its effect; SIWE action separation, fresh authenticate user resolution, and malformed-cookie refusal pass. The independent re-audit accepted control SHA `dd336b840edb4de97fc382298c5a0c0c658f6f9f` before A3 opened. Exact packet: [`evidence/A2-AUTHENTICATED-KERNEL.md`](evidence/A2-AUTHENTICATED-KERNEL.md). |
| `P0-0G-001` | Historical 0G compatibility | `FAIL_SUPERSEDED_BY_A3_OFFLINE` | At observation time, Compute response binding was fail-open and Storage SDK `1.2.10` ignored proof-enabled download. A3 repairs the offline product path; live remains blocked with no Lisbon live ID. |
| `P0-0G-002` | 0G proof-path refresh | `PASS_STATIC_PATH; SUPERSEDED_BY_A3_OFFLINE; LIVE_EFFECT_BLOCKED` | Official Go client `v1.3.0` identified the proof-capable path later integrated by A3. This historical static result never constituted live proof. Exact packet: `evidence/P0-0G-PROOF-PATH-REFRESH.md`. |
| `A3-STRICT-0G-001` | Strict 0G fixture | `PASS_FIXTURE; AUDIT_FIX; LOCAL_ONLY` | Deterministic signed Compute content is byte-bound to accepted output, stored, and read back through the actual strict Go subprocess fixture. Twenty duplicate submissions converge to one effect and one lawful receipt/settlement/commission. The immutable-SHA audit of `879072a728f0bec7a4b7a541594a7920cd815d69` required remediation. |
| `A3-STRICT-0G-002` | Strict 0G integration | `PASS_INTEGRATION; AUDIT_FIX; LOCAL_ONLY` | The original staged journal, fencing, no-blind-retry, proof path, and negative matrix passed locally, but the independent audit found live-authority, post-readback recovery, subprocess cleanup/bounds, canonical deadline, and end-to-end process-failure gaps. |
| `A3-STRICT-0G-LIVE-003` | Strict 0G live | `NOT_RUN; LIVE_EFFECT_BLOCKED` | Production A3 live execution is now unconditionally unavailable regardless of environment values. No provider/indexer/RPC call, funding action, upload, proof-enabled live readback, spend, transaction, or public identifier was authorized or produced. |
| `A3-STRICT-0G-AUDIT-004` | Independent A3 audit | `FIX_REQUIRED` | Audit of `879072a728f0bec7a4b7a541594a7920cd815d69` found conditional production live authority, adapter invocation after durable readback, immediate SIGKILL and incomplete temp cleanup/bounds, incomplete canonical-deadline propagation, and subprocess failures not proven through the whole worker path. |
| `A3-STRICT-0G-REMEDIATION-005` | A3 remediation G1 | `PASS_REAUDIT; LOCAL_ONLY` | Production live construction/imports are removed and retired authority settings are rejected; immutable readback finalizes before adapter construction and before attempt exhaustion; Node owns/cleans per-call temp trees with cooperative bounded termination; Go applies `RLIMIT_FSIZE` before official proof download; canonical deadlines abort stalled Compute/signature work; full process failures remain terminal with refund only. Twelve focused A3 tests, three Go tests/build, combined integration 17/17, both migration lanes, and the complete cold gate pass. Exact packet: [`evidence/A3-STRICT-0G.md`](evidence/A3-STRICT-0G.md). |
| `A3-STRICT-0G-REMEDIATION-AUDIT-006` | Independent A3 remediation re-audit | `PASS_A3_REMEDIATION; LOCAL_ONLY` | Independent read-only audit accepted exact SHA `9a4f41f8c679469dc230cba584bce84fcc3c65e5`: production live authority is absent; verified readback recovers before adapter construction and attempt exhaustion; subprocess termination, cleanup, and kernel file bounds are enforced; canonical deadlines reach every operation; and process failures are proven end to end. The auditor repeated Go, Prisma, environment, lint/typecheck, foundation/auth/kernel/A3/integration/migration/e2e/resilience/redaction/boot/secret/shell/build gates with no blocking finding. |
| `E0-ENS-001` | ENS compatibility | `PASS` | Stable viem/Registry/Public Resolver/Universal Resolver path passed live reads and local-fork refusal tests; public write subgate `BLOCKED`; direct ENSv2 `BLOCKED`. |
| `A4-ENS-AUTHORITY-002` | Stable ENS authority fixture and integration | `PASS_FIXTURE; PASS_INTEGRATION; PASS_TO_AUDIT; LOCAL_ONLY` | Exact `viem@2.47.6`, immutable canonical effect binding, append-only claim-fenced checks, per-remaining-operation A3 resolution, fresh pre-delivery resolution, receipt trigger enforcement, refusal/recovery matrix, 20-way idempotency, and both four-migration lanes pass locally. Exact packet: [`evidence/A4-ENS-AUTHORITY.md`](evidence/A4-ENS-AUTHORITY.md). |
| `A4-ENS-LIVE-003` | Stable ENS live read/write | `NOT_RUN; LIVE_EFFECT_BLOCKED` | No namespace/RPC, Registry, Resolver, gateway, wallet, transaction, gas, write, live readback, or public identifier was authorized or produced. Direct ENSv2 remains cut. |
| `A4-ENS-AUTHORITY-AUDIT-004` | Independent immutable-SHA A4 audit | `FIX` | Audit of exact control SHA `ac939141af51b46342b218a977f85027017c4c85` found an unbounded delivery resolver, stale pre-resolution time, caller-backdateable Receipt checks, and discarded semantic-DENY evidence. |
| `A4-ENS-AUTHORITY-REMEDIATION-005` | A4 remediation G1 | `PASS_TO_AUDIT; LOCAL_ONLY` | Shared typed timeout, post-resolution clock, production `clock_timestamp()` claim/freshness fences, caller-time-independent Receipt enforcement, superuser-only disposable clock, and bounded semantic-DENY evidence pass 9/9 focused tests and 26/26 combined integration checks. Exact packet: [`evidence/A4-ENS-AUTHORITY.md`](evidence/A4-ENS-AUTHORITY.md). |
| `A5-UI-CONTROL-SURFACE-001` | A5 protected UI/read model | `PASS_LOCAL_ONLY; AUDIT_FIX` | Exact A5 control SHA `cb3a82d4c657e7e8b8b89e9a2bed560ac47af273` passed the original local/browser gate. The later `b918553` audit is applicable defect evidence, not exact-SHA acceptance. |
| `A5-UI-CONTROL-SURFACE-AUDIT-002` | A5 audit | `FIX` | Production-reachable dependency risk remained unclassified, bare builds depended on an untracked Dynamic environment ID, and missing/invalid SIWE authentication could reach policy/database setup and surface 500 responses. |
| `A5-AUDIT-REMEDIATION-003` | A5 remediation G1 | `PASS_TO_AUDIT; LOCAL_ONLY` | Dead Dynamic/RainbowKit/WalletConnect and direct UUID paths are removed; bounded upgrades/overrides leave production at 0 critical/high; a native injected connector builds with no vendor ID; and missing/malformed authentication returns 401 before policy/database access with zero mutation. Cold install, Prisma, both migration lanes, every test lane, Go, bare build/start, Chromium 8/8, audits, secret, diff, and allowlist gates pass. Exact packet: [`evidence/A5-UI-CONTROL-SURFACE.md`](evidence/A5-UI-CONTROL-SURFACE.md). |
| `U0-UNISWAP-001` | Uniswap admission | `PASS` | `ADMIT_STACK_CONTINUITY` only for a reusable upstream Node 22 ESM SDK fix; existing Arc/custom-router path rejected; optional writer remains closed. |

HTTP `200`, a database flag, UI badge, inherited receipt, or mock is not terminal evidence.

## A0 verification scope

This gate changed documentation and control state only. The first commit ran Markdown structure/link, exact status-vocabulary, common-dir lock/token, branch/baseline/remote, changed-line secret-pattern, and authored-control `git diff --check` checks. Its stale-A1 check was too narrow and missed `prompts/C0-COORDINATOR.md`; independent audit returned `FIX`. Remediation G1 checks every active non-archive Lisbon control/prompt for the contradiction. The intentionally byte-preserved `docs/lisbon/archive/research-vault/**` corpus remains excluded from authored-control checks. Application lint, typecheck, tests, build, and migrations were not run by that A0 correction; current A1 evidence follows below. Live sponsor smokes remain `NOT_RUN` and blocked.

## A1 verification scope

A1 adds the deterministic local engineering foundation and is `PASS_LOCAL_ONLY`. Its migration upgrade test is explicitly synthetic Cannes-shaped because no live dump or prior migration history was available. The production build uses a deliberately non-live public Dynamic UUID, and database schema commands use non-connecting loopback placeholders; neither is sponsor or shared-system evidence. The effectful legacy `npm run validate` command was not executed. npm's inherited audit findings and every release, claim, live sponsor, managed-database, push, deployment, signature, transaction, form, spend, and mainnet gate remain outside A1 and fail closed.

The remediation audit subsequently found one README banner claim-drift issue. This does not invalidate the proven local engineering checks or block authorized A2 work, but it remains release/claim-blocking and is not silently repaired under A2.

## A2 verification scope

A2 remediation G1 is `PASS_REAUDIT; LOCAL_ONLY`. Its PostgreSQL clusters, EOA signatures, concurrency, lease takeover, kill/restart, and compatibility-adapter results are deterministic local fixtures. A3 now owns the authoritative worker adapter without weakening A2 claim fencing. No live browser signature, external effect, shared database, public identifier, or sponsor proof was obtained. Details and exact counts are in [`evidence/A2-AUTHENTICATED-KERNEL.md`](evidence/A2-AUTHENTICATED-KERNEL.md).

## A3 verification scope

A3 remediation G1 is `PASS_FIXTURE; PASS_INTEGRATION; PASS_REAUDIT; LOCAL_ONLY`. Independent audit accepted exact SHA `9a4f41f8c679469dc230cba584bce84fcc3c65e5`. Compute and Storage execution exist only through an explicitly injected local fixture; the default production adapter is terminally blocked before any broker, signer, billing, funding, verifier, upload, or network construction. Offline tests use deterministic EOA signatures and exact UTF-8 equality. The production Go verifier executable remains pinned to official Storage client `v1.3.0`, non-FullTrusted indexer construction, and proof-enabled download, but no production adapter path may invoke it in this scope. Its integration tests use a separate Go fixture downloader while retaining the same strict stdin/receipt/readback/output validation, kernel file-size bound, and parent-owned cleanup. Live 0G remains `NOT_RUN` and `LIVE_EFFECT_BLOCKED`. Exact implementation, negative cases, recovery evidence, and gate results are in [`evidence/A3-STRICT-0G.md`](evidence/A3-STRICT-0G.md).

## A4 verification scope

A4 remediation G1 is `PASS_FIXTURE; PASS_INTEGRATION; PASS_TO_AUDIT; LOCAL_ONLY`. Stable ENS resolution is implemented behind exact `viem@2.47.6`, but every exercised resolver response was a deterministic local fixture and every PostgreSQL cluster was disposable loopback state. Every resolver is bounded, post-resolution validation precedes an independent database-time claim/freshness fence, and Receipt authorization ignores caller time. Structurally valid semantic denials preserve bounded canonical evidence; malformed, unserializable, and oversized responses do not. The nine focused A4 tests and combined 26-test integration lane retain the 20-duplicate, refusal, resume, recovery, takeover, and database-bypass matrix while adding normal/recovered never-settling delivery, record/claim expiry, receipt backdating, and normal-role test-clock refusal. No live ENS read/write or public identifier exists. Exact details are in [`evidence/A4-ENS-AUTHORITY.md`](evidence/A4-ENS-AUTHORITY.md).

## A5 verification scope

A5 remediation G1 is `PASS_A5_AUDIT_REMEDIATION; PASS_TO_AUDIT; LOCAL_ONLY`. Production dependency risk is bounded to 0 critical/high, the wallet build uses one native injected connector with no vendor environment ID, and missing/malformed authentication returns bounded 401 responses before SIWE policy or database access. Action and ownership refusals remain 403. All writes, signatures, sponsor/live calls, managed migrations, deployment, push, and claim promotion remain blocked. Exact implementation, advisory classification, regression evidence, and gate results are in [`evidence/A5-UI-CONTROL-SURFACE.md`](evidence/A5-UI-CONTROL-SURFACE.md).

## Downstream boundary

`A0_LOCAL` opened A1; accepted remediation/audits opened A2, offline A3, local A4, and local A5 sequentially. The first A5 audit returned `FIX`; remediation G1 now returns `PASS_TO_AUDIT` on the containing SHA. No next gate opens until an independent disposable-checkout audit accepts that exact unchanged SHA. Rights/license/team/owner gaps, required access and caps, event-window evidence, live 0G/ENS proof, inherited README claim drift, deployment, and independent release audit remain `RELEASE_BLOCKED`, claim-blocked, or `LIVE_EFFECT_BLOCKED`. Pre-H0 work remains disclosed prior/pre-window work and cannot be classified as Lisbon-window evidence.
