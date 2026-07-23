---
title: GOAL AlphaDawg Server Agent Migration
aliases:
  - AlphaDawg OpenClaw Migration Goal
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - prompt/goal
  - engineering
status: locked_until_h0
updated: 2026-07-16
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
not_before: 2026-07-24T21:00:00+01:00
---

# GOAL — AlphaDawg Server-Agent Migration

> [!danger] Do not run before official H0
> This prompt changes product code. Before using it, verify the live ETHGlobal Hacking Begins clock. If the window is not open, do not invoke it; use [[strategy/alphadawg/19_Pre_Hackathon_Code_Freeze_and_Change_Map]] for planning only.

## Copy/Paste Prompt

````text
/goal

Hard execution gate

- Before any repository write, verify from the live ETHGlobal schedule that the official Lisbon hacking window has opened.
- If it has not opened, STOP without changing any product file, branch content, dependency, schema, test, configuration, generated artifact, or deployment state. Return a planning-only gap report instead.
- Never push or deploy without separate explicit user authorization.

Objective

Implement the smallest production-shaped migration that removes OpenClaw as a required AlphaDawg runtime and replaces the hard-coded agent swarm with low-cost, standards-based server agents. Preserve the Cannes Arc x402 nanopayment path and working 0G capabilities, add dynamic external-agent onboarding and a typed commerce lifecycle, and prove success and failure paths end to end.

This goal changes code. Work surgically on a feature branch and verify every change.

Repository and baseline

- Repo: https://github.com/elbarroca/ETH_Global_Cannes_2026
- Baseline SHA: bfa7bd37c573e2e49525d965f7f937210e170d72
- Local checkout: discover the active checkout; /tmp/ETH_Global_Cannes_2026-019f6a69 may be read-only research context
- Strategy vault: /Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault
- Read repository AGENTS.md and strategy/alphadawg/10_AlphaDawg_Current_Engineering_Audit.md plus strategy/alphadawg/11_Server_Agent_Target_Architecture.md when available.

Authority and safety

- Create/use feature branch feat/lisbon-agent-commerce; never commit to main/master.
- Preserve unrelated user changes. Stop before overwriting overlapping dirty files.
- Do not commit, push, deploy, spend funds, rotate secrets, or delete working legacy assets unless explicitly authorized.
- Use current official docs for every unfamiliar A2A/x402/0G/Hedera API. Never invent signatures.
- Use strict TypeScript, named exports, unknown plus narrowing, parameterized persistence, and validation at external boundaries.
- Work autonomously through non-blocked tasks. Use subagents only for bounded independent investigation or verification when available.

Required architecture

Use one deployable agent API/orchestrator and one independently runnable external-provider example. Do not deploy one VM/container per specialist.

Core boundary interfaces:

- AgentDirectory: register, verify endpoint ownership, discover, disable
- AgentTransport: fetch Agent Card and run task
- CommerceStore: persist state transitions and idempotency
- ProofVerifier: verify output/proof binding before economic action
- PaymentRail: Arc x402 or Hedera, selected per quote
- ExecutionVenue: Uniswap adapter later; no MockSwapRouter success in the new path

Core state machine:

REQUESTED -> QUOTED -> AWARDED -> RUNNING -> DELIVERED -> VERIFIED -> SETTLED -> EXECUTED -> SCORED

Terminal failures:

REJECTED, EXPIRED, CANCELLED, VERIFICATION_FAILED, SETTLEMENT_FAILED, EXECUTION_FAILED

Every transition must be explicit, append-only or auditable, authorized, version-checked, and idempotent.

Phase 1 — Baseline and dependency map

1. Confirm remote/local SHA and dirty state.
2. Trace all OpenClaw references in runtime code, types, UI, env, Docker/Fly deploy, scripts, 0G iNFT/Agentic ID metadata, docs, and tests.
3. Classify each dependency: runtime-critical, metadata/content asset, observability-only, deployment-only, or stale documentation.
4. Record the current test/build baseline before editing.
5. Write docs/lisbon/OPENCLAW-MIGRATION.md with retain/adapt/deprecate/remove decisions and rollback checkpoints.

Phase 2 — Canonical schemas and persistence

Add one canonical typed model for:

- AgentCardReference and verified provider
- capability and pricing terms
- TaskRequest with schema/version, budget, deadline, and idempotency key
- signed Quote with provider, asset, amount, expiry, chain, endpoint, and nonce
- Award
- Delivery with output hash, proof/attestation reference, and provider signature
- VerificationResult
- SettlementReceipt
- ExecutionReceipt
- Feedback/ReputationEvent

Use integer atomic units for value; never floating-point dollars. Bind every signature/proof/receipt to taskId, quoteId, provider identity, payload hash, schema version, and expiry.

Extend Prisma or the existing store minimally. Add migrations and indexes for task status, provider, idempotency key, expiry, and unique settlement/execution constraints. Do not create duplicate registries.

Phase 3 — Dynamic server agents

