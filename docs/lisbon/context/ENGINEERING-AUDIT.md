---
title: AlphaDawg Current Engineering Audit
aliases:
  - AlphaDawg Cannes Baseline Engineering Audit
tags:
  - alphadawg
  - engineering/audit
  - ethglobal/lisbon-2026
status: baseline_verified_with_failures
updated: 2026-07-16
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
repository: /tmp/ETH_Global_Cannes_2026-019f6a69
---

# AlphaDawg Current Engineering Audit

> [!important] Baseline verdict
> Local `main`, `origin/main`, a fresh `git ls-remote`, and the approved Cannes baseline all resolve to `bfa7bd37c573e2e49525d965f7f937210e170d72`. The audited checkout `/tmp/ETH_Global_Cannes_2026-019f6a69` is clean. This is a capable Cannes demo, but it is not an open, fail-closed commerce system and its inherited quality suite is not green.

## Repository And Rights

| item | evidence | result |
|---|---|---|
| Source | `origin=https://github.com/elbarroca/ETH_Global_Cannes_2026.git` | Confirmed. |
| Branch | `main...origin/main` at the baseline SHA | Clean; no Lisbon product delta exists. No Lisbon feature branch was created because this goal authorizes research only. |
| Contributors | 148 commits: Barroca 134, Ehtesham 14 | Two-contributor rights gate; consent is not recorded. |
| License | No `LICENSE*` or `COPYING*` file | Publicly visible is not open source; Continuity reuse remains blocked. |
| Package manager | `package-lock.json`; package scripts use npm/npx | Use `npm ci` and npm equivalents, despite the generic sprint prompt naming pnpm. |
| Core versions | Node >=22, Next 16.2.2, React 19.2.4, TypeScript 5.9.3 locked, Prisma 6.19.3, Hedera SDK `^2.69.0` / 2.81.0 locked, 0G broker 0.7.4 | Pin exact versions during the sprint; replace package wildcards with deliberate versions. |

## Current Architecture

```text
user / Telegram / dashboard
  -> main cycle orchestration
  -> static role manifests select static registry agents
  -> Arc x402 specialist HTTP calls
  -> specialist-owned data fetch + 0G sealed inference
  -> Alpha / Risk / Executor debate
  -> approval state
  -> Arc custom/mock-compatible execution
  -> Prisma + HCS + 0G Storage + UI evidence
```

The Prisma marketplace, static runtime registry, and OpenClaw/Fly configuration are overlapping surfaces rather than one commerce lifecycle.

## Actual Baseline End-To-End Trace

1. The unauthenticated SSE cycle route accepts the user goal and calls `runCycle` (`app/api/cycle/stream/[userId]/route.ts`).
2. `src/agents/main-agent.ts` selects fixed-role agents, hires fixed specialists through Arc x402, and runs 0G inference.
3. Payment occurs before delivery acceptance. `src/agents/hire-specialist.ts` and `src/agents/fly-agent-server.ts` can turn HTTP/inference failures into fallback HOLD records rather than failing a commerce lifecycle.
4. `commitCycle` can replace the Executor's outcome with a BUY-oriented demo decision, then trades from action/percentage/hot-wallet conditions alone.
5. Only after trading does the cycle attempt 0G Storage and HCS writes; both are non-fatal.
6. Aggregate proof degradation is calculated after economic effects.
7. Prisma stores cached identifiers and the UI renders them. `app/verify/page.tsx` trusts stored `teeVerified` values instead of re-verifying the selected proof.

Therefore the Cannes path does not satisfy the Lisbon invariant `tampered proof -> no payment and no trade`.

## File-And-Symbol Evidence

