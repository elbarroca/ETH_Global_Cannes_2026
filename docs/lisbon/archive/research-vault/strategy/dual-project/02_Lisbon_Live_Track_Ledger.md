---
title: Lisbon 2026 Live Track Ledger
tags:
  - ethglobal/lisbon-2026
  - prizes
  - eligibility
status: research_only_not_promotable
updated: 2026-07-23
accessed_at: 2026-07-23T14:09:46+01:00
confidence: official_snapshot_confirmed
---

# Lisbon 2026 Live Track Ledger

> [!warning] Claim boundary
> The user-supplied official prize snapshot dated 2026-07-23 controls this ledger. It exposes **eight partners, $88,000, and 23 released tracks**. Pool exposure and first-slot caps are not expected winnings; the floor is $0. Recheck the live dashboard at H0 and before submission.

## Global Rules

| claim | state | source/effect |
|---|---|---|
| Partner selection | `CONFIRMED` | Select up to three partners per submitted project. One selected partner exposes its listed tracks. [Event guide](https://ethglobal.com/events/lisbon2026/info/details). |
| From Scratch | `CONFIRMED` | Project-specific code, design, prompts, and assets begin only after official kickoff. [Rules](https://ethglobal.com/rules). |
| Continuity | `CONFIRMED` | Existing code is allowed only under an applicable Continuity track, with prior-state disclosure and a substantive open-source event-window delta. |
| Version history | `CONFIRMED` | Large single commits or missing history are presumed unqualified unless proven otherwise. |
| Submission deadline | `CONFIRMED` | Sunday, 2026-07-26 at 09:00 WEST. |
| Generic demo | `CONFIRMED_WITH_EXCEPTIONS` | ETHGlobal recommends 2–4 minutes; sponsor limits override. ENS additionally requires an in-person Sunday-morning booth presentation. |
| Same-partner stacking | `PENDING` | Eligibility for several tracks is not evidence that one project can win several awards from the same partner. Use one award per partner for conservative caps. |
| AlphaDawg regular-track admission | `BLOCKED` | A Continuity submission is not assumed eligible for a partner's non-Continuity tracks without written sponsor/organizer approval. |

## Pool Summary

| partner | pool | released tracks | Continuity tracks |
|---|---:|---:|---:|
| 1inch | $7,000 | 2 | 1 |
| The Graph | $15,000 | 3 | 0 |
| World | $15,000 | 3 | 0 |
| Hedera | $15,000 | 5 | 1 |
| 0G | $15,000 | 3 | 1 |
| Uniswap Foundation | $10,000 | 2 | 1 |
| Sui | $6,000 | 2 | 1 |
| ENS | $5,000 | 3 | 1 |
| **Total** | **$88,000** | **23** | **6** |

## Complete Prize Ladder And Project Fit

`A` is AlphaDawg/Project A. `B` is the clean from-scratch Project B. `Flat` means equal awards rather than ranked placements.

| partner | track | payout ladder | first slot | category | mandatory sponsor-native proof | A | B |
|---|---|---|---:|---|---|---|---|
| 1inch | Build an Aqua App | $2,500 / $1,500 / $1,000 | $2,500 | standard | Official Aqua/SwapVM contracts, sophisticated position, token-transfer demo, proper history; local fork allowed | `REJECTED` without regular-track ruling | `FALLBACK` AquaSentinel |
| 1inch | Build an Aqua App — Continuity | $1,500 / $500 | $1,500 | Continuity | Same Aqua/SwapVM proof plus admissible prior state and event delta | `REJECTED_FIT` unless Aqua becomes product-critical | `REJECTED` new project |
| The Graph | Best AI Tooling | $3,000 / $2,000 / $2,000 | $3,000 | standard | Reusable MCP/SKILL/plugin/config using live Graph-provider data; public repo; 2–4 minute video | `BLOCKED` regular-track admission | `ALTERNATE` only as reusable tooling |
| The Graph | Best AI Use Case | $2,000 / $1,000 / $1,000 | $2,000 | standard | AI reasons or acts on live Subgraph/Subgraph MCP/Substreams data | `BLOCKED` regular-track admission | `CONDITIONAL` only if live chain data changes the decision |
| The Graph | Best Composable/Standardized Products | $2,000 / $1,000 / $1,000 | $2,000 | standard | Two Graph products or meaningful standardized-schema use; one ordinary query fails | `BLOCKED` regular-track admission | `REJECTED_SCOPE` for the selected build |
| World | AgentKit New Use Cases | $4,000 / $2,500 / $1,500 | $4,000 | standard | Verify an agent is human-backed before granting access, pricing, authorization, or execution rights | `BLOCKED` regular-track admission | `WATCH`; current ProofRail human signer already owns authority |
| World | Selfie Check Beta | $2,000 / $1,500 | $2,000 | standard beta | Meaningful risk/eligibility/fairness/abuse signal plus developer and user testing documentation | `BLOCKED` regular-track admission | `REJECTED_SCOPE` |
| World | Identity Check Beta Test | $2,000 / $1,500 | $2,000 | standard beta | Necessary minimized identity attribute plus developer/user testing documentation | `BLOCKED` regular-track admission | `REJECTED_SCOPE` unless a legal eligibility attribute is indispensable |
| Hedera | AI & Agentic Payments | Flat $3,000 × 2 | $3,000 | standard | AI/multi-agent system executes a real Hedera Testnet payment, token transfer, or financial operation | `BLOCKED` regular-track admission | `PRIMARY` ProofRail settlement |
| Hedera | Tokenization | Flat $1,500 × 2 | $1,500 | standard | HTS token creation/configuration and a real lifecycle operation on Testnet | `BLOCKED` regular-track admission | `CONDITIONAL`; only if a claim token is load-bearing |
| Hedera | No Solidity Allowed | Flat $1,000 × 3 | $1,000 | standard | Hedera JS/TS or Python SDK, no Solidity, at least two native services | `BLOCKED` regular-track admission | `ALTERNATE`; incompatible with Solidity-dependent path |
| Hedera | Cross-Chain Automation Hub | Flat $1,000 × 2 | $1,000 | standard | Schedule Service → Axelar GMP → real destination execution, no project cron/keeper | `BLOCKED` regular-track admission | `CONDITIONAL`; only for a real cross-chain obligation |
| Hedera | Autonomous On-Chain Automation Platform | Flat $1,000 × 1 | $1,000 | Continuity | User creates/approves/manages a real scheduled Testnet action executed by Hedera | `FALLBACK` if scheduling is core | `REJECTED` new project |
| 0G | Best AI Product | $3,000 / $2,000 / $1,000 | $3,000 | standard | Working product with 0G Compute/Private Computer inference proof and runnable/live demo | `BLOCKED` regular-track admission | `PRIMARY` verified decision layer |
| 0G | Best Infrastructure & Tooling | Flat $1,500 × 3 | $1,500 | standard | Reusable framework/tool plus one working example | `BLOCKED` regular-track admission | `ALTERNATE` to Product, not stacked absent approval |
| 0G | Keep Building | Flat $1,500 × 3 | $1,500 | Continuity | Prior-state hash, dated changelog, meaningful 0G event delta, runnable product | `PRIMARY` | `REJECTED` new project |
| Uniswap Foundation | Best API Integration | $4,000 / $2,000 / $1,000 | $4,000 | standard | Valid API key is core; public repo, `FEEDBACK.md`, completed feedback form, README code pointers | `BLOCKED` regular-track admission | `CONDITIONAL_ALTERNATE`; required asset conversion only |
| Uniswap Foundation | Best Stack Contribution | Flat $1,000 × 3 | $1,000 | Continuity | Meaningful open-source Uniswap stack contribution plus feedback artifacts | `FALLBACK` if a real reusable contribution replaces Sui | `REJECTED` new project |
| Sui | Best App Built on Sui | Flat $2,000 × 2 | $2,000 | new project | Market-viable app with load-bearing Sui stack and Testnet/Mainnet demo | `REJECTED` existing app | `FALLBACK` SealSwitch |
| Sui | Best Existing App Integration/Port | Flat $2,000 × 1 | $2,000 | Continuity | Core Move/Walrus/Seal/DeepBook/zkLogin integration with before/after proof | `PRIMARY_THIRD` if execution breaks when removed | `REJECTED` new project |
| ENS | Most Creative Use | Flat $1,500 × 1 | $1,500 | standard | Functional non-hardcoded ENS capability plus video/live link and Sunday booth | `BLOCKED` regular-track admission | `CONDITIONAL` only if load-bearing |
| ENS | Best Integration for AI Agents | Flat $1,500 × 1 | $1,500 | standard | ENS materially improves agent identity/discovery; functional demo and Sunday booth | `BLOCKED` regular-track admission | `ALTERNATE` |
| ENS | Best Continuity Integration | Flat $2,000 × 1 | $2,000 | Continuity | Material event-window ENS identity/discovery capability; functional demo and Sunday booth | `PRIMARY` | `REJECTED` new project |

## Recommended Prize Paths

| lane | selected partners/tracks | conservative first-slot cap | decision |
|---|---|---:|---|
| Project A core | 0G Keep Building + ENS Continuity | **$3,500** | `NARROW`; finish verified execution and identity/version discovery first. |
| Project A Sui extension | Core + Sui Existing App | **$5,500** | Select only when revocable package access gates a real shared-runtime execution by H20. |
| Project A Hedera fallback | Core + Hedera Continuity | **$4,500** | Select instead of Sui only when a real user-managed scheduled payout/action is product-critical. |
| Project B primary | 0G Product + Hedera Agentic Payments | **$6,000** | Two separately executed model reviews, deterministic settlement/recovery, and one human-signed direct Testnet payment. |
| Project B third-partner watch | World AgentKit **or** The Graph AI Use Case | **$10,000 with World; $8,000 with Graph** | Not selected. Reconsider only after core is green and removing the primitive breaks a written product guarantee. |
| Project B fallback 1 | 1inch Aqua App | **$2,500** | AquaSentinel: one deep deterministic local-fork product, not a sponsor bundle. |
| Project B fallback 2 | Sui New App | **$2,000** | SealSwitch: one load-bearing Move/Seal/Walrus access-control loop. |

Do not sum World beta tracks, Hedera subtracks, or mutually exclusive 0G classifications into an expected payout. Project B currently selects two partners; its conservative selected cap is $6,000.

## Primary Sources

- [Lisbon prizes](https://ethglobal.com/events/lisbon2026/prizes), [event guide](https://ethglobal.com/events/lisbon2026/info/details), [rules](https://ethglobal.com/rules)
- [1inch Aqua](https://github.com/1inch/aqua), [Aqua SDK](https://github.com/1inch/sdks/tree/master/typescript/aqua), [SwapVM template](https://github.com/1inch/swap-vm-template)
- [The Graph AI](https://thegraph.com/docs/en/ai-overview/), [Substreams skills](https://github.com/streamingfast/substreams-skills), [Subgraph MCP](https://thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp/introduction/)
- [World AgentKit](https://docs.world.org/agents/agent-kit/integrate), [Selfie Check](https://docs.world.org/world-id/credentials/11), [Identity Check](https://docs.world.org/world-id/idkit/credentials#identity-check-preview)
- [Hedera Agent Kit](https://github.com/hashgraph/hedera-agent-kit), [code snippets](https://github.com/hedera-dev/hedera-code-snippets), [Schedule Service](https://docs.hedera.com/evm/hedera-services/system-contracts/schedule-service)
- [0G Builder Hub](https://build.0g.ai), [0G docs](https://docs.0g.ai), [Private Computer](https://pc.0g.ai)
- [Uniswap docs](https://developers.uniswap.org/docs), [Uniswap AI](https://github.com/Uniswap/uniswap-ai), [feedback form](https://developers.uniswap.org/hackathon-feedback)
- [EVM × Sui](https://mystenlabs.github.io/evm-sui/), [Walrus docs](https://docs.wal.app/)
- [ENSIP-25](https://docs.ens.domains/ensip/25/), [ENSIP-26](https://docs.ens.domains/ensip/26/), [ENS CLI](https://github.com/ensdomains/ens-cli)
