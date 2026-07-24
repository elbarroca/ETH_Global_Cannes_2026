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

## Remaining blocks

- The independent pinned-SHA re-audit accepted exact unchanged remediation SHA
  `1ccadb6fec02b3bcae7cf1c16f5b707fe1c240a9`; the subsequent A5 writer ledger
  records that acceptance before its start. This accepts only the stable A4
  base. The expanded ENSv2 creator/subname hierarchy contract remains local
  implementation and audit work before the current `A4_ACCEPTED` gate opens.
- `PASS_LIVE` is `NOT_RUN` and `LIVE_EFFECT_BLOCKED`; no live ENS write/readback or public identifier exists.
- Production A3 live execution remains intentionally unavailable. Rights/license/team/owner records, event-window classification, sponsor access/caps, inherited dependency findings, README claim drift, deployment, push, forms, and release audit remain unresolved.
- Stable local ENS causality does not establish ENS qualification, production readiness, release validity, Lisbon-window classification, or expected winnings.

External effects attempted: none. Sponsor calls: none. Managed/shared database effects: none. User signatures, network transactions, deployments, pushes, forms, funding, uploads, spend, mainnet value, public identifiers, live proof, and claim promotion: none.
