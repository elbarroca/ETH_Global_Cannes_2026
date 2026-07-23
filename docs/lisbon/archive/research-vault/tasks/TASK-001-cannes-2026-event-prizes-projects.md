---
task_id: TASK-001
title: Cannes 2026 event, prizes, and verified projects
status: complete
access_date: 2026-06-22
output_event_file: ../events/ethglobal-cannes-2026.md
confidence: high
---

# TASK-001 - Cannes 2026 Event, Prizes, And Verified Projects

## Scope

Implement the Cannes 2026 slice of the ETHGlobal research vault using official ETHGlobal sources first:

- Event facts, themes, venue, dates, and Lisbon relevance.
- Prize partners, prize pool, and partner tracks.
- Deep notes on finalists or prize winners that are verifiable from official ETHGlobal project detail pages.
- Do not update CSV registers or unrelated vault files.

## Success Criteria

- Create `events/ethglobal-cannes-2026.md`.
- Include source URLs, access date `2026-06-22`, confidence labels, and Lisbon relevance.
- Use official ETHGlobal event, prize, showcase, and project detail pages.
- Record gaps without inferring unverified finalist or winner status.

## Source Pass

- Event page: https://ethglobal.com/events/cannes2026
- Prize page: https://ethglobal.com/events/cannes2026/prizes
- Showcase page: https://ethglobal.com/showcase?events=cannes2026
- Verified project detail pages:
  - https://ethglobal.com/showcase/veryclear-vu8i7
  - https://ethglobal.com/showcase/evm-porst-kkcfo
  - https://ethglobal.com/showcase/opencompliance-b89x9
  - https://ethglobal.com/showcase/maki-564eg
  - https://ethglobal.com/showcase/sentinel-91nv5

## Research Notes

- Official event facts verified: April 3 - 5, 2026; Cannes, France; venue at Le Palais des Festivals et des Congres de Cannes; 800+ attendees; 11+ protocols; 29+ workshops; $150,000 prize pool; Pragma Cannes 2026 on April 2, 2026. Confidence: High.
- Official themes verified: Zero Knowledge Proofs, AI x Crypto, DeFi, Crypto Consumer, Layer 2s, Interoperability, Public Goods, Privacy & Security, TEEs, Data Availability, Identity, DevTools. Confidence: High.
- Official prize partners verified: World, 0G, Arc, Hedera, ENS, Uniswap Foundation, Flare, Ledger, Chainlink, WalletConnect, Unlink, Dynamic, plus ETHGlobal finalist pack/perks. Confidence: High.
- Official showcase project count verified from ETHGlobal data: 33 Cannes 2026 projects. Confidence: High.
- Verified winner/finalist project pages:
  - Veryclear - Ledger, Clear Signing, Integrations & Apps, 1st place.
  - EVM PORST - ETHGlobal Cannes 2026 Finalist.
  - OpenCompliance - Chainlink, Best usage of Chainlink privacy standard.
  - maki - ETHGlobal Cannes 2026 Finalist.
  - SENTINEL - Flare, Next generation of apps with TEE Extensions and Smart Accounts, 3rd place.

## Lisbon Relevance Logic

- Confidence: Medium because Lisbon relevance is an analytical layer, not a direct claim from ETHGlobal.
- Rationale: Cannes is short-haul Europe from Lisbon; event topics match EU-facing crypto work in payments, wallet safety, identity, DeFi, compliance, TEEs, and AI agents; sponsor tracks map to practical startup and research opportunities for Portuguese builders.

## Gaps

- ETHGlobal prize page confirms top 10 finalist eligibility/perks, but I only marked finalist status where a specific project detail page visibly showed `Winner of: ETHGlobal - ETHGlobal Cannes 2026 Finalist`.
- I did not infer the remaining top 10 finalists from showcase ordering.
- I verified deep notes for five marked winner/finalist pages; the remaining showcase projects are indexed by official title/tagline only.
- This slice uses a compact markdown dossier format and does not update shared registers or templates.

## Output

- `tasks/TASK-001-cannes-2026-event-prizes-projects.md`
- `events/ethglobal-cannes-2026.md`
