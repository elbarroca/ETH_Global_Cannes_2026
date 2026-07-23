---
title: Project B Blockchain Track Implementation Contract
aliases:
  - ProofRail Blockchain Contract
tags:
  - ethglobal/lisbon-2026
  - project/from-scratch
  - blockchain
  - implementation-plan
status: selected_locked_until_official_H0
updated: 2026-07-16
project: ProofRail
owner: Person B
gate: H0_LOCKED
---

# Project B Blockchain Track Implementation Contract

> [!danger] H0 Lock
> This is a `PLANNED` implementation contract. Do not create code, repositories, deployments, wallets, accounts, transactions, or generated artifacts before the official hacking clock opens.

## Product Contract

ProofRail is a mandatory multi-agent system answering one question:

> Does this invoice match an authorized purchase, delivered outcome, known vendor, available budget, prior-payment history, and executable settlement route strongly enough to `PAY`, or must it `REFUSE` or enter `REVIEW`?

No single agent may authorize value movement. The system uses four isolated roles:

| agent | private input boundary | typed output | authority |
|---|---|---|---|
| Evidence Agent | Invoice, purchase order, delivery, vendor, prior receipts | `PAY \| REFUSE \| REVIEW`, reasons, evidence hashes, gaps | Proposal only |
| Risk Agent | Immutable evidence bundle plus Evidence output; no settlement tools | `CLEAR \| VETO \| REVIEW`, attacks, conflict hashes | Veto only |
| Settlement Agent | Verified normalized intent and route constraints; no raw invoice instructions | `EXECUTABLE \| BLOCKED`, bounded route, risks | Plan only |
| Recovery Agent | Persisted network identifiers/status only | `PAID \| PENDING \| RECOVERY_REQUIRED`, reconciliation evidence | Status only; cannot create intent |

Each role is a separate execution with a distinct system prompt, least-privilege context, typed schema, run ID, input/output hashes, and independently verifiable 0G result. One call role-playing multiple personas, copied outputs, or shared mutable scratch state fails the core gate.

### Deterministic Authorization Rule

`PAY_AUTHORIZED` requires all of:

1. Evidence Agent = `PAY` with no missing mandatory evidence.
2. Risk Agent = `CLEAR` with no veto/conflict.
3. Settlement Agent = `EXECUTABLE` with a route inside policy.
4. Every agent envelope and 0G proof verifies against its exact prompt/context/output.
5. Deterministic vendor, amount, budget, asset, chain, deadline, slippage, replay and route policy passes.
6. Required humans sign the Hedera Schedule.

Disagreement produces `REVIEW`; a hard fraud/duplicate/tamper finding produces `REFUSE`. Majority vote, confidence averaging, or an LLM coordinator can never authorize payment.

The typed envelopes include:

```text
agent_role: EVIDENCE | RISK | SETTLEMENT | RECOVERY
agent_run_id: uuid
input_hash: bytes32
prompt_hash: bytes32
output_hash: bytes32
proof_reference: string
verdict: role-specific enum
reason_codes: readonly string[]
evidence_hashes: readonly bytes32[]
proposed_intent?: {vendor, amount, source_asset, destination_asset, chains, deadline, slippage}
```

Agents never sign, approve themselves, change policy, invent missing evidence, call another agent's restricted tools, retry an ambiguous payment as a new intent, or convert `REVIEW` into `PAY`.

## Core Engineering Invariants

1. **Strict types:** discriminated unions and runtime validation at every agent/network boundary; no `any`.
2. **Isolation:** immutable per-run contexts, role-specific tool allowlists, deadlines, budgets and cancellation.
3. **Proof binding:** role, prompt version, context hash, model/provider, input and output bind to every verified result.
4. **Event sourcing:** append-only domain events drive a monotonic state machine; derived views are rebuildable.
5. **Exactly-once intent:** database uniqueness plus transactional outbox prevents duplicate external preparation.
6. **Reconciliation first:** network timeout means `UNKNOWN/PENDING`, never failure and never automatic replacement.
7. **Least authority:** agents have no private keys; signing is behind deterministic policy and human Schedule approval.
8. **Contract defense:** allowlisted source, destination, tokens, spender, selector, recipient, amount, min-out and deadline; replay guard before external calls.
9. **Observability without secrets:** structured run/intent/event IDs, redacted evidence hashes and transition metrics; no prompts, secrets or PII in logs/onchain.
10. **Reproducibility:** frozen dependencies, clean install, deterministic fixtures, CI and two replayable demos.

