---
title: AlphaDawg A0 Live Authority and Clearance Evidence
aliases:
  - AlphaDawg A0 Evidence
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - gate/a0
  - evidence
status: conditional_local_build_authorized
updated: 2026-07-23
observed_at: 2026-07-23T17:34:29+01:00
start_authorized_at: 2026-07-23T18:06:32+01:00
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
implementation_branch: developer
decision: CONDITIONAL_GO_LOCAL_NO_EXTERNAL_EFFECTS
---

# AlphaDawg A0 Live Authority and Clearance Evidence

> [!warning] Decision
> `CONDITIONAL_GO_LOCAL_NO_EXTERNAL_EFFECTS`. At 2026-07-23 18:06:32 WEST the user explicitly confirmed that AlphaDawg may start under Continuity. This authorizes the clean `developer` worktree, local product files, deterministic checks, and local commits. It does not prove organizer eligibility, contributor license authority, sponsor access, spend approval, deployment approval, or any track claim. Pushes, deployments, signatures, transactions, spend, and promotion remain blocked until their rows pass.

## 1. Current authority

| field | evidence | state |
|---|---|---|
| Official event | ETHGlobal Lisbon 2026 official info and prize pages returned HTTP `200` on 2026-07-23. | `CONFIRMED` |
| Hacking start | Official schedule payload: event `6867`, slug `hacking-begins`, status `confirmed`, published `true`, `2026-07-24T20:00:00.000Z` = **2026-07-24 21:00 WEST**. | `CONFIRMED_FUTURE` |
| Submission deadline | Official schedule payload: event `6872`, slug `project-submissions-due`, `2026-07-26T08:00:00.000Z` = 09:00 WEST. | `CONFIRMED` |
| Continuity start authority | User statement in this thread at 2026-07-23 18:06:32 WEST: AlphaDawg may proceed now under Continuity. | `CONFIRMED_FOR_LOCAL_BUILD_BY_PROJECT_OWNER` |
| Organizer/workshop evidence | Presenter/role, exact workshop wording, durable reference, and explicit organizer scope remain absent. The ENS workshop photo proves workshop attendance/content only. | `MISSING_FOR_ELIGIBILITY_CLAIM` |
| Live dashboard open | No captured dashboard state saying “Hacking Begins” or equivalent. The supplied authenticated prize-page text proves prize access, not the official clock. | `MISSING_NONBLOCKING_FOR_LOCAL_BUILD` |

The official FAQ permits Continuity teams to build on an existing project and requires the expansion to occur at the hackathon. It does not prove that qualifying Lisbon implementation may begin before the published “Hacking Begins!” signal. Early implementation therefore remains fail-closed.

## 2. Official-source packet

