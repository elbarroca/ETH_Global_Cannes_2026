---
title: AlphaDawg Async Developer Branch Goal Pack
aliases:
  - AlphaDawg Async Goals
  - AlphaDawg Developer Branch Prompts
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - prompt/goal
  - execution/async
status: active
updated: 2026-07-23
project_id: alphadawg
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
product_branch: developer
decision: NARROW
---

# AlphaDawg Async `developer` Branch Goal Pack

> [!important] Canonical execution pack
> Use this pack for AlphaDawg only. It replaces the older 0G + Hedera + Uniswap execution prompts for the current Lisbon implementation. The protected core is **authenticated hiring + strict 0G delivery + stable ENS identity**. Sui is optional and may start only after the ENS live gate passes.

> [!danger] Current boundary
> The AlphaDawg repository already exists at `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Cannes_2026` on baseline `bfa7bd37c573e2e49525d965f7f937210e170d72`; cloning is not currently required. Do not create `developer`, edit product code, commit, push, deploy, sign, transact, or spend until A0 proves that official Hacking Begins is live and records admissible evidence. Until then, only run research, read-only checks, and disposable probes that cannot contaminate the submission.

## Shared execution contract

Every prompt below must preserve these rules:

- Project scope: AlphaDawg only. Never mix Project B files, decisions, agents, or evidence into this repository.
- Product repository: `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Cannes_2026`.
- Clone fallback: only if that exact path is not a Git repository, clone `https://github.com/elbarroca/ETH_Global_Cannes_2026.git` into it, then verify the immutable baseline before continuing.
- Immutable start: `bfa7bd37c573e2e49525d965f7f937210e170d72`.
- Shared branch: every implementation, test, evidence, and release commit uses the user-selected branch `developer`.
- Use exactly one dedicated event-window worktree on `developer`. No alternate implementation branches, parallel worktrees, cherry-pick lanes, force pushes, or history rewrites.
- One active writer: only one agent may modify files, install packages, run formatters that write, commit, or push at a time. Read-only agents and disposable probes may run concurrently.
- Every writer packet must declare `owner`, `task_id`, `allowed_paths`, `start_sha`, `expected_exit`, and `acceptance_evidence` in `docs/lisbon/ACTIVE-WRITER.md`. At most one record may have `status: active`.
- Every writer starts with branch, SHA, and dirty-state checks. Unexpected edits or a mismatched branch are a hard stop; never erase or overwrite them.
- Every task produces an atomic commit, a `CHANGELOG-LISBON.md` entry, and evidence under `docs/lisbon/`. Never commit secrets, private keys, personal data, success-shaped mocks, or unverifiable sponsor claims.
- Models may propose typed records. Deterministic policy and isolated signers authorize effects. Never execute arbitrary model-generated calldata.
- Use atomic value units, runtime validation at external boundaries, allowlists, caps, deadlines, idempotency keys, append-only events, and explicit terminal failure states.
- Keep `research_only_not_promotable` until every eligibility, live sponsor, end-to-end, and submission-evidence gate passes.
- The implementation is not complete without the product repository's lint, typecheck, test, build, live sponsor smoke, fresh-clone replay, secret scan, and full demo replay.
- Push only when the operator has explicit authorization and authenticated Git access. If push access is absent, record `BLOCKED_PUSH_ACCESS`; do not pretend the remote is current.

## Dependency and concurrency map

| Lane | Mode | Depends on | May overlap | Product-repo writes |
|---|---|---|---|---|
| A0 authority and branch gate | synchronous | nothing | official-source watch | only after H0 evidence |
| A1 foundation | synchronous writer | A0 | P0 0G probe, E1 ENS probe, S0 Sui probe | yes |
| A2 authenticated hiring kernel | synchronous writer | A1 | read-only security/test design | yes |
| A3 strict 0G delivery | synchronous writer | A2 + P0 decision | E0 ENS deployment wait | yes |
| A4 stable ENS identity | synchronous writer | A3 + E1 decision | read-only demo/evidence review | yes |
| A5 optional Sui permit | synchronous writer | A4 live pass + S0 decision + time gate | read-only audit | yes, if admitted |
| A6 demo hardening | synchronous writer | protected core live | submission audit | yes |
| A7 release | synchronous writer | A6 | final read-only claim audit | yes |

