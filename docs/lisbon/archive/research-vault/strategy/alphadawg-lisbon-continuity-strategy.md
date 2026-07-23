# AlphaDawg Lisbon Continuity Strategy

> [!warning] Historical strategy — superseded
> This note preserves the earlier Uniswap-centered strategy. [[alphadawg/ALPHADAWG_LISBON_MASTER]] controls the current shared-runtime marketplace, 0G + ENS core, and conditional third-track decision.

access_date: 2026-07-16  
status: superseded, retained as historical evidence  
project: https://ethglobal.com/showcase/alpha-dawg-fh6vm  
repository: https://github.com/elbarroca/ETH_Global_Cannes_2026

## Decision

Continue AlphaDawg through **Continuity -> Extend Open Source**.

- Lisbon team: you plus the new teammate is likely allowed. ETHGlobal accepts individuals, permits teams up to five, and publishes no rule requiring a Continuity team to retain its original members.
- This is not an organizer ruling. Confirm it in the Lisbon Discord before relying on it.
- The real prerequisite is contributor permission: the public AlphaDawg repo has no license file, while the Cannes history contains contributions from the former teammate.
- Prefer **0G, Uniswap Foundation, and Hedera** as the coherent three-partner portfolio, subject to written Continuity eligibility for non-Continuity-labeled categories.
- Build **AlphaDawg Agent Commerce Kit**: dynamically register providers, collect signed quotes, verify delivery through 0G, settle accepted work on Hedera, execute a constrained Uniswap request, and store one proof-carrying receipt.

This converts the Cannes demo from “many agents across many chains” into one reliable, inspectable financial action.

## Team And IP Gate

### What the rules confirm

- Applications are individual; every Lisbon teammate must be accepted and stake individually.
- Teams can have one to five people and are formed in the event dashboard.
- Continuity permits an existing maintained open-source repository.
- Only substantive work shipped during the Lisbon window is judged.
- Pre-existing work, repo history, AI use, and the new Lisbon delta must be disclosed.

### What the rules do not say

No published ETHGlobal rule says the Lisbon Continuity team must match the Cannes team. Therefore **you + Person 2 is presumptively eligible**, but organizer confirmation is still prudent.

### Required before kickoff

1. Get written permission from Person 1 to use, modify, license, and resubmit their Cannes contributions.
2. Agree how credit and any later commercial ownership work. Do not imply Person 1 is a Lisbon participant.
3. Add an OSI-approved license only after both contributors agree. A public GitHub repo without a license is not safely reusable as open source.
4. Preserve Person 1's commit attribution and name them in the pre-existing-work disclosure.
5. Ask ETHGlobal:

> I plan to enter Lisbon Continuity / Extend Open Source with AlphaDawg, created at Cannes 2026. The Cannes team was me plus Person 1; the Lisbon team will be me plus Person 2. Person 1 will not participate and has granted written permission to continue using their contributions. Is this team change eligible for Continuity, Finalist judging, and partner prizes?

If consent is unavailable, do not submit the shared Cannes code as though it is solely yours. Ask ETHGlobal whether a clean-room Lisbon feature on a separately licensed baseline is acceptable.

## AlphaDawg Baseline

Confirmed from the official showcase:

- Hedera ioBuilders Naryo Builder Challenge: 2nd place.
- 0G Best DeFi App: 2nd place.
- Existing product: 0G sealed inference and storage, Hedera audit/token services, Arc x402 specialist payments, Telegram/dashboard control, and an evolving agent-memory DAG.
- Current repository baseline: `bfa7bd37c573e2e49525d965f7f937210e170d72` on `main`, dated 2026-04-05.

Repo risks the Lisbon delta should fix rather than hide:

- No license file.
- Arc trading uses a demo `MockSwapRouter` and can fall back to a self-transfer.
- TEE verification is non-fatal in the current inference path.
- Some UI/API paths contain demo prices, placeholders, or deterministic fallbacks.
- The README references proof files not present in the current repository.

These weaknesses create the Continuity story: **replace demo execution, fail closed, and prove recovery.**

## What New York Proved

Official ETHGlobal figures:

- 232 projects were submitted.
- 61 used Continuity: 26% of submissions.
- 3 of 10 finale projects were Continuity projects.
- 23 Continuity projects won at least one partner prize.

The three Continuity finalists made a narrow weekend delta visible:

- Immunity rebuilt contracts and added ENS reputation.
- Void Tactics added human-gated tournaments, embedded wallets, and replay storage.
- UNSU continued a browser wallet with ENS identity.

The supplied Jian Ruan chart classifies 85 of 232 New York projects as AI agents, versus 20 as DeFi/trading. Treat this as secondary thematic analysis, not official category accounting. It still shows why “AI agent” alone is not differentiation. AlphaDawg must lead with the bounded trade and its proof trail.

## Lisbon Prize Selection

Current visible partner pools sum to **$86,000**, while ETHGlobal's July 15 post states **$100,000 across eight partners**. Treat the $14,000 difference as unresolved until the live page is reconciled.

| rank | partner | visible pool | target track(s) | AlphaDawg fit | decision |
|---:|---|---:|---|---|---|
| 1 | 0G | $15,000 | Keep Building on 0G ($4,500); Infrastructure & Tooling ($4,500) if cross-category eligibility is confirmed | Directly names Cannes projects; the provider/verification kit creates a reusable infrastructure story. | Select. |
| 2 | Uniswap Foundation | $10,000 | API Integration ($7,000); Stack Contribution Continuity ($3,000) | Replaces the mock execution path with an official quote, simulation, and swap flow. | Select Stack; confirm API eligibility. |
| 3 | Hedera | $15,000 | AI & Agentic Payments ($6,000) | Converts prior audit-only use into actual agent discovery, payment, and receipt. | Select only after Continuity eligibility confirmation. |
| 4 | ENS | $5,000 | Creative $1,500; AI Agents $1,500; Continuity $2,000 | The newly released Continuity track makes agent identity/discovery a primary fit. | Historical decision superseded; current master selects ENS. |
| 5 | Sui | $6,000 | Existing App / Sui Stack ($2,000) | Walrus/Seal could work, but duplicates 0G memory and expands the critical path. | Reject. |
| 6 | 1inch | $5,000 | Aqua / SwapVM | Requires a sophisticated Aqua position and a new execution model. | Reject for this weekend. |
| pending | The Graph | $15,000 | Details unpublished | Performance indexing could fit, but no requirements exist yet. | Recheck July 23. |
| pending | World | $15,000 | Details unpublished | Personhood must change the trading outcome, not act as login. | Recheck July 23. |

The preferred conditional portfolio exposes up to **$25,000** across relevant pools. Only $7,500 is explicitly labeled Continuity today; obtain written confirmation before counting non-Continuity categories. These are addressable pools, not expected winnings.

## Lisbon Product: AlphaDawg Agent Commerce Kit

Detailed commerce architecture and track alternatives: [[alphadawg-agent-commerce-track-map]].

### Demo flow

1. User publishes a typed task with budget, deadline, validation policy, allowed assets, slippage, and expiry.
2. Lead Dawg discovers two external providers and collects signed quotes.
3. A deterministic policy awards one quote; the provider returns a typed delivery.
4. 0G verifies the delivery and output hash. Invalid delivery is rejected and receives no payment or execution authority.
5. Accepted delivery receives one Hedera Testnet payment.
6. After finalized settlement, the verified intent becomes a constrained Uniswap API request and testnet execution.
7. AlphaDawg stores task, quotes, failure, 0G proof, Hedera transaction, Uniswap transaction, and feedback as one receipt.

### Sponsor-critical jobs

| sponsor | required new Lisbon work | judge-visible proof |
|---|---|---|
| 0G | Fail-closed verified inference; persistent mandate/outcome memory; idempotent resume after one injected failure. | TEE/Compute proof, memory root, before/after outcome, recovery trace. |
| Hedera | One real agent-to-agent payment or token transfer using Hedera SDK, x402, ACP, or Agent Kit; HCS receipt. | Hashscan transaction plus service/payment/audit record. |
| Uniswap | Valid API-key integration for approval, quote, simulation, and execution on a supported testnet. Default to Unichain Sepolia; use Base Sepolia only if liquidity/quote preflight fails. | API request ID, route, simulation, executed transaction, `FEEDBACK.md`. |

