---
title: GOAL — AlphaDawg Continuity H0
tags:
  - goal
  - alphadawg
  - ethglobal/lisbon-2026
status: locked_until_official_H0
updated: 2026-07-16
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
---

# /goal AlphaDawg Continuity H0

## Lock

Do not execute this goal until the live ETHGlobal dashboard/schedule confirms the official Lisbon hacking window is open. Before that point, do not edit AlphaDawg, create a worktree/branch, install, generate, commit, push, deploy, sign, broadcast, spend, message, or submit.

## Objective

From the immutable Cannes baseline, build and prove a creator-owned marketplace for verifiable financial agents:

```text
creator connects -> defines bounded agent -> shared-runtime dry run
  -> publishes immutable version + ENS identity + encrypted Sui package
buyer resolves -> licenses -> quotes -> pays -> durable job -> shared worker
  -> 0G executes and independently verifies
  -> valid: deliver + creator commission + hired pack + receipt
  -> invalid: refund/recovery; no delivery, earnings, reputation, or action
```

Replace per-agent Fly/OpenClaw-era identity with one shared local/hosted worker plane. User-created agents must execute in the real orchestrator; hiring must be a paid job, and earnings must derive from confirmed settlement.

## Exact Context

- Product repo: `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Cannes_2026`
- Research vault: `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault`
- Baseline: `bfa7bd37c573e2e49525d965f7f937210e170d72`
- Prior prototype: removed, non-qualifying; never copy or cherry-pick it.
- Controlling plan: `strategy/alphadawg/ALPHADAWG_LISBON_MASTER.md`
- Supporting audit: `strategy/alphadawg/10_AlphaDawg_Current_Engineering_Audit.md`
- Live ledger: `strategy/dual-project/02_Lisbon_Live_Track_Ledger.md`
- Separation contract: `strategy/dual-project/01_Provenance_and_Team_Separation.md`

Current frontier: checkout was clean at the baseline on 2026-07-16. Contributor consent, complete OSI license, changed-team approval, live 0G/ENS/Sui access, settlement configuration, and Sui/Uniswap submission mechanics remain blocked or unverified. The inherited quality baseline is red: lint and typecheck fail, no test script exists, three package commands reference missing files, and production dependency advisories require triage.

## Baseline Repository Truth

All anchors below refer to `bfa7bd37c573e2e49525d965f7f937210e170d72`. Reinspect before editing; do not assume line numbers survive later commits.

