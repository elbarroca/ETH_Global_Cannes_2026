---
title: AlphaDawg Lisbon Live Track and Eligibility Audit
aliases:
  - AlphaDawg Lisbon Prize Ledger
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - research/tracks
  - project/continuity
status: decision-ready
area: eligibility-audit
priority: P0
owner: team
gate: written-partner-approval
confidence: mixed
updated: 2026-07-16
eligibility_status: research_only_not_promotable
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
---

# AlphaDawg Lisbon Live Track And Eligibility Audit

Access timestamp: `2026-07-16T12:57:19+01:00` (Europe/Lisbon), refreshed from the later supplied snapshot on 2026-07-16. Eight partner pools totaling **$86,000** are visible. Fifteen tracks are released; The Graph and World remain details-pending.

> [!danger] Current eligibility decision
> **0G Keep Building, Uniswap Stack Contribution, Sui Existing App, and ENS Continuity** explicitly admit Continuity. Because a project may select only three partners, their maximum compatible individual-award ceiling is **$5,500** through 0G + Sui + ENS; AlphaDawg's selected two-partner core is 0G + ENS at **$3,500**. Every regular 0G, Hedera, Uniswap, ENS, or Sui target remains conditional until written partner approval. Prize-page visibility and the three-partner submission UI do not override track categories.

## Financial Vocabulary

- **Prize pool:** the sponsor's total allocation.
- **Team maximum:** the highest amount one team can receive under explicit rules.
- **Theoretical ceiling:** assumes every compatible award is allowed and won.
- **Credible ceiling:** excludes contradictory or low-proof targets.
- **Planning value:** qualitative risk-adjusted priority, never fabricated expected dollars.
- **Confirmed Continuity floor / maximum ceiling:** **$0 / $5,500**. Eligibility shape is confirmed; project/team rights and winning are not.

## Complete Live Prize Ledger

