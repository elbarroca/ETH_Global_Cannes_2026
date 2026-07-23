---
title: AlphaDawg Server Agent Target Architecture
aliases:
  - AlphaDawg Agent Commerce Architecture
tags:
  - alphadawg
  - architecture
  - agent-commerce
  - ethglobal/lisbon-2026
status: engineering_ready_pre_event
updated: 2026-07-16
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
---

# AlphaDawg Server Agent Target Architecture

> [!important] Architecture decision
> Add one bounded Agent Commerce seam to the current application. Use one AlphaDawg API/worker, the existing PostgreSQL database, built-in providers behind an adapter, and one independently operated external provider. Do not rewrite the cycle engine or convert the repository into a monorepo during the sprint.

## Common Vertical Slice

```text
register -> verify endpoint -> discover -> request -> quote -> award
  -> deliver -> verify on 0G -> settle once on Hedera
  -> policy-check -> execute through Uniswap -> score -> receipt
```

The tampered path stops at verification. It creates no settlement preparation, signature, transaction, trade request, or reputation success.

## Low-Cost Topology

```text
AlphaDawg Next/API + commerce worker + PostgreSQL
  ├─ A2A Agent Card and task adapter
  ├─ legacy built-in provider adapter
  │    └─ Arc x402 $0.001 -> existing 0G inference
  ├─ independent external provider server
  │    └─ signed variable-price quote -> typed delivery
  ├─ strict 0G Private Computer/Compute verifier + Storage receipt roots
  ├─ Hedera SDK settlement + HCS anchor + Mirror finality
  └─ policy-bounded Uniswap Trading API executor
```

Operating shape:

- One orchestrator host; no VM per agent.
- One external provider process with a separate quote signer and Hedera account.
- Existing PostgreSQL/Prisma persistence; no second database.
- One pinned 0G Private Computer or Compute provider whose real attestation/proof response has passed preflight.
- Sponsor-approved testnets/credits only.
- Export reusable named surfaces from `src/commerce/index.ts`. Extract `packages/agent-commerce-kit` only after H17 if 0G confirms the Infrastructure classification and extraction does not threaten the core.

## Canonical Records

All external payloads use runtime validation. Monetary values are integer atomic units.

| record | required fields |
|---|---|
| `ProviderRegistration` | provider ID, Agent Card URL/hash/signature, endpoint, capabilities, auth, quote signer, settlement rail/account, proof types, status, verification time |
| `CommerceTask` | task ID, buyer, capability, schema version, input/input hash, max atomic budget, settlement asset, deadlines, proof policy, execution policy, state, version |
| `CommerceQuote` | task ID, provider, atomic price, asset/network, recipient, delivery deadline, proof type, expiry, nonce, signature, quote hash |
| `Award` | task ID, accepted quote hash, deterministic selection evidence, buyer signature, timestamp |
| `Delivery` | task/quote/provider IDs, output URI, output hash, schema version, 0G provider, raw proof key, created time |
| `ProofReceipt` | task/input/output/quote/provider bindings, verification result, verifier version, 0G storage reference/root |
| `SettlementReceipt` | task/quote/proof hashes, atomic amount/asset/recipient, Hedera transaction ID/hash, HCS sequence, Mirror status/finality |
| `TradeIntent` | task ID, chain, token in/out, recipient, atomic amount, slippage bps, deadline, allowed route classes, policy version |
| `ExecutionReceipt` | request ID, route union member, quote/simulation, signed artifact hash, tx/order/plan ID, final status |
| `CommerceReceipt` | stable references to every prior record, feedback reference, canonical hash, creation time |

## State Machine

```text
REQUESTED -> QUOTING -> AWARDED -> DELIVERED -> VERIFIED
  -> SETTLING -> SETTLED -> EXECUTING -> EXECUTED -> SCORED

REQUESTED|QUOTING|AWARDED -> CANCELLED
AWARDED|DELIVERED|VERIFIED -> REJECTED
REQUESTED|QUOTING|AWARDED -> EXPIRED
any in-flight external step -> RETRY_PENDING -> same step
```

