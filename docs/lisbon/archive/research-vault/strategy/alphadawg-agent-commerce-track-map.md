# AlphaDawg Agent Commerce: Lisbon Track And Implementation Map

> [!warning] Partner selection superseded
> This note preserves the earlier Uniswap architecture analysis. The active portfolio and prize economics are controlled by [[alphadawg/06_Hedera_0G_1inch_Scope_Audit]].

access_date: 2026-07-16  
status: recommended build direction  
baseline_sha: `bfa7bd37c573e2e49525d965f7f937210e170d72`  
parent_strategy: [[alphadawg-lisbon-continuity-strategy]]

## Decision

Build **AlphaDawg Agent Commerce Kit**: an open-source, proof-carrying commerce layer for agents, with AlphaDawg as its first working client.

The Lisbon demo should prove this loop:

1. AlphaDawg publishes a typed task and maximum budget.
2. Independently registered agents are discovered through ERC-8004/A2A metadata.
3. Agents return signed quotes with price, capability, deadline, and validation terms.
4. AlphaDawg selects a quote by policy, not by hard-coded name.
5. The agent returns a result verified by 0G Compute/Private Computer.
6. AlphaDawg accepts or rejects delivery deterministically.
7. An accepted provider receives a real payment on Hedera Testnet.
8. After finalized settlement, a supported-testnet trade executes through the Uniswap API.
9. One receipt binds task, quote, payment, result, 0G proof, trade, and ERC-8004 feedback.

This creates reusable Ethereum infrastructure rather than another closed trading bot.

## Current AlphaDawg Gaps

| current behavior | evidence in baseline | consequence | Lisbon replacement |
|---|---|---|---|
| Static runtime registry | `src/config/agent-registry.ts` lists 13 names and fixed ports/URLs. | Only known AlphaDawg agents can participate. | `AgentDirectory` backed by ERC-8004 registration files and A2A Agent Cards. |
| Predetermined hiring pools | `src/agents/role-manifests.ts` assigns fixed candidates to Alpha, Risk, and Executor. | “Discovery” only rotates among predefined names. | Capability query plus reputation, price, and validation filters. |
| Fixed price | `src/agents/hire-specialist.ts` and Fly server hard-code `$0.001`. | No negotiation, supply, differentiation, or price discovery. | Signed request-for-quote and award flow. |
| Task is not meaningful to specialists | Local specialist server accepts `task` but handlers fetch data solely by identity; Fly specialists also use fixed fetchers/prompts. | The buyer does not purchase a precise deliverable. | Typed `TaskSpec`, declared input/output schema, deadline, and acceptance policy. |
| Two disconnected registries | Static runtime registry and Prisma marketplace coexist. | Database agents do not automatically become callable runtime agents. | One canonical directory interface with onchain and local-cache adapters. |
| User-created agents are placeholders | Creation assigns `local://user-created`. | “Create agent” produces metadata, not a reachable paid agent. | Require a verified A2A endpoint and payment account before activation. |
| Marketplace hire is not runtime commerce | `/api/marketplace/hire` only creates a database relation. | Clicking hire does not cause discovery, negotiation, payment, or delivery. | Persist a real A2A task lifecycle and settlement receipt. |
| Payment is Arc-only and sometimes optional | Circle x402 is pinned to Arc; Fly paywall disables itself when configuration is missing. | No Hedera agentic-payment eligibility; unpaid responses can enter the system. | Pluggable settlement with Hedera as Lisbon default; no paid status without a final transaction. |
| Wallet ownership is centralized | Specialist wallets are derived from one master mnemonic unless overridden. | Agents appear economically separate but share one signing root. | Independent seller accounts or explicit custodial ownership metadata per agent. |
| Failed commerce degrades into signals | Several network/payment/0G failures continue with HOLD or local fallback. | Absence of evidence can be mistaken for a valid analytical result. | Fail closed: unverified/unpaid delivery cannot affect execution or reputation. |
| Hierarchical proof is lost | `main-agent.ts` flattens remote specialists with `teeVerified: false`. | Valid remote proofs are not faithfully propagated. | Preserve and verify proof fields end to end. |
| Reputation is local | Prisma ELO drives selection. | Trust cannot be composed by other Ethereum applications. | Publish normalized outcome feedback to ERC-8004 Reputation Registry. |
| Trade execution is a demo path | Arc `MockSwapRouter` and self-transfer fallback remain. | Transaction existence does not prove real market execution. | Uniswap API approval, quote, simulation, swap/order, and status receipt. |