## Selected Tracks And Caps

| priority | partner / track | first-slot cap | implementation status | admission rule |
|---:|---|---:|---|---|
| 1 | 0G — Best AI Product | $3,000 | Core | Real private/verifiable inference and independently bound decision proof by H14. |
| 2 | Hedera — AI & Agentic Payments | $3,000 | Core | Real Hedera Testnet financial action, audit and replay-safe receipt by H20. |
| 3 | Hedera — Tokenization | $1,500 | Conditional | One-use HTS claim must enforce settlement lifecycle; cut if it is only a badge. |
| 4 | Hedera — Cross-Chain Automation | $1,000 | Conditional | Schedule Service must trigger Axelar and destination action without project cron/bot. |
| 5 | Uniswap — API Integration | $4,000 | Conditional third partner | Vendor must require destination-asset conversion; API key, live route, status and canonical feedback form must pass. |

Core first-slot cap: **$6,000**. Maximum compatible first-slot cap: **$12,500**. Same-project Hedera multi-track awards remain unconfirmed. Prize floor: $0.

## State Machine

```text
DRAFT
  -> EVIDENCE_BOUND
  -> EVIDENCE_AGENT_COMPLETE
  -> RISK_AGENT_COMPLETE
  -> SETTLEMENT_AGENT_COMPLETE
  -> QUORUM_VERIFIED
     -> REFUSED (terminal, zero economic preparation)
     -> REVIEW (terminal, zero economic preparation)
     -> PAY_AUTHORIZED
  -> POLICY_VERIFIED
  -> CLAIM_MINTED
  -> APPROVAL_SCHEDULED
  -> APPROVED
  -> SOURCE_EXECUTED
  -> GMP_PENDING
  -> DESTINATION_EXECUTED
  -> PAID

Any post-source failure -> RECOVERY_REQUIRED
Recovery Agent -> PAID | PENDING | RECOVERY_REQUIRED
Duplicate/restart -> reconcile the same intent, schedule, message and destination effect
```

`intent_id = hash(project_domain, invoice_hash, purchase_order_hash, vendor, amount, assets, chains, deadline, nonce)`.

Every transition is monotonic and idempotent. Persist the exact signed payload/hash/identifier before broadcasting. Public network results, not local booleans, prove economic state.

## Planned Repository Modules

| path | responsibility | track |
|---|---|---|
| `src/domain/evidence.ts` | Strict invoice/order/delivery/vendor/policy schemas and canonical hashing | Core |
| `src/agents/protocol.ts` | Versioned discriminated agent envelopes and runtime validators | Core |
| `src/agents/evidence-agent.ts` | Obligation reconciliation with proposal-only tools | 0G |
| `src/agents/risk-agent.ts` | Independent fraud/conflict/injection challenge with veto-only output | 0G |
| `src/agents/settlement-agent.ts` | Bounded route feasibility with no signing authority | 0G/Hedera |
| `src/agents/recovery-agent.ts` | Identifier-based outcome reconciliation; no intent creation | Core |
| `src/orchestration/coordinator.ts` | Timeouts, cancellation, isolation and durable run lifecycle | Core |
| `src/orchestration/quorum.ts` | Pure deterministic veto/quorum and policy authorization | Core |
| `src/domain/state-machine.ts` | Allowed transitions, idempotency and recovery states | All |
| `src/domain/events.ts` | Append-only typed domain event schema and reducer | Core |
| `src/effects/outbox.ts` | Transactional exactly-once effect preparation and reconciliation | Core |
| `src/integrations/zero-g/infer.ts` | Private/verifiable structured inference | 0G Product |
| `src/integrations/zero-g/verify.ts` | Per-agent proof verification and role/prompt/context/output binding | 0G Product |
| `src/integrations/zero-g/storage.ts` | Proof/receipt upload and verified readback | 0G Product |
| `src/integrations/hedera/hcs.ts` | Hash-bound audit topic and Mirror reconciliation | Hedera Agentic |
| `src/integrations/hedera/hts.ts` | One-use claim token create/mint/transfer/burn-or-freeze | Hedera Tokenization |
| `src/integrations/hedera/schedule.ts` | Multi-party approval and scheduled source action | Hedera Agentic/Cross-Chain |
| `contracts/ProofRailSource.sol` | Schedule-triggered bounded Axelar dispatch | Hedera Cross-Chain |
| `contracts/ProofRailDestination.sol` | Message validation, replay/deadline guard, conversion/payment/recovery | Hedera Cross-Chain/Uniswap |
| `src/integrations/axelar/status.ts` | Message reconciliation only; never a trigger bot | Hedera Cross-Chain |
| `src/integrations/uniswap/api.ts` | Approval/quote/swap/status API with strict response narrowing | Uniswap API |
| `src/policy/route.ts` | Allowlisted target/spender/function/assets/recipient/min-out/deadline | Uniswap API |
| `src/receipts/canonical.ts` | One receipt joining proof, HTS, HCS, schedule, GMP, swap and payment IDs | All |
| `tests/e2e/` | Success, refusal, replay, timeout, stale quote, duplicate GMP and recovery | All |
| `tests/adversarial/` | Agent impersonation, copied output, context injection, disagreement, veto bypass and forged proof | Core |

