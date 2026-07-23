---
title: Lisbon 2026 Prizes and Engineering Delta
aliases:
  - Project A and B H0 Engineering Delta
tags:
  - ethglobal/lisbon-2026
  - prizes
  - engineering
  - h0
status: research_only_not_promotable
updated: 2026-07-23
gate: H0_LOCKED
---

# Lisbon 2026 Prizes And Engineering Delta

> [!danger] Pre-H0 boundary
> This is planning material, not product code or qualification evidence. AlphaDawg stays frozen and Project B gets no product repository, code, contracts, prompts, UI, wallets, transactions, or tests until the official dashboard proves H0. At H0 and before submission, recheck [[02_Lisbon_Live_Track_Ledger]] against the live prize pages.

## Decision

| lane | core path | optional third partner | conservative first-slot cap | contract |
|---|---|---|---:|---|
| Project A / AlphaDawg | 0G Keep Building + ENS Continuity | Sui Existing App **or** Hedera Automation | $3,500 core; $5,500 with Sui; $4,500 with Hedera | `NARROW`; build core first and select at most one third track after causal proof. |
| Project B / ProofRail | 0G Product + Hedera Agentic Payments | None at track lock | $6,000 | `NARROW`; World/The Graph remain watch-only because removal does not break the current guarantee. |
| Project B fallback 1 | 1inch Aqua App / AquaSentinel | none | $2,500 | One deep deterministic fork path. |
| Project B fallback 2 | Sui New App / SealSwitch | none | $2,000 | One deep ownership/access-control path. |

Prize floor is $0. Same-partner stacking is unconfirmed. Project A regular-track admission remains `BLOCKED` without written sponsor/organizer approval.

## Project A — AlphaDawg

### User Loss And Agent Necessity

A creator can publish an apparent agent, but a buyer cannot prove which immutable version ran, whether its result was independently verified, or whether payment/commission belongs to that exact delivery. The agent is necessary only for a bounded analysis task; deterministic code owns identity, schema, authorization, payment, and state transitions.

### MVP

```text
creator publishes immutable AgentVersion
  -> ENS resolves owner/version/manifest/runtime
  -> buyer accepts one quote and creates one bounded job
  -> shared worker runs allowlisted tools and 0G inference
  -> independent verification + 0G Storage readback pass
  -> one delivery/commission receipt is finalized
```

Optional third-track fork, chosen once:

- **Sui:** encrypted creator package on Walrus; Move object + Seal policy grants a job-bound worker permit; revoke blocks the identical rerun before 0G.
- **Hedera Continuity:** a buyer creates/approves/manages one real scheduled creator payment; Schedule Service executes it and Mirror confirms one balance effect. Use only if this is a genuine automation workflow rather than a cosmetic payment rail.

### Non-Goals

- No arbitrary agent code, unrestricted connectors, model-held keys, raw model calldata, multi-asset settlement, broad reputation, new deployment platform, or sponsor-fourth integration.
- No Sui and Hedera in the same deadline path.
- No Uniswap/1inch/The Graph/World claim without a separate written eligibility and causality decision.

### Authority And State

| boundary | authority | fail-closed rule |
|---|---|---|
| HTTP | Authenticated wallet session plus runtime schema | Caller cannot select owner, payout, version hash, or internal state. |
| Agent | Immutable declarative version and allowlisted tools | Output proposes; it never signs, publishes, pays, or changes policy. |
| ENS | Owner-authorized record write and live resolver read | Resolved owner/version/manifest mismatch blocks publication and execution. |
| 0G | Independent proof verification and proof-enabled Storage readback | Missing/invalid proof returns no usable result and triggers no economic effect. |
| Optional Sui | Move object + Seal policy | Wrong worker/task/version/expiry/revocation blocks decryption before inference. |
| Optional Hedera | Buyer-approved exact scheduled transaction | Persist exact artifact/ID before broadcast; timeout reconciles the same ID. |
| Database | Versioned state machine and append-only events | Illegal/replayed transitions no-op or become explicit recovery. |

```text
DRAFT -> VALIDATED -> PUBLISHED -> QUOTED -> ORDERED -> RUNNING
  -> VERIFIED -> DELIVERED -> SETTLED -> RECEIPTED

terminal/recovery:
REFUSED | VERIFICATION_FAILED | EXPIRED | CANCELLED |
RECONCILIATION_REQUIRED | FAILED_TERMINAL
```

### Minimum Change Surface

Reuse the existing application, database, worker, and installed packages before adding anything.

