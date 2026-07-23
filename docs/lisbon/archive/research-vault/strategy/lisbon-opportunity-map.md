# Lisbon 2026 Opportunity Map

> Historical snapshot from 2026-06-22. Yellow is no longer on the current Lisbon 2026 prize page; Sui is now listed and multiple partner tracks are published. Use [[alphadawg-lisbon-continuity-strategy]] and [[../events/ethglobal-lisbon-2026]] for the current decision.

access_date: 2026-06-22
event: ETHGlobal Lisbon 2026
event_url: https://ethglobal.com/events/lisbon2026
prizes_url: https://ethglobal.com/events/lisbon2026/prizes
confidence: medium for strategy recommendations because they are derived from official partner positioning; high for partner presence and visible prize amounts; low for unpublished partner-specific track requirements.

## Builder Targeting Constraints

- Official partner prize cap: choose up to 3 partner prizes per project. Confidence: high. Source: https://ethglobal.com/events/lisbon2026
- Classic Track - From Scratch: do not implement the project before the event if aiming for ETHGlobal Finalist eligibility. Confidence: high. Source: https://ethglobal.com/events/lisbon2026
- Continuity Track: existing projects can expand functionality during the hackathon, but current partner-specific continuity categories are not visible yet. Confidence: medium. Source: https://ethglobal.com/events/lisbon2026
- Current visible partner prize surface: The Graph, Yellow, World, Hedera, 0G, Uniswap Foundation, ENS, and 1inch, totaling $95,000. Confidence: high. Source: https://ethglobal.com/events/lisbon2026/prizes

## Opportunity Clusters

| Cluster | Best-fit partners | Builder thesis | Proof to show | Confidence | Gaps |
|---|---|---|---|---|---|
| Onchain data products | The Graph, Uniswap Foundation, 1inch | Build data-rich apps that index protocol activity, liquidity, swaps, positions, governance, or user-facing market state. | Custom subgraph or indexed data layer, live app, query examples, clear end-user workflow. | Medium | The Graph, Uniswap Foundation, and 1inch bounty criteria are not published yet. |
| Intent-based and cross-chain DeFi | 1inch, Uniswap Foundation, Yellow | Combine aggregation, intents, cross-chain swaps, or state-channel settlement into lower-friction trading and routing UX. | Working swap or settlement flow, transaction traces, route comparison, risk controls. | Medium | Yellow and 1inch track requirements are not published yet. |
| Human identity and trust UX | World, ENS | Build flows where users need human uniqueness, identity, profiles, attestations, naming, or anti-sybil gating. | Working identity or naming integration, abuse case handled, privacy and recovery story. | Medium | World and ENS bounty criteria are not published yet. |
| Decentralized AI apps | 0G, World, The Graph, ENS | Build AI products that need decentralized infrastructure, human verification, discoverable identities, or indexed onchain context. | AI feature with onchain or decentralized component, data provenance, attribution for AI-generated work. | Medium | 0G bounty requirements are not published yet; AI tool usage must be attributed under event FAQ guidance. |
| EVM enterprise and real-world workflows | Hedera, The Graph, ENS | Build tokenization, identity, audit, compliance, or real-world asset workflows on an EVM-compatible stack with indexed state and readable identities. | Deployed contracts, test transactions, indexed dashboard, realistic stakeholder workflow. | Medium | Hedera-specific Lisbon criteria are not published yet. |
| User onboarding and wallet abstraction | ENS, World, 1inch, Uniswap Foundation | Improve consumer-grade onboarding into DeFi or identity workflows with readable names, verified users, and clear transaction paths. | End-to-end demo for a first-time user, recovery and failure states, measurable UX reduction. | Medium | Partner pages do not yet state whether UX-only work qualifies. |

## Partner Notes

| Partner | Visible pool | Current strategic angle | Source |
|---|---:|---|---|
| The Graph | $15,000 | Decentralized indexing and querying for onchain data; strong fit for analytics, discovery, governance, and app backends. | https://ethglobal.com/events/lisbon2026/prizes/the-graph |
| Yellow | $15,000 | State-channel clearing and non-custodial cross-chain trading; strong fit for settlement, liquidity, and chain-agnostic trading workflows. | https://ethglobal.com/events/lisbon2026/prizes/yellow |
| World | $15,000 | Human identity in the AI era; strong fit for anti-sybil, human-gated apps, reputation, and inclusive finance. | https://ethglobal.com/events/lisbon2026/prizes/world |
| Hedera | $15,000 | EVM blockchain with Solidity and SDK support; strong fit for high-throughput, low-fee, enterprise, tokenization, and identity cases. | https://ethglobal.com/events/lisbon2026/prizes/hedera |
| 0G | $15,000 | Decentralized AI infrastructure; strong fit for AI apps that need decentralized compute, data, privacy, or autonomy claims. | https://ethglobal.com/events/lisbon2026/prizes/0g |
| Uniswap Foundation | $10,000 | DeFi protocol innovation, Unichain, Uniswap v4, developer success, and governance; strong fit for liquidity, hooks, governance, and trading apps. | https://ethglobal.com/events/lisbon2026/prizes/uniswap-foundation |
| ENS | $5,000 | Universal internet naming and pointers; strong fit for identity, profiles, payments, discovery, and wallet UX. | https://ethglobal.com/events/lisbon2026/prizes/ens |
| 1inch | $5,000 | DeFi aggregation, APIs, intents, Fusion/Fusion+, and cross-chain swaps; strong fit for trading UX, routing, MEV-aware swaps, and API-driven DeFi apps. | https://ethglobal.com/events/lisbon2026/prizes/1inch |

## Recommended Prize Target Combinations

| Project shape | Target partners | Why this is coherent | Confidence |
|---|---|---|---|
| Data-backed DeFi cockpit | The Graph, Uniswap Foundation, 1inch | All three reward projects that can turn indexed DeFi state into a useful action layer. | Medium |
| Verified human finance app | World, ENS, Uniswap Foundation | Combines human uniqueness, readable identity, and DeFi execution. | Medium |
| Cross-chain settlement prototype | Yellow, 1inch, The Graph | Pairs trading or settlement flow with routing and observable state. | Medium |
| Decentralized AI identity assistant | 0G, World, ENS | Gives the AI component decentralized infrastructure, human verification, and user-readable identity. | Medium |
| Enterprise tokenization dashboard | Hedera, The Graph, ENS | Uses EVM deployment, indexed state, and readable asset or account identities. | Medium |

## Gaps To Recheck Before Hacking

- Official partner pages currently do not publish detailed tracks, requirements, prize splits, or judging rubrics.
- The official FAQ references Continuity Track partner categories, but no current Lisbon partner page exposes those categories.
- Recheck all partner prize pages close to the event before committing to a prize-targeting strategy.
