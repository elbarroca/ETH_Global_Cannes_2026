---
title: AlphaDawg Exact 0G Hedera Uniswap Arc Plan
aliases:
  - AlphaDawg Exact Lisbon Tracks
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - engineering/plan
status: decision-ready
area: track-strategy
priority: P0
owner: team
gate: hedera-eligibility
confidence: high
updated: 2026-07-18
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
target_partners:
  - 0G
  - Hedera
  - Uniswap Foundation
legacy_rail: Arc x402
---

# Exact 0G, Hedera And Uniswap Plan

> [!note] Extended strategy
> The maximal compatible-track architecture and gate order are in [[08_Maximal_Track_Portfolio_Feasibility]].

> [!important] Portfolio decision
> Target **0G Keep Building**, **Hedera AI & Agentic Payments** subject to written Continuity approval, and **Uniswap Best Stack Contribution**. Keep Arc x402 nanopayments as disclosed legacy functionality. Do not target 1inch.

Access date: 2026-07-18. Official source: [ETHGlobal Lisbon prizes](https://ethglobal.com/events/lisbon2026/prizes).

## Exact Tracks

| partner | exact track | payout | eligibility | what AlphaDawg must newly prove |
|---|---|---:|---|---|
| 0G | **Keep Building on 0G** | $4,500 pool; 3 × $1,500 | Explicit Continuity | Dynamic providers, fail-closed verified delivery, persistent state, error recovery, dated Lisbon delta and trajectory. |
| Hedera | **AI & Agentic Payments on Hedera** | $6,000 pool; up to 2 × $3,000 | Published as from scratch; obtain written approval | A new external marketplace agent discovers work, negotiates terms and receives a real HBAR/HTS Testnet payment after accepted delivery. |
| Uniswap Foundation | **Best Uniswap Stack Contribution** | $3,000 pool; 3 × $1,000 | Explicit Continuity | Reusable proof-gated agent-to-Uniswap execution tooling, not merely an AlphaDawg-specific swap; completed feedback form remains mandatory. |

Do not target:

- **1inch Build an Aqua App:** from scratch and requires a custom Aqua/SwapVM DeFi position.
- **Uniswap API Integration:** from scratch; use the API if useful, but do not count this $7,000 category without written approval.
- **0G Product/Infrastructure:** from scratch; do not count them without written approval.
- Hedera Tokenization, No Solidity, or Cross-Chain Automation: unnecessary scope.

## Prize Model

- Confirmed possible payout: **$2,500** — 0G Continuity $1,500 + Uniswap Continuity $1,000.
- Conditional possible payout with Hedera approval: **$5,500**.
- The three aligned pools total **$13,500**; this is competition exposure, not possible single-team winnings.

## Arc Preservation Rule

Arc remains useful even without an Arc sponsor track.

```text
existing built-in specialist
  → Arc x402 $0.001 pay-per-call
  → 0G sealed inference

new external marketplace provider
  → signed quote
  → 0G-verified delivery
  → Hedera settlement

verified TradeIntent
  → deterministic risk policy
  → Uniswap execution
```

Rules:

- Keep `src/payments/x402-client.ts`, `src/payments/x402-server.ts`, `src/config/arc.ts` and the existing built-in specialist path.
- Mark Arc as **pre-existing legacy payment transport**, not Lisbon innovation or prize evidence.
- Existing built-ins use Arc; new external marketplace providers use Hedera. Never pay the same delivery on both rails.
- Add `paymentRail: "arc_x402" | "hedera"` to the provider/task contract.
- Keep `src/execution/arc-swap.ts` available behind a legacy feature flag, but exclude its mock/self-transfer paths from the Lisbon judge demo.

## New Engineering Scope

1. Replace placeholder onboarding with verified Agent Card URL, operator signature, capabilities and payment rail.
2. Add typed `CommerceTask`, signed `CommerceQuote`, `Delivery` and append-only `CommerceEvent` records.
3. Discover external providers without editing `agent-registry.ts`.
4. Require task-aware typed output instead of fixed `AGENT_NAME` behavior.
5. Verify delivery through 0G; invalid delivery gets no payment and no trade authority.
6. Route legacy providers through Arc x402 and approved external providers through Hedera.
7. Add a reusable `VerifiedIntent -> UniswapExecution` adapter with token, chain, recipient, amount, slippage, expiry and idempotency constraints.
8. Execute one real Uniswap transaction and save the request/route/transaction evidence.
9. Publish `FEEDBACK.md`, complete the live Uniswap Hackathon Feedback form and point the README to exact integration files.
10. Remove forced-BUY behavior from the Lisbon path and prevent mock success.

## Minimum Demo

1. Existing AlphaDawg specialist still receives its $0.001 Arc x402 call.
2. Add two external providers without source/config edits.
3. Collect two signed quotes.
4. Reject one invalid 0G delivery: no Hedera payment, no Uniswap execution.
5. Accept the second delivery and settle it once on Hedera.
6. Convert its typed intent through the reusable Uniswap adapter and execute one real supported-chain transaction.
7. Restart and prove no duplicate payment or trade.
8. Open one receipt linking Arc legacy call, task, quotes, 0G proof, Hedera settlement and Uniswap transaction.

## Stop Rules

- If Hedera does not approve Continuity eligibility, keep the adapter as engineering preparation but do not submit for Hedera or claim its $3,000 payout.
- If Uniswap execution is not real, drop the execution claim; never use `MockSwapRouter` as sponsor proof.
- If the reusable commerce loop is not live by hour 24, cut UI redesign, ERC-8004 writes, bonds, extra agents and extra pairs.

## Sources

- [0G Lisbon prize](https://ethglobal.com/events/lisbon2026/prizes/0g)
- [Hedera Lisbon prize](https://ethglobal.com/events/lisbon2026/prizes/hedera)
- [Uniswap Foundation Lisbon prize](https://ethglobal.com/events/lisbon2026/prizes/uniswap-foundation)
- [Uniswap Hackathon Feedback](https://developers.uniswap.org/hackathon-feedback)
- [1inch Lisbon prize](https://ethglobal.com/events/lisbon2026/prizes/1inch)
- [ETHGlobal Continuity rules](https://ethglobal.com/rules)
