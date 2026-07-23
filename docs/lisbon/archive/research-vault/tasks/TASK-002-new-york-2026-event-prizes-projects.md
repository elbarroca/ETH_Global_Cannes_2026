# TASK-002 - New York 2026 Event, Prizes, Projects

status: completed
access_date: 2026-06-22
scope: ETHGlobal New York 2026 event facts, 2026 rule change, prize partners/tracks, verified prize-winner project notes, Lisbon relevance

## Files Written

- `output/research-vault/events/ethglobal-new-york-2026.md`
- `output/research-vault/tasks/TASK-002-new-york-2026-event-prizes-projects.md`

## Success Criteria

- Used official ETHGlobal sources first: event page, prize page, official showcase, and official project detail pages.
- Included access_date 2026-06-22.
- Included confidence labels.
- Included source URLs.
- Covered event facts, rule change, prize partners/tracks, verified winner notes, and Lisbon relevance.
- Did not update CSV registers or files outside this two-file slice.

## Evidence Sources

| Source | Use | Confidence |
|---|---|---|
| https://ethglobal.com/events/newyork2026 | Event facts, venue, schedule, themes, rule change | High |
| https://ethglobal.com/events/newyork2026/prizes | Prize partner totals and bounty tracks | High |
| https://ethglobal.com/showcase?events=newyork2026 | Official project list for New York 2026 | High |
| https://ethglobal.com/showcase/kickoff-aivy-studio-f6o10 | Verified winner note | High |
| https://ethglobal.com/showcase/ensfromwei-m3nj7 | Verified winner note | High |
| https://ethglobal.com/showcase/agentindex-psxxo | Verified winner note | High |
| https://ethglobal.com/showcase/tap-tap-revolution-fnvdt | Verified winner note | High |
| https://ethglobal.com/showcase/agentrankr-xe2vj | Verified winner note | High |
| https://ethglobal.com/showcase/ballast-7jpyp | Verified winner note | High |
| https://ethglobal.com/showcase/smile-fictr | Verified winner note | High |
| https://ethglobal.com/showcase/better-wallet-yvjdh | Verified winner note | High |
| https://ethglobal.com/showcase/clawback-vpmw2 | Verified winner note | High |
| https://ethglobal.com/showcase/preo-rg0m9 | Verified winner note | High |
| https://ethglobal.com/showcase/shade-rkfzc | Official non-award-verified watchlist example | Medium |
| https://ethglobal.com/ | Lisbon 2026 relevance and date | High |

## Verification

- Confirmed the workspace had no project-level AGENTS.md and no `.codegraph/`. Initial file listing returned no existing vault files; other agents populated unrelated vault files later, and this slice was kept to the two requested paths.
- Wrote only the requested Markdown paths.
- No package manager, lint, typecheck, or test harness exists in this workspace; verification is file-scope review plus path/diff checks.

## Gaps

- Official finalist labels were not visible in accessible ETHGlobal project detail page text during this pass, so the event note does not assert finalist status.
- ETHGlobal rate limiting occurred during bulk project-page checks. The event note includes only project award labels that were verified on fetched official detail pages.
- Prize and winner pages should be rechecked before publication because ETHGlobal showcase metadata can continue to update after the event.
