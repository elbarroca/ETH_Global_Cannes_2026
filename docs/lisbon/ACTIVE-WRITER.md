# Active Writer

At most one record may have `status: active`.

```yaml
owner: A5 audit remediation sole writer /root/a5_remediation_writer
task_id: A5-AUDIT-REMEDIATION-G1-20260724
task_instance_id: A5-AUDIT-REMEDIATION-G1-20260724:636B8EDB
generation: 1
sprint: A5_remediation
mode: sole_writer
branch: Eth_global_lisbon_
start_sha: cb3a82d4c657e7e8b8b89e9a2bed560ac47af273
control_sha: cb3a82d4c657e7e8b8b89e9a2bed560ac47af273
token: A5-AUDIT-REMEDIATION-G1-20260724-636B8EDB-A52D-4AAB-9F91-664F5F14DD54
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-24T19:39:26Z
expires_at: 2026-07-24T22:30:00Z
allowed_paths:
  - package.json
  - package-lock.json
  - .env.example
  - contexts/wagmi-provider.tsx
  - components/wallet-connect.tsx
  - src/auth/http.ts
  - tests/auth/siwe.test.ts
  - tests/a5/**
  - tests/playwright/a5-ui.spec.ts only if required for the wallet regression
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/CLAIM-MATRIX.md
  - docs/lisbon/TRACK-MATRIX.md
  - docs/lisbon/evidence/A5-UI-CONTROL-SURFACE.md
started_at: 2026-07-24T19:00:29Z
expected_exit: zero production critical or high advisories, tracked-state bare build, native injected wallet support, and unauthenticated missing-policy kernel reads bounded to 401 with zero database access
external_effect_authority: safe local files exact package install generated build and test artifacts loopback HTTP disposable PostgreSQL and one atomic local commit only
admission_evidence:
  - branch Eth_global_lisbon_ is clean at exact start and control SHA cb3a82d4c657e7e8b8b89e9a2bed560ac47af273
  - A4 accepted base remains 1ccadb6fec02b3bcae7cf1c16f5b707fe1c240a9
  - no physical lock or active mirror existed before atomic acquisition
completed_at: 2026-07-24T19:39:26Z
exit_sha: DERIVE_FROM_CONTAINING_COMMIT
acceptance_evidence:
  - production npm audit has zero critical and zero high advisories after bounded upgrades overrides and dead dependency removal with residual risk classified
  - native Wagmi injected wallet support requires no Dynamic or WalletConnect build identifier and passes tracked-state build start and Chromium gates
  - absent malformed bearer and malformed cookie authentication return bounded 401 before SIWE policy or database access with zero user or session mutation
  - cold install Prisma environment both migration lanes lint typecheck every test lane pinned Go build start Playwright audits secret diff allowlist and staged review pass
remaining_blocks:
  - exact unchanged containing SHA requires independent disposable-checkout audit before the next gate opens
  - residual production moderate and low advisories plus dev-only high advisories require separately admitted incompatible-major migration if pursued
  - live sponsor effects managed migration deployment push release and claim promotion remain blocked
audit_verdict: PASS_TO_AUDIT
result: PASS_A5_AUDIT_REMEDIATION_LOCAL_ONLY
lock_release: release only matching token A5-AUDIT-REMEDIATION-G1-20260724-636B8EDB-A52D-4AAB-9F91-664F5F14DD54 after required gates one atomic commit clean status and mirrored closure
status: closed
```

```yaml
owner: A5 UI and control-surface sole writer /root
task_id: A5-UI-CONTROL-SURFACE-20260724
task_instance_id: A5-UI-CONTROL-SURFACE-20260724:DEF3962A
generation: 1
sprint: A5
mode: sole_writer
branch: Eth_global_lisbon_
start_sha: 1ccadb6fec02b3bcae7cf1c16f5b707fe1c240a9
control_sha: 1ccadb6fec02b3bcae7cf1c16f5b707fe1c240a9
token: DEF3962A-C6CE-4ADB-836E-8096FAAD7F72
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-24T18:21:20Z
expires_at: 2026-07-24T22:45:38Z
allowed_paths:
  - src/kernel/**
  - app/**
  - components/**
  - lib/**
  - hooks/**
  - tests/a5/**
  - tests/playwright/**
  - package.json
  - package-lock.json
  - playwright.config.ts
  - public/** only if required for the release-candidate screenshot
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/evidence/A5-UI-CONTROL-SURFACE.md
started_at: 2026-07-24T14:45:38Z
expected_exit: evidence-backed whole-product UI with authenticated immutable publish and idempotent job control, responsive Proof Rail, truthful legacy surfaces, and local Chromium verification
external_effect_authority: local files tests loopback services disposable PostgreSQL generated build output exact package install one atomic local commit and no push deployment managed migration sponsor call transaction form upload spend or public claim
admission_evidence:
  - A4 remediation is pinned at 1ccadb6fec02b3bcae7cf1c16f5b707fe1c240a9 with a clean worktree and released physical lock
  - independent pinned-SHA A4 re-audit passed Go 1.23.10 verifier integration 26 of 26 and both migration lanes
  - approved design contract preserves the existing dark Nasdaq identity and routes while removing unsupported live sealed minted and deployed claims
completed_at: 2026-07-24T18:21:20Z
exit_sha: DERIVE_FROM_CONTAINING_COMMIT
acceptance_evidence:
  - immutable Define Review Publish creator flow and authenticated buyer-scoped idempotent job control use the protected kernel without database migration
  - ordered Proof Rail dashboard UUID compute detail and jobId verifier expose bounded ENS A3 Storage receipt delivery and financial evidence only
  - verified delivery and settlement require one terminal successful effect whose result hash exactly matches the verified receipt and mismatch regression fails closed
  - remaining route copy semantics accessibility mobile navigation reduced motion 200 percent reflow and five-width overflow checks pass
  - foundation auth kernel Go integration A3 A4 A5 e2e resilience redaction boot build Chromium diff and secret gates pass
  - independent final review and remediation re-review returned PASS with no remaining actionable finding
remaining_blocks:
  - PASS_LIVE is NOT_RUN and LIVE_EFFECT_BLOCKED with no live ENS 0G sponsor or public identifier evidence
  - managed migration deployment push forms transaction signature funding upload spend release and claim promotion remain blocked
  - inherited dependency advisories and release claim drift remain separate unresolved release concerns
audit_verdict: PASS
result: PASS_UI_CONTROL_SURFACE_LOCAL_ONLY
lock_release: release only matching token DEF3962A-C6CE-4ADB-836E-8096FAAD7F72 after required gates one atomic local commit clean status and mirrored closure
status: closed
```

