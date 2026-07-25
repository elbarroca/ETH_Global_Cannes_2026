# A4 Stable ENS Authority Evidence

- Task: `A4-ENS-AUTHORITY-REMEDIATION-G1-20260724`
- Sprint: `A4_remediation`
- Start SHA: `c2390609388afc82ae455efc6c36dd55e909cca4`
- Control SHA: `ac939141af51b46342b218a977f85027017c4c85`
- Branch: `Eth_global_lisbon_`
- Observed through: `2026-07-24T14:31:17Z`
- Exit/audit SHA: `1ccadb6fec02b3bcae7cf1c16f5b707fe1c240a9`
- Result: `PASS_REAUDIT_BASE; PASS_FIXTURE; PASS_INTEGRATION; LOCAL_ONLY`
- Live result: `NOT_RUN; LIVE_EFFECT_BLOCKED`

## Result and boundary

A4 remediation G1 closes the four findings from the independent audit of `ac939141af51b46342b218a977f85027017c4c85`. Exact `viem@2.47.6` still supplies the stable Registry/Public Resolver/Universal Resolver read path and the immutable per-effect binding is unchanged. Every resolver invocation is now bounded; validation uses a post-resolution clock; production database triggers use their own current time; and structurally valid semantic `DENY` stores bounded canonical record bytes/hash, block/time/freshness, optional transaction hash, and the exact worker owner/epoch/claim version. Malformed, unserializable, and oversized values fail closed without raw evidence persistence or error/log echo.

This is deterministic local fixture and disposable PostgreSQL evidence. No live ENS namespace, RPC, Registry, Resolver, CCIP gateway, wallet, transaction, gas, write, readback, explorer ID, or sponsor endpoint was contacted. Direct ENSv2 remains cut because the official deployment packet is not final. No ENSjs or ethers ENS path was added.

## Runtime authority

- A fresh check runs immediately before Compute service resolution, billing headers, request send, signature fetch, Storage write, and proof-enabled readback.
- A separate fresh `PRE_DELIVERY` check runs immediately before every normal or recovered receipt acceptance. Cached pre-execution `ALLOW` is never accepted for delivery.
- The shared resolver boundary races every normal and recovered invocation against a validated 5-second default timeout and returns typed `ENS_AUTHORITY_TIMEOUT`; fixtures may shorten the same finite policy. A never-settling resolver cannot be kept alive indefinitely by heartbeat renewal.
- `RESPONSE_VERIFIED` resumes at Storage, `STORAGE_COMMITTED` resumes at readback, and `READBACK_VERIFIED` recovery invokes the adapter zero times. Ambiguous request markers remain non-replayable.
- Expired `READBACK_VERIFIED` jobs are requeued without exceeding the attempt bound, reclaimed under the new lease, freshly authorized for delivery, and then recovered without adapter replay.
- Authority validation and persistence use the clock after resolution. The database then replaces production observation time with `clock_timestamp()` and independently fences current lease owner, worker epoch, exact job claim version, claim expiry, record age, and freshness. A slow resolution after record or lease expiry and a takeover during either authority phase persist no stale `ALLOW`.
- Wrong/missing/malformed/stale parent, agent, chain, version, manifest, capability, service, registry, resolver, owner/delegate, payout, policy, job, effect, replay, outage, or timeout is terminal. Pre-execution refusal creates zero Compute/Storage/verifier calls; pre-delivery refusal creates zero receipt/settlement/commission/rating/trade/replacement effect and exactly one refund.

## Database authority

Migration `20260724130000_ens_authority` now has SHA-256 `59e2bf95f540af0f26c02e22bb2d257599b3a94b6086e27a7d2f8341d16fe0b0`. It adds:

- immutable `ens_authority_bindings` with relational lineage validation and bounded canonical fields;
- append-only `ens_authority_checks` with exact phases, operations, decisions, bounded optional semantic-DENY observations, and worker claims;
- non-null unique `receipts.authority_check_id`; and
- a receipt trigger requiring the latest fresh exact `PRE_DELIVERY ALLOW` for the same effect/job/agent version/binding/current claim at current database time, independent of caller-supplied Receipt time.

Production checks always use `clock_timestamp()`. Deterministic fixed-time tests persist an explicit disposable-clock marker; both authority and Receipt triggers accept that marker only when `current_user` is a database superuser. A focused `SET LOCAL ROLE` regression proves a normal application role cannot activate it. This is disposable-test support only; a database superuser already has authority to disable triggers and is not a permitted production application role.

The two disposable replay lanes both apply four finished migrations, verify eleven named invariant triggers, fourteen A4 constraints, the non-null Receipt authority column, and the unchanged synthetic Cannes sentinel SHA-256 `fb8aece1677586a330f0cfeb0850b71488849302324eb1d6a079673e35e3829e` with next sequence value `43`.

## Focused and recovery evidence

Nine A4 tests pass:

1. twenty duplicate submissions converge to one intent/job/effect; seven fresh checks gate one A3 execution and one receipt/settlement/commission;
2. never-settling normal and recovered `PRE_DELIVERY` resolution both terminate as `ENS_AUTHORITY_TIMEOUT`, create no Receipt, and refund once;
3. post-resolution record expiry preserves bounded semantic-DENY bytes/hash/block/time/freshness, while post-resolution claim expiry persists no `ALLOW`;
4. nineteen malformed, stale, forged, mismatched, replay, outage, and timeout cases produce zero A3 calls and one refund; malformed, unserializable, and oversized cases persist no raw evidence;
5. transfer during execution denies delivery after exactly one A3 execution, while `RESPONSE_VERIFIED` and `STORAGE_COMMITTED` resume without repeating completed work;
6. unchanged and transferred expired `READBACK_VERIFIED` recovery both invoke the adapter zero times and respectively succeed once or fail/refund once;
7. lease takeover during `PRE_EXECUTION` and `PRE_DELIVERY` persists no stale `ALLOW`, and the new owner alone completes lawful recovery;
8. direct Receipt bypass, binding mutation, check deletion, and binding/check bounds are rejected by database triggers or constraints; and
9. a Receipt backdated against its exact authority check is rejected while a normal database role cannot enable the disposable clock marker.