| partner / pool | exact track and per-team payout | official category | qualifying integration / network | mandatory submission and demo evidence | AlphaDawg status |
|---|---|---|---|---|---|
| The Graph / $15,000 | Details pending; no split released | Details pending | Unknown | Unknown | **Details pending; count $0.** |
| World / $15,000 | Details pending; no split released | Details pending | Unknown | Unknown | **Details pending; count $0.** |
| 1inch / $5,000 | Build an Aqua App: $2,500 / $1,500 / $1,000 | From Scratch | Official Aqua/SwapVM contracts; sophisticated position; onchain token transfer; local fork allowed | Tests or UI final demo; proper commit history | **Incompatible; explicitly excluded.** |
| Hedera / $15,000 | AI & Agentic Payments: 2 x $3,000 | From Scratch | Agent Kit, ACP, x402, A2A or direct SDK; at least one real payment, token transfer or financial operation on Hedera Testnet | Public repo; setup/architecture/payment-flow README; <=5-minute video | **Conditional; strongest Hedera fit.** |
| Hedera | Tokenization: 2 x $1,500 | From Scratch | HTS via SDK, system contracts or both; Hedera Testnet | Public repo; Hashscan verification if contracts apply; <=5-minute lifecycle demo | **Conditional; wording conflict blocked.** |
| Hedera | No Solidity Allowed: 3 x $1,000 | From Scratch | JS/TS or Python SDK; no Solidity; at least two native services | Public repo/README; <=5-minute video | **Incompatible without project-level ruling.** |
| Hedera | Cross-Chain Automation Hub: 3 x $1,000 | From Scratch | Schedule Service -> Axelar GMP -> real destination action; fully onchain; no bot, keeper or cron | Create/approve/manage workflow; source/README; <=5-minute end-to-end video | **Conditional; maximal-only and technically blocked.** |
| 0G / $15,000 | Best AI Product: $3,000 / $2,000 / $1,000 | From Scratch | Working product with 0G Compute / Private Computer inference proof | Addresses; public repo/README; live/runnable product; live link; <3-minute video; 0G feature explanation; team contacts; Agentic ID explorer link if used | **Conditional.** |
| 0G | Best Infrastructure & Tooling: 3 x $1,500 | From Scratch | Reusable 0G framework/tooling plus at least one working example | Standard 0G pack; example code/README link; architecture diagram strongly recommended | **Conditional; best regular-track fit.** |
| 0G | Keep Building on 0G: 3 x $1,500 | Continuity | Meaningful event-window progress using the 0G stack | Standard 0G pack; prior submission or dated commit; dated Lisbon changelog; short “what's next” | **Confirmed in principle; rights/team gates remain.** |
| Uniswap Foundation / $10,000 | Best Uniswap API Integration: $4,000 / $2,000 / $1,000 | From Scratch | Valid Developer Platform API key used for core functionality | Public open-source repo; `FEEDBACK.md`; feedback form linking it; README pointers to exact code/contracts | **Conditional.** |
| Uniswap Foundation | Best Uniswap Stack Contribution: 3 x $1,000 | Continuity | Substantive Uniswap ecosystem extension using any part of the stack | Public open-source repo; `FEEDBACK.md`; feedback form; README exact-code pointers | **Confirmed in principle.** |
| Sui / $6,000 | Best app built on Sui: 2 x $2,000 | From Scratch | Newly developed, meaningful Sui stack use; Sui Testnet/Mainnet | Working deployed demo | **Incompatible; explicitly excluded.** |
| Sui | Existing app integrating/porting Sui: $2,000 | Continuity | Core Walrus, Seal, DeepBook, zkLogin or Move integration | Working before/after integration demo | **Confirmed in principle; conditional third only when ownership/licensing is load-bearing.** |
| ENS / $5,000 | Most Creative Use: flat $1,500 | From Scratch | Functional, non-hardcoded ENS value | Video or live demo; mandatory ENS booth presentation Sunday morning | **Conditional regular-track alternate.** |
| ENS | Best ENS Integration for AI Agents: flat $1,500 | From Scratch | Functional ENS identity, discovery, trust, or coordination for agents | Video or live demo; mandatory ENS booth presentation Sunday morning | **Conditional regular-track alternate.** |
| ENS | Best ENS Continuity Integration: flat $2,000 | Continuity | Material new ENS integration in an existing product | Video or live demo; mandatory ENS booth presentation Sunday morning | **Confirmed in principle; selected second track.** |

All amounts above are per-team obtainable payouts. Mutually exclusive placements are not summed.

## Published Rules That Control

| rule | current official position | AlphaDawg consequence |
|---|---|---|
| Team size | 1-5; solo allowed; every member applies and stakes individually. | Proposed two-person Lisbon team is within size, but changed membership is not automatically approved. |
| Partner selection | Up to three partners. One selected partner may expose all its tracks. | Selected core is 0G + ENS; Sui, Hedera, or Uniswap may use the final slot. Track visibility is not proof of eligibility or multi-awardability. |
| Classic / From Scratch | Project-specific code, design and assets start after kickoff; transparent public libraries/starter kits are allowed. | Existing AlphaDawg cannot enter a regular track safely without a written exception/ruling. |
| Continuity | Existing code is allowed only under an approved Continuity track; new work must be substantive and open source. | Disclose the Cannes state and isolate the Lisbon delta. |
| Disclosure | Written ETHGlobal disclosure plus repo history, video and description. Misrepresentation can revoke prizes and future eligibility. | Baseline SHA, prior showcase and authorship cannot be hidden. |
| Version control | Large single commits or missing history are presumed unqualified unless proven otherwise. | Preserve granular history and create Lisbon work only after kickoff. |
| AI tools | Allowed with file/asset attribution and meaningful human contribution; spec-driven work includes prompts/plans/specs. | Ship the prompt/spec history used to direct AI-assisted work. |
| Generic demo | Optional; uploaded videos must be 2-4 minutes. | Sponsor-specific mandatory limits override: 0G <3 minutes, Hedera <=5 minutes. |
| Judging | Four-minute finalist demo + three-minute Q&A. | The judge loop must fit four minutes even when sponsor videos differ. |

