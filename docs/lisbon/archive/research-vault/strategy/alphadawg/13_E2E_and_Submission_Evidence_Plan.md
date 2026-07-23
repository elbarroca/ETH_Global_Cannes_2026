---
title: AlphaDawg E2E and Submission Evidence Plan
aliases:
  - AlphaDawg Lisbon Evidence Plan
tags:
  - alphadawg
  - ethglobal/lisbon-2026
  - testing/e2e
  - submission/evidence
status: blocked_pre_event
updated: 2026-07-16
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
submission_state: BLOCKED_TEAM_IP
---

# AlphaDawg E2E And Submission Evidence Plan

> [!danger] Current state
> **BLOCKED_TEAM_IP / PRE-EVENT.** This is an evidence contract, not evidence that Lisbon code exists. Contributor consent, an agreed OSI license, changed-team approval, partner eligibility, credentials, and event-window implementation remain open.

## Evidence Standard

A sponsor claim is allowed only when one immutable `operation_id` links:

`task -> quotes -> award -> delivery -> 0G proof/storage -> Hedera settlement/HCS -> Uniswap execution -> feedback`

Every irreversible action needs a unique idempotency key and its real external identifier. A screenshot, UI success badge, database row, comment, inherited Cannes transaction, mock router, self-transfer, local fallback, or architecture diagram is not qualifying execution evidence.

Rules:

1. Capture success and failure paths from a clean event-window branch.
2. Store hashes and identifiers; redact credentials, signatures that authorize reuse, private inputs, tokens, mnemonics, PII, and full raw provider responses where sensitive.
3. Verify chain/protocol evidence independently through 0G verification, Hedera Mirror, and Uniswap route-specific status/chain receipt.
4. Record exact network, asset, atomic amount, provider/package version, UTC time, commit SHA, and schema version.
5. If a qualifying integration is unavailable, show failure honestly and remove that track claim.

## Canonical Receipt Contract

Planned evidence export: `evidence/lisbon/operations/<operation_id>/receipt.json`.

```json
{
  "schemaVersion": "1.0.0",
  "operationId": "op_<uuid>",
  "commitSha": "<lisbon-commit>",
  "task": { "id": "<task-id>", "inputHash": "0x...", "policyHash": "0x..." },
  "award": { "quoteHash": "0x...", "providerId": "<provider-id>" },
  "delivery": { "outputHash": "0x...", "artifactUri": "<redacted-or-public-uri>" },
  "proof": { "provider": "<0g-provider>", "verified": true, "proofRef": "<ref>", "storageRoot": "0x..." },
  "settlement": { "network": "hedera:testnet", "transactionId": "<tx-id>", "mirrorStatus": "SUCCESS", "hcsSequence": 0 },
  "execution": { "requestId": "<uniswap-request>", "routing": "CLASSIC", "transactionHash": "0x...", "status": "CONFIRMED" },
  "feedback": { "providerId": "<provider-id>", "receiptHash": "0x..." },
  "receiptHash": "0x..."
}
```

The actual runtime schema must be strict and versioned. Amounts are decimal strings in atomic units; network identifiers are CAIP-2 where the protocol supports them. The receipt contains references and hashes, not secrets.

## Planned Evidence Layout

```text
evidence/lisbon/
  BASELINE.md
  TRACK-MATRIX.md
  environment-redacted.txt
  package-versions.txt
  checks/
    lint.txt
    typecheck.txt
    test.txt
    build.txt
    fresh-clone.txt
  operations/<operation_id>/
    receipt.json
    agent-card.json
    task.json
    quotes.json
    award.json
    delivery-redacted.json
    proof-verification.json
    storage-readback.json
    hedera-mirror.json
    hcs-message.json
    uniswap-quote-redacted.json
    uniswap-simulation.json
    uniswap-status.json
    failure-path.json
  screenshots/
  video/
    shot-list.md
    timestamps.md
```

`CHANGELOG-LISBON.md`, `FEEDBACK.md`, README code pointers, prompts/specs, and AI attribution stay at repository/docs locations required by the submission; the evidence tree links them.

## Deterministic Test Matrix