Combined integration passes 26/26 reported tests plus both migration lanes. Accepted A2 worker fencing and A3 strict verification remain green.

## Cold local gate

Toolchain: Node `v22.22.3`, npm `10.9.8`, Prisma/Client `6.19.3`, TypeScript `5.9.3`, Go `1.23.10`, PostgreSQL `14.23`, viem `2.47.6`. Lock SHA-256: `48b4006589371bba141b0b2233f9739beb83af13436cfae4ce6c9ddca8d473f3`.

| Command/check | Exit | Observed |
|---|---:|---|
| `npm ci --legacy-peer-deps` | 0 | 2,129 packages installed from the committed lock; inherited audit result remains 103 findings: 19 low, 41 moderate, 42 high, 1 critical. |
| `npx prisma validate` / `npx prisma generate` | 0 | Schema valid; Prisma Client `6.19.3` generated. |
| `npx tsx scripts/test-migrations.ts` | 0 | Empty and synthetic Cannes-shaped four-migration lanes passed; sentinel SHA-256 remained exact. |
| `npm run validate:env` | 0 | Offline protected defaults passed without secrets. |
| `npm run lint` | 0 | Zero errors; 23 inherited warnings and no A4 warning. |
| `npm run typecheck` | 0 | Strict TypeScript passed. |
| `npm test` | 0 | 9/9 foundation/pure kernel tests passed. |
| `npm run test:auth` | 0 | 7/7 authentication tests passed. |
| `npm run test:kernel` | 0 | 13/13 reported kernel tests passed. |
| `npm run test:go` | 0 | Three Go verifier tests passed and the production verifier built. |
| `npm run test:a3` | 0 | 12/12 A3 tests passed after widening the local stalled-operation timing budget to include the new authority checks; semantics are unchanged. |
| `npm run test:a4` | 0 | 9/9 focused authority tests passed. |
| `npm run test:integration` | 0 | 26/26 reported TypeScript tests plus both four-migration lanes passed. |
| `npm run test:e2e` | 0 | 4/4 protected CLI/boot/entrypoint tests passed. |
| `npm run test:resilience` | 0 | 1/1 generated-output cleanup test passed. |
| `npm run test:redaction` | 0 | 3/3 redaction tests passed. |
| `npm run test:boot` | 0 | Protected smoke booted with workers disabled and no sponsor credential. |
| `npm run scan:secrets` | 0 | No high-confidence tracked-file secret pattern. |
| `bash -n docker-entrypoint.sh` | 0 | Entrypoint syntax passed. |
| `npm run build` | 0 | Next `16.2.2` compiled, typechecked, and generated 31/31 static pages. |
| post-build artifacts / production start | 0 | `prerender-manifest.json`, `BUILD_ID`, and `required-server-files.json` exist; `export-detail.json` is absent; `next start` became ready in 134 ms and served the loopback root. |

## ENSv2 owner-layer extension

- Task: `A4-ENSV2-HIERARCHY-20260724`
- Task instance: `A4-ENSV2-HIERARCHY-20260724:W1:7C5DC8B`
- Start/control SHA: `7c5dc8b246d16583606d6bc6115429db81cc69e8`
- Observed through: `2026-07-24T23:30:07Z`
- Result: `AUDIT_FIX; LOCAL_ONLY`
- Live result: `NOT_RUN; LIVE_EFFECT_BLOCKED`

The accepted stable schema-v1 resolver and `checkFreshEnsAuthority` call contract remain supported. The owner layer adds a strict schema-v2 deterministic fixture policy without a live ENSv2 client, deployment address, or invented ABI. Creator parent and agent label are ENSIP-15-normalized separately, restricted to the admitted ASCII `.eth` product namespace, deterministically joined, and DNS-encoded with installed `viem@2.47.6` before binding. Reverse namespaces, malformed/unsupported/confusable labels, reserved labels, normalization collisions, and suffix spoofing deny before A3.

The immutable canonical binding and persisted record bytes now include direct price, normalized and DNS names, the agent label/full subname, root Registry, canonical Universal Resolver, canonical creator Registry, equal agent parent Registry, optional exact agent Registry, owner/delegate, contract/name roles and admin roles, grant expiries, parent/agent expiry, forward/back links, alias status, winning resolver/suffix, explicit/inherited policy, CCIP gateway/status/response hash, and the existing version/manifest/capabilities/service/payout/chain/block/transaction/time/freshness/policy/job/effect evidence. Existing database columns and the already-applied migration are unchanged; expanded evidence is carried inside the existing bounded immutable canonical bytes/hash.

Deterministic fixtures enforce nonzero creator canonical Registry, exact parent Registry equality, expected owner or admitted delegate, exact optional agent Registry, exact roles/admin roles, no external grant, unexpired lineage, intact backlinks, non-alias state, exact resolver policy, and verified CCIP provenance. Wrong/missing/replaced Registry, owner, role/admin role, external grant, expiry, backlink, alias, root, resolver, suffix, inheritance mode, DNS form, price, Universal Resolver, or CCIP response is terminal. Pre-execution cases create zero Compute/Storage/verifier calls; drift during execution creates no delivery, receipt, settlement, commission, or replacement effect. Recovery and takeover re-resolve without replaying completed adapter work.