```yaml
owner: A4 remediation sole writer /root/a4_remediation_writer
task_id: A4-ENS-AUTHORITY-REMEDIATION-G1-20260724
task_instance_id: A4-ENS-AUTHORITY-REMEDIATION-G1-20260724:47C57F33
generation: 1
sprint: A4_remediation
mode: sole_writer
branch: Eth_global_lisbon_
start_sha: c2390609388afc82ae455efc6c36dd55e909cca4
control_sha: ac939141af51b46342b218a977f85027017c4c85
token: A4-ENS-AUTHORITY-REMEDIATION-G1-20260724-47C57F33-9576-4647-87CA-733A03FEF6B9
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-24T14:33:34Z
expires_at: 2026-07-24T20:00:00Z
allowed_paths:
  - src/ens/authority.ts
  - src/worker/runner.ts
  - prisma/schema.prisma only if required
  - prisma/migrations/20260724130000_ens_authority/migration.sql
  - tests/a4/**
  - tests/helpers/ens.ts
  - scripts/test-migrations.ts only if required
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/CLAIM-MATRIX.md
  - docs/lisbon/TRACK-MATRIX.md
  - docs/lisbon/EXTERNAL-EFFECTS.md only if observed facts require it
  - docs/lisbon/evidence/A4-ENS-AUTHORITY.md
started_at: 2026-07-24T14:02:18Z
expected_exit: bounded ENS resolution, transaction-time freshness and claim fences, authoritative receipt time, and canonical semantic DENY evidence with focused regressions
external_effect_authority: safe local files tests loopback services disposable PostgreSQL generated build output and one atomic local commit only
completed_at: 2026-07-24T14:33:34Z
exit_sha: DERIVE_FROM_CONTAINING_COMMIT
acceptance_evidence:
  - every ENS resolver path has one shared typed finite timeout including normal and recovered PRE_DELIVERY
  - post-resolution application time and production database clock_timestamp fence record freshness job claim and worker lease
  - Receipt authority uses current database time and rejects caller backdating through NEW.created_at
  - bounded canonical record bytes hash and available observation metadata persist for semantic DENY while malformed unserializable and oversized inputs retain no raw evidence
  - disposable deterministic clock is database-superuser-only and a normal-role activation attempt is rejected
  - focused A4 nine of nine A3 twelve of twelve combined integration twenty-six of twenty-six and both four-migration lanes pass
  - cold install Prisma environment lint typecheck foundation auth kernel Go e2e resilience redaction boot secret shell and fully awaited 31-page build plus production start smoke pass
remaining_blocks:
  - independent pinned-SHA A4 remediation re-audit is required before A5
  - PASS_LIVE is NOT_RUN and LIVE_EFFECT_BLOCKED with no live ENS or 0G public identifier
  - release claim rights event-window dependency README deployment push forms and submission gates remain blocked
audit_verdict: PASS_TO_AUDIT
result: PASS_TO_AUDIT
lock_release: release only matching token A4-ENS-AUTHORITY-REMEDIATION-G1-20260724-47C57F33-9576-4647-87CA-733A03FEF6B9 after green checks one atomic commit clean status and mirrored closure
status: closed
```

```yaml
owner: A4 sole writer /root/a4_writer
task_id: A4-ENS-AUTHORITY-20260724
task_instance_id: A4-ENS-AUTHORITY-20260724:EAFF8890
sprint: A4
mode: sole_writer
branch: Eth_global_lisbon_
start_sha: 16622acb26f3decf13a2bb83d002a05f50f301d6
control_sha: 9a4f41f8c679469dc230cba584bce84fcc3c65e5
token: EAFF8890-40DA-4507-8634-BD1D5386CC27
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-24T13:14:16Z
expires_at: 2026-07-24T16:30:00Z
allowed_paths:
  - src/ens/authority.ts
  - src/ens/viem-resolver.ts
  - src/og/strict-a3.ts
  - src/worker/runner.ts
  - src/worker/store.ts
  - prisma/schema.prisma
  - prisma/migrations/20260724*_ens_authority/migration.sql
  - tests/a4/**
  - tests/helpers/ens.ts
  - tests/a3/strict-a3.test.ts
  - tests/kernel/kernel.test.ts
  - tests/integration/worker-fencing.test.ts
  - scripts/test-migrations.ts
  - package.json
  - package-lock.json
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/CLAIM-MATRIX.md
  - docs/lisbon/TRACK-MATRIX.md
  - docs/lisbon/EXTERNAL-EFFECTS.md
  - docs/lisbon/evidence/A4-ENS-AUTHORITY.md
started_at: 2026-07-24T12:33:27Z
expected_exit: stable ENS authority boundary integrated into strict A3 execution and pre-delivery receipt acceptance with local fixture and migration evidence
external_effect_authority: local files tests loopback services disposable PostgreSQL generated build output and one atomic local commit only
completed_at: 2026-07-24T13:14:16Z
exit_sha: DERIVE_FROM_CONTAINING_COMMIT
acceptance_evidence:
  - exact viem 2.47.6 stable Registry Public Resolver and Universal Resolver boundary with direct ENSv2 cut
  - immutable canonical effect bindings and append-only fresh claim-fenced PRE_EXECUTION and PRE_DELIVERY checks
  - receipt database trigger requires the latest fresh exact authority ALLOW for the same current claim and binding
  - twenty duplicates one A3 execution transfer restart resume refusal bypass bounds and both authority-phase lease takeovers pass
  - focused A4 six of six A3 twelve of twelve combined integration twenty-three of twenty-three and both four-migration lanes pass
  - cold install Prisma environment lint typecheck foundation auth kernel Go e2e resilience redaction boot secret shell and 31-page build pass
  - exact changed-path allowlist staged diff whitespace placeholder and high-confidence secret reviews pass
remaining_blocks:
  - independent pinned-SHA A4 audit is required before A5
  - PASS_LIVE is NOT_RUN and LIVE_EFFECT_BLOCKED with no live ENS or 0G public identifier
  - release claim rights event-window dependency README deployment push forms and submission gates remain blocked
audit_verdict: PENDING_INDEPENDENT_A4_AUDIT
result: PASS_TO_AUDIT
lock_release: release only matching token EAFF8890-40DA-4507-8634-BD1D5386CC27 after atomic commit and mirrored closure
status: closed
```