Paths are proposals; match the event-time starter structure after H0 rather than forcing this layout.

## Track Implementation Slices

### Slice 1 — 0G Product

1. Canonicalize and hash the evidence bundle.
2. Execute the Evidence Agent through 0G Compute/Private Computer with its role-specific immutable context.
3. Execute the Risk Agent separately; require it to cite evidence/conflict hashes and independently challenge the proposal.
4. Only after both proofs verify, execute the Settlement Agent on a normalized least-privilege context.
5. Independently verify each result and bind agent role/run, provider, model, prompt/version, context, input and output.
6. Apply the pure deterministic veto/quorum rule; no model is the coordinator.
7. Upload the redacted multi-agent transcript manifest to 0G Storage and prove readback.
8. Missing/false/reused proof, copied output, disagreement, veto or changed output terminates before claim creation, approval or signing.

Track proof: three distinct real agent runs/proofs, typed envelopes, deterministic quorum, disagreement/tamper failure, Storage transcript root/readback, runnable product.

### Slice 2 — Hedera Agentic Payments

1. Write the verified decision hash to HCS.
2. Write each agent envelope hash plus the deterministic quorum result to HCS so the multi-agent decision is independently auditable.
3. For `PAY_AUTHORIZED`, create the exact bounded payment intent; for `REFUSE/REVIEW`, create no financial operation.
4. Create a Hedera Schedule requiring the configured human approvers.
5. Execute one real Testnet financial action after all required signatures.
6. Reconcile schedule, transaction and HCS state through Mirror; Recovery Agent reports status but never creates a replacement.

Track proof: topic/sequence, schedule ID, signer set, scheduled transaction, balance delta and duplicate no-op.

### Slice 3 — Hedera Tokenization

1. Create an SDK-driven HTS NFT collection for synthetic obligation claims.
2. Mint one serial containing only a canonical metadata hash after proof and policy pass.
3. Transfer the claim into the approval/settlement state.
4. Burn after confirmed payment; freeze or retain with explicit recovery state after failure.
5. Never describe it as a legally enforceable invoice, security or RWA.

Track proof: token/serial IDs, mint/transfer/burn-or-freeze lifecycle and Hashscan/Mirror evidence. Cut the track if the token does not prevent duplicate settlement or clarify lifecycle.

### Slice 4 — Hedera Cross-Chain Automation

1. Start only from Hedera's event-time `scaffold-hbar` cross-chain DCA starter after recording commit/license.
2. Replace DCA with a bounded payment intent and per-intent vendor accounting.
3. Use Schedule Service to trigger the Hedera source contract; no project cron or bot may trigger execution.
4. Dispatch the exact payload through Axelar GMP.
5. Destination contract validates source chain/address, intent ID, replay, vendor, assets, amount, minimum output and deadline before action.
6. Duplicate messages no-op; expired/stale messages enter recovery without a second payment.

Track proof: schedule execution, source transaction, Axelar message ID/status, destination transaction and duplicate rejection.

### Slice 5 — Uniswap API

1. Confirm the canonical feedback form, valid API key and supported Testnet route before retaining this track.
2. Obtain approval/quote/swap data from the official API for the vendor-required asset conversion.
3. Parse route variants exhaustively; reject unknown response shapes.
4. Validate returned target, spender, function, token pair, recipient, amount, slippage, deadline and minimum output before scheduling.
5. Execute the exact approved route and reconcile official API/onchain status.

