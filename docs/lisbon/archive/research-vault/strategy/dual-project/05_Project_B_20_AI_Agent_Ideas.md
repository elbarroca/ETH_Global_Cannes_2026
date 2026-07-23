---
title: Project B — 20 AI Agent Ideas
tags:
  - ethglobal/lisbon-2026
  - ideation
  - project/from-scratch
status: ideation_gate_complete_research_only
updated: 2026-07-16
idea_count: 20
selection_state: ProofRail_selected_H0_locked
---

# Project B — 20 AI Agent Ideas

All entries are `PROPOSED`, not implemented. The problem-first review selects ProofRail for an H0-locked build; AquaSentinel remains the independent fallback. World and The Graph mappings are provisional until Lisbon tracks publish. Each idea uses no more than three partners.

## Ideation Phase Contract

An idea advances only if all six statements are concrete:

1. **Loss:** a specific user loses money, access, time, safety, or trust.
2. **Evidence:** the agent observes named, inspectable inputs—not a generic prompt.
3. **Agent decision:** the model must choose among explicit outcomes such as `PAY | REFUSE | REVIEW`, not merely summarize or call an API.
4. **Safety boundary:** deterministic code and humans control policy, signing, limits, replay and recovery.
5. **Native proof:** the demo produces a sponsor-native state change plus a visible failure/refusal artifact.
6. **Solo cut:** one person can replay the success and failure paths twice inside 36 hours.

First-place payout is a tie-breaker after product/agent/qualification fit. A track's cap is its highest published placement, never its full pool. See [[02_Lisbon_Live_Track_Ledger]].

## Problem-First Ideation Board

| id | costly failure | necessary agent decision | deterministic boundary | leading released track path | first-slot cap | ideation state |
|---|---|---|---|---|---:|---|
| B01 | Forged, duplicated, undelivered or ambiguous vendor invoice | Reconcile invoice/order/delivery/history into `PAY`, `REFUSE`, or `REVIEW` | Approval, budget, signing, replay and recovery | 0G Product + Hedera Agentic; conditional Hedera/Uniswap depth | $6,000 core; $12,500 stretch | `EXPLORE_A` |
| B02 | AI generates an unsafe liquidity program | Convert LP intent/risk into a bounded strategy AST or refuse | Allowlisted compiler, simulation and inventory caps | 1inch Aqua | $2,500 | `EXPLORE_A` |
| B03 | Sensitive incident access remains open during compromise | Classify request/incident risk and revoke, deny or review | Sui capability and Seal policy enforce access | Sui new app | $2,000 | `EXPLORE_A` |
| B04 | Buyer pays for a bad digital deliverable | Judge acceptance evidence | Fixed acceptance/payment policy | 0G Product + Hedera Agentic | $6,000 | `REJECT_SIMILAR` |
| B05 | Player loses an entry fee after invalid server outcome | Classify objective match state as settle/refund/review | Sui state/refund matrix and replay guard | Sui app; optional Hedera Agentic | $2,000 core; $5,000 stretch | `EXPLORE_B` |
| B06 | Research bounty pays an unsupported claim | Decompose and judge claim evidence | Reproducible query and fixed payment threshold | Hedera Agentic; Graph pending | $3,000 known | `WAIT_GRAPH` |
| B07 | Bots exhaust scarce API trials | Match intent to a bounded trial tier after uniqueness proof | Nullifier, quota and scope rules | ENS AI Agents; World pending | $1,500 known | `WAIT_WORLD` |
| B08 | Malicious package behavior reaches release | Infer behavioral risk and severity | CI rule and immutable report hash | ENS/Sui | $3,500 compatible | `REJECT_SIMILAR` |
| B09 | User signs unsafe generated swap calldata | Translate intent and choose execute/refuse | Recipient, asset, slippage, approval and signer policy | Uniswap API | $4,000 | `WAIT_FORM` |
| B10 | LP leaves stale strategy parameters active | Decide bounded dock/re-ship change | Aqua compiler and inventory limits | 1inch Aqua | $2,500 | `MERGE_B02` |
| B11 | Agent cannot distinguish settled, refunded or duplicate payment | Classify economic outcome from events | Event normalization and routing rule | ENS; Graph pending | $1,500 known | `WAIT_GRAPH` |
| B12 | Sybil jurors manipulate a small dispute | Summarize evidence for one-human-one-vote outcome | Nullifier, quorum and settlement rules | Hedera Agentic; World pending | $3,000 known | `REJECT_SIMILAR` |
| B13 | Duplicate or stale invoice claim circulates | Decide mint/freeze/redeem lifecycle | HTS/HCS/Schedule state machine | Hedera Tokenization + No Solidity | $2,500 compatible | `EXPLORE_B` |
| B14 | Fabricated story earns an AI-game reward | Judge bounded quest evidence | Move quest object and one-claim rule | Sui new app | $2,000 | `HOLD` |
| B15 | Clients call a compromised AI-agent endpoint | Decide rotate, disable or retain endpoint | ENS ownership, allowed records and signer policy | ENS AI Agents | $1,500 | `EXPLORE_A` |
| B16 | LP rebalances despite costs exceeding expected gain | Choose rebalance/refuse from indexed history | Net-carry threshold, simulation and signer cap | Uniswap API; Graph pending | $4,000 known | `WAIT_DEPENDENCIES` |
| B17 | Cross-chain payroll duplicates or lands incorrectly | Reconcile roster exceptions and payment outcome | Schedule approval and destination replay guard | Hedera Cross-Chain; optional Uniswap API | $1,000 core; $5,000 stretch | `STOP_COMPLEX` |
| B18 | Bots repeatedly claim scarce event resources | Match human intent to one bounded allocation | Uniqueness proof and Sui inventory object | Sui app; World pending | $2,000 known | `WAIT_WORLD` |
| B19 | Research agent repeats stale onchain conclusions | Decide answer, update or refuse after temporal reconciliation | Source-age rules and provenance hashes | 0G Product; Graph pending | $3,000 known | `WAIT_GRAPH` |
| B20 | User requests restricted/unsupported tokenized-stock action | Explain and choose execute/refuse | Eligibility policy and signer boundary | Uniswap API; World pending | $4,000 known | `STOP_LEGAL` |

## Final Ideation Comparison

| lane | candidate | why it survives ideation | primary weakness to attack next |
|---|---|---|---|
| Operational finance | B01 ProofRail | Strongest costly failure, agent necessity, refusal demo and released-track cap | Scope: prove a solo two-partner core before any stretch integration |
| DeFi safety | B02 AquaSentinel | Deterministic local demo and official-contract state change | Show why adaptive AI reasoning beats a static risk rule |
| Security/access | B03 SealSwitch | Memorable `access revoked -> decrypt fails` proof | Seal/Testnet setup and false-positive recovery |
| Agent identity/security | B15 NameGuard | Exact new ENS AI-Agent track and simple before/after demo | ENS must control live discovery, not become metadata decoration |
| Consumer failure recovery | B05 RefundRaid | Understandable user loss and visible refund/no-refund path | Objective evidence and two-chain scope |

