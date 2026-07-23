---
title: AlphaDawg Continuity Gap and Bounty Map
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - project/continuity
status: superseded_research_only
updated: 2026-07-16
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
decision: BUILD_NARROW
---

# AlphaDawg Continuity Gap And Bounty Map

> [!warning] Superseded decision, retained audit
> The repository findings remain useful, but the Verifiable Execution Firewall and Uniswap-first decision are superseded by [[strategy/alphadawg/ALPHADAWG_LISBON_MASTER|AlphaDawg Lisbon 2026 Master Plan]]. The controlling product is now a creator-owned shared agent runtime with 0G + ENS Continuity and one conditional third partner.

## Decision

**BUILD / NARROW** a solo-builder Verifiable Execution Firewall:

`typed agent output -> real task-bound 0G verification -> deterministic policy -> optional Uniswap action -> linked receipt`

A one-byte mutation, missing proof, stale task, wrong provider, policy breach, timeout, or unknown route must create **zero signing and zero economic action**. Dynamic provider marketplace, multi-quote auction, broad A2A server, identity/reputation writes, Hedera settlement, and UI redesign are not in the committed core.

Fallback: strict 0G Compute/Private Computer verification + Storage readback + recovery/tamper harness, with no economic action claim.

## Immutable Baseline Audit

Repository: `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Cannes_2026`; clean at the immutable SHA on 2026-07-16.

| area | file / symbol evidence | classification | baseline fact / Lisbon gap |
|---|---|---|---|
| Product journey | `app/api/cycle/stream/[userId]/route.ts`; `src/agents/main-agent.ts::runCycle/commitCycle` | `PARTIAL` | User/Telegram cycle hires specialists, debates, approves, trades, then logs. Economic effects can precede aggregate proof checks. |
| Runtime topology | `src/config/agent-registry.ts::AGENT_REGISTRY`; OpenClaw/Fly assets | `WORKING` | Thirteen fixed service URLs and roles exist; runtime is coupled to compiled registry and per-agent deployments. |
| Discovery/routing | `src/agents/role-manifests.ts::ROLE_MANIFESTS/selectForRole` | `DISCONNECTED` | Reputation rotates only predefined names; database marketplace does not feed the main role path. |
| Marketplace onboarding | `app/api/marketplace/create/route.ts::USER_CREATED_ENDPOINT`; `app/api/marketplace/hire/route.ts` | `MOCK_OR_FALLBACK` | User agent stores `local://user-created` and fixed price; hire is a database relation, not service execution. |
| 0G inference | `src/og/inference.ts::sealedInference` | `FAIL_OPEN` | `ZG-Res-Key` may fall back to response ID; failed `processResponse` returns content with `teeVerified=false`. |
| 0G Storage | `src/og/storage.ts`; calls after action in `commitCycle` | `PARTIAL` | Real when configured, but best-effort/post-action and not a precondition for value movement. |
| 0G identity | `src/og/inft.ts`; `contracts/VaultMindAgent.sol` | `UNVERIFIED` | Inherited iNFT assets exist; they cannot count as Lisbon work and are outside the narrow delta. |
| Arc x402 | `src/payments/x402-client.ts`; `x402-server.ts`; `hire-specialist.ts::callSpecialist` | `WORKING` when configured | Fixed `$0.001` pay-per-call is inherited Cannes behavior; missing setup can fall back to ordinary fetch/no payment. |
| Hedera HCS | `src/hedera/hcs.ts::logCycle/logSwarmEvent` | `PARTIAL` | Real topic writes when configured; some callers treat failures as non-fatal. No commerce settlement. |
| Hedera HTS/Schedule | `src/hedera/hts.ts`; `scheduler.ts::scheduleNextHeartbeat` | `DISCONNECTED` | Token and scheduled heartbeat helpers exist, but no task-bound payment, Mirror reconciliation, or exactly-once ledger. |
| Execution | `src/execution/arc-swap.ts::executeArcSwap/executeNativeTransfer` | `FAIL_OPEN` | Router failure can become a native self-transfer reported as success; not Uniswap evidence. |
| Contracts | `contracts/MockSwapRouter.sol`; `AlphaDawgSwap.sol` | `MOCK_OR_FALLBACK` | Custom/mock-compatible paths cannot satisfy Uniswap API or Stack claims. |
| Decision safety | `src/agents/main-agent.ts::commitCycle` | `FAIL_OPEN` | Demo configuration can replace HOLD with BUY. New firewall must preserve refusal. |
| Persistence | `prisma/schema.prisma` | `MISSING` | No typed proof-policy/execution/receipt lifecycle; `(userId, cycleNumber)` is not unique. |
| Proof UI | `app/verify/page.tsx` stored proof helpers | `UNVERIFIED` | Cached `teeVerified` values are displayed without independent proof re-verification. |
| Tests/build | `package.json`; read-only verification | `PARTIAL` | Prior clean-clone TypeScript passed. Final shared-checkout recheck: lint fails 23 errors/28 warnings; test script absent; `npx tsc --noEmit` fails on stale ignored `.next/types` references to removed pre-event A2A/commerce routes; build/validator need environment. No generated-artifact cleanup was authorized. |
| Rights/license | Git history; absent root license file | `MISSING` | Two substantive human contributors; consent, license, changed-team and prize treatment unresolved. |