```yaml
owner: C0 coordinator task /root
task_id: A3-TO-A4-CONTINUATION-PROMPT-PUBLISH-20260724
task_instance_id: A3-TO-A4-CONTINUATION-PROMPT-PUBLISH-20260724:12016122
sprint: continuation_control
mode: sole_writer
branch: Eth_global_lisbon_
start_sha: 9a4f41f8c679469dc230cba584bce84fcc3c65e5
control_sha: 9a4f41f8c679469dc230cba584bce84fcc3c65e5
token: 12016122-6DDA-4CD7-A372-B2A42C2302A8
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-24T12:19:21Z
expires_at: 2026-07-24T14:18:30Z
allowed_paths:
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/CLAIM-MATRIX.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/EXTERNAL-EFFECTS.md
  - docs/lisbon/GOALS.md
  - docs/lisbon/README.md
  - docs/lisbon/evidence/A3-STRICT-0G.md
  - docs/lisbon/prompts/C0-A4-CONTINUATION.md
  - docs/lisbon/prompts/README.md
started_at: 2026-07-24T12:18:30Z
expected_exit: one reviewed docs-only continuation commit on Eth_global_lisbon_ plus the exact authorized same-name push
control_deviation: the same coordinator drafted the allowlisted unstaged docs diff before formal lease acquisition; no other writer or physical lock existed, and the complete diff was adopted and revalidated under this token before staging
external_effect_authority: one exact push of the containing commit to origin/Eth_global_lisbon_; no PR merge tag release deployment live call signature transaction form funding upload spend or claim promotion
completed_at: 2026-07-24T12:19:21Z
exit_sha: DERIVE_FROM_CONTAINING_COMMIT
acceptance_evidence:
  - current launch controls point to the self-contained A4 continuation goal on Eth_global_lisbon_
  - exact A0 A1 A2 and A3 accepted SHAs results setup gaps A4-A7 gates stop rules and output fields are recorded
  - final A3 remediation audit PASS is reconciled across evidence claims writer ledger and the evidence packet
  - canonical authority permits safe local A4-A7 work on Eth_global_lisbon_ while every live release and shared-system effect remains blocked
  - independent docs review passed after authority launch SHA and one-time-consumption findings were repaired
  - Markdown links fences git diff lint typecheck foundation tests and staged secret scan passed
  - product code package lock schema migrations CI and runtime behavior were unchanged
remaining_blocks:
  - PASS_LIVE is NOT_RUN and LIVE_EFFECT_BLOCKED
  - A4 A5 A6 and A7 are not implemented or validated
  - README rights event-window dependency deployment PR merge forms submission and release gates remain blocked
audit_verdict: PASS_DOCS_CONTROL_REVIEW
result: PASS_TO_AUTHORIZED_PUSH
lock_release: release only matching token 12016122-6DDA-4CD7-A372-B2A42C2302A8 after the atomic documentation commit
status: closed
```

```yaml
owner: C0 coordinator task /root
task_id: A3-STRICT-0G-REMEDIATION-G1-20260724
task_instance_id: A3-STRICT-0G-REMEDIATION-G1-20260724:E83BB3D9
generation: 1
sprint: A3_remediation
mode: sole_writer
branch: developer
start_sha: 879072a728f0bec7a4b7a541594a7920cd815d69
control_sha: 879072a728f0bec7a4b7a541594a7920cd815d69
token: E83BB3D9-81C2-4FFF-9DE3-C64CD847F3EC
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-24T05:47:13Z
expires_at: 2026-07-24T17:10:51Z
allowed_paths:
  - .env.example
  - src/config/env.ts
  - src/og/strict-a3.ts
  - src/og/storage-verifier.ts
  - src/worker/runner.ts
  - src/worker/store.ts
  - tests/a3/**
  - tests/integration/worker-fencing.test.ts
  - tools/0g-storage-verifier/**
  - docs/lisbon/evidence/A3-STRICT-0G.md
  - docs/lisbon/evidence/A2-AUTHENTICATED-KERNEL.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/CLAIM-MATRIX.md
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
started_at: 2026-07-24T05:10:51Z
expected_exit: unconditionally block production live A3, recover durable readback with zero adapter calls at max attempts, cooperatively terminate and clean bounded verifier subprocesses, enforce canonical deadlines, and pass end-to-end failure regressions
lock_release: release only token E83BB3D9-81C2-4FFF-9DE3-C64CD847F3EC after one atomic remediation commit or a recorded BLOCKED closeout
completed_at: 2026-07-24T05:47:13Z
exit_sha: 9a4f41f8c679469dc230cba584bce84fcc3c65e5
acceptance_evidence:
  - production live A3 is unconditionally unavailable and former enable funding and spend settings are rejected
  - default adapter with every former live flag permissive made zero network calls and terminalized A3_LIVE_BLOCKED without a journal or success artifact
  - immutable readback recovery runs before adapter construction exception requeue and expired attempt exhaustion
  - in-process and expired attempt-max recovery created one receipt settlement and commission no refund and zero recovery adapter calls
  - Node owns and removes each verifier temp tree after cooperative termination bounded forced kill crash timeout abort overflow and oversize exits
  - Go applies RLIMIT_FSIZE before official non-FullTrusted proof download and handles SIGXFSZ through its context
  - twelve focused A3 tests three pinned-Go tests and build combined integration seventeen of seventeen both migration lanes and the full cold gate passed
  - package lock schema migrations and CI remained unchanged and no external effect occurred
  - independent immutable-SHA re-audit accepted all five remediation roots and repeated the full gate on exact exit SHA 9a4f41f8c679469dc230cba584bce84fcc3c65e5
remaining_blocks:
  - PASS_LIVE is NOT_RUN and LIVE_EFFECT_BLOCKED because production live A3 is intentionally unavailable
  - release claim rights event-window dependency README deployment and A7 gates remain blocked
audit_verdict: PASS_A3_REMEDIATION
result: PASS_FIXTURE_PASS_INTEGRATION_PASS_REAUDIT
status: closed
```

```yaml
owner: C0 coordinator task /root
task_id: A3-STRICT-0G-FIXTURE-INTEGRATION-20260724
task_instance_id: A3-STRICT-0G-FIXTURE-INTEGRATION-20260724:3EFB753E
sprint: A3
mode: sole_writer
branch: developer
start_sha: dd336b840edb4de97fc382298c5a0c0c658f6f9f
control_sha: dd336b840edb4de97fc382298c5a0c0c658f6f9f
token: 3EFB753E-44AB-4FC5-AC06-DF67929282E8
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-24T04:47:29Z
expires_at: 2026-07-24T15:48:15Z
allowed_paths:
  - .env.example
  - .github/workflows/ci.yml
  - package.json
  - prisma/schema.prisma
  - prisma/migrations/<timestamp>_strict_0g/migration.sql
  - scripts/test-migrations.ts
  - src/config/env.ts
  - src/config/og-compute.ts
  - src/og/strict-a3.ts
  - src/og/storage-verifier.ts
  - src/worker/adapter.ts
  - src/worker/runner.ts
  - src/worker/store.ts
  - tests/a3/**
  - tests/integration/worker-fencing.test.ts
  - tools/0g-storage-verifier/**
  - docs/lisbon/evidence/A3-STRICT-0G.md
  - docs/lisbon/evidence/A2-AUTHENTICATED-KERNEL.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/CLAIM-MATRIX.md
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
started_at: 2026-07-24T03:48:15Z
expected_exit: strict offline 0G fixture and disposable-PostgreSQL A3 integration with durable claim-fenced recovery, live paths blocked, full gate, and one atomic commit
lock_release: release only token 3EFB753E-44AB-4FC5-AC06-DF67929282E8 after the atomic A3 commit or a recorded BLOCKED closeout
completed_at: 2026-07-24T04:47:29Z
exit_sha: 879072a728f0bec7a4b7a541594a7920cd815d69
acceptance_evidence:
  - strict Compute binds the exact canonical creator buyer version manifest input provider model nonce deadline policy intent job and effect request before single-use headers
  - exactly one signature object is schema-checked verified by the installed verifier and UTF-8 byte-matched to accepted assistant content
  - unique versioned journal stages are lineage-bound append-only claim-fenced and refuse ambiguous Compute or Storage redispatch
  - pinned Go 1.23.10 verifier uses official 0g-storage-client v1.3.0 non-FullTrusted indexer construction and proof-enabled Download
  - eight focused A3 TypeScript tests two Go tests combined integration thirteen of thirteen both migration lanes and the complete cold local gate passed
  - fourteen terminal mutation cases created zero receipt settlement commission rating trade second effect or fake proof
  - package-lock remained byte-identical and no sponsor provider indexer RPC shared database deployment push signature transaction form spend or claim promotion occurred
remaining_blocks:
  - immutable-SHA audit returned FIX_REQUIRED and opened the single A3 remediation generation
  - PASS_LIVE is NOT_RUN and LIVE_EFFECT_BLOCKED without exact authority public identifiers and proof-enabled live readback
  - release claim rights event-window dependency README deployment and A7 gates remain blocked
audit_verdict: FIX_REQUIRED
result: PASS_FIXTURE_PASS_INTEGRATION_AUDIT_FIX
status: closed
```