The canonical Universal Resolver is pinned at `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe`. The official readiness vector `ur.integration-tests.eth -> 0x2222222222222222222222222222222222222222` is asserted as a deterministic constant only; no live resolution occurred. Both explicit and inherited resolver policies pass valid fixtures, including the valid absence of an agent subregistry.

Fourteen focused A4 tests passed at owner-layer exit. They retained all nine accepted stable tests and added the readiness vector, valid ENSv2 hierarchy with twenty duplicate submissions, name-boundary refusals, a data-driven hierarchy/role/expiry/resolver/CCIP refusal matrix, delivery-time transfer/expiry/subregistry/role/resolver drift, and ENSv2 restart/takeover coverage. Combined integration passed 31/31 reported TypeScript tests plus both unchanged four-migration lanes. The later independent audit nevertheless classified exact SHA `091a657aa1967365fcbdecb6707b1e2dbb38f00f` as `AUDIT_FIX`: schema-v1 runtime derived schema-v2 binding bytes and could conflict with already persisted pre-owner-layer bytes, while the role policy admitted two unique roles with only one scope.

| Command/check | Exit | Observed |
|---|---:|---|
| `npm ci --legacy-peer-deps` | 0 | Installed from the committed lock; no manifest or lockfile changed. |
| loopback-placeholder `npx prisma validate` / `npx prisma generate` | 0 | Schema valid and Prisma Client `6.19.3` generated. The first bare validate exited 1 only because `DIRECT_URL` was unset; no connection was attempted. |
| `npx tsx scripts/test-migrations.ts` | 0 | Empty and synthetic Cannes-shaped four-migration lanes passed; sentinel SHA-256 stayed `fb8aece1677586a330f0cfeb0850b71488849302324eb1d6a079673e35e3829e`. |
| `npm run validate:env` | 0 | Offline protected defaults passed without secrets. |
| `npm run lint` / `npm run typecheck` | 0 | Zero lint errors, 23 inherited warnings, no A4 warning, and strict TypeScript passed. |
| `npm test` / `npm run test:auth` / `npm run test:kernel` | 0 | 9/9 foundation, 9/9 authentication, and 13/13 kernel tests passed. |
| checksum-pinned `npm run test:go` | 0 | Official temporary Go `1.23.10 darwin/arm64` passed verifier tests/build under `GOTOOLCHAIN=local`; the task-specific archive/toolchain was deleted. |
| checksum-pinned `npm run test:a3` | 0 | 12/12 A3 tests passed. |
| `npm run test:a4` | 0 | 14/14 stable plus ENSv2 focused tests passed. |
| `npm run test:a5` | 0 | 3/3 A5 tests passed. |
| checksum-pinned `npm run test:integration` | 0 | 31/31 reported TypeScript tests plus both migration lanes passed. |
| `npm run test:e2e` / `npm run test:resilience` / `npm run test:redaction` | 0 | 4/4, 1/1, and 3/3 tests passed. |
| `npm run test:boot` / `npm run scan:secrets` / `bash -n docker-entrypoint.sh` | 0 | Protected boot, tracked secret scan, and entrypoint syntax passed. |
| `npm run build` | 0 | Next `16.2.11` compiled, typechecked, and generated 31/31 static pages. |

The host initially had no Go executable. C0 authorized one official `https://go.dev/dl/go1.23.10.darwin-arm64.tar.gz` download under a task-specific `/tmp` directory only. SHA-256 matched `25c64bfa8a8fd8e7f62fb54afa4354af8409a4bb2358c2699a1003b733e6fce5`; `go version` was exactly `go1.23.10 darwin/arm64`; the archive and extracted toolchain were deleted before closeout. This was local verification tooling, not ENS, 0G, sponsor, product, or release evidence.

## ENSv2 owner-layer audit remediation

- Task: `A4-ENSV2-HIERARCHY-REMEDIATION-20260725`
- Task instance: `A4-ENSV2-HIERARCHY-REMEDIATION-20260725:W2:091A657`
- Generation: `2`
- Start/control SHA: `091a657aa1967365fcbdecb6707b1e2dbb38f00f`
- Observed through: `2026-07-25T00:03:03Z`
- Prior owner-layer result: `AUDIT_FIX; LOCAL_ONLY`
- Remediation result: `PASS_TO_AUDIT_REMEDIATION; PASS_FIXTURE; PASS_INTEGRATION; LOCAL_ONLY`
- Live result: `NOT_RUN; LIVE_EFFECT_BLOCKED`

The authority binding is now a strict internal discriminated union. With no ENSv2 policy, derivation emits the pre-`091a657` schema-v1 object shape and no schema-v2-only key; the covered ASCII `.eth` binding must match its original canonical bytes and SHA-256 and is never rewritten. With ENSv2 configured, derivation emits only the strict schema-v2 shape and resolution accepts only schema-v2 evidence, so the repair introduces no schema fallback. The later audit found that name preparation still applies new ENSv2-only ASCII restrictions to schema-v1 before this byte comparison.

A regression seeds one exact pre-owner-layer ASCII `.eth` schema-v1 canonical bytes/hash directly into `ens_authority_bindings` before execution. Both normal execution and a simulated crash after proof-enabled readback followed by lease-takeover recovery succeed with one unchanged binding, one effect, one receipt/settlement/commission, no refund, no replacement, and zero recovery-adapter calls. This proves only that covered binding remains usable through the normal and recovered delivery paths.

