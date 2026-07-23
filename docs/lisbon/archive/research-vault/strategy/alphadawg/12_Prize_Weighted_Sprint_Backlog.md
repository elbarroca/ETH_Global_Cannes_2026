---
title: AlphaDawg Prize Weighted Sprint Backlog
aliases:
  - AlphaDawg Lisbon 36 Hour Backlog
tags:
  - alphadawg
  - sprint/backlog
  - prizes
  - ethglobal/lisbon-2026
status: ready_for_kickoff_after_preflight
updated: 2026-07-16
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
---

# AlphaDawg Prize Weighted Sprint Backlog

> [!important] Sprint contract
> Build one proof-carrying commerce loop. Protect dynamic discovery, signed quotes, strict 0G proof, exactly-once Hedera settlement, real Uniswap API execution, idempotency, baseline disclosure, and evidence. Cut every stretch feature before weakening that loop.

## Scoring Method

Scores are ordinal, not win probabilities. `5` means strongest eligibility/fit/overlap or lowest implementation burden. For cost and failure risk, `5` means worst.

| track | eligibility confidence | max one placement | completion | judge fit | cost | overlap | live risk | planning value | decision |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| 0G Keep Building | 5 | $1,500 | 4 | 5 | 2 | 5 | 3 | **High / confirmed shape** | BUILD |
| 0G AI Product | 2 | $3,000 | 4 | 4 | 1 | 5 | 3 | Medium after approval | PREPARE; choose classification |
| 0G Infrastructure | 2 | $1,500 | 3 | 5 | 3 | 5 | 3 | Medium after approval | PREPARE; extract only after H17 |
| Hedera Agentic Payments | 2 | $3,000 | 4 | 5 | 3 | 5 | 3 | **High fit / conditional** | BUILD after eligibility confirmation |
| Hedera Tokenization | 1 | $1,500 | 2 | 2 | 4 | 2 | 4 | Low | CUT unless wording is resolved and core is green |
| Hedera No Solidity | 1 | $1,000 | 1 | 1 | 5 | 1 | 5 | Zero | REJECT |
| Hedera Cross-Chain | 2 | $1,000 | 1 | 5 | 5 | 3 | 5 | Low despite novelty | WATCH; H26–H30 only |
| Uniswap API | 2 | $4,000 | 4 | 5 | 3 | 5 | 4 | **High fit / conditional** | BUILD after eligibility/key/form preflight |
| Uniswap Stack | 4 | $1,000 | 3 | 4 | 2 | 5 | 3 | Medium-high; adapter acceptance unresolved | BUILD reusable surface; confirm claim |

Unknown partner competition density is not converted into a numeric probability.

## Portfolio Postures

| posture | claim set | maximum if won | credibility | use |
|---|---|---:|---|---|
| Minimalist | 0G Keep Building + Uniswap Stack | $2,500 | Explicit Continuity track shapes; Stack/tooling fit still needs sponsor acceptance and a working feedback form. | Fallback if regular-track approvals fail. |
| Recommended | 0G Keep Building; Hedera Agentic; Uniswap API + Stack | $8,500 under one award per partner; $9,500 only if Uniswap permits two awards | Conditional; one coherent vertical and best risk-adjusted fit. | **Controlling build.** Protect explicit Continuity claims; do not plan on stacking. |
| Maximal | All three 0G tracks; Hedera Agentic + Tokenization + Cross-Chain; both Uniswap tracks | $16,500 theoretical | Requires cross-category and multi-award approvals plus every stretch path. | Architecture ceiling, not sprint promise. |

Financial framing:

- Confirmed Continuity-shaped maximum today: **$2,500**.
- Credible recommended ceiling if regular categories approve but partners award one internal track each: **$8,500** (0G Keep $1,500 + Hedera Agentic $3,000 + Uniswap API $4,000).
- Highest conditional one-award-per-partner ceiling: **$10,000** if 0G approves and awards AI Product instead of Keep Building. Do not treat this as current eligibility.
- Theoretical ceiling is not expected value and must not appear as forecast revenue.
- Risk-adjusted planning value is categorical: Keep Building high; Agentic/API high-fit conditional; Stack medium-high; all stretch tracks low.

## Track-To-Evidence Map

All paths are planned Lisbon paths; see [[11_Server_Agent_Target_Architecture]] for the file contract.