```text
src/auth/wallet-challenge.ts
src/agent-runtime/{manifest,worker,verified-inference}.ts
src/commerce/{schemas,state-machine,receipt}.ts
src/identity/ens/{records,publisher,resolver}.ts
src/og/{inference,storage}.ts
prisma/schema.prisma
prisma/migrations/<one-event-window-migration>/
one existing marketplace task route
one minimal receipt/status UI seam
focused unit, integration, and E2E tests
```

Add only one optional fork after core proof:

```text
src/integrations/sui/{package,permit,seal,walrus}.ts
move/alphadawg_license/
```

or

```text
src/integrations/hedera/{schedule,payment,mirror}.ts
```

### Required Tests And Evidence

| case | assertion |
|---|---|
| Success | Exact owner/version/task/input/output/proof/root/receipt bindings; optional rail adds its public IDs. |
| Forged owner or ENS record | Zero worker/provider/payment calls. |
| One-byte task/output/proof tamper | Verification fails; no delivery, commission, permit, schedule, or payment. |
| Duplicate/concurrent request | One job and one terminal receipt/effect. |
| Worker restart | Lease/effect ID reconciles; no second execution or payment. |
| Optional Sui revoke | Same package/task stops before Seal/0G; plaintext sentinel absent from logs, DB, 0G, and Walrus. |
| Optional Hedera ambiguity | Existing Schedule/transaction ID is queried; no replacement effect. |
| Sponsor unavailable | Explicit refusal/recovery; no success-shaped mock. |

### H-Gates And Cuts

| gate | pass evidence | cut/stop |
|---|---|---|
| Pre-H0 | Rights, OSI license, changed-team/Continuity approval, immutable baseline, separate owner/access manifests | Rights/provenance/H0 failure → `STOP`. |
| H0–H4 | Clean install, migrations, lint, typecheck, tests, build, CI, secret/license scan | Cut UI breadth; repository still red at H4 blocks sponsor work. |
| H4–H10 | Wallet ownership, immutable version, legal state transitions, shared-worker lease/restart | Core lifecycle red at H10 → `STOP`. |
| H10–H18 | ENS live write/resolve/update/refusal and strict 0G proof + Storage readback | 0G red → `STOP`; ENS red → remove ENS claim. |
| H18–H24 | Select one: Sui permit/revoke or Hedera schedule/execution | Neither green/casual → submit 0G + ENS only. |
| H24–H30 | One resettable failure/success loop and canonical receipt | Cut cosmetic UI and every optional feature. |
| H30–submission | Fresh clone; full checks; live smokes; secret scan; two rehearsals; exact public IDs | Red mandatory artifact → remove claim; red core → `STOP`. |

### Four-Minute Demo

| time | proof |
|---|---|
| 0:00–0:35 | Show creator loss and publish one real immutable agent version. |
| 0:35–1:10 | Resolve ENS owner/version/manifest from a clean client. |
| 1:10–2:05 | Buyer hires; shared worker runs; show independent 0G verification and Storage readback. |
| 2:05–2:45 | Tamper one byte; execution/delivery/economic effect stops. |
| 2:45–3:30 | Run success; show final receipt and optional Sui revoke **or** Hedera scheduled payment ID. |
| 3:30–4:00 | Map each sponsor to the guarantee it exclusively owns; show event-window commits. |

## Project B — ProofRail

### User Loss And Agent Necessity

A DAO or small-company accounts-payable operator can pay a forged, duplicated, undelivered, stale, or ambiguous obligation. Separate agents are justified because unstructured evidence needs independent reconciliation and adversarial review; deterministic policy and explicit human authorization still own the economic decision.

### MVP

```text
canonical synthetic obligation
  -> Evidence Agent on 0G
  -> independent Risk Agent on 0G
  -> deterministic quorum, settlement compiler, and treasury policy
  -> explicit human approval
  -> one bounded Hedera Testnet payment
  -> deterministic recovery reconciler checks public IDs
  -> canonical receipt
```

World is currently **not selected**: the explicit human signer already controls company payment authority, so AgentKit adds no necessary guarantee. Reconsider it only if the product genuinely lets autonomous service agents request settlement and human-backed status becomes a mandatory execution-right gate—not login, a badge, or a discount. The Graph is likewise watch-only unless live onchain delivery data becomes contractually necessary to the payment decision.

### Non-Goals