Probe priority is `P0 0G -> E1 ENS -> S0 Sui`. A probe operates in a temporary directory, never in the product checkout, and returns a result packet to the coordinator. The coordinator stores it in the repository only while holding the writer lock.

## Controlling context

Read these exact files before executing any prompt:

1. `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault/strategy/alphadawg/ALPHADAWG_LISBON_MASTER.md`
2. `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault/strategy/alphadawg/17_Kickoff_H0_Runbook.md`
3. `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault/strategy/alphadawg/20_Track_1_0G_Keep_Ready_Setup.md`
4. `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault/strategy/alphadawg/21_ENSv2_Devnet_Research_and_Implementation_Gate.md`
5. `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault/strategy/alphadawg/16_Pre_Event_Clearance_Packet.md`
6. `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault/strategy/alphadawg/10_AlphaDawg_Current_Engineering_Audit.md`
7. `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault/strategy/alphadawg/13_E2E_and_Submission_Evidence_Plan.md`

## Goal 0 — master coordinator

Copy this into the primary Codex thread. It owns phase gates and assigns one writer at a time.

```text
/goal
Operate the AlphaDawg Lisbon build from authority gate through release using one transparent shared branch named `developer`. Work autonomously until the protected core is genuinely demo-ready, a hard gate blocks progress, or a cut/stop rule fires.

PROJECT CONTRACT
- project_id: alphadawg
- research_repo: /Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research
- product_repo: /Users/barroca888/Downloads/Dev/Personal/ETH_Global_Cannes_2026
- remote: https://github.com/elbarroca/ETH_Global_Cannes_2026.git
- immutable_baseline: bfa7bd37c573e2e49525d965f7f937210e170d72
- implementation_branch: developer
- decision: NARROW
- protected_core: authenticated hiring kernel -> ENS creator/agent identity and refusal checks -> strict verified 0G delivery
- optional_extension: Sui Seal/Move permit only after A4 passes live and time remains
- status_language: CONFIRMED | CONDITIONAL | PENDING | BLOCKED | REJECTED
- promotability_default: research_only_not_promotable

READ FIRST
Read every file listed in the Controlling context section of:
/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault/prompts/alphadawg-lisbon/06_GOAL_Async_Developer_Branch_Pack.md
Treat ALPHADAWG_LISBON_MASTER.md as the primary contract and the other files as gate-specific evidence. Resolve conflicts in favor of the newest official-source evidence, then this pack, then the master.

REPOSITORY BOOTSTRAP
1. If the product path is not a Git repository, clone the declared remote into that exact path. Otherwise do not clone or replace it.
2. Verify the remote, current SHA, working-tree state, and availability of the immutable baseline. Never discard unexpected changes.
3. Complete A0 exactly as defined in the H0 runbook. Before A0 passes, perform no product writes, commits, pushes, deployments, signatures, transactions, or spend.
4. After A0 passes, create `developer` exactly from the immutable baseline if neither a local nor remote `developer` exists. If it exists, switch to it only after proving that it descends from the immutable baseline and contains no unexplained pre-event implementation.
5. Use one dedicated event-window worktree on `developer`; do not create any other implementation branch or worktree. `developer` is a deliberate user-selected exception for hackathon transparency.

CONCURRENCY MODEL
- You are the only coordinator.
- Permit one mutating writer packet at a time, recorded in docs/lisbon/ACTIVE-WRITER.md.
- Read-only research, audits, and disposable P0/E1/S0 probes may run asynchronously.
- Probes must use temporary directories and return exact commands, versions, timestamps, transaction/receipt identifiers when applicable, logs, result, and blockers. They never edit or commit in the product repository.
- Store returned probe evidence only between writer packets while you hold the writer lock.
- Run the synchronous chain A0 -> A1 -> A2 -> A3 -> A4 -> optional A5 -> A6 -> A7. Never start a downstream mutation early.

IN-REPOSITORY CONTROL PLANE
After A0, create and maintain only the minimum durable files required by the existing repository structure:
- CHANGELOG-LISBON.md
- docs/lisbon/BASELINE.md
- docs/lisbon/TRACK-MATRIX.md
- docs/lisbon/ACTIVE-WRITER.md
- docs/lisbon/ARCHITECTURE.md
- docs/lisbon/EVIDENCE.md
- docs/lisbon/AI-DISCLOSURE.md
- docs/lisbon/CLAIM-MATRIX.md
- docs/lisbon/FRESH-CLONE.md
- docs/lisbon/evidence/ for raw redacted logs, IDs, and screenshots
Do not create duplicate planning systems if equivalent files already exist; extend the canonical location instead.

GATES AND CUTS
- A0: official start authority and clean baseline evidence.
- A1: install, lint, typecheck, test, build, CI, env validation, license, and migration path green.
- A2: authenticated one-creator/one-agent hiring loop, canonical JobIntent, immutable agent version, job/effect uniqueness, lease/idempotency, kill/restart tests.
- A3: one strict 0G adapter, usable-output verification, proof-enabled storage, tamper/outage/restart evidence, and no legacy Crawbot/OpenClaw critical dependency.
- A4: stable ENS creator and agent names resolve before 0G execution and before delivery; transfer, stale record, mismatch, and outage cause zero downstream calls.
- A5: admit Sui only if A4 is green, the S0 probe is green, at least six engineering hours remain before demo freeze, and Sui causally gates the same job. Otherwise record REJECTED_SCOPE_CUT.
- A6: deterministic reset/seed, observable sponsor state, refusal path, receipts, two timed four-minute rehearsals, and recovery runbook.
- A7: lint, typecheck, test, build, live sponsor smoke, secret scan, fresh clone, same-SHA deploys, full replay, claim audit, and submission evidence all pass.

CUT ORDER
1. Direct ENSv2 devnet integration; stable ENS remains.
2. Sui extension.
3. Non-essential dashboard polish.
4. Extra agents, marketplace breadth, payment/commission/trading features.
Never cut authentication, idempotency, strict 0G verification, ENS refusal checks, restart safety, or evidence capture.

OUTPUT AND REPORTING
- Make one atomic commit per accepted writer packet on `developer`.
- Record start SHA, end SHA, commands, results, evidence paths, blockers, and next admitted packet.
- Push incrementally only with explicit authorization and working authenticated access; never force push.
- At every gate, report PASS, FAIL, or BLOCKED with file and receipt evidence. A local mock, announced prize, or reachable sponsor URL is not a pass.
- Finish only with BUILD, NARROW, or STOP plus an audited claim matrix. Use BUILD only if all A7 evidence is live and replayable; use NARROW if the protected core is green but optional scope was cut; use STOP if the protected core cannot be demonstrated honestly.
```

