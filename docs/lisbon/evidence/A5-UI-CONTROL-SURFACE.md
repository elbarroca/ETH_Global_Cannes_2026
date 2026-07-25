# A5 Whole-Product UI and Protected Control Surface Evidence

- Task: `A5-UI-CONTROL-SURFACE-20260724`
- Sprint: `A5`
- Start/control SHA: `1ccadb6fec02b3bcae7cf1c16f5b707fe1c240a9`
- Remediation task: `A5-AUDIT-REMEDIATION-G1-20260724`
- Remediation start/control SHA: `cb3a82d4c657e7e8b8b89e9a2bed560ac47af273`
- Applicable defect evidence: audit commit `b918553` identifies the repaired findings but is not exact-SHA acceptance
- Branch: `Eth_global_lisbon_`
- Observed through: `2026-07-24T19:39:26Z`
- Exit SHA: derive from the commit containing this packet
- Result: `PASS_UI; PASS_A5_READ_MODEL; PASS_BROWSER; PASS_REVIEW; PASS_A5_AUDIT_REMEDIATION; PASS_TO_AUDIT; LOCAL_ONLY`
- Live result: `NOT_RUN; LIVE_EFFECT_BLOCKED`

## Product result

A5 preserves the existing route map and dark Nasdaq identity while turning the protected kernel into the authoritative creator and buyer control surface. Agent publication is an immutable `Define → Review → Publish` flow. Published-agent cards distinguish viewer ownership, surface server-owned version/price/proof policy, and make no runtime claim. Job submission sends one client-generated idempotency key, returns the original job on replay, polls at two seconds only while the document is visible and the job is nonterminal, and supports cancellation without creating a second effect.

The signature Proof Rail is ordered `Owner → Version → ENS → 0G Compute → Storage → Receipt`. Each stage is exactly `verified`, `pending`, `unavailable`, or `failed`. The dashboard reports exact A5 job totals and recent buyer jobs. UUID `/dashboard/compute/[id]` and `/verify?jobId=` use the authenticated A5 detail; numeric compute IDs and the cycle query remain compatibility-only and cannot supply A5 authority.

## Evidence boundary

- Published status proves only the immutable registry row. It does not imply that A3 is configured or that a job ran.
- Job list/detail reads require the authenticated buyer and return no unrelated buyer's job.
- Detail is bounded to identity, timeline, latest ENS decision, A3 digests, Storage commitment/readback, receipt identifiers, canonical delivery result, settlement/refund, and error code. Raw request/receipt/ENS bytes, prompts, secrets, and unrelated user data are not returned.
- A verified receipt is promoted only when its stored result hash equals the result hash of the same terminal `SUCCEEDED` effect and that effect has a terminal time. A mismatch marks receipt evidence failed, returns no receipt/delivery/settlement detail, and reports `RECEIPT_EFFECT_HASH_MISMATCH`.
- Missing nonterminal evidence is pending. Missing terminal evidence is unavailable. Negative ENS/A3/Storage or explicit false receipt evidence is failed. Unknown upstream metrics render `—`, not zero or an activity claim.
- The legacy hunt, chat, deposit, portfolio, history, infrastructure, marketplace, and verification surfaces remain available but are explicitly separated from A5 authority.

## UI and accessibility

- Shared additions are limited to an accessible dialog shell, evidence-status indicator, and copyable identifier with success/failure feedback.
- Dialog behavior includes initial focus, focus trap, Escape close, scroll lock, and focus restoration. Global focus-visible, active, disabled, identifier-wrap, dialog, mobile, and reduced-motion rules are present without a new icon or motion dependency.
- Navigation keeps the same labels, sets `aria-current`, removes the static status badge, and uses a compact 44px-target mobile menu.
- Portfolio distinguishes modeled/stale snapshots and adds retry plus table alternatives. History separates outage, empty, and end-of-list states and repairs disclosure semantics. Deposit uses labeled tabs/forms and displays the actual Circle receipt fields. Infrastructure separates configured identifiers from selected-job evidence and places operator commands in a disclosure.
- `public/alphadawg-dashboard-rc.png` is a production-rendered release-candidate dashboard frame with the landing caption `local fixture data`; it is visual evidence of the UI only, not runtime or sponsor proof.

## Automated evidence

