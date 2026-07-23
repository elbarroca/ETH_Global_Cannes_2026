---
title: Lisbon 2026 Final Two Project Portfolio
tags:
  - ethglobal/lisbon-2026
  - portfolio
  - execution-plan
status: research_only_not_promotable
updated: 2026-07-16
gate: H0_LOCKED
---

# Lisbon 2026 Final Two Project Portfolio

> [!success] Project B selected, implementation locked
> ProofRail passed the ideation gate; AquaSentinel is the fallback. Architecture remains `PLANNED` until official H0.

## Portfolio Decision

| person/project | product/pitch | user/failure | tracks | ceiling treatment | contract |
|---|---|---|---|---:|---|
| A / AlphaDawg | **Creator-owned verifiable-agent marketplace:** one shared runtime lets users publish, hire, run, and monetize bounded agents. | Creator cannot deploy/monetize safely; buyer cannot trust identity, version, output, or commission state. | Core: 0G Keep + ENS Continuity. Exactly one conditional third: Hedera, Sui, or Uniswap. | $3,500 protected core; $5,500 all-Continuity with Sui; $6,500 conditional commerce with Hedera. | BUILD shared runtime + real paid hire/commission; NARROW one creator/agent/buyer/job; STOP placeholder or fail-open paths. |
| B / ProofRail | **A proof-carrying accounts-payable agent team:** Evidence proposes, Risk attacks, Settlement plans, Recovery reconciles; deterministic quorum and human approval settle exactly once. | DAO/small-company treasury; forged, duplicated, undelivered, stale, or ambiguous invoice. | Core: 0G Product + Hedera Agentic. Conditional depth: Hedera Tokenization/Cross-Chain + Uniswap API. | $6,000 core first-slot cap; $12,500 maximum compatible first-slot cap. | `SELECTED_H0_LOCKED`; multi-agent/core-engineering gates precede extensions. |
| B fallback / AquaSentinel | **Compile AI liquidity intent into a safe Aqua program—or refuse it.** | LP; unsafe generated strategy/calldata and inventory drift. | 1inch Build an Aqua App. | $2,500. | Activate only if 0G/Hedera core access fails at H0. |

Prize floor for every project is $0.

## Non-Overlap

- AlphaDawg: existing agent product becoming a creator-owned shared marketplace with 0G proof, ENS discovery/versioning, and real commission; Person A.
- ProofRail: new cross-chain treasury-control product; 0G proof, Hedera claim/approval/audit, Axelar dispatch and conditional Uniswap conversion; Person B.
- No shared app code, schemas, prompt corpus, UI, database, wallet, cloud, sponsor account, transaction, evidence, or submission.
- Both may independently use public TypeScript libraries and general idempotency patterns after H0.

## AlphaDawg Architecture And Trust Model

```text
creator wallet -> owner challenge -> declarative AgentVersion -> shared worker dry run
  -> strict 0G execution/proof + Storage readback -> publish ENS identity/version
buyer -> ENS resolve/manifest check -> version-bound quote -> payment -> durable job
  -> shared worker -> independent 0G verification
  -> [invalid] failure/refund/recovery; no delivery or commission
  -> [valid] delivery -> creator commission -> hired pack -> canonical receipt
```

Trust:

- User agents are bounded data: versioned prompt, schemas, allowlisted connectors, proof policy, price, owner, and payout address. No arbitrary code, shell, URL, key, or unrestricted tool upload.
- Model output, remote data, payment callbacks, and ENS records are untrusted until schema, owner, version, hash, policy, and finality checks pass.
- One logical agent is one immutable database version, not one Fly app, port, mnemonic wallet, or OpenClaw session.
- A separate signer/settlement port owns value authority. 0G verification gates delivery; only final non-refunded settlement creates creator earnings.
- Public network state and independently verified receipt data, not UI/database flags, prove external state.

### AlphaDawg Test/Evidence Matrix

| case | assertion | evidence |
|---|---|---|
| user-created publish | Dry-run succeeds through the same shared worker before immutable publication | Owner challenge, version/manifest hash, run/proof, state events |
| runtime discovery | ENS resolves the exact published version without source/config changes | Name/node, resolved records, manifest comparison, live job |
| one-byte tamper | No delivery, commission, reputation, or downstream action | Verifier failure and zero downstream rows/calls |
| payment/replay/restart | One payment, job, commission/refund, and receipt | Unique keys, event trace, settlement/public balance evidence |
| paid run failure | Creator has no earnings; refund or explicit recovery remains visible | Failure/refund identifier and absent commission |
| hired pack | Hired published version becomes eligible in the real orchestrator | Selection trace and exact AgentVersion ID |
| forged ENS update | Owner/version/manifest mismatch is refused | Resolved forged record and policy trace |
| fresh clone | Install/lint/typecheck/test/build/smokes succeed or inherited failures are isolated | Commands, exact commit, redacted evidence pack |

### AlphaDawg Cut Order

Third partner -> extra agents/connectors -> reputation extras -> UI polish. Never cut executable user-created agents, owner authentication, shared runtime, strict 0G verification, paid hire/commission/refund, ENS identity/version discovery, idempotency, provenance, or evidence.