| ID | layer | case | required assertion | economic effect |
|---|---|---|---|---|
| U-01 | state | legal lifecycle | Only declared next states succeed; optimistic version increments once. | None |
| U-02 | state | skip/replay/stale version | Transition rejects with typed error and no event append. | None |
| U-03 | quote | valid signed variable-price quotes | Signature, task, asset, amount, recipient, expiry, nonce, and capability bind to quote hash. | None |
| U-04 | quote | bad signer/expired/wrong task/amount | Quote is ineligible and cannot be awarded. | None |
| U-05 | award | deterministic selection | Lowest eligible atomic price wins; ties use stable provider ID; selection evidence persists. | None |
| U-06 | provider boundary | malformed card, private IP, DNS rebind, redirect, oversize, timeout | Activation/call rejects before network access to protected ranges; no unbounded retry. | None |
| U-07 | proof | valid task-bound 0G proof | Input/output/quote/provider hashes match; SDK verification succeeds. | Enables settlement only |
| U-08 | proof | one-byte output mutation, missing/wrong proof/provider | Delivery is rejected; no settlement/execution row or signing attempt exists. | **Zero** |
| U-09 | settlement | duplicate/concurrent/restart request | Unique task/award key returns the same transaction result; exactly one final transfer. | Exactly one |
| U-10 | settlement | ambiguous broadcast | Retry uses identical signed bytes/transaction ID or reconciles through Mirror; never creates a replacement transfer. | At most one |
| U-11 | execution policy | wrong chain/token/recipient/amount/slippage/deadline/spender/calldata | Reject before signing or broadcast. | Zero |
| U-12 | Uniswap route | every documented route-union member | Exhaustive branch; unknown/`CHAINED` rejects unless its dedicated state machine is enabled. | Zero in unit tests |
| U-13 | Permit2 | signature replay or quote mismatch | Permit cannot be reused; mismatch rejects before broadcast. | Zero |
| U-14 | receipt | canonical serialization | Same records yield same receipt hash; any bound field mutation changes it. | None |
| U-15 | logging | secret/PII fixture | Redactor removes bearer/API/private-key/mnemonic/cookie/auth fields. | None |

## Live End-To-End Scenarios

### E2E-01 — Complete Success

1. Register one independently operated provider through its HTTPS Agent Card without editing the static registry.
2. Request one typed task; obtain two signed quotes; award deterministically.
3. Deliver one schema-valid result; verify its real 0G proof and Storage readback.
4. Settle once through Hedera Testnet; confirm transaction and compact HCS receipt through Mirror.
5. Convert only the verified, settled result into a policy-bounded intent.
6. Use the Uniswap API key for approval/Permit2 where required, quote, simulation, exact returned calldata/order, broadcast, and route-specific final status.
7. Export and independently re-verify the receipt.

Pass: every identifier is linked; no mock/fallback appears; the run survives one process restart before receipt export.

### E2E-02 — Tampered Delivery

Repeat the awarded task, mutate one output byte or proof binding, and submit it.

Pass: state becomes `REJECTED`; settlement and execution tables contain no prepared/signed/broadcast artifact; provider receives no success feedback; the UI shows the precise proof failure.

### E2E-03 — Exactly-Once Replay

Send the same valid delivery/settlement/execution request concurrently, then retry after restart.

Pass: all callers converge on the same stored external identifiers; Hedera and execution evidence show one economic action each.

### E2E-04 — External Provider Boundary

Try a loopback/private/link-local/metadata URL, redirect into a blocked range, oversized Agent Card, wrong ownership challenge, and invalid quote signer.

Pass: provider never becomes active and protected destinations are not contacted.

### E2E-05 — Sponsor Failure

Independently simulate 0G unavailable/invalid proof, Hedera submit timeout, Mirror delay, Uniswap simulation failure, and unknown route.

Pass: the durable state is retryable or terminal as designed; no later economic step occurs out of order; no mock success or regenerated transaction silently replaces the failed artifact.

### E2E-06 — Cannes Compatibility

Run a bounded Arc x402 `$0.001` built-in specialist regression behind the legacy adapter.

Pass: behavior is labeled inherited Cannes functionality, application replay is controlled, and no Arc/mock/self-transfer result is counted as Lisbon 0G/Hedera/Uniswap proof.

## Sponsor Evidence Gates

