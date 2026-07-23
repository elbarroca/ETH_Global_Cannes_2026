---
title: Lisbon 2026 Provenance and Team Separation
tags:
  - ethglobal/lisbon-2026
  - provenance
  - clean-room
status: planned
updated: 2026-07-16
gate: H0_LOCKED
---

# Lisbon 2026 Provenance And Team Separation

## Separation Contract

| boundary | Person A / AlphaDawg | Person B / new Classic project |
|---|---|---|
| authority | Person A decides AlphaDawg scope, commits, spend requests, demo, and submission. Rights holders and ETHGlobal still control reuse eligibility. | Person B decides Project B scope, commits, spend requests, demo, and submission. |
| starting state | Existing Continuity project at immutable Cannes SHA `bfa7bd37c573e2e49525d965f7f937210e170d72`. | No project-specific repo, code, design, asset, scaffold, deployment, database, wallet, prompt corpus, or generated artifact before H0. |
| repo/history | New event worktree and branch from the Cannes SHA only after H0; full history retained. | New directory and repository only after H0; empty/new baseline and first commit timestamp recorded. |
| ownership gate | Cannes contributors: Barroca 134 commits, Ehtesham 14; Fly.io automation 1. Consent, attribution, license, changed-team approval, and prize treatment are unresolved. | Event-window work authored by Person B; public dependencies retain their licenses and attribution. |
| secrets/accounts | AlphaDawg-only environment, database, cloud, wallets, sponsor accounts, API keys, domains, and testnet funds. | New Project-B-only environment, database, cloud, wallets, sponsor accounts, API keys, domains, and testnet funds. |
| evidence | Only event-window AlphaDawg commits and fresh sponsor artifacts. Cannes evidence is baseline-only. | Only Project B's event-window commits, transactions, proofs, video, demo, and submission. |
| submission | One AlphaDawg Continuity submission controlled by Person A. | One From Scratch submission controlled by Person B. |

Names and legal identities must be filled in privately at H0; do not place private contributor communications in this vault.

## Permitted Shared Material

- Public event rules, sponsor documentation, standards, public SDKs, public starter kits, and this research vault.
- General engineering knowledge: idempotency, runtime validation, policy gates, test design, redaction, and demo discipline.
- A public library both projects independently consume when its license permits use, each repo records the exact source/version, and neither claims the library as event-created work.
- Non-project-specific logistics such as venue, deadline, judging format, and the three-partner cap.

## Prohibited Transfer

- AlphaDawg application code, prompts, schemas, tests, UI, contracts, deployment files, datasets, generated assets, migrations, or evidence into Project B.
- Project B work into AlphaDawg or either project's work into the other's history.
- Copying/cherry-picking the removed AlphaDawg pre-event prototype.
- Shared private keys, mnemonics, API keys, databases, cloud projects, wallets, deployers, domains, transactions, proof IDs, test accounts, or sponsor forms.
- One person presenting the other project's implementation or evidence as their own.

## Public Library Rule

If both projects use the same public library:

1. Each person independently adds it after their authorized H0.
2. Each repo records upstream URL, license, version/commit, and whether it is a starter or dependency.
3. Each project writes its own integration and tests; no project-specific adapter crosses the boundary.
4. Upstream code is labeled reused; event-created code is isolated in commit history.
5. If license, authorship, or organizer treatment is unclear, both usages are `BLOCKED`.

## Handoff And Conflict Rules

- Research questions may be shared; qualifying implementation may not.
- A person may explain a public protocol, but may not author or debug the other person's submission code unless team membership is formally changed and ETHGlobal approves before work begins.
- If both projects independently converge on the same product mechanism, stop the later implementation and either differentiate the user/mechanism or obtain an organizer ruling; do not hide the overlap.
- If an account or evidence identifier is accidentally shared, quarantine it from both claim sets, rotate access where authorized, and capture new independent evidence.
- No merge, repo transfer, teammate change, or prize-credit change occurs without both people and affected rights holders agreeing in writing.

## Provenance Gates

| gate | AlphaDawg | Project B |
|---|---|---|
| H0 clock | Live ETHGlobal page/dashboard says hacking is open. | Same independent check. |
| first commit | Provenance/control docs from clean Cannes SHA. | New-repo baseline, README, architecture, track matrix, evidence ledger, AI disclosure, threat model, environment template, license, changelog. |
| branch | New event-window worktree/branch; never reuse the pre-event branch as evidence. | New default/feature branch created after repo initialization at H0. |
| account manifest | `SET/NOT_SET` labels only; no values. | Separate `SET/NOT_SET` labels only; no values. |
| claim ledger | Every claim maps to AlphaDawg event-window files/commits/evidence. | Every claim maps to Project B event-window files/commits/evidence. |

One project's integration, transaction, commit, proof, account, demo, or form can never satisfy the other's gate.