## Goal 1 — A0/A1 foundation writer

```text
/goal
Own the single AlphaDawg writer slot for A0/A1 only. Establish the official event-window baseline and a production-capable repository foundation on the shared `developer` branch. Do not implement sponsor features or proceed to A2.

CONTEXT
- product_repo: /Users/barroca888/Downloads/Dev/Personal/ETH_Global_Cannes_2026
- remote: https://github.com/elbarroca/ETH_Global_Cannes_2026.git
- baseline: bfa7bd37c573e2e49525d965f7f937210e170d72
- branch: developer
- controlling_pack: /Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault/prompts/alphadawg-lisbon/06_GOAL_Async_Developer_Branch_Pack.md
- H0_runbook: /Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault/strategy/alphadawg/17_Kickoff_H0_Runbook.md

AUTHORITY GATE
- If A0 has not been evidenced, do read-only verification and stop BLOCKED_A0. Do not create the branch or write files.
- After A0 passes, verify or create `developer` from the immutable baseline without resetting, rebasing, or overwriting an existing branch.
- Confirm no other ACTIVE-WRITER is active. Claim the writer record with allowed paths before editing.

IMPLEMENT THE MINIMUM FOUNDATION
- Inspect the repository before choosing paths or commands; use its actual package manager and conventions.
- Make dependency installation deterministic and remove no dependency without evidence it is unused.
- Establish strict environment validation with redacted example variables and explicit startup failure for missing required runtime secrets.
- Repair the schema/migration path needed for the hiring kernel. Never use destructive production migration shortcuts.
- Ensure canonical lint, typecheck, test, and build scripts exist and succeed.
- Add proportional CI for install, lint, typecheck, test, and build.
- Add the repository license required by the selected track if absent.
- Create the minimal docs/lisbon control plane from Goal 0, reusing existing equivalents instead of duplicating them.
- Record exact baseline, event authority, changed files, dependency versions, commands, results, and known blockers.

TESTS
- clean dependency install
- missing/malformed environment variables fail closed
- migrations apply to a disposable database and can be replayed
- lint, typecheck, test, and build pass
- existing baseline behavior has no unexplained regression

EXIT
- Run the full repository checks.
- Update CHANGELOG-LISBON.md and docs/lisbon/EVIDENCE.md.
- Commit one atomic `chore:` or `feat:` commit on `developer`.
- Release ACTIVE-WRITER and report end SHA plus PASS/FAIL/BLOCKED.
- Do not start A2.
```