Track proof: API request/response identifiers, validated calldata/route, transaction, destination vendor balance and final status. Cut immediately if contract-origin execution or the mandatory form cannot qualify.

## Hour Gates

| gate | required green evidence | failure action |
|---|---|---|
| H3 | New repo after H0; rules, accounts, starter attribution and track matrix recorded | Stop if H0/rules/provenance fail. |
| H8 | Agent protocol/isolation, pure quorum, event reducer, idempotent outbox and adversarial tests | Cut all UI and extra data sources. |
| H14 | Three separate 0G agent runs/proofs verify; disagreement/tamper/reused output grants zero authority | Activate AquaSentinel if mandatory multi-agent 0G core is unavailable. |
| H20 | HCS + Schedule + real Hedera Testnet financial action reconcile publicly | Activate AquaSentinel if Hedera core is unavailable. |
| H23 | HTS one-use claim lifecycle prevents duplicate settlement | Cut Tokenization if decorative. |
| H27 | Schedule -> source -> Axelar -> destination works without bot/cron | Cut Cross-Chain and Uniswap. |
| H30 | Uniswap API route executes and mandatory form path works | Cut Uniswap; retain two-partner core. |
| H31 | Feature freeze; canonical receipt and recovery path pass | No new tracks/features. |
| H36 | Lint, typecheck, tests, build, secret scan, fresh clone and two demo replays pass | Drop any track lacking full evidence. |

## Mandatory Tests

| test | required assertion |
|---|---|
| Valid payable invoice | Evidence=`PAY`, Risk=`CLEAR`, Settlement=`EXECUTABLE`; three proofs, one claim/schedule/effect/receipt. |
| Agent disagreement | Any veto/review/blocked verdict produces zero economic preparation. |
| Fake multi-agent | Same run/output/prompt reused across roles is rejected before quorum. |
| Agent timeout | Durable `REVIEW/PENDING`; cancelled run cannot later authorize. |
| Prompt injection propagation | Invoice instructions cannot change role/system/tool policy or enter Settlement context. |
| Veto bypass | Coordinator cannot authorize despite Evidence=`PAY` when Risk=`VETO`. |
| Forged delivery | `REFUSE`; zero claim, approval, signature, bridge, conversion or payment. |
| Missing/ambiguous evidence | `REVIEW`; zero economic preparation. |
| One-byte decision/proof tamper | Independent verification fails; zero downstream calls. |
| Duplicate invoice/concurrent request | Same intent ID; one claim and at most one effect. |
| Restart after broadcast timeout | Reconcile existing identifier; never create replacement payment. |
| Missing approval | Schedule remains pending; zero source execution. |
| Stale quote/deadline | Destination refuses before conversion; recovery state is explicit. |
| Duplicate/out-of-order GMP | Destination processes once or remains pending; no second effect. |
| Destination failure after source success | Never report `PAID`; funds/state remain recoverable and visible. |
| Unknown API route/target/spender | Validation fails before signing/scheduling. |
| Sponsor unavailable | Cut the affected track; never emit success-shaped mocks. |

## Cut Order

1. Uniswap API.
2. Axelar/Cross-Chain.
3. HTS Tokenization.
4. UI polish and extra evidence sources.

Never cut the independent Evidence/Risk/Settlement agents, Recovery reconciler, per-agent 0G proofs, deterministic veto/quorum, event state, idempotent outbox, Hedera payment/audit, replay protection, recovery, provenance or evidence capture. If those cannot fit, stop or activate AquaSentinel; do not collapse to one agent.

## Completion Contract

At H36 return `BUILD`, `NARROW`, or `STOP` with:

- selected and cut tracks;
- each track's first-slot cap;
- exact repository path and commits;
- lint/typecheck/test/build/fresh-clone results;
- live proof, token, topic, schedule, Axelar, Uniswap and payment identifiers;
- negative no-effect evidence;
- unresolved qualification/access blockers.

No live identifier means no track claim.

## Control Links

- [[05_Project_B_20_AI_Agent_Ideas]]
- [[06_Project_B_Scorecard_and_Shortlist]]
- [[07_Final_Two_Project_Portfolio]]
- [[08_Two_Person_H0_Runbook]]
- [[prompts/lisbon-dual-project/02_GOAL_Project_B_From_Scratch_H0|ProofRail H0 Goal]]
- [[02_Lisbon_Live_Track_Ledger]]