| source | accessed | response evidence | controls |
|---|---|---|---|
| [Lisbon info](https://ethglobal.com/events/lisbon2026/info) | 2026-07-23 | HTTP `200`; SHA-256 `5662400bab26a00c8aa6e2fff264d8677ea3145978560f00333dadb23cad678b` | Event identity and schedule payload. |
| [Lisbon prizes](https://ethglobal.com/events/lisbon2026/prizes) | 2026-07-23 | HTTP `200`; SHA-256 `081ceb4421b94d37ec28aec66afb2d67fe330fd97284431eb2c712dc1ebaa3f0` | 0G, ENS, and Sui requirements/caps. |
| [ETHGlobal rules](https://ethglobal.com/rules) | 2026-07-23 | HTTP `200`; SHA-256 `5f2ebe4095624c4e6f6e21acdcf4eca79a7eead68ef63b5bfa66394d8e984433`; Continuity requires disclosed prior work, substantive event-window additions, open-source new work, and version-control history. | Eligibility and provenance. |
| [Alpha Dawg Cannes showcase](https://ethglobal.com/showcase/alpha-dawg-fh6vm) | 2026-07-23 | Official page identifies ETHGlobal Cannes 2026, prior product description, source/demo links, and prior 0G/Hedera awards. | Public prior-state marker; archive again at A0. |
| User-supplied authenticated prize snapshot | 2026-07-23 | `/Users/barroca888/.codex/attachments/e5b01798-53ec-4e2b-a5e2-ed3dc05568cf/pasted-text.txt` | Corroborates eight current partners/prizes; not start authority. |
| User-supplied ENS workshop photo | 2026-07-23 | Conversation attachment; slide shows ENSv2 registry-per-name hierarchy. | Workshop context only; not deployment data or authorization. |

Raw HTML is not stored in this Markdown/CSV-only vault. Response hashes identify the exact inspected payloads. Re-fetch and record new hashes at A0 and A7.

## 3. Track admission snapshot

| track | current official requirement | first-slot cap | A0 state |
|---|---|---:|---|
| 0G Keep Building | Existing 0G project; meaningful Lisbon-window progress; public repo/setup; live/runnable demo; under-three-minute video; prior-state link; dated changelog; “What's next.” | $1,500 | `CONFIRMED_TRACK_CONDITIONAL_BUILD` |
| ENS Continuity | Meaningful new non-cosmetic ENS capability built during the hackathon; functional non-hardcoded demo; video/live link; Sunday-morning booth presentation. | $2,000 | `CONFIRMED_TRACK_CONDITIONAL_BUILD` |
| Sui Existing App | Existing product; core Sui-stack integration during the hackathon; working integration demo. | $2,000 | `CONDITIONAL_OPTIONAL_A5` |

Track existence is not qualification. Keep every claim `research_only_not_promotable` until live implementation evidence and the final submission audit pass.

## 4. Immutable baseline evidence

Observed read-only on 2026-07-23:

| field | value | state |
|---|---|---|
| Product repository | `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Cannes_2026` | `CONFIRMED` |
| Origin | `https://github.com/elbarroca/ETH_Global_Cannes_2026.git` | `CONFIRMED_LOCAL_CONFIG` |
| Current branch | `feat/lisbon-agent-commerce` | `CONFIRMED_PRE_EVENT_ONLY` |
| `HEAD` | `bfa7bd37c573e2e49525d965f7f937210e170d72` | `CONFIRMED` |
| `HEAD^{tree}` | `f39cc7e865d8e3ffaa02ea3e2397cee1bbed8c0a` | `CONFIRMED` |
| Local `origin/main` | `bfa7bd37c573e2e49525d965f7f937210e170d72` | `CONFIRMED_LOCAL_REF`; fetch again at A0 |
| `main...HEAD` | `0 0` | `CONFIRMED` |
| Prior showcase | `https://ethglobal.com/showcase/alpha-dawg-fh6vm` | `CONFIRMED_PUBLIC`; capture immutable export/hash at A0 |
| Worktree | clean; one registered product worktree | `CONFIRMED` |
| `package.json` SHA-256 | `7c946dbe078b8260497298904a9950479359cbe2b3a263ea4f3d86a881f3719e` | `CONFIRMED` |
| `package-lock.json` SHA-256 | `b4a1aed30a52a74d1b4396da9f1d6535a5e475da1b40a99a6c744aae1a8c6b33` | `CONFIRMED` |
| Root license | No root `LICENSE*` found. | `MISSING_BLOCKING` |
| `developer` branch/worktree | `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Cannes_2026-lisbon`, created from the immutable baseline at 2026-07-23 18:06 WEST. | `CONFIRMED_CREATED_CLEAN` |

At A0, repeat `git fetch`, SHA/tree/lock hashes, remote visibility, branch census, worktree census, and secret-safe dirty-state checks before creating anything.

## 5. Fatal clearance matrix

| gate | required evidence | current state | smallest next action |
|---|---|---|---|
| Local start authority | Explicit project-owner direction to proceed under Continuity. | `CONFIRMED_LOCAL_ONLY` | Preserve this thread reference; still capture organizer/dashboard evidence before eligibility promotion. |
| Contributor rights | Dated former-contributor consent naming repo, baseline, reuse, modification, public submission, attribution, license, and prize treatment. | `MISSING` | Obtain the completed consent from [[16_Pre_Event_Clearance_Packet]]. Store private proof outside Git; record only a redacted path/hash. |
| OSI license | Both Cannes contributors authorize the same license; root license committed after A0. | `MISSING` | Record written license agreement; stage the root license only after A0. |
| Team | Accepted/staked Lisbon participants, changed-team treatment, roles, public-contact consent. | `MISSING` | Capture authenticated team dashboard and team sheet. |
| Continuity approval | Written ETHGlobal answer for changed-team use of the Cannes baseline and partner-prize treatment. | `MISSING` | Send the prepared organizer message and retain the complete answer. |
| Owners | HO, implementation owner, release owner, backup, booth presenter, and Sui cut authority. | `MISSING` | Fill the owner ledger below with named humans. |
| 0G access | Secret-manager presence, public account/provider/network, bounded balance, owner, and approved cap. | `NOT_SET_OR_UNPROVEN` | Record redacted readiness; run no smoke before A0. |
| ENS access | Controlled parent namespace, writer wallet/RPC/test funds, owner, and approved cap. | `NOT_SET_OR_UNPROVEN` | Record public identifiers and redacted readiness. |
| Sui access | Testnet wallet/faucet, RPC/gRPC, Walrus/Seal prerequisites, owner, and approved cap. | `OPTIONAL_NOT_SET_OR_UNPROVEN` | Prepare only; may not block core A0 if Sui is pre-cut. |
| Deployment access | Vercel, managed PostgreSQL, Railway, public URLs, owners. | `NOT_SET_OR_UNPROVEN` | Record provider/project names and owners without secrets. |
| Spend authorization | Explicit testnet-only caps per selected network; approver and timestamp. | `MISSING` | Complete the cap ledger; blank means zero authorization. |

## 6. Owner and cap ledger

Do not infer names or amounts. Blank rows remain blocking.

| responsibility | named owner | backup | state |
|---|---|---|---|
| Hackathon orchestrator / cut authority |  |  | `NOT_SET` |
| Product implementation |  |  | `NOT_SET` |
| Release/deployment |  |  | `NOT_SET` |
| 0G integration/account |  |  | `NOT_SET` |
| ENS namespace/writer |  |  | `NOT_SET` |
| Sui admit/cut decision |  |  | `NOT_SET` |
| Sunday ENS booth presenter |  |  | `NOT_SET` |

| network/service | approved maximum | account/project owner | approver/time | state |
|---|---:|---|---|---|
| 0G test environment |  |  |  | `NOT_APPROVED` |
| ENS test network + RPC |  |  |  | `NOT_APPROVED` |
| Sui Testnet/Walrus/Seal |  |  |  | `NOT_APPROVED_OPTIONAL` |
| Vercel/PostgreSQL/Railway |  |  |  | `NOT_APPROVED` |

Mainnet value, unbounded API use, and unstated spend are prohibited.

### Redacted access inventory from the immutable baseline

Variable names prove configuration surface only; they do not prove a secret, funded account, or usable integration exists.

| lane | existing names | current evidence state |
|---|---|---|
| Shared app/database | `DATABASE_URL`, `DIRECT_URL`, `SERVER_ENCRYPTION_KEY`, `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `APP_URL` | Names documented; ownership, secret-manager presence, target projects, expiry, and smoke are unproven. |
| 0G | `OG_RPC_URL`, `OG_PRIVATE_KEY`, `OG_PROVIDER_ADDRESS`, `OG_STORAGE_INDEXER`, `OG_FLOW_CONTRACT`, `NEXT_PUBLIC_OG_PROVIDER_ADDRESS`, `NEXT_PUBLIC_OG_EXPLORER_URL` | Names documented; account, provider, network, balance/cap, and live smoke are unproven. |
| ENS | No ENS namespace, resolver, writer, or network variables exist in the baseline template. | `MISSING`; A4 configuration contract must be added after A0. |
| Sui | No direct Sui, Walrus, or Seal variables exist in the baseline template. | `MISSING_OPTIONAL`; do not add unless A5 is admitted. |
| OpenClaw | Runtime reads `OPENCLAW_GATEWAY_PORT` and `OPENCLAW_GATEWAY_TOKEN`, but the baseline template documents only `OPENCLAW_WORKSPACE`. | `INCOMPLETE_SECURITY_BLOCKER`; A1/A3 must reconcile and fail closed. |
| Legacy value rails | Hedera, Arc, Circle, x402, and mnemonic/key names exist. | Legacy only; no Lisbon spend authority and no protected-core claim. Keep isolated. |

The read-only inventory also found runtime environment names absent from `.env.example`, including `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_GATEWAY_PORT`, `ARC_DEPLOYER_PRIVATE_KEY`, `HEDERA_JSON_RPC_URL`, and several data-provider keys. A1 must make required/optional status explicit and reject missing required configuration without logging values.

## 7. A0 transition procedure

Local A0 control work may now proceed. Before external effects or promotion:

1. Re-fetch official info, prizes, and rules; record HTTP status, accessed time, and hashes.
2. Archive the live start signal and redacted rights/team/access/cap evidence references.
3. Re-run the full baseline and remote census.
4. Verify the existing single `developer` event-window worktree still matches the immutable SHA and has no unrelated changes.
5. Copy [[17_Kickoff_H0_Runbook]] into `docs/lisbon/` and create the control/evidence files before feature code.
6. Commit the A0 control packet atomically; then and only then admit A1 and one disposable P0 probe.

## 8. Independent pre-A0 code-execution audit

A read-only reviewer inspected the immutable product checkout without installing, building, formatting, or touching external state.

| severity | finding | post-A0 gate |
|---|---|---|
| Critical | Deposit, withdraw, configure, trade, cycle-run, and cycle-stream routes trust caller or path `userId` without authenticated wallet/session ownership. | A2 must derive identity server-side; forged/cross-user calls produce zero mutation. |
| Critical | Withdrawal can burn shares and decrement database balance after Circle transfer failure. | Quarantine from the Lisbon path or implement a fail-closed pending/confirmed withdrawal state before release. |
| Critical | Arc swap failure falls back to a self-transfer and returns `success: true`. | Remove from authoritative success/evidence paths; a failed swap stays failed. |
| Critical | Public Naryo ingestion accepts arbitrary JSON without broadcaster authentication or chain re-verification. | Exclude it from proof or authenticate and independently verify every referenced event. |
| Critical | Existing 0G inference verification is non-fatal and Storage readback disables proof verification. | A3 must replace both; invalid/missing/tampered proof yields no usable output. |
| Important | `validate` performs real sponsor transactions; local tests and live smokes are not separated. | A1 creates deterministic local checks and explicit opt-in capped live smokes. |
| Important | `migrate`, `setup:gateway`, and `validate:x402` reference missing scripts; `test` and `typecheck` scripts are absent. | A1 removes/restores dead scripts and adds runnable test/typecheck commands. |
| Important | Prisma has no migration history and uses `db push`; database URL construction is malformed when missing or lacking a query string. | A1 adds replayable migrations and strict URL/env validation. |
| Important | OpenClaw gateway may run without authentication when its token is unset; no real Crawbot integration exists. | A3 isolates OpenClaw from the critical path and fails closed if any retained gateway lacks auth. Do not invent Crawbot removal evidence. |
| Track gap | ENS has no implementation; Sui has no direct application surface. | A4 and optional A5 remain entirely unproven. |

Safe post-A0 local sequence, using the repository's actual npm lockfile:

```bash
git status --short --branch
git rev-parse HEAD
npm ci --legacy-peer-deps
npx prisma validate
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

These commands are not read-only: install, Prisma generation, TypeScript incrementals, and build tools may write local outputs. Run them only in the authorized `developer` worktree. `npm run validate`, database push/setup, deploy, mint, storage, sponsor, Hardhat, Fly, Circle, Telegram, and Naryo commands require separate external-effect classification, credentials, and explicit testnet spend authorization.

## 9. One human reply to finish A0

Return references and public-safe status only. Do not paste keys, tokens, private consent text, or personal data into chat or Git.

```text
A0_REPLY
workshop_presenter_and_role:
workshop_exact_start_statement:
workshop_time_west_and_reference:
former_contributor_consent_reference_and_hash:
agreed_osi_license:
lisbon_team_dashboard_reference:
changed_team_continuity_approval_reference:
hackathon_orchestrator:
implementation_owner:
release_owner:
backup_owner:
ens_booth_presenter:
sui_cut_authority:
0g_access: SET | NOT_SET | BLOCKED
ens_namespace_and_writer_access: SET | NOT_SET | BLOCKED
sui_access: SET | NOT_SET | BLOCKED | CUT
database_vercel_railway_access: SET | NOT_SET | BLOCKED
0g_testnet_total_cap_and_approver:
ens_testnet_total_cap_and_approver:
sui_testnet_total_cap_and_approver: CAP | CUT
hosting_total_cap_and_approver:
signed_decision: BUILD | STOP_PROJECT
```

`BUILD` is invalid while any fatal field is blank, `NOT_SET`, `BLOCKED`, or unsupported by its referenced evidence.

Current decision: **`CONDITIONAL_GO_LOCAL_NO_EXTERNAL_EFFECTS`**. A1/A2 local implementation may proceed; external effects and track promotion cannot.