## Goal 2 — asynchronous sponsor probes

This goal is read-only with respect to the product repository. It can run while Goal 1 or another writer is active.

```text
/goal
Run the AlphaDawg sponsor-readiness probe queue asynchronously without modifying the product checkout. Execute P0 0G first, E1 ENS second, and S0 Sui third. Use disposable temporary directories, current official primary documentation, and the smallest bounded live smoke that proves or rejects compatibility. Return evidence packets to the master coordinator; do not commit them yourself.

CONTEXT
- product_repo_read_only: /Users/barroca888/Downloads/Dev/Personal/ETH_Global_Cannes_2026
- controlling_pack: /Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault/prompts/alphadawg-lisbon/06_GOAL_Async_Developer_Branch_Pack.md
- 0G_plan: /Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault/strategy/alphadawg/20_Track_1_0G_Keep_Ready_Setup.md
- ENS_plan: /Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault/strategy/alphadawg/21_ENSv2_Devnet_Research_and_Implementation_Gate.md
- no product-repo writes, installs, formatters, lockfile changes, commits, pushes, deployments, or transactions with value

P0 — 0G
- Revalidate the exact official 0G package names, versions, API signatures, runtime requirements, network endpoints, faucet/access needs, and proof semantics.
- In a disposable project, run the narrowest official SDK path that can create a request, process it, verify usable output, and store/retrieve a proof-enabled artifact.
- Resolve the existing split-package versus unified-package compatibility question with captured version and runtime evidence.
- Classify every shortcut or mock as REJECTED for sponsor proof.

E1 — ENS
- Revalidate current stable ENS write/update/resolve APIs and official test-network deployments using primary ENS and viem sources.
- Run a disposable stable-path probe for create-or-update, resolve, ownership mismatch, stale record, and unavailable resolver behavior if faucet/access permits.
- Treat direct ENSv2 devnet as PENDING unless official maintainers provide the exact chain, RPC, registry/resolver addresses, ABI/source, funding path, reset policy, and explorer.
- Never make the protected core depend on an unpublished or workshop-only endpoint.

S0 — SUI
- Revalidate Sui v2 gRPC, Seal, Walrus, Move package, network, faucet, and explorer prerequisites.
- Run only a bounded disposable encrypt/store/permit/decrypt/revoke compatibility probe if time and credentials permit.
- Determine whether the primitive can causally gate the same AlphaDawg job. If removing it leaves the guarantee unchanged, recommend REJECTED_SCOPE_CUT.

RETURN ONE PACKET PER PROBE
- probe_id and status: PASS | FAIL | BLOCKED
- accessed_at in Europe/Lisbon and UTC
- primary source URLs
- exact package/tool versions
- exact commands with secrets redacted
- network, addresses, request/transaction/receipt IDs, and explorer links when applicable
- observed output and failure logs
- compatibility decision and implementation consequences
- unresolved access dependency
- recommended next action and expiry/recheck time
Do not claim track eligibility, production readiness, or live proof from documentation alone.
```

## Goal 3 — A2 authenticated hiring kernel writer

