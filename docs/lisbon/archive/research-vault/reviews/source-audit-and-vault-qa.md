# Source Audit And Vault QA

Status: reviewed
Date: 2026-06-22

## Checks

| check | result | notes |
|---|---|---|
| File types | pass | Vault contains Markdown and CSV only. |
| CSV parsing | pass | All register CSVs parse with Python `csv`. |
| Wikilinks | pass after patch | CSV references use code paths; note wikilinks resolve to Markdown notes. |
| Source URLs | pass | Register rows include source URLs where schema requires them. |
| Access dates | pass with schema caveat | Event/prize/track/source freshness rows include access dates; `projects.csv` follows the requested schema without an access_date column. |
| Master synthesis | pass | Contains reviewed/caveated findings only, not raw task research. |
| Deep enrichment | caveated | `winner_reasoning.csv` marks inferred win logic separately from official extracted facts. |
| Automation | pass | Weekly local automation `ethglobal-protocol-radar` was created for protocol research updates. |
| Entity notes | pass | Project, repository, team, protocol, and aggregated finding notes were generated from stable registers. |

## Remaining Gaps

| gap | impact | next check |
|---|---|---|
| Cannes and New York finalist lists are not asserted exhaustively. | Avoids unsupported finalist claims. | Recheck official project pages or prize filters before publication. |
| Lisbon partner-specific tracks are partly unpublished/currently incomplete. | Lisbon idea scoring may change. | Recheck https://ethglobal.com/events/lisbon2026/prizes within 72 hours of the event. |
| Technical claims from project pages are not repo-audited. | Project self-descriptions may overstate implementation depth. | Verify GitHub/demo links before using as evidence of technical completeness. |
| ETHGlobal rate limiting interrupted full project-detail extraction after the first broad scan. | Some New York finalist and track-winner pages remain unresolved or lightly enriched. | Re-run targeted official page extraction later, not a full 497-page scrape. |
| Team names remain unresolved. | Public ETHGlobal pages exposed repository URLs but not team membership in the accessible payload. | Use richer page access before making person-level claims. |
