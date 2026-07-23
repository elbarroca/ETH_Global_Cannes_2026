---
title: Project B Scorecard and Shortlist
tags:
  - ethglobal/lisbon-2026
  - scorecard
  - project/from-scratch
status: selection_complete_research_only
updated: 2026-07-16
primary: ProofRail
backup: AquaSentinel
second_backup: SealSwitch
---

# Project B Scorecard And Shortlist

> [!success] Ideation gate complete
> ProofRail is primary, AquaSentinel is the reliability fallback, and SealSwitch is the Sui-native second fallback. Build only one after the H0–H3 sponsor-native probes. Prize cap was used only after product, agent, proof, qualification, and solo-build tests.

## Reproducible Idea-Selection Rubric

`base = pain + sponsor + agent + proof + demo + feasibility + novelty + adoption_wedge + overlap`

Maximums: `12 + 18 + 10 + 12 + 12 + 12 + 10 + 8 + 6 = 100`.

This is a dated research-selection score, not implementation readiness, validated demand, win probability, or expected winnings. Scorer: research team/root agent; evidence cutoff: 2026-07-16; official event/track pages and the linked master evidence control.

Use the same anchor within each category: `0%` absent or contradicted; `25%` generic assertion; `50%` plausible with a named path; `75%` specific, source-backed, and replayable; `100%` unusually clear/differentiated with no known category-specific weakness. Round only to whole points and attach a one-line reason in the diligence/adversarial sections.

`adoption_wedge` scores whether a narrow post-event user/action is identifiable. It does **not** mean interviews, willingness to pay, or market validation; those remain separate demand gates.

Penalty codes: `Q=-20` mandatory qualification path incomplete; `D=-15` decorative sponsor; `P=-15` unpublished track; `M=-10` self-reported/mock-shaped proof; `U=-10` uncontrolled live dependency. `R` is non-numeric rejection for substantial prior-project similarity.

Fatal override: `R`, invalid H0/provenance, track ineligibility, model-held economic authority, success-shaped mock, or missing sponsor-native state change makes the candidate non-selectable regardless of its numeric total. For `R` rows, the displayed number preserves the pre-rejection arithmetic only; it is not a selectable final score.

| rank | id | idea | pain/12 | sponsor/18 | agent/10 | proof/12 | demo/12 | feasible/12 | novelty/10 | adoption wedge/8 | overlap/6 | base | penalties | final | status |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---|
| 1 | B01 | ProofRail | 11 | 18 | 10 | 12 | 12 | 5 | 10 | 8 | 6 | 92 | 0 | **92** | SELECT_H0_LOCKED |
| 2 | B02 | AquaSentinel | 10 | 18 | 8 | 12 | 12 | 9 | 8 | 7 | 4 | 88 | 0 | **88** | FALLBACK_H0_LOCKED |
| 3 | B03 | SealSwitch | 10 | 17 | 9 | 12 | 11 | 8 | 9 | 7 | 4 | 87 | 0 | **87** | SECOND_FALLBACK_H0_LOCKED |
| 4 | B10 | AquaHedge | 9 | 18 | 8 | 12 | 11 | 8 | 7 | 7 | 4 | 84 | 0 | **84** | MERGE_B02 |
| 5 | B13 | InvoiceMint | 10 | 18 | 8 | 12 | 11 | 7 | 7 | 6 | 4 | 83 | 0 | **83** | SHORTLIST |
| 6 | B14 | SuiQuestMaster | 8 | 18 | 8 | 12 | 11 | 8 | 7 | 6 | 4 | 82 | 0 | 82 | HOLD |
| 7 | B15 | NameGuard | 8 | 18 | 8 | 11 | 11 | 8 | 7 | 7 | 4 | 82 | 0 | 82 | HOLD |
| 8 | B05 | RefundRaid | 9 | 16 | 8 | 11 | 11 | 6 | 9 | 7 | 5 | 82 | 0 | 82 | HOLD_TWO_CHAIN |
| 9 | B17 | PayrollSentinel | 10 | 18 | 8 | 12 | 12 | 4 | 7 | 7 | 6 | 84 | U:-10 | 74 | STOP_COMPLEX |
| 10 | B06 | QueryBounty | 10 | 16 | 9 | 11 | 11 | 8 | 9 | 7 | 6 | 87 | P:-15 | 72 | WAIT_GRAPH |
| 11 | B09 | RouteReferee | 11 | 18 | 9 | 12 | 12 | 9 | 6 | 8 | 5 | 90 | Q:-20 | 70 | WAIT_FORM |
| 12 | B19 | GraphRecall | 9 | 16 | 9 | 11 | 10 | 8 | 8 | 7 | 6 | 84 | P:-15 | 69 | WAIT_GRAPH |
| 13 | B07 | HumanThrottle | 9 | 15 | 8 | 11 | 11 | 8 | 8 | 7 | 6 | 83 | P:-15 | 68 | WAIT_WORLD |
| 14 | B18 | ProofPresence Concierge | 8 | 16 | 8 | 11 | 11 | 8 | 7 | 7 | 6 | 82 | P:-15 | 67 | WAIT_WORLD |
| 15 | B12 | HumanEscrow | 9 | 16 | 9 | 11 | 11 | 7 | 5 | 7 | 6 | 81 | P:-15; R | 66 | REJECT_SIMILAR |
| 16 | B11 | ReceiptLens | 8 | 14 | 8 | 10 | 10 | 8 | 8 | 7 | 6 | 79 | P:-15 | 64 | WAIT_GRAPH |
| 17 | B16 | LiquidityButler | 10 | 18 | 8 | 12 | 11 | 7 | 6 | 8 | 6 | 86 | Q:-20; P:-15 | 51 | STOP_DEPENDENCIES |
| 18 | B20 | StockPolicy | 10 | 17 | 8 | 11 | 11 | 5 | 7 | 6 | 6 | 81 | Q:-20; P:-15; U:-10 | 36 | STOP_LEGAL_DEPENDENCIES |
| 19 | B08 | RepoSentinel | 10 | 17 | 8 | 11 | 11 | 9 | 4 | 7 | 5 | 82 | R | 82 | REJECT_SIMILAR |
| 20 | B04 | ProofCart | 11 | 18 | 9 | 12 | 12 | 8 | 6 | 8 | 6 | 90 | R | 90 | REJECT_SIMILAR |

