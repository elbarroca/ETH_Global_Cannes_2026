# A0 Context Mirror Validation

Observed at: `2026-07-23T19:12:11Z`

Task: `A0-CONTEXT-MIRROR`

Start SHA: `b000ba993e753a580f2c0b09d4fec8f0eac8d337`

## Results

| Check | Result |
|---|---|
| Research-vault source files | `244` |
| Repo-local mirrored files | `244` |
| Source/mirror path-set differences | `0` |
| Source/mirror byte differences | `0` |
| SHA-256 manifest rows verified | `244/244` |
| Literal AlphaDawg matches | `62` |
| Dependency/support files retained | `182` |
| Markdown frontmatters parsed | `217/217` |
| CSV files parsed | `20/20` |
| JSON/Canvas files parsed | `6/6` |
| Obsidian Base files parsed | `1/1` |
| Internal research-vault file-link occurrences resolved | `1,033/1,033` |
| Context wikilinks resolved | `40/40` |
| Active/navigation Markdown links resolved | `72/72` |
| Adapted research README links | `15/15` |
| Ambiguous wikilinks | `0` |
| Missing local file targets | `0` |
| Nested archived `AGENTS.md` files | `0` |
| Archived symlinks | `0` |
| Active dependencies on the external research checkout | `0` |
| High-confidence secret-pattern matches | `0` |
| Active-document `git diff --check` | `PASS` |
| Independent mirror audit | `PASS_IF_COMMITTED_AND_LOCK_RELEASED` |

Two historical heading labels are stale in the byte-preserved source mirror. Their correct internal destinations are recorded in `docs/lisbon/ALPHADAWG-FILE-MAP.md`; the underlying files are present.

## Scope boundary

This proves documentation availability and integrity only. Application lint, typecheck, tests, build, migrations, sponsor smokes, deployment, and submission were not run. Goal A1 remains blocked by the independent A0 release audit: pre-H0 timing, rights/license/team/owner gaps, evidence/atomicity defects, and external-effect authorization remain unresolved.