```yaml
owner: C0 coordinator task /root
task_id: A2-AUTHENTICATED-KERNEL-REMEDIATION-G1-20260724
task_instance_id: A2-AUTHENTICATED-KERNEL-REMEDIATION-G1-20260724:E170CD9A
generation: 1
sprint: A2_remediation
mode: sole_writer
branch: developer
start_sha: 2f623a25fbbf4d226657a439a3ed3bbf47cfc7a7
control_sha: 2f623a25fbbf4d226657a439a3ed3bbf47cfc7a7
token: E170CD9A-E7F3-4F1D-AA9A-CCA93C32437C
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-24T03:32:59Z
expires_at: 2026-07-24T07:01:17Z
allowed_paths:
  - src/worker/**
  - src/kernel/service.ts
  - src/auth/service.ts
  - app/api/onboard/route.ts
  - src/auth/http.ts
  - tests/integration/**
  - tests/auth/**
  - tests/kernel/**
  - docs/lisbon/evidence/A2-AUTHENTICATED-KERNEL.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/CLAIM-MATRIX.md
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
scope_amendments:
  - authorized_at_utc: 2026-07-24T03:05:31Z
    path: src/kernel/service.ts
    reason: queued cancellation owns the atomic PENDING-or-RUNNING effect terminalization needed after a transient worker requeue
  - authorized_at_utc: 2026-07-24T03:25:59Z
    path: src/auth/service.ts
    reason: fresh authenticate sessions must resolve an existing unique wallet-to-user mapping without creating a user or weakening action checks
started_at: 2026-07-24T03:01:17Z
expected_exit: fence every worker mutation by current claim authority, close auth-action and cookie parsing gaps, pass full cold gate, and return one atomic remediation commit
lock_release: release only token E170CD9A-E7F3-4F1D-AA9A-CCA93C32437C after the atomic A2 remediation commit
completed_at: 2026-07-24T03:32:59Z
exit_sha: dd336b840edb4de97fc382298c5a0c0c658f6f9f
acceptance_evidence:
  - stale A heartbeat success failure retry and finalization were rejected after B reclaimed the exact job with zero observed mutation to B claim state
  - B alone terminalized one effect receipt settlement and commission after reclaim
  - heartbeat lease loss suppressed terminal persistence hook finalization and financial mutation
  - transient retry then queued cancellation left no terminal job with a nonterminal effect and created one refund
  - authenticate action could not onboard onboard action could and fresh authenticate resolved the existing user for normal protected use
  - malformed percent cookie returned 401 with user and session counts unchanged
  - cold install Prisma lint typecheck all A1 and A2 tests migration replay secret scan boot smoke and 31-page build passed
  - no schema migration package lockfile README sponsor shared database deployment push signature transaction form spend mainnet action or claim promotion change occurred
remaining_blocks:
  - production adapter remains A3_NOT_CONFIGURED
  - independent re-audit accepted exact exit SHA dd336b840edb4de97fc382298c5a0c0c658f6f9f
  - README.md line 7 remains RELEASE_CLAIM_DRIFT_BLOCKED outside remediation scope
audit_verdict: PASS_A2_REMEDIATION
result: PASS_REAUDIT
status: closed
```

```yaml
owner: C0 coordinator task /root
task_id: A2-AUTHENTICATED-KERNEL-20260724
task_instance_id: A2-AUTHENTICATED-KERNEL-20260724:3920D88F
sprint: A2
mode: sole_writer
branch: developer
start_sha: 31000c2467d3d197b6a733f51f15bdb28c4fe30b
control_sha: 31000c2467d3d197b6a733f51f15bdb28c4fe30b
token: 3920D88F-0B33-4764-B65B-864CD77B3BDD
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-24T02:49:44Z
expires_at: 2026-07-24T10:00:00Z
allowed_paths:
  - package.json
  - package-lock.json
  - .env.example
  - .github/workflows/ci.yml
  - prisma/schema.prisma
  - prisma/migrations/**
  - scripts/test-migrations.ts
  - scripts/validate-env.ts
  - src/config/env.ts
  - src/auth/**
  - src/kernel/**
  - src/worker/**
  - src/index.ts
  - instrumentation.ts
  - docker-entrypoint.sh
  - src/types/index.ts
  - app/api/auth/siwe/challenge/route.ts
  - app/api/auth/siwe/verify/route.ts
  - app/api/auth/session/route.ts
  - app/api/kernel/agents/route.ts
  - app/api/kernel/jobs/route.ts
  - app/api/kernel/jobs/[jobId]/cancel/route.ts
  - app/api/onboard/route.ts
  - app/api/configure/route.ts
  - app/api/marketplace/create/route.ts
  - app/api/marketplace/hire/route.ts
  - app/api/cycle/run/[userId]/route.ts
  - app/api/cycle/analyze/[userId]/route.ts
  - app/api/cycle/stream/[userId]/route.ts
  - app/api/cycle/approve/[pendingId]/route.ts
  - app/api/cycle/reject/[pendingId]/route.ts
  - app/api/deposit/route.ts
  - app/api/withdraw/route.ts
  - app/api/trade/execute/route.ts
  - contexts/user-context.tsx
  - lib/api.ts
  - src/api/routes/onboard.ts
  - tests/helpers/**
  - tests/auth/**
  - tests/kernel/**
  - tests/integration/**
  - tests/resilience/**
  - tests/e2e/**
  - tests/redaction/**
  - tests/foundation/env.test.ts
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/CLAIM-MATRIX.md
  - docs/lisbon/evidence/A2-AUTHENTICATED-KERNEL.md
started_at: 2026-07-24T01:50:56Z
expected_exit: authenticated fail-closed kernel, singleton worker, deterministic concurrency/recovery, full local gate, and evidence pass on one local SHA
lock_release: release only token 3920D88F-0B33-4764-B65B-864CD77B3BDD after the atomic A2 commit
completed_at: 2026-07-24T02:49:44Z
exit_sha: 2f623a25fbbf4d226657a439a3ed3bbf47cfc7a7
acceptance_evidence:
  - canonical SIWE negative, replay, cookie, hash-only session, and DB-only onboarding tests passed 5/5
  - immutable schema and seven DB invariant triggers passed empty plus synthetic upgrade replay
  - twenty concurrent submissions converged to one quote intent order job event and effect identity
  - singleton four-slot worker heartbeat cancellation bounded attempt and pre/post-terminal restart gates passed
  - protected legacy routes rejected forged identities before capability imports with zero kernel mutation
  - cold install Prisma lint typecheck all A1 and A2 tests secret scan boot smoke and 31-page build passed
  - no sponsor call shared database push deployment user signature transaction form spend mainnet action or claim promotion
remaining_blocks:
  - production adapter is A3_NOT_CONFIGURED
  - independent A2 audit returned FIX_REQUIRED and opened the single A2 remediation generation
  - README.md line 7 inherited target-pool wording remains RELEASE_CLAIM_DRIFT_BLOCKED outside A2 scope
audit_verdict: FIX_REQUIRED
result: AUDIT_FIX
status: closed
```