| priority | baseline path / symbol | wrong today | required correction | proof that closes it |
|---|---|---|---|---|
| P0 | `app/api/onboard/route.ts:20-42` | Existing users are returned before any signature check; new users may omit a signature or send `"mock"`. | One-time EIP-4361-style challenge, consumed server-side; signed session required for every owner or money mutation. | Missing, forged, expired, wrong-domain, wrong-chain, replayed, and `"mock"` proofs all return 401 and produce zero writes. |
| P0 | `contexts/user-context.tsx:131-181` | Client automatically onboards with `"mock"`. | Request challenge, ask connected wallet to sign, exchange for `HttpOnly` session; keep mock auth inside tests only. | Browser connect creates one verified session; no request body can select another wallet/user. |
| P0 | `app/api/withdraw`, `deposit`, `trade/execute`, `cycle/**`, and `marketplace/**` | Mutating routes trust caller-supplied `userId`; ownership checks compare two untrusted strings. | Central `requireSession()`/`requireWalletOwner()` boundary; derive user from session and authorize the resource. | Cross-user withdraw, trade, hire, fire, publish, cycle approval, and read tests fail before any external call. |
| P0 | `app/api/marketplace/create/route.ts:18,46,78-94` | Caller chooses `createdBy`; row is immediately active with `local://user-created`, string price, and no executable version. | Authenticated `DRAFT`; immutable `AgentVersion`; atomic price; validation; real shared-worker dry run; explicit publish transaction. | Draft is undiscoverable; published version runs by ID after restart and cannot be edited. |
| P0 | `components/create-agent-modal.tsx:25-35,77-89,114-119,230-233` | Tools are UI-only, “deploy” is a DB insert, and non-fallback output displays a sealed badge without requiring `teeVerified`. | Draft -> Validate -> Dry Run -> Publish state UI; server-owned connector IDs; render verified status from authoritative result only. | Unverified generation cannot enable Publish; arbitrary tool ID and edited post-proof prompt are rejected. |
| P0 | `app/api/marketplace/hire/route.ts:24-30` | “Hire” is only a `UserHiredAgent` upsert. | Version-bound quote, settlement, durable job, proof, delivery/refund, creator commission, receipt; pack activation is separate. | One buyer payment produces one job/result/commission; paid failure produces refund/recovery and zero earnings. |
| P0 | `app/api/marketplace/earnings/route.ts:27-39` | Sums every `SPECIALIST_HIRED` text amount as `double precision`; does not require payment hash/finality or creator ownership. | Query finalized `CommissionEntry` by authenticated owner, asset, and network using atomic integer/decimal values. | Unpaid, failed, refunded, duplicate, other-owner, and `no-payment` rows add zero earnings. |
| P0 | `src/agents/role-manifests.ts:49-97` and `src/marketplace/hiring-strategy.ts:11-49` | Agent selection is a static name pool; `UserHiredAgent` does not control the real swarm. | Database eligibility query over exact published versions, capabilities, health, proof, price, license, and active pack; store selection trace. | A user-created hired version is selected without a source/config edit; fired/revoked/unhealthy version is excluded. |
| P0 | `src/agents/hire-specialist.ts:89-102,107-117,173-198` | Missing agent/network/payment failures become priced HOLD results; raw `fetch` silently replaces x402; result returns `$0.001` even with `no-payment`. | Discriminated `EXECUTION_FAILED` result with no paid/verified value; payment precondition is fatal for paid jobs. | Network/402/invalid JSON/missing payment never reaches debate input, earnings, or reputation. |
| P0 | `src/agents/fly-agent-server.ts:126-170,214-266` | Server runs unpaywalled when seller config fails and returns local fallback as HTTP success. | Invalid paid-agent config makes the version `UNAVAILABLE`; remove semantic fallback from authoritative execution. | Startup/config and 0G failures produce explicit terminal codes and no delivery/commission. |
| P0 | `src/agents/main-agent.ts:788-839` | Hierarchical flattening forcibly writes `teeVerified: false` even when the specialist returned proof, then logs it as hired. | Preserve a typed verified result; bind each downstream agent input to upstream receipt hashes; reject unverified nodes. | Tampering any specialist, Alpha, Risk, or Executor node prevents the dependent node and final action. |
| P0 | `src/og/inference.ts:95-114` | Verification is non-fatal; content is returned when verification fails. The code is coupled to `@0glabs/0g-serving-broker@0.7.4`. | Event-time SDK compatibility spike; one `VerifiedInferencePort`; require successful `processResponse` for authoritative work and bind application envelope hashes. | Missing/false/null verification produces no `value`; live provider smoke records provider/model/chat ID/proof without secrets. |
| P0 | `src/og/storage.ts:21-77` | Arbitrary unknown payload is stored; readback uses `indexer.download(rootHash, ..., false)`, disabling Merkle-proof verification. | Redacted versioned receipt schema; current Storage SDK; download with proof enabled; recompute/compare canonical payload hash/root. | One-byte blob/receipt mutation or wrong root fails readback and blocks receipt finalization. |
| P0 | `contracts/MockSwapRouter.sol`, `contracts/AlphaDawgSwap.sol`, `src/execution/arc-swap.ts` | “Uniswap” names/ABI compatibility mask a custom/mock AMM; failed swap falls back to a self-transfer reported as success; `amountOutMinimum = 0`. | Do not count inherited router as Uniswap. Add actual Uniswap API/Permit2/Universal Router or protocol integration plus reusable agent-intent tooling; failed/reverted swap stays failed. | Official request/route/contract/tx evidence, decoded policy checks, non-empty calldata, simulation, user signature, status reconciliation, and negative tests. |
| P0 | whole repo | No Sui/Move/Walrus/Seal code or dependencies; Sui CLI is absent locally. | Add current locked `@mysten/sui`, `@mysten/walrus`, `@mysten/seal`, minimal Move package, Testnet config, and live-gated test harness after H0. | Shared worker executes encrypted agent only with a valid job-bound Sui permit; revoke/expiry/version mismatch blocks before 0G. |
| P1 | `src/marketplace/registry.ts:27-65,257-279` | Process-local `Map` can be stale and boot auto-registers ten localhost agents with derived wallets. | PostgreSQL is authority; built-ins are immutable seed versions; no runtime registration side effect. | Two worker processes see identical versions/status; restart creates no duplicate/mutated agents. |
| P1 | `src/config/agent-registry.ts` and `lib/swarm-endpoints.ts` | Two static registries and thirteen fixed ports/Fly URLs are sources of truth. | One DB-backed version directory and one shared-worker endpoint; retain legacy URLs only in the shadow fixture. | New agent executes locally/deployed with no new port, URL, mnemonic, or container. |
| P1 | `src/og/inference.ts:4-29` | Module-global concurrency counter is neither a distributed rate limiter nor job budget; delayed callbacks are not cancellation-aware. | DB worker leases plus provider token bucket, absolute job deadline, abort propagation, per-owner and global quotas. | Concurrent worker test stays within configured 0G request/rate/cost limits and cancels queued expired jobs. |
| P1 | `src/agents/main-agent.ts:842-849` and other fire-and-forget evidence writes | Process exit can lose sponsor evidence after the user-visible cycle completes. | Durable outbox event claimed by worker; receipt is final only after required proof/storage effects reconcile. | Kill process after inference; restart completes the same effect ID without duplicate upload/payment. |
| P1 | `prisma/schema.prisma` | Money uses strings/floats; `(userId, cycleNumber)` is indexed not unique; marketplace `updatedAt` is not `@updatedAt`; paid history can cascade with marketplace deletion. | Atomic money, uniqueness/idempotency keys, optimistic state version, restrictive deletes, immutable evidence, migration history. | Empty and Cannes-shaped migration tests; duplicate/concurrent writes resolve to one authoritative row/effect. |
| P1 | `package.json` | No `test`/`typecheck`; three scripts reference missing files; wildcard runtime dependencies; current documented 0G SDK package names differ from installed packages. | Exact locked dependency compatibility plan; restore/remove broken scripts; real test/typecheck/clean commands; no force audit upgrade. | `npm ci` plus full command gate passes from a clean clone and lockfile. |

Inherited lint/type failures are not cosmetic. Fix repository health before sponsor modules so later failures are attributable to Lisbon changes.

## Track Contract

- **Commit:** 0G Keep Building, individual cap $1,500.
- **Commit:** ENS Best Continuity Integration, individual cap $2,000; Sunday-morning booth is mandatory.
- **H20-gated third:** Sui Existing App, individual cap $2,000, only for encrypted package ownership/licensing that causally gates the real shared worker.
- **Selected ceiling:** 0G + ENS + Sui = $5,500; financial floor $0.
- **Mandatory engineering validation requested:** 0G Keep Building, Sui Existing App, and Uniswap Stack must each receive an evidence-backed `GO`, `NARROW`, or `NO_GO` decision. Validation does not authorize a fourth submission claim.
- **Alternate only:** Uniswap Stack may replace **Sui only** through an explicit H20 track-lock commit after Sui is dropped and Uniswap's contribution/form/evidence gates pass. ENS remains mandatory for final publication/discovery. Never claim four partner prizes.
- **Not selected:** Hedera. Preserve inherited code honestly but spend no Lisbon critical-path time or prize slot on it.
- Never sum same-partner awards without written confirmation. The Graph and World count $0 until their tracks publish.