## Released Track Map

ETHGlobal permits selecting three partners; all tracks under one selected partner may be considered. Actual multi-track awards remain partner-discretionary. Only 0G Keep Building and Uniswap Stack Contribution are explicitly labeled Continuity in the preferred portfolio; confirm eligibility for every other category in writing.

### 0G — $15,000

| track | pool | required Lisbon delta | fit | target? |
|---|---:|---|---|---|
| Keep Building on 0G | $4,500 | Prior-state link, dated changelog, new feature/hardening/readiness, and “What's next.” | Exact: AlphaDawg began at Cannes and already won a 0G track. | **Yes — mandatory primary.** |
| Best Infrastructure & Tooling on 0G | $4,500 | Reusable framework/SDK/tooling plus one working example agent/app. | Exact if commerce/validation components are extracted as a kit and AlphaDawg is the example. | **Conditional — confirm Continuity eligibility.** |
| Best AI Product on 0G | $6,000 | Working end-user product with provable 0G Compute/Private Computer use. | Strong if the work remains mostly an AlphaDawg feature rather than reusable tooling. | Alternative to Infrastructure, not the main story. |

Recommended 0G positioning:

- “0G is the delivery verifier and persistent evidence layer for cross-organization agent commerce.”
- Each `Delivery` includes the 0G attestation and output hash.
- Invalid or unverified delivery cannot be paid, executed, or scored.
- Store task, quotes, award, delivery, and receipt as an append-only 0G evidence DAG.
- Publish the validation adapter as reusable TypeScript.

Strategic choice: pitch **Infrastructure + Continuity**, not both Product and Infrastructure. Product-vs-infrastructure category overlap weakens clarity.

### Hedera — $15,000

| track | pool | required Lisbon delta | fit | target? |
|---|---:|---|---|---|
| AI & Agentic Payments | $6,000 | Agent or multi-agent system executes a real Hedera Testnet payment/financial operation using supported agent/payment tooling. | Exact: replaces fake/static agent commerce with discovery, quote, award, payment, and receipt. | **Conditional primary — confirm Continuity eligibility.** |
| Tokenization on Hedera | $3,000 | HTS token creation/management and a demonstrated lifecycle operation. | Possible through provider performance bonds or prepaid service credits. | Conditional stretch only. |
| No Solidity Allowed | $3,000 | Application uses Hedera SDK/native services and no Solidity/smart contracts. | Existing AlphaDawg deploys `AlphaDawgAuditLog.sol` to Hedera EVM. | **No — conflict risk.** |
| Cross-Chain Automation Hub | $3,000 | Hedera Schedule Service triggers Axelar GMP and a fully onchain destination-chain action. | Possible for scheduled Uniswap execution, but it creates a second hard problem. | **No for core build.** |

Recommended Hedera positioning:

- Register or resolve providers through A2A/ERC-8004 metadata; optionally mirror discovery through HCS agent standards.
- Send the awarded provider HBAR or HTS payment on Hedera Testnet only after verified delivery.
- Write task/quote/payment/delivery hashes to HCS as a compact commerce receipt.
- Use independent provider accounts.
- Demonstrate two providers with different prices and one real selection/payment.

Optional tokenization extension: **performance bonds**. A provider locks an HTS bond when quoting; successful verified delivery releases it, while failed delivery marks or reduces it. Only attempt this after the primary loop passes.

### Uniswap Foundation — $10,000

| track | pool | required Lisbon delta | fit | target? |
|---|---:|---|---|---|
| Best Uniswap API Integration | $7,000 | Valid API key and core use for execution/routing/payments/liquidity/coordination; public repo, `FEEDBACK.md`, feedback form. | Exact: replace mock execution with approval, quote, simulation, swap/order, and status. | **Conditional primary — confirm Continuity eligibility.** |
| Best Uniswap Stack Contribution | $3,000 | Continuity project extending the Uniswap ecosystem through an integration, protocol extension, hook, or tooling. | Strong if the intent-to-Uniswap adapter is reusable and documented. | **Yes — secondary under same partner.** |