```text
/goal
Own the single AlphaDawg writer slot for A2 only. On `developer`, implement the smallest authenticated, deterministic, restart-safe hiring kernel that later 0G, ENS, and optional Sui adapters can consume. Do not integrate sponsors yet.

PRECONDITIONS
- Read the controlling pack and AlphaDawg master.
- A0 and A1 must be PASS with evidence in the product repository.
- Verify branch `developer`, clean working tree, current SHA, and no active writer. Claim ACTIVE-WRITER with exact allowed paths.
- Inspect existing schemas, routes, services, auth, tests, and conventions before editing.

REQUIRED LOOP
1. A wallet signs a nonce-bound challenge with domain, chain, audience, expiry, and replay protection.
2. The server establishes a bounded authenticated session.
3. The creator selects one immutable agent version and submits a runtime-validated canonical JobIntent.
4. Deterministic policy validates creator, agent, capability, value cap, deadline, and uniqueness.
5. The system creates one job and one effect identity, acquires a bounded lease, and emits append-only events.
6. Repeated submission, retry, restart, and stale lease recovery cannot duplicate the economic or sponsor effect.

INVARIANTS
- one creator, one selected agent, one task, one delivery path
- immutable agent version per accepted job
- canonical serialization and stable idempotency key
- unique job/effect records enforced at the database boundary
- explicit states including queued, running, blocked, failed_terminal, cancelled, and completed
- authorization checked again before every future external effect
- no private key or arbitrary calldata available to a model
- no payment, commission, trading, marketplace breadth, reputation system, or extra agent role in the critical path

TESTS
- happy path
- malformed and expired challenge
- signature replay and cross-domain replay
- unauthorized creator or agent version
- duplicate submit and concurrent workers
- crash after persistence but before effect
- crash after effect receipt but before completion
- lease expiry and restart
- cancellation and terminal failure
- malformed external-boundary data

EXIT
- Run migration checks plus lint, typecheck, test, and build.
- Record architecture, state machine, trust boundaries, invariants, commands, and evidence under docs/lisbon/.
- Commit one atomic `feat:` commit on `developer`, release ACTIVE-WRITER, and report end SHA.
- Stop at A2; do not start 0G or ENS work.
```

## Goal 4 — A3 strict 0G writer

```text
/goal
Own the single AlphaDawg writer slot for A3 only. Using the accepted P0 result, integrate one strict 0G adapter into the authenticated hiring kernel on `developer`. A job may complete only when 0G returns usable verified output and proof-enabled storage evidence.

PRECONDITIONS
- A0, A1, and A2 are PASS.
- P0 has a current evidence packet and an explicit package/version decision.
- Verify branch `developer`, clean tree, current SHA, no active writer, and claim ACTIVE-WRITER.
- Read the 0G ready setup and current repository implementation before choosing APIs.

IMPLEMENTATION
- Use one typed adapter boundary for request, process/verify, store, retrieve, and receipt normalization.
- Use the exact official package/version/API proven by P0; do not invent signatures or retain competing adapters.
- Bind the canonical JobIntent hash, immutable agent version, creator, nonce, deadline, and idempotency key to the 0G request/evidence record.
- Treat `processResponse` or its current official equivalent as authoritative for usable output. A chat/request ID alone is not completion.
- Persist exact request IDs, network, model/agent identity, response digest, verification result, storage root/proof identifiers, timestamps, and redacted raw evidence before marking complete.
- Reconcile ambiguous network outcomes before retrying. Never create a replacement effect blindly.
- Make outage, malformed response, tamper, timeout, and verification failure explicit non-success terminal or retryable states.
- Isolate or remove Crawbot/OpenClaw from the AlphaDawg critical path. Preserve unrelated legacy code only when required, but prove the demo does not depend on it.

TESTS
- verified happy path with usable output
- chat/request ID exists but processing/verification fails
- tampered output or proof
- malformed provider response
- provider timeout/outage
- duplicate request and concurrent retry
- crash before broadcast, after broadcast, and after receipt persistence
- kill/restart resumes without duplicate 0G effects
- storage retrieval digest mismatch

EXIT
- Run lint, typecheck, test, build, one bounded live 0G smoke, and restart replay.
- Store redacted live identifiers/logs under docs/lisbon/evidence/ and update EVIDENCE.md and CLAIM-MATRIX.md.
- Commit one atomic `feat:` commit on `developer`, release ACTIVE-WRITER, and report end SHA.
- Do not start ENS or Sui.
```

## Goal 5 — A4 stable ENS identity writer