## Track-By-Track Fit

| track | eligibility | baseline cannot count | smallest meaningful Lisbon delta / planned modules | live proof | solo effort / cut rule |
|---|---|---|---|---|---|
| 0G Keep Building | `CONFIRMED_SHAPE`, rights-gated | Cannes inference/storage/iNFT IDs and prior deployments | Strict verifier and task binding in planned `src/og/verifier.ts`, additive policy/receipt seam, recovery, Storage readback | Fresh verified response + proof reference + Storage root; tamper blocks action | 12–16h; fallback keeps only this track |
| Uniswap Stack | `CONFIRMED_SHAPE`, form-blocked | Custom/mock/self-transfer execution | Reusable proof-gated policy/adapter in planned `src/uniswap/policy.ts`, `executor.ts`, tests/example | Real official stack/API path plus rejected invalid intent; public reusable code | 8–12h after 0G; cut all live execution if form/key/path unresolved |
| Sui existing app | `CONFIRMED_SHAPE`, not selected | No inherited Sui work exists | Deep Walrus+Seal proof-receipt migration or Move port | Before/after deployed demo and read/write/decrypt evidence | 14–22h; cut because it duplicates 0G storage and breaks solo critical path |
| 0G AI Product | `CONDITIONAL` regular category | Old dashboard and inference | Same strict firewall presented as product | Runnable link, addresses, <3-minute video | No extra build; cut claim without written admission |
| 0G Infrastructure | `CONDITIONAL` regular category | Internal schemas/docs alone | Named reusable exports + consumer example | Example imports and executes strict verifier | 3–5h packaging; cut before core evidence |
| Hedera Agentic | `CONDITIONAL` regular category | HCS/HTS/schedule baseline | Planned `settlement.ts` with prepared artifact, one Testnet transfer, Mirror finality, HCS hash | One external transaction under replay/restart | 5–8h only after H22; cut without written eligibility |
| Hedera Tokenization | `CONDITIONAL/CONTRADICTORY` | Inherited VMF token | New SDK-only lifecycle tied to outcome | New token/config/transfer/burn | 6–10h; reject for solo plan |
| Hedera No Solidity | `INELIGIBLE` absent ruling | Repo contains Solidity | None credible without whole-project ruling | Two native-service demo | Reject |
| Hedera Cross-Chain | `CONDITIONAL/BLOCKED` | Scheduled heartbeat | Schedule -> Axelar -> destination action | Full onchain path | 12–20h; reject |
| Uniswap API | `CONDITIONAL`, form-blocked | Any legacy router/self-transfer | API key, approval/quote/simulation/swap/status with exact route policy | Request ID + tx + final status | Same 8–12h path; cut claim on 404 form |
| 1inch Aqua | `INELIGIBLE` From Scratch | Entire AlphaDawg baseline | None | None | Reject |
| Sui new app | `INELIGIBLE` From Scratch | Entire baseline | None | None | Reject |
| ENS Creative / AI Agents / Continuity | Continuity track `CONFIRMED_SHAPE`; regular tracks conditional | No inherited ENS feature counts as Lisbon work | Current master plans identity, discovery, version, service and payout records bound to the shared runtime | Live write/resolve, manifest match, unauthorized update refusal, Sunday booth | Selected second partner through the $2,000 Continuity track; this file's old decision is superseded |
| The Graph / World | `PENDING` | Any prior-event assumptions | No precise delta until tracks publish | Unknown | Count $0; do not select |

## Six Delta Options

Scores are ordinal 1–5; higher is better. `risk` is reverse-scored: 5 means low regression/demo risk. No score is a win probability.

| option | eligibility | progress | sponsor inevitable | proof | feasible | reuse | risk | demo | adoption | overlap | total / 50 | decision |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Strict 0G verification + recovery | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 5 | 4 | 5 | **48** | BUILD core |
| Reusable proof-gated Uniswap policy adapter | 4 | 5 | 5 | 5 | 4 | 4 | 4 | 5 | 5 | 5 | **46** | BUILD after 0G |
| Open A2A provider commerce + dynamic quotes | 4 | 5 | 4 | 4 | 2 | 3 | 2 | 4 | 5 | 4 | **37** | DEFER; too wide solo |
| Exactly-once Hedera settlement/audit | 2 | 4 | 5 | 5 | 3 | 4 | 3 | 5 | 4 | 5 | **40** | CONDITIONAL H22 stretch |
| Deep Sui/Walrus/Seal port | 5 | 5 | 5 | 5 | 2 | 2 | 2 | 4 | 4 | 2 | **36** | CUT; credible but divergent |
| Production hardening only | 5 | 3 | 4 | 3 | 5 | 5 | 5 | 3 | 4 | 4 | **41** | Fallback only; must include live 0G proof |