Rejected rows are forced below valid candidates even when their raw score is high.

## Adversarial Review

| id | skeptical judge attack | sponsor-removal / value-movement test | replay and solo verdict |
|---|---|---|---|
| B01 | “Five integrations and no product.” | Remove 0G and private reasoning/proof disappears; remove Hedera and claim/approval/audit disappears; remove Axelar/Uniswap and cross-chain conversion disappears. Tampered proof, stale quote, timeout, or replay must create no second effect. | The 0G+Hedera core is solo-feasible; the full three-partner path is conditional on hard H20/H25/H28 cuts. |
| B02 | “LLM glued to an AMM.” | Remove Aqua/SwapVM and no strategy/state/token movement exists. Typed compiler blocks arbitrary calldata. | Local fork resets deterministically; contract learning is the main risk. |
| B03 | “Storage upload with AI.” | Remove Sui/Seal/Walrus and no enforceable revoke/decrypt failure exists. Agent may only revoke/deny. | Synthetic packet replays; Testnet/key-server availability is risk. |
| B04 | “AlphaDawg/Clawback again.” | Sponsor use is causal, but product mechanism overlaps prior projects. | Reject before build. |
| B05 | “Toy game plus two chains.” | Sui match truth is core; Hedera is removable, proving scope should be Sui-only. | Replayable, but two-chain version not solo-safe. |
| B06 | “Unpublished Graph logo.” | Graph removal destroys evidence path, but its track/API is unknown. | Wait; Hedera-only variant is generic. |
| B07 | “World login plus ENS name.” | Both must change allocation/discovery, not decorate it. | Wait for World; ENS booth adds hard logistics. |
| B08 | “npmguard clone.” | Storage/ENS are causal, but mechanism/user is substantially repeated. | Reject. |
| B09 | “maki without hardware.” | API path is causal and policy blocks signing, but mandatory form is currently unavailable. | Deterministic testnet path possible; qualification blocked. |
| B10 | “B02 with a timer.” | Aqua lifecycle is core; Graph is removable/pending. | Merge the dock/re-ship scenario into B02; do not shortlist separately. |
| B11 | “A reputation dashboard.” | Receipt must route/block an agent; Graph track unknown. | Wait. |
| B12 | “DIVE/Clawback mashup.” | World/Hedera causal, but both track and novelty fail current gate. | Reject. |
| B13 | “Tokenized invoice legal cosplay.” | HTS lifecycle is core; model cannot assert legal enforceability. | Technically replayable; claims and multi-service scope need discipline. |
| B14 | “Toy AI game.” | Sui object/reward and Walrus replay are core; model opinion alone cannot reward. | Solo feasible, pain weaker. |
| B15 | “ENS as DNS.” | ENS write/resolve must perform live incident recovery. | Solo feasible; mandatory booth and record latency remain. |
| B16 | “Carry/ALMA again.” | Both Graph and Uniswap are causal but both qualification paths are blocked/pending. | Stop. |
| B17 | “Sponsor reference architecture, not product.” | Schedule/Axelar are core; adding Uniswap creates avoidable fourth system. | Cannot reliably reset twice in solo window. |
| B18 | “Proof-of-Human with Sui.” | World uniqueness must be more than login; track pending. | Wait. |
| B19 | “Research chatbot with storage.” | Must refuse stale evidence and independently verify 0G; Graph pending. | Wait. |
| B20 | “Unlicensed investment/compliance agent.” | Legal eligibility cannot be self-attested; API form and World track blocked. | Stop. |

