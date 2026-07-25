# AlphaDawg Lisbon Changelog

Prior-state boundary: `bfa7bd37c573e2e49525d965f7f937210e170d72`.

## 2026-07-25 - A4 ENSv2 owner-layer audit remediation

- Replaced unconditional schema-v2 binding derivation with a strict internal schema-v1/schema-v2 union. Runtime without ENSv2 now reproduces the exact pre-owner-layer schema-v1 canonical object, while schema-v2 retains its full strict hierarchy evidence and no fallback.
- Preserved immutable existing binding bytes/hash: a seeded pre-`091a657` binding passes normal execution and simulated post-readback crash recovery unchanged, with one effect and one lawful delivery and no refund, replacement, or recovery-adapter replay.
- Required ENSv2 policy to include at least one `CONTRACT` and one `NAME` role. Added all-`CONTRACT` and all-`NAME` refusals before A3 and after readback but before delivery; the former create zero A3 calls and the latter create no receipt or financial/replacement effect.
- Passed 16/16 focused A4 tests, A3 12/12, A5 3/3, combined integration 33/33 plus both four-migration lanes, and the complete local gate. The authorized official Go 1.23.10 archive matched its pinned SHA-256 and exact darwin/arm64 version and was deleted with the task-specific toolchain after verification.
- Classified the first owner-layer SHA `091a657aa1967365fcbdecb6707b1e2dbb38f00f` as `AUDIT_FIX; LOCAL_ONLY` and returned only `PASS_TO_AUDIT_REMEDIATION; LOCAL_ONLY`. Independent exact-SHA remediation audit, Kernel draft/name/write/readback/publication gating, `A4_ACCEPTED`, live ENS, sponsor qualification, A5 advancement, push, deployment, managed migration, signatures, transactions, spend, public identifiers, and claim promotion remain closed.

## 2026-07-25 - A4 deterministic ENSv2 hierarchy owner layer

- Preserved the accepted stable schema-v1 viem resolver and `checkFreshEnsAuthority` call contract while adding a strict schema-v2 deterministic ENSv2 fixture policy. No live ENSv2 client, deployment address, ABI, dependency, schema, migration, kernel, worker, 0G, API, or UI change was introduced.
- Normalized the creator parent and agent label separately with installed `viem@2.47.6`, deterministically derived the full subname, DNS-encoded both names, and rejected reverse/unsupported namespaces, malformed/confusable/reserved labels, normalization collisions, and suffix spoofing.
- Extended immutable canonical binding/record evidence with direct price, DNS names, canonical root and Universal Resolver, creator/parent/optional-agent Registries, owner/delegate, contract/name roles and admin roles, grant/registration expiry, backlinks, alias state, winning resolver/suffix, explicit/inherited policy, and CCIP provenance/status/hash.
- Added fail-closed hierarchy validation for missing/replaced Registries, transfer, unexpected role/admin/external grant, expiry, broken backlinks, aliasing, root/resolver/inheritance drift, and malformed/outage CCIP responses. Invalid pre-execution state causes zero A3 calls; delivery-time drift causes no receipt, settlement, commission, or replacement effect.
- Pinned the canonical Universal Resolver and official readiness vector as deterministic constants only. Added valid explicit/inherited fixtures, twenty-duplicate convergence, the denial matrix, delivery drift, restart/recovery, and lease takeover coverage while retaining all stable tests.
- Passed 14/14 focused A4 tests, A3 12/12, A5 3/3, combined integration 31/31 plus both unchanged migration lanes, and the complete local gate. An explicitly authorized official Go 1.23.10 archive matched the pinned SHA-256, ran only from task-specific temporary storage with `GOTOOLCHAIN=local`, and was deleted before closeout.
- Originally returned `PASS_TO_AUDIT_OWNER_LAYER; LOCAL_ONLY`; the subsequent exact-SHA audit classified this layer `AUDIT_FIX; LOCAL_ONLY`. Kernel draft/name/write/readback/publication gating, `A4_ACCEPTED`, live ENS, sponsor qualification, A5 advancement, push, deployment, managed migration, signatures, transactions, spend, public identifiers, and claim promotion remained closed.

## 2026-07-24 - R0 and stable A4 audit reconciliation

- Canonically recorded the accepted independent R0 re-audit at exact SHA `a8a45286980c1312713872c4b8c90c90b283c3ed` and verified that later drift is confined to the reviewed C0/executor/auditor prompt update.
- Canonically recorded the accepted stable A4 remediation re-audit at exact SHA `1ccadb6fec02b3bcae7cf1c16f5b707fe1c240a9` as the base for the expanded ENSv2 creator/subname sprint; this does not open current `A4_ACCEPTED` or any live gate.
- Refreshed the official Lisbon prize and ENS Universal Resolver/ENSv2 guidance. ENSv2 remains pre-final; no live request, write, signature, transaction, deployment, push, or claim promotion was attempted.
- Preserved A5 as exact-SHA audit-pending and every live/release effect as blocked.