## ProofRail Architecture And Trust Model

### Agentic Problem Contract

| layer | responsibility |
|---|---|
| Evidence | Synthetic invoice, purchase order, delivery artifact, vendor identity, treasury policy, prior receipts and route availability. |
| Evidence Agent | Independently reconcile invoice, order, delivery, vendor and history into `PAY \| REFUSE \| REVIEW`. |
| Risk Agent | Adversarially test fraud, duplication, contradictions and prompt injection; output `CLEAR \| VETO \| REVIEW`. |
| Settlement Agent | Given only verified normalized intent/policy, propose `EXECUTABLE \| BLOCKED` and a bounded route. |
| Recovery Agent | Observe network artifacts and classify `PAID \| PENDING \| RECOVERY_REQUIRED`; never issue a replacement intent. |
| 0G | Keep evidence/reasoning private where required and make the exact decision independently verifiable. |
| Deterministic coordinator | Verify every envelope/proof; apply veto/quorum and policy; event-source state; require approval; enforce idempotent effects. |
| Onchain action | Create a one-use claim, collect approval, dispatch cross-chain, convert only if required, pay vendor and bind all network IDs into one receipt. |

Multi-agent execution is mandatory. Separate prompts, contexts, typed envelopes and proofs must exist; one model role-playing several personas does not qualify. Agents never control keys, invent policy, approve themselves, or turn ambiguity into a new payment.

```text
evidence bundle + treasury policy
  -> Evidence Agent: PAY | REFUSE | REVIEW + proof
  -> Risk Agent: CLEAR | VETO | REVIEW + proof
  -> Settlement Agent: EXECUTABLE | BLOCKED + proof
  -> deterministic proof verification + veto/quorum + unique intent
  -> [disagreement/tamper/veto] REFUSED or REVIEW, zero economic preparation
  -> 0G Storage multi-agent transcript root
  -> HTS claim/receipt lifecycle + HCS audit hash
  -> Hedera Schedule collects approvals and triggers source action
  -> Axelar GMP dispatches exact bounded payload
  -> destination validates deadline/quote/policy
  -> Uniswap API-derived conversion + vendor payment
  -> Recovery Agent reconciles source, GMP, destination and final status
  -> canonical receipt
```

Trust:

- Invoice/vendor text, model output, proof metadata, network callbacks, quote, and cross-chain message are untrusted until independently bound and verified.
- The agent proposes a typed intent; only deterministic policy and required human schedule signatures authorize exact recipient, amount, asset, destination, deadline and slippage.
- Person B controls test keys; demo uses synthetic bills and Testnet only.
- Every external effect persists its exact signed payload/hash/identifier before broadcast; timeout/retry reconciles it rather than creating a replacement.
- Cross-Chain and No Solidity are mutually exclusive portfolio forks. 0G Product and Infrastructure are not stacked without written approval.

### Sponsor Implementation Map

| sponsor primitive | role | planned proof |
|---|---|---|
| 0G Compute / Private Computer | Private, verifiable obligation reasoning | Real provider response, independent verification, task/output bindings |
| 0G Storage | Persistent proof-carrying receipt | Root/reference and proof-verified readback |
| Hedera HTS | Tokenized claim/receipt lifecycle | Token ID plus mint/transfer/redeem-or-burn lifecycle |
| Hedera HCS + Mirror | Hash-bound audit and independent readback | Topic sequence, decoded message, public Mirror result |
| Hedera Schedule Service | Onchain approval and trigger | Schedule ID, scheduled transaction ID, signer set, execution record |
| Hedera EVM + Axelar GMP | Fully onchain source-to-destination dispatch | Source transaction, GMP message ID, destination transaction |
| Uniswap API | Core destination conversion/payment | API request ID, approval/quote/simulation, exact route transaction and final status |
| World, alternate | Verified-human policy owner/approver only if published track requires it | Server/onchain proof and replay-safe human authorization; never login-only |

H0 may start from Hedera's public `scaffold-hbar` `templates/cross-chain-dca` branch at the revalidated commit. Record it as starter code. The event delta must replace direct-v3-only qualification, deployer-owned proceeds, and generic DCA with API-generated bounded calldata, per-intent vendor accounting, 0G proof gating, HTS/HCS claims, and partial-failure recovery.

### ProofRail Test/Evidence Matrix