The disposable A5 PostgreSQL test authenticates distinct creator, buyer, and unrelated identities; publishes one immutable agent; proves viewer ownership projection; submits and replays one idempotent job; verifies buyer isolation and redaction; exercises success, receipt, delivery, settlement, cancellation, and refund; then injects a receipt/effect hash mismatch behind disabled test-only triggers and proves the read model fails closed. Strict UUID validation rejects malformed UUID-shaped input before SQL casts.

Playwright `1.61.1` runs Chromium against `next build` plus `next start` with mocked network boundaries and production components. Eight tests cover:

1. `/`, `/marketplace`, `/dashboard`, and `/infrastructure` at 390, 768, 1,024, 1,280, and 1,440 CSS pixels with document overflow at most one pixel;
2. keyboard publication, manual instructions, immutable completion copy, Escape, and focus restoration;
3. one job submission followed by failed Storage, absent receipt/delivery, and refund;
4. verified delivery only with matching Storage and receipt evidence;
5. replay returning the original job with one POST;
6. active-job cancellation;
7. effective 200% browser-zoom reflow; and
8. reduced-motion animation suppression.

## Audit remediation G1

- The browser wallet surface now uses one Wagmi `injected({ shimDisconnect: true })` connector. Dynamic, RainbowKit, WalletConnect, their imports, and their public environment IDs are absent from the production dependency and tracked configuration surfaces. No vendor environment ID or secret is needed to build; the only runtime prerequisite for wallet interaction is a user-provided EIP-1193 browser wallet.
- Session token extraction uses a bounded default cookie name without invoking SIWE policy validation. A present malformed Authorization header, malformed target cookie, or missing token returns `401 AUTH_REQUIRED` before `getSessionPrincipal`, policy, or kernel/database access. Well-formed unknown sessions remain read-only lookups returning 401; action and ownership mismatches remain 403.
- Production dependency risk is 0 critical, 0 high, 4 moderate, and 13 low. Bounded upgrades/overrides cover Next, Express, Prisma, ethers, Sharp, Axios, gRPC, archive/form/URI/serialization/CSS/WebSocket paths, while dead Dynamic/RainbowKit/WalletConnect and direct UUID declarations are removed.
- The residual production advisories are inherited low-severity 0G/Hashgraph cryptography paths and a moderate Telegram `@cypress/request` path; npm offers only incompatible 0G `2.0.0`, Hashgraph, or Telegram `1.2.0` changes. The full audit's six highs (`brace-expansion`, `immutable`, `js-yaml`, `serialize-javascript`, `tmp`, and `undici`) are dev-only lint/Hardhat/coverage/compiler paths and cannot enter `npm ci --omit=dev` production output.

## Local gate

| Command/check | Result |
|---|---|
| `npm ci --legacy-peer-deps` | PASS: exact cold install and Prisma postinstall generation |
| `prisma validate`; `npm run prisma:generate` | PASS |
| `npm run validate:env` with and without required loopback database URLs | PASS |
| `tsx scripts/test-migrations.ts` | PASS: fresh plus synthetic Cannes upgrade; sentinel SHA-256 preserved |
| `npm run lint` | PASS: zero errors; 23 inherited warnings |
| `npm run typecheck` | PASS |
| `npm test` | PASS: 9/9 |
| `npm run test:auth` | PASS: 9/9, including six missing/malformed direct/route 401 responses plus unknown-session refusal and zero mutation |
| `npm run test:kernel` | PASS: 13/13 |
| `npm run test:go` with checksum-verified Go `1.23.10` | PASS: verifier tests and build |
| `npm run test:integration` | PASS: 26/26 plus both four-migration replay lanes |
| `npm run test:a3` | PASS: 12/12 |
| `npm run test:a4` | PASS: 9/9 |
| `npm run test:a5` | PASS: 3/3, including the native-wallet/dependency/config regression |
| `npm run test:e2e` | PASS: 4/4 |
| `npm run test:resilience` | PASS: 1/1 |
| `npm run test:redaction` | PASS: 3/3 |
| `npm run test:boot` | PASS: protected smoke, workers disabled |
| former wallet IDs empty + `npm run build` and `npm run start` | PASS: Next `16.2.11`; root/dashboard 200 and unauthenticated kernel 401 |
| `npm run test:playwright` | PASS: 8/8 Chromium production-browser tests |
| `npm audit --omit=dev --json` | Expected exit 1 for residual moderate/low; PASS threshold: 0 critical, 0 high, 4 moderate, 13 low |
| `npm audit --json` | Expected exit 1: 0 critical, 6 dev-only high, 13 moderate, 22 low; classified and isolated |
| `git diff --check` | PASS |
| `npm run scan:secrets` | PASS: no high-confidence tracked-file pattern |
| independent final review and remediation re-review | PASS: no remaining actionable finding |