Timeout, duplicate request, stale quote/bill, failed proof, partial payment, and transaction ambiguity are mandatory tests for the selected concept. No UI/database status may substitute for a public network result.

## Prior Score Top Five

1. **ProofRail — 92:** strongest sponsor overlap and proof density; its actual core is two released tracks, with remaining tracks conditional on product necessity.
2. **AquaSentinel — 88:** strongest backup; official starter and local fork remove most external-demo risk.
3. **SealSwitch — 87:** memorable failed-decryption demo and distinct security wedge; more Testnet/Seal setup risk.
4. **InvoiceMint — 83:** excellent Hedera depth; RWA/legal framing and lifecycle scope reduce safety.
5. **NameGuard — 82:** narrow ENS-native incident recovery mapped to Best ENS Integration for AI Agents; booth and write/resolve latency remain hard gates.

## Top-Three Official Diligence

### ProofRail

- Product problem: prevent an accounts-payable agent from paying a forged, duplicated, undelivered, stale, or ambiguous cross-chain invoice.
- Multi-agent basis: Evidence, Risk and Settlement agents must execute independently with distinct prompts, contexts, typed outputs and 0G proofs; Recovery is a separate reconciler. A single model call or role-play transcript fails selection.
- Quorum contract: `PAY` requires Evidence=`PAY`, Risk=`CLEAR`, Settlement=`EXECUTABLE`, every proof valid, deterministic policy green and human Schedule signatures. Any `VETO`, disagreement, missing proof or ambiguous route produces `REFUSE` or `REVIEW`, never payment authority.
- Released core path: 0G Best AI Product + Hedera Agentic Payments, Tokenization, and Cross-Chain Automation. Uniswap API is the provisional third partner. World remains a substitution gate while its $15,000 track details are unpublished.
- 0G Product versus Infrastructure is treated as one classification because the page says tooling belongs in Infrastructure “instead”; Keep Building is Continuity-only. Do not count both without sponsor confirmation.
- Hedera Cross-Chain requires Schedule -> Axelar -> destination execution with no project bot/cron. It conflicts architecturally with No Solidity, so No Solidity is an alternate fallback, never a simultaneous claim.
- Tokenization is conditional because its introduction says SDK-only/no contracts while its qualification allows SDK/system contracts/both. Use direct SDK HTS and obtain written treatment for a repository that also contains cross-chain contracts.
- Uniswap API requires key-based core execution, `FEEDBACK.md`, README code pointers, and the feedback form. The published form still returns 404; the third partner cannot be locked until fixed.
- Hedera's official `scaffold-hbar` `templates/cross-chain-dca` branch confirms the intended technical spine: Schedule Service precompile/self-reschedule -> Axelar GMP -> Sepolia -> Uniswap v3. Observed branch HEAD: `e172c41065c206cfe033979fb68c4ee98890e52e`. It is allowed only as a transparently attributed public starter after H0.
- The starter is not qualifying ProofRail by itself: it uses direct Uniswap v3 rather than the required Uniswap API, accumulates proceeds in a deployer-controlled contract, and lacks per-vendor claim/proof/recovery. ProofRail must implement those event-window deltas and disclose the starter baseline.
- Track payout ladder: 0G Product **$3,000 / $2,000 / $1,000**; Hedera Agentic **flat $3,000 × 2 winners**; Tokenization **flat $1,500 × 2**; Cross-Chain **flat $1,000 × 3**; Uniswap API **$4,000 / $2,000 / $1,000**.
- Prize math: core first-slot cap **$6,000**; maximum compatible first-slot cap **$12,500** (`$3,000 + $3,000 + $1,500 + $1,000 + $4,000`). Selected-pool exposure is $40,000 but is not a ceiling. Same-project Hedera stacking and Tokenization treatment remain unconfirmed; a conservative one-award-per-partner scenario is $10,000.
- World substitution: 0G + Hedera + World exposes $45,000 of sponsor pools, but World has no published tracks/payout split, so obtainable ceiling is `PENDING`, not $45,000.
- Hard gate: independently verified 0G decision, real HTS/HCS/Schedule state, visible Axelar message/destination action, real Uniswap route/status, and deterministic zero-effect failures. The 0G+Hedera core remains BUILD even if the third partner is cut.

