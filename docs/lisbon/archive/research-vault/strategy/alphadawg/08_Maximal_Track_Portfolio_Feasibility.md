---
title: AlphaDawg Maximal Track Portfolio Feasibility
aliases:
  - AlphaDawg All-Track Plan
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - engineering/plan
  - research/tracks
status: decision-ready
area: track-strategy
priority: P0
owner: team
gate: sponsor-confirmation
confidence: high
updated: 2026-07-18
eligibility_status: conditional_not_promotable
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
target_partners:
  - 0G
  - Hedera
  - Uniswap Foundation
---

# AlphaDawg Maximal Track Portfolio Feasibility

> [!important] Decision
> Architect for **all three 0G tracks**, **Uniswap API + Stack Contribution**, and **Hedera Agentic Payments + Tokenization + Cross-Chain Automation**. Do not claim Hedera No Solidity unless Hedera explicitly rules that only a separate new SDK-only module is judged; the current project and Cross-Chain design contain smart contracts.

Access date: 2026-07-18. This is conditional planning, not confirmed prize eligibility.

## Can Continuity Win Other Tracks?

**Yes, when the partner accepts the project.** ETHGlobal's submission guide says selecting one partner can make a project eligible for all that partner's tracks. ETHGlobal also reports that New York Continuity projects won additional partner prizes:

- Thurman Protocol: Arc Continuity plus Chainlink.
- Immunity: Continuity project plus ENS and Chainlink.
- Pampalo Private Swap: Uniswap Stack Contribution.
- Twenty-three New York Continuity projects won at least one partner prize.

However, Lisbon rules also say Continuity eligibility varies by partner. The website labels 0G Product/Infrastructure, Uniswap API, and all Hedera tracks as `building-from-scratch`. Obtain written confirmation from each sponsor before counting them.

## Track Portfolio

### 0G

| track | payout | product surface | status |
|---|---:|---|---|
| Keep Building on 0G | 3 × $1,500 | Meaningful Cannes-to-Lisbon delta, hardening, dated changelog and trajectory. | Confirmed Continuity. |
| Best AI Product on 0G | $3,000 / $2,000 / $1,000 | AlphaDawg end-user application with provable 0G Compute/Private Computer inference. | Conditional. |
| Best Infrastructure & Tooling | 3 × $1,500 | Reusable Agent Commerce Kit and provider SDK, with AlphaDawg as working example. | Conditional. |

The sponsor describes Product and Infrastructure as different categories. Build both deliverables in one monorepo, but expect 0G to classify the submission rather than guarantee both awards.

```text
apps/alphadawg              → AI Product
packages/agent-commerce-kit → Infrastructure
CHANGELOG-LISBON.md         → Continuity
```

### Uniswap Foundation

| track | payout | product surface | status |
|---|---:|---|---|
| Best Uniswap API Integration | $4,000 / $2,000 / $1,000 | Real API key, approval, quote, routing/simulation, execution/status and transaction evidence. | Conditional. |
| Best Uniswap Stack Contribution | 3 × $1,000 | Reusable proof-gated `VerifiedIntent -> UniswapExecution` package, documentation and example. | Confirmed Continuity. |

Required for both: public open-source repo, `FEEDBACK.md`, completed Uniswap Hackathon Feedback form, and README pointers to exact integration code. The form URL is live as of 2026-07-18; this clears the access-path blocker only, not the completion or Continuity-admission gates.

### Hedera

| track | payout | product surface | status |
|---|---:|---|---|
| AI & Agentic Payments | 2 × $3,000 | Dynamic agents negotiate and settle a real HBAR/HTS payment on Testnet. | Conditional; strong fit. |
| Tokenization | 2 × $1,500 | HTS agent-service credit or invoice token with creation, transfer, compliance/custom-fee and redemption lifecycle. | Conditional; stretch. |
| Cross-Chain Automation Hub | 3 × $1,000 | Hedera Schedule Service triggers Axelar GMP and a real destination-chain Uniswap action, fully onchain. | Conditional; high-risk. |
| No Solidity Allowed | 3 × $1,000 | Entire application must use Hedera SDK/native services with no Solidity or smart contracts. | **Incompatible.** |

Why No Solidity conflicts:

- AlphaDawg already includes Solidity contracts and Hedera EVM/Naryo work.
- Cross-Chain Automation requires destination-chain smart-contract execution.
- A folder containing only SDK code does not make the whole application “no Solidity.”

Only attempt this track after a written Hedera ruling that a separately scoped Lisbon module qualifies despite the surrounding repository. Otherwise exclude it.

## Arc Boundary

Preserve Arc as a legacy rail:

```text
built-in specialist → Arc x402 $0.001
external provider   → signed quote → 0G verification → Hedera settlement
verified intent     → Uniswap API execution
scheduled mandate   → Hedera Schedule → Axelar GMP → destination execution
```

- Add `paymentRail: "arc_x402" | "hedera"`.
- Do not double-pay one delivery.
- Do not use Arc or `MockSwapRouter` as Lisbon sponsor evidence.
- Do not rewrite working Arc payment code merely because Arc has no prize.

## Unified Engineering Scope

### Commerce core

1. Verified external Agent Card onboarding and endpoint ownership challenge.
2. Capability discovery outside `agent-registry.ts`.
3. Typed tasks, signed variable-price quotes, deterministic award and delivery schema.
4. Independent provider signers and settlement accounts.
5. Append-only state machine, optimistic versioning and idempotency.

### 0G product and infrastructure