| selected-partner track | bounded feature | planned file/API | decisive test | four-minute demo evidence |
|---|---|---|---|---|
| 0G Keep Building | Cannes-to-Lisbon open provider + strict proof delta | `src/a2a/*`, `src/commerce/*`, `CHANGELOG-LISBON.md` | Baseline boundary and fresh-clone valid/tampered run | Prior SHA, dated delta, live proof receipt, What's Next |
| 0G AI Product | One required inference through Private Computer/Compute | `src/og/inference.ts` | Real provider success; missing/tampered proof blocks economics | Provider/proof fields and verified output in common trace |
| 0G Infrastructure | Reusable typed adapter/state/receipt with one external provider | `src/commerce/index.ts`, `src/providers/external-provider.ts` | Consumer example imports named exports without static registry edits | Agent Card registration plus example-provider quote/delivery |
| Hedera Agentic Payments | Exactly-once HBAR/HTS settlement after proof | `src/hedera/settlement.ts`, Mirror API | Duplicate/concurrent/restart attempts yield one final transfer | Transfer transaction and Mirror confirmation linked to task |
| Hedera Tokenization | Optional isolated service-credit lifecycle | `src/hedera/tokenization.ts` | Create/configure/transfer/redeem is real and policy bound | Hashscan lifecycle; only after wording approval |
| Hedera Cross-Chain | Optional Schedule -> Axelar -> destination action | `src/hedera/automation.ts`, Axelar GMP | No project bot/cron; destination state changes onchain | Source schedule, Axelar message, destination receipt |
| Uniswap API | Exact-input testnet execution with exhaustive route guard | `src/uniswap/client.ts`, `policy.ts`, `executor.ts` | Approval/Permit2, simulation, broadcast/status; unknown route rejects | API request ID, route, simulation, tx/order and final status |
| Uniswap Stack | Reusable commerce-to-swap adapter and integration feedback | `src/uniswap/*`, `FEEDBACK.md` | External fixture consumes adapter; form link and code pointers exist | Public code boundary, test, `FEEDBACK.md`, submitted form |

## Pre-Event Work — No Lisbon Feature Code

| priority | task | pass condition |
|---:|---|---|
| P0 | Obtain contributor consent and agree an OSI license. | Signed/dated permission covers reuse, modification, licensing, submission, credit, and commercial ownership boundary. |
| P0 | Confirm Continuity/team status and cross-category eligibility. | Written organizer/partner answers captured in [[09_Lisbon_Live_Track_and_Eligibility_Audit]]. |
| P0 | Obtain corrected Uniswap feedback form. | Working URL and submission timing recorded. |
| P0 | Provision test access without committing secrets. | Independent Hedera accounts funded; 0G Private Computer/Compute access; valid Uniswap key; supported testnet wallet/funds. |
| P0 | Confirm kickoff schedule and exact baseline. | Recheck rules/prizes on July 23 and at H0. |
| P1 | Prepare non-code artifacts. | Baseline, track matrix, changelog template, feedback template, evidence table, redaction rules, and video shot list ready but timestamped honestly. |
| P1 | Preflight sponsor APIs manually outside the qualifying repo delta. | One real read-only/zero-value request per selected sponsor; no claim of Lisbon implementation. |

If rights remain unresolved at kickoff, internal engineering may continue only on code the Lisbon team owns, but submission readiness stays **BLOCKED**.

## Ownership Lanes

- **Lane A — commerce/proof:** domain and persistence, A2A provider, 0G Private Computer/Compute + Storage, canonical receipt.
- **Lane B — economics/evidence:** Hedera settlement/HCS/Mirror, Uniswap policy/executor, minimal UI, evidence export.
- Pair at H2, H10, H17, H21, H26, and H32. No lane may redefine shared records independently.

## 36-Hour Backlog

### H0–H2 — Eligibility And Baseline

- Re-fetch the live prize pages, rules, submission guide, supported chains, SDK versions, and broken-form status.
- Record kickoff time, baseline SHA, branch, team, contributor consent/license, pre-existing surfaces, new-code boundary, credential readiness, and API/testnet smoke results.
- Create in the product repo: `docs/lisbon/BASELINE.md`, `docs/lisbon/TRACK-MATRIX.md`, `CHANGELOG-LISBON.md`, `FEEDBACK.md`, and prompts/spec disclosure.
- Add only setup/test scaffolding required for event work; use small commits.

Gate: rights are clear; target tracks are confirmed or explicitly conditional; each selected sponsor has a real accessible test surface.

### H2–H6 — Domain And Economic Safety

- Runtime schemas for every record in [[11_Server_Agent_Target_Architecture]].
- Prisma migration with append-only events, optimistic `version`, and unique settlement/execution keys.
- Pure transition, signature, canonical hash, quote selection, policy, and idempotency tests.
- `npm test` and `npm run typecheck` scripts.

Gate: invalid transitions, stale versions, replayed quotes, duplicate economic keys, malformed payloads, and policy violations fail deterministically.

### H6–H10 — Server Agents And Quotes

- Pinned A2A-compatible Agent Cards for AlphaDawg, one built-in adapter, and one independent external provider.
- Endpoint ownership/signature verification and SSRF controls.
- Typed task request and two signed variable-price quotes.
- Deterministic award by capability, selected asset, atomic price, deadline, and stable provider-ID tie-break.

