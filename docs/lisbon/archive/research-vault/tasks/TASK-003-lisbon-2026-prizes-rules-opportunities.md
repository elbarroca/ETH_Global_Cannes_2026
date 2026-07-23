# TASK-003 - Lisbon 2026 prizes, rules, opportunities

access_date: 2026-06-22
status: complete
confidence: high for official event metadata and visible prize partner amounts; medium for opportunity framing because it is derived from current partner positioning; low for partner-specific bounty requirements because they are not published.

## Scope

Build a disjoint ETHGlobal Lisbon 2026 research slice covering:

- Lisbon date, location, and venue.
- Current visible prize partners and prize pools.
- Classic Track vs Continuity Track rules where officially visible.
- Builder opportunity map based on current Lisbon partners.

## Official sources checked

- https://ethglobal.com/events/lisbon2026
- https://ethglobal.com/events/lisbon2026/prizes
- https://ethglobal.com/events/lisbon2026/apply
- https://ethglobal.com/events/lisbon2026/prizes/the-graph
- https://ethglobal.com/events/lisbon2026/prizes/yellow
- https://ethglobal.com/events/lisbon2026/prizes/world
- https://ethglobal.com/events/lisbon2026/prizes/hedera
- https://ethglobal.com/events/lisbon2026/prizes/0g
- https://ethglobal.com/events/lisbon2026/prizes/uniswap-foundation
- https://ethglobal.com/events/lisbon2026/prizes/ens
- https://ethglobal.com/events/lisbon2026/prizes/1inch

## Outputs

- `events/ethglobal-lisbon-2026.md` - event facts, visible partner prizes, official FAQ rules, and gaps.
- `strategy/lisbon-opportunity-map.md` - partner-based builder opportunity map and partner targeting guidance.

## Verification

- Confirmed official event payload lists ETHGlobal Lisbon 2026 as a future physical hackathon in Lisbon, Portugal, running 2026-07-24 to 2026-07-26.
- Confirmed official venue payload lists Pavilhão Carlos Lopes, Av. Sidónio Pais 16, 1070-051 Lisboa, Portugal.
- Confirmed official prizes page shows 8 visible prize partners with a total visible prize pool of $95,000.
- Confirmed individual official partner prize pages currently show partner amount and "Prize details coming soon" rather than partner-specific bounty criteria.
- Confirmed official FAQ text exposes Classic Track - From Scratch and Continuity Track rules.
- Did not touch CSV registers or files outside the three requested paths.

## Gaps

- Partner-specific tracks, judging criteria, and bounty requirements are not yet visible on the official partner prize pages as of 2026-06-22.
- Continuity-specific partner categories are referenced in the official FAQ, but no current Lisbon partner page exposes those categories yet.
- Official source data uses UTC ISO timestamps plus Europe/Lisbon timezone metadata; this slice records raw official timestamps and avoids unsupported local-time conversion.
