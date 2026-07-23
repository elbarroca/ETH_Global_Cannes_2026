# Task Output Aggregation

Status: active.

## Aggregation Rules

- Raw event/project research stays in `tasks/`.
- Stable claims move into [[04_Findings_Database]].
- Reviewed, caveated, decision-useful claims move into [[01_Master_Synthesis]].
- Dynamic source pages require an access date and recheck rule.

## Current Aggregation

| source | status | aggregation_target | notes |
|---|---|---|---|
| TASK-001 Cannes event/project research | researched | [[events/ethglobal-cannes-2026]], [[03_Source_Ledger]] | Worker-owned file. |
| TASK-002 New York event/project research | researched | [[events/ethglobal-new-york-2026]], [[03_Source_Ledger]] | Worker-owned file. |
| TASK-003 Lisbon event/opportunity research | researched | [[events/ethglobal-lisbon-2026]], [[strategy/lisbon-opportunity-map]] | Worker-owned file. |
| TASK-004 pattern analysis | researched | [[synthesis/winner-finalist-pattern-analysis]], [[strategy/lisbon-idea-theses]] | Worker-owned file. |
| TASK-007 deep winner/finalist enrichment | enriched | [[synthesis/deep-winner-finalist-debrief-2026]], `registers/winner_reasoning.csv`, `registers/projects.csv` | Separates extracted facts from inferred win reasoning. |
| TASK-008 protocol radar seed and automation | active | [[strategy/weekly-open-source-protocol-radar]], `registers/open_source_protocol_watchlist.csv`, `registers/source_freshness.csv` | Weekly automation created as `ethglobal-protocol-radar`. |
| TASK-009 Obsidian entity normalization | complete | [[projects/00_Project_Index]], [[repositories/00_Repository_Index]], [[teams/00_Team_Index]], [[protocols/00_Protocol_Index]], [[synthesis/all-findings-aggregated-depth]] | Generated entity notes from stable registers. |
| Condensed winning playbook | complete | [[strategy/condensed-winning-playbook]] | Single operating file for winner taxonomy, wow factors, repo choice, and open-source-rule implications. |
| Lisbon decision matrix | active | [[strategy/judge-ready-lisbon-decision-matrix]] | Holds current ranked ideas plus real-track validation protocol and open-source ecosystem filter. |
| Track validation register | active | `registers/track_validation.csv` | Tracks final sponsor wording, qualification pass/fail, idea score deltas, and demo artifact readiness. |
| Open-source repo audit register | active | `registers/open_source_repo_audit.csv` | Tracks reusable primitives, repo audit status, upstream contribution path, and ecosystem value. |
| Colosseum Frontier addendum | active | [[colosseum/solana-frontier-2026]], [[colosseum/projects/00_Project_Index]], [[strategy/colosseum-to-lisbon-transfer-map]], `registers/colosseum_frontier_*.csv` | Adds Solana Frontier winners, sponsor/prize context, open-source ecosystem scan, per-project Markdown notes, and Lisbon transfer patterns. |
| Main-agent registers | reviewed | `registers/*.csv` | Stable headers from plan. |

## Open Gaps

| gap | impact | next check |
|---|---|---|
| Full official finalist list for Cannes/New York is not exhaustively captured in the master synthesis. | Deep notes prioritize verified high-signal examples. | Use official project detail pages and prize filters before external use. |
| Several Lisbon prize details were not fully visible or were marked as coming soon on the official page. | Idea scoring can change. | Recheck Lisbon prizes within 72 hours of July 24, 2026. |
| New York finalist social-source names need project-page reconciliation. | Current slate is useful for tracking but not yet deep strategy evidence. | Re-run official detail extraction after ETHGlobal rate limits clear. |
| Weekly radar can drift if source APIs change. | Protocol recommendations could stale quickly. | Automation refreshes weekly; manually recheck before committing build direction. |
| Team member names are unresolved in generated team notes. | Public server-rendered ETHGlobal payload did not expose names during extraction. | Recheck with richer ETHGlobal access or logged-in pages before publishing team claims. |
| Final Lisbon track wording is not yet normalized against the decision matrix. | Current scores can change once exact sponsor requirements are live. | Run the real-track validation protocol in [[strategy/judge-ready-lisbon-decision-matrix]] and reject ideas under 70. |
| Open-source ecosystem impact is not repo-audited yet. | A project can look useful but fail to stimulate the sponsor/open-source ecosystem. | Audit README, setup, license, reusable package/module, tests, and upstream contribution path for top repo candidates. |
| Colosseum Arena project pages are client-rendered and API access redirected during this pass. | Repo/demo/team fields for Frontier projects remain unresolved. | Recheck with authenticated browser access or exported Arena payload before claiming repo implementation details. |