> [!warning] Eligibility is not an SDK-import test
> 0G must verify the real inter-agent result; Sui must permit or deny the real private-agent execution; Uniswap must execute through actual Uniswap infrastructure and produce reusable open-source tooling. A UI badge, copied ABI, blob upload, mock transaction, provider response ID, or database boolean is `NO_GO`.

## H0 Preconditions

1. Record live H0, deadline, rules, AI disclosure, categories, demo/video, booth, and partner-selection limits.
2. Confirm former-contributor consent, license, attribution/prize treatment, changed-team admission, and disclosed Cannes baseline.
3. Confirm 0G + ENS + Sui Continuity treatment; owner-controlled ENS name/subname/write/resolve/booth path; Sui Testnet/Move/Walrus/Seal access and exact licensing claim.
4. Verify exact clean SHA, remotes, branch divergence, and absence of pre-event product work.
5. Confirm testnet-only spend cap and redacted account manifest.
6. Compare installed 0G packages with event-time official packages/APIs and lock a tested migration or compatibility decision; do not code against recalled signatures.
7. Verify Sui CLI/runtime availability, current SDK peer compatibility, Testnet gRPC, gas, Walrus publisher/aggregator, Seal key-server configuration, and a dedicated least-privilege worker signer.
8. Preflight an actual Uniswap API key, supported demo chain/assets, RPC, wallet, official contract/address source, `FEEDBACK.md`, and mandatory feedback form. The inherited `ARC_UNISWAP_ROUTER` is not proof.
9. Record Sui as the H20-gated third; record Uniswap Stack as a tested replacement candidate. A switch requires an explicit track-lock commit and removal of the displaced claim.

If rights, H0, baseline, or core category gates fail, remain `BLOCKED`; continue only safe documentation and evidence planning.

## Event-Window Setup

After every blocking H0 gate passes:

1. Create a new `feat/lisbon-event-window` worktree/branch from the exact baseline.
2. Commit provenance/control docs first: baseline, Lisbon changelog, track matrix, evidence ledger, architecture, AI disclosure, threat model, and fresh-clone guide.
3. Reproduce inherited install/lint/typecheck/test/build/validator state; separate inherited failures from Lisbon changes.
4. Run bounded 0G provider/verification/storage, ENS owner/write/resolve, Sui gRPC/gas/Move-build, Walrus/Seal, Uniswap key/quote, and settlement-port preflights without printing secrets or performing unapproved value movement.

## Planned Change Boundary

- `src/auth/wallet-challenge.ts`
- `src/agent-runtime/{manifest,execute,verified-inference,worker,worker-entry,connector-registry,selection,agent-card}.ts`
- `src/commerce/{schemas,state-machine,quote,settlement,commission,receipt}.ts`
- `src/og/{inference,storage}.ts`
- `src/identity/ens/{records,publisher,resolver}.ts`
- `src/integrations/sui/{types,client,package,walrus,seal,execution-permit}.ts`
- `move/alphadawg_license/**`
- `packages/uniswap-agent-executor/src/{types,canonicalize,policy,client,execute,status}.ts` only after Uniswap track lock
- `examples/uniswap-verified-agent/**` only after Uniswap track lock
- additive Prisma models/migrations and focused API/UI seams
- `tests/{unit,integration,e2e,live-gated}/**`
- `evidence/lisbon/**`

Match repository style. Use strict types and runtime validation at external boundaries. User agents are declarative immutable versions only: prompt, task/output schemas, allowlisted connectors, proof policy, price, owner, and payout. No arbitrary code, shell, unrestricted URL/tool, private key, or mainnet authority.

## Non-Negotiable Code Architecture

1. **PostgreSQL is authoritative.** No process-local registry decides published versions, hires, money, proof, licenses, or reputation.
2. **One long-running worker executes every agent.** Web routes validate/authenticate/enqueue and return quickly; they never wait through the full 0G/Sui/Uniswap lifecycle.
3. **Every execution names an immutable `agentVersionId`.** No endpoint, port, container, mutable prompt, or display name is execution identity.
4. **Every external response is `unknown` until parsed.** Runtime schemas/types cover HTTP JSON, 0G, Sui objects/events, Walrus payloads, Seal results, Uniswap responses, and settlement records.
5. **No success fallback at authority boundaries.** Preview fallback may be displayed as unverified; it cannot publish, enter debate, move funds, earn, score reputation, or satisfy a bounty.
6. **Effects are prepare -> persist -> broadcast -> reconcile.** Payment, refund, ENS/Sui writes, 0G Storage upload, and Uniswap broadcast use deterministic effect IDs and never create a second effect after timeout/restart.
7. **Models never sign.** Wallet users sign ownership, Sui permit, Permit2/order/transaction, or explicit approval. Workers hold only the narrowly scoped server keys needed for 0G/Sui service execution.
8. **Private agent plaintext is job-scoped.** It may exist in worker memory only after Sui/Seal approval; never in Prisma, logs, analytics, receipts, browser state, or 0G/Walrus plaintext.
9. **Sponsor evidence is part of state.** A run cannot reach `RECEIPTED` until required 0G proof/storage and selected Sui/Uniswap identifiers have reconciled.
10. **No unrelated rewrite.** Preserve the Cannes baseline for disclosure and shadow comparison; replace only runtime authority paths and their direct UI/API consumers.

## Exact Engineering Task Packets

Each packet ends in one incremental commit with tests and an evidence entry. Do not combine packets into one late bulk commit.

Execution order for a single engineer is **A -> C -> B -> D -> E -> F gate -> H to `READY_TO_PUBLISH` -> ENS to `PUBLISHED` -> I**. The headings are reference IDs, not permission to run alphabetically. Packet C must create/migrate `AuthChallenge` and ownership constraints before Packet B persists challenges/sessions. Packet G is skipped unless Sui is formally dropped by H20 and Uniswap's contribution/form/live gates are already green; it never replaces ENS.

### Packet A — deterministic repository baseline

**Change**

