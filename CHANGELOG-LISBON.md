# AlphaDawg Lisbon Changelog

Prior-state boundary: `bfa7bd37c573e2e49525d965f7f937210e170d72`.

## 2026-07-24 - A3 independent-audit remediation G1

- Removed the conditional production live A3 runtime entirely. Retired enable/funding/spend settings are rejected, the example environment no longer advertises them, and the default adapter returns terminal `A3_LIVE_BLOCKED` before any broker, signer-status, billing-header, funding, Storage, verifier, upload, or network construction/import.
- Moved immutable `READBACK_VERIFIED` reconstruction and proof validation ahead of adapter construction and into exception/expired-lease recovery. Both in-process and hard-kill recovery pass at `attempt=max`; the expired path invokes the recovery adapter zero times and creates one effect/receipt/settlement/commission with no refund or `ATTEMPTS_EXHAUSTED`.
- Bound every injected Compute, Storage, and verifier operation to one combined claim-loss/canonical-deadline signal with register-then-recheck listener ordering and deterministic cleanup. Never-resolving request and signature retrieval now terminate promptly and produce no usable output or success artifact.
- Made Node own and recursively clean a fresh per-invocation verifier `TMPDIR`; termination is cooperative `SIGTERM` followed by a short bounded `SIGKILL` fallback. Added stdout/stderr, crash, nonzero, timeout, abort/pre-abort, oversized temporary output, and forced-fallback cleanup coverage.
- Applied Unix `RLIMIT_FSIZE` before official Go proof download and added `SIGXFSZ` to signal-aware contexts while preserving the independent logical 1 MiB limit, non-FullTrusted client, and `Download(..., true)`.
- Passed 12/12 focused A3 tests, three pinned-Go tests plus production verifier build, combined integration 17/17 plus both migration lanes, and the complete cold local gate. No package lock, schema, migration, or CI file changed.
- Performed no sponsor/provider/indexer/RPC call, shared/managed database effect, upload, deployment, push, user signature, network transaction, form, spend, mainnet action, public identifier, live proof, or claim promotion. `PASS_LIVE` is `NOT_RUN; LIVE_EFFECT_BLOCKED`; A3 returns `PASS_TO_REAUDIT`, not release approval.

## 2026-07-24 - A3 strict 0G fixture and integration

- Replaced the authoritative `A3_NOT_CONFIGURED` worker seam with a disabled-by-default strict 0G adapter while retaining the old protected adapter only as an explicit A2 compatibility fixture.
- Added exact creator/buyer/version/manifest/input/provider/model/nonce/deadline/policy/job/effect request binding, fatal signed-text UTF-8 equality, acknowledged separated-TEE signer validation, exact response/signature schemas, and removal of malformed-proof re-hashing.
- Added a unique-by-effect staged A3 journal with immutable bindings/evidence, legal versioned transitions, current owner+epoch+claim-version fencing at every mutation, ambiguous-dispatch refusal, and zero-repeat crash recovery.
- Added a Go `1.23.10` stdin/stdout verifier pinned to official `0g-storage-client v1.3.0`; production uses a non-FullTrusted indexer and `Download(..., true)`, bounded temporary readback, exact canonical receipt/root/digest/size checks, and nonzero fail-closed exits.
- Added server-only exact live provider/model/funding/cap gates in the original A3 generation; the remediation above supersedes and removes that conditional live authority. CI installs Go `1.23.10` and runs the Go/A3 lanes.
- Passed 8/8 focused A3 TypeScript tests, two Go tests, combined integration 13/13 plus both three-migration replay lanes, and the full local cold gate. Fourteen terminal mutations created zero receipt, settlement, commission, rating, trade action, second effect, or fake proof.
- Performed no sponsor/provider/indexer/RPC call, shared/managed database effect, upload, deployment, push, user signature, network transaction, form, spend, mainnet action, public identifier, live proof, or claim promotion. `PASS_LIVE`, release, and 0G qualification remain blocked.

## 2026-07-24 - A2 independent-audit remediation G1

- Fenced worker success, failure, retry, heartbeat, and terminalization with the current lease owner, worker epoch, exact job claim version/effect identity, and unexpired database leases; gave reconciliation separate exact-expired-version authority.
- Added deterministic A→expiry/reconcile→B reclaim coverage proving every late A mutation is rejected without changing B's claim, B alone terminalizes one effect, and heartbeat lease loss cannot persist or finalize.
- Made queued cancellation atomically terminalize either a pending or retry-running effect, assert that no nonterminal effect remains, and only then refund; added the terminal-job/effect consistency regression.
- Enforced SIWE `onboard` action for onboarding and fresh `authenticate` action for normal protected use; fresh sessions resolve only an existing unique wallet/user mapping, while malformed target-cookie encoding fails closed without mutation.
- Repeated the full cold local gate: 0 lint errors with 23 inherited warnings; unit 9/9, auth 7/7, kernel 13/13, integration 5/5 plus both migration lanes, e2e 4/4, resilience 1/1, redaction 3/3, protected boot, secret scan, entrypoint syntax, and 31/31-page production build passed.
- Performed no schema/migration/package/lockfile/README change, sponsor call, shared/managed database effect, deployment, push, user signature, network transaction, form, spend, mainnet action, or claim promotion. A2 remains local-only and requires pinned-SHA re-audit.

