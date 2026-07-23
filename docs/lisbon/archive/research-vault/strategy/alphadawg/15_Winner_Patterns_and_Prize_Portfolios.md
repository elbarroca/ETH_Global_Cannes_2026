---
title: AlphaDawg Winner Patterns and Prize Portfolios
aliases:
  - AlphaDawg Prize Portfolio Decision
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - research/winners
  - strategy/prizes
status: decision-ready
area: portfolio-strategy
priority: P0
owner: team
gate: shared-vertical-slice
confidence: mixed
updated: 2026-07-16
accessed_at: 2026-07-16T13:02:14+01:00
eligibility_status: research_only_not_promotable
---

# AlphaDawg Winner Patterns And Prize Portfolios

Research timestamp: `2026-07-16T12:02:14Z`. Project implementation details are self-reported on official showcase pages unless repository proof is stated. Award labels come from official ETHGlobal project metadata.

## Decisive Pattern

The strongest comparable projects do not present a sponsor-logo tour. They show one loss, one replayable state change, one visible proof artifact and one reason each sponsor primitive is load-bearing.

For AlphaDawg, the winning sentence is:

> An external agent joins through A2A, delivers a 0G-verified artifact, receives one Hedera settlement, and authorizes one policy-bounded Uniswap action; a single receipt proves the failed and successful paths.

## Comparable Winners

| project | problem and demo loop | sponsor depth / onchain proof | reusable artifact | visible strength | weakness AlphaDawg can outperform |
|---|---|---|---|---|---|
| Alpha Dawg, Cannes | Black-box trading -> paid specialists -> TEE debate -> trade -> proof sinks | 0G Compute/Storage and Hedera HCS/HTS/schedules; two partner awards | Multi-agent trading/proof stack | Memorable “money/brain/truth” framing | Breadth, mnemonic-derived providers and forced-BUY behavior weaken trust; Lisbon must be open and fail-closed. |
| DIVE, Cannes | Human-backed agents research -> commit/reveal dispute -> settle | 0G + Hedera + World; three partner awards plus finalist | Swarm oracle engine | Three load-bearing sponsors in one loop | Very large scope and architecture-heavy proof. AlphaDawg can be easier to reproduce. |
| Shawarma Orchestrate, Cannes | YAML swarm -> weighted consensus -> optional approval -> Uniswap/HTTP action | Deep 0G orchestration; 0G award | Generic LangGraph/0G orchestrator | Strong reusable developer artifact | Storage and actions can be optional/configured rather than executed. AlphaDawg should make every proof mandatory. |
| ALMA, Cannes | Out-of-range LP -> one delegation -> atomic burn/swap/mint rebalance | Uniswap Trading API and guarded EIP-7702/EIP-712; award plus finalist | Autonomous LP manager | One pain, one signature, one visible rebalance | Narrower than AlphaDawg; AlphaDawg must match its clarity, not its exact product. |
| Flow Broker, Cannes | Profile -> buy x402 intelligence -> CRE cycle -> Uniswap trade | Stated Sepolia swaps; Uniswap + Chainlink awards | Agent broker/payment accumulator | Clear spend -> reason -> trade -> receipt | Many feeds and cost claims create demo fragility. AlphaDawg should use two providers and one pair. |
| bitrouter, New York Continuity | Spawn subagents -> route inference -> pay 402 -> attest -> recall memory | Arc + Sui awards; payment survived a disclosed backend outage | Rust payment plugin | Coherent infrastructure path and honest failure disclosure | Backend/WSL fragility and no official live-demo link. AlphaDawg needs a fresh-clone run. |
| Azimuth, New York Continuity | Two ground stations -> merge satellite pass -> HCS/HTS reward -> ENS identity | Real SDR input; Walrus + Hedera + ENS awards | Hardware/client/proof network | Highest proof density and three distinct sponsor jobs | Hardware/multi-dashboard reproduction is difficult. AlphaDawg can be software-only and four-minute runnable. |
| Chatter, New York Continuity | Keywords -> $1 research -> brief -> Uniswap swap -> ENS receipt | Published transaction IDs; Uniswap + ENS awards | OSS research-tool web conversion | Excellent before/after disclosure and six-step story | Cached research and quote-only tokenized equities. AlphaDawg should show a final transaction and uncached failure path. |
| Immunity, New York Continuity | Detect -> publish/corroborate/challenge threat -> judges -> block/reward | Chainlink + ENS awards plus finalist; nine contracts/services | Agent-security SDK, hook and registry | Proves ambitious Continuity can final | Eight-plus machines and unsupported “almost impossible” language. AlphaDawg should avoid absolute security claims. |
| Thurman Protocol, New York Continuity | Existing loan POC -> DocuSign -> workflow -> atomic loan/USDC settlement | Arc Continuity + Chainlink awards; state-changing settlement | Automated loan-sale settlement | Crisp baseline-to-feature delta | Private CI/staging and webhook dependencies complicate audit. AlphaDawg should keep the judge path local and public. |