Recommended Uniswap positioning:

- The purchased agent output is only a proposed `TradeIntent`; it cannot contain arbitrary calldata.
- Policy converts a verified intent into constrained Uniswap parameters.
- Use `/check_approval`, `/quote`, `/swap` or `/order`, then poll status.
- Default to Unichain Sepolia; Base Sepolia is the fallback if the selected test pair lacks liquidity.
- Store Uniswap request ID, route, simulation status, chain ID, and final transaction in the unified receipt.
- Publish a typed `VerifiedIntent -> UniswapRequest` adapter with sanitization and spending limits.

## Prize Exposure

| build posture | aligned track pools | addressable pool | trade-off |
|---|---|---:|---|
| Strictly confirmed Continuity | 0G Continuity + Uniswap Stack Contribution | **$7,500** | Published eligibility; leaves the third partner slot open. |
| Preferred conditional infrastructure-first | 0G Continuity + 0G Infrastructure + Hedera Agentic Payments + both Uniswap tracks | **$25,000** | Strongest Ethereum contribution, but requires written eligibility confirmation. |
| Product-first | 0G Continuity + 0G AI Product + Hedera Agentic Payments + both Uniswap tracks | **$26,500** | Slightly larger pool, but weaker reusable-infrastructure story. |
| With Hedera performance bonds | Preferred conditional posture + Hedera Tokenization | **$28,000** | Only worthwhile if bonds are core and the base commerce loop is already reliable. |

These figures are pool exposure, not expected winnings. Partners may place one submission in only one internal category or decline overlapping awards.

## Ranked Build Directions

| rank | direction | tracks | Ethereum value | feasibility | decision |
|---:|---|---|---|---|---|
| 1 | **Proof-Carrying Agent Commerce Kit** | 0G Infrastructure + Continuity; Hedera Agentic; Uniswap API + Stack | ERC-8004 discovery/reputation plus reusable verified-intent execution. | Medium-high if limited to two providers and one trade pair. | **BUILD** |
| 2 | Competitive Alpha Auction | 0G Product + Continuity; Hedera Agentic; Uniswap API | Demonstrates open price discovery for agent intelligence. | High; narrower than the full kit. | Fallback product scope. |
| 3 | Outcome-Bonded Specialist Market | Hedera Agentic + Tokenization; 0G Continuity | Adds crypto-economic trust to ERC-8004 feedback. | Medium-low; requires credible outcome timing and bond lifecycle. | Stretch after core. |
| 4 | Scheduled Cross-Chain Mandates | Hedera Automation; Uniswap API; 0G | Shows autonomous cross-chain execution. | Low within 36 hours; Axelar and scheduling dominate the build. | Reject. |
| 5 | Generic Agent Marketplace | 0G Product; Hedera Agentic | Broad discovery/payment surface. | Superficially easy, but indistinguishable and hard to finish. | Reject. |

## Protocol Design

### Canonical records

```text
TaskSpec
  taskId, buyerAgentId, capability, inputHash, outputSchema,
  maxBudget, deadline, validationPolicy, executionPolicy

AgentQuote
  taskId, sellerAgentId, price, paymentAsset, paymentNetwork,
  serviceEndpoint, deliveryDeadline, proofType, expiry, signature

Award
  taskId, acceptedQuoteHash, buyerAgentId, signature

Delivery
  taskId, outputURI, outputHash, zeroGAttestation,
  modelOrServiceId, createdAt

CommerceReceipt
  taskHash, quoteHash, awardHash, hederaTxId, hcsSequence,
  deliveryHash, validationStatus, uniswapRequestId,
  uniswapTxHash, erc8004FeedbackRef
```

### State machine

```text
OPEN -> QUOTED -> AWARDED -> DELIVERED -> VERIFIED -> SETTLED
                                  -> REJECTED        -> EXECUTED -> SCORED
```

No state may be skipped. Replaying a `taskId` must not duplicate payment or trade execution.

### Ethereum layer

Use ERC-8004 for:

- Portable provider identity.
- Registration files advertising A2A/MCP endpoints, supported trust, and payment support.
- Reputation feedback containing A2A task identifiers and Hedera proof of payment.
- Validation requests/responses pointing to 0G delivery evidence.

ERC-8004 intentionally leaves payments orthogonal, so Hedera settlement is complementary rather than duplicative.

### Proposed modules

```text
src/commerce/types.ts
src/commerce/directory.ts
src/commerce/discovery/erc8004.ts
src/commerce/transport/a2a.ts
src/commerce/rfq.ts
src/commerce/settlement/hedera.ts
src/commerce/validation/zero-g.ts
src/commerce/reputation/erc8004.ts
src/commerce/execution/uniswap.ts
src/commerce/receipt.ts
src/commerce/orchestrator.ts
app/.well-known/agent-card.json/route.ts
```

Do not rewrite the existing cycle engine. Add a bounded commerce seam and replace one hard-coded specialist path end to end.

## Minimum Winning Slice

Two provider agents:

- `momentum-provider`: $0.002, delivery in 20 seconds.
- `risk-provider`: $0.001, delivery in 10 seconds.

One task:

- Analyze a single supported Uniswap test pair and return a typed `TradeIntent`.

One selection policy:

- Required capability, verified endpoint, price under budget, ERC-8004 reputation floor, 0G proof required.

One execution policy:

- Allowlisted tokens, exact chain, maximum amount, maximum slippage, fresh quote, verified delivery, idempotency key.

One judge-visible failure:

- Provider returns an unverified delivery; AlphaDawg rejects it, does not trade, and records negative/failed validation without faking payment success.

One success:

- Second provider returns 0G-verified output, is paid on Hedera, and triggers a real Uniswap testnet trade.

## Implementation Sequence

| gate | work | pass condition |
|---:|---|---|
| 0 | Contributor consent, license, organizer team confirmation | Continuity/IP gate cleared. |
| 1 | `TaskSpec`, `AgentQuote`, receipt types and state machine | Unit tests reject invalid transitions and duplicate task IDs. |
| 2 | A2A Agent Cards and ERC-8004 directory adapter | Two non-static providers discovered by capability. |
| 3 | RFQ and EIP-712 quote verification | Two signed quotes; invalid/expired quote rejected. |
| 4 | 0G delivery validator | Unverified result fails closed; verified result advances exactly once. |
| 5 | Hedera settlement adapter | Only verified delivery produces one final Testnet payment and Hashscan proof. |
| 6 | Uniswap execution adapter | Real supported-testnet approval/quote/simulation/execution/status. |
| 7 | ERC-8004 feedback plus unified receipt | External verifier can follow every proof reference. |
| 8 | UI and evidence | Judge runs failure then success within four minutes. |

## Cut Order

Cut in this order if time slips:

1. HTS performance bonds / Tokenization track.
2. ERC-8004 Validation Registry write; retain Identity and Reputation.
3. More than two providers.
4. More than one asset pair.
5. Negotiation beyond one signed quote round.
6. Marketplace redesign.

Never cut:

- Real Hedera payment.
- 0G verification gate.
- Real Uniswap API execution.
- Dynamic non-static provider discovery.
- Unified receipt and idempotency.

## Submission Claim

> AlphaDawg Cannes proved that a swarm could pay specialists, debate, and trade. Lisbon removes the closed-world assumptions. Agent Commerce Kit lets any ERC-8004/A2A provider quote for work, return 0G-verifiable delivery, receive settlement on Hedera, and earn portable Ethereum reputation. AlphaDawg is the first client, executing accepted intelligence through the Uniswap API under deterministic user policy.

## Sources

- https://ethglobal.com/events/lisbon2026/prizes
- https://ethglobal.com/rules
- https://ethglobal.com/showcase/alpha-dawg-fh6vm
- https://github.com/elbarroca/ETH_Global_Cannes_2026
- https://eips.ethereum.org/EIPS/eip-8004
- https://github.com/hedera-dev/hedera-agent-kit
- https://github.com/hashgraph-online/conversational-agent
- https://developers.uniswap.org/docs/trading/swapping-api/getting-started
- https://developers.uniswap.org/docs/trading/swapping-api/supported-chains