| case | assertion | evidence |
|---|---|---|
| valid obligation | Three independent verified agent outputs, green quorum, one claim/schedule/effect/receipt | Per-agent proof hashes, quorum record, network IDs and vendor delta |
| agent disagreement | Evidence=`PAY`, Risk=`VETO` or Settlement=`BLOCKED`; zero economic preparation | Typed envelopes, verified proofs and zero downstream calls |
| fake multi-agent | Reused output/prompt hash or missing independent execution fails closed | Agent-run IDs, distinct prompt/context hashes and coordinator rejection |
| tampered proof/output | Refusal before HTS/schedule/signature | 0G verifier failure and zero downstream rows/calls |
| duplicate/concurrent | One intent/schedule/message/destination effect | Unique keys, identical IDs and one public value movement |
| stale Uniswap quote/deadline | Destination refuses before swap; explicit recovery state | Policy result, zero swap, retained/recoverable funds |
| Axelar delay/duplicate | Message processes once or remains reconciliable | GMP status and destination replay guard |
| partial source success/destination failure | No false “paid” state; recovery/refund path is explicit | Source/destination state and recovery receipt |
| prompt injection/unknown vendor | Validation failure or `REVIEW`; zero value | Boundary trace and signer-call counter |
| unavailable sponsor | Downstream track cut honestly; no mock receipt | Failure ledger and updated claim matrix |

### ProofRail 36-Hour Backlog

| hours | work | hard gate |
|---|---|---|
| H0–H3 | Live rules/partner ceiling, new repo/baseline/license/controls, exact network/account manifest | New repo timestamp after H0; select at most three partners; no AlphaDawg import |
| H3–H8 | Typed agent envelopes, isolation boundaries, veto/quorum, event state, idempotent outbox and recovery tests | Fake agents, malformed/tampered/replayed envelopes fail before effects |
| H8–H14 | Evidence/Risk/Settlement agents execute separately on 0G; every proof verifies; Storage transcript readback | Disagreement blocks; tamper grants zero authority; otherwise STOP core |
| H14–H20 | HTS claim lifecycle, HCS, Schedule, Mirror, bounded Hedera financial action | Public IDs and one replay-safe state chain; otherwise activate AquaSentinel |
| H20–H26 | Hedera source contract + Axelar GMP + destination replay guard | Full source/message/destination visibility; otherwise cut Cross-Chain and Uniswap |
| H26–H29 | Uniswap key/form/route, exact calldata validation, conversion/payment/status | Real route and final status; otherwise cut Uniswap and evaluate published World |
| H29–H31 | Unified receipt, partial-failure recovery, fast refusal demo, minimal UI | Success/failure IDs resolve; hard feature freeze H31 |
| H31–H36 | Lint/typecheck/test/build/CI/secret scan/fresh clone, docs, feedback, videos and two rehearsals | Every claimed track maps to code, test, live proof and demo moment |

Cut order: World/third-partner substitution -> Uniswap -> Axelar/Cross-Chain -> Tokenization -> UI. If Cross-Chain is cut early, optionally remove all Solidity and pivot to Hedera No Solidity; never claim both forks. Never cut 0G proof, deterministic policy, Hedera core value movement/audit, replay safety, provenance or evidence.

## AquaSentinel Backup Contract

Activation: ProofRail fails the real 0G+Hedera core by H20, and Aqua/SwapVM source+license compile path is green.

```text
LP policy + balances -> agent strategy AST -> deterministic compiler
  -> simulate official Aqua/SwapVM program
  -> unsafe: refuse, zero transfer
  -> safe: ship/execute -> token balance delta -> receipt
```

- H0–H6 clean repo/starter attribution/compile/tests.
- H6–H14 typed AST/compiler/policy/adversarial tests.
- H14–H22 official Aqua/SwapVM strategy and token movement on local fork.
- H22–H28 safe + malicious E2E, reset twice.
- H28–H36 QA, README, evidence, demo.
- Stop on arbitrary calldata, missing official contracts, no token transfer, or non-deterministic reset.

## Access Checklist

| item | Person A | Person B |
|---|---|---|
| rules/H0 | `PENDING` live recheck | `PENDING` live recheck |
| rights/license | `BLOCKED` | New license chosen at H0 |
| repo | Clean Cannes SHA | Must not exist before H0 |
| model | Existing/0G access `NOT_VERIFIED` | 0G Compute/Private Computer `NOT_VERIFIED` |
| sponsor | 0G/ENS `NOT_VERIFIED`; Sui/Hedera/Uniswap optional; Uniswap form 404 | 0G/Hedera/Axelar/Uniswap `NOT_VERIFIED`; World `PENDING`; Aqua public fallback available |
| wallets/accounts | Alpha-only manifest | New Project-B-only manifest |
| spend | Testnet only; explicit cap required | Testnet/local fork only; explicit cap required |

## Final BUILD / NARROW / STOP

- **Person A BUILD:** creator-owned shared runtime, executable user agents, strict 0G, ENS identity/version, real paid hire/commission/refund, hired-pack integration, and receipt.
- **Person A NARROW:** one creator, one buyer, one agent, one job, one payment, one proof, one ENS name; one third partner only after the core is green.
- **Person A STOP:** arbitrary-code agents, per-agent deployments, unverified delivery, inferred earnings, three sponsor extensions, or pre-event code reuse.
- **Person B BUILD at H0:** ProofRail's strict 0G + Hedera proof/claim/approval/value core.
- **Person B MAXIMIZE CONDITIONALLY:** Hedera Tokenization/Cross-Chain and Uniswap only after their track gates pass.
- **Person B STOP:** pre-H0 implementation, four-partner submission, cosmetic integrations, or shared AlphaDawg material.
