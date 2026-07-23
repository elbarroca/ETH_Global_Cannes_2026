---
title: GOAL AlphaDawg Lisbon 36 Hour Implementation and Evidence
aliases:
  - AlphaDawg Lisbon Sprint Goal
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - prompt/goal
  - execution
status: locked_until_h0
updated: 2026-07-16
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
not_before: 2026-07-24T21:00:00+01:00
---

# GOAL — AlphaDawg Lisbon 36-Hour Implementation and Evidence

> [!danger] Do not run before official H0
> This prompt changes product code and may exercise sponsor systems. Before using it, verify the live ETHGlobal Hacking Begins clock. Pre-H0 work is limited to [[strategy/alphadawg/19_Pre_Hackathon_Code_Freeze_and_Change_Map]].

## Copy/Paste Prompt

````text
/goal

Hard execution gate

- Before any repository write or sponsor-system mutation, verify from the live ETHGlobal schedule that the official Lisbon hacking window has opened.
- If it has not opened, STOP without changing product files, branch content, dependencies, schemas, tests, configuration, generated artifacts, deployments, or network state.
- Never push, deploy, sign, broadcast, or spend without the separately required user authority.

Objective

Execute the ETHGlobal Lisbon AlphaDawg sprint from the approved Cannes baseline to a submission-ready Continuity project. Build one real end-to-end agent-commerce loop that maximizes compatible 0G, Hedera, and Uniswap value; prove every qualifying integration on the required testnet/API; and assemble a judge-runnable evidence package with honest baseline disclosure.

Repository and controlling inputs

- Repo: https://github.com/elbarroca/ETH_Global_Cannes_2026
- Cannes baseline SHA: bfa7bd37c573e2e49525d965f7f937210e170d72
- Prizes: https://ethglobal.com/events/lisbon2026/prizes
- Rules: https://ethglobal.com/rules
- Vault: /Users/barroca888/Downloads/Dev/Personal/ETH_Global_Research/output/research-vault
- Read and obey strategy/alphadawg/09_Lisbon_Live_Track_and_Eligibility_Audit.md through strategy/alphadawg/13_E2E_and_Submission_Evidence_Plan.md when present.
- If those notes are absent or stale, run 01_GOAL_Master_Strategy first.

Execution portfolio

Build toward these tracks only when the live eligibility audit permits them:

- 0G: Keep Building; AI Product or Infrastructure & Tooling classification, with both product and reusable-package surfaces prepared where allowed
- Hedera: AI & Agentic Payments first; Cross-Chain Automation and Tokenization only after the core is green
- Uniswap Foundation: Best API Integration and Stack Contribution

Do not target Hedera No Solidity without explicit written approval resolving the existing Solidity/project conflict. Do not add 1inch or Sui. Preserve Arc x402 as a basic legacy rail, not Lisbon prize evidence.

Core demo narrative

An external server agent joins AlphaDawg through a discoverable Agent Card, receives a typed task, returns a signed variable-price quote, wins the task, produces a 0G-verifiable delivery, receives exactly one Hedera settlement, and emits a policy-bounded trade intent that executes through the Uniswap API. One receipt links task, quote, proof, settlement, transaction, and feedback. A tampered proof demonstrates the failure path.

Operating rules

- Work only on a feature branch. Preserve unrelated changes.
- At event kickoff, record the exact baseline and begin CHANGELOG-LISBON.md with timestamps and commit links.
- New Lisbon code must be clearly separable from Cannes code.
- Use primary current sponsor docs. Ask mentors early when an integration path is ambiguous.
- No mock or fallback may count as sponsor evidence.
- No mainnet funds or unapproved spend. Use sponsor-approved testnets/credits.
- Never expose keys, mnemonics, API keys, account IDs tied to private data, or PII.
- Use bounded parallel work where independent, but keep one integration owner for the common vertical slice.

Hour gates

H0-H2 — Eligibility and baseline

- Recheck live track text and partner limit.
- Obtain/record organizer and sponsor answers.
- Confirm contributor consent and license.
- Record baseline SHA, branch, team, pre-existing features, new-work boundary, and credentials readiness.
- Create docs/lisbon/BASELINE.md, docs/lisbon/TRACK-MATRIX.md, CHANGELOG-LISBON.md, and FEEDBACK.md.

