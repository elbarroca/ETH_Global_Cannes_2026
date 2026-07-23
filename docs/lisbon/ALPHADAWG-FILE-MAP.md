# AlphaDawg Internal File Map

Status: `COMPLETE_REPO_LOCAL_MIRROR`

Everything needed to inspect AlphaDawg directly or through its research references is stored inside this repository. No execution prompt depends on the separate research checkout.

## Current execution surface

- [`GOALS.md`](GOALS.md): canonical all-in-one sprint and `/goal` pack.
- [`prompts/`](prompts/): split copy-ready prompts using `C0/A1/P0/E0/U0/A2/A2R/A3/A4/A5/A6-A7/VA` IDs.
- [`README.md`](README.md): control-center entry point.
- [`BASELINE.md`](BASELINE.md), [`TRACK-MATRIX.md`](TRACK-MATRIX.md), [`CLAIM-MATRIX.md`](CLAIM-MATRIX.md), [`EVIDENCE.md`](EVIDENCE.md), and [`EXTERNAL-EFFECTS.md`](EXTERNAL-EFFECTS.md): current authority, claims, evidence, and effect gates.

Only the current execution surface may direct implementation. Historical prompts inside the archive are provenance, not commands.

## Complete internal research mirror

- [`archive/research-vault/`](archive/research-vault/): byte-for-byte mirror of all 244 files in the research vault as copied on 2026-07-23.
- [`archive/research-repo/`](archive/research-repo/): the two additional research-repository root files that directly mention AlphaDawg, renamed so the archived `AGENTS.md` cannot govern product execution.
- [`ALPHADAWG-FILE-MANIFEST.csv`](ALPHADAWG-FILE-MANIFEST.csv): every mirrored path, SHA-256 digest, size, and direct/support classification.
- Direct AlphaDawg matches: 62 files.
- Dependency/support files retained to guarantee recursive indexes, wikilinks, winner precedents, protocols, ledgers, dashboards, and separation context: 182 files.

Main internal entry points:

- [Research-vault index](archive/research-vault/00_Index.md)
- [Archived research-repository instructions](archive/research-repo/RESEARCH-AGENTS.md)
- [Archived research-repository README](archive/research-repo/RESEARCH-README.md)
- [Beginner hackathon dashboard](archive/research-vault/00_BEGINNER_HACKATHON_DASHBOARD.md)
- [AlphaDawg command center](archive/research-vault/strategy/alphadawg/00_Command_Center.md)
- [AlphaDawg master plan](archive/research-vault/strategy/alphadawg/ALPHADAWG_LISBON_MASTER.md)
- [AlphaDawg Obsidian Base](<archive/research-vault/strategy/alphadawg/AlphaDawg Lisbon.base>)
- [AlphaDawg Canvas](<archive/research-vault/strategy/alphadawg/AlphaDawg Lisbon.canvas>)
- [0G research](archive/research-vault/protocols/0g-decentralized-ai-stack.md)
- [ENSv2 research](archive/research-vault/protocols/ensv2-and-ens-developer-stack.md)
- [Uniswap research](archive/research-vault/protocols/uniswap-v4-hooks.md)
- [AlphaDawg source ledger](archive/research-vault/sources/alphadawg-lisbon-2026-source-ledger.csv)
- [Dual-project provenance and team separation](archive/research-vault/strategy/dual-project/01_Provenance_and_Team_Separation.md)
- [Latest prize and engineering delta](archive/research-vault/strategy/dual-project/10_2026-07-23_Prizes_and_Engineering_Delta.md)
- [User-supplied prize snapshot](archive/user-supplied/ethglobal-lisbon-prize-snapshot-2026-07-23.txt)
- [ENSv2 workshop evidence](evidence/workshop/README.md)

## Isolation and precedence

1. `EXTERNAL-EFFECTS.md`
2. `BASELINE.md`
3. `GOALS.md`
4. live track, claim, and evidence controls
5. `context/`
6. `archive/`

Project B and general winner-research files are mirrored only because AlphaDawg planning links to separation rules and comparative evidence. They cannot supply AlphaDawg code, state, receipts, claims, or execution instructions. Current official sponsor sources outrank every archived snapshot.

The renamed research operating contract retains SHA-256 `cf71276a...5ea7`. The internalized research README has SHA-256 `42ad0088...66f6`; its 15 former `output/research-vault/` links were rewritten to `../research-vault/` so they work from the archive. The original source README digest was `96ae99da...2bdf`. No other file outside `output/research-vault/` directly mentions AlphaDawg.

## Historical heading redirects

All 1,033 internal file-link occurrences resolve. Two source-era heading names became stale and are preserved byte-for-byte; use these corrected destinations:

- `strategy/dual-project/08_Two_Person_H0_Runbook.md` → [Master plan: 15. Gated Engineering Sprints](archive/research-vault/strategy/alphadawg/ALPHADAWG_LISBON_MASTER.md#15-gated-engineering-sprints)
- `strategy/alphadawg/00_Command_Center.md` → [Kickoff runbook: 7. H0 Worktree And Control Commit](archive/research-vault/strategy/alphadawg/17_Kickoff_H0_Runbook.md#7-h0-worktree-and-control-commit)