```text
/goal
Own the single AlphaDawg writer slot for A4 only. Add stable ENS identity and fail-closed resolution to the same authenticated hiring and 0G loop on `developer`. Direct ENSv2 devnet remains a separate conditional probe unless its official deployment packet is complete.

PRECONDITIONS
- A0 through A3 are PASS and the protected 0G path has live evidence.
- E1 has a current stable ENS package/network decision.
- Verify branch `developer`, clean tree, current SHA, no active writer, and claim ACTIVE-WRITER.
- Read the ENSv2 gate and inspect existing viem/wallet code. Pin or preserve the repository-compatible viem line proven by E1; do not guess APIs.

REQUIRED PRODUCT CAUSALITY
- Use a creator-controlled ENS identity and an agent-specific name/subname bound to the immutable agent version.
- Resolve and validate expected owner, resolver, records, capability/version metadata, chain/network, and freshness before the first 0G call.
- Resolve and validate again immediately before delivery is accepted.
- Persist the resolved name, address/owner, resolver, record digest, block number, chain ID, timestamp, and validation decision in the job evidence.
- Ownership transfer, stale data, record mismatch, wrong chain, resolver outage, or absent name must cause zero new downstream 0G calls and zero delivery acceptance.
- ENS is not decorative discovery; removing it must remove the identity guarantee.

ENSV2 RULE
- Admit direct ENSv2 devnet implementation only if official evidence supplies chain ID, RPC, registry/resolver addresses, ABI/source, faucet/funding, reset policy, explorer, and a live smoke. Store it behind the same adapter boundary.
- If any field is missing, record PENDING_ENSV2_DEPLOYMENT_PACKET and ship the stable ENS path. Never substitute guessed workshop values or a local mock.

TESTS
- create/update/resolve stable identity
- expected owner and metadata match
- ownership transfer before execution
- transfer or mutation between first resolution and delivery
- stale record and wrong agent version
- wrong chain or resolver
- resolver/RPC outage
- repeated resolution and restart
- assert zero downstream 0G calls on every refusal case

EXIT
- Run lint, typecheck, test, build, one bounded live ENS smoke, the full ENS -> 0G -> delivery loop, and refusal/restart replay.
- Record transaction/receipt IDs, explorer links, resolved records, zero-call assertions, and redacted logs under docs/lisbon/.
- Commit one atomic `feat:` commit on `developer`, release ACTIVE-WRITER, and report PASS_LIVE_ENS or the precise blocker.
- Do not start Sui automatically.
```

## Goal 6 — optional A5 Sui writer

```text
/goal
Own the single AlphaDawg writer slot for optional A5 only. Add Sui only if the master coordinator explicitly admits it after PASS_LIVE_ENS. Make Sui Seal/Move permission causally gate decryption before the same 0G job; otherwise reject and stop without code changes.

ADMISSION GATE
- A0 through A4 are PASS, including a live ENS -> 0G loop.
- S0 is PASS with current package, network, faucet, explorer, and compatibility evidence.
- At least six engineering hours remain before demo freeze.
- The extension does not destabilize the protected core.
- Verify branch `developer`, clean tree, current SHA, no active writer, and claim ACTIVE-WRITER only after all admission fields are proven.
- If any field fails, record REJECTED_SCOPE_CUT and make no product-code change.

MINIMUM CAUSAL SLICE
- Encrypt the private job payload with Seal-compatible policy.
- Store ciphertext with Walrus and persist its digest/object identifier.
- Represent the job permit/revocation policy with the smallest auditable Move object or official equivalent.
- Before decrypting or invoking 0G, validate creator, immutable agent version, job ID, capability, deadline, revocation status, ciphertext digest, and network.
- A revoked, expired, mismatched, unavailable, or tampered permit must stop before decryption and before any new 0G call.
- Do not add generic marketplace, token, payment, commission, reputation, or multi-agent features.

TESTS
- allowed decrypt -> existing ENS check -> 0G execution -> delivery
- revoke before decrypt
- expiry, creator mismatch, agent-version mismatch, wrong job, wrong network
- tampered ciphertext or object digest
- Walrus/Seal/Sui outage
- duplicate attempt, restart, and ambiguous transaction reconciliation
- leakage scan proving plaintext is absent from logs, database fields, analytics, and committed fixtures
- zero new 0G calls for every refusal path

EXIT
- Run lint, typecheck, test, build, bounded live Sui smoke, full same-job replay, refusal/restart suite, and leakage scan.
- Store redacted object/transaction IDs and explorer links under docs/lisbon/.
- Commit one atomic `feat:` commit on `developer`, release ACTIVE-WRITER, and report end SHA.
- If live evidence is not achievable within the gate, revert only your own uncommitted packet safely and record the cut; never weaken the protected core.
```