Invariants:

1. No state may be skipped.
2. Transitions compare an optimistic `version`; stale writers fail.
3. Task, quote, settlement, and execution idempotency keys are unique.
4. Missing or false 0G verification is terminal for that delivery.
5. Only one task-selected settlement asset is compared across quotes; ties use stable provider ID.
6. `SETTLED` requires Mirror-confirmed finality, not merely SDK submission.
7. `EXECUTING` requires a verified proof and finalized settlement.
8. Provider output is typed data, never arbitrary calldata.

## Planned Surgical Module Map

> [!note] Planned, not present
> Every path below is a Lisbon implementation target. The Cannes baseline does not contain these commerce modules unless the text explicitly says an existing file is extended.

```text
src/a2a/
  card.ts              runtime schema, signature, capability/auth metadata
  client.ts            card discovery, quote/task calls, timeouts
  server.ts            AlphaDawg and example-provider A2A surface

src/commerce/
  schemas.ts           runtime-validated records and inferred strict types
  state-machine.ts     legal transitions and optimistic version checks
  quote.ts             signature/expiry/nonce/budget checks and selection
  receipt.ts           canonical serialization and stable receipt hash
  orchestrator.ts      coordinates ports; no sponsor SDK details
  index.ts             reusable named exports

src/providers/
  external-provider.ts independent example provider

src/og/
  inference.ts         current Private Computer/Compute SDK, fatal verification
  storage.ts           verified upload/download and receipt roots

src/hedera/
  settlement.ts        exactly-once transfer
  mirror.ts            finality query
  commerce-audit.ts    HCS hash anchor

src/uniswap/
  client.ts            API transport and request IDs
  policy.ts            deterministic allowlists and spending limits
  executor.ts          exhaustive route-union dispatch and status

prisma/schema.prisma   commerce records, unique keys, append-only events
scripts/smoke-*.ts     A2A, 0G, Hedera, Uniswap live gates
```

Do not add another marketplace registry. Extend `MarketplaceAgent` only where it remains the canonical local cache of verified providers.

## A2A Surface

Build the minimum interoperable server:

- `/.well-known/agent-card.json` with a signed card, capabilities, authentication declaration, endpoint, schemas, and supported proof/payment rails.
- Synchronous non-streaming task request/response plus status polling; defer streaming and push notifications.
- One ownership/domain challenge during activation.
- Contract tests against the pinned A2A JS SDK version.

Current A2A release is 1.0.1, while stable `@a2a-js/sdk` is 0.3.14 and the `next` tag exposes 1.0 beta support. Pin the advertised protocol and SDK separately at kickoff. Do not claim v1 conformance until an independent Agent Card plus message/task lifecycle passes.

Provider URL security:

- HTTPS in deployed mode.
- Resolve and revalidate DNS/IP at connection time.
- Reject loopback, private, link-local, multicast, metadata, non-HTTP schemes, and redirects into blocked ranges.
- Bound redirects, response size (64 KiB for Agent Cards), body parsing, concurrency, total timeout, retry count, and cancellation.
- Treat card metadata as untrusted; do not interpolate it into logs or prompts without validation.

## 0G Proof And Storage

- Migrate the deprecated `@0glabs/0g-serving-broker` path to pinned current Compute/Private Computer packages only in the new commerce seam, then retire the old import after regression passes.
- Preflight one actual Private Computer or Compute response and inspect its current proof/attestation fields before writing the verifier contract.
- Require the documented SDK verification result and all task-bound fields before `VERIFIED`; do not infer proof from a response ID.
- Bind the canonical task, quote, provider, input hash, output hash, and schema version into the stored proof record.
- Retain the documented response proof/attestation reference, provider address, verifier version/result, output hash, and 0G Storage root/reference. Preserve `ZG-Res-Key` only when the chosen current SDK actually returns and verifies it.
- A silent local-model or heuristic fallback is forbidden. Provider unavailability keeps the delivery unverified and blocks settlement/execution.
- A changed output byte, missing proof field, wrong provider, wrong task, or failed verification produces no downstream effect.