## Remaining blocks

- `PASS_LIVE` remains `NOT_RUN; LIVE_EFFECT_BLOCKED`. No live ENS, 0G Compute, Storage, Arc, Hedera, Circle, or sponsor endpoint evidence was created by A5.
- Production A3 execution remains intentionally unavailable unless separately configured and authorized. Configuration identifiers are not job proof.
- No database migration was added. Managed migration, deployment, push, forms, transaction, signature, funding, upload, spend, public claim, Lisbon-window classification, track qualification, and release remain outside this local UI phase.
- Residual moderate/low production advisories and six dev-only high advisories remain explicitly classified; incompatible majors require a separately admitted migration. Earlier README/release claim drift remains release-blocking and outside this remediation.

External effects attempted: none. Local effects were limited to repository files, package installation, generated build/test output, the release-candidate screenshot, loopback production servers, disposable PostgreSQL clusters, and one authorized local commit.

## Protected lifecycle handoff on 2026-07-25

Kernel task `A5-KERNEL-LIFECYCLE-20260725:W2:B41F3ED` replaces the historical immediate-publish API behavior with typed private draft, name binding, inert ENS write preparation, and A4-gated immutable publication. The read model adds creator parent, full subname, canonical state, owner/delegate, policy/refusal, and release SHA without raw ENS evidence. Protected jobs admit only canonical lifecycle publications on real API calls and require a different server-derived buyer.

The independent immutable audit of exact SHA `4e741d05d25e49ed9a0a8964a3119a1ae98f3e59` returned `FIX; LOCAL_ONLY`, not A5 acceptance. The full current-generation floor passed with checksum-pinned temporary Go, but production publication has no accepted A4 adapter, database state is not bound to a durable A4 decision and matching publication event, and freshness is not rechecked at commit. Durable lifecycle-action idempotency and bounded malformed-body handling are also incomplete. The existing UI has not yet been independently proven against the new four-action API. Live journey, deployment, sponsor, release, and claim gates remain closed.

## Kernel publication-integrity remediation handoff on 2026-07-25

Kernel task `A4-KERNEL-PUBLICATION-REMEDIATION-20260725:W4:9C6E37D`
locally repairs every backend finding above: the production route traverses the
accepted ENS-owned authority boundary, publication binds one durable W8 decision
to one exact event and version under database-time deferred constraints,
lifecycle actions are durably idempotent, protected hire requires the decision,
and request bodies fail closed at a bounded pre-authentication boundary. Its
full local floor passes and its detailed writer evidence is in
[`A4-ENS-AUTHORITY.md`](A4-ENS-AUTHORITY.md).

The immutable audit of exact SHA `551876f4e0554654dd1899e1be4181362c9c9c0a`
returned `FIX; LOCAL_ONLY`: publication is not bound to a completed action,
late replay is mutable and duplicates authority work, a rejecting stream cancel
can return 500, and DSN isolation is incomplete. Kernel W5 and re-audit must
pass before UI wiring. A5, live journey, A6, deployment, sponsor, push, release,
and claim gates remain closed.

## Kernel action-integrity remediation handoff on 2026-07-25

Kernel task `A4-KERNEL-ACTION-INTEGRITY-20260725:W5:06B62A2` locally repairs
all four immutable W9 findings. Publication now requires the unique completed
owner action, its immutable result hash and exact event, the accepted W8
decision, exact protected state, and commit-time freshness. Exact late replays
return their original snapshots; 20 concurrent success or denial requests share
one authority call and one terminal event; retryable and expired claims recover
the same durable action. Hostile body streams preserve bounded 400/413, and the
decoded pooled/direct DSN plus runtime role/privilege attestation fails closed
before authority use.

Five twelve-migration lanes and the complete local floor pass. Detailed evidence
is in [`A4-ENS-AUTHORITY.md`](A4-ENS-AUTHORITY.md). This is only
`PASS_TO_AUDIT_REMEDIATION; LOCAL_ONLY`: immutable Kernel audit must pass before
UI rewire or A5 acceptance. Live journey, mandatory A6 entry, deployment,
sponsor, managed migration, signature, transaction, push, release, and claim
gates remain closed.