| finding | file / symbol | observed baseline behavior | Lisbon consequence |
|---|---|---|---|
| Static runtime directory | `src/config/agent-registry.ts` — `AGENT_REGISTRY`, `getAgentUrl` | Thirteen named agents and fixed role/URL/price records are compiled into source. | External provider discovery must bypass source edits. |
| Fixed candidate pools | `src/agents/role-manifests.ts` — `ROLE_MANIFESTS`, `selectForRole` | Alpha/Risk/Executor choose only predefined specialists. | New directory results must become callable candidates by capability. |
| Placeholder onboarding | `app/api/marketplace/create/route.ts` — `USER_CREATED_ENDPOINT`, `POST` | Create Agent stores `local://user-created` and `$0.001`. | Require a reachable verified Agent Card before activation. |
| Database-only hire | `app/api/marketplace/hire/route.ts` — `POST` | Hire upserts `UserHiredAgent`; it does not negotiate, call, validate, or settle. | Replace the claim with a persisted task/quote/award/delivery flow. |
| Disconnected runtime marketplace | `src/marketplace/registry.ts` — `loadRegistry`, `registerBuiltins`, `hireFromMarketplace` | Prisma entries coexist with built-in auto-registration; the main role flow still depends on static names. | One `AgentDirectory` interface must own discovery. |
| Fixed price/task semantics | `src/agents/hire-specialist.ts` — `SPECIALIST_PRICE`, `callSpecialist`; `src/agents/fly-agent-server.ts` — task handler | `$0.001` and fixed identity-specific data/prompt handlers dominate; the leaf replaces caller intent with its own market-data prompt. | Add typed task/RFQ and signed variable-price quotes. |
| Shared provider root | `src/config/wallets.ts` — mnemonic derivation helpers | Specialist accounts derive from one application mnemonic unless overridden. | External providers need independent signers and settlement accounts. |
| 0G result verification is non-fatal | `src/og/inference.ts` — `sealedInference` | `ZG-Res-Key` falls back to ordinary `data.id`; `processResponse` failure logs a warning and returns `teeVerified=false` with content. | Commerce validation must require a real proof key and reject unverified delivery before any economic effect. |
| Proof propagation is inconsistent | `src/agents/main-agent.ts`, `src/agents/fly-agent-server.ts` | Some remote/flattened records lose or default verification metadata. | Carry task/output/proof bindings end to end. |
| Marketplace reputation is local | `src/marketplace/reputation.ts` — `recordRating`, `updateSpecialistReputation` | Prisma ELO can persist even when HCS stamping is unavailable. | Treat current ELO as legacy/local; portable feedback is optional after core. |
| Hedera is audit/token/schedule infrastructure | `src/hedera/hcs.ts`, `hts.ts`, `scheduler.ts` | HCS, HTS, and scheduled HCS behavior exist, but no commerce `TransferTransaction`, quote settlement, Mirror payment finality, or exactly-once ledger exists. | New exactly-once payment must have its own idempotent adapter and Mirror proof. |
| Arc x402 is real legacy behavior | `src/payments/x402-client.ts`, `x402-server.ts`, `src/agents/fly-agent-server.ts` | Built-in specialists use fixed-price Arc pay-per-call when configured; missing seller configuration disables the paywall. | Preserve regression path, add replay assertions, and disclose it as Cannes work rather than Lisbon evidence. |
| Execution can report a non-swap transaction | `src/execution/arc-swap.ts` — `executeArcSwap`, `executeNativeTransfer` | Router failure falls back to a native self-transfer and can return success. | Exclude this path from Lisbon evidence; Uniswap must be a real API execution. |
| Mock-compatible contracts remain | `contracts/MockSwapRouter.sol`, `contracts/AlphaDawgSwap.sol` | Local/custom AMM behavior is not Uniswap API proof. | No mock, fork where disallowed, or mere tx hash can satisfy Uniswap. |
| Forced outcome risk | `src/agents/main-agent.ts` — `commitCycle` decision post-processing | A configured demo path can replace the Executor's HOLD with BUY before execution. | Commerce output is only a proposal; policy may reject and must never force BUY. |
| No commerce schema | `prisma/schema.prisma` | No typed task, quote, award, delivery, settlement, execution, or append-only event models exist. | Add a minimal optimistic, idempotent lifecycle; do not create another registry. |
| Weak cross-process idempotency | `src/agents/main-agent.ts` — process-local cycle guard; `prisma/schema.prisma` — `Cycle` indexes | The guard explicitly does not cover multi-process races; `(userId, cycleNumber)` is indexed, not unique. | Persist unique economic keys and optimistic transitions. |
| Approval retry gap | `app/api/cycle/approve/[pendingId]/route.ts` | Pending approval resolves before commit, so a failed commit cannot be safely retried. | Do not reuse this lifecycle for commerce settlement. |
| Boundary validation gaps | `app/api/onboard/route.ts`, `app/api/deposit/route.ts`, `src/marketplace/registry.ts` | Onboarding accepts absent/`mock` signatures; deposit trusts caller amount/optional tx hash; provider endpoint registration lacks SSRF validation. | New commerce boundaries must be independently authenticated and runtime-validated. |
| Misleading proof UI | `app/verify/page.tsx` — stored proof helpers | UI trusts cached booleans and its specialist lookup can inherit the first hire's verification state. | Re-verify the selected receipt and show failure honestly. |
| No migration/RLS history | `prisma/schema.prisma`, absent migrations | Twelve Prisma models exist without repository migration or RLS policy files. | Add one explicit event-window migration and fresh-clone database path. |
| Missing test contract | `package.json` | No `test` script exists. | Add deterministic unit/E2E tests at kickoff. |
| Validator script drift | `package.json`, `tsconfig.json` | `migrate`, `setup:gateway`, and `validate:x402` point to absent files; `scripts/` is excluded from `tsc`. | Repair only selected sprint verification surfaces and typecheck critical scripts directly. |

