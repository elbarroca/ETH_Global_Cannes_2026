---
title: AlphaDawg Current Web3 Agent Commerce Radar
aliases:
  - AlphaDawg Technology Radar
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - research/technology
  - agents/commerce
status: decision-ready
area: technology-radar
priority: P0
owner: team
gate: access-and-sponsor-confirmation
confidence: medium-high
updated: 2026-07-16
accessed_at: 2026-07-16T12:55:18+01:00
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
---

# Current Web3 Agent Commerce Radar

> [!important] Five technology decisions
> **BUILD** a minimal A2A 1.0 HTTP surface, 0G Private Computer/Compute plus Storage, direct Hedera settlement with HCS/Mirror evidence, and the Uniswap Trading API with Permit2. **WATCH** x402 v2 only as a bounded legacy migration; Arc x402 remains functionality, not a Lisbon prize target.

Accessed: `2026-07-16T12:55:18+01:00` (Europe/Lisbon). Pin packages and rerun network smokes at kickoff.

## Decision Rule

A technology is **BUILD** only when it maps to one AlphaDawg capability, one live sponsor criterion, and one judge-visible proof. **WATCH** means non-critical, immature, or valuable only after the core passes. **REJECT** means it does not fit the recommended 36-hour portfolio.

## Interoperability And Commerce Standards

| technology | current status / version | sponsor relevance and capability | integration and demo proof | risk / effort | decision |
|---|---|---|---|---|---|
| A2A | `v1.0.0`, released 2026-03-12. Stable `@a2a-js/sdk` 0.3.14 still implements spec v0.3; v1 JS support is alpha. | Hedera accepts A2A. Replaces the static registry with portable provider discovery, tracked tasks, and artifacts. | Implement the narrow v1 HTTPS surface directly: `/.well-known/agent-card.json`, `SendMessage`, `GetTask`, `CancelTask`, structured Artifacts, polling only. Demo a new provider without source edits and reject an invalid card/domain/auth binding. | SSRF/DNS rebinding, redirects to private IPs, unsigned cards, oversized artifacts, cross-caller task access, and v0.3/v1 mismatch. **5–8h.** | **BUILD** |
| A2A streaming / routing | Streaming, push, and multiple interfaces are optional; routing remains operator-defined. | Better UX but no selected track requires it. | Truthfully advertise `streaming:false`; add SSE only after polling and recovery pass. | Reconnection, ordering, backpressure, webhook SSRF. **3–5h extra.** | **WATCH** |
| x402 | Current v2; `@x402/core` 2.18.0 at access; CAIP-2 IDs; `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`. | Hedera lists x402 as optional. AlphaDawg already has Arc x402 legacy calls. | Preserve the current rail. Later migration must use the payment-identifier extension, bind method/resource/amount/network/expiry, persist task idempotency, and reject replay. | Facilitator verification is not delivery replay protection; v1/v2 headers/packages differ. **3–6h migration.** | **WATCH** |
| ERC-8004 | **Draft**, created 2025-08-13; Identity, Reputation, and Validation registries; payment is orthogonal. Canonical Validation remains under discussion. | Optional Hedera identity/reputation enhancement. | At most register one identity after core proof; link its A2A endpoint and receipt. | Draft/deployment drift, gas, sybil-sensitive reputation; identity is not trust. **2–4h.** | **WATCH** |
| ERC-8183 | **Draft**, created 2026-02-25; ERC-20 escrow job states Open → Funded → Submitted → Completed/Rejected/Expired. | Conceptually close to AlphaDawg jobs but not a named Lisbon requirement. | Post-event adapter only; it duplicates commerce state and Hedera settlement. | Escrow/evaluator/hook security and contract review. **8–14h.** | **REJECT** |
| UCP | Current date-versioned release `2026-04-08`; HTTPS discovery and A2A extensions for retail checkout/order/payment tokens. | Hedera lists UCP as optional, but it does not model RFQ/service-job settlement. | Do not add a retail checkout profile for a badge. | Product mismatch, payment credentials, fast versioning. **5–8h.** | **REJECT** |