## Portfolios And Ceilings

| posture | selected partners | confirmed Continuity ceiling | conditional one-placement ceiling | treatment |
|---|---|---:|---:|---|
| Protected core | 0G + ENS | $3,500 | $3,500 | Current master commitment: shared runtime, strict 0G, ENS identity/version, paid hire/commission. |
| All-Continuity maximum | 0G + ENS + Sui | $5,500 | $5,500 | Sui only when private package ownership/licensing is load-bearing. |
| Conditional commerce | 0G + ENS + Hedera | $3,500 | $6,500 | Hedera only after written regular-track admission and live settlement proof. |
| Trading continuity | 0G + ENS + Uniswap | $4,500 | $4,500 | Uniswap only for a trading-first reusable action adapter. |

Same-partner stacking remains theoretical and is excluded. Prize floor is always $0.

## Exact Event-Window Change Contract

All paths are `PLANNED`; none exists as Lisbon work.

```text
src/firewall/
  schemas.ts        typed task, output, proof policy, action intent, receipt
  state-machine.ts  explicit states, authorization, optimistic version
  receipt.ts        canonical hashes and evidence references
src/og/
  verifier.ts       real event-time independent verification
  storage.ts        verified receipt upload/readback
src/uniswap/
  policy.ts         chain/token/recipient/amount/slippage/deadline/spender rules
  executor.ts       route-safe official integration and status reconciliation
src/hedera/
  settlement.ts     optional prepared-artifact exactly-once transfer
  mirror.ts         optional public finality reconciliation
prisma/schema.prisma additive firewall records and unique effect keys
tests/               pure, database, recovery, live-gated, E2E
evidence/lisbon/     baseline, track matrix, receipts, redacted command output
```

No pre-event prototype file may be copied or cherry-picked. Re-author from current public docs after H0.

## Solo 36-Hour Backlog

| hours | work | hard gate |
|---|---|---|
| H0–H2 | Clock/rules, rights/license/team, partner rulings, clean SHA, credentials, spend cap, control docs | Stop product work if H0/rights gate fails |
| H2–H6 | Minimal records/state/policy/idempotency/database tests | Malformed/stale/replay/unauthorized cases fail |
| H6–H14 | Current 0G call + independent verification + task binding | Real valid proof passes; missing/false/wrong binding fails |
| H14–H18 | Storage receipt, readback, timeout/restart/tamper matrix | One-byte mutation creates no action authority |
| H18–H24 | Uniswap reusable policy adapter, exhaustive route handling, invalid-intent no-sign | Tests green; unknown route rejects |
| H24–H27 | Real supported sponsor path only if key/form/eligibility green | Request ID + transaction/status; otherwise cut live/API claim |
| H27–H30 | Optional Hedera prepared settlement only if written approval and 0G+Uniswap green twice | One Mirror-confirmed transfer under replay; otherwise cut |
| H30–H36 | Freeze, lint/typecheck/test/build, fresh clone, evidence, videos, two rehearsals | Each claimed track has code + test + live proof + demo moment |

Global cut order: Hedera -> packaging polish -> extra route -> marketplace/A2A -> UI. Never cut strict verification, refusal, policy, idempotency, provenance, or evidence.

## Final Read-Only Recheck — 2026-07-16

| command | result | treatment |
|---|---|---|
| `npm run lint` | FAIL — 23 errors, 28 warnings | Inherited baseline debt; no source edits authorized. |
| `npx tsc --noEmit` | FAIL — 10 `TS2307` errors from ignored `.next/types/validator.ts` paths for absent pre-event A2A/commerce routes | Shared checkout contains stale generated type references; source worktree remains clean. Do not delete/regenerate before separate authorization/H0. |
| `npm test` | FAIL — missing script | Inherited baseline gap. |

These failures are not Lisbon implementation results and do not change the immutable Git baseline.

## E2E Contract

- Happy: typed output -> verified 0G proof -> Storage readback -> policy-valid action -> route/status -> linked receipt.
- Tampered: mutate output/proof binding -> terminal rejection -> no approval, signature, request, payment, trade, or success score.
- Timeout/unavailable: durable retry/terminal state; same artifact reconciled; no regenerated economic action.
- Replay/restart: concurrent identical requests converge on one stored result and at most one external effect.
- Malformed intent: wrong chain/token/recipient/amount/slippage/deadline/spender/calldata rejected before signing.
- Fresh clone: project-selected package manager, lint, typecheck, tests, build, sponsor smokes, receipt verifier; inherited failures disclosed separately.

Implementation remains locked behind [[prompts/lisbon-dual-project/01_GOAL_AlphaDawg_Continuity_H0]].