The Lisbon submission guide says booth visits are optional for partner judging, while another current event instruction references partner presentations at booths. ENS independently makes its booth presentation mandatory. Preserve the conflict and ask ETHGlobal which general instruction controls.

## Hedera Tokenization Conflict

The live track contains two incompatible instructions:

- Introduction: use only the Hedera SDK; no Solidity or smart contracts.
- Qualification block: use HTS through SDK, system contracts or both; verify smart contracts on Hashscan if applicable; `@hiero-ledger/hiero-contracts` earns optional credit.

Per this goal, the qualification block has planning priority, but eligibility remains blocked until Hedera confirms the correction in writing.

> [!question] Sponsor question
> For “Tokenization on Hedera,” do the qualification requirements permitting HTS system contracts and verified smart contracts override the duplicated “only SDK / no Solidity” introduction, and may a disclosed AlphaDawg Continuity submission enter?

## New York Continuity Precedent

Official results confirm:

- **Immunity** explicitly describes itself as Continuity, won Chainlink Best Upgrade plus an ENS pool award, and was an ETHGlobal finalist.
- **Thurman Protocol** won Arc Continuity first plus Chainlink Best Upgrade.
- **Azimuth** won ENS Continuity third, Sui existing-product and Hedera automation.
- **bitrouter** won Arc Continuity second plus Sui existing-product.
- **Chatter** disclosed Extend Open Source/Continuity and won Uniswap Stack Contribution plus an ENS pool award.
- **Pampalo Private Swap** won Uniswap Stack Contribution, a Continuity-only track.

This proves a disclosed Continuity project can final, can win across multiple partners, and can combine a Continuity-only prize with another partner award when the partners accept it. It does **not** prove Lisbon admission, regular-track admission, same-partner multi-awards, changed-team approval or any competition probability. No official consolidated “23 Continuity winners” roster was found; do not repeat that count.

## Cannes Baseline And Rights Audit