| track | minimum qualifying evidence before claim | cut condition |
|---|---|---|
| 0G Keep Building | Cannes showcase/SHA, event-window commit log, meaningful new 0G-backed provider-commerce delta, live proof/storage receipt, public repo/README, dated changelog, What's Next, <3-minute video | No verified 0G flow or unresolved rights/baseline disclosure |
| 0G AI Product | Runnable product; real Compute/Private Computer use; addresses/live link; public repo/README; team contacts; <3-minute video | Local fallback, response ID presented as attestation, or regular-track eligibility unapproved |
| 0G Infrastructure | Reusable framework/tooling, one working example, exact docs/code pointers, architecture diagram | Only internal app code or no consumer example |
| Hedera Agentic Payments | Real Testnet payment/token/financial operation; repo/setup/architecture/payment flow; <=5-minute video; transaction + Mirror proof | No written Continuity admission, mock transfer, or missing finality |
| Uniswap API | Valid Developer Platform key is core; real quote/simulation/execution/status; public repo; README pointers; `FEEDBACK.md`; completed feedback form | Quote-only UI, own/mock router, missing form, invalid API key, or unapproved Continuity entry |
| Uniswap Stack | Substantive reusable stack contribution; public code/test/example; README pointers; `FEEDBACK.md`; feedback form | Thin wrapper, no reusable consumer, missing form, or inherited-only code |

Tokenization and Cross-Chain use their stricter gates in [[12_Prize_Weighted_Sprint_Backlog]] and remain off the common demo until written approval and the core passes twice.

## Demo Contract

### Shared submission video — 2:45 target

| time | shot | proof spoken/shown |
|---:|---|---|
| 0:00–0:15 | Problem and one-line product | “AlphaDawg is an open proof-carrying Agent Commerce Kit.” |
| 0:15–0:30 | Cannes baseline and Lisbon delta | Prior SHA/showcase, changed-team disclosure, dated changelog. |
| 0:30–0:55 | Register and discover | External Agent Card activates without source registry edits. |
| 0:55–1:20 | Request, two quotes, award, delivery | Typed task; variable prices; signed deterministic award. |
| 1:20–1:45 | 0G verification | Real provider/proof fields, Storage root/readback, receipt bindings. |
| 1:45–2:05 | Hedera settlement | One real Testnet transfer, HCS sequence, Mirror readback. |
| 2:05–2:25 | Uniswap execution | API request ID, route, simulation, tx/order and final status. |
| 2:25–2:38 | Tampered failure | Changed byte; explicit rejection; zero payment/trade. |
| 2:38–2:45 | Receipt and callout | One operation ID links everything; exact selected tracks. |

This satisfies the global 2–4 minute guidance and 0G's under-3-minute limit. A separate Hedera edit may be up to five minutes. Finalist rehearsal remains four minutes plus three minutes Q&A.

### Live four-minute sequence

Use the pre-created input and funded test accounts. Do not wait on cold starts. Show one clean success receipt, then run only the fast tamper step live. Keep explorer/API tabs pre-opened at exact identifiers and disclose if the displayed success run was captured immediately before judging.

## Fresh-Clone Judge Path

Commands are planned for the Lisbon branch; the Cannes baseline does not yet pass them.

```bash
git clone https://github.com/elbarroca/ETH_Global_Cannes_2026.git alphadawg
cd alphadawg
git checkout <lisbon-submission-sha>
npm ci
cp .env.example .env.local
npm run env:check
npx prisma migrate deploy
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke:a2a
npm run smoke:commerce -- --fixture success
npm run smoke:commerce -- --fixture tampered
npm run evidence:verify -- evidence/lisbon/operations/<operation_id>/receipt.json
```

Required before publishing this block: add the named scripts, document required versus optional environment fields, ensure smoke commands never print secrets, make live/spending tests explicit opt-in, and provide a fixture/offline unit mode. A judge should understand the success and failure result in under four minutes even if sponsor testnets are temporarily unavailable.

## Submission Checklist

### Global / Continuity

- [ ] All Lisbon teammates accepted and staked; team <=5.
- [ ] Written changed-team/Continuity approval stored.
- [ ] Former-contributor permission and agreed OSI license stored; Cannes contributors credited.
- [ ] Exact baseline SHA, prior showcase, Lisbon branch/commits, before/after scope, changelog, and new-code boundary disclosed.
- [ ] Public repository and meaningful incremental event-window history.
- [ ] AI-assisted prompts/specs/assets disclosed with meaningful human contribution.
- [ ] Selected partners limited to 0G, Hedera, and Uniswap; maximum three.
- [ ] Track eligibility and same-partner award policy rechecked at kickoff and before submission.
- [ ] Shared 2:00–2:59 video uploaded; finalist four-minute demo rehearsed.
- [ ] No secrets, PII, reusable authorizations, or unsupported hardware/TEE claims in repo/video/logs.

