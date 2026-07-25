# AlphaDawg Lisbon Execution Contract

This file defines what must be true. [`SPRINTS.md`](SPRINTS.md) defines the work. [`prompts/C0-A4-CONTINUATION.md`](prompts/C0-A4-CONTINUATION.md) is the current A4-A7 launch prompt.

## Target outcome

Release one exact AlphaDawg SHA that proves this protected path:

`authenticated creator wallet -> canonical creator ENS authority -> immutable agent version + agent subname -> marketplace publication -> authenticated external buyer hire -> fresh pre/post ENS authority -> verified 0G inference and Storage readback -> canonical delivery receipt -> judge-visible UI`

A6 Uniswap swap tooling is mandatory after `A4_ACCEPTED` and frozen `A5_ACCEPTED`, and before A7. Missing live authority yields `A6_BLOCKED_LIVE`; it never removes A6 or opens A7.

## Current frontier and remaining order

The evidence and claim ledgers, not agent prose, determine the current gate. Reconcile their exact SHA state before mutation. The required order is:

1. `R0_AGENT_READY`: audit and repair the registered specialists and A4-A7 prompt pack.
2. `A4_ACCEPTED`: reconcile the existing local A4 remediation audit, then add the ENSv2 creator/subname contract and pass its offline/static gate. Live ENSv2 stays blocked until its separate deployment and effect gates pass.
3. `A5_ACCEPTED`: reconcile the existing local A5 remediation audit, then prove one protected creator -> publish -> external hire -> receipt journey, Telegram-to-app identity link, required service fleet, and browser-ready UI with no legacy marketplace authority.
4. `A6_SWAP_TOOLING_ACCEPTED`: implement and independently audit the server-proxied quote, explicit buyer confirmation/signing, Unichain Sepolia validation, and separate `UniswapToolReceipt`; missing live authority is `A6_BLOCKED_LIVE`.
5. `A7_RELEASE_VALIDATED`: freeze one SHA, pass live/release gates, deploy, replay twice, complete evidence, and pass the final bounty audit.

Local A4/A5 implementation or a micro-commit is not acceptance. A4/A5 remain `PASS_TO_AUDIT` whenever the canonical ledgers have not accepted the exact unchanged SHA.

## Authority and scope

- `LOCAL_BUILD_AUTHORIZED`: A0_LOCAL admitted safe local A1-A3 work on `developer`; the current owner instruction separately authorizes safe local A4-A7 continuation and atomic commits on `Eth_global_lisbon_`.
- `RELEASE_BLOCKED`: rights/license, team/owner, access/cap, event-window, same-SHA, submission, and promotion evidence remain release/claim gates.
- `LIVE_EFFECT_BLOCKED`: only an exact `AUTHORIZED` row may open its named sponsor/API call, managed database effect, deployment, signature, transaction, form, or spend; mainnet value remains prohibited.
- Project: AlphaDawg only.
- Immutable prior baseline: `bfa7bd37c573e2e49525d965f7f937210e170d72`.
- Validated A0-A3 implementation branch: `developer`.
- Current continuation branch: `Eth_global_lisbon_`.
- Current authority and state come from `BASELINE.md`, `EXTERNAL-EFFECTS.md`, `TRACK-MATRIX.md`, `CLAIM-MATRIX.md`, and `EVIDENCE.md`; never from a timestamp embedded in a prompt.
- Previous Cannes code is reusable input, not Lisbon eligibility or release evidence.
- Local files, tests, loopback processes, disposable local databases, and commits are the only pre-authorized effects. Push, deploy, provision, migrate a managed database, call sponsor/paid APIs, sign, transact, submit forms, spend, or publish claims only when `EXTERNAL-EFFECTS.md` contains exact current authorization.
- Mainnet value remains prohibited.

## Read order