ENSv2 policy validation now requires at least one `CONTRACT` role and one `NAME` role in addition to existing uniqueness and structural checks. All-`CONTRACT` and all-`NAME` policies are refused both before execution and after A3 readback but before delivery. Pre-execution refusal creates zero Compute, Storage, and verifier calls; pre-delivery refusal leaves one A3 effect but creates no receipt, settlement, commission, or replacement and refunds exactly once.

| Command/check | Exit | Observed |
|---|---:|---|
| `npm run validate:env` | 0 | Offline protected defaults passed without secrets. |
| loopback-placeholder `npx prisma validate` / `npx prisma generate` | 0 | Schema valid and Prisma Client `6.19.3` generated. |
| `npx tsx scripts/test-migrations.ts` | 0 | Empty and synthetic Cannes-shaped four-migration lanes passed; sentinel SHA-256 remained exact. |
| `npm run lint` | 1 then 0 | The first run found one new `prefer-const` test error; the declaration was corrected, and the rerun had zero errors and 23 inherited warnings. |
| `npm run typecheck` | 0 | Strict TypeScript passed. |
| `npm test` / `npm run test:auth` / `npm run test:kernel` | 0 | 9/9 foundation, 9/9 authentication, and 13/13 kernel tests passed. |
| checksum-pinned `npm run test:go` | 0 | Official temporary Go `1.23.10 darwin/arm64` passed verifier tests/build under `GOTOOLCHAIN=local`; the task-specific archive/toolchain and verifier binary were deleted. |
| checksum-pinned `npm run test:a3` | 0 | 12/12 A3 tests passed. |
| checksum-pinned `npm run test:a4` | 0 | 16/16 focused tests passed, including the two remediation regression families. |
| `npm run test:a5` | 0 | 3/3 A5 tests passed. |
| checksum-pinned `npm run test:integration` | 0 | 33/33 reported TypeScript tests plus both four-migration lanes passed. |
| `npm run test:e2e` / `npm run test:resilience` / `npm run test:redaction` | 0 | 4/4, 1/1, and 3/3 tests passed. |
| `npm run test:boot` / `npm run scan:secrets` / `bash -n docker-entrypoint.sh` | 0 | Protected boot, tracked secret scan, and entrypoint syntax passed. |
| `npm run build` | 0 | Next `16.2.11` compiled, typechecked, and generated 31/31 static pages. |

The authorized Go archive again matched SHA-256 `25c64bfa8a8fd8e7f62fb54afa4354af8409a4bb2358c2699a1003b733e6fce5` and exact `go1.23.10 darwin/arm64`; its task-specific archive/toolchain was deleted. No ENS, 0G, sponsor, API, shared/managed database, signature, transaction, deployment, push, form, funding, upload, spend, public identifier, live proof, or claim-promotion effect was attempted.

## ENSv2 owner-layer remediation audit

- Audit SHA: `a22bbb3b7d049c0a9827b87fb4ce7cb634a43d82`
- Audited remediation SHA: `c0bef991bb1bfce4b804eeb9513bcc6a4fc65732`
- Tree: `1999a782dedd25d6474face942884262e5f44a4a`
- Result: `FIX; LOCAL_ONLY`

The independent disposable-clone audit confirmed the strict schema-v1/schema-v2 evidence split, schema-v2 refusal of schema-v1 fallback, and the requirement for both `CONTRACT` and `NAME` scopes. All-CONTRACT and all-NAME policies refuse before A3 with zero Compute/Storage/verifier calls and refuse after readback but before delivery with no receipt, settlement, commission, or replacement.

One HIGH compatibility defect remains. Before `091a657`, schema-v1 accepted any ENSIP-15-normalized parent/descendant pair. At the audit SHA, `validateRuntime()` invokes the new ASCII/single-label ENSv2 name preparation before persisted binding comparison. A pre-seeded exact schema-v1 binding for `créateur.eth` and `research.créateur.eth` therefore fails with zero resolver calls, no authority check or delivery, one terminal refund, and unchanged stored binding bytes. Normal execution fails, so READBACK recovery for this prior-valid class is also not proven. The required repair is bounded: retain the pre-owner-layer normalized parent/descendant validation when `runtime.ensv2` is absent and keep the stricter product policy only for schema-v2, with normal and READBACK regression coverage.

The complete immutable-clone floor otherwise passed: both migration lanes; lint with zero errors and 23 inherited warnings; typecheck; foundation 9/9; auth 9/9; kernel 13/13; Go verifier; A3 12/12; A4 16/16; A5 3/3; integration 33/33 plus migrations; e2e 4/4; resilience 1/1; redaction 3/3; boot; secret scan; shell syntax; build 31/31; and loopback HTTP 200. The initial bare Prisma check failed only because `DIRECT_URL` was unset and passed with non-connecting placeholders; the initial A3 run failed only because Go was absent and passed with the checksum-pinned temporary toolchain. Temporary audit and Go files were deleted.

## Schema-v1 name compatibility remediation

- Task: `A4-ENSV2-SCHEMA1-COMPAT-REMEDIATION-20260725`
- Task instance: `A4-ENSV2-SCHEMA1-COMPAT-REMEDIATION-20260725:W3:8839D26`
- Generation: `3`
- Start/control SHA: `8839d26b0b62824baec2211b4c8767d91e58a0a8`
- Intermediate exit SHA: `7d9dad522d6ef820e6e4ce646edf7011f8559c3c`
- Final exit SHA: `196ed92b5b29db381118ba41c703eebbb6d7540b`
- Result: `PASS_TO_AUDIT_REMEDIATION; PASS_FIXTURE; PASS_INTEGRATION; LOCAL_ONLY`
- Live result: `NOT_RUN; LIVE_EFFECT_BLOCKED`