- Add `clean:generated`, `typecheck`, `test`, `test:integration`, `test:e2e`, `worker`, and live-gated smoke scripts.
- Delete generated `.next` state through `clean:generated`; never patch `.next/types/validator.ts`.
- Fix the 23 lint errors at their source. Configure Hardhat intentionally instead of globally disabling rules.
- Restore or remove `migrate`, `setup:gateway`, and `validate:x402`, whose target files are absent.
- Pin every wildcard runtime dependency. Upgrade reviewed dependency groups separately; no `npm audit fix --force`.
- Add committed Prisma migration baseline, clean-install CI, and typed `webEnv`/`workerEnv`/track env loaders.

**Do not**

- Change product behavior while repairing React lint.
- replace `npm`/`package-lock.json` with another package manager;
- claim the 73 audit findings are all exploitable or all fixed without reachability and smoke evidence.

**Gate**

```bash
npm ci
npm run clean:generated
npx prisma validate
npx prisma generate
npm run lint
npm run typecheck
npm test
```

### Packet B — authenticated ownership and route authorization

**Create**

- `src/auth/wallet-challenge.ts`: create/verify/consume a hashed nonce bound to wallet, domain, URI, chain ID, action, issued time, expiry, and request ID.
- `src/auth/session.ts`: signed/encrypted `HttpOnly`, `Secure`, `SameSite=Lax` session with rotation and expiry.
- `src/auth/require-session.ts`: return authenticated user/wallet or a typed 401/403; never accept `userId` as authority.
- `app/api/auth/challenge/route.ts` and `app/api/auth/verify/route.ts`.

**Replace**

- Remove production `"mock"` calls from `contexts/user-context.tsx`.
- Make existing and new onboarding verify before returning identifiers/link codes or creating Circle/0G state.
- Apply session/resource ownership to all mutating money, cycle, chat, and marketplace routes touched by the demo.

**Tests**

- replay, expiry, wrong chain/domain/action/wallet, malformed signature, concurrent consume, session fixation, cross-user resource access;
- assert Circle, 0G, Sui, Uniswap, database mutation, and link-code spies remain at zero on authorization failure.

### Packet C — immutable agent and commerce schema

**Add models/constraints**

- `AuthChallenge`; owner-scoped `MarketplaceAgent`; immutable `AgentVersion`; `AgentIdentity`;
- `HireOrder`; one `AgentJob` per order; append-only `CommerceEvent`; `Settlement`; `CommissionEntry`; `ReputationEvent`; `Receipt`; durable `OutboxEffect`;
- Sui references on identity/version: package object, policy version, Walrus blob ID, encryption ID, current permit status; Uniswap references only on action receipts;
- unique owner/slug, agent/version, manifest hash, order/idempotency key, order/settlement, order/commission, order/receipt, and aggregate/transition/effect ID;
- `stateVersion` for optimistic transitions and restrictive deletes for paid evidence.

**Money**

- Boundary type is `{ networkId, assetId, amountAtomic: string, decimals }`.
- Database uses exact integer/decimal representation. Never use `$0.001`, JavaScript float, or double precision for settlement/commission truth.

**Migration**

- Preserve existing built-ins and historical cycles.
- Convert built-ins to seeded versioned manifests without auto-registering them at process boot.
- Do not reinterpret historical action rows as finalized commissions.

**Tests**

- empty DB and Cannes-shaped DB migration;
- published immutability; duplicate quote/order/job/effect; concurrent transition; archive without history deletion; owner-scoped same slug.

### Packet D — shared worker and inter-agent receipt DAG

**Worker claim algorithm**

1. Claim one eligible job in a short transaction with `FOR UPDATE SKIP LOCKED`; write `leaseOwner`, `leaseExpiresAt`, attempt, and transition event.
2. Outside the transaction, load exact version, owner, payment, capabilities, connector policy, Sui permit, and absolute deadline.
3. Run allowlisted connectors and the verified 0G call with a shared `AbortSignal` and cost budget.
4. Re-lock job, require matching lease/state version, persist hashes/evidence, enqueue remaining external effects.
5. On crash, lease expiry resumes the same job/effect IDs. On cancellation/deadline, do not launch a new connector/model/economic effect.

**Inter-agent graph**

```text
specialist receipt(s)
  -> Alpha envelope binds specialist receipt hashes
  -> Risk envelope binds Alpha + defensive specialist receipt hashes
  -> Executor envelope binds Alpha + Risk + optional tiebreaker hashes
  -> approved action binds Executor receipt + user approval
```

- A node is consumable only when its schema and 0G verification pass.
- Keep prompt/private manifest out of downstream nodes; pass typed result plus receipt hash.
- Replace `selectForRole()` static pools with a query over active pack/public published versions and a stored deterministic selection trace.
- Remove `callSpecialist()` priced HOLD results. Failure is data, not a synthetic market opinion.
- Shadow legacy Fly endpoints only with value movement disabled; retire them after two shared-worker parity/restart runs.

**Tests**

- two workers claim one job once; lease expiry; process kill after provider response and after effect broadcast; cancellation; connector timeout; cost ceiling;
- user-created private specialist is selected by Alpha, produces a verified receipt, and is consumed by Alpha without a new URL/port/config entry;
- corrupt specialist receipt prevents Alpha; corrupt Alpha prevents Risk/Executor; no commission or trade follows.

### Packet E — strict 0G Compute and Storage

**SDK decision**

- Installed baseline uses `@0glabs/0g-serving-broker@0.7.4` and `@0gfoundation/0g-ts-sdk`; current official docs use the split Compute and Storage packages. At H0, inspect exact current exports/peer dependencies and choose one tested migration. Record the decision and lock exact versions.
- Do not keep two active 0G inference implementations. One adapter owns provider discovery, request headers, response parsing, `processResponse`, timeouts, retries, and redacted evidence.

**Inference contract**

