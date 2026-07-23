---
title: AlphaDawg Lisbon E2E Validation
tags:
  - alphadawg
  - engineering/testing
  - ethglobal/lisbon-2026
status: superseded
area: validation
priority: P0
owner: team
gate: demo-ready
confidence: high
updated: 2026-07-16
---

# AlphaDawg Lisbon End-To-End Validation

> [!warning] Portfolio superseded
> The Uniswap acceptance paths below are archived. Current 0G, conditional Hedera and conditional 1inch Aqua gates are defined in [[06_Hedera_0G_1inch_Scope_Audit#End-To-End Acceptance Contract]].

## Acceptance Matrix

| ID | scenario | required result | evidence |
|---|---|---|---|
| E2E-01 | Register an external provider without editing source/config. | Provider becomes `ACTIVE` after Agent Card, endpoint and ownership checks. | Agent Card, registration record, signed challenge. |
| E2E-02 | Submit private, loopback, malformed or unreachable endpoint. | Registration rejected; no server-side fetch escapes policy. | Validation error and security test. |
| E2E-03 | Discover by `trade-intent` capability. | Exactly two eligible active providers returned. | Directory query and normalized provider records. |
| E2E-04 | Receive expired, replayed, bad-signature or over-budget quote. | Quote rejected and never awarded. | Quote fixtures and test output. |
| E2E-05 | Receive two valid quotes. | Deterministic policy selects one; tie-breaking is reproducible. | Quotes and `selection.json`. |
| E2E-06 | Selected provider returns tampered output/proof. | Delivery rejected; zero Hedera payment; zero Uniswap request. | Rejected delivery, 0G verification output, absence assertions. |
| E2E-07 | Fallback provider returns valid 0G delivery. | Task advances once to `VERIFIED`. | Output hash, attestation and state event. |
| E2E-08 | Settle verified award. | One final Hedera Testnet payment with public explorer proof. | Transaction ID, receipt and Hashscan URL. |
| E2E-09 | Execute verified intent. | Policy-approved Uniswap quote/simulation produces one real testnet transaction. | Request ID, route, simulation, tx hash and status. |
| E2E-10 | Retry after timeout/crash. | Prior payment/trade returned; no duplicate transactions. | Idempotency keys, event log and tx counts. |
| E2E-11 | Restart application. | Directory, task state and receipt remain reconstructable. | Restart script and receipt-hash comparison. |
| E2E-12 | Fresh clone judge run. | Setup plus failure/success demo completes from documented commands. | Recording and clean-run log. |

## Unit Gates

- Malformed TaskSpec, Agent Card, quote, delivery and intent are rejected.
- Quote signature, expiry, nonce, budget and replay rules are enforced.
- State-machine transitions reject skips and concurrent stale versions.
- Selection policy and tie-breaks are deterministic.
- Chain, token, recipient, amount, slippage and quote-age limits are enforced.
- Canonical serialization produces a stable receipt hash.

## Evidence Pack

```text
evidence/<taskId>/
  task.json
  agent-cards.json
  quotes.json
  selection.json
  rejected-delivery.json
  zero-g-proof.json
  hedera-payment.json
  uniswap-quote.json
  uniswap-execution.json
  receipt.json
  receipt.sha256
```

Every file must be redacted of secrets and PII. Public addresses, request IDs, output hashes, proof references, chain IDs and transaction hashes remain visible.

## Sponsor Proof Gates

| sponsor | proof required before claiming integration |
|---|---|
| 0G | Real Compute/Private Computer verification evidence and working example code; failed proof blocks progress. |
| Hedera | Final Testnet payment/financial operation, public transaction proof, and autonomous flow visible in a ≤5-minute video. |
| Uniswap | Valid API-key integration, real supported-testnet execution, `FEEDBACK.md`, feedback form, and README code pointers. |
| Continuity | Baseline link/SHA, dated Lisbon changelog, new-file map, honest before/after demo and “What’s next.” |

## Judge Demo

1. **0:00–0:25:** Show Cannes static names, fixed price and mock-compatible execution.
2. **0:25–0:55:** Add a provider through its Agent Card without code/config edits.
3. **0:55–1:25:** Publish one task and show two signed quotes.
4. **1:25–1:55:** Reject a tampered delivery; show no payment and no trade.
5. **1:55–2:35:** Accept valid 0G proof and show Hedera settlement on Hashscan.
6. **2:35–3:10:** Show Uniswap quote/simulation and finalized testnet transaction.
7. **3:10–3:40:** Open the unified receipt and reusable provider/execution interfaces.

> [!failure] Fail closed
> If 0G fails, execution stays disabled. If Hedera fails, do not claim agentic settlement. If Uniswap fails on one supported fallback pair/testnet, drop the track instead of using `MockSwapRouter`.