Runtime name preparation is now policy-specific. Without `runtime.ensv2`, the authority applies the exact pre-owner-layer name semantics: ENSIP-15 normalize the creator parent and complete agent descendant, reject equality, and require the normalized descendant to end in the normalized parent. It does not apply the later ASCII namespace, single-label, reserved-label, deterministic product-label, or DNS-encoding restrictions before persisted binding comparison. Binding derivation remains the exact schema-v1 canonical object and existing bytes/hash remain immutable.

With `runtime.ensv2`, the existing strict path is unchanged: normalize the creator and agent label separately; require the admitted ASCII `.eth` namespace and one supported nonreserved agent label; deterministically rebuild the full name; reject confusable, collision, suffix-spoof, reverse, unsupported, Unicode, and multi-label product inputs; DNS-encode names; and require strict schema-v2 hierarchy, role-scope, resolver, CCIP, and freshness evidence with no schema-v1 fallback.

The focused legacy regression pre-seeds the exact canonical schema-v1 bytes/hash for Unicode creator `créateur.eth` and multi-label descendant `tier.research.créateur.eth`. Normal execution and a simulated crash after readback followed by lease takeover both succeed with the original binding unchanged, one effect, one receipt/settlement/commission, no refund or replacement, and zero recovery-adapter calls. The schema-v2 name-refusal matrix uses the same Unicode creator class and stops before every Compute, Storage, and verifier operation. Existing all-`CONTRACT` and all-`NAME` policy refusals and every hierarchy/recovery/takeover case remain green.

| Command/check | Exit | Observed |
|---|---:|---|
| `npm run validate:env` | 0 | Offline protected defaults passed without secrets. |
| placeholder-bound `npx prisma validate` / `npx prisma generate` | 0 | Schema valid and Prisma Client `6.19.3` generated. |
| `npx tsx scripts/test-migrations.ts` | 0 | Empty and synthetic Cannes-shaped four-migration lanes passed; sentinel SHA-256 remained exact. |
| `npm run lint` | 0 | Zero errors and 23 inherited warnings. |
| `npm run typecheck` | 0 | Strict TypeScript passed. |
| `npm test` / `npm run test:auth` / `npm run test:kernel` | 0 | 9/9 foundation, 9/9 authentication, and 13/13 kernel tests passed. |
| checksum-pinned `npm run test:go` | 0 | Official temporary Go `1.23.10 darwin/arm64` passed verifier tests/build under `GOTOOLCHAIN=local`. |
| checksum-pinned `npm run test:a3` | 0 | 12/12 A3 tests passed. |
| `npm run test:a4` | 0 | 16/16 focused tests passed, including Unicode/multi-label normal and recovered delivery plus strict schema-v2 refusal. |
| `npm run test:a5` | 0 | 3/3 A5 tests passed. |
| checksum-pinned `npm run test:integration` | 0 | 33/33 reported TypeScript tests plus both four-migration lanes passed. |
| `npm run test:e2e` / `npm run test:resilience` / `npm run test:redaction` | 0 | 4/4, 1/1, and 3/3 tests passed. |
| `npm run test:boot` / `npm run scan:secrets` / `bash -n docker-entrypoint.sh` | 0 | Protected boot, tracked secret scan, and entrypoint syntax passed. |
| `npm run build` | 0 | Next `16.2.11` compiled, typechecked, and generated 31/31 static pages. |
| temporary Go cleanup | 1 then 0 | The first delete met read-only module-cache files; owner-write permission was restored only inside the W3 `/tmp` tree, then the archive, toolchain, module/build caches, and verifier binary were deleted and absence verified. |

Control deviation: while the exact W3 physical lease and mirrored token remained active, an unattributed external actor created and pushed `7d9dad522d6ef820e6e4ce646edf7011f8559c3c` to `origin/Eth_global_lisbon_`. Read-only comparison against `8839d26b0b62824baec2211b4c8767d91e58a0a8` proves that commit contains only `src/ens/authority.ts` and the initial W3 `ACTIVE-WRITER.md` record and exactly matches the applied production patch/mirror. No W3 or C0 command authorized that commit or push, and no repeat, amendment, replacement, or force push is authorized. The remaining local commit contains only regression/evidence/ledger closeout; independent audit must cover the full two-commit range.

## W3 independent immutable-range audit

- Audit target: `9288ab265323248c7ff3bbaaa75b184f66887521`
- Audit tree: `e0eb87f168dd88a28e3d0ab7a96607e2e604473f`
- Audited W3 range: `8839d26b0b62824baec2211b4c8767d91e58a0a8..196ed92b5b29db381118ba41c703eebbb6d7540b`
- Result: `PASS_TO_NEXT_GATE; LOCAL_ONLY`

The independent detached-clone audit found no HIGH, MEDIUM, or LOW defect in the W3 range. It reproduced exact Unicode parent and multi-label descendant schema-v1 normal execution and READBACK takeover with immutable bytes/hash, one effect and lawful delivery, no refund/replacement, and zero recovery-adapter calls. It also confirmed that schema-v2 retains ASCII `.eth`, single-label, reserved-label, collision, DNS, hierarchy, mixed `CONTRACT`/`NAME` roles, resolver, CCIP, freshness, and no-fallback enforcement and rejects the same Unicode class before Compute, Storage, or verifier activity.

The prescribed floor passed from the immutable clone: both migration lanes; lint with zero errors and 23 inherited warnings; typecheck; foundation 9/9; auth 9/9; kernel 13/13; Go verifier; A3 12/12; A4 16/16; A5 3/3; integration 33/33 plus migrations; e2e 4/4; resilience 1/1; redaction 3/3; boot; secret scan; shell syntax; build 31/31; and loopback HTTP 200. Extra `npm ls --all` against inherited clone-on-write dependencies exited 1 for optional/peer/extraneous entries; clean `npm ci` remains required at the release floor and was not authorized in this read-only audit.

