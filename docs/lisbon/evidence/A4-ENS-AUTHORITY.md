# A4 Stable ENS Authority Evidence

- Task: `A4-ENS-AUTHORITY-20260724`
- Sprint: `A4`
- Start SHA: `16622acb26f3decf13a2bb83d002a05f50f301d6`
- Control SHA: `9a4f41f8c679469dc230cba584bce84fcc3c65e5`
- Branch: `Eth_global_lisbon_`
- Observed through: `2026-07-24T13:10:56Z`
- Exit SHA: derive from the commit containing this packet
- Result: `PASS_FIXTURE; PASS_INTEGRATION; PASS_TO_AUDIT; LOCAL_ONLY`
- Live result: `NOT_RUN; LIVE_EFFECT_BLOCKED`

## Result and boundary

A4 implements the minimum stable ENS authorization boundary around accepted A3. Exact `viem@2.47.6` normalizes and hashes names and supplies the stable Registry/Public Resolver/Universal Resolver read path. One immutable canonical binding per effect binds normalized creator and agent names/nodes to immutable version, manifest, capabilities, service, payout, chain, expected owner/delegate, registry/resolvers, freshness policy, policy version, job, and effect. Every observed check stores typed `ALLOW`/`DENY`, canonical record bytes/hash, block/time/freshness, optional transaction hash, and the exact worker owner/epoch/claim version.

This is deterministic local fixture and disposable PostgreSQL evidence. No live ENS namespace, RPC, Registry, Resolver, CCIP gateway, wallet, transaction, gas, write, readback, explorer ID, or sponsor endpoint was contacted. Direct ENSv2 remains cut because the official deployment packet is not final. No ENSjs or ethers ENS path was added.

## Runtime authority

- A fresh check runs immediately before Compute service resolution, billing headers, request send, signature fetch, Storage write, and proof-enabled readback.
- A separate fresh `PRE_DELIVERY` check runs immediately before every normal or recovered receipt acceptance. Cached pre-execution `ALLOW` is never accepted for delivery.
- `RESPONSE_VERIFIED` resumes at Storage, `STORAGE_COMMITTED` resumes at readback, and `READBACK_VERIFIED` recovery invokes the adapter zero times. Ambiguous request markers remain non-replayable.
- Expired `READBACK_VERIFIED` jobs are requeued without exceeding the attempt bound, reclaimed under the new lease, freshly authorized for delivery, and then recovered without adapter replay.
- Authority resolution and check persistence are independently fenced by current lease owner, worker epoch, exact job claim version, and current expiry. A takeover during either authority phase cannot persist stale `ALLOW`.
- Wrong/missing/malformed/stale parent, agent, chain, version, manifest, capability, service, registry, resolver, owner/delegate, payout, policy, job, effect, replay, outage, or timeout is terminal. Pre-execution refusal creates zero Compute/Storage/verifier calls; pre-delivery refusal creates zero receipt/settlement/commission/rating/trade/replacement effect and exactly one refund.

## Database authority

Migration `20260724130000_ens_authority` has SHA-256 `6ceb7e8b220e7fee8e088e2f071326e92af8dadda0b3ee23687fdcb983a2d11d`. It adds:

- immutable `ens_authority_bindings` with relational lineage validation and bounded canonical fields;
- append-only `ens_authority_checks` with exact phases, operations, decisions, observations, and worker claims;
- non-null unique `receipts.authority_check_id`; and
- a receipt trigger requiring the latest fresh exact `PRE_DELIVERY ALLOW` for the same effect/job/agent version/binding/current claim.

The two disposable replay lanes both apply four finished migrations, verify eleven named invariant triggers, fourteen A4 constraints, the non-null Receipt authority column, and the unchanged synthetic Cannes sentinel SHA-256 `fb8aece1677586a330f0cfeb0850b71488849302324eb1d6a079673e35e3829e` with next sequence value `43`.

## Focused and recovery evidence

Six A4 tests pass:

1. twenty duplicate submissions converge to one intent/job/effect; seven fresh checks gate one A3 execution and one receipt/settlement/commission;
2. seventeen malformed, stale, forged, mismatched, replay, outage, and timeout cases produce zero A3 calls and one refund;
3. transfer during execution denies delivery after exactly one A3 execution, while `RESPONSE_VERIFIED` and `STORAGE_COMMITTED` resume without repeating completed work;
4. unchanged and transferred expired `READBACK_VERIFIED` recovery both invoke the adapter zero times and respectively succeed once or fail/refund once;
5. lease takeover during `PRE_EXECUTION` and `PRE_DELIVERY` persists no stale `ALLOW`, and the new owner alone completes lawful recovery; and
6. direct Receipt bypass, binding mutation, check deletion, and binding/check bounds are rejected by database triggers or constraints.

Combined integration passes 23/23 reported tests plus both migration lanes. Accepted A2 worker fencing and A3 strict verification remain green.

## Cold local gate

Toolchain: Node `v22.22.3`, npm `10.9.8`, Prisma/Client `6.19.3`, TypeScript `5.9.3`, Go `1.23.10`, PostgreSQL `14.23`, viem `2.47.6`. Lock SHA-256: `48b4006589371bba141b0b2233f9739beb83af13436cfae4ce6c9ddca8d473f3`.

| Command/check | Exit | Observed |
|---|---:|---|
| `npm ci --legacy-peer-deps` | 0 | 2,129 packages installed from the committed lock; inherited audit result remains 103 findings: 19 low, 41 moderate, 42 high, 1 critical. |
| `npx prisma validate` / `npx prisma generate` | 0 | Schema valid; Prisma Client `6.19.3` generated. |
| `npm run validate:env` | 0 | Offline protected defaults passed without secrets. |
| `npm run lint` | 0 | Zero errors; 23 inherited warnings and no A4 warning. |
| `npm run typecheck` | 0 | Strict TypeScript passed. |
| `npm test` | 0 | 9/9 foundation/pure kernel tests passed. |
| `npm run test:auth` | 0 | 7/7 authentication tests passed. |
| `npm run test:kernel` | 0 | 13/13 reported kernel tests passed. |
| `npm run test:go` | 0 | Three Go verifier tests passed and the production verifier built. |
| `npm run test:a3` | 0 | 12/12 A3 tests passed after widening the local stalled-operation timing budget to include the new authority checks; semantics are unchanged. |
| `npm run test:a4` | 0 | 6/6 focused authority tests passed. |
| `npm run test:integration` | 0 | 23/23 reported TypeScript tests plus both four-migration lanes passed. |
| `npm run test:e2e` | 0 | 4/4 protected CLI/boot/entrypoint tests passed. |
| `npm run test:resilience` | 0 | 1/1 generated-output cleanup test passed. |
| `npm run test:redaction` | 0 | 3/3 redaction tests passed. |
| `npm run test:boot` | 0 | Protected smoke booted with workers disabled and no sponsor credential. |
| `npm run scan:secrets` | 0 | No high-confidence tracked-file secret pattern. |
| `bash -n docker-entrypoint.sh` | 0 | Entrypoint syntax passed. |
| `npm run build` | 0 | Next `16.2.2` compiled, typechecked, and generated 31/31 static pages. |

## Remaining blocks

- An independent pinned-SHA A4 audit is required before A5 opens.
- `PASS_LIVE` is `NOT_RUN` and `LIVE_EFFECT_BLOCKED`; no live ENS write/readback or public identifier exists.
- Production A3 live execution remains intentionally unavailable. Rights/license/team/owner records, event-window classification, sponsor access/caps, inherited dependency findings, README claim drift, deployment, push, forms, and release audit remain unresolved.
- Stable local ENS causality does not establish ENS qualification, production readiness, release validity, Lisbon-window classification, or expected winnings.

External effects attempted: none. Sponsor calls: none. Managed/shared database effects: none. User signatures, network transactions, deployments, pushes, forms, funding, uploads, spend, mainnet value, public identifiers, live proof, and claim promotion: none.
