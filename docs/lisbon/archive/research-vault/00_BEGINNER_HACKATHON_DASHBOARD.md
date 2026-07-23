---
title: ETHGlobal Lisbon Beginner Hackathon Dashboard
aliases:
  - Lisbon Beginner Dashboard
  - Project A and B Control Board
tags:
  - ethglobal/lisbon-2026
  - dashboard
  - beginner
  - canonical
status: research_only_not_promotable
updated: 2026-07-23
gate: H0_LOCKED
---

# ETHGlobal Lisbon Beginner Hackathon Dashboard

> [!danger] Current state
> Both lanes are planning-only until official H0. AlphaDawg product code is frozen. Project B must not have a product repo, code, contracts, prompts, UI, design, wallets, or qualifying tests before H0. Never mix their accounts, code, commits, transactions, or evidence.

> [!important] Current H0 delta
> The 2026-07-23 prize and implementation lock is [[strategy/dual-project/10_2026-07-23_Prizes_and_Engineering_Delta]]. It supersedes older totals, Graph/World pending claims, and broader Project B architecture where they conflict.

> [!summary] Purpose of this dashboard
> This is the live decision surface: select or cut work, expose blockers, assign the current sprint, and bind every claim to observed evidence. The mega files define how to build; this page answers `NOW`, `NEXT`, `PASS WHEN`, and `STOP IF`. If it is not updated at a gate, it is not authoritative.

## 1. The Entire Strategy In One Screen

| lane | what we may build | why it is selected | current score | current state | next action | pass when | stop/cut when |
|---|---|---|---:|---|---|---|---|
| **Project A — AlphaDawg** | Creator publishes a bounded financial agent; buyer hires it; shared worker executes; 0G verifies; ENS resolves identity/version/service/payout; creator receives the settled fee; optional Sui gates private package execution. | Strong existing story and codebase; Lisbon can turn the placeholder marketplace into a real creator-owned agent economy. | Idea **87/100**; delivery **11/100**; prize claim **0/100**. | `BLOCKED_PRE_H0`; existing repo is clean at Cannes baseline, but team/IP/license/Continuity and engineering gates are red. | Clear provenance/H0; then repair toolchain/auth/schema before sponsor features. | One creator -> published ENS-resolved version -> paid buyer job -> strict 0G result -> at-most-one commission -> receipt; tamper/replay fails. | `STOP_PROJECT` if provenance/H0 invalid or marketplace + strict 0G cannot become real. `DROP_TRACK` when its sponsor primitive is not causal/live. |
| **Project B — ProofRail primary** | Evidence and Risk run as two separately verified model agents; deterministic settlement/recovery and a human authorize one bounded Hedera payment. | Highest user-loss clarity, agent necessity, sponsor causality, proof density, and judge-readable failure/success contrast with fewer external failure surfaces. | Idea **92/100**; delivery **0/100**; prize claim **0/100**. | `H0_LOCKED / NOT_RUN`; no repo by design. | After H0, run ProofRail, AquaSentinel, and SealSwitch probes; select one by H3. | Forged obligation prepares zero payment; valid obligation creates two verified 0G results, human approval, one reconciled Hedera effect, and receipt. | Select AquaSentinel when ProofRail probe is red; select SealSwitch when both higher probes are red. One clean pivot by H10; after H10 narrow or stop. |

Current recommended prize shapes:

- AlphaDawg: **0G Keep + ENS Continuity = $3,500 core cap**. Add Sui ($5,500 total) or Hedera Continuity ($4,500 total) only if one removal test passes; never both.
- ProofRail: **0G Product + Hedera Agentic = $6,000 core cap**. No third partner at lock; World/The Graph remain watch-only.
- Prize floor for every project is **$0**. Scores and caps are not win probability.

## 2. What To Do Now

Before H0:

- [ ] Obtain AlphaDawg former-contributor consent, OSI license, changed-team/Continuity approval, and track-specific admission.
- [ ] Confirm separate Project A/Project B owners, repos, accounts, wallets, spend caps, evidence roots, and decision authority.
- [ ] Recheck official Lisbon clock, rules, all 23 released tracks, Uniswap feedback completion path, and exact submission requirements.
- [ ] Prepare `SET/NOT_SET` access manifests only; never write secret values into this vault.
- [ ] Read [[strategy/alphadawg/ALPHADAWG_LISBON_MASTER#0. Beginner Operator Card|AlphaDawg Operator Card]] and [[strategy/dual-project/PROJECT_B_LISBON_MASTER#0. Beginner Operator Card|Project B Operator Card]]. Do not implement early.

At H0:

1. Record official clock/rules and immutable baselines.
2. Run AlphaDawg's first-60-minute baseline in its existing repo.
3. Run Project B's three isolated H0–H3 probes outside any product repo.
4. Select exactly one Project B candidate at H3 and create its clean repo then.
5. Work in H-gate order; no optional sponsor feature may displace a red core test.

## 3. Traffic-Light Board

### Project A — AlphaDawg

| subsystem | state | current truth | green condition |
|---|---|---|---|
| Provenance/IP/H0 | 🔴 `BLOCKED` | Consent, OSI license, changed-team/Continuity approval, and H0 are unresolved. | Written approvals, baseline SHA, public/open-source treatment, event clock, and track admission recorded. |
| Repository health | 🔴 `FAIL` | Lint: 23 errors/28 warnings; stale generated type errors; no test script; 73 production advisories; missing migrations/CI; broken scripts. | Clean install, schema/migrations, lint, typecheck, tests, build, CI, secret/license scan green on release SHA. |
| Auth/ownership | 🔴 `FAIL` | Routes trust caller-controlled identity; onboarding accepts mock/absent proof. | One-time wallet challenge, secure session, resource authorization, and cross-user zero-call tests. |
| Creator marketplace | 🔴 `FAIL` | “Deploy” stores an active placeholder; hiring creates only a relation row. | Real dry run/version publication plus quote/order/job/payment/refund/commission/receipt lifecycle. |
| Shared runtime/pack | 🔴 `FAIL` | Fixed manifests and ports; hired agents do not control the real cycle. | One worker executes immutable `agentVersionId`; active hires define eligible specialists. |
| Crawbot/OpenClaw/Telegram cleanup | 🔴 `FAIL` | Gateway/status, SOUL-file identity, static endpoints, per-agent startup, and overlapping bot modes remain in the inherited runtime. | Release boots with all legacy variables absent; one shared worker and `AgentVersion` own execution; Telegram is disabled or webhook-only notification. |
| Marketplace demo infrastructure | ⚪ `PLANNED` | Vercel, Railway, PostgreSQL, legacy specialist processes, and bot paths are not yet one canonical release topology. | Vercel web/API + one Railway worker + PostgreSQL share one SHA; readiness/reset/replay and two four-minute rehearsals pass. |
| 0G proof/storage | 🔴 `FAIL` | Verification can fail open; proof chain is overwritten; Storage readback proof is disabled. | Fatal verified inference, receipt DAG, proof-enabled Storage readback, tamper stops dependants. |
| ENS | ⚪ `NOT_IMPLEMENTED` | No Lisbon publication/discovery binding. | Clean-client write/resolve/update plus owner/version/service/payout manifest match and forged/stale refusal. |
| Sui | ⚪ `NOT_IMPLEMENTED` | No Move/Walrus/Seal code or local CLI. | Valid permit enables worker decrypt/0G; revoke rerun stops before Seal/0G; plaintext leakage scan green. |
| Uniswap | 🔴 `NOT_QUALIFYING` | Inherited path is custom/mock-compatible and can report self-transfer success. | Only if replacing Sui: reusable official-stack executor/example, real lifecycle, policy failures make zero signer/broadcast calls, feedback artifacts complete. |
| Demo/evidence | 🔴 `NOT_RUN` | Cannes assets exist; no Lisbon release/evidence. | Resettable creator/buyer failure+success demo twice, exact IDs, commands, code pointers, videos/forms. |

### Project B — candidate selection

| candidate | idea | delivery | claim | H3 probe | H10 slice | primary weakness |
|---|---:|---:|---:|---|---|---|
| ProofRail | **92/100** | **0/100** | **0/100** | Verified 0G inference semantics + bounded Hedera transfer/readback. | Separate Evidence/Risk proofs; deterministic settlement/recovery; disagreement creates durable zero-effect receipt. | Live proof/payment/recovery can still overrun. |
| AquaSentinel | **88/100** | **0/100** | **0/100** | Official commits/licenses, compile/tests, two fork resets, real token delta. | Safe typed proposal compiles; wrong token/app/opcode/over-allocation refuses before signing. | May look like a starter extension or form filler unless custom inventory behavior is measurable. |
| SealSwitch | **87/100** | **0/100** | **0/100** | Same-network Move policy + Seal encrypt + Walrus write/read + authorized decrypt. | Custom owner/subject/version/expiry/revoke tests and fresh grant/revoke PTBs. | Revocation cannot erase seen plaintext; Web2 ACL may be simpler; remote key-server risk. |

At H0 assign each running probe one owner. The team-wide WIP cap is **two tasks**. At H3 the highest-ranked fully green candidate wins; `BLOCKED` counts red, and no green candidate means `STOP`. Rejected candidate work freezes immediately.

## 4. How To Read Scores

| score | question answered | may it prove qualification? |
|---|---|---|
| Idea-selection score | Is the problem, agent role, sponsor causality, proof, demo, feasibility, novelty, and adoption wedge compelling? | No. |
| Delivery-readiness score | How much of the required product is observed working now? | No; it guides engineering. |
| Prize-claim readiness | Does event-window code, deterministic failure validation, live sponsor evidence, and every submission artifact exist? | Yes, but only at 100% for that exact claim. |
| Individual-cap ceiling | What is the largest compatible first-place/flat award under stated assumptions? | No; floor remains $0. |

Fatal gates override totals: invalid H0/provenance, ineligible track, pre-event Project B work, mock sponsor path, model-held signer/bytecode authority, missing real state change, or no reproducible failure demo means `STOP_PROJECT` or `DROP_TRACK`.

## 5. All Project And Research Data

### Active projects we own

| project | product repo | research master | status |
|---|---|---|---|
| AlphaDawg / Project A | `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Cannes_2026`; GitHub `elbarroca/ETH_Global_Cannes_2026`; baseline `bfa7bd3`; branch `feat/lisbon-agent-commerce`; clean on 2026-07-16. | [[strategy/alphadawg/ALPHADAWG_LISBON_MASTER]] | Existing Continuity project; frozen until H0/clearance. |
| Project B | No product repo before H0. | [[strategy/dual-project/PROJECT_B_LISBON_MASTER]] | From Scratch; primary ProofRail, fallbacks AquaSentinel and SealSwitch. |
| Research system | `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research`; private GitHub `elbarroca/ETH_Global_Research`. | This dashboard and [[00_Index]]. | Research/planning only; never use its commits as product implementation evidence. |

### Reference corpus—not our implementation

| corpus | count | canonical access | use |
|---|---:|---|---|
| ETHGlobal project records | **30**: 14 Cannes + 16 New York | `registers/projects.csv`; [[projects/00_Project_Index]] | Winner/product-pattern research. Entrant technical claims remain `UNVERIFIED` unless repo/runtime audited. |
| Repository mappings/notes | **30 mappings**, 29 entity notes + index | `registers/project_repos_teams.csv`; [[repositories/00_Repository_Index]] | Source/repo discovery; not proof a demo works. |
| Team mappings/notes | **30 mappings**, 30 entity notes + index | `registers/project_repos_teams.csv`; [[teams/00_Team_Index]] | Team metadata; all 30 member lists currently unresolved. Do not make person-level claims. |
| Colosseum Frontier projects | **44**: 1 champion, 25 top-25, 1 university, 1 public-good, 16 honorable mentions | `registers/colosseum_frontier_projects.csv`; [[colosseum/projects/00_Project_Index]] | Cross-ecosystem idea/winner patterns; not Lisbon eligibility evidence. |
| Protocol/standard watchlist | **24** rows; 12 protocol notes + index | `registers/open_source_protocol_watchlist.csv`; [[protocols/00_Protocol_Index]] | Future build surfaces; current sponsor match must be revalidated. |
| Events | **3** | `registers/events.csv`; event notes | Cannes, New York, Lisbon context. |
| Prize rows | **26** | `registers/prizes.csv` | Historical/current prize facts at recorded access dates; current Lisbon snapshot/master outranks older rows. |
| Track/theme rows | **10** | `registers/tracks.csv` | Supporting track taxonomy, not the final Lisbon claim ledger. |
| Winner-reasoning rows | **25** | `registers/winner_reasoning.csv` | Inferred judge patterns; inference is not official rationale. |

### Data catalog and authority

| data | rows | key / identity | authority and update rule |
|---|---:|---|---|
| `registers/projects.csv` | 30 | `project_id` unique | Stable reference-project catalog; update from official project pages. |
| `registers/project_repos_teams.csv` | 30 | `project_id` unique | Repo/demo/team mapping; all project IDs currently match `projects.csv`. |
| `registers/colosseum_frontier_projects.csv` | 44 | `project_id` unique | Official award/project extraction with explicit confidence. |
| `registers/colosseum_frontier_repo_audit.csv` | 12 | repository/source row | Setup/license/reuse audit of selected Colosseum projects. Recheck HEAD/license before reuse. |
| `registers/colosseum_frontier_tracks_sponsors.csv` | 17 | sponsor + track/prize | Colosseum ecosystem context only; repeated source URLs are allowed. |
| `registers/events.csv` | 3 | event unique | Event dates/location/pool snapshots; recheck future event facts. |
| `registers/lisbon_idea_opportunities.csv` | 8 | opportunity unique | Early idea board; canonical masters/scorecard override later decisions. |
| `registers/open_source_protocol_watchlist.csv` | 24 | `protocol_or_standard` unique | Weekly radar; obey `access_date` and `recheck_by`. |
| `registers/open_source_repo_audit.csv` | 9 | `repo` unique | Setup/license/reuse audit; recheck repository HEAD/license before use. |
| `registers/prizes.csv` | 26 | event + sponsor + track + placement | Supporting historical ledger. Latest supplied Lisbon snapshot/current official page wins conflicts. |
| `registers/tracks.csv` | 10 | event + track/theme | Supporting taxonomy; not the current Lisbon eligibility decision. |
| `registers/track_validation.csv` | 9 | sponsor | **Stale supporting register:** accessed 2026-06-22; 8 unresolved; recheck 2026-07-21. Do not use as current track truth. |
| `registers/winner_reasoning.csv` | 25 | event + project | Explicitly inferred winner/finalist reasoning; never present as judge testimony. |
| `registers/source_freshness.csv` | 153 | URL + claim/recheck reason | Repeated URLs are intentional when one source supports multiple claims/recheck reasons. No row is due as of 2026-07-16. |
| `sources/alphadawg-lisbon-2026-source-ledger.csv` | 83 | `source_id` | Detailed AlphaDawg/Lisbon claim evidence. |
| `sources/lisbon-dual-project-2026-source-ledger.csv` | 29 | `source_id` | Detailed portfolio/Project B claim evidence. |

The vault also contains 42 strategy notes, 14 prompts, three task notes, three synthesis notes, two templates, one review note, and one proof-pack index. They interpret or route the registers; they do not silently override the source order.

## 6. Data Quality Findings

| finding | state | action |
|---|---|---|
| Project IDs and mappings | `PASS` | 30 unique project IDs; every `projects.csv` row maps to `project_repos_teams.csv`; no orphan mapping. |
| CSV parsing | `PASS` | All 16 register CSVs parse. Preserve headers and quoting. |
| Source freshness | `PASS_WITH_CAVEAT` | 153 rows; repeated URLs represent multiple claims, not duplicate entities. Treat URL + claim/recheck reason as identity. |
| Team identities | `UNRESOLVED` | All 30 reference-project team-member fields are unresolved. Do not infer names from handles/repos. |
| Lisbon track validation | `PASS_WITH_RECHECK` | [[strategy/dual-project/02_Lisbon_Live_Track_Ledger]] and `registers/lisbon_2026_track_ledger.csv` contain the 2026-07-23 23-track snapshot; recheck at H0/submission. |
| World/The Graph | `CONFIRMED_RELEASED / NOT_SELECTED` | Tracks and payouts are published. Their primitives currently fail the selected builds' removal tests. |
| Reference implementation claims | `UNVERIFIED` by default | A showcase description is not runtime/repository proof. |
| Product evidence separation | `MANDATORY` | AlphaDawg and Project B use different repos, baselines, accounts, wallets, transactions, proof folders, and claims. |

## 7. Optimized Operating System

### One source of truth per decision

| question | read this first |
|---|---|
| What should AlphaDawg build and claim? | [[strategy/alphadawg/ALPHADAWG_LISBON_MASTER]] |
| What should Project B build? | [[strategy/dual-project/PROJECT_B_LISBON_MASTER]] |
| What are the latest supplied Lisbon tracks/caps? | [[strategy/dual-project/02_Lisbon_Live_Track_Ledger]] plus current official page/snapshot. |
| Can the two lanes share anything? | [[strategy/dual-project/01_Provenance_and_Team_Separation]] |
| Why were Project B ideas ranked this way? | [[strategy/dual-project/06_Project_B_Scorecard_and_Shortlist]] |
| What do we do at H0? | [[strategy/alphadawg/ALPHADAWG_LISBON_MASTER#19.12 One-page printable H0 checklist|AlphaDawg H0 card]] or [[strategy/dual-project/PROJECT_B_LISBON_MASTER#14.16 Printable one-page H0 checklist|Project B H0 card]], then the matching `/goal` prompt. |
| Where are owners, access, failures, live ledgers, and rehearsals? | [[strategy/alphadawg/ALPHADAWG_LISBON_MASTER#19. Operator Appendices — Ownership, Data, Failure, And Proof|AlphaDawg operator appendices]] or [[strategy/dual-project/PROJECT_B_LISBON_MASTER#14. Beginner-Executable Operations Annex|Project B operations annex]]. |

### Value filter

| lane | user loss | value that must be visible | judge proof |
|---|---|---|---|
| AlphaDawg | Placeholder agents do not control execution; buyers cannot verify delivery; creator earnings can be reconstructed incorrectly. | A creator-owned version changes the real worker; one paid buyer job yields one final commission; tamper/replay yields no second value. | Version and intent hashes, live 0G/ENS IDs, one job/effect/commission/receipt, zero unauthorized or duplicate effect. |
| Project B | A forged, ambiguous, or duplicated obligation can trigger a bad payment. | Two separately verified agents challenge the obligation; deterministic policy and a human allow exactly one bounded settlement or a zero-effect refusal. | Attempted/blocked/paid atomic amounts, two 0G IDs and proof hashes, one Hedera transaction/readback, zero duplicate effect. |
| Demo infrastructure | Legacy processes and release skew can make a correct product fail on stage. | One recoverable release behaves identically across reset, restart, failure, and success. | Same Vercel/Railway SHA, migration and readiness green, two resets and two demos within four minutes. |

### Premortem coverage audit

| failure surface | status | controlling mechanism |
|---|---|---|
| User value and scope drift | `COVERED_NOT_RUN` | Value filter, sponsor removal test, optional-track cuts, four-minute outcome demo. |
| Team, provenance, license, eligibility, and H0 | `BLOCKED_EXTERNAL` | Written authority and official H0 evidence before product work. |
| Ownership, time, and capacity | `CONTROL_ADDED / UNASSIGNED` | Active sprint controller, named backup/cut authority, deadline/alarm, team WIP cap two. |
| Backend, authentication, data, and state invariants | `COVERED_NOT_RUN` | A1–A2 and B2–B3 foundation/kernel gates. |
| Agent, sponsor, signer, and spend authority | `COVERED_NOT_RUN` | Runtime validation, isolated signer, capped accounts, load-bearing live state. |
| Duplicate, replay, restart, timeout, and partial failure | `COVERED_NOT_RUN` | Deterministic IDs, persisted artifacts, reconciliation, zero-second-effect tests. |
| Crawbot/legacy cleanup, deployment, and demo recovery | `COVERED_NOT_RUN` | One worker, same-SHA deployment, readiness, reset, restart, two rehearsals. |
| Evidence, judging, and submission | `COVERED_NOT_RUN` | `PASS_RELEASE`, public readback, claim ledger, fresh clone, feature freeze. |

This covers the known controllable failure surfaces; it does not guarantee a win. New rules, access failures, provider outages, venue/network conditions, or judge decisions reopen the relevant gate.

### Compact sprint sequence

| lane | gated sequence | hard cut points |
|---|---|---|
| AlphaDawg | A0 H0–H2 authority → A1 H2–H6 foundation → A2 H6–H11 commerce → A3 H11–H17 worker/Crawbot cleanup/0G → A4 H17–H21 ENS → A5 H21–H25 one optional track → A6 H25–H31 E2E/demo → A7 H31–H36 release. | A1 red freezes sponsor work; A2/A3 red stops; A5 red drops the track; H31 freezes features. |
| Project B | B0 H0–H1 live probes → B1 H1–H3 select → B2 H3–H6 foundation → B3 H6–H10 refusal kernel → B4 H10–H16 two 0G agents → B5 H16–H22 signer/Hedera → B6 H22–H27 recovery → B7 H27–H31 demo → B8 H31–H36 release. | No green H3 candidate stops; one clean pivot only by H10; unsafe signer/exactly-once behavior stops; H31 freezes features. |

### Every work item uses one card

```text
NOW: current observed state
NEXT: smallest action that changes the state
USER WIN: measurable loss removed or outcome created
JUDGE PROOF: exact failure/success contrast and public identifiers
PASS WHEN: exact command/assertion/public identifier/evidence path
STOP IF: refusal, block-effect, drop-track, pivot, or stop-project condition
OWNER / BACKUP / CUT AUTHORITY: named people
DEADLINE / ALARM: gate time and escalation trigger
WIP: one current task; team-wide maximum two
PROJECT: alphadawg | project_b
```

### Optimization rules

1. Core before sponsor extensions; failure proof before polish.
2. One writer per file/module; security and submission auditors remain read-only.
3. One canonical intent/effect ID; prepare -> persist -> broadcast -> reconcile.
4. Models propose typed records; policy and explicit signer authorize effects.
5. No new abstraction until a second real implementation needs it.
6. No performance work before correctness, evidence, and a measured bottleneck.
7. No duplicated track facts: link the current ledger/master and record access date.
8. Every `PASS` stores command, exit code, observed assertion, commit, environment, evidence path, and live identifier.
9. Every red optional track is removed from code-path claims, README, demo, and submission.
10. Feature freeze protects testing, fresh clone, videos, forms, and two rehearsals.

## 8. Active Sprint/H-Gate Controller

| project | active sprint | status | owner / backup / cut authority | deadline / alarm | WIP | gate decision |
|---|---|---|---|---|---:|---|
| AlphaDawg | Pre-H0 → A0 | `BLOCKED_PRE_H0` | `UNASSIGNED` → remains blocked | H0, then H2; alarm on missing authority or baseline evidence | 1 | `WAIT_H0` |
| Project B | Pre-H0 → B0/B1 | `H0_LOCKED` | `UNASSIGNED` → remains blocked | H0, H1 probe evidence, H3 signed selection | 1 | `WAIT_H0` |

| project | user win | judge proof required | observed evidence now |
|---|---|---|---|
| AlphaDawg | Creator version changes execution; buyer receives verified work; creator gets one final commission. | Live 0G/ENS IDs, canonical receipt, tamper/replay zero-second-effect, two timed demos. | `NOT_RUN`; no Lisbon release SHA or live identifiers. |
| Project B | Forged obligation pays zero; valid obligation settles exactly once after two-agent challenge and human approval. | Two task-bound 0G proofs, one Hedera transaction/readback, attempted/blocked/paid amounts, two timed replays. | `NOT_RUN`; no repo, release SHA, or live identifiers by design. |

At every gate, replace these rows from observed evidence and record `BUILD`, `NARROW`, `DROP_TRACK`, `PIVOT_PROJECT`, or `STOP`. `UNASSIGNED`, a missed alarm, or missing evidence keeps the gate blocked. Do not raise readiness because code was written, a screen exists, or an SDK was imported.

## 9. Final Submission Gate

A project/track is claimable only when all are green:

- eligibility/provenance and event-window history;
- exact problem, agent necessity, deterministic authority, and non-goals;
- mandatory sponsor-native implementation is load-bearing;
- success, refusal/tamper, replay/restart, partial failure, and sponsor-unavailable tests;
- lint, typecheck, tests, build, secret/license/dependency scans;
- live public identifiers and independent readback;
- fresh private clone and two resettable demo replays;
- README architecture/setup/code pointers, addresses, forms, contacts, and compliant videos;
- claim ledger maps requirement -> commit/file -> test -> live evidence -> demo timestamp -> submission field.

Final decision is exactly `BUILD`, `NARROW`, or `STOP`. `NARROW` removes unproven claims; it never relabels partial evidence as success.
