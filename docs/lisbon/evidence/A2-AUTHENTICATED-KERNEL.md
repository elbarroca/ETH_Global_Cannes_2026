# A2 Authenticated Commerce Kernel Evidence

- Task: `A2-AUTHENTICATED-KERNEL-20260724`
- Sprint: `A2`
- Start/control SHA: `31000c2467d3d197b6a733f51f15bdb28c4fe30b`
- Branch: `developer`
- Observed through: `2026-07-24T02:49:44Z`
- Exit SHA: derive from the commit containing this packet
- Result: `PASS_TO_AUDIT; LOCAL_ONLY; RELEASE_BLOCKED; LIVE_EFFECT_BLOCKED`

## Result and boundary

A2 implements a local, authenticated, fail-closed creator-to-buyer commerce kernel. Canonical SIWE challenges, one-time verification, hash-only opaque sessions, DB-only onboarding, immutable published agent versions, atomic idempotent job creation, deterministic effects, append-only events, exclusive financial outcomes, verified-receipt-only commissions, and a PostgreSQL-leased four-slot worker pass local tests.

Production execution deliberately terminates as `A3_NOT_CONFIGURED`. No 0G, Hedera, Circle, x402, OpenClaw, Telegram, Naryo, Fly, payment, trading, cached, local-response, or semantic fallback is an A2 execution path. The browser now obtains and signs the exact canonical challenge with its existing wagmi wallet capability before DB-only onboarding. The local gate signs only deterministic test messages with fixture private keys; it did not request a user signature or create a network transaction.

This is not release, production, live sponsor, managed/shared-database, or Lisbon-window proof. The effectful inherited `npm run validate` command was not executed.

## Authorization and scope

The writer started clean on exact SHA `31000c2467d3d197b6a733f51f15bdb28c4fe30b`, branch `developer`, then atomically acquired physical lock token `3920D88F-0B33-4764-B65B-864CD77B3BDD` and mirrored it as the first active record in `docs/lisbon/ACTIVE-WRITER.md` before product changes.

C0 later added exactly three paths so browser and legacy Express authentication could be closed end to end:

- `contexts/user-context.tsx`
- `lib/api.ts`
- `src/api/routes/onboard.ts`

No other scope expansion occurred. Two bounded read-only tasks supplied the implementation plan and the installed viem/import-boundary map; the sole writer made every repository mutation.

## Authentication evidence

| Boundary | Local evidence |
|---|---|
| Canonical challenge | Server-created message binds wallet, domain, chain ID, action, cryptographic 256-bit nonce, audience, URI, issued-at, and expiration; the exact message, hash, and every field are persisted. |
| Exact verification | Installed `viem@2.47.6` parsing/validation is supplemented by explicit chain, URI, version, issued-at, expiration, request-ID/action, audience, resource, exact-message, and message-hash comparisons. |
| One-time consumption | Signature validation happens before mutation; one conditional transaction consumes the challenge and creates a session. Replay returns `AUTH_CHALLENGE_REPLAYED`. |
| Negative paths | Malformed JSON, expired challenge, changed domain/chain/wallet/action/audience/URI, wrong signer, malformed signature, and literal `signature: "mock"` are rejected. Invalid attempts do not consume challenges or create sessions. |
| Session storage | The response token is 32 random bytes encoded base64url; only its SHA-256 is persisted. Cookie is `HttpOnly`, `SameSite=Lax`, path `/`, expiring, and `Secure` in production. Bearer is supported for non-browser clients. Cookie and bearer disagreement fails closed. |
| Identity | Mutating routes derive wallet/user from the session. Caller-owned `walletAddress`, `userId`, `createdBy`, and path identities are rejected before mutation or capability imports when they conflict. |
| Onboarding | A verified session creates or binds one legacy user row only. `proxy_wallet` remains `{}`, and iNFT/hot-wallet fields remain null. Link-code generation is database-only. No Circle wallet, placeholder wallet, or iNFT fallback runs. |
| Browser | `contexts/user-context.tsx` checks the current session, requests `/api/auth/siwe/challenge`, calls wagmi `signMessageAsync` on that exact message, verifies it, then calls `/api/onboard`. All former mock-auth calls/comments are removed. |
| Express | Inherited Express `/onboard` performs zero mutation and returns `AUTH_CANONICAL_FLOW_REQUIRED` with the canonical route paths. It imports no Circle/iNFT authentication fallback. |