```yaml
owner: C0 coordinator task /root
task_id: A1-DETERMINISTIC-FOUNDATION-REMEDIATION-G1-20260724
task_instance_id: A1-DETERMINISTIC-FOUNDATION-REMEDIATION-G1-20260724:4140D7A3
generation: 1
sprint: A1_remediation
mode: sole_writer
branch: developer
start_sha: c2359f766e61ea0d5b8735992de971101ee962bd
control_sha: c2359f766e61ea0d5b8735992de971101ee962bd
token: 4140D7A3-E309-4470-BFE7-613944557C52
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-24T01:38:37Z
expires_at: 2026-07-24T03:30:00Z
allowed_paths:
  - README.md
  - components/hunt/hunt-pipeline-arrows.tsx
  - scripts/test-migrations.ts
  - docs/lisbon/evidence/A1-DETERMINISTIC-FOUNDATION.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/CLAIM-MATRIX.md
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
started_at: 2026-07-24T01:21:21Z
expected_exit: close the four A1 audit findings at root cause and pass the complete local gate
lock_release: release only token 4140D7A3-E309-4470-BFE7-613944557C52 after the atomic remediation commit
completed_at: 2026-07-24T01:38:37Z
exit_sha: 31000c2467d3d197b6a733f51f15bdb28c4fe30b
acceptance_evidence:
  - README makes committed migrations canonical and labels prisma push noncanonical development-only
  - deterministic synthetic sentinel identity and full-row SHA-256 match exactly before and after baseline resolution
  - inherited Cannes bounty claims and estimate are not presented as current Lisbon evidence or expected winnings
  - malformed no-anchor pipeline timestamps render unavailable while valid-anchor interpolation stays deterministic
  - full cold and auxiliary A1 gates pass with zero lint errors and no effectful validate command
  - exact eight-path, Markdown, YAML, diff, lockfile, lease, and secret checks pass
  - no sponsor call, shared database effect, push, deployment, signature, transaction, form, spend, mainnet action, or claim promotion occurred
audit_verdict: FIX_RELEASE_CLAIM_DRIFT
result: ENGINEERING_PASS_RELEASE_CLAIM_DRIFT
status: complete
```

```yaml
owner: C0 coordinator task /root
task_id: A1-DETERMINISTIC-FOUNDATION-20260724T0107WEST
task_instance_id: A1-DETERMINISTIC-FOUNDATION-20260724T0107WEST:1E701677
sprint: A1
mode: sole_writer
branch: developer
start_sha: 8c07b80a515405947b5994c6540f9038e7f5058f
control_sha: 8c07b80a515405947b5994c6540f9038e7f5058f
token: 1E701677-CC4A-45FD-95BC-2FC936C75878
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-24T01:01:00Z
expires_at: 2026-07-24T04:15:00Z
allowed_paths:
  - package.json
  - package-lock.json
  - .github/workflows/ci.yml
  - .env.example
  - .gitignore
  - eslint.config.mjs
  - hardhat.config.cjs
  - README.md
  - CLAUDE.md
  - prisma/schema.prisma
  - prisma/migrations/**
  - scripts/clean-generated.ts
  - scripts/scan-secrets.ts
  - scripts/test-migrations.ts
  - scripts/validate-env.ts
  - src/config/env.ts
  - src/config/database.ts
  - src/config/prisma.ts
  - tests/foundation/**
  - tests/integration/**
  - tests/e2e/**
  - tests/resilience/**
  - tests/redaction/**
  - app/api/marketplace/earnings/route.ts
  - app/api/swarm/metrics/route.ts
  - app/dashboard/compute/[id]/page.tsx
  - app/dashboard/page.tsx
  - app/verify/page.tsx
  - components/auth-guard.tsx
  - components/dawg-loader.tsx
  - components/expandable-hunt-card.tsx
  - components/hunt/hunt-narrative-flow.tsx
  - components/hunt/hunt-pipeline-arrows.tsx
  - components/nav.tsx
  - contexts/user-context.tsx
  - scripts/validate-audit-trail.ts
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/CLAIM-MATRIX.md
  - docs/lisbon/evidence/A1-DETERMINISTIC-FOUNDATION.md
scope_amendments:
  - authorized_at_utc: 2026-07-24T00:40:10Z
    path: app/api/swarm/metrics/route.ts
    reason: cold build proved database access during route prerender
  - authorized_at_utc: 2026-07-24T00:41:12Z
    path: app/api/marketplace/earnings/route.ts
    reason: next cold build proved the same database prerender failure
started_at: 2026-07-24T00:08:51Z
expected_exit: deterministic npm, environment, migration, CI, lint, test, build, and evidence gates pass on one local SHA
lock_release: release only token 1E701677-CC4A-45FD-95BC-2FC936C75878 after the atomic commit
completed_at: 2026-07-24T01:01:00Z
exit_sha: DERIVE_FROM_CONTAINING_COMMIT
acceptance_evidence:
  - committed npm lock is unchanged and the cold npm ci install passes
  - Prisma validate and generate pass with non-connecting loopback placeholders
  - empty and explicitly synthetic Cannes-shaped disposable migration replays pass
  - lint has zero errors; typecheck, unit, integration, e2e, resilience, redaction, environment, and build gates pass
  - CI covers the same deterministic foundation with workers disabled and a deliberately non-live public Dynamic UUID
  - both route scope amendments were build-proven and C0-authorized before editing
  - no sponsor call, shared database effect, push, deployment, signature, transaction, form, spend, mainnet action, or claim promotion occurred
audit_verdict: pending_pinned_exit_audit
status: complete
```

