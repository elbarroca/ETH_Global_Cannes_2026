---
title: AlphaDawg Lisbon Engineering Plan
tags:
  - alphadawg
  - engineering/plan
  - ethglobal/lisbon-2026
status: superseded
area: engineering
priority: P0
owner: team
gate: build-window
confidence: high
updated: 2026-07-16
---

# AlphaDawg Lisbon Engineering Plan

> [!warning] Portfolio superseded
> Uniswap is no longer in the active portfolio. Use [[06_Hedera_0G_1inch_Scope_Audit]] as the controlling engineering plan. The commerce, 0G and conditional Hedera sections remain supporting design only.

## Engineering Outcome

Build one vertical slice:

```text
dynamic registration
  → capability discovery
  → signed RFQ
  → deterministic award
  → 0G-verified delivery
  → Hedera settlement
  → constrained Uniswap execution
  → unified receipt
```

Do not rewrite the existing cycle engine. Route one specialist capability through a commerce orchestrator and keep legacy agents behind an adapter.

## Module Boundaries

```text
src/commerce/
  domain/           schemas, state machine, selection and execution policies
  directory/        registration, endpoint verification, capability discovery
  provider/         Agent Card, quote, task and delivery helper kit
  rfq/              quote collection, signatures and deterministic award
  validation/       0G delivery and output-hash verification
  settlement/       Hedera transfer and HCS evidence
  execution/        sanitized Uniswap API workflow
  persistence/      Prisma repository and idempotent event log
  receipt/          canonical receipt and evidence export
  orchestrator.ts   coordinates ports; no sponsor SDK details
```

Core ports:

```ts
AgentDirectory.discover(filter)
QuoteBroker.collect(task, agents)
DeliveryVerifier.verify(delivery)
SettlementService.settle(award, delivery)
TradeExecutor.execute(intent, policy, idempotencyKey)
CommerceRepository.transition(taskId, expectedVersion, nextState)
ReceiptBuilder.build(taskId)
```

## Data Model

Extend `MarketplaceAgent`; do not add a third registry.

| model | required fields |
|---|---|
| `MarketplaceAgent` | Agent Card URL, owner address, quote signer, Hedera account, capabilities, proof types, activation status, last verification, optional ERC-8004 ID |
| `CommerceTask` | typed input, capability, max budget in smallest units, deadlines, validation/execution policies, state, version, attempt, selected quote, receipt hash |
| `CommerceQuote` | task, seller, price in smallest units, proof type, delivery SLA, expiry, nonce, signature, status |
| `CommerceEvent` | append-only transition, evidence reference, idempotency key, timestamp |

Use Zod at every HTTP/provider boundary and infer strict TypeScript types. Never represent currency as decimal strings.

## State Machine And Invariants

```text
OPEN → QUOTING → AWARDED → DELIVERED → VERIFIED → SETTLED → EXECUTED
                         ↘ REJECTED → QUOTING
```

- Invalid proof returns to `QUOTING` and excludes the failed provider.
- No `VERIFIED` state means no Hedera payment.
- No finalized settlement means no Uniswap execution.
- Optimistic version checks prevent concurrent transitions.
- Repeated payment/execution keys return the earlier result and never duplicate transactions.
- Provider output is a typed `TradeIntent`, never arbitrary calldata.

## API Surface

| endpoint | purpose |
|---|---|
| `POST /api/marketplace/agents` | Submit an Agent Card URL. |
| `POST /api/marketplace/agents/:id/verify` | Verify endpoint, ownership signature, capabilities, and payment account. |
| `GET /api/marketplace/agents?capability=trade-intent` | Discover active providers. |
| `POST /api/commerce/tasks` | Create typed task and policy. |
| `POST /api/commerce/tasks/:id/run` | Collect quotes and advance the orchestrator. |
| `GET /api/commerce/tasks/:id` | Read current state and evidence. |
| `GET /api/commerce/tasks/:id/receipt` | Export canonical proof receipt. |
| `GET /.well-known/agent-card.json` | Provider identity/capability document. |
| `POST /quote` | Provider signed quote. |
| `POST /tasks` | Provider accepts awarded task. |
| `GET /tasks/:taskId/delivery` | Provider returns delivery and proof. |