Repository: [ETH_Global_Cannes_2026](https://github.com/elbarroca/ETH_Global_Cannes_2026), baseline `bfa7bd37c573e2e49525d965f7f937210e170d72`.

- The baseline commit exists, is current `main` HEAD and has granular history.
- Two human Git authors contributed: Barroca (134 commits) and Ehtesham (14 commits). The former teammate's work is material across UI, marketplace, payments, agents and routes.
- README says `MIT`, and some Solidity files have MIT SPDX headers, but the repository contains no root `LICENSE`, `COPYING`, `NOTICE`, `AUTHORS`, CLA/DCO or contributor-consent evidence.
- Repository ownership and commit majority show control/history, not sole copyright ownership or authority to remove a teammate.

### Changed-team gate

1. Obtain written ETHGlobal approval for AlphaDawg Continuity with changed membership.
2. Obtain written former-contributor consent covering continued use/submission, attribution and prize/credit treatment.
3. Add a complete OSI license artifact only after both human contributors authorize it, or retain equivalent written licensing evidence.
4. Name both Cannes authors and distinguish the former Cannes contributor from the Lisbon team.
5. Freeze the exact baseline, branch after kickoff and preserve full history.
6. Publish a Lisbon-only changelog by commit, file and author plus a before/after demo.
7. Confirm each selected Lisbon partner independently accepts the baseline/team arrangement.

No organizer approval, former-contributor consent or sole-ownership claim is currently evidenced.

## Prize Ceiling

| ceiling | amount | treatment |
|---|---:|---|
| Confirmed Continuity floor | $0 | No prize is guaranteed. |
| Selected core Continuity ceiling | **$3,500** | 0G Keep Building $1,500 + ENS Continuity $2,000. |
| Maximum compatible Continuity ceiling | **$5,500** | 0G Keep $1,500 + ENS Continuity $2,000 + Sui Existing App $2,000; uses all three partners. |
| Trading Continuity ceiling | **$4,500** | 0G Keep $1,500 + ENS Continuity $2,000 + Uniswap Stack $1,000. |
| Conditional commerce ceiling | **$6,500** | Selected core + Hedera Agentic $3,000; Hedera admission requires written approval. |
| Maximum conditional one-award-per-partner ceiling | **$10,000** | 0G AI Product $3,000 + Hedera Agentic $3,000 + Uniswap API $4,000; assumes all approvals and a Product posture that is not the recommended Infrastructure-shaped build. |
| Conditional Uniswap-API ceiling | **$7,500** | Selected core + Uniswap API $4,000; `NOT_PROMOTABLE` without regular-track admission and a working mandatory feedback path. |
| Maximum conditional one-award-per-partner upper bound | **$10,000** | 0G Product $3,000 + Hedera Agentic $3,000 + Uniswap API $4,000; not the selected architecture and not a recommendation. |

The selected core's individual-award ceiling is **$3,500**. The maximum all-Continuity shape is **$5,500** with Sui, while the recommended conditional commerce shape is **$6,500** only after Hedera approval. The $10,000 Product-posture figure remains conditional upside, not the recommended planning value.

## External Questions Still Blocking

1. May AlphaDawg enter each named regular 0G, Hedera and Uniswap track alongside Continuity?
2. Can one project receive multiple awards from the same partner?
3. Must 0G classify the same submission as Product or Infrastructure, and can Keep Building stack with either?
4. Which Hedera Tokenization wording controls?
5. Is Hedera No Solidity judged at whole-project/repository level or can an isolated new module qualify?
6. Are approved Lisbon Continuity projects eligible for the ETHGlobal Finalist category?
7. Which generic booth-judging instruction controls?
8. When will The Graph and World publish tracks, payouts, categories and evidence requirements?
9. Does ETHGlobal approve the changed AlphaDawg team after former-contributor rights are documented?
10. What is the canonical Uniswap feedback-form URL replacing the currently published 404 link?

## Primary Sources

- [Lisbon prizes](https://ethglobal.com/events/lisbon2026/prizes), [rules](https://ethglobal.com/rules) and [submission guide](https://ethglobal.com/events/lisbon2026/info/details)
- [1inch](https://ethglobal.com/events/lisbon2026/prizes/1inch), [Hedera](https://ethglobal.com/events/lisbon2026/prizes/hedera), [0G](https://ethglobal.com/events/lisbon2026/prizes/0g), [Uniswap](https://ethglobal.com/events/lisbon2026/prizes/uniswap-foundation), [Sui](https://ethglobal.com/events/lisbon2026/prizes/sui) and [ENS](https://ethglobal.com/events/lisbon2026/prizes/ens)
- [The Graph pending page](https://ethglobal.com/events/lisbon2026/prizes/the-graph) and [World pending page](https://ethglobal.com/events/lisbon2026/prizes/world)
- [New York event](https://ethglobal.com/events/newyork2026), [New York prizes](https://ethglobal.com/events/newyork2026/prizes), [Immunity](https://ethglobal.com/showcase/immunity-eg56a), [Thurman Protocol](https://ethglobal.com/showcase/thurman-protocol-q8iiy), [Azimuth](https://ethglobal.com/showcase/azimuth-7w256), [bitrouter](https://ethglobal.com/showcase/bitrouter-mu1z5), [Chatter](https://ethglobal.com/showcase/chatter-hczx1) and [Pampalo Private Swap](https://ethglobal.com/showcase/pampalo-private-swap-2g5bs)

Technology decision: [[14_Current_Web3_Agent_Commerce_Radar]]. Portfolio decision: [[15_Winner_Patterns_and_Prize_Portfolios]].