`npm run test:auth` passed 5/5 tests. The cookie response contains no token field, and the persisted session value equals only SHA-256(token).

## Database and kernel evidence

The additive migration `20260724024500_authenticated_kernel` has SHA-256 `c4abe1be72d7e9dbd5e1c57b0b880afab4144916e3cca3e5bd80cf245feabfee`. It adds:

- `auth_challenges`, `auth_sessions`;
- `kernel_agents`, immutable `agent_versions` with canonical manifest/prompt/config hashes;
- atomic-unit `quotes`, `job_intents`, `kernel_orders`, `jobs`;
- append-only `job_events` and one deterministic `effects` identity per intent/job;
- `receipts`, `settlements`, `commissions`, `refunds`; and
- singleton `worker_leases`.

Seven database triggers enforce published-version immutability, append-only events, legal optimistic job transitions, legal/immutable terminal effects, verified-success-only settlement, settlement/refund exclusivity, and commission-after-matching-settlement. Foreign keys, unique buyer/idempotency keys, unique intent/order/job/effect links, atomic-unit checks, fixed adapter/proof policy, and bounded state checks are database constraints rather than request conventions.

`POST /api/kernel/agents` publishes one immutable v1 whose owner wallet, payout, price, asset, adapter, endpoint, connector, proof policy, and published state are server-derived. The client may submit only bounded name, description, instructions, and allowlisted capabilities.

`POST /api/kernel/jobs` accepts one bounded prompt plus a published version and `Idempotency-Key`. A transaction-scoped advisory lock serializes the buyer/key pair; one transaction creates or reuses exactly one Quote, JobIntent, Order, Job, initial JobEvent, and deterministic Effect. Twenty concurrent identical calls yielded one identity across all six records, with one non-replay response and nineteen replays. Reusing the key with different input fails `KERNEL_IDEMPOTENCY_MISMATCH`.

## Worker and recovery evidence

- One `kernel-worker` PostgreSQL lease owner is admitted at a time; a second live owner is rejected.
- Concurrency is validated from 1 through 4 and the worker claims at most four rows with `FOR UPDATE SKIP LOCKED`.
- Worker and claimed-job leases heartbeat together during real executions. The deterministic test proves the heartbeat prevents premature expiry, then expiry requeues after the extended deadline.
- Attempts are bounded at three. Cancellation is durable both before claim and while running; running cancellation records an optimistic event and terminalizes after lease reconciliation.
- The immutable agent version ID is stored on the job and loaded by the worker. Adapter selection is fixed to `protected-a3`.
- A crash before terminal persistence retries the same deterministic effect ID. The fixture adapter observed two calls but exactly one memoized external effect and one effect row.
- A crash after terminal effect plus verified receipt persistence leaves the job running. Restart reconciles that same job to success, settlement, and commission without invoking the adapter again or creating a second effect.
- Concurrent settlement versus refund produced exactly one settlement, zero refunds, and one commission. Failed/`A3_NOT_CONFIGURED` jobs produced refunds and zero receipts, settlements, or commissions.

`npm run test:kernel` passed 13/13 reported tests, including 10 nested end-to-end kernel subtests plus pure canonical/state tests.

## Protected legacy and startup boundary

Every A2-allowlisted inherited mutation route statically imports only Next.js, authentication, or type-only modules. It authenticates first, rejects forged identity, checks protected mode, and only then dynamically imports a legacy capability. The tested route set is configure, marketplace create/hire, cycle run/analyze/stream/approve/reject, deposit, withdraw, and trade execute. Eleven concurrent forged route calls returned `403`; before/after Quote, Intent, Order, Job, Effect, Receipt, Settlement, Commission, and Refund counts were identical. An unauthenticated money request returned `401`.

`src/index.ts` defaults to protected mode and statically imports no legacy sponsor capability. Legacy startup requires both `ALPHADAWG_RUNTIME_MODE=legacy` and `ENABLE_BACKGROUND_WORKERS=true`, then dynamically imports the inherited runtime. `instrumentation.ts` is observability-only and starts no long-lived worker per web instance. `docker-entrypoint.sh` executes only the canonical runtime. The kernel worker is separately opt-in and singleton-protected by PostgreSQL.

