---
title: GOAL AlphaDawg Lisbon Prize and Technology Research
aliases:
  - AlphaDawg Lisbon Research Goal
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - prompt/goal
  - research
status: ready
updated: 2026-07-16
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
---

# GOAL — AlphaDawg Lisbon Prize and Technology Research

## Copy/Paste Prompt

````text
/goal

Objective

Produce a fail-closed, current, prize-maximization research package for AlphaDawg at ETHGlobal Lisbon 2026. Revalidate all live tracks and Continuity rules, study comparable winners, research current agent-commerce and sponsor technology, and recommend the smallest coherent 0G + Hedera + Uniswap portfolio with the highest credible financial upside.

This is a research and decision goal. Do not implement product code.

Inputs

- Repo: https://github.com/elbarroca/ETH_Global_Cannes_2026
- Baseline SHA: bfa7bd37c573e2e49525d965f7f937210e170d72
- Prizes: https://ethglobal.com/events/lisbon2026/prizes
- Rules: https://ethglobal.com/rules
- Vault: /Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault
- Existing strategy: strategy/alphadawg/00_Command_Center.md through strategy/alphadawg/08_Maximal_Track_Portfolio_Feasibility.md

Scope contract

- Research every current Lisbon partner and track so no opportunity is missed.
- The current build portfolio is limited to 0G, Hedera, and Uniswap Foundation.
- 1inch and Sui are explicitly excluded. Other partners are research-only unless evidence supports replacing a current partner and the user approves.
- The working Continuity premise is that AlphaDawg can also enter compatible regular partner tracks. Treat it as conditional until each partner's live rules or written answer supports it.
- Preserve Arc x402 as legacy functionality, not a prize target.

Research method

1. Use official ETHGlobal pages and sponsor documentation/repositories first.
2. Use current pages, not search snippets, for prize wording whenever accessible.
3. Record URL, title, publisher, access timestamp, track/category, source quality, and the exact claim supported.
4. Cross-check unstable claims against a second primary source where possible.
5. Separate official rule, official precedent, third-party analysis, inference, and unknown.
6. Never turn missing data into a positive eligibility claim.
7. Parallelize independent partner/winner/protocol research when subagents are available; reconcile all outputs centrally.

Workstream A — Complete prize ledger

For every Lisbon partner, capture:

- total pool
- exact track names
- payout per placement and number of winners
- From Scratch versus Continuity label
- required SDK/API/protocol
- chain/testnet/mainnet requirement
- open-source/license requirement
- mandatory README, FEEDBACK.md, form, video, live demo, addresses, or transaction IDs
- judging language and optional enhancements
- overlap/conflict with pre-existing AlphaDawg
- status: confirmed eligible / conditional / incompatible / details pending

Revalidate at minimum:

- 0G: Best AI Product; Best Infrastructure & Tooling; Keep Building
- Hedera: AI & Agentic Payments; Tokenization; No Solidity Allowed; Cross-Chain Automation Hub
- Uniswap Foundation: Best API Integration; Best Stack Contribution

Investigate the internal wording conflict in the currently captured Hedera Tokenization text. Qualification requirements and sponsor clarification take priority over an apparently duplicated introduction.

Workstream B — Continuity and team eligibility

1. Read the current ETHGlobal pre-existing-work rules in full.
2. Confirm the event's current team-size, partner-count, repo-history, disclosure, and Continuity requirements.
3. Research official New York Continuity results, including finalists and partner-prize winners.
4. Determine what the precedent proves and what it does not prove.
5. Audit Cannes repo contributors, license, ownership, and baseline disclosure needs.
6. Produce a gate for replacing one Cannes teammate with a different Lisbon teammate: organizer approval, former-contributor consent, license, authorship disclosure, baseline SHA, and Lisbon-only changelog.

Workstream C — Winner and competition analysis

Study official Cannes and New York showcase pages and relevant public repos/videos. For comparable AI-agent, payments, infrastructure, Hedera, 0G, and Uniswap winners, extract:

- problem and demo loop
- sponsor integration depth
- onchain/testnet proof
- novelty versus execution quality
- architecture and reusable artifact
- number of sponsor tracks won
- presentation pattern
- visible weaknesses AlphaDawg can outperform