## Hedera Exactly-Once Settlement

Prefer the existing direct `@hashgraph/sdk` path. Hedera Agent Kit v4.0.0 is current and may be used only if its narrow HBAR/HTS/HCS plugin surface reduces code after preflight; importing it alone is not sponsor evidence.

1. Atomically claim the unique `taskId` settlement row.
2. Build the transfer for the exact quote asset, atomic amount, recipient, and expiry.
3. Persist transaction ID plus signed bytes/hash before broadcast.
4. On ambiguous failure, rebroadcast only the identical signed bytes; never create a replacement transfer.
5. Confirm through Mirror Node before marking `SETTLED`.
6. Anchor task/quote/proof/settlement hashes to HCS where feasible.
7. Expose the Mirror result and Hashscan link.

HCS-14, HTS, Schedule Service, and Axelar remain gated stretch surfaces. HCS-14 metadata alone is not proof of Hedera use.

## Uniswap Execution

Policy validates chain, tokens, recipient, amount, slippage, deadline, route class, user/task caps, approval/Permit2 domain, spender, and calldata/value before signing.

Exhaustive current route handling:

| route | workflow |
|---|---|
| `CLASSIC`, `WRAP`, `UNWRAP`, `BRIDGE` | `/swap` -> validate transaction -> broadcast -> `/swaps` status |
| `DUTCH_V2`, `DUTCH_V3`, `PRIORITY` | Validate/sign EIP-712 -> `/order` -> `/orders` status |
| `CHAINED` | `/plan` state machine; never send to `/swap` |
| unknown/unimplemented | Explicit rejection before signing |

- Pin `x-universal-router-version` consistently.
- Store request ID, route, quote, simulation, signed artifact hash, tx/order/plan ID, and final status.
- Ethereum Sepolia, Base Sepolia, and Unichain Sepolia are the authorized no-mainnet live candidates. UniswapX is mainnet-only in the current supported-chain table, so live sprint evidence should use a testnet AMM route, normally `CLASSIC`.
- Persist and retry the same signed artifact; never silently create a new economic effect.

## Legacy OpenClaw And Arc Boundary

| asset | decision |
|---|---|
| Arc x402 client/server and `$0.001` built-in rail | Retain and regression-test as disclosed Cannes behavior. Migrate/pin the envelope to current x402 v2 packages and payment-identifier semantics only behind parity tests. |
| Static registry and role manifests | Retain for the legacy cycle; do not use for new external discovery. |
| OpenClaw prompts/workspaces/gateway probes | Retain behind the legacy adapter. Remove as a required runtime for the new provider path. |
| Fly per-agent deployment scripts | Deprecate for Lisbon external-provider onboarding; do not delete until server-agent parity passes. |
| Shared mnemonic provider derivation | Legacy-only. Never use for the independent provider evidence path. |
| Forced BUY and fail-open proof | Forbidden in the new commerce path. |
| Arc custom/mock/self-transfer execution | Preserve only as legacy regression; exclude from Lisbon sponsor proof. |

## Technology Decisions

| decision | technologies |
|---|---|
| **BUILD** | A2A minimum server, x402 v2 legacy regression, 0G Private Computer/Compute + Storage, Hedera direct SDK settlement + HCS/Mirror, Uniswap Trading API exhaustive adapter. |
| **BUILD after the common slice passes** | One ERC-8004 identity and one post-settlement reputation record using 0G's published Galileo registries. Cut first if time slips. |
| **BUILD only after live preflight** | Hedera x402 settlement. The public x402.org facilitator does not list Hedera; fall back honestly to a direct Hedera SDK transfer if a Hedera-capable facilitator/self-facilitator cannot prove `402 -> verify -> settle -> Mirror`. |
| **WATCH** | HCS-14, HTS, Schedule/Axelar, Agentic ID expansion, UniswapX when returned by the API. |
| **REJECT for sprint** | ERC-8183 escrow, UCP merchant checkout, new 0G Chain contracts, Hedera Agent Kit adoption, generic marketplace rewrite. |

