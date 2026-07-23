# Condensed Winning Playbook

Access baseline: 2026-06-22

Purpose: one dense operating file for Lisbon idea selection, repo selection, and pitch shaping.

## One-Line Rule

Build one replayable workflow where a sponsor primitive creates a proof artifact that changes a user outcome.

If the sponsor can be removed and the product still works the same, the idea is weak.

## Winner Taxonomy

| type | what it means | winning signal | examples |
|---|---|---|---|
| ETHGlobal finalist | Top overall project signal across product, originality, technicality, usability, practicality, and wow. | Judges understand the user pain fast and see a complete live loop. | [[projects/dive]], [[projects/veil-vpn]], [[projects/enshell]], [[projects/maki]], [[projects/evm-porst]] |
| Track winner | Sponsor-specific winner. Does not need to be an overall finalist. | Sponsor primitive is in the critical path, not decorative. | [[projects/proof-of-human]], [[projects/opencompliance]], [[projects/agentindex]], [[projects/better-wallet]], [[projects/ballast]] |
| Multi-track winner | One product maps multiple sponsors to different jobs. | Each sponsor does a separate necessary job: identity, compute, storage, settlement, indexing, risk, or payment. | [[projects/dive]], [[projects/veil-vpn]], [[projects/azimuth]] |
| Strong pattern, not confirmed winner | Useful for ideation but not prize evidence. | Shows a good product wedge or demo shape. | [[projects/carry]], [[projects/scoutxyz]] |

## What Makes It Wow

| wow lever | what judges see | why it works |
|---|---|---|
| Proof artifact | ENS record, World proof, Chainlink workflow result, Hedera log, hardware signature, indexed score, escrow state. | Turns claims into inspectable evidence. |
| Replayable loop | Reset, run, verify, settle, inspect. | Judges can understand and trust the demo under time pressure. |
| Real failure mode | Bot drops, unsafe agent signing, VPN no-log claims, hidden LP losses, missing payment disputes. | The problem is legible before protocol details. |
| Sponsor inevitability | Removing the sponsor breaks the product promise. | Wins tracks because integration is causal. |
| Hidden metric reveal | LVR, route quality, risk score, reputation factor, compliance decision. | Makes the product feel smarter than a generic dashboard. |
| Failure handling | Refund, dispute, reversal, policy block, human approval. | Mature product thinking in a hackathon-sized scope. |
| Physical or local proof | NFC wristband, hardware wallet, event presence. | Memorable only when it changes state or eligibility. |

## Open-Source Rule Change

ETHGlobal New York 2026 introduced a major rule change: projects no longer need to start from an empty repo. The official page says the old model was `empty repo only` and `existing_code: not allowed`; after New York, `starting_point: any repo you bring` and `existing_code: welcomed`. It also lists three paths:

- From Scratch: start empty.
- Extend Open Source: bring a repo you already maintain and ship a feature.
- Ship a Feature: build a new feature on top of an existing product and ship it as open source.

Source: https://ethglobal.com/events/newyork2026

## What This Changes For Lisbon

| old strategy | better 2026 strategy |
|---|---|
| Start from zero and build a toy MVP. | Pick a real open-source repo and ship one visible feature. |
| Hide complexity in slides. | Show a diff, repo, setup path, demo, and proof artifact. |
| Build generic app shell. | Add sponsor-native functionality to an existing useful codebase. |
| Pitch "we could integrate X." | Pitch "this PR/feature uses X and changes this user outcome." |

## Repo Selection Filter

Use an existing repo only if it passes all five:

1. The app already has a real user/workflow.
2. The Lisbon feature can be built in 36 hours.
3. The sponsor primitive changes behavior, not branding.
4. The repo can be made public or already is public.
5. The demo can show before/after in under 4 minutes.

Best repo types:

- Agent directories, MCP tools, x402 services.
- Wallet/signing tools.
- Uniswap/1inch/DeFi analytics.
- ENS registries and reputation systems.
- World-gated access, trials, raffles, or quotas.
- Indexers over ERC-8004, payments, hooks, or proof activity.
- Compliance/risk routers.

Avoid:

- Large products where the new feature is invisible.
- Repos with painful setup.
- Protocol integrations that are just login, naming, or display.
- Ideas that need liquidity, users, or production trust on day one.

## Lisbon Idea Shortlist

| idea | primary wow | tracks | repo/open-source angle |
|---|---|---|---|
| Human-backed x402 service desk | Agent pays, human-backed service executes, dispute/reputation updates. | World, ENS, The Graph, Yellow | Extend an x402/MCP service repo with World + ENS + reputation. |
| LVR-aware Aqua/Uniswap allocator | Shows net LP return after LVR, then recommends one action. | 1inch, Uniswap, The Graph | Extend a DeFi dashboard/indexer with Aqua/Uniswap strategy scoring. |
| Prompt-injection firewall for agent wallets | Malicious prompt blocked before signing; decision logged. | ENS, 0G, Hedera, The Graph | Add policy/simulation layer to an agent wallet or MCP repo. |
| Private compliance router | Swap/transfer allowed or blocked by confidential policy check. | 1inch, Uniswap, The Graph, support infra | Extend a router with private risk proof and policy result. |
| Verifiable agent memory | Agent history becomes a score that controls future permission. | 0G, ENS, The Graph, World | Extend ERC-8004/agent registry repo with memory proofs and scoring. |

## Scorecard

Reject ideas under 70.

| category | points | question |
|---|---:|---|
| User pain clarity | 15 | Can a judge understand the pain in 10 seconds? |
| Sponsor inevitability | 20 | Does the product break if the sponsor primitive is removed? |
| Proof artifact | 15 | Is there an inspectable artifact on screen? |
| Demo loop | 15 | Can it be replayed live without luck? |
| Open-source delta | 10 | Is the new feature visible as a repo diff or public package? |
| Practical adoption wedge | 10 | Could a real user try it after the hackathon? |
| Wow | 10 | Is there a moment where the result feels non-obvious or newly possible? |
| Scope discipline | 5 | Can it ship in 36 hours without fake infra? |

## Pitch Template

1. "Today, [user] loses [specific value] because [failure mode]."
2. "We built [feature] inside [repo/product]."
3. "The key primitive is [sponsor], which creates [proof artifact]."
4. "Watch the loop: input -> sponsor action -> artifact -> decision -> state change."
5. "This is open source here: [repo], and the hackathon diff is [feature]."
6. "The next real user is [narrow wedge]."

## Priority Follow-Ups

- Audit the 29 extracted repositories in [[repositories/00_Repository_Index]] for setup quality, sponsor SDK usage, and demo reproducibility.
- Resolve team membership only from official ETHGlobal or team-confirmed sources; current [[teams/00_Team_Index]] notes preserve paths but do not invent members.
- Deep-enrich unresolved New York finalists and ALMA when ETHGlobal rate limits clear.
- Add a `repo_diligence.csv` only after at least five repos are actually audited; empty process tables are noise.