## 2026-07-24 - A2 authenticated commerce kernel

- Added canonical SIWE challenge/verification with explicit domain, chain, wallet, action, nonce, audience, URI, issued-at, and expiry binding; one-time transactional consume; hash-only opaque sessions; HttpOnly/SameSite cookies; and bearer support.
- Replaced mock/optional onboarding with a browser-signed canonical flow and DB-only identity creation. The inherited Express onboarding endpoint now fails closed and points to the canonical flow with zero Circle/iNFT/placeholder fallback.
- Added immutable server-owned AgentVersion publishing; atomic-unit Quote/JobIntent/Order/Job records; append-only JobEvent; deterministic one-per-job Effect; verified Receipt; exclusive Settlement/Refund; Commission; and singleton WorkerLease models plus database constraints/triggers.
- Added one four-slot PostgreSQL-leased worker with heartbeats, optimistic legal transitions, cancellation, bounded attempts, lease expiry, and same-effect restart reconciliation. The production adapter terminates `A3_NOT_CONFIGURED` without sponsor or semantic fallback.
- Protected the A2-allowlisted inherited mutation routes before legacy capability imports and made protected startup the default across `src/index.ts`, Next instrumentation, and Docker.
- Extended empty plus synthetic Cannes-shaped migration replay through the A2 migration while preserving the exact A1 sentinel hash and sequence state; added auth, 20-way concurrency, settlement/refund, recovery, protected-boot, and redaction coverage.
- Recorded the independently identified README top-banner `$27K` wording as `RELEASE_CLAIM_DRIFT_BLOCKED`; it was outside A2 scope and expected winnings remain unproven with floor `$0`.
- Performed no sponsor call, shared/managed database effect, deployment, push, user signature, network transaction, form, spend, mainnet action, or claim promotion. Offline fixture signatures and disposable loopback PostgreSQL writes only.

## 2026-07-24 - A1 independent-audit remediation G1

- Recorded the independent `FIX` on A1 commit `c2359f766e61ea0d5b8735992de971101ee962bd` and used the single permitted remediation generation.
- Made committed migrations the canonical README database setup path and labeled `prisma:push` noncanonical/disposable-development-only.
- Upgraded the synthetic Cannes-shaped replay from a row-count check to expected sentinel identity plus exact Node SHA-256 equality over every deterministic row value before resolution and after deploy.
- Relabeled inherited Cannes bounty statuses and the `$27K` estimate as prior-work claims, not current Lisbon eligibility, sponsor proof, release evidence, expected winnings, or production status.
- Replaced epoch-zero timestamps for malformed no-anchor legacy rows with unavailable (`—`) while retaining deterministic interpolation whenever a valid cycle/action anchor exists.
- Performed no sponsor call, shared/managed database effect, push, deployment, signature, transaction, form, spend, mainnet action, or claim promotion.

## 2026-07-24 - A1 deterministic foundation

- Added real lint, typecheck, unit, integration, end-to-end, resilience, redaction, environment-validation, generated-output cleanup, and secret-scan commands plus minimal Node 22/PostgreSQL 14 CI.
- Added typed and redacted environment boundaries, safe Prisma/Postgres.js URL handling, an additive baseline migration, and disposable empty plus explicitly synthetic Cannes-shaped migration replay.
- Repaired all 23 inherited lint errors without weakening global rules; 23 warnings remain explicit. The cold lockfile/Prisma/lint/typecheck/test/build gate passes locally.
- Marked the two database aggregate GET routes request-time after cold builds proved they otherwise queried Prisma during prerender; CI uses a deliberately non-live public Dynamic UUID for offline prerendering.
- Performed no sponsor call, shared/managed database effect, push, deployment, signature, transaction, form, spend, mainnet action, or claim promotion. Live Cannes migration equivalence, inherited dependency audit findings, release, and production readiness remain unproven.

## 2026-07-24 - A0 local-admission audit remediation