Do not claim a competition probability from a small or biased sample. Use qualitative density bands and cite the basis.

Workstream D — Current technology radar

Research the current stable/recommended versions and official implementation guidance for:

- A2A Agent Cards, tasks, artifacts, authentication, streaming, and multi-agent routing
- x402, including v2 migration, CAIP-2, facilitator model, server/client packages, and replay protection
- ERC-8004 status and identity/reputation/validation interoperability
- ERC-8183 or current agentic-commerce job protocols
- Hedera Agent Kit, HCS-14, UCP, HTS, HCS, Scheduled Transactions, Mirror Node, and Axelar GMP
- 0G Private Computer/Compute, sealed inference, Storage, Chain, and Agentic ID
- Uniswap API approval/quote/swap/order/status flows, route variants, UniswapX, chained routing, Permit2, tokenized-stock support, and uniswap-ai

For each technology, report:

- current status/version and date
- exact sponsor relevance
- new AlphaDawg capability unlocked
- integration surface
- dependency/security/operational risk
- estimated 36-hour effort band
- demo evidence required
- BUILD / WATCH / REJECT decision

Prefer a small standards-based HTTP server over a framework-specific agent runtime when it reduces cost and preserves interoperability. Do not recommend a protocol solely because it is new.

Workstream E — Prize portfolio economics

Create three portfolios:

1. Minimalist: highest-confidence Continuity and one real transaction loop.
2. Recommended: best risk-adjusted three-partner portfolio using one shared vertical slice.
3. Maximal: all technically compatible tracks, with explicit dependencies and cut order.

For each portfolio show:

- features and sponsor tracks
- per-track obtainable first-place/placement value
- confirmed versus conditional value
- engineering hours and critical dependencies
- demo complexity
- failure blast radius
- what must be cut first

Use these financial terms precisely:

- prize pool: sponsor's total allocation
- team maximum: highest amount one team could receive under explicit rules
- theoretical ceiling: assumes every compatible award is allowed and won
- credible ceiling: excludes contradictory or low-proof targets
- planning value: qualitative risk-adjusted prioritization, not fabricated expected dollars
- confirmed Continuity floor/ceiling: only tracks whose rules explicitly admit this baseline

Deliverables

Create:

- strategy/alphadawg/09_Lisbon_Live_Track_and_Eligibility_Audit.md
- strategy/alphadawg/14_Current_Web3_Agent_Commerce_Radar.md
- strategy/alphadawg/15_Winner_Patterns_and_Prize_Portfolios.md
- sources/alphadawg-lisbon-2026-source-ledger.csv

Update the Command Center only if a claim is superseded by stronger current evidence.

Completion gates

1. Every visible track is in the ledger, including details-pending tracks.
2. Every payout uses per-team obtainable amounts and does not sum mutually exclusive placements.
3. Continuity eligibility is partner-specific and evidence-labeled.
4. The three portfolios respect the partner limit and explicit exclusions.
5. Every BUILD technology maps to one AlphaDawg feature, one sponsor criterion, and one demo proof.
6. Every source URL, access date, and confidence field is populated.
7. CSV parses cleanly; Markdown frontmatter and wikilinks pass vault QA.
8. The final recommendation ends with BUILD / NARROW / STOP and lists the exact external questions still unresolved.

Stop rules

- Do not use old Cannes track text as Lisbon eligibility evidence.
- Do not infer same-partner multi-award eligibility from the generic submission UI.
- Do not treat the New York precedent as a guarantee for Lisbon sponsors.
- Do not include Hedera No Solidity in the credible portfolio without an explicit project-level ruling.
- Do not add 1inch or Sui to the recommended build.
- Do not describe draft ERCs as finalized standards.
- Do not recommend live integrations that require unapproved spend, mainnet funds, or unavailable credentials.
- When official text conflicts, preserve both claims, mark the decision blocked, and draft one concise sponsor question.

Final response

Return the recommended portfolio, theoretical versus credible prize ceiling, decisive evidence, five technology decisions, unresolved gates, exact artifact paths, and QA result. Keep the response short.
````