### Scope

Must ship:

- One asset pair, one supported Uniswap testnet, and two dynamically registered providers.
- Typed `TradeMandate` and `ExecutionReceipt` records.
- Deterministic risk limits and fail-closed 0G verification.
- One injected failure with successful idempotent resume.
- Live deployed product, public source, contract/address list, and proof links.

Should ship only after the full loop works:

- Realized-outcome scoring that updates one specialist's reputation.
- Encrypted mandate memory on 0G Storage.
- A clean before/after Continuity screen.

Cut:

- More specialists, more chains, prediction markets, social features, ENS, Sui, Aqua, portfolio breadth, or a redesigned dashboard.

## 36-Hour Plan

| time | outcome | exit test |
|---|---|---|
| before kickoff | Consent/license resolved; accounts, faucets, keys, baseline docs, and test wallets ready. | No new Lisbon feature code; pre-work disclosed. |
| H0-H2 | Create `feat/lisbon-continuity`; record pre-event SHA; add `CHANGELOG-LISBON.md`; smoke sponsor APIs. | Baseline reproducible and each selected sponsor has one real request. |
| H2-H10 | Commerce schemas, persistence, provider registration, two providers, and signed RFQ. | New provider joins without buyer code changes; two quotes collected. |
| H10-H20 | 0G delivery validation plus Hedera post-verification settlement. | Tampered delivery receives no payment; valid delivery produces one final Hashscan transaction. |
| H20-H25 | Uniswap API approval -> quote -> simulation -> testnet execution. | Real API request ID and transaction; no mock/self-transfer path. |
| H25-H29 | Failure fallback, crash resume, unified receipt, and idempotency. | Exactly one payment and trade across retry. |
| H29-H32 | Minimal UI, deployment, README, `FEEDBACK.md`, addresses, AI attribution. | Fresh-clone runbook passes. |
| H32-H36 | Full verification, video, submission, and two rehearsals. | 2-4 minute video; 4-minute live demo; proof links open. |

## Submission Evidence Pack

- Prior state: Cannes showcase plus pre-kickoff commit SHA.
- Dated `CHANGELOG-LISBON.md` with commit links and before/after table.
- Short “What's next” statement.
- Public repo with agreed license and preserved attribution.
- README section mapping each sponsor to exact files, SDKs, addresses, and proof.
- `FEEDBACK.md` and completed Uniswap feedback form.
- 0G addresses/proofs; Hedera Hashscan links; Uniswap request ID and transaction.
- Architecture diagram, setup instructions, live URL, 2-4 minute video, and AI-use disclosure.
- Small commits throughout the event; never one final bulk commit.

## Stop Rules

- If contributor consent/license is unresolved: do not submit the shared repo as Extend Open Source.
- If Uniswap cannot return and execute a real supported-testnet quote by H8: try the second supported testnet once; then drop Uniswap rather than fake it.
- If Hedera payment is not final by H14: remove negotiation and ship one direct autonomous payment; do not fall back to audit-only usage.
- If 0G verification fails: execution stays blocked. No heuristic or unverified fallback may trade.
- If the joined vertical slice is not working by H24: cut all optional work and target 0G Continuity only.
- Do not add a fourth sponsor.

## Sources

- https://ethglobal.com/rules
- https://ethglobal.com/events/lisbon2026/info/start
- https://ethglobal.com/events/lisbon2026/info/details
- https://ethglobal.com/events/lisbon2026/prizes
- https://ethglobal.com/showcase/alpha-dawg-fh6vm
- https://github.com/elbarroca/ETH_Global_Cannes_2026
- https://www.linkedin.com/pulse/were-changing-how-hackathons-work-ethglobal-4pvpc
- https://www.linkedin.com/posts/ethglobal_ethglobal-ethglobalnyc-nyc-activity-7472972964779446272-0LjH
- https://developers.uniswap.org/docs/trading/swapping-api/supported-chains
- https://developers.uniswap.org/docs/trading/swapping-api/integration-guide
