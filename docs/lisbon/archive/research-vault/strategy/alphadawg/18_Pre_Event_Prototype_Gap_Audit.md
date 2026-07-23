---
title: AlphaDawg Pre-Event Prototype Gap Audit
aliases:
  - AlphaDawg Non-Qualifying Prototype Audit
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - audit
  - pre-event
status: archived_pre_event_learning
area: engineering-audit
priority: P0
owner: integration-owner
gate: clean-event-window-reimplementation
confidence: high
updated: 2026-07-16
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
prototype_branch: feat/lisbon-agent-commerce
---

# AlphaDawg Pre-Event Prototype Gap Audit

> [!success] Current disposition — 2026-07-16
> The user directed that no product implementation remain before the hackathon. The prototype and its generated artifacts were removed; the product repository is clean at the Cannes SHA, and nothing was committed or pushed. This note is retained only as a negative requirements and test-planning record.

> [!danger] Classification
> This is a read-only audit of uncommitted code written before the official Lisbon hacking window. It is **not qualifying Lisbon work**, is not owned by this audit run, and must not be committed, copied into the event branch, or presented as sponsor evidence. Its only safe use is to expose risks and sharpen the event-window specification.

Snapshot: 2026-07-16, after prototype files were still expanding. HEAD and `origin/main` remained the immutable Cannes SHA; the shared worktree was dirty across runtime, API, Prisma, deployment and tests.

## Outcome

The prototype has a useful domain skeleton, but the headline vertical slice remains **0% complete as sponsor evidence**:

```text
local Agent Card harness -> one signed quote -> self-declared proof metadata -> VERIFIED

missing:
second provider/quote -> real 0G verification -> 0G Storage -> Hedera transfer/finality
-> HCS receipt -> typed Uniswap intent -> official API execution/status -> unified receipt
```

The offline suite passing is evidence of local TypeScript behavior only. It does not prove a real provider, proof, payment, trade, persistence restart, deployment, or track qualification.

## Read-Only Verification Snapshot

| command | result | proven scope |
|---|---|---|
| `npm test` | PASS — 14 tests, 4 suites | Local parsers, signatures, memory-store transitions, one local provider harness, limited SSRF/runtime checks. |
| `npm run typecheck` | PASS | Current TypeScript compiles against the locally generated Prisma client. |
| `npm run lint` | FAIL — 23 errors, 28 warnings | Same inherited full-repo lint debt; green completion gate remains unmet. |
| `git diff --check` | PASS | No whitespace-error markers in the current tracked diff. |
| `prisma validate` with a dummy syntactically valid PostgreSQL URL | PASS | Schema syntax/relations only; no migration, database, concurrency, or restart evidence. |

Not run: build, migration, database integration, sponsor validators, live smokes, deployments, browser flow, fresh clone, transactions, or evidence capture. The worktree was concurrently changing and required environment/authority was absent.

## Mandatory E2E Coverage

| contract requirement | current prototype evidence | verdict |
|---|---|---|
| 1. External provider registration without source edit | One loopback example provider is fetched, challenged and stored in memory. | **PARTIAL / offline.** No deployed independent operator or persistent DB E2E. |
| 2. Two signed quotes for one typed task | Orchestrator can request many candidates, but the E2E test registers only one provider and receives one quote. | **MISSING.** |
| 3. Deterministic award within budget | Quote comparator exists; only single-quote E2E. No multi-asset comparability rule is exercised. | **PARTIAL.** Needs two valid comparable quotes plus invalid/expired/replay fixtures. |
| 4. Valid 0G-backed delivery | Test fixture supplies `teeVerified: true` and an arbitrary attestation string. | **FALSE POSITIVE.** No cryptographic 0G verification occurs. |
| 5. Tampered proof -> no settlement/trade | Local test sets `teeVerified: false` and directly calls a receipt adapter expected to throw. | **PARTIAL / modeled.** No orchestrated economic adapters exist, and tamper cases do not alter every bound field. |
| 6. Real Hedera Testnet payment + Mirror finality | `HederaSettlementNotConfiguredRail` always throws. | **MISSING by design.** |
| 7. Repeated callback/request -> no duplicate payment | Memory-store duplicate record test only. | **MISSING.** No external transaction, ambiguous broadcast, database race, Mirror reconciliation or restart. |
| 8. Verified intent -> real Uniswap API execution/status | No Uniswap client/import/endpoint exists. | **MISSING.** |
| 9. Invalid intent -> no signature/transaction | No typed `TradeIntent` or Uniswap signer exists. | **MISSING.** |
| 10. Arc built-in specialist -> existing `$0.001` x402 regression | Test accepts a caller-supplied `paymentTxHash` string and checks amount `1000`. | **FALSE POSITIVE for live regression.** No x402 request, facilitator verification, or real payment is exercised. |
| 11. Provider timeout/cancellation recovery | `AgentRuntime` unit test covers in-memory abort/retry; HTTP transport/E2E does not. | **PARTIAL.** No task state, provider request, persistence or restart recovery. |
| 12. One receipt resolves every evidence identifier | No receipt builder, resolver or evidence export exists. | **MISSING.** |
| Optional Cross-Chain / HTS | No qualifying implementation. | **MISSING / correctly deferred.** |