### 0G

- [ ] Exact current category selected; regular-track approval recorded if used.
- [ ] Public repo/README, working live link, addresses, team contacts, 0G explanation.
- [ ] Prior submission/date, Lisbon changelog, and What's Next for Keep Building.
- [ ] Architecture/example links for Infrastructure.
- [ ] Real Compute/Private Computer and Storage proof captured; Agentic ID explorer only if actually used.

### Hedera

- [ ] Written Agentic/Tokenization/Cross-Chain Continuity eligibility recorded.
- [ ] Real Testnet financial operation and Mirror/Hashscan evidence.
- [ ] Setup, architecture, payment flow, public source, and <=5-minute video.
- [ ] Tokenization wording resolved before claim.
- [ ] Schedule/Axelar destination action fully onchain with no team bot/cron if claimed.

### Uniswap

- [ ] Valid Developer Platform API key used in core flow.
- [ ] Public open-source repo, README exact code pointers, and real execution/status.
- [ ] `FEEDBACK.md` contains integration-specific findings with no secrets.
- [ ] Official feedback form completed and linked.
- [ ] API and Stack Continuity eligibility and multi-award policy recorded.

## Current Verification Baseline

Read-only Cannes checks on 2026-07-16:

| check | result |
|---|---|
| `npm ci` | PASS; 2,129 packages installed. Npm reported 98 total vulnerabilities; production-only audit reports 73. |
| `npm run lint` | FAIL; 23 errors, 28 warnings. |
| `npx tsc --noEmit` | PASS. |
| `npm test` | FAIL; script missing. |
| `npm run validate` | FAIL; 8 passed, 14 failed, 6 skipped without credentials/database/encryption. |
| `npm run build` | FAIL after compile/typecheck; invalid/missing database and Dynamic environment configuration during prerender. |

These are inherited facts, not Lisbon results. The submission stays blocked until the event branch passes lint, typecheck, tests, build, live sponsor smokes, both E2E paths, and a fresh-clone evidence verification.

## Organizer And Sponsor Questions

1. Does ETHGlobal approve the changed AlphaDawg team after contributor rights are documented?
2. May one disclosed Continuity project enter each named regular 0G, Hedera, and Uniswap track?
3. Can one project win more than one award from a single partner?
4. Which 0G category should own the same common slice, and may Keep Building stack with Product/Infrastructure?
5. Does Hedera's Tokenization qualification block override its conflicting SDK-only/no-contract introduction?
6. Is No Solidity evaluated over the whole inherited repository or only the new isolated module?
7. Does the intended Hedera x402 facilitator/self-facilitator qualify, or should direct SDK transfer be presented?
8. Which Uniswap feedback form URL and submission timing control?

## Final Gate

`SUBMISSION_READY` requires every checked track to have: written eligibility where needed, qualifying event-window code, a passing deterministic test, real live evidence, exact README pointers, and a demo moment. Otherwise mark the track `CUT` and keep the overall state `research_only_not_promotable`.

Related: [[09_Lisbon_Live_Track_and_Eligibility_Audit]], [[10_AlphaDawg_Current_Engineering_Audit]], [[11_Server_Agent_Target_Architecture]], [[12_Prize_Weighted_Sprint_Backlog]].

## Research Artifact QA — 2026-07-16

| check | result |
|---|---|
| Vault structure | PASS; 15 CSV files parse with stable widths, 191 Markdown files have balanced fences/valid present frontmatter, and only approved vault/config extensions occur. |
| Obsidian wikilinks | PASS; 865 wikilinks resolve inside the vault. |
| TASK-018 source register | PASS; 14 HTTPS rows have `2026-07-16` access dates. |
| External links | PASS at check time; 42 unique Markdown-linked URLs across the controlling notes returned HTTP 2xx/3xx. |
| Baseline provenance | PASS; clean `main...origin/main`, local SHA, and live remote `main` all equal the immutable Cannes SHA. |

This QA establishes strategy-artifact integrity only. It does not clear product build, track eligibility, contributor rights, the mandatory Uniswap feedback-form gate, or submission readiness.
