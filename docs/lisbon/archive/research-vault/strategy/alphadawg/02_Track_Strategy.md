---
title: AlphaDawg Lisbon Track Strategy
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - research/tracks
status: superseded
area: track-strategy
priority: P0
owner: team
gate: sponsor-eligibility
confidence: mixed
updated: 2026-07-18
---

# AlphaDawg Lisbon Track Strategy

> [!warning] Superseded
> This early track strategy predates the ENS AI Agents and ENS Continuity tracks. Use [[ALPHADAWG_LISBON_MASTER]] for the current decision and [[09_Lisbon_Live_Track_and_Eligibility_Audit]] for the refreshed ledger.

Access date: 2026-07-18. Official source: [ETHGlobal Lisbon prizes](https://ethglobal.com/events/lisbon2026/prizes).

## Released Partner Surface

| partner / track | pool | continuity status | AlphaDawg use | decision |
|---|---:|---|---|---|
| 0G — Keep Building | $4,500 | Explicit Continuity | Harden 0G verification, state, error recovery, and evidence; disclose Cannes baseline. | **Primary confirmed.** |
| 0G — Infrastructure & Tooling | $4,500 | From scratch | Publish provider kit, validation adapter, and receipt tooling with AlphaDawg as example. | Conditional only; not confirmed for AlphaDawg. |
| 0G — AI Product | $6,000 | From scratch | End-user AlphaDawg product positioning. | Not confirmed for AlphaDawg. |
| Hedera — AI & Agentic Payments | $6,000 | From scratch | Provider discovery, signed terms, verified-delivery settlement, HCS receipt. | **Conditional on written approval.** |
| Hedera — Tokenization | $3,000 | From scratch | HTS provider performance bonds or service credits. | Conditional stretch. |
| Hedera — No Solidity Allowed | $3,000 | Not explicitly Continuity | Conflicts with existing Hedera EVM/Solidity surface. | Reject. |
| Hedera — Cross-Chain Automation | $3,000 | Not explicitly Continuity | Schedule Service → Axelar → destination action. | Reject: second hard problem. |
| Uniswap — Stack Contribution | $3,000 | Explicit Continuity | Reusable `VerifiedIntent → UniswapExecution` adapter and agent execution tooling. | **Primary confirmed.** |
| Uniswap — API Integration | $7,000 | From scratch | Real API approval, quote, simulation, execution, status, `FEEDBACK.md`, and completed live feedback form. | Excluded from current portfolio absent written approval. |
| Sui — Existing App Integration | $2,000 | Explicit Continuity | Walrus/Seal/DeepBook/zkLogin as a core before/after integration. | Eligible fallback; weak portfolio coherence. |
| Sui — New App | $4,000 | From scratch | New Sui-native product. | Ineligible for this continuation. |
| ENS — Most Creative Use | $3,000 | Not explicitly Continuity | Agent names, fleet subnames, live address/metadata discovery. | Strong technical alternate; eligibility unconfirmed. |
| 1inch — Aqua App | $5,000 | From scratch | Custom Aqua/SwapVM DeFi position. | Reject: higher scope and weaker eligibility than Uniswap Continuity. |
| The Graph | $15,000 | No Continuity label observed | Three published tracks: AI tooling, AI use case, and composable/standardized Graph products; all require live Graph data and public evidence. | Research-only substitution candidate; no AlphaDawg Continuity claim. |
| World | $15,000 announced | Details unpublished | Potential human ownership/authorization gate when criteria appear. | Monitor only. |

## Portfolio Decision

### Coherent engineering portfolio

1. **0G:** confirmed Keep Building Continuity target for delivery verification, dynamic providers and hardening.
2. **Hedera:** conditional Agentic Payments settlement after accepted delivery.
3. **Uniswap:** confirmed Stack Contribution Continuity target for reusable proof-gated execution tooling.

This is one critical path, not three sponsor demos.

### Prize exposure

| posture | tracks | addressable pool | status |
|---|---|---:|---|
| Confirmed Continuity portfolio | 0G Keep Building + Uniswap Stack Contribution | **$7,500 pools; $2,500 possible payout** | Current fail-closed target. |
| Preferred conditional portfolio | Above + Hedera Agentic Payments | **$13,500 pools; $5,500 possible payout** | Requires written Hedera approval. |

These are track pools, not expected winnings. A project may select at most three partners; multiple tracks under one partner count as one selection. Partner-prize eligibility for Continuity projects can vary.

## Questions To Resolve Before Kickoff

- Can a Continuity project compete in Hedera Agentic Payments?
- Does changed team membership require any additional written disclosure?
- Will World publish track details, or will The Graph publish any Continuity-specific admission before kickoff?

> [!warning] Submission language
> Never claim the Cannes marketplace was already open or dynamically extensible. Claim that Cannes proved a closed swarm and Lisbon removes its closed-world assumptions.

Current controlling plan: [[ALPHADAWG_LISBON_MASTER]].