Describe `/quote` and `/tasks` as AlphaDawg commerce extensions unless full A2A conformance is tested.

## Registration Security Gate

Activation requires:

- HTTPS/public endpoint in production.
- Signed nonce proving operator and endpoint control.
- Valid quote signer and Hedera account.
- Declared capability and supported 0G proof.
- Health timeout and response-size limit.
- SSRF protection: block loopback, link-local, private ranges, redirects to private addresses, and non-HTTP schemes.
- No `local://user-created` placeholder.

Execution policy requires allowlisted chain, tokens and recipient; maximum amount, slippage and quote age; validated output schema; no arbitrary calldata; and a unique task execution key.

## What “Better Agents” Means

- Task-aware: consume the buyer's typed input instead of a fixed prompt/data source.
- Independently operated: separate endpoint, quote signer and settlement account.
- Measurable: capability challenge, latency, delivery SLA, proof type and outcome feedback.
- Replaceable: discovery and selection use declared capabilities and policy, not hard-coded names.
- Verifiable: typed output, stable output hash and 0G evidence.
- Economically explicit: signed price, expiry, payment asset and delivery terms.
- Policy-bounded: agents propose a `TradeIntent`; they never bypass user limits or force BUY outcomes.

## 36-Hour Plan

| time | work | exit gate |
|---|---|---|
| Pre-event | Consent, license, team confirmation, keys, funded accounts and faucets | IP, team and access gates cleared; no Lisbon implementation claimed early. |
| H0–H2 | Freeze baseline SHA; create feature branch; smoke 0G, Hedera and two Uniswap test pairs | One real request succeeds for each selected sponsor. |
| H2–H6 | Schemas, Prisma migration, state machine, event log and fake adapters | Fake vertical and transition/idempotency tests pass. |
| H6–H10 | Provider kit, Add Agent flow, two provider servers and signed RFQ | Provider joins without buyer code change; two quotes collected. |
| H10–H15 | Hedera settlement adapter and HCS evidence | Final Testnet transfer and Hashscan URL from a verified test fixture. |
| H15–H20 | 0G delivery/output-hash verifier | Valid proof passes; tampered result fails closed. |
| H20–H25 | Uniswap approval, quote, simulation, transaction and status | One real supported-testnet execution. |
| H25–H29 | Orchestrator fallback, crash resume and unified receipt | Bad provider fails; good provider creates exactly one payment and trade. |
| H29–H32 | Minimal commerce UI, evidence export and deployment | Judge-visible one-click failure/success flow. |
| H32–H36 | Lint, typecheck, tests, build, full validation, fresh clone, docs, video and rehearsal | Two consecutive sub-four-minute demos. |

### Two-person ownership

- **Engineer A:** domain, Prisma, orchestrator, Hedera and receipt.
- **Engineer B:** provider kit, Add Agent, 0G, Uniswap and minimal UI.
- Pair at H6, H15, H25 and H32 gates.

## Required Repository Changes

- Add `npm test` using `tsx --test` or the smallest compatible existing test runner.
- Add `validate:commerce` for the complete failure/success scenario.
- Add `CHANGELOG-LISBON.md`, `FEEDBACK.md`, architecture diagram, provider-building guide and sponsor evidence table.
- Keep secrets out of evidence; save only redacted request metadata and public transaction/proof identifiers.

Verification gate:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run validate
npm run validate:commerce
```

## Cut Order

1. HTS bonds and Tokenization.
2. ERC-8004 reputation write; retain the optional identity reference.
3. HCS enrichment beyond one receipt message.
4. More than two providers.
5. More than one pair/testnet.
6. Multi-round negotiation.
7. Marketplace visual redesign.

Never cut dynamic registration, signed quotes, fail-closed 0G validation, real Hedera settlement, real Uniswap execution, idempotency, or the unified receipt.

## Deliberate Production Deferrals

The Lisbon slice is real commerce but not a complete commercial marketplace. Pre-funded escrow, disputes, refunds, cancellation economics, SLA penalties, taxes/invoicing, provider deployment, secret rotation, moderation, and multi-tenant billing remain post-hackathon work.