The audit verified origin remained exactly at unattributed partial W3 `7d9dad5`, final W3 remained local, and the external-effect ledger granted no repeat or final push authority. This verdict closes only the W3 compatibility HIGH and opens the next sequential publication work; it does not grant current `A4_ACCEPTED`, live ENS, sponsor, push, A5, or release authority.

## Kernel publication-handoff immutable audit

- Audit SHA: `4e741d05d25e49ed9a0a8964a3119a1ae98f3e59`
- Tree: `a89da23341db397770b0ddcecc56c0996c701176`
- Audited range: `b41f3ed522670db020c4a2dba0402584dca803dc..4e741d05d25e49ed9a0a8964a3119a1ae98f3e59`
- Result: `FIX; LOCAL_ONLY`

The independent detached audit found three HIGH publication-integrity defects. Production `POST /api/kernel/agents` calls `publishAgentVersion` without an `A4PublicationAuthority`, so `PUBLISH_VERSION` always refuses; the only adapter is a test fixture, while direct service use accepts a Kernel-only summary that is not a persisted accepted `src/ens` decision. Database constraints require only shape-valid publication fields and permit `WRITE_PREPARED` to become public and hireable without a foreign-keyed A4 decision or matching `PUBLISH_VERSION` event. Freshness is validated against time captured before asynchronous authority resolution and is not rechecked with database time inside the publication transaction.

The audit also found MEDIUM gaps: `CREATE_DRAFT` has no durable action identity, exact `BIND_NAME` replay appends duplicate events, and the route neither bounds JSON bodies nor maps malformed JSON to a bounded client error. Minimum repair is sequential: ENS owns a publication-specific durable decision from accepted resolution; Kernel consumes it server-side by decision ID, enforces the decision/event/state transition atomically with commit-time freshness, adds owner/action idempotency, and bounds route parsing.

The prescribed immutable-tree floor passed: environment and Prisma checks; both five-migration lanes; lint with zero errors and 23 inherited warnings; typecheck; foundation 9/9; auth 9/9; kernel 17/17; checksum-pinned Go 1.23.10; A3 12/12; A4 16/16; A5 3/3; integration 33/33 plus migrations; e2e 4/4; resilience 1/1; redaction 3/3; protected boot; secret and shell checks; `git diff --check`; Next 16.2.11 build with 31/31 pages; and loopback root HTTP 200. Temporary tooling and audit artifacts were deleted. No sponsor API, ENS/0G/Uniswap call, shared database, managed migration, signature, transaction, push, deployment, form, funding, upload, spend, identifier, or claim occurred.

Current `A4_ACCEPTED`, A5 acceptance, live ENS, sponsor, push, release, and public-claim gates remain closed.

## Remaining blocks

- The independent pinned-SHA re-audit accepted exact unchanged remediation SHA
  `1ccadb6fec02b3bcae7cf1c16f5b707fe1c240a9`; the subsequent A5 writer ledger
  records that acceptance before its start. This accepts only the stable A4
  base. The first ENSv2 hierarchy owner layer and W2 remediation remain
  historical `AUDIT_FIX`, and W3 exact-range audit is `PASS_TO_NEXT_GATE`.
  The sequential Kernel draft/name/write/readback/publication gate remains required before
  current `A4_ACCEPTED` can open.
- `PASS_LIVE` is `NOT_RUN` and `LIVE_EFFECT_BLOCKED`; no live ENS write/readback or public identifier exists.
- Production A3 live execution remains intentionally unavailable. Rights/license/team/owner records, event-window classification, sponsor access/caps, inherited dependency findings, README claim drift, deployment, push, forms, and release audit remain unresolved.
- Stable local ENS causality does not establish ENS qualification, production readiness, release validity, Lisbon-window classification, or expected winnings.

External effects attempted in the ENSv2 owner-layer task: one explicitly authorized checksum-pinned official Go toolchain download to task-specific temporary storage, deleted before closeout. Sponsor/ENS/0G/API calls: none. Managed/shared database effects: none. User signatures, network transactions, deployments, pushes, forms, funding, uploads, spend, mainnet value, public identifiers, live proof, and claim promotion: none.

## Sequential Kernel publication handoff

- Task: `A5-KERNEL-LIFECYCLE-20260725`
- Task instance: `A5-KERNEL-LIFECYCLE-20260725:W2:B41F3ED`
- Start/control SHA: `b41f3ed522670db020c4a2dba0402584dca803dc`
- Result: `IMPLEMENTED; FOCUSED_PASS; VERIFICATION_BLOCKED_GO; LOCAL_ONLY`
- Live result: `NOT_RUN; LIVE_EFFECT_BLOCKED`

The protected `/api/kernel/agents` boundary now accepts only `CREATE_DRAFT`, `BIND_NAME`, `PREPARE_ENS_WRITE`, and `PUBLISH_VERSION`. Draft identity is server-derived, private, non-hireable, and backed by bounded inert Markdown. Name binding adds the normalized creator parent, deterministic label/full subname, DNS names, and exact manifest hash. The prepared plan is canonical and local-only, contains no invented ABI/calldata, and states that authorization and wallet signature are still required.

Publication is fail-closed unless a server-only A4 verifier returns one fresh exact readback matching version, manifest, creator parent, label, full subname, and the server-derived owner/delegate. The Kernel validates only this typed A4 handoff summary; it does not duplicate hierarchy, Registry, role, resolver, CCIP, or freshness-resolution logic. A refused, transferred, role-drifted, resolver-drifted, stale, or substituted readback leaves the version unpublished and records only a bounded refusal code in append-only lifecycle evidence. A successful local fixture atomically freezes the version and protected listing state; later changes require a new version.