## Qualitative Competition Density

- **High proof density:** DIVE, ALMA, Flow Broker, Azimuth and Chatter. Each has a legible loop, load-bearing sponsor technology and visible state/proof.
- **Medium proof density:** Alpha Dawg, bitrouter, Immunity and Thurman. Engineering is strong, but scope or reproduction cost is higher.
- **Lower published proof density:** Shawarma. The reusable artifact is strong, but some proof/action paths are optional.

This is a selected, winner-biased sample. It supports qualitative design patterns, not a competition probability.

## Presentation Pattern To Copy

1. Name one concrete failure or cost in one sentence.
2. Show the shared loop immediately; avoid an architecture lecture first.
3. Make each sponsor primitive cause one distinct state transition.
4. Show the rejected path as well as the successful path.
5. End on the explorer, transaction, Merkle root, or receipt a judge can inspect later.

Use one 2:00–2:59 shared video so it satisfies the generic uploader and 0G limit.

## Shared Vertical Slice

```text
A2A Agent Card
  -> signed task and quote
  -> direct 0G Compute delivery verification
  -> tamper gate
  -> Hedera Testnet settlement + HCS receipt
  -> policy-bounded Uniswap API execution
  -> one canonical receipt in 0G Storage
```

Arc x402 remains a disclosed legacy rail for built-in specialists. It is not Lisbon prize evidence and must not double-pay the new external-provider delivery.

## Portfolio 1 — Minimalist

**Planning value:** highest confidence.

| item | decision |
|---|---|
| Features | Two external A2A providers; signed quotes; direct 0G valid/tampered verification; 0G Storage receipt; reusable proof-gated Uniswap adapter; one real transaction. |
| Sponsor tracks | 0G Keep Building; Uniswap Stack Contribution. |
| Per-track obtainable value | 0G $1,500; Uniswap $1,000. |
| Confirmed / conditional | **$2,500 confirmed team ceiling; $0 conditional value counted.** |
| Effort | 18-24 engineering hours plus 6-8 evidence/rehearsal hours. |
| Critical dependencies | Working direct 0G provider/account; Uniswap key/RPC; one supported low-value route; contributor/team rights. |
| Demo complexity | Medium: one rejected delivery, one accepted delivery, one transaction, one receipt. |
| Failure blast radius | Low-medium. Uniswap failure still leaves 0G Continuity, but loses the Stack proof. |
| Cut first | A2A streaming polish, extra provider capabilities, 0G Chain anchor, x402 v2 migration. |

## Portfolio 2 — Recommended

**Planning value:** best risk-adjusted upside after written approvals.

| item | decision |
|---|---|
| Features | Minimalist slice plus direct Hedera SDK guarded payment, HCS audit and Mirror evidence; reusable 0G infrastructure surface; full Uniswap API route/status flow. |
| Sponsor tracks | 0G Keep Building + conditional Infrastructure; Hedera Agentic Payments; Uniswap Stack + conditional API Integration. |
| Per-track obtainable value | 0G $1,500 + $1,500; Hedera $3,000; Uniswap $1,000 + up to $4,000. |
| Confirmed / conditional | **$2,500 confirmed. $8,500 approval-gated one-award-per-partner ceiling. $11,000 multi-award theoretical ceiling for this portfolio.** |
| Effort | 30–34 engineering hours plus 4–6 evidence/rehearsal hours. The 34–40 hour raw envelope requires mandatory hour-29 cuts to finish by 36. |
| Critical dependencies | Written 0G/Hedera/Uniswap category rulings; Hedera Testnet funds; 0G balance/provider; Uniswap key and route; rights gate. |
| Demo complexity | High but coherent: registration -> bad proof/no pay -> good proof/pay -> trade -> receipt. |
| Failure blast radius | Medium-high. Hedera and Uniswap are downstream; 0G remains the gating truth source. |
| Cut first | Regular-track claims if approval is absent; UniswapX/order variants; HCS enrichment; Hedera before 0G fail-closed behavior. |