The protected boot smoke passed with sponsor credentials absent and no sponsor call. The production Next build also passed; inherited out-of-scope route modules emitted two OpenClaw missing-token warnings while Next collected page data, but no network call or legacy service start occurred. Those inherited routes are not A2 commerce authority and remain release-audit scope.

## Migration replay

The upgrade fixture now materializes only the inherited baseline SQL, rather than `prisma db push` against the latest schema, before marking the baseline resolved and deploying A2 forward. Both disposable PostgreSQL lanes verify both finished migrations, all A2 core relations, all seven triggers, the canonical sequence, and user counts.

The synthetic Cannes sentinel remains exactly:

- ID: `a1-cannes-sentinel`
- wallet: `0xa1cannessentinel`
- pre/post SHA-256: `fb8aece1677586a330f0cfeb0850b71488849302324eb1d6a079673e35e3829e`
- next sequence value after upgrade: `43`

This is still synthetic Cannes-shaped evidence, not a live Cannes dump or managed-database migration.

## Cold gate

Toolchain: Node `v22.22.3`, npm `10.9.8`, Prisma/Client `6.19.3`, TypeScript `5.9.3`, PostgreSQL `14.23`. The lock SHA-256 remains `b4a1aed30a52a74d1b4396da9f1d6535a5e475da1b40a99a6c744aae1a8c6b33`.

| Command/check | Exit | Observed |
|---|---:|---|
| `npm run clean:generated` | 0 | Removed only known generated paths before the cold gate. |
| `npm ci --legacy-peer-deps` | 0 | 2,129 packages installed; Prisma postinstall passed. The inherited 103 audit findings remain: 19 low, 41 moderate, 42 high, 1 critical. |
| `npx prisma validate` | 0 | Passed with non-connecting loopback `DATABASE_URL`/`DIRECT_URL`. The preceding empty-env invocation failed closed on missing `DIRECT_URL`, as expected. |
| `npx prisma generate` | 0 | Prisma Client `6.19.3` generated. |
| `npm run validate:env` | 0 | Offline protected defaults passed without sponsor/database secrets. |
| `npm run validate:env -- --require-database` | 0 | Loopback placeholder pair passed without connecting. |
| `npm run lint` | 0 | 0 errors and 23 inherited warnings; no A2 warning. |
| `npm run typecheck` | 0 | Strict TypeScript passed. |
| `npm test` | 0 | 9/9 foundation and pure kernel tests passed. |
| `npm run test:auth` | 0 | 5/5 SIWE/session/onboarding tests passed. |
| `npm run test:kernel` | 0 | 13/13 reported kernel/worker/concurrency/recovery tests passed. |
| `npm run test:integration` | 0 | 3/3 URL tests plus empty and synthetic upgrade migration lanes passed. |
| `npm run test:e2e` | 0 | 4/4 CLI/protected-boot/docker tests passed. |
| `npm run test:resilience` | 0 | 1/1 cleanup test passed. |
| `npm run test:redaction` | 0 | 3/3 secret/environment/auth redaction tests passed. |
| `npm run test:boot` | 0 | Protected smoke booted with legacy and kernel workers disabled and no sponsor credential. |
| `npm run scan:secrets` | 0 | No high-confidence pattern in tracked files. |
| `npm run build` | 0 | Next.js `16.2.2` compiled, typechecked, and generated 31/31 static pages with a deliberately non-live Dynamic UUID. |
| `bash -n docker-entrypoint.sh` | 0 | Entrypoint syntax passed. |
| `git diff --check` and exact allowlist scan | 0 | No whitespace defect or out-of-scope path. |

## Remaining blocks

- The production adapter is intentionally `A3_NOT_CONFIGURED`; no delivery, receipt, settlement, commission, or sponsor proof may be claimed from it.
- No live wallet/browser signing session, sponsor API, shared database, deployment, or external identifier was exercised. Browser code is build/type evidence only until authorized interactive validation.
- The inherited README first-viewport `~$27K Target Pool` wording remains an independently identified `RELEASE_CLAIM_DRIFT_BLOCKED` issue outside A2's allowlist. Expected winnings remain unproven with floor `$0`.
- Inherited npm audit findings, routes outside the A2 mutation allowlist, rights/license/team/owner records, event-window classification, sponsor access/caps, live proofs, deployment, and independent release audit remain unresolved.

External effects attempted: none. Sponsor calls: none. Managed/shared database effects: none. User signatures, transactions, forms, deployment, push, spend, mainnet value, and claim promotion: none.