The protected jobs query now admits only canonical lifecycle publications on real API calls, rejects self-hire, and retains the exact immutable `agentVersionId`. Existing worker execution still re-proves lease owner, epoch, claim version, effect identity, claim/worker expiry, fresh A4 authority before remaining A3 effects and before delivery, verified A3 receipt binding, one effect, and exclusive settlement/refund with receipt-matched commission. Legacy direct-publish compatibility remains reachable only through explicitly injected disposable test SQL and cannot satisfy the production API predicate.

Focused evidence passed: environment validation; Prisma validate/generate; both fresh and synthetic Cannes five-migration lanes with sentinel SHA-256 `fb8aece1677586a330f0cfeb0850b71488849302324eb1d6a079673e35e3829e`; lint with zero errors and 23 inherited warnings; typecheck; foundation 9/9; auth 9/9; and kernel 17/17. Kernel cases cover privacy/non-hireability, invalid actions and active Markdown, exact plan/binding, missing/transferred/role/resolver/stale/substituted A4 refusal with zero job/effect, publication immutability/new version, self/cross-user refusal, twenty submissions/one effect, replay, and cancellation.

The prescribed floor stopped at `npm run test:go` with exit `127`: `sh: go: command not found`. `command -v go` returned no executable. No toolchain download was authorized or attempted. An earlier direct `npm run test:a3` confirmed the same environment failure: 3 non-Go tests passed and 9 tests failed at the Go fixture build hook. A3/A4/A5/integration/e2e/resilience/redaction/boot/secret/shell/build lanes after the fail-fast stop are not current-generation acceptance evidence. Therefore current `A4_ACCEPTED`, A5 acceptance, live ENS, sponsor, push, release, and claim gates remain closed pending environment repair, a complete rerun, commit-SHA evidence, and independent audit.

Schema review is surgical: `git diff --numstat -- prisma/schema.prisma` is exactly `30 0`. The remaining hunks are only fifteen additive lifecycle/authority fields plus one relation on `AgentVersion`, and the fourteen-line append-only `AgentVersionEvent` model. All pre-existing schema formatting outside those required additions remains byte-identical to the pinned start SHA.

External effects attempted: none. Local effects were limited to allowed repository files, generated ignored Prisma output, and disposable loopback PostgreSQL clusters. No ENS/0G/sponsor/API call, managed/shared migration, signature, transaction, push, deployment, form, funding, upload, spend, public identifier, live proof, or claim promotion occurred.

## ENS-owned durable publication-decision prerequisite

- Task: `A4-ENS-PUBLICATION-DECISION-20260725`
- Task instance: `A4-ENS-PUBLICATION-DECISION-20260725:W4:70307D0`
- Generation: `4`
- Start/control SHA: `70307d045d1b1af327ef7a2f4c55fec4b2ff5bc9`
- Observed through: `2026-07-25T03:20:16Z`
- Writer result: `PASS_TO_AUDIT; PUBLICATION_DECISION_READY_FOR_KERNEL_HANDOFF; LOCAL_ONLY`
- Live result: `NOT_RUN; ENSV2_LIVE_BLOCKED; LIVE_EFFECT_BLOCKED`

W4 adds an ENS-owned, append-only `ens_publication_decisions` relation keyed by a generated decision UUID, a deterministic convergence key, and a restrictive foreign key to `agent_versions.id`. It is independent of jobs, effects, worker claims, receipts, delivery, and settlement. Migration `20260725042000_a4_publication_decision` has SHA-256 `79334c82de4f0a28fdea14df771639e21b65780a956481cdf00375e5758de999` and extends both replay lanes from five to six migrations while preserving synthetic Cannes sentinel SHA-256 `fb8aece1677586a330f0cfeb0850b71488849302324eb1d6a079673e35e3829e`.

Each decision persists canonical server-derived binding bytes/hash for the exact version, manifest, normalized creator parent, agent label/full subname, DNS encodings, capabilities, service, price, payout, chain, owner/delegate, root Registry, canonical Universal Resolver, canonical creator and exact parent/optional-agent Registries, roles/admin roles/grants, expiry, forward/back links, alias policy, resolver provenance, CCIP gateway, maximum age, and policy. It separately preserves canonical resolved record bytes/hash, block/time/freshness, optional transaction hash, release SHA, and bounded `ALLOW`/`DENY` error. Database constraints and the append-only trigger reject mutation, deletion, foreign-lineage substitution, malformed shapes, duplicate semantic evidence, caller time in production, expired/exact-boundary `ALLOW`, unexpected grants/aliases/links, and normal-role activation of the disposable fixed clock.

`createEnsPublicationAuthority` is the single production-facing server-composition function. Server composition owns the database, resolver, runtime policy, release SHA, and optional test clock. Its per-call request has exactly one admitted key, `agentVersionId`; caller-supplied manifests, bindings, hashes, owner/delegate, timestamps, records, release identity, or other evidence are refused before resolution. It loads the `WRITE_PREPARED` version and manifest binding, normalizes then DNS-encodes names through the accepted viem path, resolves schema-v2 evidence through the shared A4 parser and hierarchy validator, persists a decision, and returns only decision ID plus bounded verdict/error. Missing runtime, malformed input/response, transfer, replacement, stale/expired evidence, wrong root/chain/owner/role, alias, broken link, CCIP failure, timeout, and outage fail closed. Twenty simultaneous identical checks converge to one row; later drift creates a new `DENY` and never overwrites the prior `ALLOW`.