Gate: no unresolved rights issue; target tracks labeled confirmed or conditional. Continue core work if sponsor questions remain, but do not claim eligibility.

H2-H10 — Commerce core and server agents

- Complete dynamic Agent Card onboarding, endpoint verification, capability discovery, typed task and signed quote.
- Run built-in capabilities behind the low-cost server runtime.
- Run one independent external provider.
- Persist the lifecycle with idempotency and explicit failures.

Gate: two discoverable provider options can quote one caller-supplied task; no source registry edit is needed.

H10-H17 — 0G proof and Continuity delta

- Produce the provider result through 0G Compute/Private Computer as required by the live track.
- Bind the proof/attestation to the task, quote, provider, input hash, output hash, and schema version.
- Persist relevant artifacts/receipts in 0G Storage if required by the chosen track.
- Update Agentic ID if used.
- Implement strict proof failure.
- Package the verifier/provider helpers as a reusable TypeScript surface if Infrastructure is eligible.

Gate: valid delivery passes; tampered delivery fails; failed verification has no economic or trading effect. The UI and logs expose real 0G evidence.

H17-H21 — Hedera Agentic Payments

- Let the quote declare HBAR/HTS asset, atomic amount, recipient, expiry, and Hedera account.
- Execute one real Hedera Testnet payment only after verification.
- Write an HCS audit record binding task, quote, proof, and settlement hashes where feasible.
- Confirm finality through Mirror Node and expose Hashscan evidence.
- Enforce exactly-once settlement.

Gate: one autonomous real Testnet payment and one replay attempt that produces no duplicate transfer.

H21-H26 — Uniswap

- Convert only a verified delivery into a typed TradeIntent.
- Enforce allowlisted chain, tokens, recipient, amount, slippage, deadline, route, and per-task/user limits.
- Use a valid Uniswap Developer Platform API key.
- Implement the current approval -> quote -> swap/order -> broadcast/sign -> status flow appropriate to the returned route.
- Correctly handle the current route union; never assume every quote is CLASSIC.
- Store request ID, quote/route, simulation result, transaction/order ID, and final status.
- Update FEEDBACK.md continuously and prepare the required feedback form.

Gate: one real supported-network transaction/order completes through the Uniswap API; a policy-invalid or unverified intent is rejected before signing.

H26-H30 — Cross-Chain Automation, only if core is green

- User creates and approves a bounded trading mandate.
- Hedera Schedule Service creates the qualifying scheduled trigger.
- The scheduled Hedera action dispatches Axelar GMP fully onchain.
- Destination contract validates mandate, sender, source chain, nonce, expiry, allowlist, and replay protection.
- Destination executes a real permitted Uniswap action and records final status.
- No bot, keeper, server cron, or manual API call may trigger the qualifying path.

Gate: schedule -> Hedera execution -> Axelar GMP -> destination action is visible end to end with transaction evidence. If this is not working by H30, cut it cleanly and protect the core demo.

H30-H32 — Tokenization, only if core and automation status allow

- Implement a sponsor-valid HTS service credit, invoice, or other defensible asset with a real lifecycle.
- Demonstrate creation, configuration, transfer, one meaningful compliance/custom-fee operation, and redemption/burn or settlement.
- Explain why tokenization is intrinsic to agent commerce rather than a bounty bolt-on.

Gate: lifecycle is real on Hedera Testnet and independently demoable. Cut before weakening the core.

H32-H36 — Evidence, submission, rehearsal

- Freeze features.
- Run all quality and sponsor-specific tests.
- Verify fresh-clone setup.
- Capture transaction IDs, explorer links, API request IDs, contract addresses, 0G proof/storage references, and before/after screenshots.
- Finish README, architecture diagram, track-to-code pointers, CHANGELOG-LISBON.md, What's Next, FEEDBACK.md, and disclosure.
- Record one <=3-minute 0G-compatible product video and one <=5-minute Hedera-compatible full flow, or a single edit that satisfies each current limit.
- Rehearse the success and tampered-proof demos twice.