- No 0G Storage, HCS, Schedule Service, HTS claim token, Axelar, Uniswap conversion, World/Graph integration, Solidity, arbitrary route, generalized invoice platform, real invoice, mainnet value, or production signer in the selected MVP.
- No third model agent: settlement compilation and recovery remain deterministic.
- No legal-enforceability, fraud-detection accuracy, production-readiness, qualification, or winnings claim before its exact evidence gate passes.

### Track Contract

| track | mandatory state change | qualifying evidence | cut condition |
|---|---|---|---|
| 0G Product | Two distinct task-bound model runs/proofs | Run/proof/input/output/prompt/context hashes; one-byte tamper and disagreement stop downstream work | Any success path relies on unverified/local fallback. |
| Hedera Agentic Payments | One real bounded Testnet payment after verified policy and human approval | Transaction ID, Mirror/Hashscan state, exact balance delta, duplicate no-op | No live reconciled financial action by H20. |
| World AgentKit | Watch-only hypothesis: human-backed status gates settlement-request execution rights | Would require a verified and bot/unverified contrast in the same workflow | Current human signer makes it removable; do not select without a new written product invariant. |
| The Graph AI Use Case | Watch-only hypothesis: live delivery state gates payment | Would require named live Graph endpoints and stale/missing-chain refusal | Current synthetic evidence does not require it; do not add a decorative query. |

### Roles And Authority

| role | output | prohibited |
|---|---|---|
| Evidence Agent | `PAY | REFUSE | REVIEW`, citations and source hashes | No keys, route, approval, payment, or policy mutation. |
| Risk Agent | `CLEAR | VETO | REVIEW`, conflicts/injection/fraud hashes | Cannot convert a veto to payment. |
| Settlement compiler | Deterministic exact vendor/asset/amount/deadline intent | No model call, arbitrary target/calldata, or signing. |
| Recovery reconciler | Deterministic `PAID | PENDING | RECOVERY_REQUIRED` from persisted identifiers | No model call; cannot invent or replace an intent or payment. |
| Coordinator | Pure envelope/proof/quorum/policy transitions | No discretionary override. |
| Human | Approves the exact persisted Testnet effect | Cannot override missing proof, veto, policy, or human-backed gate. |

The two model agents require distinct runs, role contexts, tool allowlists, run IDs, and proofs. One response role-playing both personas is rejected. Settlement and recovery stay deterministic to reduce paid-call and authority surface.

### State Machine And Invariants

```text
DRAFT -> EVIDENCE_BOUND
  -> EVIDENCE_COMPLETE -> RISK_COMPLETE -> PROPOSALS_VERIFIED
  -> QUORUM_VERIFIED
      -> REFUSED                         terminal, zero effect
      -> REVIEW                          terminal, zero effect
  -> POLICY_VERIFIED -> HUMAN_APPROVED
  -> EFFECT_PREPARED -> SUBMITTED -> PAID -> RECEIPTED

post-submit ambiguity -> RECOVERY_REQUIRED -> PAID | PENDING | RECOVERY_REQUIRED
```

- `intentId = hash(domain, evidenceHashes, vendor, amountAtomic, asset, network, deadline, nonce)`.
- External text and model output are untrusted data.
- Agents propose; pure policy and named humans authorize.
- Store atomic amounts as decimal strings; no floating point for value.
- Persist exact artifact/hash/identifier before broadcast.
- Retry reconciles the same intent/effect; it never creates a replacement blindly.
- Any missing proof, disagreement, veto, review, timeout, stale input, policy mismatch, unverified human-backed agent, or sponsor outage creates zero economic preparation.

### Minimum Module Map

```text
src/domain/{evidence,state-machine,events}.ts
src/agents/{protocol,evidence,risk}.ts
src/orchestration/{coordinator,quorum}.ts
src/kernel/{settlement,recovery}.ts
src/effects/outbox.ts
src/integrations/zero-g/{infer,verify}.ts
src/integrations/hedera/{payment,mirror}.ts
src/receipts/canonical.ts
tests/{unit,adversarial,e2e}/
docs/{BASELINE,ARCHITECTURE,EVIDENCE,TRACK-MATRIX}.md
```

### Reference-Only TypeScript Patterns

> [!warning] Materialize after H0 only
> These patterns intentionally use no vendor SDK signatures. At H0, copy exact package names and calls from pinned official examples, add runtime validation at each adapter, and commit the event-window implementation incrementally.

Fail-closed model boundary:

```ts
type AgentDecision =
  | Readonly<{ ok: true; runId: string; proofHash: `0x${string}`; outputHash: `0x${string}` }>
  | Readonly<{ ok: false; code: "REFUSE" | "REVIEW" | "PROOF_INVALID" | "TIMEOUT" }>;

const isUsable = (decision: AgentDecision): decision is Extract<AgentDecision, { ok: true }> =>
  decision.ok;
```

Pure economic gate:

```ts
type EffectGate = Readonly<{
  evidence: "PAY" | "REFUSE" | "REVIEW";
  risk: "CLEAR" | "VETO" | "REVIEW";
  settlement: "EXECUTABLE" | "BLOCKED";
  proofsVerified: boolean;
  treasuryPolicyAccepted: boolean;
  humanApproved: boolean;
}>;

export const mayPrepareEffect = (gate: EffectGate): boolean =>
  gate.evidence === "PAY" &&
  gate.risk === "CLEAR" &&
  gate.settlement === "EXECUTABLE" &&
  gate.proofsVerified &&
  gate.treasuryPolicyAccepted &&
  gate.humanApproved;
```

If a later World pathway passes its product-removal gate, create a new frozen policy version and explicit AgentKit condition. Never smuggle it into the core as a hard-coded `true` or weaken policy dynamically because a sponsor is unavailable.

Idempotent effect identity:

```ts
import { createHash } from "node:crypto";

export const effectId = (intentId: string, stateVersion: number): string =>
  createHash("sha256")
    .update(`proofrail:hedera-payment:v1:${intentId}:${stateVersion}`)
    .digest("hex");
```

### Required Tests

| case | assertion |
|---|---|
| Valid obligation | Two distinct verified proofs and one approval/effect/receipt. |
| Agent disagreement | `VETO`, `REVIEW`, or `BLOCKED` creates no prepared effect. |
| Fake multi-agent | Reused run/output/prompt identity is rejected. |
| Prompt injection | Invoice text cannot change roles, tools, policy, recipient, or destination. |
| One-byte tamper | Proof/output verification fails before World/Hedera calls. |
| Bot/unverified agent | Required only if a later World policy version is explicitly selected. |
| Duplicate/concurrent intent | One effect ID and balance change. |
| Timeout/restart after submit | Reconcile persisted identifier; never replace. |
| Missing human approval | No execution. |
| Sponsor unavailable | Cut optional track or stop core; never mock success. |
| Fresh clone | Install, lint, typecheck, test, build/start, live smokes, and both E2Es pass. |

### H-Gates And Fallbacks

| gate | ProofRail pass | response |
|---|---|---|
| H0–H3 | Real 0G proof/readback and bounded Hedera transfer/readback probes | If red, select AquaSentinel when its official baseline is green; otherwise SealSwitch. Create the selected clean repo only after selection. |
| H3–H10 | Strict envelopes, two distinct roles, deterministic veto/quorum, state machine, outbox; disagreement yields durable zero-effect receipt | Red → one final pivot; after H10 narrow or stop. |
| H10–H20 | Two verified 0G runs and exactly-once Hedera Testnet effect | 0G red → `STOP`; Hedera red → remove payment claim or pivot if still before H10. |
| H20–H26 | Reliability, replay/restart, receipt verifier; optional third-partner removal test only if core is already green | Default is no third partner. Never delay core for World/The Graph. |
| H26–H30 | Resettable refusal/tamper/replay/success UI and canonical receipt | Cut all optional features and cosmetic UI. |
| H30–submission | Fresh clone, complete checks, live IDs, secret scan, videos/forms, two rehearsals | Red sponsor artifact → remove claim; red core → `STOP`. |

### Four-Minute Demo

| time | proof |
|---|---|
| 0:00–0:30 | Show a forged/ambiguous synthetic obligation and the user loss. |
| 0:30–1:20 | Evidence and Risk run separately on 0G; show distinct proof/input/output hashes and disagreement. |
| 1:20–1:50 | Veto path creates a durable zero-effect receipt; no Hedera preparation. |
| 1:50–2:25 | Valid obligation reaches the deterministic settlement compiler; show exact trusted recipient, amount, network, and deadline. |
| 2:25–3:15 | Human approves exact atomic amount/payee/deadline; one Hedera Testnet effect settles. |
| 3:15–3:45 | Replay/restart reconciles the same public ID and produces no second balance change. |
| 3:45–4:00 | Show canonical receipt, event-window commits, and one sentence per sponsor-owned guarantee. |

## Event-Window Engineering Setup

### Separation