## 2026-07-24 - R0 Codex agent and prompt readiness

- Migrated all seven legacy specialist definitions into validated
  `.codex/agents/*.toml` files, added explicit Kernel and ENS owners, and
  narrowed every mutation domain. The Bounty Auditor is read-only.
- Converted both legacy command workflows into Codex skills under
  `.agents/skills/`; `.claude/**` remains unchanged inactive provenance.
- Reconciled installed packages, actual paths, package commands, current
  Lisbon rules, ENSv2 pre-final status, Universal Resolver guidance, and the
  active C0/executor/auditor chain.
- Ran the Codex migration scan/plan/doctor/dry-run/write/manual-repair loop,
  target validation, stale-instruction/path/command scans, source-preservation
  check, and diff hygiene. The containing commit returns `PASS_TO_AUDIT`.
- Performed no push, deployment, managed migration, webhook registration,
  sponsor call, signature, transaction, form, funding, upload, spend, or claim.

## 2026-07-24 - A5 independent-audit remediation G1

- Classified the A5 dependency findings instead of applying blind majors. Removed the production-reachable Dynamic/RainbowKit/WalletConnect tree and unused direct `uuid` declarations; applied bounded package upgrades and transitive overrides; and reduced the production audit to 0 critical, 0 high, 4 moderate, and 13 low advisories. The remaining production findings require incompatible 0G, Hedera, or Telegram majors; the six full-audit highs are confined to lint, Hardhat, Solidity coverage, and their test/compiler dependencies.
- Replaced Dynamic with one native Wagmi injected connector and removed both public wallet IDs from the example environment. A tracked-state build, production start, and Chromium suite now pass with the former Dynamic and WalletConnect variables explicitly empty.
- Moved missing and malformed session refusal ahead of SIWE policy and database access. Absent sessions, malformed bearer headers, and malformed cookies now return deterministic `401 AUTH_REQUIRED`; wrong-action/identity cases retain bounded 403 responses, and the auth regression proves zero user/session mutation.
- Passed cold install, Prisma validate/generate, environment validation, both fresh and synthetic-upgrade migration lanes, lint/typecheck, every test lane, pinned Go `1.23.10`, bare build/start, Playwright 8/8, production/full audits, secret scan, whitespace, exact allowlist, and staged-diff review.
- Performed no push, deployment, managed migration, sponsor call, shared-system write, signature, transaction, funding, form, upload, spend, public identifier, release claim, or track promotion. This containing commit returns `PASS_TO_AUDIT`; exact-SHA acceptance must come from the subsequent disposable-checkout audit.

## 2026-07-24 - A5 whole-product UI and protected control surface

- Preserved the dark Nasdaq shell, existing route URLs, and navigation labels while adding keyboard-safe mobile navigation, global focus/active/disabled/reduced-motion rules, and responsive layouts with no horizontal overflow from 390 through 1,440 CSS pixels.
- Replaced the legacy create claim with authenticated immutable `Define → Review → Publish`, explicit generation provenance, additive published-agent ownership/proof-policy fields, and a receipt view that reports owner, version, price, hashes, and publication time without implying runtime execution.
- Added idempotent protected-job submission, two-second visible-only active polling, cancellation, replay-safe UI, exact job totals, UUID compute/verify routing, buyer-scoped redacted detail, and the ordered Owner → Version → ENS → 0G Compute → Storage → Receipt Proof Rail.
- Bound delivery and settlement presentation to a verified receipt whose result hash matches one terminal successful effect. Missing evidence is unavailable rather than failed; mismatched receipt/effect hashes fail closed and expose no receipt, delivery, or settlement payload.
- Corrected Portfolio, History, Deposit, Infrastructure, Verify, Compute, landing, chat, and legacy marketplace copy so configuration, snapshots, outages, token absence, and provider/runtime evidence are not promoted into unsupported status claims. Added one production-rendered release-candidate dashboard image labeled as local fixture data.
- Added Playwright `1.61.1`, Chromium-only production build/start coverage for five widths, effective 200% zoom, keyboard dialog focus/Escape/restoration, reduced motion, long identifiers, publish, job failure/refund, verified delivery, replay, cancellation, and the 390px overflow invariant.
- Passed the complete local gate: lint with zero errors and 23 inherited warnings; typecheck; foundation, auth, kernel, Go, integration, A3, A4, A5, e2e, resilience, redaction, boot, build, Playwright, whitespace, and secret checks. Independent final review found and then passed the receipt/effect binding and strict UUID remediations.
- Performed no live ENS/0G call, managed migration, shared database effect, wallet signature, transaction, funding, spend, form, upload, push, deployment, public identifier, release claim, or track promotion. A5 is local-only; live/release gates remain blocked.