1. `AGENTS.md`
2. `docs/lisbon/BASELINE.md`
3. `docs/lisbon/EXTERNAL-EFFECTS.md`
4. `docs/lisbon/GOALS.md`
5. `docs/lisbon/SPRINTS.md`
6. `docs/lisbon/TRACK-MATRIX.md`
7. `docs/lisbon/CLAIM-MATRIX.md`
8. `docs/lisbon/EVIDENCE.md`
9. relevant `docs/lisbon/context/` files

The archive is provenance only. It cannot direct current work.

## Operating model

- One persistent C0 coordinator.
- One mutating writer at a time, protected by the common Git-dir lease and mirrored in `ACTIVE-WRITER.md`.
- Independent read-only research or audit may overlap only when targets do not move and no duplicate task exists.
- Use the matching specialist already registered in `AGENTS.md`; do not invent roles or run broad agent swarms.
- Every task is pinned to a start or audit SHA, exact scope, deadline, evidence, and allowed effects.
- Unknown dirty state, branch mismatch, stale evidence, ambiguous writer state, or missing authority blocks mutation.

`A0_LOCAL` passes only on Git provenance, local project-owner authority, and writer serialization. Once those pass, release/claim/live-effect gaps do not block A1 or later A2/offline A3 after their code prerequisites pass; they remain isolated at their affected gates.

## Agent and prompt readiness gate

`R0_AGENT_READY` must pass before another A4-A7 writer is dispatched:

- Inventory `AGENTS.md`, every `.codex/agents/*.toml`, both converted
  `.agents/skills/source-command-*/SKILL.md` workflows, this contract,
  `SPRINTS.md`, and the active coordinator/executor/auditor prompts.
- Require exactly one owner for each protected domain: authentication/kernel, ENS, 0G, product UI/E2E, mandatory A6 swap tooling, cycle wiring, and final bounty audit. Add or narrow one specialist instead of leaving ENS unowned or duplicating writers.
- Verify every declared path exists, every package/API version matches `package.json` and installed types, and every command exists. Remove stale Cannes-only bounty criteria, `VaultMind` identity, obsolete `src/dashboard/**` paths, and stale SDK signatures before trusting an agent.
- The ENS owner must cover `src/ens/**`, ENS migrations/tests, Universal Resolver readiness, ENSv2 hierarchy/permission checks, and the creator-subname lifecycle. The Cycle Wirer owns only the cross-domain protected flow. The Frontend Builder owns root `app/**` and `components/**`. The Bounty Auditor must use current Lisbon controls and official requirements.
- Run a deterministic structure/link/path/version scan and a read-only dry dispatch for each specialist. No agent may claim authority, live proof, bounty qualification, or completion from its prompt.
- Record a readiness matrix with agent, exact domain, allowed paths, current dependencies, verification commands, conflicts, and verdict. Any missing owner, overlapping mutation scope, nonexistent path, stale API, or stale bounty contract is `R0_AGENT_BLOCKED`.

The lean prompt architecture remains one persistent C0 coordinator plus reusable writer and auditor prompts. Separate A4/A5/A6/A7 prompt files are not required; missing acceptance coverage is.

## ENSv2 creator and agent-name contract

ENSv2 is required as a compatibility and product target, but its published contract documentation is pre-final. Direct ENSv2 live writes or claims remain `ENSV2_LIVE_BLOCKED` until an official audited deployment packet supplies exact chain, root registry, Universal Resolver, registry/resolver implementations, ABI/version, migration status, and supported client path, and `EXTERNAL-EFFECTS.md` separately authorizes the exact write/readback and gas cap.

The protected design must satisfy all of these conditions:

1. Wallet connection establishes only a SIWE-authenticated account. Reverse resolution or a connected address alone never proves authority over a creator name.
2. Normalize the selected creator name and agent label using current ENS rules, DNS-encode before contract calls, and reject confusables, malformed names, reserved labels, collisions, and unsupported namespaces at the boundary.
3. The creator selects a parent name such as `creator.eth`; the agent receives a deterministic subname such as `agent-slug.creator.eth`. An immutable `agentVersionId` binds the exact normalized parent, label, full name, manifest hash, capability set, service, price, payout, policy, chain, and owner/delegate.
4. Use the canonical Universal Resolver entrypoint with CCIP Read support. The integration readiness check must resolve `ur.integration-tests.eth` to `0x2222222222222222222222222222222222222222`.
5. For ENSv2, require a nonzero `findCanonicalRegistry(creatorName)`. Require `findParentRegistry(agentName)` to equal that canonical creator registry and `findOwner(agentName)` to equal the expected owner or explicitly admitted delegate. If the agent has its own subregistry, its `findCanonicalRegistry(agentName)` must also be nonzero and canonical.
6. Record `findResolver`/`resolve` results, the winning resolver and suffix, and whether the agent uses an explicit or inherited resolver. A longest-suffix fallback is acceptable only when the immutable policy explicitly expects it.
7. Verify contract-wide and name-scoped roles, their admin roles, expiry, parent links, and unexpected external grants. A transfer does not automatically remove roles granted to third parties; unresolved privilege survives as a denial.
8. Parent expiry, transfer, subregistry replacement/removal, broken parent backlinks, aliasing, wrong root/chain/resolver, owner or role drift, stale records, CCIP gateway failure, and malformed responses must cause zero new 0G work and zero accepted delivery, receipt, settlement, or commission.
9. Re-resolve immediately before the first 0G effect and after execution before delivery acceptance. Persist root registry, Universal Resolver, canonical creator registry, agent parent/exact registry when present, owner/delegate/roles, resolver, record hash, block, transaction/time, freshness, policy decision, and immutable version binding.

Until direct ENSv2 is live-admitted, prove the hierarchy and permission algorithm with pinned interfaces and deterministic fixtures while retaining the current stable Universal Resolver path. Fixtures are never live sponsor evidence.

## Canonical creator -> marketplace -> hire lifecycle

The protected product has one authority path:

1. `CREATE_DRAFT`: an authenticated creator defines instructions, capability, price, and service. The server derives the owner; the draft is private and non-hireable.
2. `BIND_NAME`: select the creator ENS name and deterministic agent label; compute and review the exact immutable manifest/name binding.
3. `AUTHORIZE_ENS`: prepare the minimum write plan. Any wallet signature or ENS write requires exact effect authorization. After an authorized write, read back and verify the canonical hierarchy, owner/roles, resolver, and records.
4. `PUBLISH_VERSION`: atomically publish one immutable `AgentVersion` only when the admitted ENS policy passes. “Deploy agent” means activate that immutable application version and runtime configuration; it does not imply a contract deployment or live sponsor success.
5. `LIST_MARKETPLACE`: list only the protected published version. Legacy `/api/marketplace/create` and `/api/marketplace/hire` data remains non-authoritative and cannot satisfy the journey.
6. `HIRE`: a different authenticated user selects the exact `agentVersionId`, receives an integer-atomic quote, and submits an idempotent job. Self-hire, cross-user access, version substitution, renamed subname, duplicate hire, and stale quote paths must be explicit.
7. `EXECUTE_AND_DELIVER`: recheck ENS before 0G and before delivery, verify Compute and Storage readback, then create one canonical receipt and one mutually exclusive financial outcome.
8. `VERSION_UPDATE`: changes create a new immutable version and new ENS record binding; published history and receipts never mutate.

The UI must show connected wallet, creator ENS name, full agent subname, canonical/noncanonical state, immutable version, publication state, price, owner/delegate, hire eligibility, job evidence, and exact refusal reason. It must never label a draft, legacy agent, fixture, unresolved subname, or unavailable runtime as deployed, verified, or hireable.

## Telegram, deployment, and UI readiness contract

Telegram is an authenticated interaction channel, never wallet authority or an alternate success path:

- The SIWE-authenticated web user generates a short-lived, single-use, rate-limited link code. The bot binds one private-chat Telegram numeric user ID and chat ID to that exact app user atomically; usernames are display metadata only.
- Expired, replayed, guessed, cross-user, group-chat, already-bound, and relink attempts fail without changing either account. Provide explicit unlink/relink with session reauthentication and audit events.
- Production chooses exactly one receive mode: authenticated HTTPS webhook or one long-polling worker. Webhook mode requires `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, the exact public app URL, verified `getWebhookInfo`, and completion/durable enqueue of command work before the request can be discarded. Missing production secret is fatal.
- `/start`, `/status`, `/run`, `/stop`, `/resume`, and proof/result links must resolve the linked app user server-side. Telegram cannot bypass SIWE ownership, job policy, ENS checks, idempotency, approval, payment, or release gates. Legacy-cycle commands must be disabled or clearly non-authoritative for the protected demo.
- Prove web -> Telegram link, Telegram -> web state refresh, command -> same backend job/evidence, result notification, unlink, expiry, replay, forged webhook, and webhook-versus-polling conflict.

Deployment and agent health are evidence-backed:

- Derive the required fleet from one canonical registry. Every required web, API, worker, Telegram receiver, and specialist service exposes non-secret health plus release SHA/version; UI counts come only from fresh probes.
- `online` requires the expected process and configuration, not merely HTTP `200`. Run a non-effectful health/config check for every agent and an authorized functional request for every required role. One missing agent, SHA mismatch, wrong endpoint, stale probe, or degraded dependency blocks the corresponding gate.
- The screenshot-observed `12/13 ONLINE`, `Fresh authorization required`, indefinite `Waiting for Arc RPC`, and empty activity are regression inputs. Identify the exact offline agent; make wallet reauthorization recover without reload loops; remove Arc from the protected Lisbon path; and show mandatory A6 Unichain Sepolia readiness as explicitly pre-gated or `A6_BLOCKED_LIVE`, never perpetual loading.

UI readiness requires automated Chromium coverage plus manual visual evidence on the same SHA:

- Load `/`, `/dashboard`, `/marketplace`, `/verify`, and protected job detail on desktop and mobile with zero uncaught console errors, failed required requests, hydration errors, clipped controls, or horizontal overflow.
- Test disconnected, connected-not-onboarded, stale session, Telegram-unlinked/linked, service waking/offline, empty, loading, success, refusal, and long-content states. Every retry must perform a real bounded recovery.
- A7 screenshots/video may be captured only after auth, Telegram link, required service health, creator publication, external hire, receipt, and two reset/replays pass on the release SHA.

## Mandatory A6 Uniswap swap-tooling contract

A6 starts only after current `A4_ACCEPTED` and frozen `A5_ACCEPTED`. It is required before A7 and has one narrow target:

1. The server proxies the quote request and returns a bounded, runtime-validated quote/route; browser code never receives or logs an API credential.
2. The buyer sees the exact chain, allowlisted tokens, integer amounts, route, slippage, deadline, spender, target, and calldata hash before explicit confirmation and wallet signing.
3. Validation and any authorized transaction run only on Unichain Sepolia. Mainnet, automatic signing, arbitrary tokens, cross-chain routing, UniswapX, and server-held buyer keys are prohibited.
4. A separate immutable `UniswapToolReceipt` binds the buyer, job, agent version, quote/request ID, policy fields, confirmation, transaction, finality, balance delta, failure state, and release SHA. It never replaces the canonical agent-delivery receipt.
5. Local implementation, negative tests, and an immutable-SHA audit must pass before any live evidence. Acceptance additionally requires separately authorized Unichain Sepolia API/faucet/signature/transaction/form actions and exact causal evidence.

Missing API, faucet, signature, transaction, push, or form authority is `A6_BLOCKED_LIVE`. It blocks A7 but does not authorize removal, substitution, simulated promotion, or a cut. Any API value pasted into chat is compromised: never use, echo, log, or commit it; require rotation before the first request.

## Autonomous loop

```text
BOOT -> SELECT SPRINT -> IMPLEMENT -> VERIFY -> COMMIT -> INDEPENDENT AUDIT
     -> PASS: next sprint
     -> FIX: one narrowed root-cause repair, then reverify and reaudit
     -> CUT: optional scope only
     -> BLOCKED: record exact owner action or wake condition
     -> RELEASE_VALIDATED