## Critical Findings

### P0 — Proof Verifier Trusts Provider Claims

`src/commerce/proof-verifier.ts:21-79` validates signatures, hashes, timestamps and a provider-supplied `teeVerified` boolean. It never calls the 0G broker/SDK, `processResponse`, a TEE verifier, or an onchain proof endpoint.

The green fixtures manufacture proof:

- `tests/commerce-fixtures.ts:131-143` creates `type: "0g-tee"`, arbitrary provider/model/attestation values and defaults `teeVerified` to `true`.
- `tests/commerce-e2e.test.ts:24-38` injects an offline inference harness returning `teeVerified: true` and `zg-bound-attestation-harness`.

An independently signed malicious provider can therefore claim a valid TEE result and pass. Required event implementation:

1. Persist the raw event-time proof key/response material.
2. Independently verify it with the sponsor-current 0G SDK/provider.
3. Bind the verified request content to canonical task, quote, provider, input and output hashes.
4. Reject missing, malformed, mismatched or false verification before any economic-preparation state.

### P0 — Orchestration Ends At `VERIFIED`

`src/commerce/orchestrator.ts:50-184` performs discovery, quote, award, delivery and local verification, then returns. It has no settlement, Mirror confirmation, execution, feedback or receipt steps. State names in `domain.ts` do not implement behavior.

Required event implementation must persist preparation states before external effects:

```text
VERIFIED -> SETTLEMENT_PREPARED -> SETTLED
-> EXECUTION_PREPARED -> EXECUTED -> SCORED
```

It must atomically claim the effect, save the exact signed artifact before broadcast, reconcile ambiguous outcomes, and retry the same artifact rather than creating a replacement.

### P0 — Hedera Is Explicitly Absent

`src/commerce/rails.ts:57-65` defines `HederaSettlementNotConfiguredRail`, which always throws. There is no commerce `TransferTransaction`, independent provider account, HCS anchor, Mirror query, Hashscan link, exactly-once broadcast, or finality state.

### P0 — Uniswap Is Explicitly Absent

No prototype file references the Uniswap Trading API, `/check_approval`, `/quote`, `/swap`, `/order`, `/plan`, `/swaps`, `/orders`, Permit2, route unions or request IDs. `PolicyBoundExecutionVenue` accepts an arbitrary injected callback and extracts only `BUY|SELL|HOLD` from untyped output.

This fails the required policy fields: chain, tokens, recipient, atomic amount, slippage, deadline, allowed route, per-task/user limits, approval domain/spender and transaction validation. Unknown output actions silently become HOLD instead of being rejected as a malformed typed delivery.

### P0 — “Exactly Once” Is Database-Shaped, Not Economic

Memory/Prisma repositories contain uniqueness and optimistic-version logic, but no test crosses an external side effect. A database uniqueness constraint after broadcast cannot prevent duplicate payment/trade after an ambiguous timeout or process crash.

Required test: concurrently submit the same valid effect, crash/restart after signed-artifact persistence and after broadcast, reconcile public status, then prove exactly one final transaction and one stored receipt.

### P1 — Task And Built-In A2A APIs Lack Caller Authorization

- `POST /api/commerce/tasks`, task GET/run, and cancellation are not authenticated.
- Cancellation trusts a caller-supplied `x-commerce-actor` string.
- Built-in A2A send/get/cancel routes require only a version header.
- Built-in task state is process-local, so one caller can enumerate/read/cancel another caller's task if it learns the ID; restart loses state.

Provider directory mutations have an admin token in production, but the task lifecycle needs authenticated buyer ownership and authorization checks.

### P1 — Two-Provider Commerce Is Not Proven

The local E2E uses one provider. It does not establish two discoverable choices, two independently controlled signing keys/accounts, deterministic award under comparable asset/network terms, loser behavior, or fallback from failed winner to a second provider.

### P1 — Arc Test Is Only Receipt Parsing

`LegacyArcX402ReceiptRail` trusts `delivery.output.paymentTxHash` after basic string checks. The test constructs the string itself. A real regression must call the inherited x402 specialist, verify the payment response/facilitator result, retain public evidence, and prove application retries do not duplicate paid delivery handling.