Sources: [A2A releases](https://github.com/a2aproject/A2A/releases), [A2A specification](https://a2a-protocol.org/latest/specification/), [A2A discovery](https://a2a-protocol.org/latest/topics/agent-discovery/), [A2A JS SDK](https://github.com/a2aproject/a2a-js), [x402 v2 migration](https://docs.x402.org/guides/migration-v1-to-v2), [x402 facilitator](https://docs.x402.org/core-concepts/facilitator), [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004), [ERC-8183](https://eips.ethereum.org/EIPS/eip-8183), [UCP](https://ucp.dev/2026-04-08/specification/overview/).

## Hedera

| technology | current status / version | sponsor relevance and capability | integration and demo proof | risk / effort | decision |
|---|---|---|---|---|---|
| Direct Hedera SDK | `@hiero-ledger/sdk` 2.85.0 at access; mature native service path. | Explicitly accepted for Agentic Payments and smaller than a framework runtime. | Deterministically build, freeze, sign, and execute one allowlisted HBAR transfer; save receipt and transaction ID. | Keys, account funding, retry/duplicate submission. **4–7h including HCS/Mirror.** | **BUILD** |
| Hedera Agent Kit | Package split at access: legacy `hedera-agent-kit` 3.8.2; modular `@hashgraph/hedera-agent-kit` 4.0.0. | Explicitly accepted, but autonomous signing broadens the transaction surface. | Use only if a sponsor mentor requires it; never let free-form LLM output become a transaction. | v3/v4 migration, plugin/API drift, and operator-key custody. **4–6h if adopted.** | **WATCH** |
| HCS | Mature native consensus messaging. | Agentic Payments extra credit for an audit trail. | Submit only a redacted canonical receipt hash; query topic/sequence/timestamp and match it to settlement. | Public immutability, PII/secrets, payload size. **2–3h.** | **BUILD** |
| Mirror Node / Hashscan | Mature query/explorer evidence layer. | Makes the Testnet operation and HCS receipt judge-visible. | Poll with bounded retries; show consensus receipt plus matching indexed record and explorer link. | Indexing lag must not be treated as transaction failure. **2–3h.** | **BUILD** |
| HCS-14 UAID | **Draft** universal agent identifier across A2A/MCP/Hedera and other registries. | Optional identity extra credit. | Generate and bind one UAID only after core discovery works. | Draft churn; routing consistency is not provider honesty. **2–4h.** | **WATCH** |
| HTS | Mature native token service through SDK/system contracts. | Mandatory for Tokenization; optional for Agentic Payments. | Stretch: service-credit/invoice token lifecycle only after direct HBAR settlement. | Weak RWA story, admin/compliance keys, wording conflict. **5–8h.** | **WATCH** |
| Scheduled Transactions | Mature native scheduling; execution and expiry require careful proof. | Optional recurring-payment enhancement; base of Cross-Chain Automation. | Keep off the critical path; prove a native schedule separately if time remains. | Signature collection, immutability, timing, Mirror lag. **3–5h.** | **WATCH** |
| Axelar GMP + Schedule Service | Axelar is live on Hedera mainnet, but official evidence did not establish the exact Lisbon Hedera Testnet gateway/gas/faucet configuration. | Mandatory for Cross-Chain Automation. | Do not attempt until sponsor supplies configuration and an end-to-end smoke passes. | Two networks, gas, contracts, relayers, async finality, replay. **10–14h+ beyond core.** | **REJECT** |

Sources: [`@hiero-ledger/sdk`](https://www.npmjs.com/package/@hiero-ledger/sdk), [legacy Hedera Agent Kit](https://www.npmjs.com/package/hedera-agent-kit), [modular Hedera Agent Kit](https://www.npmjs.com/package/@hashgraph/hedera-agent-kit), [Hedera schedules](https://docs.hedera.com/hedera/core-concepts/scheduled-transaction), [Mirror Node API](https://docs.hedera.com/hedera/sdks-and-apis/rest-api), [HCS-14](https://hol.org/docs/standards/hcs-14/), [Axelar–Hedera](https://www.axelar.network/blog/axelar-hedera-integration), [Lisbon Hedera prize](https://ethglobal.com/events/lisbon2026/prizes/hedera).

## 0G

| technology | current status / version | sponsor relevance and capability | integration and demo proof | risk / effort | decision |
|---|---|---|---|---|---|
| Private Computer / Compute | Private Computer launched 2026-04-28; Router trust modes are standard, verified, and private; Compute TS SDK 0.8.4 at access. | 0G Product requires Compute/Private Computer proof; Infrastructure values native verification tooling. | Set `verify_tee:true` and `X-0G-Provider-Trust-Mode`; capture provider and response key; independently call `broker.inference.processResponse(provider, chatID)`. False or missing verification fails closed. | Key/funded ledger, provider availability; human-readable Proof ID is still “coming soon.” **3–5h.** | **BUILD** |
| Storage | TS SDK 1.2.10 at access. | Persists redacted delivery/receipt evidence for Product, Infrastructure, and Continuity. | Upload canonical redacted evidence; persist Merkle root and upload transaction; retrieve and verify proof/hash. | Availability, secret/PII leakage, retries. **3–5h.** | **BUILD** |
| Chain | Documented mainnet `16661` and Galileo `16602` were live-checked at access. | Optional anchor only; Hedera and Uniswap already own settlement/execution. | Use only if sponsor requires a 0G-chain proof beyond Compute/Storage. | Adds gas, signer, and third execution domain. **3–6h.** | **WATCH** |
| Agentic ID / ERC-7857 | ERC-7857 is **Final** and 0G implements private metadata ownership, authorization, and transfer. | Optional Product surface, not lightweight provider registration. | Do not mint for a badge; A2A already covers discovery. | TEE/ZKP transfer semantics and another contract path. **3–5h minimum.** | **REJECT** |

Fail-closed proof rule: do not claim a future Proof ID. Save the actual event-time request/output hashes, provider/model fields, response key, independent SDK verification result, timestamp, and sponsor-confirmed proof form.

Sources: [Private Computer launch](https://0g.ai/blog/0g-private-computer), [Private Computer](https://pc.0g.ai/), [verifiable execution](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/features/verifiable-execution), [Storage SDK](https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk), [mainnet](https://docs.0g.ai/developer-hub/mainnet/mainnet-overview), [Galileo](https://docs.0g.ai/developer-hub/testnet/testnet-overview), [ERC-7857](https://eips.ethereum.org/EIPS/eip-7857), [Lisbon 0G prize](https://ethglobal.com/events/lisbon2026/prizes/0g).

## Uniswap

| technology | current status / version | sponsor relevance and capability | integration and demo proof | risk / effort | decision |
|---|---|---|---|---|---|
| Trading API core | Generally available since 2026-04-16 at `https://trade-api.gateway.uniswap.org/v1`. | Mandatory for API Integration and useful evidence for a reusable Stack contribution. | `/check_approval` → `/quote` → validate CLASSIC route/transaction → Permit2 sign → `/swap` → simulate/broadcast → `/swaps`. Save request, route, transaction, and final status. | API key, wallet/RPC, gas/funds, slippage/expiry, rate limits, restart reconciliation. **6–10h.** | **BUILD** |
| Permit2 | Default API approval/signature model. | Bounded authorization for the core transaction. | Sign only the exact current quote’s EIP-712 `permitData`; never reuse an earlier signature. | Wrong spender/chain/amount/expiry and phishing/reuse. Included above. | **BUILD** |
| CLASSIC AMM route | Current v2/v3/v4/Universal Router path. | Smallest deterministic real execution. | Use one supported liquid pair and tiny approved amount; validate chain, sender, recipient, tokens, amount, slippage, deadline, value, and official router; simulate before broadcast. | Funds/gas and supported-network constraints; no mocks. | **BUILD** |
| UniswapX | Current v2/v3 auction routes depending on chain and economics. | Extra API depth, not required. | Never force; add only after CLASSIC, handling quote expiry, order signature, fill, and `/orders`. | Minimum-value economics, solver/fill uncertainty, weak testnet story. **3–5h extra.** | **WATCH** |
| Chained Actions | Ordered `planId` flow; docs say `/quote` may return `CHAINED` while the main routing table omits it. | Adds another state machine without improving core proof. | Defer until docs/runtime reconcile. | Partial completion, wallet prompts, bridge status, recovery. **5–8h.** | **REJECT** |
| Tokenized securities | Explicitly advertised by the Lisbon track, but user/jurisdiction/asset availability is dynamic. | Novel asset story only. | Do not depend on it. | Eligibility, liquidity, allowlists, real-value exposure. | **REJECT** |
| `uniswap-ai` | Official developer guidance/tooling, not runtime sponsor proof. | Can accelerate implementation. | Review and pin only the needed helper; README must expose direct API integration. | Plugin/generated-financial-logic supply chain. **1–2h evaluation.** | **WATCH** |

Sources: [Developer Platform launch](https://blog.uniswap.org/uniswap-developer-platform-is-live), [API integration guide](https://developers.uniswap.org/docs/trading/swapping-api/integration-guide), [Permit2](https://developers.uniswap.org/docs/trading/swapping-api/concepts/permit2), [AMM versus UniswapX](https://developers.uniswap.org/docs/trading/swapping-api/amm-vs-uniswapx-routing), [Chained Actions](https://developers.uniswap.org/docs/trading/swapping-api/chained-actions), [supported chains](https://developers.uniswap.org/docs/trading/swapping-api/supported-chains), [`uniswap-ai`](https://developers.uniswap.org/docs/uniswap-ai/overview), [Lisbon Uniswap prize](https://ethglobal.com/events/lisbon2026/prizes/uniswap-foundation).

## BUILD Mapping Gate

| BUILD technology | AlphaDawg feature | sponsor criterion | required demo proof |
|---|---|---|---|
| Minimal A2A 1.0 HTTP | External provider discovery and task/artifact lifecycle | Hedera accepts A2A; 0G Infrastructure values reusable tooling | Fetch and validate a card; run typed task; receive signed quote/artifact; reject invalid provider. |
| 0G Private Computer/Compute | Private/verifiable delivery | 0G requires Compute/Private Computer inference proof | Request/output hashes, provider/response key, independent SDK verification; tampered result rejected. |
| 0G Storage | Durable receipt | 0G rewards persistent evidence/hardening | Merkle root and upload transaction; proof-verified retrieval. |
| Hedera SDK + HCS/Mirror | Autonomous settlement and audit | Agentic Payments requires a Testnet financial operation | HBAR transaction/receipt, HCS sequence/timestamp, Mirror/Hashscan finality, idempotent rerun. |
| Uniswap API + Permit2 | Verified intent execution | Valid-key API core integration and reusable tooling | Approval/quote/Permit2, validated CLASSIC route, real transaction, final `/swaps` status. |

If any BUILD row lacks access, safe funding, or sponsor-accepted proof, downgrade it to blocked preparation; never replace live evidence with mock success.

## Security And Operations Gate

- Validate Agent Card URLs with HTTPS, DNS/IP rules, redirect revalidation, response-size/schema limits, JWS/domain binding, and timeouts.
- Never persist API keys, Hedera keys, payment signatures, secrets, raw private prompts, or PII in cards, HCS, 0G Storage, logs, or submissions.
- Canonicalize and hash tasks, quotes, deliveries, and intents before signing; include version, chain, asset, amount, recipient, expiry, and idempotency key.
- Keep proof, settlement, and execution as independent state transitions; retries resume but never double-pay or double-trade.
- LLM output is advisory. Deterministic policy enforces allowlists, amount, slippage, expiry, recipient, chain, and evidence state.

## Decision Contract

- **BUILD:** A2A 1.0 minimum, 0G Private Computer/Compute + Storage, direct Hedera SDK payment + HCS/Mirror, Uniswap API CLASSIC + Permit2.
- **WATCH:** x402 v2 migration, A2A streaming, ERC-8004, Hedera Agent Kit, HCS-14, HTS, schedules, UniswapX, and `uniswap-ai` as guidance.
- **REJECT:** ERC-8183, UCP, 0G ERC-7857 Agentic ID, Axelar GMP without confirmed Hedera Testnet configuration, Chained Actions, and tokenized-securities execution in the 36-hour build.

## Related

- [[09_Lisbon_Live_Track_and_Eligibility_Audit|Lisbon Live Track and Eligibility Audit]]
- [[15_Winner_Patterns_and_Prize_Portfolios|Winner Patterns and Prize Portfolios]]
- [[00_Command_Center|AlphaDawg Lisbon Command Center]]