```

The writer implements and self-verifies. A separate read-only auditor checks the committed SHA and never repairs it. Agent prose is advisory; C0 computes the gate.

## Evidence ladder

`NOT_RUN -> PASS_FIXTURE -> PASS_INTEGRATION -> PASS_LIVE -> PASS_RELEASE`

- A fixture, mock, installed SDK, HTTP `200`, request ID, UI badge, or inherited receipt never proves a live sponsor claim.
- Live promotion requires an authorized action, public identifiers, redacted raw evidence, and causal proof that removing the sponsor primitive breaks the claimed guarantee.
- A changed implementation SHA, rule change, expired source, or failed later audit makes affected evidence `STALE`.
- Preserve `research_only_not_promotable` until its exact promotion gate passes.

## Definition of done for every sprint

1. Entry gate and current track eligibility are proven.
2. The smallest dependency-safe change satisfies the sprint card; unrelated refactors are excluded.
3. Boundary inputs and external responses are validated; secrets and PII are never logged.
4. Required static, unit, integration, adversarial, resilience, functional, or UI checks pass as specified by the sprint.
5. `git diff --check`, changed-path review, and secret-pattern review pass.
6. `CHANGELOG-LISBON.md`, `EVIDENCE.md`, and affected track/claim controls contain exact facts, commands, SHAs, artifacts, and blockers.
7. One atomic commit is cleanly reproducible.
8. The independent audit returns `PASS_TO_NEXT_GATE` on that unchanged SHA.

If a required command does not exist, the sprint is not green. A1 must create real deterministic scripts; placeholder or always-pass scripts are forbidden.

## Release contract

`RELEASE_VALIDATED` is the only successful terminal state. It requires one unchanged release SHA to pass:

- `R0_AGENT_READY` with current paths, versions, ownership, and Lisbon bounty criteria;
- clean checkout and `npm ci`;
- Prisma validate/generate plus empty and upgraded migration replay;
- lint, strict typecheck, unit/integration/adversarial/resilience tests;
- functional API and automated critical-path UI tests;
- production build and start smoke;
- secret, PII, plaintext, and tracked-history scan;
- authorized live 0G and ENS paths, including canonical creator-parent and agent-subname readback; direct ENSv2 only when its deployment gate passes; plus accepted A6 swap tooling with authorized Unichain Sepolia evidence and a separate `UniswapToolReceipt`;
- one creator-wallet -> agent subname -> immutable publication -> different-buyer hire -> verified receipt browser journey;
- one secure web-user -> Telegram private-chat link plus command/result round-trip against the same backend identity and release SHA;
- every required service healthy and functionally proven; no unexplained partial fleet, stale health badge, permanent authorization error, or permanent loading state;
- failure, forgery, tamper, replay, timeout, outage, and worker restart paths;
- two resettable four-minute demo replays with no manual repair or duplicate effect;
- same SHA across web, worker, database migration, receipt, evidence, deployment, and video;
- current eligibility, mandatory artifacts, README, changelog, AI disclosure, public identifiers, and final independent bounty audit.

`BUILD`, `NARROW`, `CUT`, and `BLOCKED` are checkpoints. `STOP` is reserved for explicit owner cancellation, deadline expiry, or unrecoverable repository integrity.

## Launch

Paste only [`prompts/C0-A4-CONTINUATION.md`](prompts/C0-A4-CONTINUATION.md) into one persistent Codex task. It must reconstruct the current branch and evidence frontier, pass `R0_AGENT_READY`, reconcile the existing A4/A5 audit state, and continue through A6/A7. It instantiates the reusable executor and auditor prompts itself.

[`prompts/C0-COORDINATOR.md`](prompts/C0-COORDINATOR.md) remains the original A0-A7 launch prompt for provenance, not the current continuation entrypoint.