Reasons:

- ERC-8004 and ERC-8183 remain Draft. ERC-8183 duplicates the chosen Hedera settlement lifecycle and risks double payment.
- UCP models merchant checkout/order fulfillment, not competitive service jobs.
- Direct Hedera SDK calls are already present and give stronger policy control than adding Agent Kit unless the v4 plugin surface demonstrably reduces the implementation.
- Schedule -> Hedera contract -> Axelar GMP -> destination Uniswap is a four-system stretch, not a prerequisite.

## Migration Sequence

1. Add pure schemas/state/policy/idempotency tests.
2. Activate two A2A providers without changing the static registry.
3. Make 0G verification fatal and task-bound.
4. Settle one verified delivery exactly once on Hedera and confirm via Mirror.
5. Execute one policy-valid intent through the current Uniswap route union.
6. Build the canonical receipt and minimal judge-visible UI.
7. Prove Arc/OpenClaw legacy regression.
8. Extract reusable packaging only if the core is green and classification is approved.
9. Add Schedule/Axelar, then HTS, only through the hour gates in [[12_Prize_Weighted_Sprint_Backlog]].

## Cost And Operations Budget

| surface | planning assumption | cap |
|---|---|---:|
| AlphaDawg API/worker | Reuse the existing Railway or Vercel/Supabase footprint; no new per-agent fleet. | Existing plan; Railway Hobby has a $5 monthly minimum. |
| Independent provider | One Fly shared-cpu process; the published 512 MB estimate is about $3.32/month in the listed region. | One process. |
| Frontend | Reuse Vercel Hobby where eligible. | $0 incremental. |
| Sponsor networks | Testnet/faucet/credits only; confirm balances and rate limits at H0. | No unapproved cash spend. |
| Models/API buffer | Bounded real 0G and Uniswap test calls only. | Included in event cap. |

Target steady-state incremental run rate: **<= $15/month**. Event cash cap: **<= $25 total** without fresh user approval. Do not provision 13 new VMs or mainnet funds.

## Primary Technology Sources

- [A2A specification](https://a2a-protocol.org/latest/specification), [releases](https://github.com/a2aproject/A2A/releases) and [JavaScript SDK](https://github.com/a2aproject/a2a-js)
- [x402 v2 migration](https://docs.x402.org/guides/migration-v1-to-v2), [network support](https://docs.x402.org/core-concepts/network-and-token-support) and [facilitators](https://docs.x402.org/core-concepts/facilitator)
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) and [ERC-8183](https://eips.ethereum.org/EIPS/eip-8183)
- [0G Compute](https://build.0g.ai/compute), [Private Computer](https://0g.ai/blog/0g-private-computer), [Storage SDKs](https://build.0g.ai/sdks), and [0G ERC-8004 deployment](https://0g.ai/blog/0g-supports-erc-8004)
- [Hedera Agent Kit v4](https://github.com/hashgraph/hedera-agent-kit-js/releases/tag/v4.0.0)
- [Fly pricing](https://fly.io/docs/about/pricing/), [Railway pricing](https://railway.com/pricing), [Vercel pricing](https://vercel.com/pricing), and [Supabase pricing](https://supabase.com/pricing)
- [Hedera topic messages](https://docs.hedera.com/api-reference/topics/list-topic-messages-by-id) and [scheduled transactions](https://docs.hedera.com/hedera/core-concepts/scheduled-transaction)
- [Uniswap Swapping API](https://developers.uniswap.org/docs/trading/swapping-api/integration-guide), [supported chains](https://developers.uniswap.org/docs/trading/swapping-api/supported-chains), and [chained actions](https://developers.uniswap.org/docs/trading/swapping-api/chained-actions-integration)

Accessed 2026-07-16. Recheck at kickoff.
