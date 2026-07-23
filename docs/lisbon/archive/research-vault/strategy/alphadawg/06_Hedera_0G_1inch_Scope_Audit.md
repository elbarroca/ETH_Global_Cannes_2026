---
title: AlphaDawg Hedera 0G 1inch Scope Audit
aliases:
  - AlphaDawg Three-Partner Audit
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - research/tracks
  - engineering/audit
status: decision-ready
area: scope-audit
priority: P0
owner: team
gate: eligibility-confirmation
confidence: high
updated: 2026-07-16
eligibility_status: research_only_not_promotable
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
target_partners:
  - Hedera
  - 0G
  - 1inch
excluded_partners:
  - Uniswap Foundation
  - Sui
---

# AlphaDawg Hedera, 0G And 1inch Scope Audit

> [!warning] Superseded portfolio
> The active decision replaces 1inch with Uniswap while preserving Arc x402. See [[07_Exact_0G_Hedera_Uniswap_Arc_Plan]].

> [!danger] Eligibility decision
> **Do not implement or count 1inch as an AlphaDawg Continuity prize yet.** Lisbon classifies 1inch Build an Aqua App and Hedera Agentic Payments as `building-from-scratch`. Only 0G Keep Building is explicitly `continuity-track`. Written ETHGlobal and sponsor approval is required before the same AlphaDawg submission can safely target Hedera or 1inch.

Access date: 2026-07-16. This note is pre-event research, not promotable eligibility proof and not authorization to pre-build Classic-track work.

## Executive Decision

| question | answer |
|---|---|
| Can AlphaDawg safely target 0G now? | **Yes.** Keep Building on 0G explicitly accepts existing Cannes projects. New qualifying work must be built during Lisbon. |
| Can AlphaDawg safely target Hedera Agentic Payments? | **Not yet.** Technical fit is excellent, but Lisbon classifies the track as from scratch. Obtain a written exception/eligibility ruling. |
| Can AlphaDawg safely target 1inch? | **No under current published classification.** It is a from-scratch Aqua/SwapVM app track, not a generic API-integration bounty. |
| Can the team implement 1inch before kickoff? | **No project-specific Aqua app code, design, or assets** if relying on the Classic track. Generic study of public starter kits is safe; disclose everything and confirm boundaries with organizers. |
| Should 1inch replace the current mock execution path? | Only after written eligibility confirmation. If approved, build a real Aqua position; a simple swap/aggregator call is insufficient. |
| Recommended plan | Lock 0G Continuity. Seek written Hedera and 1inch rulings. Build Hedera only if approved; treat 1inch as a hard optional gate after the commerce vertical works. |

## Official Track Classification