## 2026-07-24 - A4 independent-audit remediation G1

- Bounded every shared ENS resolver invocation to a typed `ENS_AUTHORITY_TIMEOUT`, including normal and recovered `PRE_DELIVERY`; a resolver that never settles now terminalizes and refunds instead of being kept alive by worker heartbeats.
- Moved validation and persistence to a post-resolution clock. The database now overwrites production authority observation time with `clock_timestamp()` and independently fences the current claim, worker lease, record age, and freshness at insertion.
- Removed Receipt authorization dependence on caller-supplied `NEW.created_at`: the trigger uses current database time for claim/freshness and rejects receipts backdated before their exact authority check.
- Preserved bounded canonical record bytes/hash plus available block/time/freshness metadata for structurally valid semantic `DENY`; malformed, unserializable, and oversized inputs retain no raw evidence. The deterministic fixture clock is persisted explicitly and accepted only from a database superuser, which a focused normal-role regression proves cannot activate it.
- Passed 9/9 focused A4 tests, A3 12/12, combined integration 26/26 plus both four-migration lanes, and the complete cold local gate. The fully awaited 31-page build produced the required server artifacts, omitted `export-detail.json`, and passed a production loopback start smoke.
- Performed no live ENS/0G read or write, sponsor/API call, shared or managed database effect, deployment, push, signature, transaction, form, funding, upload, spend, public identifier, or claim promotion. Remediation returns `PASS_TO_AUDIT`; A5 and every live/release claim remain blocked pending independent pinned-SHA re-audit.

## 2026-07-24 - A4 stable ENS authority boundary

- Pinned the already locked `viem` runtime to exact `2.47.6` and added one stable Registry/Public Resolver/Universal Resolver read path. No ENSjs, ethers integration, direct ENSv2 contract path, dependency addition, or live call was introduced.
- Added one immutable canonical ENS binding per effect and append-only fresh authority checks binding normalized creator/agent names and nodes to version, manifest, capability, service, payout, chain, owner/delegate, registry/resolver, freshness, policy, job, effect, and the current worker claim.
- Made fresh authority load-bearing immediately before every remaining strict A3 Compute/Storage operation and again before delivery. `RESPONSE_VERIFIED`, `STORAGE_COMMITTED`, `READBACK_VERIFIED`, and expired-lease recovery skip completed or ambiguous adapter work while re-resolving only the authority needed for the remaining operation.
- Added a database receipt authority foreign key and trigger: no receipt can be inserted without the latest fresh exact `PRE_DELIVERY` `ALLOW` for the same effect/job/version/binding/current claim. Authority bindings are immutable and checks are append-only.
- Passed the six focused A4 tests, including 20 duplicate submissions, the full mismatch/refusal matrix, transfer during execution, both resume stages, unchanged/transferred readback recovery with zero adapter replay, both authority-phase lease takeovers, bounds/immutability, and direct receipt bypass refusal.
- Passed combined integration 23/23 plus both four-migration lanes and the complete local cold gate. No live ENS/0G read or write, sponsor call, shared database effect, deployment, push, signature, transaction, form, funding, upload, spend, public identifier, or claim promotion occurred.
- Kept `research_only_not_promotable`, `LIVE_EFFECT_BLOCKED`, `PASS_LIVE: NOT_RUN`, accepted A0-A3 state, and direct ENSv2 `CUT` unchanged. A4 returns `PASS_TO_AUDIT`, not release or track qualification.

## 2026-07-24 - Post-A3 continuation prompt and branch publication control

- Recorded the final independent `PASS_A3_REMEDIATION` verdict on exact SHA `9a4f41f8c679469dc230cba584bce84fcc3c65e5`; A3 is now `PASS_FIXTURE; PASS_INTEGRATION; PASS_REAUDIT; LOCAL_ONLY`, while live remains `NOT_RUN; LIVE_EFFECT_BLOCKED`.
- Added one self-contained A4-to-release `/goal` with completed A0-A3 state, remaining setup, A4-A7 contracts, writer/auditor serialization, external-effect gates, stop rules, and exact checkpoint fields.
- Made the continuation prompt the current launch entry while preserving the original C0 prompt as provenance.
- Updated the control center and canonical authority row so safe local A4-A7 work is confined to `Eth_global_lisbon_`; external/live effects remain denied.
- Mirrored one-time authorization for the documentation/control commit and exact same-name push to `origin/Eth_global_lisbon_`; no PR, merge, deployment, sponsor call, managed migration, signature, transaction, form, funding, upload, spend, or claim promotion is authorized.
- Changed documentation and control records only; product code, package manifests/lock, schema, migrations, CI, and runtime behavior remain unchanged.

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