1. Every external delivery carries 0G Compute/Private Computer proof and output hash.
2. Invalid proof fails closed: no payment, token action, schedule or trade.
3. Persist tasks, quotes, proofs and receipts in 0G Storage.
4. Publish provider helpers, verifier adapter and receipt verifier as reusable TypeScript.
5. AlphaDawg UI demonstrates the package as the working product example.

### Hedera Agentic Payments

1. Quote advertises HBAR/HTS asset and Hedera account.
2. Verified delivery triggers one real Testnet transfer.
3. HCS message anchors task, quote, proof and settlement hashes.
4. Mirror Node confirms finality and the UI exposes Hashscan evidence.

### Hedera Tokenization

Use an **Agent Service Credit / Invoice Token**:

1. Create HTS token with supply, KYC/freeze/pause and custom-fee configuration.
2. Mint credits representing prepaid agent service capacity or an accepted invoice.
3. Transfer to buyer/provider during award and settlement lifecycle.
4. Redeem/burn after verified delivery.
5. Demonstrate creation, compliance action, transfer and redemption.

This qualifies mechanically but is weaker than genuine RWA tokenization. Cut it before weakening the core demo.

### Hedera Cross-Chain Automation

1. User creates a time/approval-bounded trading mandate.
2. Hedera Schedule Service stores the scheduled trigger.
3. Scheduled Hedera transaction invokes the Axelar GMP dispatch path.
4. Destination executor validates mandate ID, replay protection and allowlisted parameters.
5. Executor performs a real Uniswap action and records status.
6. UI manages schedules, approvals, pending state and destination evidence.

No offchain cron, bot or keeper may trigger the qualifying path.

### Uniswap

1. 0G-verified `TradeIntent` is sanitized into allowlisted API parameters.
2. Perform approval check, quote, simulation/routing, swap/order and status polling.
3. Enforce chain, token, recipient, amount, slippage, expiry and idempotency policy.
4. Store request ID, route, simulation, transaction and final status.
5. Publish the adapter as a reusable package and include `FEEDBACK.md`.

## Implementation Gates

| gate | deadline | pass condition | tracks unlocked |
|---|---:|---|---|
| Eligibility | Pre-event | Written 0G/Uniswap/Hedera answers and contributor rights. | Conditional tracks become claimable. |
| Core commerce | H10 | Two external providers and signed quotes. | 0G Product/Infra foundation. |
| Verified delivery | H17 | Valid and tampered 0G paths pass. | 0G three-track posture. |
| Hedera payment | H21 | One finalized Testnet settlement and HCS receipt. | Hedera Agentic. |
| Uniswap execution | H26 | One real API-driven transaction and status. | Uniswap API/Stack. |
| Cross-chain | H30 | Schedule → Axelar → destination execution, fully onchain. | Hedera Automation. |
| Tokenization | H32 | HTS create/transfer/compliance/redeem lifecycle. | Hedera Tokenization. |
| Evidence | H36 | Tests, fresh clone, docs, videos and two rehearsals. | Submission readiness. |

Do not attempt Cross-Chain or Tokenization until commerce, 0G, Hedera payment and Uniswap execution are green.

## Prize Ceiling

If every conditional category is approved and partners permit multiple same-project awards:

- 0G theoretical maximum: **$6,000**.
- Uniswap theoretical maximum: **$5,000**.
- Hedera compatible-track maximum: **$5,500**.
- Coherent theoretical maximum: **$16,500**.
- Including incompatible No Solidity: **$17,500**, not a credible target.

Confirmed Continuity maximum before sponsor rulings remains **$2,500**: 0G $1,500 plus Uniswap $1,000.

## Organizer Questions

> AlphaDawg is a disclosed Cannes Continuity project. If all 0G Product/Infrastructure, Uniswap API, and Hedera Agentic/Tokenization/Automation integrations are written during Lisbon, may the same submission be judged in those tracks as well as the partners' Continuity tracks?

> Hedera No Solidity says the application must use only SDK/native services and no smart contracts. AlphaDawg's pre-existing repository contains Solidity, and the proposed Automation path requires destination contracts. Would an isolated new SDK-only package qualify, or is the whole submitted application ineligible?

## Decision Contract

- **BUILD FIRST:** 0G Continuity + Product/Infrastructure-shaped commerce core.
- **BUILD SECOND:** Hedera Agentic Payments + Uniswap API/Stack.
- **BUILD ONLY AFTER CORE:** Cross-Chain Automation, then Tokenization.
- **DO NOT TARGET WITHOUT EXPLICIT RULING:** Hedera No Solidity.
- **STOP:** representing all track pools or theoretical multi-awards as expected winnings.

## Sources

- [Lisbon submission guide](https://ethglobal.com/events/lisbon2026/info/details)
- [ETHGlobal Continuity rules](https://ethglobal.com/rules)
- [0G prizes](https://ethglobal.com/events/lisbon2026/prizes/0g)
- [Hedera prizes](https://ethglobal.com/events/lisbon2026/prizes/hedera)
- [Uniswap Foundation prizes](https://ethglobal.com/events/lisbon2026/prizes/uniswap-foundation)
- [Uniswap Hackathon Feedback](https://developers.uniswap.org/hackathon-feedback)
- [Thurman Protocol](https://ethglobal.com/showcase/thurman-protocol-q8iiy)
- [Immunity](https://ethglobal.com/showcase/immunity-eg56a)
- [Pampalo Private Swap](https://ethglobal.com/showcase/pampalo-private-swap-2g5bs)