## Real, Conditional, And Non-Evidence Paths

| classification | baseline surfaces |
|---|---|
| Real when configured | 0G Compute and Storage calls, Arc x402 requests, Hedera HCS/HTS/schedule helpers, Prisma persistence, UI/API flows. |
| Conditional / fail-open | 0G content returned with `teeVerified=false`; best-effort HCS/reputation logging; optional x402 configuration; local fallbacks. |
| Not Lisbon sponsor evidence | `local://user-created`, database-only hire, fixed-price metadata, mock router, native self-transfer, inherited Cannes transaction/proof IDs, comments/README claims without live reproduction. |

## Read-Only Live Reachability Snapshot

Observed 2026-07-16; reachability is not qualification:

- All 13 committed `vm-*.fly.dev/healthz` endpoints returned HTTP 200.
- Deployed bytecode exists for the committed 0G iNFT and both configured Arc router addresses.
- Committed Hedera topic `0.0.8497439`, VMF token `0.0.8498202`, and audit contract were reachable; the topic's latest observed sequence was 9311.
- `https://cannes2026.railway.app` currently serves a Railway API splash, not a verified AlphaDawg dashboard.

No x402 payment, 0G proof qualification, Hedera commerce settlement, or Uniswap API execution was inferred from those checks.

## Baseline Verification Snapshot

Run 2026-07-16 from the clean baseline after `npm ci`:

| command | result | interpretation |
|---|---|---|
| `npm ci` | PASS | 2,129 packages installed; npm reported 98 vulnerabilities: 20 low, 54 moderate, 23 high, 1 critical. Production dependency audit (`--omit=dev`) reports 73: 11 low, 41 moderate, 20 high, 1 critical. No automatic fix applied. |
| `npm run lint` | **FAIL** | 23 errors and 28 warnings, primarily React hook/purity rules, explicit `any`, and CommonJS config linting. |
| `npx tsc --noEmit` | PASS | Application TypeScript passes; `scripts/` is excluded and therefore not covered. |
| `npm test` | **FAIL** | Missing `test` script. |
| `npm run validate` | **FAIL** | 8 passed, 14 failed, 6 skipped; credentials/database/encryption are absent. |
| `npm run build` | **FAIL** | Compilation/typecheck passed, then prerender failed on missing valid `DATABASE_URL` and Dynamic environment ID. |

These are inherited baseline facts. Do not label Lisbon work complete until the required post-change suite is green in an approved, redacted environment.

## Engineering Boundary

- Keep the cycle engine, Arc x402 path, existing 0G/Hedera adapters, Prisma app, and dashboard intact behind compatibility seams.
- Add one commerce vertical rather than rewriting the repository or inventing a monorepo.
- New sponsor-critical code must be separable by path, commit, test, changelog row, and evidence row.
- No baseline defect may be silently attributed to Lisbon. Fix only defects that block the chosen vertical or required verification.

## Current Worktree State

On 2026-07-16 the user directed that no product code exist before the hackathon. The uncommitted pre-event implementation was removed, including generated build artifacts, and the product checkout was verified clean at the approved baseline SHA. Local `main` and `feat/lisbon-agent-commerce` are `0/0` commits apart. Nothing from the pre-event prototype was committed, pushed, deployed, funded, or broadcast. Its negative findings remain planning input in [[18_Pre_Event_Prototype_Gap_Audit]]; all qualifying product work must be authored during the official event window from a fresh clean worktree.

## Blocking Facts

1. Contributor consent and license are unresolved.
2. Event-window implementation has not begun and must not begin before kickoff.
3. Testnet/API credentials are absent from the local checkout.
4. The inherited lint/test/build/validation gates are not green.
5. Deployment reachability was reproduced, but no new live 0G proof, Hedera settlement, Uniswap execution, or Arc payment was authorized or produced in this audit.
6. The pre-event code freeze is active; only planning and clearance work may continue before official H0.