- Recorded the independent `FIX` on A0_LOCAL commit `36783c69f249387943f6f4b89286e2b27660337e`: the active C0 prompt still blocked A1 on release-only gaps, and the evidence packet overstated the first stale-language check.
- Replaced only the stale C0 gate with the exact `A0_LOCAL` split and corrected the first check to `FAIL` before recording the narrowed remediation result.
- Kept pre-H0 disclosure plus every release, claim, and live-effect block intact; performed no product change, external effect, or claim promotion.

## 2026-07-24 - A0 local build admission

- Admitted `A0_LOCAL` at start SHA `2dd242d4ae217fd6cd370e598d3ffca3250ab1f7` after verifying `developer`, baseline ancestry, clean start state, worktrees, `origin/main`, absent `origin/developer`, and an atomically acquired mirrored writer lease.
- Separated `LOCAL_BUILD_AUTHORIZED`, `RELEASE_BLOCKED`, and `LIVE_EFFECT_BLOCKED`; safe local A1, A2, and offline A3 no longer wait on release-only or sponsor-live evidence.
- Kept rights/license/team/owner/access/caps, event-window classification, live P0 proof, push/deployment/submission, and sponsor/public claims fail-closed at their affected gates.
- Preserved every pre-H0 commit as disclosed prior/pre-window work and performed no product change or external effect.

## 2026-07-24 - 0G proof-path refresh

- Verified that the latest official TypeScript Storage SDK still ignores proof validation.
- Identified the pinned official Go Storage client `v1.3.0` path that validates segment proofs and the final file Merkle root.
- Kept P0 live and claim promotion blocked until the verifier is integrated, Compute response content is fatally bound to its verified signature, and authorized tamper/live checks pass; offline A3 integration is locally authorized.
- Performed no product change, dependency install, provider call, push, deployment, signature, transaction, spend, or claim promotion.

## 2026-07-24 - Continuity timing clarification

- Recorded the project owner's clarification that H0 constrains the From Scratch project, not local AlphaDawg Continuity work.
- Reconciled current ETHGlobal rules: Continuity may build on existing code, but pre-H0 work remains disclosed prior work and only substantive event-window additions count as Lisbon-new.
- Preserved rights/license/team/owner, required access/caps, live 0G proof, and independent release audit as release/claim/live blockers; the A0 local-admission correction opens A1.
- Performed no product change, dependency install, push, deployment, signature, transaction, form, spend, or claim promotion.

## 2026-07-24 - Lean autonomous sprint pack

- Replaced the duplicated all-in-one and per-domain prompt pack with one execution contract, one `A0-A7` sprint ledger, one C0 launch prompt, one reusable writer, and one reusable independent auditor.
- Added a dedicated A5 gate for functional API coverage, automated critical-path UI tests, accessibility, desktop/mobile states, and deterministic replay.
- Kept eligibility, live sponsor evidence, external effects, same-SHA deployment, documentation, and final bounty validation fail-closed.
- No product code, dependency, push, deployment, signature, transaction, form, spend, or claim promotion was performed.

## 2026-07-23 - A0 control pack

- Project owner authorized local Continuity implementation.
- Created the clean `developer` worktree from the Cannes baseline.
- Copied the controlling master, runbook, protocol gates, engineering audit, and E2E plan into `docs/lisbon/context/`.
- Added repo-local autonomous/asynchronous `/goal` prompts and fail-closed external-effect controls.
- Archived the complete AlphaDawg research/prompt/source snapshot plus the supplied prize text and ENSv2 workshop photograph inside the repository.
- Expanded the archive to a byte-for-byte mirror of all 244 research-vault files so every direct and recursive AlphaDawg reference is repo-local; added a SHA-256 manifest and internal file map.
- Archived the only two AlphaDawg-matching research-repository root files, renaming the research `AGENTS.md` to prevent nested execution authority.
- Reconciled the protected track portfolio to 0G + stable ENS, with Uniswap Stack conditional and regular Uniswap API rejected absent written Continuity admission.
- Added a repository-global atomic writer lease, owner-only parameter-bound external-effect authorization, pinned-SHA audits, and a clean-core replay gate before optional scope.
- Restricted asynchronous 0G/ENS/Uniswap probes to read-only compatibility research; all live effects belong to serialized implementation/release sprints.
- Reconciled live A0 authority plus P0/E0/U0; the later A0 local-admission correction supersedes the broad A1 block while keeping 0G live proof, stable ENS live evidence, and conditional Uniswap promotion fail-closed.
- Preserved the byte-for-byte research archive and split its SHA-256 integrity gate from authored-control whitespace checks after independent post-commit audit.
- Reconciled the independent premortem and submission audits; sprint and split-prompt IDs now use `C0/A1/P0/E0/U0/A2/A2R/A3/A4/A5/A6-A7/VA` consistently.
- No dependency install, feature code, push, deployment, signature, transaction, form submission, spend, or track promotion occurred.