```ts
type Verified<T> = Readonly<{
  ok: true;
  value: T;
  providerAddress: `0x${string}`;
  modelId: string;
  chatId: string;
  requestEnvelopeHash: `0x${string}`;
  outputHash: `0x${string}`;
}>;

type VerificationFailure = Readonly<{
  ok: false;
  code:
    | "PROVIDER_UNAVAILABLE"
    | "INVALID_RESPONSE"
    | "MISSING_CHAT_ID"
    | "TEE_VERIFICATION_FAILED"
    | "OUTPUT_SCHEMA_FAILED"
    | "ENVELOPE_MISMATCH"
    | "DEADLINE_EXCEEDED";
  retryable: boolean;
}>;
```

- The project may use the documented chatbot body ID fallback if the chosen event-time SDK/provider supports it, but `processResponse(...) === true` remains mandatory for authoritative work. A response ID by itself is never an attestation claim.
- Canonical application envelope binds job/order, agent/version/manifest, owner, task/input, connector snapshot hashes, system/tool/output policy versions, provider/model, deadline, upstream receipt hashes, and output hash.
- Remove hierarchical `teeVerified: false` overwrite and every authority path that accepts `false`, `null`, missing proof, `local-fallback`, `error`, or `chatcmpl-*` as verified.

**Storage contract**

- Persist a redacted `RunReceiptV1`; call `merkleTree()` if required by the chosen SDK; retain upload transaction/root; download with proof verification enabled; parse schema; recompute canonical payload hash.
- `storeMemory(userId, unknown)` must not be the new receipt API. Private prompt/Sui plaintext, API keys, wallet data, PII, signed raw transactions, and secrets are forbidden.
- Use durable outbox/reconciliation rather than fire-and-forget uploads.

**Tests/evidence**

- live provider health and one verified call;
- missing/false/null proof, wrong provider, wrong chat ID, output/schema/envelope/upstream-hash tamper;
- Storage upload, proof-enabled readback, wrong root, corrupted payload, worker restart;
- resulting receipt roots/transactions and under-three-minute 0G demo tied to Lisbon commits.

### Packet F — Sui as a real inter-agent execution license

Implement this packet as a spike before building extra UI. Sui is retained only when it passes the causal gate.

**Two-phase package publication**

1. Creator publishes a draft `AgentPackage` object to obtain a stable object/encryption ID bound to `agentVersionId`, `versionHash`, `manifestHash`, owner, and policy version.
2. Client encrypts the declarative private manifest with Seal using the deployed Move package and that stable ID.
3. Upload ciphertext—not plaintext—to Walrus; record blob ID and ciphertext hash.
4. Creator finalizes `AgentPackage` with blob ID/ciphertext hash. A finalized version is immutable; changes create a new AlphaDawg version and Sui package/version.

**Move state**

- `AgentPackage`: owner, AlphaDawg agent/version hash, manifest hash, Walrus blob ID, ciphertext hash, policy version, active/finalized flags.
- `ExecutionPermit`: package ID, buyer, dedicated worker address, task/job hash, allowed capability, expiry, revoked state.
- Entry functions: create draft, finalize, issue permit, revoke permit, deactivate/supersede package.
- `seal_approve` checks finalized/active package, exact package/version/task hash, permit worker equals transaction sender, buyer/license authority, expiry from `Clock`, and revoked state.
- Emit events with package/version/permit/job hashes, never private manifest content.

**Worker integration**

```ts
interface SuiExecutionGate {
  resolvePackage(ref: SuiPackageRef, signal: AbortSignal): Promise<ResolvedPackage>;
  authorizePermit(input: JobBoundPermit, signal: AbortSignal): Promise<PermitDecision>;
  decryptManifest(
    input: AuthorizedCiphertext,
    signal: AbortSignal,
  ): Promise<Uint8Array>;
}
```

1. Select exact private `AgentVersion`.
2. Resolve Sui package/permit over `SuiGrpcClient`; compare owner/version/manifest/task/worker/expiry/revocation.
3. Fetch Walrus blob; prove it is ciphertext and its hash matches Sui state.
4. Create short-lived Seal `SessionKey` with the dedicated worker signer; build the approval transaction; decrypt only after permit authorization.
5. Parse canonical manifest, compare manifest hash, execute through the same 0G worker, zero/discard plaintext/session references, and persist only public hashes/IDs.
6. Risk/Executor receive typed verified output/receipt hashes, never the private prompt.

**Required automated test: `tests/integration/sui/inter-agent-license.test.ts`**

- Alpha's eligible pack includes one private Sui-backed specialist.
- Valid job-bound permit -> one Seal decrypt -> one 0G call -> verified specialist receipt -> Alpha consumes receipt.
- Wrong buyer, worker, package, version, manifest, task hash, capability, expired or revoked permit -> zero decrypt and zero 0G calls.
- Duplicate workers/job attempts -> at most one execution lease; same permit cannot create two paid/commissioned results.
- Logs/database/0G/Walrus scan contains no plaintext sentinel seeded into the private prompt.

**Required live test: `tests/live-gated/sui-inter-agent.smoke.ts`**

```text
publish Move package -> create AgentPackage draft -> Seal encrypt
  -> Walrus upload/readback -> finalize -> issue job permit
  -> shared worker decrypts -> 0G verifies specialist -> Alpha consumes receipt
  -> revoke permit -> rerun exact package/task -> denied before Seal/0G
```

Record Sui package/object/permit/transaction IDs, Walrus blob ID, Seal key-server set/config hash, AlphaDawg version/job, 0G proof/root, and deny reason. Never record keys.

**Sui `NO_GO`**

- Walrus-only profile/receipt upload;
- plaintext blob;
- license checked only in UI/database;
- buyer can bypass the Move/Seal check by calling another endpoint;
- worker decrypts before chain authorization;
- revocation does not change the real job outcome;
- demo lacks Testnet IDs or a working integration.

### Packet G — actual Uniswap stack contribution

Do not modify the inherited custom Arc AMM to look more like Uniswap. It is baseline evidence of what must be replaced, not qualifying Uniswap work.

**Contribution thesis**