```yaml
owner: C0 coordinator task /root
task_id: A0-LOCAL-ADMISSION-REMEDIATION-G1-20260724
task_instance_id: A0-LOCAL-ADMISSION-REMEDIATION-G1-20260724:C0986048
generation: 1
sprint: A0_remediation
mode: sole_writer
branch: developer
start_sha: 36783c69f249387943f6f4b89286e2b27660337e
control_sha: 36783c69f249387943f6f4b89286e2b27660337e
token: C0986048-D378-45CE-B13F-1A44A7B15A13
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-24T00:03:01Z
expires_at: 2026-07-24T01:15:00Z
allowed_paths:
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/evidence/A0-LOCAL-BUILD-ADMISSION.md
  - docs/lisbon/prompts/C0-COORDINATOR.md
started_at: 2026-07-24T00:00:40Z
expected_exit: remove the audited stale C0 A1 block and correct the A0 evidence claim
lock_release: release only token C0986048-D378-45CE-B13F-1A44A7B15A13 after the atomic commit
completed_at: 2026-07-24T00:03:01Z
exit_sha: 8c07b80a515405947b5994c6540f9038e7f5058f
acceptance_evidence:
  - independent audit FIX on 36783c69f249387943f6f4b89286e2b27660337e is recorded exactly
  - the active C0 prompt now uses the A0_LOCAL release and live-effect split
  - the first stale-language check is corrected to FAIL
  - all active non-archive Lisbon controls and prompts pass the contradiction scan
  - exact five-path, Markdown/link, diff, and changed-line secret checks pass
  - no product change, external effect, or claim promotion occurred
audit_verdict: PASS_A0_LOCAL
result: PASS_REAUDIT
status: complete
```

```yaml
owner: C0 coordinator task /root
task_id: A0-LOCAL-ADMISSION-20260724T0045WEST
task_instance_id: A0-LOCAL-ADMISSION-20260724T0045WEST:EC59B765
sprint: A0
mode: sole_writer
branch: developer
start_sha: 2dd242d4ae217fd6cd370e598d3ffca3250ab1f7
control_sha: 2dd242d4ae217fd6cd370e598d3ffca3250ab1f7
token: EC59B765-2E1D-4FEF-B0DD-463DD4F9E48F
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T23:54:55Z
expires_at: 2026-07-24T00:45:00Z
allowed_paths:
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/BASELINE.md
  - docs/lisbon/EXTERNAL-EFFECTS.md
  - docs/lisbon/GOALS.md
  - docs/lisbon/SPRINTS.md
  - docs/lisbon/TRACK-MATRIX.md
  - docs/lisbon/CLAIM-MATRIX.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/evidence/A0-LOCAL-BUILD-ADMISSION.md
started_at: 2026-07-23T23:48:00Z
expected_exit: admit A0_LOCAL while preserving independent release, claim, and live-effect blocks
lock_release: release only token EC59B765-2E1D-4FEF-B0DD-463DD4F9E48F after the atomic commit
completed_at: 2026-07-23T23:54:55Z
exit_sha: DERIVE_FROM_CONTAINING_COMMIT
acceptance_evidence:
  - A0_LOCAL passes on Git provenance, local project-owner authority, and writer serialization only
  - LOCAL_BUILD_AUTHORIZED, RELEASE_BLOCKED, and LIVE_EFFECT_BLOCKED are independent
  - A1 opens while release, claim, and affected live-effect gaps stay fail-closed
  - pre-H0 work remains disclosed prior/pre-window work
  - allowed-path, Markdown/link, diff, vocabulary, stale-state, and changed-line secret checks pass
  - no product change or external effect occurred
audit_verdict: pending_pinned_exit_audit
status: complete
```

```yaml
owner: Codex under project-owner direction
task_id: P0-0G-PROOF-PATH-CONTROL
branch: developer
start_sha: de6dec613bb6d0e5c3861d3de0953cf258f61c85
token: 040153A7-DC21-4736-97DD-7532BCBCEDD5
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T23:30:13Z
expires_at: 2026-07-24T00:30:13Z
allowed_paths:
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/BASELINE.md
  - docs/lisbon/TRACK-MATRIX.md
  - docs/lisbon/CLAIM-MATRIX.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/evidence/P0-0G-PROOF-PATH-REFRESH.md
started_at: 2026-07-23T23:30:13Z
expected_exit: narrow P0 from no proof-capable path to a pinned official Go remediation path while keeping product and live claims blocked
completed_at: 2026-07-23T23:31:43Z
exit_sha: 4c58b310bc35db6ecb4860cef4f93ca90e04c471
lock_release: remove only token 040153A7-DC21-4736-97DD-7532BCBCEDD5 after the closure commit succeeds
acceptance_evidence:
  - official TypeScript Storage SDK 1.2.10 still ignores proof validation
  - official Go Storage client v1.3.0 verifies segment proofs and the complete file Merkle root
  - the repository does not yet integrate the Go verifier and Compute content remains unbound
  - package versions, commits, integrity, licenses, exact APIs, verifier lines, and fatal Compute equality requirements are recorded
  - git diff and added-line secret scans passed; TypeScript passed
  - inherited lint remains at 23 errors and 28 warnings; npm test remains missing
audit_verdict: pending_pinned_exit_audit
status: complete
```

```yaml
owner: Codex under project-owner direction
task_id: A0-CONTINUITY-CLARIFICATION
branch: developer
start_sha: 3cd11943faddcf5f6d7ed7455fec783dcfd6325f
token: 1517BEF5-9BC1-42B2-878C-9600F6A8DC8A
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T23:25:13Z
expires_at: 2026-07-24T00:25:13Z
allowed_paths:
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/BASELINE.md
  - docs/lisbon/CLAIM-MATRIX.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/SPRINTS.md
  - docs/lisbon/evidence/A0-CONTINUITY-CLARIFICATION.md
  - docs/lisbon/prompts/C0-COORDINATOR.md
started_at: 2026-07-23T23:25:13Z
expected_exit: reconcile the project-owner Continuity timing clarification with current official rules without promoting pre-H0 work
completed_at: 2026-07-23T23:29:14Z
exit_sha: 03b1e1e22c543f7d90eb8d8c0ab17ef111894fbb
lock_release: remove only token 1517BEF5-9BC1-42B2-878C-9600F6A8DC8A after the closure commit succeeds
acceptance_evidence:
  - current ETHGlobal rules and project-owner clarification clear H0 only as a local Continuity-build blocker
  - pre-H0 commits remain disclosed prior work and cannot become Lisbon-window evidence
  - branch, baseline ancestry, both worktrees, remotes, repository visibility, contributor count, root license, and root environment-file presence were rechecked
  - current official source response hashes and remaining A0 blockers are recorded in evidence/A0-CONTINUITY-CLARIFICATION.md
  - git diff checks and TypeScript passed
  - inherited lint remains at 23 errors and 28 warnings; npm test remains missing
  - independent read-only audit required these exact control updates and retained the remaining A0 blockers
audit_verdict: pending_pinned_exit_audit
status: complete
```