Official ENS guidance was refreshed. It still requires normalization before DNS encoding, treats `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` as the canonical Universal Resolver, relies on CCIP Read, and retains `ur.integration-tests.eth -> 0x2222222222222222222222222222222222222222` as the readiness vector. The ENSv2 contract overview still labels the design work-in-progress pending final design and audits. Installed viem `2.47.6` declarations confirm the explicit Universal Resolver and CCIP-aware ENS calls; no live call or viem call signature changed. Sources: [Universal Resolver](https://docs.ens.domains/resolvers/universal/), [ENSv2 readiness](https://docs.ens.domains/web/ensv2-readiness/), [CCIP Read](https://docs.ens.domains/resolvers/ccip-read/), and [ENSv2 overview](https://docs.ens.domains/contracts/ensv2/overview/).

Focused A4 passes 21/21. The new coverage proves exact accepted persistence with zero commerce rows; a 43-case immutable/name/hierarchy/Registry/owner/role/admin/grant/expiry/link/alias/resolver/CCIP/chain/root/stale/malformed denial matrix; exact expiry refusal; twenty-way convergence; missing runtime and caller-fabrication refusal; outage/timeout/malformed persistence; drift without overwrite; and append-only, FK, database-time, duplicate-evidence, and normal-role fixed-clock enforcement. Combined integration passes 38/38 plus both six-migration lanes.

| Command/check | Exit | Observed |
|---|---:|---|
| `npm ci --legacy-peer-deps` | 0 | 1,231 packages installed from lock SHA-256 `8120e3abb0fa75a6e6a1336a72975c717155fc387f0becb213fd18ebcd891162`; inherited npm audit reports 41 findings: 22 low, 13 moderate, 6 high. |
| loopback-placeholder `npx prisma validate` / `npx prisma generate` | 0 | Schema valid; Prisma Client `6.19.3` generated. |
| `npx tsx scripts/test-migrations.ts` | 0 | Empty and synthetic Cannes-shaped six-migration lanes passed with exact sentinel preservation. |
| `npm run validate:env` / `npm run lint` / `npm run typecheck` | 0 | Offline environment passed; lint has zero errors and 23 inherited warnings; strict TypeScript passed. |
| `npm test` / `npm run test:auth` / `npm run test:kernel` | 0 | 9/9 foundation, 9/9 authentication, and 17/17 reported Kernel tests passed. |
| checksum-pinned `npm run test:go` | 0 | Exact official Go `1.23.10 darwin/arm64` passed verifier tests/build under `GOTOOLCHAIN=local`. |
| `npm run test:a4` / checksum-pinned `npm run test:integration` | 0 | A4 21/21 and integration 38/38 plus both six-migration lanes passed. |
| `npm run test:a5` / `npm run test:e2e` / `npm run test:resilience` / `npm run test:redaction` | 0 | 3/3, 4/4, 1/1, and 3/3 passed. |
| `npm run test:boot` / `npm run scan:secrets` / `bash -n docker-entrypoint.sh` | 0 | Protected boot, tracked secret scan, and shell syntax passed. |
| `npm run build` / loopback `next start` | 0 | Next `16.2.11` compiled/typechecked, generated 31/31 pages, became ready on loopback, and served `/` with HTTP `200` and 32,236 bytes. |

The host initially had no Go executable, so the first integration attempt failed only the A3 Go fixture hook. Under exact W4 authorization, official `go1.23.10.darwin-arm64.tar.gz` was downloaded only to a task-specific `/tmp` tree, matched SHA-256 `25c64bfa8a8fd8e7f62fb54afa4354af8409a4bb2358c2699a1003b733e6fce5`, reported exact `go1.23.10 darwin/arm64`, and made the full rerun green. The archive, extracted toolchain/cache/module tree, verifier binary, and HTTP smoke artifacts are deleted at closeout.

## W4 immutable publication-decision audit

- Audit SHA: `3b73c9dd5339ef42549ff5a529ba3dcd10dd68c5`
- Tree: `3be0b139a06e1031c7f5a02bb8a06fe74a68a796`
- Audited range: `70307d045d1b1af327ef7a2f4c55fec4b2ff5bc9..3b73c9dd5339ef42549ff5a529ba3dcd10dd68c5`
- Result: `FIX; LOCAL_ONLY`

The independent detached audit found one HIGH database-integrity defect. Application code derives the convergence key and release identity, but the migration admits those values through shape and cross-field consistency checks rather than an independently trusted database-owned derivation/admission boundary. A normal application-role integrity check therefore proved an `ALLOW` row is not independently authoritative. Existing tests cover duplicate evidence and fixed-clock privilege, but not this authority invariant.

The prescribed floor otherwise passed: environment and Prisma checks; both six-migration lanes; lint with zero errors and 23 inherited warnings; typecheck; every test lane; checksum-pinned Go verifier; secret and shell checks; range diff hygiene; Next 16.2.11 build with 31 pages; protected boot; and loopback HTTP 200. Cleanup completed and no external effect occurred.

Minimum repair: prevent general application-role inserts, derive and validate decision/release identity inside a trusted database-owned boundary, add the missing normal-role regression, and re-audit a new immutable SHA.

W4 is `AUDIT_FIX`, not ready for Kernel consumption. Kernel/API ownership remains untouched. After ENS repair and re-audit, the sequential Kernel handoff must consume the decision by foreign key, recheck freshness with database time in the publication transaction, append the matching lifecycle event, repair action idempotency/body bounds, and pass immutable audit. Therefore `A4_ACCEPTED`, frozen `A5_ACCEPTED`, mandatory A6 entry, live ENS, sponsor qualification, release, push, deployment, public identifiers, and claim promotion remain closed.