Gate: two discoverable provider options quote one caller-supplied task with no edit to `agent-registry.ts` or role manifests.

Cut immediately: streaming, push notifications, ERC registries, extra providers, deployment automation.

### H10–H17 — 0G Proof And Continuity Delta

- Migrate the commerce seam to the current 0G Compute SDK.
- Produce the provider result through the pinned Private Computer/Compute path that passed H0 proof-field preflight.
- Bind task, quote, provider, input hash, output hash, and schema version.
- Persist the proof/receipt root through 0G Storage where live support permits.
- Make failed verification terminal.
- Add a tampered-output/proof test and judge-visible evidence.

Gate: valid delivery passes; tampered delivery fails; neither settlement nor execution preparation exists after failure.

If red at H17: cut every stretch track and repair the commerce/0G core.

### H17–H21 — Hedera Agentic Settlement

- Quote declares HBAR/HTS asset, atomic amount, recipient, expiry, and account.
- Atomically claim one settlement, persist signed artifact/transaction identity, execute one real Hedera Testnet transfer, confirm through Mirror, and expose Hashscan.
- Anchor compact task/quote/proof/settlement hashes to HCS where feasible.
- Run duplicate, concurrent, restart, and ambiguous-broadcast recovery tests.

Gate: one verified delivery receives one final Testnet transfer; replay produces no duplicate.

If red at H23: permanently cut Cross-Chain and Tokenization and repair Agentic Payments.

### H21–H26 — Uniswap

- Convert only a verified, settled delivery into a typed `TradeIntent`.
- Enforce allowlisted chain/tokens/recipient/amount/slippage/deadline/route/caps.
- Implement approval/Permit2, quote, exhaustive route dispatch, signing/broadcast, and status.
- Persist request ID, route, simulation, signed artifact hash, tx/order/plan ID, and final status.
- Execute one small real supported-testnet AMM transaction with the valid API key.
- Update `FEEDBACK.md` from real integration friction.

Gate: real API execution completes; invalid/unverified/expired intent is rejected before signing; `CHAINED` and unknown routes cannot fall into `CLASSIC`.

If red at H28: cut Cross-Chain and Tokenization and fix the API path.

### H26–H30 — Receipt, Recovery, Then Optional Cross-Chain

- Unify task, quote, proof, Hedera, Uniswap, and feedback identifiers.
- Prove timeout, cancellation, restart, and exactly-once recovery.
- Run the Arc x402 `$0.001` legacy regression.
- Add the smallest judge-visible UI.
- Only if every core gate is green, start Schedule -> Axelar GMP -> destination execution with no team-run bot/cron.

Gate for stretch: the complete onchain sequence is independently visible. Hard cut Cross-Chain at H30 if incomplete.

### H30–H32 — Optional HTS, Then Freeze

- Only after the core and any chosen automation are green, implement an isolated sponsor-approved HTS service credit/invoice lifecycle.
- Demonstrate create/configure, transfer, meaningful compliance/custom fee, and redeem/burn.

Gate: lifecycle is real and independently demoable. Otherwise cut it. Freeze all features at H32.

### H32–H36 — Evidence And Submission Readiness

- Run the complete verification set and fresh-clone path.
- Capture redacted logs, request IDs, transactions, explorer links, addresses, proof/storage roots, screenshots, and demo timestamps.
- Finish README, architecture, code pointers, changelog, What's Next, `FEEDBACK.md`, AI disclosure, addresses, team/contact details, and [[13_E2E_and_Submission_Evidence_Plan]].
- Record one 2:00–2:59 common video and an optional <=5-minute Hedera edit.
- Rehearse success and tampered-proof demos twice.

Gate: every claimed track has qualifying code, passing test, live evidence, and a demo moment. Any chosen-track failure keeps submission **BLOCKED**.

## Global Cut Order

1. Onchain reputation/identity writes.
2. Extra providers and pairs.
3. Advanced/multi-round auction.
4. HTS Tokenization.
5. Cross-Chain Automation.
6. Marketplace visual redesign.

Never cut strict proof verification, independent signing, exactly-once economics, real sponsor transactions, dynamic discovery, baseline disclosure, or evidence.

## BUILD / NARROW / STOP

- **BUILD:** A2A minimum, commerce state/idempotency, 0G Private Computer/Compute + Storage, Hedera Agentic settlement, Uniswap exhaustive API adapter, receipt, evidence.
- **NARROW:** one task, two providers, one settlement asset, one supported Uniswap pair/network, one success and one tampered failure.
- **STOP:** early qualifying commits, unresolved rights presented as approved, unsupported track claims, mocks as success, mainnet, unapproved spend, secret exposure, destructive git, or external submission without authority.