## Goal 7 — A6/A7 demo, deployment, and release writer

```text
/goal
Own the single AlphaDawg writer slot for A6/A7. Freeze features, make the protected core judge-legible in under four minutes, deploy the same `developer` SHA, and perform a fail-closed release and submission audit. Do not add new product scope.

PRECONDITIONS
- A0 through A4 are PASS. A5 may be PASS or explicitly REJECTED_SCOPE_CUT.
- Verify branch `developer`, clean tree, current SHA, no active writer, and claim ACTIVE-WRITER.
- Read the E2E/submission evidence plan and current claim matrix.

DEMO SURFACE
- Show the user loss: hiring an autonomous service without provable identity, permission, or delivery.
- Show wallet authentication, selected immutable agent version, canonical job, and explicit policy decision.
- Show stable ENS resolution and the exact identity fields that gate execution.
- If Sui was admitted, show permit validation and decryption; otherwise do not mention it as implemented.
- Show the real 0G request, usable verified response, proof-enabled storage identifier, and canonical receipt.
- Show one forced ENS or permission refusal with zero downstream 0G calls.
- Show restart/replay producing no duplicate effect.
- Expose truthful loading, pending, blocked, failed, terminal, and completed states. Never use success-shaped fallback data.

PRODUCTION-DEMO SETUP
- Use the repository's approved deployment architecture. If the current master still applies, target Vercel frontend/API, managed PostgreSQL, and a Railway worker, all reporting the same Git SHA.
- Add deterministic reset/seed tooling that creates no fake sponsor receipts and cannot run against an unapproved production target.
- Add readiness output for commit SHA, database/migration status, worker lease health, required sponsor reachability, network, and latest successful evidence age without exposing secrets.
- Add structured redacted logs and a concise operator recovery runbook.
- Deploy only with explicit authorization and available credentials. Record BLOCKED_DEPLOY_ACCESS rather than fabricating a live state.

RELEASE GATE
1. deterministic install
2. lint
3. typecheck
4. unit and integration tests
5. production build
6. migrations on a disposable and target database
7. bounded live ENS and 0G smoke; Sui only if admitted
8. success, tamper/refusal, duplicate, partial failure, sponsor unavailable, kill/restart, and full replay tests
9. secret and plaintext leakage scan
10. fresh clone of `developer` using only documented setup
11. deployed services prove the same Git SHA
12. two timed four-minute rehearsals from deterministic reset
13. requirement-to-evidence and claim matrix audit
14. repository visibility, license, AI disclosure, submission fields, URLs, and public evidence identifiers verified

TRANSPARENCY
- Keep atomic history on `developer`; never force push or rewrite event-window commits.
- Push only with explicit operator authorization and authenticated Git access. If unavailable, record BLOCKED_PUSH_ACCESS with local/remote SHA difference.
- Distinguish local, testnet/devnet, deployed, and public evidence in every claim.
- An announced pool, inherited Cannes feature, mock, local receipt, or documentation-only integration is not qualification evidence.

EXIT
- Update CHANGELOG-LISBON.md, FRESH-CLONE.md, EVIDENCE.md, AI-DISCLOSURE.md, TRACK-MATRIX.md, and CLAIM-MATRIX.md with exact SHA and evidence links.
- Commit one atomic release/documentation commit on `developer` and release ACTIVE-WRITER.
- Return BUILD only if every protected-core and A7 gate is live, replayable, and auditable.
- Return NARROW if the protected core passes and optional Sui/direct ENSv2 was cut.
- Return STOP if identity, strict 0G verification, restart safety, or truthful public evidence cannot pass.
```

## Recommended launch order

1. Start **Goal 0** in the primary coordinator thread.
2. Before A0, run only official-source monitoring and planning.
3. Once A0 passes, start **Goal 1** as the sole writer and **Goal 2** as the read-only asynchronous probe lane.
4. After Goal 1 passes, run Goals **3**, **4**, and **5** sequentially as the same single-writer chain.
5. Start Goal **6** only if the coordinator admits Sui at A5.
6. Finish with Goal **7** and an independent read-only submission audit.

The protected critical path is `A0 -> A1 -> A2 -> A3 -> A4 -> A6 -> A7`. Goal 2 reduces sponsor uncertainty asynchronously; Goal 6 is optional and must never delay the protected core.
