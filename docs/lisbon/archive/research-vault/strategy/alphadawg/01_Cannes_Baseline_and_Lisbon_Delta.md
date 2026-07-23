---
title: AlphaDawg Cannes Baseline and Lisbon Delta
tags:
  - alphadawg
  - ethglobal/cannes-2026
  - ethglobal/lisbon-2026
status: ready
area: baseline
priority: P0
owner: team
gate: continuity-disclosure
confidence: high
updated: 2026-07-16
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
---

# AlphaDawg Cannes Baseline And Lisbon Delta

## What Cannes Already Proved

AlphaDawg was a multi-agent trading swarm with ten market-data specialists, Alpha/Risk/Executor debate agents, Arc x402 nanopayments, 0G sealed inference and Storage memory, Hedera audit/token/scheduling features, Telegram control, a Next.js dashboard, and Arc testnet execution.

Official awards:

- **Hedera — ioBuilders Naryo Builder Challenge, 2nd place.**
- **0G — Best DeFi App on 0G, 2nd place.**

Sources: [AlphaDawg showcase](https://ethglobal.com/showcase/alpha-dawg-fh6vm), [public repository](https://github.com/elbarroca/ETH_Global_Cannes_2026).

## What The Existing Marketplace Actually Does

| baseline behavior | evidence | limitation |
|---|---|---|
| Thirteen runtime entries are compiled into a static registry. | `src/config/agent-registry.ts` | A new provider cannot join without code/config changes. |
| Create Agent writes `local://user-created`. | `app/api/marketplace/create/route.ts` | It creates metadata, not a reachable provider. |
| Hire only upserts `UserHiredAgent`. | `app/api/marketplace/hire/route.ts` | No negotiation, runtime call, payment, or delivery occurs. |
| Role manifests contain fixed candidate pools. | `src/agents/role-manifests.ts` | Reputation only ranks predefined agents. |
| Specialist price is fixed at `$0.001`. | `src/agents/hire-specialist.ts` | No price discovery or provider-specific terms. |
| Specialist behavior is selected by `AGENT_NAME`. | `src/agents/fly-agent-server.ts` | The caller is not buying a precise typed deliverable. |
| No task/RFQ/quote/award/delivery models exist. | `prisma/schema.prisma` | The marketplace has no commerce lifecycle. |
| Payment is Arc-specific and can degrade when disabled. | x402 buyer/server paths | A response can enter the system without proven settlement. |
| Specialist wallets derive from one application mnemonic. | `src/config/wallets.ts` | Providers are not economically independent. |
| Failed proof paths can fall back locally. | specialist and main-agent paths | Missing evidence can influence the decision. |
| A deterministic override can replace Executor HOLD with BUY. | `src/agents/main-agent.ts` | Demo outcome forcing weakens authentic agent evaluation. |
| Execution includes a mock-compatible router and self-transfer fallback. | `src/execution/arc-swap.ts`, `contracts/MockSwapRouter.sol` | Transaction existence does not prove market execution. |

## Lisbon Substantive Delta

| Cannes | Lisbon-new work |
|---|---|
| Static registry | Persistent directory populated from verified Agent Cards |
| Owner-operated specialists | Independently reachable third-party providers |
| Placeholder Create Agent | Register → verify → activate provider lifecycle |
| Fixed role pools | Capability, reputation, price, deadline, and proof-aware discovery |
| Fixed `$0.001` call | Signed RFQ and variable-price quotes |
| Database hire toggle | Typed task, quote, award, delivery, verification, settlement, execution |
| Arc-only payment | Real Hedera Testnet settlement after verified delivery |
| Shared mnemonic-derived providers | Independent provider signers and settlement accounts |
| Fixed specialist prompt | Typed task input/output contract |
| Local ELO | Portable feedback referencing payment and delivery evidence |
| Fail-open proof | No payment or execution without verified delivery |
| Forced BUY post-processing | Inference proposes; deterministic user policy alone authorizes execution |
| Mock/custom execution | Conditional custom 1inch Aqua/SwapVM position and balance-changing swap after written eligibility approval |
| Fragmented audit records | Canonical commerce receipt with stable hash |

> [!note] Scope boundary
> “Add an agent” means registering and verifying an already hosted provider. One-click model creation, container provisioning, deployment, billing subscriptions, and dispute arbitration are outside the minimum Lisbon slice.

## Continuity Disclosure Pack

- Prior showcase URL and baseline SHA.
- Before/after architecture diagram.
- Dated `CHANGELOG-LISBON.md` containing only event-window work.
- Commit history with small feature commits.
- New-code file map and deployed-address table.
- “What’s next” statement.
- Former-contributor consent and repository license.

See [ETHGlobal pre-existing-work rules](https://ethglobal.com/rules).