The one-award-per-partner ceiling uses the strongest plausible single award per partner: 0G $1,500 + Hedera $3,000 + Uniswap $4,000. It does not assume same-partner stacking.

## Portfolio 3 — Maximal

**Planning value:** research-only; not credible for two people in 36 hours.

| item | decision |
|---|---|
| Features | Recommended slice plus 0G AI Product posture, HTS tokenization lifecycle and fully onchain Schedule -> Axelar -> destination action. |
| Sponsor tracks | All three 0G tracks; Hedera Agentic + Tokenization + Cross-Chain; both Uniswap tracks. No Solidity excluded. |
| Per-track obtainable value | 0G $3,000 + $1,500 + $1,500; Hedera $3,000 + $1,500 + $1,000; Uniswap $4,000 + $1,000. |
| Confirmed / conditional | **$2,500 confirmed; $16,500 compatible multi-award theoretical ceiling. Current confirmed ceiling is $2,500; approval-gated credible ceiling remains $8,500 using at most one award per partner.** |
| Effort | 50-72 hours before evidence/rehearsal; incompatible with the actual window. |
| Critical dependencies | Every Recommended dependency plus live HIP-1215 behavior, exact Hedera/Axelar route, two-chain funds and same-partner multi-award approval. |
| Demo complexity | Very high: three distinct product postures and cross-chain state tracking. |
| Failure blast radius | Severe. Cross-chain/schedule failure can consume the entire evidence window and destabilize the core. |
| Cut order | Tokenization -> Cross-Chain -> AI Product claim -> UniswapX/chained route -> identity/reputation drafts. |

Adding Hedera No Solidity would produce $17,500, but the project contains Solidity and the automation path needs destination contracts. That number is incompatible, not a portfolio.

## Recommendation

Choose the **Recommended architecture** but run the **Minimalist commitment** until every eligibility and service smoke passes. This preserves the highest-confidence $2,500 Continuity ceiling while keeping one shared path ready for an approval-gated $8,500 one-award-per-partner ceiling.

### Build gates

1. **Pre-event:** written team/IP and partner-category answers; funded Testnet accounts; 0G and Uniswap credential smokes.
2. **H10:** two A2A providers and signed quotes.
3. **H17:** valid direct 0G proof passes; tampered proof blocks all value movement.
4. **H22:** Hedera payment/HCS/Mirror evidence, only if approved.
5. **H27:** Uniswap real transaction/status and reusable adapter.
6. **H30:** freeze features; evidence, fresh-clone QA and two rehearsals only.

## Decision Contract

- **BUILD:** A2A -> direct 0G verified delivery -> 0G Storage receipt -> reusable policy-bounded Uniswap transaction.
- **NARROW:** Add Hedera Agentic settlement and regular 0G/Uniswap positioning only after written eligibility and live smokes. Keep one provider capability, one payment asset and one trade pair.
- **STOP:** Cross-chain automation, Tokenization, draft identity/job protocols, tokenized stocks, UCP and same-partner prize stacking unless the core is green and the relevant sponsor has explicitly approved the claim.

Unresolved gates and exact questions: [[09_Lisbon_Live_Track_and_Eligibility_Audit#External Questions Still Blocking]]. Technology choices: [[14_Current_Web3_Agent_Commerce_Radar]].

## Primary Sources

- [Cannes showcase](https://ethglobal.com/events/cannes2026/showcase) and [New York showcase](https://ethglobal.com/events/newyork2026/showcase)
- [Alpha Dawg](https://ethglobal.com/showcase/alpha-dawg-fh6vm), [DIVE](https://ethglobal.com/showcase/dive-5hxbp), [Shawarma Orchestrate](https://ethglobal.com/showcase/shawarma-orchestrate-rfyhe), [ALMA](https://ethglobal.com/showcase/alma-07pzd) and [Flow Broker](https://ethglobal.com/showcase/flow-broker-ez5rr)
- [bitrouter](https://ethglobal.com/showcase/bitrouter-mu1z5), [Azimuth](https://ethglobal.com/showcase/azimuth-7w256), [Chatter](https://ethglobal.com/showcase/chatter-hczx1), [Immunity](https://ethglobal.com/showcase/immunity-eg56a) and [Thurman Protocol](https://ethglobal.com/showcase/thurman-protocol-q8iiy)