### AquaSentinel

- Prize path: use official Aqua/SwapVM contracts; show a sophisticated position and onchain token transfer; local forks are allowed; proper commit history required.
- Official sources: `1inch/aqua` HEAD observed `7a5972a6b562e3e622f6e6b2a0befef659cd5386`; `1inch/swap-vm-template` HEAD `113a24f384773d356ed2deaead9528a61bb31c83`.
- Starter covers compile/tests/local or Sepolia deployment, `ship/dock`, virtual balances and swap execution. Its license and exact source commit must be disclosed at H0.
- Access: public repositories and a deterministic local fork are sufficient for the mandatory demo; RPC/test tokens are optional for Sepolia.
- Hard gate: real official-contract token transfer plus unsafe-program refusal. No API key, pending track, or mandatory form blocks the path.

### SealSwitch

- Prize path: newly developed app, meaningful Sui stack use, and working deployed Sui Testnet/Mainnet demo.
- Current packages: `@mysten/sui` **2.21.0**, `@mysten/walrus` **1.2.7**, `@mysten/seal` **1.3.2**.
- Walrus SDK selects network/package IDs; Testnet has free faucet tokens, public publisher/aggregator paths, and no persistence guarantee. Seal supplies threshold encryption/onchain access control.
- Access: Sui Testnet SUI + WAL, current package IDs inferred by SDK, Seal key servers/policy package, synthetic ciphertext only.
- Hard gate: authorized decrypt succeeds, Sui policy transaction revokes access, same blob fails decryption, and blob/object IDs remain inspectable. Testnet reset/availability is the largest dependency.

## Selection Contract

- **Selected — ProofRail, 92:** solve semantic invoice reconciliation and safe one-time payment. 0G Product + Hedera Agentic give a **$6,000 core first-slot cap**.
- **Conditional Hedera depth:** add Tokenization and Cross-Chain only while the claim token and cross-chain settlement remain necessary to that product, raising the two-partner compatible cap to **$8,500**.
- **Maximal third partner — CONDITIONAL:** select Uniswap only when vendor-denominated conversion is required and key/form/live route pass, raising the maximum compatible first-slot cap to **$12,500**. Substitute World only if published tracks create a stronger causal fit.
- **Fallback — AquaSentinel, 88:** 1inch only; first-place cap **$2,500** (second $1,500; third $1,000). It does not share ProofRail's 0G/Hedera/Axelar dependency chain.
- **Second fallback — SealSwitch, 87:** Sui new-app track; flat individual cap **$2,000**. Activate only when its Move + Seal + Walrus same-network round trip is green and both higher-ranked candidates fail.
- **Rejected challengers:** NameGuard remains a future concept; RefundRaid is cut for weaker objective evidence and two-chain scope.
- **Do not switch casually:** Select by H3 from isolated probes. Permit at most one clean-repository pivot by H10; after H10, narrow or stop.
- **STOP:** If none of the three candidates can prove its sponsor-native H0–H3 probe without mocks or pre-event work, return `STOP_IDEATION_NOT_VALIDATED`.

The full top-three problem, architecture, sprint, validation, UX, demand, and kill contracts live in [[PROJECT_B_LISBON_MASTER#Top-three engineering decision board]].