### Ideation Decision

- **SELECT — ProofRail:** best combination of a costly failure, irreducible semantic agent decision, visible refusal/recovery, blockchain-enforced one-use settlement and compatible released-track ceiling.
- **FALLBACK — AquaSentinel:** activate only if real 0G or Hedera access fails by the H0 gate; it avoids ProofRail's network dependency chain.
- **HOLD — SealSwitch and NameGuard:** strong concepts, lower prize cap and weaker immediate economic wedge.
- **CUT — RefundRaid:** clear failure demo, but objective game evidence and two-chain scope are less defensible than ProofRail.

Selection authorizes planning only. Product implementation remains locked until official H0.

## B01 — ProofRail

1. **Thesis:** A mandatory Evidence/Risk/Settlement/Recovery agent team independently reconciles evidence, attacks the proposed decision, plans settlement, and resolves ambiguity; deterministic quorum, policy, and human approval alone authorize one-time payment.
2. **User/loss:** DAO and small-company treasury operators cannot reliably match an unstructured invoice to a purchase order, delivery evidence, vendor identity, budget, and current route; forged, duplicated, or stale obligations cause incorrect or repeated payments.
3. **Why agents:** One model judging its own payment proposal is a correlated-failure risk. The Evidence Agent reconciles obligation facts, the Risk Agent independently searches for fraud/conflicts/injection, and the Settlement Agent proposes a feasible bounded route. Their contexts, prompts, schemas, proofs, and failure modes are separated. A deterministic coordinator never treats majority vote as authority.
4. **Loop:** bind evidence -> Evidence Agent proposes `PAY | REFUSE | REVIEW` -> Risk Agent independently returns `CLEAR | VETO | REVIEW` -> if eligible, Settlement Agent returns `EXECUTABLE | BLOCKED` plus bounded route -> verify all 0G proofs -> deterministic quorum/policy -> one-use claim -> scheduled human approval -> dispatch/convert/pay -> Recovery Agent reconciles or escalates ambiguous outcomes.
5. **Human boundary:** Humans fix vendor, budget, asset, destination, slippage, deadline, approvers, and emergency stop. The agent cannot sign, widen policy, invent missing evidence, convert `REVIEW` into `PAY`, or create a replacement payment when outcome is ambiguous.
6. **Tracks:** Primary/core: 0G Best AI Product + Hedera AI & Agentic Payments. Conditional same-product depth: Hedera Tokenization if the one-use claim is necessary; Hedera Cross-Chain if payer/vendor chains differ. Third-partner gate: Uniswap API only if vendor-denominated conversion is necessary, or World after published tracks prove a stronger causal path. Maximum three partners.
7. **Indispensability:** 0G protects and proves semantic obligation reasoning; HTS makes the approved obligation a one-use claim rather than a database flag; HCS binds its audit; Schedule Service gathers the required human approvals; Axelar exists because the payer and vendor settle on different chains; Uniswap exists only when the vendor requires an asset the treasury does not hold. Remove any condition and remove its track.
8. **Implementation:** 0G Compute/Private Computer + Storage; Hedera `@hashgraph/sdk` HTS/HCS/Schedule plus Hedera EVM source adapter; Axelar GMP to an EVM destination; Uniswap Developer Platform approval/quote/swap/status with exact returned calldata. All live networks are Testnet unless a sponsor explicitly requires otherwise. The No Solidity track is an alternate fallback and is not claimed with the Solidity/Axelar path.
9. **Proof:** Per-agent input/output/prompt/proof hashes, disagreement/quorum record, 0G verification and Storage root, HCS agent-decision messages, HTS claim lifecycle, schedule/transaction IDs, Axelar message, Uniswap request/status, vendor balance delta, one canonical receipt.
10. **Four-minute demo:** Forged invoice: Evidence Agent proposes pay, Risk Agent finds a delivery/vendor conflict and deterministically vetoes all economic preparation. Then success: three verified agent outputs agree on a bounded intent -> HTS claim -> scheduled approval -> Axelar/Uniswap/vendor payment. Finish with duplicate/stale quote handled by the Recovery Agent without a second effect.
11. **MVP/non-goals:** One synthetic invoice, vendor, asset route, two approvers, HTS claim, one source/destination pair, one success and five failures; no production treasury, mainnet, cards, legal invoice enforceability, generalized marketplace, or arbitrary cross-chain routing.
12. **Architecture:** Strict TypeScript agent protocol; isolated Evidence, Risk, Settlement, and Recovery agents; deterministic coordinator/quorum; per-agent 0G verifier; append-only event/state store with idempotent outbox; Hedera native-service adapters; minimal source/destination contracts; Axelar/Uniswap reconciliation; canonical receipt verifier; thin judge UI.
13. **Access:** 0G funded Testnet/provider; Hedera Testnet accounts/HBAR/topic/HTS/Schedule; Axelar-supported testnets and gas service; destination RPC/tokens; Uniswap key and canonical feedback form. World credentials are not requested until tracks publish. No mainnet funds.
14. **Risks:** Four-system critical path, stale quote/calldata, cross-chain timeout, ambiguous partial execution, Hedera Tokenization wording, Uniswap form 404, same-partner multi-award uncertainty, sponsor uptime, solo capacity, secrets. Persist exact artifacts, reconcile rather than recreate, and use hard hour cuts.
15. **Comparables:** [Clawback](https://ethglobal.com/showcase/clawback-vpmw2), [Azimuth](https://ethglobal.com/showcase/azimuth-7w256), [DIVE](https://ethglobal.com/showcase/dive-5hxbp), [maki](https://ethglobal.com/showcase/maki-564eg), [Thurman Protocol](https://ethglobal.com/showcase/thurman-protocol-q8iiy).
16. **Differentiation:** Independent specialist agents cannot authorize payment directly; typed adversarial disagreement becomes a visible safety result, then a deterministic state machine connects verified quorum, claim lifecycle, human approval, settlement, and recovery.
17. **OSS artifact:** Proof-carrying multi-agent payment protocol: typed agent envelopes, deterministic quorum/veto rules, intent/receipt schemas, idempotent outbox, reconciliation engine, and adversarial test corpus.
18. **Adoption wedge:** DAO operations teams paying cross-chain vendors from policy-controlled treasuries.
19. **Kill:** Fewer than three independently executed/proven specialist agents; shared prompt/output masquerading as agents; model vote directly authorizes payment; 0G proof not verified by H14; Hedera core not real by H20; ambiguous execution can create a second effect. Cut downstream tracks rather than weaken the multi-agent core.
20. **Confidence/questions:** High product/track coherence, medium-low full-stack 36-hour feasibility. Confirm same-partner multi-awards, Tokenization contract wording, 0G Product-versus-Infrastructure exclusivity, Axelar Testnet route, Uniswap form, and World details at H0.

## B02 — AquaSentinel

1. **Thesis:** An AI risk agent proposes an Aqua/SwapVM liquidity program, but a deterministic compiler refuses any instruction outside the LP's inventory and drawdown policy.
2. **User/loss:** LPs lose funds to opaque strategy parameters, unsafe generated calldata, and inventory drift.
3. **Why agent:** It reasons across position intent, volatility narrative, inventory and constraints; deterministic code compiles only a bounded proposal.
4. **Loop:** observe balances/risk request -> reason -> propose program -> simulate/policy-check -> execute or refuse -> verify token movement.
5. **Human boundary:** LP fixes token pair, max inventory, fee/drawdown bounds; agent cannot deploy arbitrary opcodes or widen allowances.
6. **Tracks:** 1inch Build an Aqua App. One partner.
7. **Indispensability:** Official Aqua holds virtual balances; SwapVM/Aqua app executes the strategy; the sponsor primitive is the product state machine.
8. **Implementation:** Official `1inch/aqua` contracts or `1inch/swap-vm-template`; Hardhat/Foundry; local fork or Sepolia; `ship/dock/pull/push` and safe-balance checks.
9. **Proof:** Program hash, simulation trace, policy verdict, Aqua strategy hash, before/after balances, token-transfer transaction.
10. **Four-minute demo:** Ship bounded strategy; agent proposes safe rebalance; execute transfer; then prompt-inject an unsupported token/excess amount; compiler refuses and balances stay unchanged.
11. **MVP/non-goals:** One pair, one strategy, exact-in swap, local fork, one safe/one malicious proposal; no production LP, oracle, leverage, UI polish, or mainnet.
12. **Architecture:** Agent planner -> typed strategy AST -> allowlisted compiler -> fork simulator -> Aqua/SwapVM adapter -> receipt page.
13. **Access:** Official public starter, RPC/fork endpoint, test tokens; no sponsor key required; record upstream commit/license at H0.
14. **Risks:** Contract complexity, license treatment, agent unnecessary, fork determinism; keep agent at planning layer and prove compiler/refusal.
15. **Comparables:** [Carry](https://ethglobal.com/showcase/carry-b4wcm), [Ballast](https://ethglobal.com/showcase/ballast-7jpyp), [maki](https://ethglobal.com/showcase/maki-564eg).
16. **Differentiation:** Executable policy compiler for generated SwapVM instructions, not an LP dashboard or unconstrained trading bot.
17. **OSS artifact:** Typed Aqua strategy AST/compiler plus adversarial policy test corpus.
18. **Adoption wedge:** Advanced LPs testing generated strategies safely before deployment.
19. **Kill:** Official contracts cannot compile by H8; no real token transfer by H20; agent output bypasses compiler; demo needs uncontrolled liquidity.
20. **Confidence/questions:** High; verify starter license, event-time contract commit, accepted fork environment, and whether modified opcodes are needed.

## B03 — SealSwitch

1. **Thesis:** An incident-response agent classifies suspicious access requests and revokes a time-bounded Sui capability before encrypted Walrus evidence can be decrypted.
2. **User/loss:** Small teams leak sensitive incident evidence because access stays open during a confusing response window.
3. **Why agent:** It synthesizes natural-language requests, actor history, incident facts, and urgency; deterministic policy executes only pre-authorized revoke/deny actions.
4. **Loop:** observe request/evidence -> reason risk -> propose grant/revoke -> policy-check -> update Sui object -> test Seal decrypt -> store incident receipt on Walrus.
5. **Human boundary:** Human creates allowlist and emergency thresholds; agent may revoke/deny, never broaden access or reveal plaintext.
6. **Tracks:** Sui Best app built on Sui. One partner.
7. **Indispensability:** Sui object controls permission; Seal enforces threshold encryption/access; Walrus stores ciphertext and receipt.
8. **Implementation:** `@mysten/sui`, `@mysten/seal`, `@mysten/walrus`; Sui/Walrus Testnet; minimal Move access-policy package.
9. **Proof:** Sui object/transaction ID, Walrus blob ID/object ID, successful authorized decrypt, failed revoked decrypt, incident receipt.
10. **Four-minute demo:** Encrypt/store packet; authorized read succeeds; malicious prompt requests wider access; agent revokes/denies; same ciphertext fails decryption; explorer/blob receipt shown.
11. **MVP/non-goals:** One policy object, two actors, one blob, grant/revoke/deny; no production secrets, enterprise IAM, cross-chain identity, or permanent storage promise.
12. **Architecture:** Request classifier -> typed verdict -> deterministic access policy -> Move object -> Seal client -> Walrus client -> audit UI.
13. **Access:** Sui Testnet wallet/faucet, WAL, current package IDs via SDK, public publisher/SDK; no real confidential data.
14. **Risks:** Testnet resets, key handling, Seal setup, false positives, irreversible denial; only synthetic data and reversible policy object.
15. **Comparables:** [VEIL VPN](https://ethglobal.com/showcase/veil-vpn-c643n), [Azimuth](https://ethglobal.com/showcase/azimuth-7w256), [OpenCompliance](https://ethglobal.com/showcase/opencompliance-b89x9).
16. **Differentiation:** Agent-triggered least-privilege revocation with a visible failed-decryption moment, not storage, VPN, or compliance dashboard alone.
17. **OSS artifact:** Sui/Seal emergency-access policy package and deterministic revoke test harness.
18. **Adoption wedge:** Security teams sharing incident packets with temporary external responders.
19. **Kill:** Seal round trip not working by H14; access change cannot be shown on Testnet; denial depends on UI-only state.
20. **Confidence/questions:** Medium-high; confirm current Seal tutorial, key-server availability, Testnet package IDs, and deployed-demo expectations.

## B04 — ProofCart

1. **Thesis:** A procurement agent releases a Hedera payment only after a 0G-verified digital deliverable matches a typed acceptance policy.
2. **User/loss:** Small buyers pay for low-quality or missing digital work.
3. **Why agent:** It evaluates unstructured delivery against requirements; deterministic verification and settlement guard authority.
4. **Loop:** request -> receive delivery -> reason -> verify 0G -> accept/refuse -> Hedera pay -> receipt/recover.
5. **Human boundary:** Human fixes budget and acceptance schema; agent cannot change payee/amount.
6. **Tracks:** 0G Best AI Product; Hedera AI & Agentic Payments.
7. **Indispensability:** 0G proves evaluation; Hedera settles and audits.
8. **Implementation:** 0G Compute/Private Computer + Storage; Hedera direct SDK transfer/HCS/Mirror on Testnet.
9. **Proof:** Task-bound 0G proof, storage root, Hedera transaction, HCS receipt.
10. **Four-minute demo:** Bad delivery -> no payment; good delivery -> one payment; replay -> same receipt/no second payment.
11. **MVP/non-goals:** One deliverable schema/provider; no marketplace, arbitration, multi-agent negotiation, or mainnet.
12. **Architecture:** Job API, verifier, policy, settlement, receipt store.
13. **Access:** 0G account/balance, Hedera accounts/funds, LLM.
14. **Risks:** Subjective acceptance, proof binding, duplicate payment, sponsor uptime.
15. **Comparables:** [Clawback](https://ethglobal.com/showcase/clawback-vpmw2), [Alpha Dawg](https://ethglobal.com/showcase/alpha-dawg-fh6vm), [DIVE](https://ethglobal.com/showcase/dive-5hxbp).
16. **Differentiation:** Typed delivery proof before direct settlement, but mechanism remains too close to AlphaDawg/Clawback.
17. **OSS artifact:** Proof-gated settlement adapter.
18. **Adoption wedge:** Buyers of small research/design deliverables.
19. **Kill:** Similarity cannot be defensibly separated; no task-bound proof; replay can double-pay.
20. **Confidence/questions:** `REJECT_SIMILAR`; kept to document invalidation, not a build candidate.

## B05 — RefundRaid

1. **Thesis:** A game-session agent refunds a player's entry payment when a Sui match object proves the server failed or the result is invalid.
2. **User/loss:** Players lose entry fees to disconnects, invalid matches, and ambiguous results.
3. **Why agent:** It reconciles logs, player claims, and match state; deterministic rules constrain refund outcome.
4. **Loop:** observe match/logs -> reason -> inspect object -> refund/refuse -> store replay packet -> verify.
5. **Human boundary:** Fixed refund matrix; no agent-chosen fees or recipients.
6. **Tracks:** Sui Best app built on Sui; Hedera AI & Agentic Payments only if cross-chain payout is retained.
7. **Indispensability:** Sui object is match truth; Walrus stores replay; Hedera optionally performs real refund.
8. **Implementation:** Sui Move match object + Walrus; optional Hedera Testnet transfer.
9. **Proof:** Match object, blob, refund transaction or explicit no-refund verdict.
10. **Four-minute demo:** Valid match settles; duplicate callback no-ops; disconnect state refunds; forged log is refused.
11. **MVP/non-goals:** One deterministic game state; no full game, matchmaking, token economics, or mainnet.
12. **Architecture:** Match simulator, adjudication agent, rule engine, chain adapters, receipt UI.
13. **Access:** Sui/Walrus Testnet; optional Hedera accounts.
14. **Risks:** Two-chain scope, fake match evidence, gambling framing, result ambiguity.
15. **Comparables:** [Defi](https://ethglobal.com/showcase/defi-e9zii), [Clawback](https://ethglobal.com/showcase/clawback-vpmw2), [PaintGlobal](https://ethglobal.com/showcase/paintglobal-v4pwo).
16. **Differentiation:** Failure-first consumer game refund, not trading competition or generic escrow.
17. **OSS artifact:** Match-result/refund state machine.
18. **Adoption wedge:** Paid indie-game tournaments.
19. **Kill:** Requires two chains for core; no objective invalid-state proof; legal review changes product.
20. **Confidence/questions:** Medium; cut Hedera before compromising Sui proof.

## B06 — QueryBounty

1. **Thesis:** A research agent pays a contributor only when indexed onchain evidence supports a submitted claim.
2. **User/loss:** Analysts waste time on unverifiable community research and duplicate bounties.
3. **Why agent:** It decomposes natural-language claims into chain queries and reconciles conflicting evidence.
4. **Loop:** claim -> query plan -> index evidence -> judge policy -> pay/refuse -> receipt.
5. **Human boundary:** Human defines eligible chains, budget and evidence threshold.
6. **Tracks:** The Graph `PENDING`; Hedera AI & Agentic Payments.
7. **Indispensability:** The Graph would supply indexed evidence; Hedera pays accepted work.
8. **Implementation:** Track-specific Graph API unknown; Hedera direct SDK/HCS.
9. **Proof:** Query/subgraph result hash, verdict, Hedera transaction/HCS message.
10. **Four-minute demo:** True claim pays; duplicated/unsupported claim refuses; replay no-ops.
11. **MVP/non-goals:** One claim template/chain; no open marketplace or subjective news.
12. **Architecture:** Claim parser, query planner, evidence adapter, policy, settlement.
13. **Access:** Pending Graph track/API plus Hedera Testnet.
14. **Risks:** Unpublished qualification, data freshness, hallucinated queries, payment ambiguity.
15. **Comparables:** [AgentIndex](https://ethglobal.com/showcase/agentindex-psxxo), [Clawback](https://ethglobal.com/showcase/clawback-vpmw2).
16. **Differentiation:** Evidence-triggered research bounty rather than reputation dashboard.
17. **OSS artifact:** Claim-to-query/evidence receipt schema.
18. **Adoption wedge:** DAO due-diligence micro-bounties.
19. **Kill:** The Graph track does not support exact path; query plan cannot be independently reproduced.
20. **Confidence/questions:** Provisional; mandatory -15 pending-track penalty.

## B07 — HumanThrottle

1. **Thesis:** A service agent grants one scarce API trial per verified human and publishes its callable identity through ENS.
2. **User/loss:** API vendors lose trials to bot farms while genuine users face blanket friction.
3. **Why agent:** It matches intent to trial tier and support path across unstructured requests; personhood and quotas remain deterministic.
4. **Loop:** request -> prove human -> reason tier -> resolve service -> grant/refuse -> record use.
5. **Human boundary:** Vendor fixes quotas and scopes; agent cannot override nullifier/replay rules.
6. **Tracks:** World `PENDING`; Best ENS Integration for AI Agents.
7. **Indispensability:** World would enforce uniqueness; ENS would resolve live service/agent records.
8. **Implementation:** Current World path unknown; ENSIP-25/26 records and resolver.
9. **Proof:** Personhood/nullifier result, ENS resolution, grant/refusal record.
10. **Four-minute demo:** First verified request succeeds; same human/bot replay fails; ENS endpoint resolves live.
11. **MVP/non-goals:** One API and tier; no billing, KYC, broad CRM, or identity profile.
12. **Architecture:** Request agent, World verifier, quota DB, ENS resolver, audit page.
13. **Access:** World test environment pending; ENS testnet/name and Sunday booth.
14. **Risks:** Pending track, privacy, nullifier misuse, booth requirement.
15. **Comparables:** [Proof-of-Human](https://ethglobal.com/showcase/proof-of-human-1cg2d), [AgentIndex](https://ethglobal.com/showcase/agentindex-psxxo), [Scoutxyz](https://ethglobal.com/showcase/scoutxyz-rwueo).
16. **Differentiation:** Intent-aware trial allocation, not raffle or identity login.
17. **OSS artifact:** Proof-of-human trial limiter adapter.
18. **Adoption wedge:** AI API vendors attacked by trial abuse.
19. **Kill:** World track lacks compatible primitive; proof used only as login; booth impossible.
20. **Confidence/questions:** Provisional; mandatory -15 pending-track penalty.

## B08 — RepoSentinel

1. **Thesis:** A CI agent blocks a release when dependency behavior conflicts with a published ENS-resolvable audit stored on Walrus.
2. **User/loss:** Maintainers ship compromised dependencies after shallow reviews.
3. **Why agent:** It explains cross-file behavioral changes; deterministic release policy makes the block.
4. **Loop:** diff -> analyze -> store report -> resolve identity -> allow/block release -> verify.
5. **Human boundary:** Maintainer fixes severity policy; agent cannot publish or deploy on its own.
6. **Tracks:** ENS Most Creative Use; Sui Best app built on Sui.
7. **Indispensability:** ENS resolves signed audit; Walrus stores portable report.
8. **Implementation:** ENS records plus Walrus TypeScript SDK and Sui object.
9. **Proof:** Audit blob, ENS record, blocked release status.
10. **Four-minute demo:** Safe package passes; malicious lifecycle script produces report and blocks release; tampered report hash fails.
11. **MVP/non-goals:** One npm repo and rule; no universal scanner or production CI marketplace.
12. **Architecture:** Static analyzer, agent explainer, policy gate, Walrus/ENS publishers.
13. **Access:** ENS name/testnet and booth; Sui/Walrus Testnet.
14. **Risks:** False positives, two-chain scope, prior-art similarity.
15. **Comparables:** [npmguard](https://ethglobal.com/showcase/npmguard-aeihd), [SENTINEL](https://ethglobal.com/showcase/sentinel-91nv5).
16. **Differentiation:** Release-blocking control, but still substantially similar to npmguard's audit registry.
17. **OSS artifact:** Hash-bound CI audit gate.
18. **Adoption wedge:** Small open-source maintainers.
19. **Kill:** Cannot materially distinguish from npmguard.
20. **Confidence/questions:** `REJECT_SIMILAR` despite technical feasibility.

## B09 — RouteReferee

1. **Thesis:** An agent turns portfolio intent into a typed Uniswap request, while a policy referee rejects unsafe routes, approvals, recipients, or calldata.
2. **User/loss:** Users authorize generated DeFi transactions they do not understand.
3. **Why agent:** It translates ambiguous goals; deterministic validation controls signing.
4. **Loop:** intent -> reason -> quote -> simulate -> referee -> execute/refuse -> status.
5. **Human boundary:** Chain/tokens/caps/slippage/recipient fixed by user; agent cannot sign.
6. **Tracks:** Uniswap API Integration.
7. **Indispensability:** Official API supplies quote/routing/execution/status.
8. **Implementation:** Developer Platform API, approval/Permit2, quote/swap/status, exhaustive route union.
9. **Proof:** Request ID, simulation, policy verdict, tx/status or no-sign trace.
10. **Four-minute demo:** Valid testnet route executes; malicious recipient/slippage prompt signs nothing.
11. **MVP/non-goals:** One pair/testnet/classic route; no autonomous portfolio, mainnet, chained actions, or UniswapX.
12. **Architecture:** Intent parser, strict policy, API client, signer boundary, receipt verifier.
13. **Access:** API key, testnet wallet/tokens, canonical feedback form.
14. **Risks:** Published form 404, API/network support, prior-art similarity to maki.
15. **Comparables:** [maki](https://ethglobal.com/showcase/maki-564eg), [Better Wallet](https://ethglobal.com/showcase/better-wallet-yvjdh), [Veryclear](https://ethglobal.com/showcase/veryclear-vu8i7).
16. **Differentiation:** API-route policy test harness, but core safety story is familiar.
17. **OSS artifact:** Exhaustive Uniswap API route/refusal adapter.
18. **Adoption wedge:** Agent-wallet developers.
19. **Kill:** Feedback path remains unavailable; no supported live route; request can bypass policy.
20. **Confidence/questions:** Technically strong; -20 mandatory-path penalty while form is 404.

## B10 — AquaHedge

1. **Thesis:** An inventory agent docks and re-ships a bounded Aqua strategy when inventory risk breaches a declared threshold.
2. **User/loss:** Market makers leave stale immutable parameters active during regime changes.
3. **Why agent:** It interprets market context and operator goals; thresholds and executable parameters remain bounded.
4. **Loop:** observe inventory -> reason regime -> propose dock/re-ship -> simulate -> execute/refuse -> compare.
5. **Human boundary:** Fixed pair, inventory, fees and frequency; no arbitrary opcode or asset.
6. **Tracks:** 1inch Aqua; The Graph `PENDING` only if a matching data track publishes.
7. **Indispensability:** Aqua immutable strategy lifecycle makes dock/re-ship meaningful; Graph data is provisional.
8. **Implementation:** Official Aqua `safeBalances`, `dock`, `ship`; optional current Graph path unknown.
9. **Proof:** Old/new strategy hashes, balance traces, token movement/refusal.
10. **Four-minute demo:** Breach causes bounded re-parameterization; prompt asks unsupported token and is refused.
11. **MVP/non-goals:** One pair/local fork; no leverage, oracle, production market making.
12. **Architecture:** Inventory reader, regime agent, typed compiler, Aqua adapter.
13. **Access:** Official starter and fork RPC; no Graph dependency in core.
14. **Risks:** Similarity to AquaSentinel, agent necessity, contract learning curve.
15. **Comparables:** [Ballast](https://ethglobal.com/showcase/ballast-7jpyp), [Carry](https://ethglobal.com/showcase/carry-b4wcm).
16. **Differentiation:** Lifecycle re-parameterization rather than per-swap safety.
17. **OSS artifact:** Aqua dock/re-ship risk controller.
18. **Adoption wedge:** LPs operating multiple immutable strategies.
19. **Kill:** Cannot differentiate from B02; no real token movement.
20. **Confidence/questions:** Medium; B02 is clearer and safer.

## B11 — ReceiptLens

1. **Thesis:** An agent converts onchain payment outcomes into explainable merchant receipts resolved from ENS.
2. **User/loss:** Agents cannot distinguish fulfilled, refunded, duplicated, or ambiguous merchant payments.
3. **Why agent:** It reconciles heterogeneous events and explains ambiguous outcomes; deterministic rules set status.
4. **Loop:** observe events -> index -> reason -> classify -> publish receipt -> route/block.
5. **Human boundary:** Merchant identity and status rules fixed; agent cannot rewrite chain history.
6. **Tracks:** The Graph `PENDING`; ENS Most Creative Use.
7. **Indispensability:** Graph would index outcomes; ENS resolves merchant receipt endpoint/records.
8. **Implementation:** Graph path unknown; ENSIP-25/26 text/service records.
9. **Proof:** Reproducible indexed event set and ENS-resolved receipt hash.
10. **Four-minute demo:** Settled and refunded payments classify; duplicate/ambiguous event blocks routing.
11. **MVP/non-goals:** One chain/payment schema; no universal reputation marketplace.
12. **Architecture:** Index adapter, classifier, status rules, ENS publisher.
13. **Access:** Pending Graph track; ENS name/testnet/booth.
14. **Risks:** Pending track, dashboard-only outcome, indexing lag.
15. **Comparables:** [AgentIndex](https://ethglobal.com/showcase/agentindex-psxxo), [Clawback](https://ethglobal.com/showcase/clawback-vpmw2).
16. **Differentiation:** Outcome receipt that changes routing, not rank-only reputation.
17. **OSS artifact:** Payment-event normalization schema.
18. **Adoption wedge:** Agent marketplaces choosing reliable merchants.
19. **Kill:** No published Graph fit; status never changes an action; ENS cosmetic.
20. **Confidence/questions:** Provisional; -15 pending-track penalty.

## B12 — HumanEscrow

1. **Thesis:** A verified-human juror agent votes once on a failed service claim before Hedera releases or refunds payment.
2. **User/loss:** Small online disputes are Sybil-prone and too costly to adjudicate.
3. **Why agent:** Human-backed agents summarize evidence and vote; personhood and settlement are deterministic.
4. **Loop:** dispute -> prove human -> analyze -> vote -> threshold -> release/refund -> audit.
5. **Human boundary:** Humans own juror agents and sign vote; model cannot fabricate identity or payment.
6. **Tracks:** World `PENDING`; Hedera AI & Agentic Payments.
7. **Indispensability:** World would enforce one juror; Hedera settles/audits.
8. **Implementation:** World path unknown; Hedera transfer/HCS.
9. **Proof:** Nullifier/vote set, HCS result, transaction.
10. **Four-minute demo:** Valid panel refunds; duplicate juror rejected; missing quorum leaves funds untouched.
11. **MVP/non-goals:** Three synthetic jurors; no legal arbitration or production escrow.
12. **Architecture:** Evidence agent, World verifier, vote state, Hedera adapter.
13. **Access:** Pending World environment; Hedera Testnet.
14. **Risks:** Pending track, escrow legal framing, similarity to DIVE/Clawback.
15. **Comparables:** [DIVE](https://ethglobal.com/showcase/dive-5hxbp), [Clawback](https://ethglobal.com/showcase/clawback-vpmw2).
16. **Differentiation:** Human-backed service jury, but prior-art overlap is material.
17. **OSS artifact:** One-human-one-agent dispute panel.
18. **Adoption wedge:** Community service marketplaces.
19. **Kill:** No World track; no true one-human enforcement; similarity remains.
20. **Confidence/questions:** `REJECT_SIMILAR` and pending.

## B13 — InvoiceMint

1. **Thesis:** An accounts-receivable agent tokenizes one approved invoice on Hedera and refuses transfer or redemption when lifecycle evidence is stale or duplicated.
2. **User/loss:** Small suppliers lack transparent invoice state and buyers face duplicate/invalid claims.
3. **Why agent:** It extracts invoice terms and reconciles evidence; deterministic HTS rules govern token lifecycle.
4. **Loop:** ingest invoice -> reason/validate -> mint -> transfer -> observe payment -> redeem/burn or freeze -> verify.
5. **Human boundary:** Issuer approves invoice and token policy; agent cannot change face value/debtor.
6. **Tracks:** Hedera Tokenization; Hedera No Solidity Allowed.
7. **Indispensability:** HTS expresses invoice receipt; HCS logs evidence; Schedule handles maturity; Mirror proves lifecycle.
8. **Implementation:** SDK-only HTS mint/transfer/freeze/burn + HCS/Schedule on Testnet; no Solidity avoids contradiction.
9. **Proof:** Token ID, lifecycle transactions, HCS sequence, rejected duplicate.
10. **Four-minute demo:** Mint/transfer/redeem valid invoice; duplicate or stale proof freezes/refuses lifecycle.
11. **MVP/non-goals:** One synthetic invoice/token; no securities, lending, fiat settlement, KYC claim, or legal enforceability.
12. **Architecture:** Invoice extractor, validation rules, HTS lifecycle, HCS/Schedule, receipt UI.
13. **Access:** Hedera Testnet accounts/funds; synthetic data.
14. **Risks:** RWA/legal overclaim, Tokenization wording, key management, multiple service complexity.
15. **Comparables:** [Nyx](https://ethglobal.com/showcase/nyx-prk3o), [Preo](https://ethglobal.com/showcase/preo-rg0m9).
16. **Differentiation:** Evidence-gated invoice lifecycle, not private perp collateral or payroll.
17. **OSS artifact:** SDK-only HTS invoice lifecycle state machine.
18. **Adoption wedge:** Demo for invoice-management vendors, not finance product.
19. **Kill:** Cannot avoid legal/financial claims; lifecycle not fully visible; SDK-only path fails.
20. **Confidence/questions:** Medium-high technical fit; keep claims strictly demonstrative.

## B14 — SuiQuestMaster

1. **Thesis:** An AI game master issues a reward only when a Sui quest object and Walrus replay prove the player met bounded conditions.
2. **User/loss:** AI game rewards are easy to manipulate with fabricated narratives or repeated claims.
3. **Why agent:** It interprets free-form player actions; deterministic quest state and replay rules authorize reward.
4. **Loop:** observe action -> reason -> compare quest -> update object/reward or refuse -> store replay -> verify.
5. **Human boundary:** Designer fixes quest/reward/rate limits; agent cannot mint or widen rewards.
6. **Tracks:** Sui Best app built on Sui.
7. **Indispensability:** Sui object is authoritative quest state; Walrus stores replay evidence.
8. **Implementation:** Move quest object/reward capability; Walrus SDK; Sui Testnet.
9. **Proof:** Quest object transition, reward transaction, blob, replay rejection.
10. **Four-minute demo:** Valid action earns once; duplicated/prompt-injected action refuses; replay packet resolves.
11. **MVP/non-goals:** One text quest and reward object; no full game, marketplace, NFT economy, or mainnet.
12. **Architecture:** Narrative agent, strict quest evaluator, Move module, Walrus store, UI.
13. **Access:** Sui/Walrus Testnet wallet/faucet.
14. **Risks:** Game feels toy-like, agent judging subjective, Move learning curve.
15. **Comparables:** [PaintGlobal](https://ethglobal.com/showcase/paintglobal-v4pwo), [Defi](https://ethglobal.com/showcase/defi-e9zii).
16. **Differentiation:** Replay-backed refusal and object-capability reward, not voting or trading duel.
17. **OSS artifact:** AI quest-to-object adjudication framework.
18. **Adoption wedge:** Discord-native indie games.
19. **Kill:** Reward depends on model opinion alone; replay can claim twice; deployed demo unavailable.
20. **Confidence/questions:** Medium-high; simpler than SealSwitch but lower pain clarity.

## B15 — NameGuard

1. **Thesis:** An agent rotates or disables compromised service endpoints while ENS continues resolving the last policy-valid agent record.
2. **User/loss:** Agent clients call stale or compromised endpoints because identity and service metadata drift.
3. **Why agent:** It synthesizes health/security signals and proposes rotation; deterministic ownership/policy gates write records.
4. **Loop:** observe endpoint -> reason risk -> verify ownership -> rotate/disable or refuse -> resolve -> audit.
5. **Human boundary:** Owner signer and allowed record keys fixed; agent cannot transfer name ownership.
6. **Tracks:** Best ENS Integration for AI Agents; 0G Best Infrastructure only if verifiable checks become core.
7. **Indispensability:** ENSIP-25/26 records are live discovery state; 0G optional proof is not required in core.
8. **Implementation:** ENS resolver/text records, ownership signatures, current ENS CLI/client.
9. **Proof:** Before/after ENS resolution, ownership challenge, refused unauthorized rotation.
10. **Four-minute demo:** Healthy endpoint resolves; compromised signal rotates; forged request fails; clients resolve new endpoint.
11. **MVP/non-goals:** One name/two endpoints; no global registry, token, reputation score, or production DNS replacement.
12. **Architecture:** Health collector, risk agent, policy writer, ENS resolver, audit log.
13. **Access:** ENS testnet/name, owner key, Sunday booth.
14. **Risks:** ENS write latency/cost, false rotation, identity-only perception.
15. **Comparables:** [AgentIndex](https://ethglobal.com/showcase/agentindex-psxxo), [VEIL VPN](https://ethglobal.com/showcase/veil-vpn-c643n).
16. **Differentiation:** Active incident recovery through discovery state, not rank/profile.
17. **OSS artifact:** Policy-safe ENS agent endpoint rotator.
18. **Adoption wedge:** Self-hosted agent/API operators.
19. **Kill:** ENS remains cosmetic; no real write/resolve path; booth unavailable.
20. **Confidence/questions:** Medium-high; verify current testnet registrar/record-writing path.

## B16 — LiquidityButler

1. **Thesis:** An LP agent uses indexed position history to execute one bounded Uniswap rebalance only when expected net carry improves after costs.
2. **User/loss:** LPs rebalance on gross fees and ignore LVR/gas/slippage.
3. **Why agent:** It weighs multiple uncertain signals and explains trade-off; deterministic thresholds authorize action.
4. **Loop:** index -> model -> reason -> simulate -> rebalance/refuse -> verify.
5. **Human boundary:** Pair/range/caps fixed; agent cannot widen assets or spend.
6. **Tracks:** Uniswap API Integration; The Graph `PENDING`.
7. **Indispensability:** Graph would provide history; Uniswap API executes rebalance.
8. **Implementation:** Graph path unknown; Uniswap API position/quote/simulation/execution/status.
9. **Proof:** Indexed inputs, net-carry calculation, request ID, tx/status or refusal.
10. **Four-minute demo:** Profitable case rebalances; cost-heavy/stale case refuses.
11. **MVP/non-goals:** One position/testnet; no autonomous fund, mainnet, forecast guarantee.
12. **Architecture:** Indexer, risk model, agent, policy, Uniswap client.
13. **Access:** Graph track/API pending; Uniswap key/form/testnet.
14. **Risks:** Two hard qualification dependencies, live liquidity, prediction claims.
15. **Comparables:** [Carry](https://ethglobal.com/showcase/carry-b4wcm), [ALMA](https://ethglobal.com/showcase/alma-07pzd).
16. **Differentiation:** Net-carry gate before state change, but closest comparables are strong.
17. **OSS artifact:** Net-carry execution policy module.
18. **Adoption wedge:** Small LP managers.
19. **Kill:** Graph details incompatible; Uniswap form unresolved; no deterministic demo route.
20. **Confidence/questions:** -35 total mandatory dependency penalties.

## B17 — PayrollSentinel

1. **Thesis:** An agent prepares cross-chain payroll but Hedera Schedule and Axelar execute only after approval and destination-policy checks.
2. **User/loss:** Treasury teams rely on centralized cron and can duplicate or misroute payroll.
3. **Why agent:** It reconciles payroll exceptions and approvals; onchain automation controls execution.
4. **Loop:** observe roster -> reason exceptions -> schedule -> collect approvals -> GMP dispatch -> destination action -> reconcile.
5. **Human boundary:** Treasury fixes recipients/caps/chains; agent cannot add recipients or sign approvals.
6. **Tracks:** Hedera Cross-Chain Automation; Uniswap API only if destination swap retained.
7. **Indispensability:** Schedule triggers; Axelar carries message; optional Uniswap converts destination asset.
8. **Implementation:** Hedera Schedule/system contract -> Axelar GMP -> destination contract; no team bot/cron.
9. **Proof:** Schedule ID, Axelar message, destination tx, duplicate no-op.
10. **Four-minute demo:** Approved payroll executes; missing approval/malformed recipient remains pending; replay no-ops.
11. **MVP/non-goals:** Two recipients/testnets; no real payroll, tax, mainnet, fiat, or production treasury.
12. **Architecture:** Roster agent, approval policy, Hedera/Axelar contracts, destination receipt.
13. **Access:** Two testnets, funds, Axelar path, optional Uniswap key/form.
14. **Risks:** Four-system critical path, timing, bridge uptime, 36-hour infeasibility.
15. **Comparables:** [Azimuth](https://ethglobal.com/showcase/azimuth-7w256), [Preo](https://ethglobal.com/showcase/preo-rg0m9).
16. **Differentiation:** Fully onchain cross-chain trigger with refusal, but sponsor itself suggests payroll.
17. **OSS artifact:** Scheduled cross-chain payroll state/recovery monitor.
18. **Adoption wedge:** DAO contributor payroll.
19. **Kill:** No E2E by H18; any project-run cron; destination ambiguity; demo cannot reset.
20. **Confidence/questions:** Low-medium; -10 uncontrolled-dependency penalty and not solo recommended.

## B18 — ProofPresence Concierge

1. **Thesis:** A local-event agent grants one personalized Sui reward/action per verified human, then refuses bot or replay requests.
2. **User/loss:** Event rewards and concierge resources are captured by bots and repeated claims.
3. **Why agent:** It matches free-form attendee intent to bounded resources; uniqueness and rewards stay deterministic.
4. **Loop:** request -> prove human -> reason match -> grant/refuse -> update object -> verify.
5. **Human boundary:** Organizer defines inventory and caps; agent cannot mint beyond pool.
6. **Tracks:** World `PENDING`; Sui Best app built on Sui.
7. **Indispensability:** World would prove uniqueness; Sui object tracks claim/reward.
8. **Implementation:** World path unknown; Sui Move claim object/Testnet.
9. **Proof:** Nullifier result, object transition, replay refusal.
10. **Four-minute demo:** First human claim succeeds; second and bot claims fail; inventory decrements once.
11. **MVP/non-goals:** One event/resource; no ticketing, location surveillance, token speculation.
12. **Architecture:** Concierge agent, World verifier, inventory policy, Move module.
13. **Access:** World environment pending; Sui faucet/deploy.
14. **Risks:** Pending track, event-local narrowness, privacy.
15. **Comparables:** [PaintGlobal](https://ethglobal.com/showcase/paintglobal-v4pwo), [Proof-of-Human](https://ethglobal.com/showcase/proof-of-human-1cg2d), [Scoutxyz](https://ethglobal.com/showcase/scoutxyz-rwueo).
16. **Differentiation:** Intent-matched scarce resource, not voting/raffle/networking.
17. **OSS artifact:** Human-unique Sui allocation module.
18. **Adoption wedge:** Hackathons and community events.
19. **Kill:** World track absent; proof becomes login only; no real Sui object state.
20. **Confidence/questions:** Provisional; -15 pending-track penalty.

## B19 — GraphRecall

1. **Thesis:** A research agent stores verifiable memory on 0G and uses indexed onchain history to reject stale or contradicted conclusions.
2. **User/loss:** Analysts and agents repeat stale chain claims without provenance.
3. **Why agent:** It decomposes questions, reconciles temporal evidence, and decides when to refuse.
4. **Loop:** question -> retrieve memory/index -> reason -> verify -> answer/refuse -> store provenance.
5. **Human boundary:** Allowed chains/sources/age thresholds fixed; agent cannot invent missing evidence.
6. **Tracks:** The Graph `PENDING`; 0G Best AI Product.
7. **Indispensability:** Graph would supply indexed facts; 0G supplies verified inference and persistent memory.
8. **Implementation:** Graph path unknown; 0G Compute/Private Computer + Storage.
9. **Proof:** Query evidence hash, verified inference, Storage root, stale-answer refusal.
10. **Four-minute demo:** Current claim answers with sources; stale/contradictory memory is rejected and updated.
11. **MVP/non-goals:** One protocol/question family; no general web research or investment advice.
12. **Architecture:** Query planner, Graph adapter, 0G agent/memory, provenance UI.
13. **Access:** Pending Graph details; 0G account/balance/provider.
14. **Risks:** Pending track, answer-only demo, verification semantics, source freshness.
15. **Comparables:** [AgentIndex](https://ethglobal.com/showcase/agentindex-psxxo), [Shawarma](https://ethglobal.com/showcase/shawarma-orchestrate-rfyhe).
16. **Differentiation:** Temporal contradiction/refusal rather than ranking or DeFi action.
17. **OSS artifact:** Provenance-aware agent memory schema.
18. **Adoption wedge:** Protocol research teams.
19. **Kill:** Graph fit absent; no objective stale test; 0G proof not independently verified.
20. **Confidence/questions:** Provisional; -15 pending-track penalty.

## B20 — StockPolicy

1. **Thesis:** An eligibility-aware agent refuses tokenized-stock trades unless identity, jurisdiction, asset, and execution policy all pass.
2. **User/loss:** Users may request unavailable/restricted tokenized assets or sign unsuitable routes.
3. **Why agent:** It explains complex eligibility/context; deterministic checks control transaction.
4. **Loop:** intent -> prove/collect eligibility -> reason -> quote/simulate -> execute/refuse -> status.
5. **Human boundary:** User fixes jurisdiction/asset/caps; agent cannot attest legal eligibility or sign.
6. **Tracks:** Uniswap API Integration; World `PENDING`.
7. **Indispensability:** Uniswap API supplies tokenized-asset route; World would supply personhood only if track supports it.
8. **Implementation:** Uniswap API; exact World path unknown; no legal KYC claim.
9. **Proof:** Eligibility verdict, request ID, simulation, tx/status or no-sign trace.
10. **Four-minute demo:** Allowed test case executes if supported; restricted/unknown case refuses before signing.
11. **MVP/non-goals:** One synthetic eligibility policy and supported test asset; no advice, KYC, brokerage, mainnet, or legal claim.
12. **Architecture:** Intent agent, eligibility rules, API client, signer boundary.
13. **Access:** Uniswap key/form/supported asset; World details; jurisdiction-safe demo.
14. **Risks:** Legal/financial, availability, unpublished track, 404 form, uncontrolled asset support.
15. **Comparables:** [maki](https://ethglobal.com/showcase/maki-564eg), [OpenCompliance](https://ethglobal.com/showcase/opencompliance-b89x9).
16. **Differentiation:** Explicit refusal for tokenized-asset eligibility, but dependencies dominate.
17. **OSS artifact:** Eligibility-policy transaction guard.
18. **Adoption wedge:** Wallet developers, after legal review.
19. **Kill:** Any legal claim, unsupported demo asset, pending World, unresolved form.
20. **Confidence/questions:** Low; -45 total dependency/uncontrolled-demo penalties.

## Diversity QA

- Problem families: consumer subscriptions, DeFi/liquidity, security/access, commerce, gaming, data/research, identity/access, RWA, automation/payroll, developer tooling.
- Every visible partner appears at least twice; The Graph and World remain provisional.
- Non-trading ideas: 16 of 20.
- Bounded autonomous economic/onchain actions: B01, B02, B04, B05, B09, B10, B12, B13, B14, B16, B17, B18, B20.
- Failure/refusal/refund is a primary demo moment: B01, B02, B03, B04, B05, B07, B08, B09, B13, B14, B15, B17, B18, B19, B20.
- Partner count: every idea uses one or two partners; none exceeds three.