Official source: [ETHGlobal Lisbon prizes](https://ethglobal.com/events/lisbon2026/prizes).

| partner / track | pool and payouts | published category | AlphaDawg status |
|---|---:|---|---|
| 0G — Keep Building on 0G | $4,500; 3 × $1,500 | `continuity-track` | **Confirmed target.** |
| 0G — Infrastructure & Tooling | $4,500; 3 × $1,500 | `building-from-scratch` | Not confirmed for AlphaDawg. |
| 0G — Best AI Product | $6,000; $3,000 / $2,000 / $1,000 | `building-from-scratch` | Not confirmed for AlphaDawg. |
| Hedera — AI & Agentic Payments | $6,000; up to 2 × $3,000 | `building-from-scratch` | Conditional on written ruling. |
| Hedera — Tokenization | $3,000; up to 2 × $1,500 | `building-from-scratch` | Conditional stretch. |
| 1inch — Build an Aqua App | $5,000; $2,500 / $1,500 / $1,000 | `building-from-scratch` | Incompatible with current Continuity plan without written ruling. |

ETHGlobal allows selecting up to three partners, but selection does not override category eligibility. The official rules state that Continuity partner eligibility varies and that pre-existing projects outside an approved Continuity track are ineligible for partner prizes and the Finalist category. See [submission rules](https://ethglobal.com/events/lisbon2026/info/details) and [pre-existing-work rules](https://ethglobal.com/rules).

## Prize Economics

### Pool exposure is not possible winnings

| view | amount | meaning |
|---|---:|---|
| Total sponsor pools: Hedera + 0G + 1inch | **$35,000** | Aggregate sponsor budget; one team cannot win the whole amount. |
| Core aligned pools: 0G Continuity + Hedera Agentic + 1inch Aqua | **$15,500** | Competition pool exposure if cross-category eligibility is approved. |
| Maximal aligned pools: core + 0G Infrastructure + Hedera Tokenization | **$23,000** | Broad theoretical exposure; includes additional from-scratch tracks and likely category overlap. |

### Possible team payouts, excluding Finalist benefits

| scenario | payout | confidence |
|---|---:|---|
| Strict current AlphaDawg eligibility | **$1,500** | Confirmed: one 0G Continuity award. |
| Conditional minimalist, lowest listed placement across all three | **$5,500** | $1,500 0G + $3,000 Hedera + $1,000 1inch; requires written Hedera/1inch approval. |
| Conditional minimalist, maximum placement across one core track each | **$7,000** | $1,500 0G + $3,000 Hedera + $2,500 1inch; requires approvals. |
| Conditional maximalist, infrastructure posture | **$10,000** | 0G Continuity + Infrastructure, Hedera Agentic + Tokenization, 1inch first; assumes eligibility and multiple same-partner awards. |
| Conditional maximalist, product posture | **$11,500** | 0G Continuity + AI Product first, Hedera Agentic + Tokenization, 1inch first; highly theoretical and weaker fit for the commerce kit. |

No probability-adjusted expected value is defensible. Sponsor overlap, category eligibility and double-award policy are not published as guarantees.

### Counting Finalist benefits

Lisbon currently publishes a Finalist judging path but **no Lisbon Finalist cash amount or Finalist Pack**. Therefore the confirmed financial increment for becoming a Lisbon finalist is **$0 today**.

Recent 2026 precedent is not a Lisbon promise: Cannes and HackMoney Finalist Packs provided each finalist team member 1,000 USDC, up to $500 future-flight reimbursement, an $828 ETHGlobal Plus discount, and a hoodie. See [Cannes Finalist prize](https://ethglobal.com/events/cannes2026/prizes) and [Cannes Pack](https://ethglobal.com/packs/cannes2026-finalist).

For the expected two-person Lisbon team, if Lisbon later publishes the identical pack:

| modeled benefit | two-person value | treatment |
|---|---:|---|
| USDC | $2,000 | Cash-like, but currently unconfirmed. |
| Future-flight reimbursement | Up to $1,000 | Conditional reimbursement, not unrestricted cash. |
| Plus discount | $1,656 nominal | Only valuable if both members would buy Plus. |
| Hoodies | Unpriced | Non-cash. |

Modeled partner cash including a hypothetical repeated $2,000 team USDC Finalist reward:

- Strict confirmed-track scenario: **$3,500**.
- Conditional minimalist range: **$7,500–$9,000**.
- Conditional infrastructure-maximalist scenario: **$12,000**.
- Conditional product-maximalist scenario: **$13,500**.

These finalist-inclusive figures are scenario analysis only. Do not use them in budgets or expected-value claims until Lisbon publishes the prize.

## Current AlphaDawg Audit

Current baseline: [AlphaDawg repository](https://github.com/elbarroca/ETH_Global_Cannes_2026), SHA `bfa7bd37c573e2e49525d965f7f937210e170d72`.

### What already exists

- 0G sealed inference, Storage-backed memory DAG and agent identity work.
- Hedera HCS audit messages, HTS fund shares, scheduled heartbeat and Hedera EVM/Naryo correlation.
- Arc x402 fixed-price specialist payments.
- Ten specialist roles plus Alpha/Risk/Executor debate.
- Marketplace pages, Prisma agent metadata and ELO reputation.
- Arc custom/mock-compatible execution and approval workflow.

### What does not exist

| missing capability | current evidence | required delta |
|---|---|---|
| Runtime agent onboarding | `app/api/marketplace/create/route.ts` assigns `local://user-created`. | Register a public Agent Card URL, challenge endpoint ownership, verify signer/account/capabilities, activate provider. |
| Open discovery | `src/config/agent-registry.ts` contains compiled endpoints; role manifests contain fixed pools. | Query active providers by capability, proof type, price, reputation and SLA. |
| Real hiring | `/api/marketplace/hire` only writes `UserHiredAgent`. | Persist task, RFQ, quote, award, delivery, verification, settlement and receipt. |
| Variable commercial terms | Specialist price is hard-coded to `$0.001`. | Signed quotes using smallest currency units, nonce, expiry, SLA and proof terms. |
| Task-aware specialists | Leaf behavior is selected by `AGENT_NAME`; caller task is largely ignored. | Typed task inputs and output schema; provider-specific task execution. |
| Independent providers | Specialist wallets derive from one application-held mnemonic. | Separate operator signer and Hedera settlement account per provider. |
| Fail-closed proof | Payment/0G failures can degrade to local/HOLD paths; proof propagation is partially lost. | No verified 0G delivery means no settlement and no execution. Preserve proof fields end to end. |
| Authentic decision policy | A post-processing rule can force BUY over Executor HOLD. | Agent proposes intent; deterministic user risk policy alone authorizes execution. |
| Hedera commerce | Hedera currently records/audits but Arc pays specialists. | Final Hedera Testnet settlement after delivery verification, plus public receipt. |
| 1inch Aqua position | No Aqua, SwapVM strategy, `ship`, `dock`, `pull`, `push`, or Aqua tests exist. | New custom Aqua/SwapVM app with an onchain token-transfer demo. |
| Idempotency and recovery | No canonical commerce event log/state machine. | Optimistic state version, unique payment/execution keys, crash-safe resume. |

## Engineering Scope

### Gate 0 — Eligibility and IP

- [ ] Former contributor permission and OSI license.
- [ ] ETHGlobal approval for changed team composition.
- [ ] Written Hedera ruling allowing the AlphaDawg Continuity submission in Agentic Payments.
- [ ] Written 1inch/ETHGlobal ruling allowing AlphaDawg in Build an Aqua App.
- [ ] Exact pre-event SHA, event-window branch and dated `CHANGELOG-LISBON.md`.

If either sponsor says “from scratch only,” remove that sponsor from AlphaDawg. Do not hide or rewrite repository history.

### Minimalist engineering scope — recommended

Primary objective: win 0G Continuity with a credible production-hardening delta.

1. Add `CommerceTask`, `CommerceQuote` and `CommerceEvent` models.
2. Register and verify two external provider endpoints without editing the static registry.
3. Collect signed quotes and select deterministically.
4. Require a real 0G attestation/output hash for delivery acceptance.
5. Reject one tampered delivery and fall back to the next provider.
6. Persist a canonical receipt and resume safely after one injected failure.
7. Remove forced-BUY behavior from the Lisbon path.
8. Publish prior SHA, dated changelog, deployed/runnable demo, <3-minute 0G video and “What’s next.”

If Hedera approval arrives, add exactly one finalized HBAR/HTS payment after verified delivery. Do not add Tokenization.

### 1inch scope if written approval arrives

1inch Aqua is a shared-liquidity protocol: a maker keeps tokens in their wallet, ships virtual balances to an immutable app strategy, and trades use Aqua `pull`/`push`. Strategy parameters change by `dock` followed by `ship` of a new strategy. See [Aqua repository](https://github.com/1inch/aqua).

The smallest qualifying AlphaDawg integration is **Agent-Risk-Bounded Aqua Position**:

1. A provider returns a 0G-verified `PositionIntent` containing pair, liquidity bounds, concentration, decay, fee, deadline and maximum loss constraints.
2. Deterministic policy validates the intent and maps it to a SwapVM program; agents cannot supply arbitrary bytecode.
3. User/maker approves official Aqua and ships the immutable strategy with virtual balances.
4. A taker executes an actual swap through the official Aqua/SwapVM contracts.
5. Balance assertions prove token movement and respect minimum output/deadline constraints.
6. A changed verified risk state docks the old strategy and ships a new one.
7. Tests cover maker/taker paths, replay, deadline, slippage, unauthorized parameters, zero liquidity and reentrancy boundaries.

Expected artifacts:

```text
contracts/aqua/AlphaDawgAquaStrategy.sol
src/aqua/program-policy.ts
src/aqua/position-intent.ts
src/aqua/strategy-service.ts
test/aqua/AlphaDawgAquaStrategy.test.ts
scripts/demo-aqua-position.ts
```

Official starter: [SwapVM template](https://github.com/1inch/swap-vm-template). It already demonstrates a concentrated-liquidity `AquaAMM`, program construction, maker shipping, taker swap execution, deadline controls and token-balance tests. The Lisbon delta must still be a custom sophisticated position, not a renamed template.

> [!warning] 1inch cut rule
> If the custom Aqua contract and balance-changing tests do not pass by the 1inch integration gate, drop 1inch. A 1inch API quote, ordinary aggregation swap, or mock router does not satisfy the published Aqua track.

### Maximalist engineering scope — only after core passes

- 0G: reusable provider helper, validation adapter and receipt verifier.
- Hedera: signed negotiation, independent provider accounts, HCS receipt and HTS performance bond.
- 1inch: custom SwapVM position with `ship/dock`, live swap and risk-driven strategy replacement.
- Ethereum: optional ERC-8004 identity/reputation referencing task, 0G proof and Hedera payment.
- UI: provider onboarding, quote comparison, rejected delivery, verified settlement, Aqua position and unified receipt.

This scope is high risk for two people in 36 hours. It should be attempted only if eligibility is written, external keys/accounts work before kickoff, and the minimalist commerce loop passes by hour 18.

## Architecture And State Machine

```text
REGISTERED → VERIFIED_PROVIDER → DISCOVERED → QUOTED → AWARDED
    → DELIVERED → VERIFIED_0G → SETTLED_HEDERA → POSITION_SHIPPED_1INCH
    → SWAP_EXECUTED → SCORED

DELIVERED → REJECTED → QUOTED
```

Invariants:

- No 0G verification means no Hedera settlement.
- No finalized settlement means no Aqua position or swap.
- A provider cannot choose contract address, recipient, token allowlist or arbitrary SwapVM bytecode.
- Replaying a task ID cannot duplicate payment, `ship`, `dock` or swap.
- Every transition records input hash, actor, chain/proof identifier and idempotency key.

## 36-Hour Gate Plan

| time | minimalist gate | conditional/maximal work |
|---|---|---|
| Pre-event | Eligibility answers, contributor rights, accounts, generic SDK learning only. | No project-specific Classic-track implementation. |
| H0–H2 | Freeze baseline and smoke 0G. | Smoke Hedera/1inch only if approved. |
| H2–H8 | Commerce models, state machine, fake adapters, idempotency tests. | — |
| H8–H13 | Provider verification, two external providers and signed RFQ. | — |
| H13–H18 | 0G valid/tampered delivery paths. | 0G Continuity gate must pass. |
| H18–H22 | Receipt, recovery and minimal UI. | Add Hedera settlement if approved. |
| H22–H29 | Deployment, evidence and hardening. | One engineer may build/test Aqua if approved and core remains green. |
| H29–H33 | Full verification and fresh-clone run. | Integrate Aqua only if contract tests already pass. |
| H33–H36 | README, videos, submission and rehearsals. | No new features. |

## End-To-End Acceptance Contract

1. Register two providers without modifying `agent-registry.ts`.
2. Discover both by capability and receive two signed quotes.
3. Reject an invalid quote and a tampered delivery.
4. Prove rejected delivery caused zero payment and zero execution.
5. Verify the fallback delivery through 0G exactly once.
6. If approved for Hedera, settle one final Testnet payment and expose Hashscan proof.
7. If approved for 1inch, ship one official Aqua/SwapVM strategy and execute a balance-changing swap on a permitted network or local fork.
8. Restart and prove no duplicate payment, position or swap.
9. Export one receipt binding every identifier.
10. Run two consecutive judge demos under four minutes.

Repository verification expected after implementation:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run validate
npm run validate:commerce
npx hardhat test test/aqua/AlphaDawgAquaStrategy.test.ts
```

The current repository has no `npm test` script; adding a real commerce/Aqua test entry is part of the Lisbon delta.

## Questions To Send Organizers

> We are continuing AlphaDawg from ETHGlobal Cannes under 0G Keep Building. Lisbon marks Hedera AI & Agentic Payments and 1inch Build an Aqua App as building-from-scratch. If every Hedera payment flow and Aqua/SwapVM contract is newly implemented during the Lisbon window, may the same disclosed Continuity submission apply to those partner tracks, or are those tracks restricted to entirely new projects? Please confirm in writing for both sponsors.

## Decision Contract

- **BUILD:** 0G Continuity hardening plus real dynamic agent commerce.
- **BUILD ONLY IF APPROVED:** Hedera post-verification settlement.
- **DEFER / CONDITIONAL:** 1inch Aqua position.
- **DO NOT COUNT:** Lisbon Finalist cash until an official Lisbon prize/pack is published.
- **STOP:** Any plan that represents the $35,000 combined pools as possible single-team winnings.

## Sources

- [ETHGlobal Lisbon prizes](https://ethglobal.com/events/lisbon2026/prizes)
- [Lisbon submission and judging rules](https://ethglobal.com/events/lisbon2026/info/details)
- [ETHGlobal pre-existing-work rules](https://ethglobal.com/rules)
- [AlphaDawg Cannes showcase](https://ethglobal.com/showcase/alpha-dawg-fh6vm)
- [AlphaDawg repository](https://github.com/elbarroca/ETH_Global_Cannes_2026)
- [1inch Aqua](https://github.com/1inch/aqua)
- [1inch SwapVM template](https://github.com/1inch/swap-vm-template)
- [Cannes 2026 Finalist prize precedent](https://ethglobal.com/events/cannes2026/prizes)
- [Cannes 2026 Finalist Pack](https://ethglobal.com/packs/cannes2026-finalist)