Engineering requirements

Commerce and security:

- runtime-validated external inputs
- independent provider signers and settlement accounts
- integer atomic monetary units
- signed quotes with expiry and nonce
- proof/output/task binding
- append-only or auditable transitions
- optimistic concurrency
- idempotent task, settlement, and execution operations
- SSRF defense for provider URLs
- timeouts, retries, cancellation, and concurrency limits
- no shared mnemonic for third-party providers
- no forced BUY or silent fail-open result

Track-shaped deliverables:

- apps/alphadawg or equivalent: judge-ready AI product
- packages/agent-commerce-kit or equivalent: reusable 0G proof/agent-commerce tooling, only if this fits the repo without a speculative monorepo rewrite
- reusable VerifiedIntent -> UniswapExecution adapter
- AlphaDawg reference example using both
- concise architecture diagram and four-minute fresh-clone judge path

Mandatory end-to-end tests

1. external provider registration without source edit
2. two signed quotes for one typed task
3. deterministic award within budget
4. valid 0G-backed delivery
5. tampered proof -> no settlement and no trade
6. one Hedera Testnet payment and Mirror Node finality
7. repeated callback/request -> no duplicate payment
8. verified intent -> real Uniswap API execution and status
9. unverified/expired/out-of-policy intent -> no signature or transaction
10. Arc built-in specialist -> existing $0.001 x402 regression
11. provider timeout/cancellation recovery
12. one receipt resolves every evidence identifier
13. optional tracks: full onchain Cross-Chain path and full HTS lifecycle

Required verification

Run and save results for:

- pnpm lint
- pnpm typecheck or pnpm exec tsc --noEmit
- pnpm test
- pnpm validate
- pnpm validate:approval
- pnpm build
- contract compile/tests if contract code changed
- sponsor-specific live smoke scripts
- fresh-clone setup and demo script

Do not report complete while a required command or chosen-track qualification path fails.

Evidence manifest

Create docs/lisbon/EVIDENCE.md with one row per claim:

- track and requirement
- feature
- new Lisbon commit(s)
- file and symbol
- test command/result
- live request/transaction/proof/address
- explorer/API link
- demo timestamp
- status and caveat

Definition of done

1. Baseline and all pre-existing work are explicitly disclosed.
2. The new vertical slice runs from external discovery through real Uniswap status.
3. 0G proof failure prevents all downstream economic actions.
4. Hedera settlement is autonomous, final, visible, and exactly once.
5. Uniswap uses the official API for core functionality with valid credentials and real execution evidence.
6. Arc still works but is not presented as Lisbon integration evidence.
7. The reusable infrastructure surface has one working AlphaDawg example.
8. Every claimed track maps to qualifying code, a passing test, live evidence, and a demo moment.
9. Fresh-clone setup works and all required quality commands pass.
10. Submission docs include the dated Lisbon changelog, What's Next, FEEDBACK.md/form link, architecture, setup, addresses, and team/contact details required by current rules.

Cut and stop rules

- If the core register -> verify flow is not live by H17, cut every stretch feature.
- If Hedera settlement is not live by H23, cut Cross-Chain and Tokenization and fix Agentic Payments.
- If Uniswap is not live by H28, cut Cross-Chain/Tokenization and fix the real API path.
- At H32, freeze features regardless of remaining ideas.
- Cut in order: onchain reputation/identity writes, extra providers, advanced auction, tokenization, cross-chain automation, marketplace redesign.
- Never cut fail-closed proof verification, idempotency, independent signing, real sponsor transactions, baseline disclosure, or evidence.
- Never replace a failed integration with a mock success.
- Stop before mainnet, unapproved spend, secret exposure, destructive git action, or external submission without authority.
- If a partner rules the Continuity project ineligible for a regular track, remove that claim and continue the compatible build; do not disguise the baseline.

Final response

Return the submission status by track, completed vertical slice, live evidence links/IDs, exact changed files, verification results, cut features, blockers, and honest READY / CONDITIONAL / BLOCKED decision. Keep it concise and point to docs/lisbon/EVIDENCE.md as the source of truth.
````