Build a reusable `uniswap-agent-executor`: a fail-closed bridge from a verified agent intent to user-authorized Uniswap execution. AlphaDawg is the example consumer; the package must not import AlphaDawg database/UI modules.

**Public API**

```ts
export type VerifiedAgentIntent = Readonly<{
  intentId: `0x${string}`;
  proofReceiptHash: `0x${string}`;
  chainId: number;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountInAtomic: string;
  maxSlippageBps: number;
  recipient: `0x${string}`;
  deadline: number;
  allowedRouting: readonly UniswapRouting[];
}>;
```

**Implementation**

1. Canonicalize/hash the exact verified intent; require matching final 0G Executor receipt and explicit user approval.
2. Server-side client holds the Uniswap API key and implements `/check_approval`, `/quote`, `/swap`, `/order`, `/swaps`, and `/orders`; CHAINED routes use `/plan` or fail closed if not supported.
3. Exhaustively parse `CLASSIC`, `DUTCH_V2`, `DUTCH_V3`, `PRIORITY`, `WRAP`, `UNWRAP`, `BRIDGE`, `CHAINED`, and unknown routing.
4. Validate quote freshness, supported chain/assets, exact swapper/recipient, amount ceiling, slippage, deadline, Permit2 token/amount/spender/expiration/sigDeadline, transaction `from`/`to`/chain/value, non-empty unmodified calldata, and official target/address source.
5. Simulate before wallet signature/broadcast. The connected user wallet signs approval, Permit2, order, or transaction; the agent/worker never signs with the user's key.
6. Persist request ID, quote/intent/transaction hashes, route, approval, user approval, broadcast hash, and terminal `/swaps` or `/orders` reconciliation.
7. Remove self-transfer success and `amountOutMinimum = 0` from any path presented as authoritative execution.

**Tests**

- schema fuzz/property cases for atomic values and canonical hash;
- wrong chain/token/recipient/spender/target/from, excessive amount/slippage, expired quote/deadline, empty or modified data, unsupported/unknown/CHAINED route;
- 401/429/500/503 backoff bounded by deadline; no quote; simulation revert; user rejection; broadcast timeout/reconciliation; duplicate submit;
- assert signer/broadcast counter is zero for every policy failure;
- one real supported-network transaction/order and explorer/status evidence when selected.

**Track evidence**

- public open-source package with named exports and standalone README;
- `examples/uniswap-verified-agent` consuming it without private AlphaDawg imports;
- `FEEDBACK.md`, completed mandatory developer form containing its link, exact README file/line pointers, and real execution evidence;
- contribution explanation: reusable proof-bound agent intent/policy/execution tool for the broader Uniswap ecosystem, not just a private API call.

**Uniswap `NO_GO`**

- `AlphaDawgSwap.sol`, `MockSwapRouter.sol`, ABI compatibility, self-transfer, or a fabricated tx hash used as Uniswap evidence;
- API key absent, feedback form inaccessible/unsubmitted, no `FEEDBACK.md`, no reusable example, no actual Uniswap route/contract/transaction, or user key held by the worker;
- only a screenshot/quote with no executed or reconciled lifecycle.

### Packet H — marketplace completion and optimized selection

- Replace `CreateAgentModal` with explicit server-backed steps; no fake progress animation determines state.
- Owner, schema, connector policy, real dry run, 0G proof, payout, and selected Sui requirements may move a version only to `READY_TO_PUBLISH`. Final `PUBLISHED` requires the mandatory ENS owner/version/service/payout records to resolve and match the canonical manifest.
- Quote binds buyer, exact version/task/input, price asset/network/amount, creator payee, expiry, nonce, and idempotency key.
- Rank only eligible versions. Store considered/rejected versions and reason codes. Use conservative verified-success prior, p95 latency, exact price, freshness, and task fit; social likes remain separate.
- Add indexes for job claim `(state, availableAt, createdAt)`, lease recovery `(state, leaseExpiresAt)`, marketplace capability/status, owner/slug, order idempotency, and event/effect uniqueness. Confirm query plans with realistic fixtures.
- Remove registry boot upserts, hard-coded runtime URLs, 3-second/10-second polling where event or focused revalidation is available, and N+1 marketplace lookups on the demo path.
- Split server-only sponsor SDK imports from client bundles. Never import 0G/Sui/Uniswap server clients into client components.

**Budgets**

- Web enqueue/quote/read route p95 under 500 ms excluding third-party quote latency; long work never occupies a serverless request.
- One absolute job deadline; connector, Seal, 0G, Storage, and settlement sub-deadlines sum below it.
- Bounded worker concurrency and provider rate/cost budget; no unbounded `Promise.all` or retry loop.
- One database round trip for eligibility page plus bounded aggregates; no per-card remote health call.
- Logs use IDs/hashes/error codes, not full provider payloads or secrets.

### Packet I — evidence, documentation, and eligibility audit

- Add root OSI `LICENSE`, `CHANGELOG-LISBON.md`, `docs/lisbon/PREEXISTING.md`, `ARCHITECTURE.md`, `THREAT-MODEL.md`, `TRACK-EVIDENCE.md`, `FRESH-CLONE.md`, and Uniswap `FEEDBACK.md` only if selected.
- Map every requirement to event-window commit, exact file/symbol, deterministic test, live identifier, explorer/status URL, demo timestamp, README pointer, and submission field.
- Keep inherited and Lisbon identifiers separate. Capture failed/tamper/revoke/refund evidence, not only success.
- Never call the repository eligible from code inspection alone. Eligibility is `GO` only after all mandatory public/live/form/booth/video requirements pass.

## Hour Gates