```yaml
owner: Codex under project-owner direction
task_id: A0-LEAN-GOAL-PACK
branch: developer
start_sha: eedcdc58a93065410d430db2d9c7d602927793b1
token: 35E26400-39E6-47C1-BD25-C0CCE1773013
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T23:12:41Z
expires_at: 2026-07-24T01:03:30Z
allowed_paths:
  - CHANGELOG-LISBON.md
  - docs/lisbon/**
started_at: 2026-07-24T00:03:30+01:00
expected_exit: lean canonical contract, sprint ledger, reusable executor/auditor prompts, and verified local commit
completed_at: 2026-07-24T00:12:41+01:00
exit_sha: 5e5b0282daea08d5d4937e54d687580ab8c3dbd7
lock_release: remove only token 35E26400-39E6-47C1-BD25-C0CCE1773013 after the commit succeeds
acceptance_evidence:
  - current prompt surface reduced from 13 files to 4
  - Markdown structure, links, A0-A7 coverage, diff hygiene, and secret patterns passed
  - physical and mirrored writer tokens match
  - TypeScript passed; inherited lint and missing test script remain explicit A1 blockers
  - independent read-only audit returned PASS after reconciliation
audit_verdict: PASS
closure_token: F5A1FCBE-FE70-462B-900D-4B086F16D48C
closure_start_sha: 5e5b0282daea08d5d4937e54d687580ab8c3dbd7
closure_reason: record the exact content exit SHA after commit
closure_completed_at: 2026-07-24T00:14:34+01:00
status: complete
```

```yaml
owner: Codex under project-owner direction
task_id: A0-CONTROL-PACK
branch: developer
start_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
token: 5b76adc8-ac74-476e-a140-c2c818d57b20
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T18:45:13Z
expires_at: 2026-07-23T19:41:17Z
allowed_paths:
  - CHANGELOG-LISBON.md
  - docs/lisbon/**
started_at: 2026-07-23T18:06:32+01:00
expected_exit: self-contained control and goal pack validated and committed
exit_sha: 41325b6564c338d8b681c2756228add3a7b4dac3
completed_at: 2026-07-23T18:45:13Z
lock_release: remove the matching physical lease immediately after the closure commit
acceptance_evidence:
  - branch and baseline verified
  - no external effect
  - Markdown links and structure valid
  - independent prompt audit reconciled
status: complete
```

```yaml
owner: Codex under project-owner direction
task_id: A0-CONTEXT-MIRROR
branch: developer
start_sha: b000ba993e753a580f2c0b09d4fec8f0eac8d337
token: d17cd3a9-21a1-434a-a052-9bb5bb82a77e
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T19:13:32Z
expires_at: 2026-07-23T20:12:11Z
allowed_paths:
  - CHANGELOG-LISBON.md
  - docs/lisbon/**
started_at: 2026-07-23T18:55:09Z
expected_exit: full research-vault mirror, internal file map, link closure validation, and local commit
exit_sha: 11de852d0ca89563634f0512b45f1ca987670447
completed_at: 2026-07-23T19:13:32Z
lock_release: remove the matching physical lease immediately after the closure commit
acceptance_evidence:
  - all research-vault files mirrored byte-for-byte
  - all Obsidian and Markdown references resolve internally or are external URLs
  - execution prompts remain AlphaDawg-only
  - independent read-only audit reconciled
status: complete
```

```yaml
owner: Codex under project-owner direction
task_id: A0-LIVE-RECONCILIATION
branch: developer
start_sha: 2adaa1c165cdb76a762acea1e9177ba08cd65558
token: 396822ef-3f71-4418-845a-995e9ec987fa
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T19:19:55Z
expires_at: 2026-07-23T20:19:55Z
allowed_paths:
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/BASELINE.md
  - docs/lisbon/TRACK-MATRIX.md
  - docs/lisbon/CLAIM-MATRIX.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/EXTERNAL-EFFECTS.md
  - docs/lisbon/FRESH-CLONE.md
  - docs/lisbon/evidence/**
started_at: 2026-07-23T19:19:55Z
expected_exit: reconcile A0 live authority, P0/E0/U0 results, mirror audit boundary, and current release blockers in one docs-only commit
exit_sha: fa8bebbc624599f7ef1277a2a466ef72863b3142
completed_at: 2026-07-23T19:23:05Z
lock_release: remove the matching physical lease immediately after the closure commit
acceptance_evidence:
  - current official ETHGlobal and sponsor requirements timestamped
  - A0 release audit remains fail-closed
  - P0, E0, and U0 exact verdicts recorded
  - byte-preserved archive excluded explicitly from authored-whitespace gate
  - Markdown links, CSV, manifest, and git diff checks pass
status: complete
```

```yaml
owner: Codex under project-owner direction
task_id: A0-DEEP-C0
branch: developer
start_sha: de802b30a36680f6db05cf6f903f3e67d2b9ed66
token: d2bf7b68-c0e3-4a6c-a1ba-32d2add7e81e
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T22:06:27Z
expires_at: 2026-07-23T23:06:27Z
allowed_paths:
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/GOALS.md
  - docs/lisbon/README.md
  - docs/lisbon/prompts/C0-COORDINATOR.md
  - docs/lisbon/prompts/README.md
  - docs/lisbon/prompts/A1-FOUNDATION.md
  - docs/lisbon/prompts/P0-PROBE-0G.md
  - docs/lisbon/prompts/E0-PROBE-ENS.md
  - docs/lisbon/prompts/U0-PROBE-UNISWAP.md
  - docs/lisbon/prompts/A2-AUTH-MARKETPLACE.md
  - docs/lisbon/prompts/A2R-SHARED-RUNTIME-CLEANUP.md
  - docs/lisbon/prompts/A3-0G.md
  - docs/lisbon/prompts/A4-ENS.md
  - docs/lisbon/prompts/A5-UNISWAP-CONDITIONAL.md
  - docs/lisbon/prompts/A6-A7-DEPLOY-RELEASE.md
  - docs/lisbon/prompts/VA-INDEPENDENT-AUDIT.md
started_at: 2026-07-23T22:06:27Z
expected_exit: one deeper C0 master goal plus C0-issued dispatch guards in every connected sprint prompt, with peer-goal handoff, monitoring, recovery, audit, and cut/stop controls
exit_sha: 4a9015f24913f33283fdf7063673f8982f7005d2
completed_at: 2026-07-23T22:23:21Z
lock_release: remove only the matching physical lease after the candidate commit
acceptance_evidence:
  - current A0/P0/E0/U0 state embedded accurately
  - C0 is the sole dispatcher and never duplicates writers
  - peer-task reports remain unverified until pinned-SHA evidence passes
  - independent read-only prompt audit reconciled
  - Markdown structure, fences, local links, dispatch parity, allowed paths, diff hygiene, and added-line secret patterns pass
status: complete
```