### P1 — Persistence And Migration Are Untested

All lifecycle/race tests use `MemoryCommerceStore`; none use `PrismaCommerceStore`. `prisma validate` proves schema shape, not migration correctness, database constraints, transaction isolation, restart reconstruction, or fresh-clone setup.

### P1 — SSRF Design Is Stronger Than Its Tests

`safe-fetch.ts` validates all resolved addresses, pins the chosen address into the HTTP lookup, revalidates redirects, restricts protocols/content types, and bounds response size/time/redirects. The test covers only loopback rejection and explicit local allowance.

Event tests still need IPv4/IPv6 private/reserved ranges, IPv4-mapped IPv6, metadata IPs, public-to-private redirects, DNS changes, credentials in URLs, malformed content types, oversized/chunked responses, timeout and redirect exhaustion.

### P1 — Deployment Rewrite Is Unverified And Too Broad For The Core

The prototype rewrites the root Dockerfile from an agents-only runtime to a built Next.js service, reclassifies Fly scripts, changes environment documentation and touches the legacy cycle/UI. None of this has a passing build or deployment smoke. It increases blast radius before the critical sponsor slice exists.

At H0, keep deployment changes behind the core gates. Do not modify the legacy cycle/UI merely to rename OpenClaw until the new path passes parity and evidence.

## What The Prototype Does Prove Locally

- Runtime validation for many commerce records and integer atomic amounts.
- EVM quote/delivery/ownership signatures with nonces and expiry fields.
- Deterministic transition rules and optimistic in-memory version conflicts.
- Provider endpoint ownership challenge.
- A thoughtfully pinned SSRF request path.
- Fail-safe refusal when Hedera or a real execution venue is unavailable.
- No forced BUY inside the prototype commerce seam.
- Type-safe local code and valid Prisma schema syntax.

These are specifications and test ideas, not submission claims.

## H0 Reimplementation Map

| pre-event learning | safe H0 action | prohibited shortcut |
|---|---|---|
| Canonical task/quote/delivery records reduce ambiguity. | Re-author the minimal event-window schemas from the controlling requirements and current sponsor docs. | Copy/cherry-pick prototype files and call them Lisbon work. |
| Ownership challenge and SSRF pinning are necessary. | Re-implement and independently test the required boundary behavior. | Treat one loopback test as complete SSRF coverage. |
| Memory-store tests expose state rules quickly. | Start with pure tests, then add Prisma/database/restart E2E before claiming idempotency. | Use memory-only green tests as exactly-once proof. |
| Provider metadata cannot prove TEE execution. | Wire independent 0G verification first and build the failure gate around it. | Accept a provider's `teeVerified` boolean or arbitrary attestation label. |
| Effect adapters need explicit absence behavior. | Implement real Hedera/Uniswap adapters only after credentials smokes; fail closed otherwise. | Return fabricated receipts or generic callback success. |
| Small local A2A surface is feasible. | Pin the event-time spec/SDK and contract-test with an independent client. | Self-label a custom route `A2A 1.0` without interoperability evidence. |

The event team should use the prototype audit as a negative checklist. Public standards and independently documented requirements may be used normally. Project-specific pre-event code, tests, designs and deployment changes must be treated according to the written organizer ruling and full disclosure; absent approval, exclude them from the submitted branch.

## Revised H0 Order

1. Clear rights/team/license and worktree provenance.
2. Create the clean event branch and control/evidence artifacts.
3. Smoke real 0G, Hedera and Uniswap access.
4. Implement independent 0G proof verification before provider orchestration.
5. Add typed records, two-provider quote flow and database state machine.
6. Implement prepared-state exactly-once Hedera settlement and Mirror reconciliation.
7. Implement typed exhaustive Uniswap API policy/execution/status.
8. Build receipt and recovery tests.
9. Integrate the legacy cycle/UI only after the isolated core passes.
10. Change deployment topology only after build and fresh-clone gates are green.

## Prototype Decision

- **KEEP AS PRIVATE PRE-EVENT REFERENCE:** risk findings, test names, failure cases and gap matrix.
- **DO NOT CLAIM:** any passing prototype test, route, schema, deployment edit or local provider harness.
- **DO NOT MERGE:** the dirty prototype into the event-window branch.
- **REIMPLEMENT AT H0:** the full sponsor-backed path from the clean baseline after written clearance.

Current prototype readiness: **`OFFLINE_DOMAIN_SKELETON_ONLY`**.

Related: [[10_AlphaDawg_Current_Engineering_Audit]], [[16_Pre_Event_Clearance_Packet]], [[17_Kickoff_H0_Runbook]], [[13_E2E_and_Submission_Evidence_Plan]].