- H0–H4: Sprint 1—make clean install, migrations, lint, typecheck, tests, scripts, env validation, lockfile, and CI deterministic.
- H4–H9: Sprint 2—wallet ownership challenge, immutable AgentVersion/identity/order/job/event/settlement/commission/receipt models and idempotent state machines.
- H9–H15: Sprint 3—one shared leased worker, bounded connectors, built-in/new-agent execution, fatal 0G verification, Storage receipt, Fly/OpenClaw-independent path.
- H15–H20: Sprint 4—Move package + encrypted Walrus package + Seal license; licensed shared-worker run and revoked denial. Cut Sui at H20 if it is not causal.
- H20 track lock: record `0G`, `ENS`, `Sui`, and `Uniswap` engineering eligibility verdicts. Default claims are 0G + ENS + Sui. Uniswap may replace Sui only when Sui is dropped and the reusable executor/example/form/live lifecycle are already green; otherwise Packet G stays unselected and submit 0G + ENS.
- H20–H26: Sprint 5—Draft/Validate/Dry Run reaches `READY_TO_PUBLISH`; quote/payment/job/delivery/refund/creator commission and real hired-pack selection work. Do not call the version `PUBLISHED` yet.
- H26–H30: Sprint 6—ENS subname/records/runtime binding is mandatory and moves `READY_TO_PUBLISH -> PUBLISHED`. One engineer does not begin a new Uniswap replacement here.
- H30–H36: Sprint 7—feature freeze, adversarial/fresh-clone validation, evidence, docs, forms, videos, two rehearsals, exact claim lock.

## Sponsor Eligibility Gates

### 0G Keep Building — `GO` only when all pass

- Cannes showcase or dated baseline SHA is linked; Lisbon commits/changelog show meaningful new feature/hardening/readiness work.
- Actual built-in and user-created inter-agent nodes use 0G Compute/Private Computer, and the project independently checks the event-time response verification API.
- Specialist -> Alpha -> Risk -> Executor dependencies are bound by canonical upstream receipt hashes; one-byte tamper stops the dependent graph.
- 0G Storage contains a redacted canonical receipt with upload transaction/root and proof-enabled readback/hash comparison.
- Provider/storage failure uses explicit recovery/refund state; no local semantic output is delivered or scored.
- Public repo/setup, deployed addresses, exact 0G SDK/features, working live/runnable product, team contacts, prior state, dated Lisbon changelog, What's Next, and video under three minutes are complete.

`NARROW`: Compute verification and shared-runtime hardening pass, but Storage memory/receipt depth is weak—submit only the proven portion and remove stronger claims.  
`NO_GO`: inherited calls only, `teeVerified` boolean only, response ID called proof, verification non-fatal, fake/local fallback, no working product, or missing Continuity delta/evidence.

### ENS Continuity — `GO` only when all pass

- Event-window code creates an owner-controlled agent subname/record set bound to immutable AgentVersion and payout policy hashes.
- A clean runtime client resolves owner, version, service endpoint, capability/context record, and payout pointer from ENS; no hard-coded registry value substitutes.
- Marketplace publication remains `READY_TO_PUBLISH` until the final ENS records resolve and match the canonical manifest.
- Authorized update changes the resolved runtime version/endpoint; forged owner, stale record, transferred name, or manifest mismatch refuses publication/execution.
- Public name/transaction/resolver/record evidence, before/after resolution, exact code/test pointers, working demo/live link, video, required form, and Sunday-morning booth presentation are complete.

`NARROW`: name/write/resolve works but runtime discovery or manifest binding is not causal—keep the product work and remove the ENS prize claim.
`NO_GO`: hard-coded name, badge/profile-only use, no real write/resolve/update, unauthorized update not tested, runtime ignores ENS, or booth/video/form requirement missing.

### Sui Existing App — `GO` only when all pass

- Event-window code adds current Sui client, Move package, Walrus ciphertext, and Seal policy to the existing AlphaDawg app.
- A real Testnet `AgentPackage` and job-bound `ExecutionPermit` govern the private specialist used by the shared inter-agent worker.
- Valid permit enables Walrus fetch -> Seal decrypt -> manifest-hash check -> 0G specialist -> Alpha receipt consumption.
- Revoke/expiry/wrong worker/wrong task/wrong version denies before decrypt/0G; the same app flow visibly changes.
- Public Sui package/object/permit/transaction IDs, Walrus blob/readback, working demo, before/after, exact code/test pointers, and setup are captured.

`NARROW`: Move/Walrus/Seal works live but is not yet in the real inter-agent worker—do not claim the track until integrated.  
`NO_GO`: generic blob/profile/receipt upload, plaintext, database-only license, UI toggle, no Testnet deployment, no revoked denial, or Sui removal leaves the demo unchanged.

### Uniswap Stack Contribution — `GO` only when all pass

- The selected event-window contribution uses actual Uniswap infrastructure. The inherited custom Arc AMM/mock router is excluded from every claim.
- `uniswap-agent-executor` is reusable outside AlphaDawg, open source, typed, documented, and consumed by a standalone example.
- A verified 0G intent is policy-checked, explicitly user-authorized, routed through official Uniswap API/Permit2/Universal Router or another named official stack component, simulated, signed by the user, broadcast, and reconciled.
- Negative tests prove wrong/expired/tampered intents never reach signer/broadcast. Failed/reverted actions remain failed.
- Real request/quote/route/contract/transaction/status evidence, supported chain/assets, API key path, `FEEDBACK.md`, mandatory feedback-form submission, exact README code/line pointers, and video are complete.

`NARROW`: product integration works but lacks reusable contribution/example—do not represent it as Stack contribution.  
`NO_GO`: copied Uniswap ABI, custom/mock router, quote-only UI, self-transfer, worker-held user key, missing form/feedback, no real Uniswap lifecycle, or no broader-ecosystem artifact.

### Cross-track causality test

For the single canonical demo job, produce this evidence graph:

```text
Sui package + permit + Walrus ciphertext
  --authorizes--> private specialist manifest
  --executes-on--> 0G verified specialist receipt
  --feeds--> 0G verified Alpha/Risk/Executor receipt DAG
  --discovers-via--> ENS owner/version/service/payout records
  --optionally-authorizes--> user-signed Uniswap execution
  --settles-to--> creator commission + canonical receipt
```

Then run three removals:

1. Remove/revoke Sui authority -> private specialist cannot execute and 0G call counter remains unchanged.
2. Tamper 0G receipt/output -> downstream agent and Uniswap signer counter remain unchanged.
3. Tamper Uniswap policy/quote -> wallet signer and broadcast counters remain unchanged; upstream analysis stays intact.

This proves distinct load-bearing roles instead of parallel sponsor decoration.

## Required Verification

Run repository equivalents of install, lint, TypeScript, tests, build, migration on an empty and baseline database, built-in regression, live 0G/ENS/settlement smokes, creator-to-buyer success E2E, paid-failure/refund E2E, tamper, replay/restart/concurrency, forged ownership/ENS, sponsor unavailable, fresh clone, redaction, and receipt verification.

After Packet A creates the scripts, the release gate is:

```bash
npm ci
npm run clean:generated
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npm run test:e2e
npm run smoke:0g
npm run smoke:0g-storage
sui move build --path move/alphadawg_license
sui move test --path move/alphadawg_license
npm run smoke:sui:inter-agent
# Only after explicit Uniswap track lock:
npm run test:uniswap
npm run smoke:uniswap
```

Run migrations twice: empty PostgreSQL and a disposable copy shaped like the Cannes schema/data. Run E2E against local `postgres + web + worker`, then the deployed demo. Every live smoke is gated by explicit env flags, Testnet-only configuration, balance/spend caps, and redacted output.

### Minimum test ownership

| test file | mandatory assertions |
|---|---|
| `tests/unit/auth/wallet-challenge.test.ts` | expiry, replay, wrong wallet/domain/chain/action, concurrent consume. |
| `tests/unit/commerce/state-machine.test.ts` | legal transitions, actor authorization, one settlement/commission/refund/receipt. |
| `tests/unit/agent-runtime/manifest.test.ts` | canonical hash, immutable schema, connector allowlist, size limits, no secret/arbitrary URL/code. |
| `tests/unit/agent-runtime/selection.test.ts` | active hired/public versions only; deterministic trace; license/proof/price/health rejection. |
| `tests/integration/worker-lease.test.ts` | two workers, lease expiry, cancellation, crash/restart, same effect IDs. |
| `tests/integration/og-proof-dag.test.ts` | specialist -> Alpha -> Risk -> Executor bindings; tamper stops dependants. |
| `tests/integration/og-storage-receipt.test.ts` | proof-enabled readback, wrong root/corrupt payload, outbox restart. |
| `tests/integration/sui/inter-agent-license.test.ts` | valid permit enables one decrypt/0G call; all mismatch/revoke cases cause zero decrypt/0G. |
| `tests/integration/marketplace-commerce.test.ts` | authenticated create/publish/quote/pay/run/deliver/commission and paid-failure refund. |
| `packages/uniswap-agent-executor/test/**` | route unions, policy firewall, signer zero-call failures, retry/reconcile/idempotency. |
| `tests/e2e/creator-buyer-private-agent.spec.ts` | real UI/API/DB/worker flow and canonical receipt; no placeholder state. |

### Required test observability

- Inject ports/clients for 0G, Storage, Sui, Seal, Walrus, Uniswap, signer, settlement, and clock so tests count calls without monkey-patching globals.
- Use structured reason codes. Tests assert reason and zero downstream side effects, not fragile log strings.
- Seed a unique plaintext sentinel into the private Sui agent; scan database dumps, captured logs, receipts, 0G payloads, and Walrus ciphertext output for absence.
- Store live IDs separately from fixtures. A mocked client can prove logic, never sponsor eligibility.
- A skipped live test is reported `NOT_RUN`, never green.

Evidence must link:

```text
commit -> owner -> ENS identity -> AgentVersion -> Sui package/license -> quote -> payment
  -> job/run -> 0G proof/storage -> delivery or refund
  -> creator commission -> hired-pack selection -> canonical receipt
```

UI/database booleans, `local://user-created`, `no-payment`, local-model fallback, mock/self-transfer, and inherited Cannes identifiers are not Lisbon evidence.

## Cut Order

1. Uniswap event sprint unless an explicit H20 replacement lock displaces ENS or Sui.
2. Sui at the H20 causal gate; retain the protected 0G + ENS core when it fails.
3. Extra agents/connectors and platform fee split; creator remains 100% payee.
4. Reputation/analytics extras.
5. UI polish.

Never cut executable user-created agents, owner authentication, shared runtime, strict 0G verification, real paid hire/commission/refund, ENS identity/version discovery, hired-pack integration, idempotency, provenance, failure E2E, or evidence.

## Authority Boundary

Do not push, deploy, use mainnet, spend, sign/broadcast outside approved Testnet smokes, submit, or message organizers/sponsors without explicit authorization. Never use Project B code, account, transaction, proof, or evidence.

## Completion

Return exactly one of `BUILD`, `NARROW`, or `STOP` and include:

1. release SHA, branch/worktree, clean status, incremental commits, and pre-existing/Lisbon file map;
2. changed paths/symbols and database/Move migrations;
3. exact command/test table with exit code, `PASS`/`FAIL`/`NOT_RUN`, environment, and evidence path;
4. `0G`, `Sui`, `Uniswap`, and `ENS` verdicts separately: requirement, code, test, live IDs, form/booth/video status, blocker, and removed claim;
5. creator/buyer/agent/version/order/job/settlement/proof/storage/package/permit/blob/transaction/commission/receipt identifiers;
6. performance results: job duration breakdown, p95 route/connector/Seal/0G/Storage latency, provider calls/cost, DB query count, restart/replay result;
7. security results: auth cross-user tests, secret/plaintext scan, proof/license/intent tamper, signer/broadcast zero-call evidence;
8. unresolved blockers and exact next safe action.

Submission remains `RESEARCH_ONLY_NOT_PROMOTABLE` until every claimed track has event-window code, deterministic tests, sponsor-native live proof, README pointers, mandatory forms/booth/video, and a replayable demo moment. A technically working integration with a missing mandatory form or category admission is still `NO_GO` for that prize.