```yaml
owner: C0 coordinator thread 019f910a-2546-7c82-8a45-72b8678565fc
task_id: A0-C0-REPAIR
task_instance_id: A0-C0-REPAIR:g2:C17AB9DF
generation: 2
branch: developer
start_sha: 4a9015f24913f33283fdf7063673f8982f7005d2
control_sha: 4a9015f24913f33283fdf7063673f8982f7005d2
token: C17AB9DF-A4A0-4FAA-BC5A-C868E9961ED1
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T22:41:00Z
expires_at: 2026-07-23T23:36:54Z
allowed_paths:
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/GOALS.md
  - docs/lisbon/prompts/C0-COORDINATOR.md
  - docs/lisbon/prompts/A1-FOUNDATION.md
  - docs/lisbon/prompts/P0-PROBE-0G.md
  - docs/lisbon/prompts/E0-PROBE-ENS.md
  - docs/lisbon/prompts/U0-PROBE-UNISWAP.md
  - docs/lisbon/prompts/A2-AUTH-MARKETPLACE.md
  - docs/lisbon/prompts/A2R-SHARED-RUNTIME-CLEANUP.md
  - docs/lisbon/prompts/A3-0G.md
  - docs/lisbon/prompts/A4-ENS.md
  - docs/lisbon/prompts/A5-UNISWAP-CONDITIONAL.md
  - docs/lisbon/prompts/A6-A7-DEPLOY-RELEASE.md
  - docs/lisbon/prompts/VA-INDEPENDENT-AUDIT.md
started_at: 2026-07-23T22:36:54Z
expected_exit: exact RELEASE_VALIDATED terminal contract, separated dispatch guards, and exact prior closure SHA
acceptance_evidence:
  - every split prompt keeps its task body separate from the dispatch guard
  - RELEASE_VALIDATED is the only successful terminal state
  - BUILD, NARROW, and BLOCKED remain non-terminal checkpoints
  - prior A0-DEEP-C0 exit SHA is exact
  - full docs-only validation passed
completed_at: 2026-07-23T22:41:00Z
lock_release: release only token C17AB9DF-A4A0-4FAA-BC5A-C868E9961ED1 after the candidate commit
exit_sha: 225d82cafa831cad92d9357ccba81e3b4bd2b0c7
audit_verdict: BLOCK
audit_findings:
  - stale state-machine tail still terminated at BUILD, NARROW, or broad STOP
  - A6/A7 still used STOP for a red protected guarantee
status: rejected_for_remediation
```

```yaml
owner: C0 coordinator thread 019f910a-2546-7c82-8a45-72b8678565fc
task_id: A0-C0-REPAIR
task_instance_id: A0-C0-REPAIR:g3:175370F5
generation: 3
branch: developer
start_sha: 225d82cafa831cad92d9357ccba81e3b4bd2b0c7
control_sha: 225d82cafa831cad92d9357ccba81e3b4bd2b0c7
token: 175370F5-49D5-4F5F-AD69-DF61C2982A6E
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T22:46:27Z
expires_at: 2026-07-23T23:44:57Z
allowed_paths:
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/GOALS.md
  - docs/lisbon/prompts/C0-COORDINATOR.md
  - docs/lisbon/prompts/A6-A7-DEPLOY-RELEASE.md
started_at: 2026-07-23T22:44:57Z
expected_exit: remove every stale early-terminal path and keep red guarantees in the repair loop
acceptance_evidence:
  - state machine exits successfully only at RELEASE_VALIDATED
  - BUILD, NARROW, WAIT_GATE, BLOCKED, CUT, and FAIL loop to reconciliation or waiting
  - STOP is limited to owner cancellation, deadline expiry, or unrecoverable repository integrity
  - A6/A7 returns blockers and remediation instead of stopping on a red guarantee
  - docs-only validation passed
completed_at: 2026-07-23T22:46:27Z
lock_release: release only token 175370F5-49D5-4F5F-AD69-DF61C2982A6E after the candidate commit
exit_sha: a89bb157e4cd5af0b07e67444b65b78e7b96b41c
audit_verdict: BLOCK
audit_findings:
  - protected timebox failure still allowed a generic STOP
  - retry and writer-ambiguity failure still allowed a generic STOP
status: rejected_for_remediation
```

```yaml
owner: C0 coordinator thread 019f910a-2546-7c82-8a45-72b8678565fc
task_id: A0-C0-REPAIR
task_instance_id: A0-C0-REPAIR:g4:EB730834
generation: 4
branch: developer
start_sha: a89bb157e4cd5af0b07e67444b65b78e7b96b41c
control_sha: a89bb157e4cd5af0b07e67444b65b78e7b96b41c
token: EB730834-6C8C-4C8C-84C6-1E612B0F42F3
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T22:50:36Z
expires_at: 2026-07-23T23:49:12Z
allowed_paths:
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/GOALS.md
  - docs/lisbon/prompts/C0-COORDINATOR.md
started_at: 2026-07-23T22:49:12Z
expected_exit: reserve STOP exclusively for the three owner-authorized terminal conditions
acceptance_evidence:
  - protected sprint timebox failures become FAIL or BLOCKED and stay in repair
  - repeated protected failures and writer ambiguity become BLOCKED and stay in reconciliation
  - only exact global deadline expiry may trigger deadline-expired STOP
  - docs-only validation passed
completed_at: 2026-07-23T22:50:36Z
lock_release: release only token EB730834-6C8C-4C8C-84C6-1E612B0F42F3 after the candidate commit
exit_sha: a97b2a15a5b346f3d212f325746600ecc801f2b1
audit_target_sha: a97b2a15a5b346f3d212f325746600ecc801f2b1
audit_verdict: PASS_TO_NEXT_GATE
audit_findings: []
audit_scope:
  - exact three-file allowed-path diff
  - clean developer and absent physical lock
  - STOP limited to owner cancellation, global deadline expiry, or unrecoverable repository integrity
  - protected failures return to repair or reconciliation
  - RELEASE_VALIDATED is the only successful terminal state
  - A0, P0, and external-effect blocks remain intact
status: complete
```

Read-only probes/auditors may overlap but must not edit, install, format, commit, push, deploy, sign, transact, submit forms, or spend.