1. Serve a current A2A-compatible Agent Card at the standard well-known endpoint.
2. Implement only the minimum current A2A task surface required for discovery, request, status, and artifacts. Document any intentionally unsupported optional features.
3. Add external provider onboarding by Agent Card URL.
4. Validate HTTPS/allowed development URLs, size, content type, schema, timeouts, redirects, and private-network/SSRF rules.
5. Prove endpoint control using a nonce challenge or current standard mechanism.
6. Store the verified provider and capabilities. A new provider must become discoverable without editing agent-registry.ts, role-manifests.ts, or environment-specific URL lists.
7. Replace fixed role pools with capability queries and policy-bounded ranking.
8. Build one independently signed external provider example that can quote and deliver a real 0G-backed analysis task.

Phase 4 — Low-cost runtime

1. Run built-in agents as routeable strategies/workers behind one server, not separate Fly applications.
2. Remove AGENT_NAME as the core routing mechanism.
3. Add per-task timeout, concurrency cap, retry budget, cancellation, and structured health/readiness endpoints.
4. Add per-user/task budget caps and maximum number of model calls.
5. Cache only safe public inputs; never cache signed quotes, private prompts, or user-specific delivery data across tenants.
6. Produce an operating-cost table for idle, demo, and 100-task scenarios. Clearly state unknown network/inference costs.
7. Keep deployment topology to one application service plus database and the separate provider demo where required. Prefer scale-to-zero/free-tier-compatible infrastructure.

Phase 5 — Preserve and isolate payment/proof behavior

1. Keep existing built-in specialist -> Arc x402 $0.001 as paymentRail=arc_x402.
2. Allow external quotes to advertise another supported rail, initially paymentRail=hedera, but do not fake Hedera settlement in this migration goal.
3. Enforce exactly one settlement per delivery and prohibit Arc plus Hedera double-payment.
4. Keep 0G sealed inference and proof-bearing output as the provider intelligence path.
5. Verification must fail closed. A missing, mismatched, stale, or tampered proof cannot trigger settlement, execution, reputation gain, or a success UI.
6. Give every provider an independent signer/account; do not derive external identities from one shared mnemonic.
7. Remove forced BUY behavior from the new commerce path. An agent's HOLD or rejected result must remain authoritative.

Phase 6 — Compatibility and deprecation

- Retain OpenClaw SOUL/IDENTITY content only where it is useful input data or baseline evidence.
- Replace OpenClawGateway status with neutral AgentRuntime/Provider status.
- Stop making runtime success depend on an OpenClaw gateway probe.
- Adapt 0G Agentic ID/iNFT metadata so identity points to the new Agent Card endpoint.
- Mark OpenClaw deploy scripts/config as legacy after parity passes; do not delete before the replacement is verified.
- Update README and env examples so a fresh clone does not require OpenClaw.

Required tests

Add a standard pnpm test script using the smallest suitable existing or new test setup. Cover:

1. valid and invalid Agent Card parsing
2. SSRF/private-network rejection with explicit local-dev override
3. endpoint ownership challenge
4. capability discovery without source edits
5. signed quote verification, expiry, nonce, and tampering
6. legal and illegal state transitions
7. optimistic concurrency and duplicate requests
8. successful 0G-backed delivery verification
9. tampered/missing proof -> no settlement/execution
10. Arc legacy payment rail regression
11. payment-rail exclusivity and duplicate settlement
12. provider timeout/retry/cancellation
13. forced BUY regression: HOLD remains HOLD
14. external provider full request-to-verified-delivery flow

Verification commands

Run and report actual output for:

- pnpm lint
- pnpm typecheck or pnpm exec tsc --noEmit
- pnpm test
- pnpm validate
- pnpm validate:approval
- pnpm build

If repository contract code changes, also run the project-equivalent contract compile/tests. Do not report complete while a required command fails. Distinguish pre-existing failures with before/after evidence.

Definition of done

1. A fresh clone starts the new runtime without installing or launching OpenClaw.
2. One host serves multiple built-in agent capabilities.
3. A separately running provider joins via Agent Card URL without a registry code edit.
4. The provider returns a signed variable-price quote for a caller-supplied typed task.
5. A valid delivery is cryptographically bound to the awarded task and passes 0G verification.
6. A tampered delivery fails closed and creates no payment or execution authority.
7. Replaying the same idempotency key creates no duplicate task, payment, or future execution.
8. Existing Arc x402 $0.001 built-in-specialist behavior still passes its regression test.
9. No forced trade or mock success exists in the new path.
10. Documentation, environment template, migration, and test commands work from a fresh clone.

Cut order

If time is constrained, cut in this order:

1. ERC-8004 writes and onchain reputation
2. streaming and push notifications
3. multiple external-provider types
4. sophisticated auction scoring
5. marketplace visual redesign

Never cut typed lifecycle, dynamic onboarding, independent signing, proof fail-closed behavior, idempotency, Arc regression, or the external-provider E2E test.

Stop rules

- Stop before destructive deletion, production deploy, mainnet action, unapproved spend, secret changes, or a push.
- If current A2A requirements conflict with the planned minimal surface, follow the current specification and document the delta.
- Do not replace OpenClaw with another heavy framework unless measured evidence shows it reduces complexity and cost.
- Do not hide failures behind mocks, deterministic fallback signals, self-transfers, or success-shaped fixtures.
- If contributor rights or Continuity authorization is unresolved, code may remain internal preparation but submission readiness stays BLOCKED.

Final response

Return the implemented vertical slice, key changed files, migration status, operating topology, real verification results, remaining blockers, and the next goal. Do not claim deployment or sponsor eligibility unless actually verified.
````
