# A5 Whole-Product UI and Protected Control Surface Evidence

- Task: `A5-UI-CONTROL-SURFACE-20260724`
- Sprint: `A5`
- Start/control SHA: `1ccadb6fec02b3bcae7cf1c16f5b707fe1c240a9`
- Branch: `Eth_global_lisbon_`
- Observed through: `2026-07-24T18:21:20Z`
- Exit SHA: derive from the commit containing this packet
- Result: `PASS_UI; PASS_A5_READ_MODEL; PASS_BROWSER; PASS_REVIEW; LOCAL_ONLY`
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

## Local gate

| Command/check | Result |
|---|---|
| `npm run lint` | PASS: zero errors; 23 inherited warnings |
| `npm run typecheck` | PASS |
| `npm test` | PASS: 9/9 |
| `npm run test:auth` | PASS: 7/7 |
| `npm run test:kernel` | PASS: 13/13 |
| `npm run test:go` with verified Go `1.23.10` PATH | PASS: verifier tests and build |
| `npm run test:integration` | PASS: 26/26 plus both four-migration replay lanes |
| `npm run test:a3` | PASS: 12/12 |
| `npm run test:a4` | PASS: 9/9 |
| `npm run test:a5` | PASS: 2/2 |
| `npm run test:e2e` | PASS: 4/4 |
| `npm run test:resilience` | PASS: 1/1 |
| `npm run test:redaction` | PASS: 3/3 |
| `npm run test:boot` | PASS: protected smoke, workers disabled |
| `npm run build` | PASS: Next `16.2.2`, 31/31 static pages |
| `npm run test:playwright` | PASS: 8/8 Chromium production-browser tests |
| `git diff --check` | PASS |
| `npm run scan:secrets` | PASS: no high-confidence tracked-file pattern |
| independent final review and remediation re-review | PASS: no remaining actionable finding |

## Remaining blocks

- `PASS_LIVE` remains `NOT_RUN; LIVE_EFFECT_BLOCKED`. No live ENS, 0G Compute, Storage, Arc, Hedera, Circle, or sponsor endpoint evidence was created by A5.
- Production A3 execution remains intentionally unavailable unless separately configured and authorized. Configuration identifiers are not job proof.
- No database migration was added. Managed migration, deployment, push, forms, transaction, signature, funding, upload, spend, public claim, Lisbon-window classification, track qualification, and release remain outside this local UI phase.
- Inherited dependency advisories and earlier README/release claim drift remain separate unresolved release concerns.

External effects attempted: none. Local effects were limited to repository files, package installation, generated build/test output, the release-candidate screenshot, loopback production servers, disposable PostgreSQL clusters, and one authorized local commit.
