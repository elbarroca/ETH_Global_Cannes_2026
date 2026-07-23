---
title: Lisbon 2026 Dual Project Command Center
aliases:
  - Lisbon Dual Project Plan
tags:
  - ethglobal/lisbon-2026
  - strategy/dual-project
  - research-only
status: research_only_not_promotable
updated: 2026-07-16
owner: Person A and Person B
gate: H0_LOCKED
confidence: mixed
---

# Lisbon 2026 Dual Project Command Center

> [!important] Canonical consolidations
> Use [[strategy/alphadawg/ALPHADAWG_LISBON_MASTER|AlphaDawg Lisbon 2026 Master Plan]] and [[strategy/dual-project/PROJECT_B_LISBON_MASTER|Project B Lisbon 2026 Master Plan]] as the self-contained project contracts.

> [!danger] H0 lock
> This vault contains `PLANNED` research only. Do not create Project B, edit AlphaDawg, initialize repositories, scaffold, install, commit, push, deploy, sign, broadcast, spend, message organizers, or submit until the official hacking clock is revalidated as open.

## Decisions

| project | decision | primary thesis | fallback | partner posture |
|---|---|---|---|---|
| A — AlphaDawg | **BUILD / NARROW** | Creator-owned marketplace: users publish declarative agents to one shared runtime; buyers resolve, hire, run, and pay them; strict 0G verification gates delivery and real creator commission. | 0G + ENS core with one creator/agent/buyer/job/payment/proof flow. | Commit to 0G Keep + ENS Continuity; add exactly one of Sui, Hedera, or Uniswap only after the protected core is green. |
| B — new Classic project | **SELECTED / H0 LOCKED** | **ProofRail**: a mandatory Evidence/Risk/Settlement/Recovery agent system reaches a proof-bound decision; deterministic quorum and human approval settle exactly once. | **AquaSentinel** if real 0G/Hedera access fails at H0. | Core engineering: typed agent protocol, isolated proofs, veto/quorum, event state, idempotent effects, recovery. Core tracks: 0G Product + Hedera Agentic. |

Final ideation scores: ProofRail **92/100**; AquaSentinel **88/100**. ProofRail's $6,000 0G+Hedera core has traceable qualification paths; $12,500 is the gated maximum compatible first-slot cap. [[06_Project_B_Scorecard_and_Shortlist]] controls the decision.

> [!important] Prize ceiling correction
> Each track is capped at its highest published placement—not its total pool. ProofRail's **core first-slot cap is $6,000** (0G Product $3,000 + Hedera Agentic $3,000). Its **maximum compatible first-slot cap is $12,500** after adding Hedera Tokenization $1,500, Hedera Cross-Chain $1,000, and Uniswap API $4,000. This is conditional, not expected value: same-project Hedera stacking remains unconfirmed and the Uniswap form is blocked. The selected pools total $40,000 but are not a project ceiling.

AlphaDawg's protected 0G + ENS Continuity ceiling is **$3,500**. Its maximum all-Continuity shape is **$5,500** with Sui; its strongest conditional commerce shape is **$6,500** with Hedera. Every floor is $0.

## Current Frontier

- Live access timestamp: `2026-07-16T14:06:58Z`.
- Latest supplied Lisbon snapshot: eight visible partners, **$86,000 total pools**, fifteen released tracks; The Graph and World remain `PENDING`.
- Submission deadline: `2026-07-26 09:00 WEST`; exact H0 remains a live kickoff check, not authorization from this document.
- AlphaDawg checkout is clean at `bfa7bd37c573e2e49525d965f7f937210e170d72`; branch `feat/lisbon-agent-commerce`; no worktree delta.
- Final read-only product checks: lint still fails with 23 errors/28 warnings; `npm test` is absent; current `npx tsc --noEmit` is blocked by stale ignored `.next/types` references to removed pre-event A2A/commerce routes. No cleanup was authorized or performed.
- The Uniswap feedback URL published in the qualification text returned HTTP 404 at recheck; API-track qualification stays blocked until corrected.
- AlphaDawg rights, license, changed-team approval, 0G/ENS Continuity treatment, and any third-partner admission remain blocked.

## Top Five Cross-Project Blockers

1. `BLOCKED_TEAM_IP`: AlphaDawg lacks recorded former-contributor consent and a complete agreed OSI license.
2. `BLOCKED_ELIGIBILITY`: changed-team/Continuity treatment and any regular-track third-partner admission are not in writing.
3. `BLOCKED_H0`: the official hacking clock is not authorized open; both execution goals remain locked.
4. `BLOCKED_ACCESS`: current funded test accounts, API keys, model access, and live sponsor smokes are not evidenced; values must never enter this vault.
5. `BLOCKED_ENS_PREFLIGHT`: an owner-controlled name/subname, write/resolve path, event-time record schema, and Sunday booth plan are not yet evidenced. Uniswap's 404 form remains a blocker only if Uniswap becomes the third partner.

## Source Of Truth

1. [[strategy/alphadawg/ALPHADAWG_LISBON_MASTER|AlphaDawg Lisbon 2026 Master Plan]]
2. [[strategy/dual-project/PROJECT_B_LISBON_MASTER|Project B Lisbon 2026 Master Plan]]
3. [[01_Provenance_and_Team_Separation]]
4. [[02_Lisbon_Live_Track_Ledger]]
5. [[03_Previous_Winner_Patterns]]
6. [[04_AlphaDawg_Continuity_Gap_and_Bounty_Map|04 — superseded firewall audit retained for repository evidence]]
7. [[05_Project_B_20_AI_Agent_Ideas]]
8. [[06_Project_B_Scorecard_and_Shortlist]]
9. [[07_Final_Two_Project_Portfolio]]
10. [[08_Two_Person_H0_Runbook]]
11. [[09_Project_B_Blockchain_Track_Implementation_Contract]]
12. [[prompts/lisbon-dual-project/01_GOAL_AlphaDawg_Continuity_H0|AlphaDawg H0 Goal]]
13. [[prompts/lisbon-dual-project/02_GOAL_Project_B_From_Scratch_H0|Project B H0 Goal]]

The [[strategy/alphadawg/00_Command_Center|AlphaDawg Command Center]] is aligned to the current master; the master controls on any conflict.

## Final Contract

- Person A: clear rights and eligibility; at H0 build only the shared creator-agent runtime, strict 0G gate, ENS identity/version, paid hire/commission, tamper path, and receipt before considering a third partner.
- Person B: at H0 create the clean ProofRail repository and follow [[09_Project_B_Blockchain_Track_Implementation_Contract]]. Create nothing before H0.
- No project may claim the other's code, account, transaction, proof, integration, demo, or submission artifact.
