---
title: AlphaDawg Lisbon Automation Runbook
tags:
  - alphadawg
  - automation/research
  - ethglobal/lisbon-2026
status: active
area: automation
priority: P1
owner: automation
gate: daily-monitor
confidence: high
updated: 2026-07-18
---

# AlphaDawg Lisbon Automation Runbook

Vault target: `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault`

## Active Automations

| automation | cadence | scope | output rule |
|---|---|---|---|
| `AlphaDawg Lisbon track watch` | Daily at 09:00 Europe/Lisbon | Official Lisbon prizes/rules, AlphaDawg showcase, 0G, Hedera and Uniswap requirements | Update only when evidence changes; otherwise report no material change. |
| `ETHGlobal protocol radar` | Weekly | Broad open-source protocol and SDK opportunities | Research input only; it must not override the released-track scorecard. |

## Daily Monitor Contract

Primary sources:

- [Lisbon prizes](https://ethglobal.com/events/lisbon2026/prizes)
- [ETHGlobal rules](https://ethglobal.com/rules)
- [AlphaDawg Cannes showcase](https://ethglobal.com/showcase/alpha-dawg-fh6vm)
- Official sponsor documentation linked from the prize page.

The monitor checks:

- New The Graph or World track details.
- Changed pool amounts, category labels, qualification rules or submission artifacts.
- Written Continuity eligibility for Hedera Agentic Payments.
- Uniswap Stack Contribution, API, `FEEDBACK.md` or feedback-form requirements that affect the implementation.
- 0G/Hedera SDK changes that alter the planned critical path.

Current observed deltas:

- 2026-07-18: The Graph details are published; keep as research-only unless a Continuity-specific AlphaDawg fit is selected.
- 2026-07-18: Uniswap Hackathon Feedback URL is live; still requires completed submission after real integration.

When evidence changes, update:

- [[00_Command_Center]]
- [[02_Track_Strategy]]
- [[06_Hedera_0G_1inch_Scope_Audit]]
- [[07_Exact_0G_Hedera_Uniswap_Arc_Plan]]
- [[../alphadawg-agent-commerce-track-map]]
- [[../../03_Source_Ledger]]
- [[../../04_Findings_Database]]
- `registers/source_freshness.csv`

## Automation Guardrails

- Official sources first; search results are discovery only.
- Keep extracted facts separate from engineering inference.
- Preserve prior claims when no official change exists.
- Do not modify the AlphaDawg product repository.
- Do not create noisy daily notes when nothing changed.
- Never print API keys, wallet secrets, mnemonics or private account data.
- Validate CSV, YAML, Canvas JSON, wikilinks and source reachability before completion.