| surface | Project A | Project B |
|---|---|---|
| Repository | Existing Cannes repo, clean event worktree from immutable baseline | New public repo created only after H3 selection |
| Branch | `feat/lisbon-event-window` | `feat/proofrail-mvp` or selected fallback |
| Accounts/wallets | Dedicated A identities and Testnet caps | Dedicated B identities and Testnet caps |
| Evidence | `docs/lisbon/evidence/` in A repo | `docs/evidence/` in B repo |
| Secrets | Server-side environment only; redacted `SET/NOT_SET` manifest | Same; never copy A values |

### After-H0 Setup Templates

Project A uses its existing lockfile/package manager and baseline; do not silently migrate package managers during the event:

```bash
git fetch origin --prune
git worktree add -b feat/lisbon-event-window ../ETH_Global_Cannes_2026-lisbon <verified-baseline-sha>
cd ../ETH_Global_Cannes_2026-lisbon
git status --short --branch
```

Project B, only after H3 selection:

```bash
mkdir proofrail && cd proofrail
git init -b main
git switch -c feat/proofrail-mvp
corepack enable
pnpm init
```

Then add only the selected official packages at pinned versions. Record source URL, repository commit, package integrity, network, and copied example path. Missing or failing official baseline is `BLOCKED`, not permission to invent an API.

Every release candidate must run the repository equivalents of:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Also run migrations, contract/Move tests when present, live sponsor smokes, secret scan, fresh-clone install, success E2E, refusal/tamper E2E, and replay/restart E2E.

## Official Repositories And Online Setup Material

| use | primary material | boundary |
|---|---|---|
| 0G verified inference/storage | [Builder Hub](https://build.0g.ai), [docs](https://docs.0g.ai), [Private Computer](https://pc.0g.ai) | Pin current package names and proof APIs at H0; response metadata alone is not verification. |
| World human-backed agent gate | [AgentKit integration](https://docs.world.org/agents/agent-kit/integrate), [World docs MCP](https://docs.world.org/model-context-protocol) | Use AgentKit, not generic World ID login; minimize retained identity data. |
| Hedera payment/schedule | [Agent Kit](https://github.com/hashgraph/hedera-agent-kit), [SDK snippets](https://github.com/hedera-dev/hedera-code-snippets), [scheduler template](https://github.com/hedera-dev/scaffold-hbar/tree/templates/payments-scheduler), [Mirror REST](https://docs.hedera.com/hedera/sdks-and-apis/rest-api) | Testnet only; persist and reconcile exact IDs; template is reference, not a second app. |
| ENS agent identity | [ENSIP-25](https://docs.ens.domains/ensip/25/), [ENSIP-26](https://docs.ens.domains/ensip/26/), [ENS CLI](https://github.com/ensdomains/ens-cli) | Pin draft record mapping; live resolve must affect execution. |
| Sui private package fallback | [EVM × Sui](https://mystenlabs.github.io/evm-sui/), [Walrus docs](https://docs.wal.app/) | Ciphertext upload is not authorization; same-network permit/revoke must gate decryption. |
| AquaSentinel fallback | [Aqua contracts](https://github.com/1inch/aqua), [Aqua SDK](https://github.com/1inch/sdks/tree/master/typescript/aqua), [SwapVM template](https://github.com/1inch/swap-vm-template) | Follow the starter lockfile/commands; model never emits trusted bytecode. |
| The Graph optional tooling research | [AI overview](https://thegraph.com/docs/en/ai-overview/), [Substreams skills](https://github.com/streamingfast/substreams-skills), [Subgraph MCP](https://thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp/introduction/) | Do not add to selected builds unless live Graph data or reusable tooling is the product guarantee. |
| Uniswap alternate | [developer docs](https://developers.uniswap.org/docs), [Uniswap AI](https://github.com/Uniswap/uniswap-ai), [feedback form](https://developers.uniswap.org/hackathon-feedback) | API key must be core; `FEEDBACK.md`, form, and code pointers are mandatory. |

## Final Contract

- **Project A:** `NARROW` to 0G + ENS; add Sui or Hedera only after its removal test and live evidence pass.
- **Project B:** `BUILD` ProofRail only after H0 and green 0G/Hedera probes; keep third-partner scope empty unless a later removal test proves a new invariant without delaying core.
- **Fallback:** AquaSentinel, then SealSwitch; one pivot by H10.
- **STOP:** invalid provenance/H0, pre-event Project B artifacts, strict 0G proof failure, mock sponsor path, model-held signing authority, non-replay-safe money effect, or missing live mandatory evidence.
