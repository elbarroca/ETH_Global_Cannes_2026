# AlphaDawg Lisbon Sprint Ledger

These are acceptance cards, not standalone prompts. C0 runs them in order using `prompts/SPRINT-EXECUTOR.md`, then audits the committed result with `prompts/SPRINT-AUDIT.md`.

## Sequence

| Sprint | Timebox | Mode | Depends on | Exit |
|---|---:|---|---|---|
| `A0` readiness and eligibility | 60-90 min | Read-only research + control writer | Owner authority | Current provenance, H0, rights, access, rules, and track gates are evidence-backed. |
| `A1` deterministic foundation | 3-4 h | Writer | A0 | Clean install, real verification scripts, CI, schema, lint, typecheck, tests, and build pass. |
| `A2` authenticated kernel and runtime | 5-7 h | Writer | A1 | Immutable hiring flow and one restart-safe worker reject forgery and duplication. |
| `A3` strict 0G | 3-5 h | Writer | A2 + 0G static gate | Verified inference and proof-enabled Storage readback are mandatory for delivery. |
| `A4` ENS authority | 2-4 h | Writer | A3 + ENS static gate | Fresh creator/agent records gate 0G before and after execution. |
| `A5` product UI and E2E | 3-5 h | Writer | A4 | The protected path and its failures are usable, accessible, and automatically tested. |
| `A6` optional Uniswap | max 4 h | Writer or CUT | Frozen A5 core + admission + 6 h reserve | Exact admitted contribution passes removal and live gates, or is cut untouched. |
| `A7` release and submission | Remaining >=4 h | Writer | Required gates pass; A6 pass/cut | One SHA passes clean-clone release, two demos, deployment, evidence, and final audit. |

Only read-only A0 research and audits may overlap a product writer. A0 control edits are serialized under the writer lease. No two writers overlap.

## A0 - readiness and eligibility

Objective: decide `BUILD`, `NARROW`, or `WAIT_GATE` from current facts before product work.

Deliver:

- Verify repository root, branch, HEAD, baseline ancestry, worktrees, remotes, clean state, and writer lease.
- Recheck official H0, category, Continuity/change rules, team and IP/license rights, deadlines, prize rules, mandatory artifacts, and sponsor primitive requirements from current primary sources.
- Reconcile existing 0G, ENS, and Uniswap research instead of rerunning it blindly. Refresh only stale, contradicted, or implementation-version-dependent evidence.
- Confirm named owners, credentials/access readiness, testnet budgets, and each external-effect row without exposing secret values.
- Update `BASELINE.md`, `TRACK-MATRIX.md`, `CLAIM-MATRIX.md`, and `EVIDENCE.md` only where current evidence changes them.

Gate: unresolved H0, rights, eligibility, required access, or static compatibility stays `BLOCKED`; A1 does not open. URL reachability alone proves nothing.

## A1 - deterministic foundation

Objective: make the inherited repository reproducible before feature work.

Deliver:

- Use the committed npm lockfile; prove `npm ci` on the supported Node version.
- Add real `typecheck`, `test`, `test:integration`, `test:e2e`, `test:resilience`, `test:redaction`, `scan:secrets`, `demo:reset`, and `demo:replay` scripts only when their implementation exists. Required missing coverage blocks the gate.
- Validate environment shape without printing values. Separate offline deterministic checks from authorized live smokes.
- Validate/generate Prisma, replay empty and upgraded migrations, and prevent generated/runtime data from dirtying Git.
- Make CI run the deterministic release subset.

Gate: clean install, Prisma validation, lint, strict typecheck, deterministic tests, build, and CI definition pass. No sponsor feature is added here.

## A2 - authenticated kernel and shared runtime

Objective: implement one secure job lifecycle for all later sponsor adapters.

Deliver:

- Derive identity server-side; reject caller-controlled user, owner, wallet, role, or approval authority.
- Implement immutable agent versions and domain-separated canonical Quote/JobIntent hashes using integer atomic amounts and bounded nonces/deadlines.
- Enforce explicit job states, append-only events, optimistic versions, database uniqueness, idempotency, and mutually exclusive settlement/refund/commission outcomes.
- Use one shared PostgreSQL-backed worker with bounded claims, short leases, heartbeat, restart recovery, fixed adapters, and immutable `agentVersionId`.
- Disable OpenClaw, Telegram, Naryo, trading, payment, and local-signal success fallbacks from the protected path. Keep useful Cannes behavior outside it.

Verify: forgery, cross-user access, malformed signatures, illegal transitions, 20 concurrent duplicates, crash/restart at effect boundaries, expired leases, outage, and legacy-disabled boot. One intent creates at most one terminal effect.

## A3 - strict 0G

Objective: make verified 0G output and proof-capable Storage readback load-bearing.

Entry: A2 passes and the exact installed 0G versions/APIs have current static proof. The recorded static failure blocks implementation until resolved; never code around it with a success flag.

Deliver:

- Bind creator, buyer, agent version/manifest, input hash, provider/model, policy, nonce, deadline, and effect ID before the request.
- Treat official response verification as fatal; provider text or a request ID is unusable without it.
- Store the canonical receipt payload and verify proof-enabled readback plus exact digest/root.
- Persist redacted request, proof, output, storage identifiers, and ambiguity-reconciliation state.
- Keep all local/mock/OpenClaw fallbacks non-authoritative.

Verify: success when separately authorized; missing/invalid/tampered proof, one-byte tamper, malformed response, timeout, outage, duplicate retry, and kill/restart produce no false success or replacement effect.

## A4 - ENS authority

Objective: make stable ENS creator and agent records an authorization boundary for A3.

Entry: A3 passes and the chosen stable ENS path has current static proof. Direct ENSv2 stays optional until its official deployment packet and authorized live write/readback exist.

Deliver:

- Bind creator and agent subnames to immutable version, manifest, capability, service, chain, owner/delegate, resolver, and freshness.
- Resolve immediately before 0G and again before accepting delivery.
- Persist name/node, ownership, resolver, record hash, chain, block, transaction/time, and policy decision.
- Transfer, mutation, stale record, wrong chain/version/resolver, missing record, or outage causes zero new 0G calls and zero accepted delivery.

Verify: authorized write/read when allowed, forged writer, parent/agent transfer before and during execution, stale/mismatched data, outage, and restart.

## A5 - product UI, functionality, and E2E

Objective: expose the protected path clearly without a broad redesign.

Deliver:

- Reuse the existing dashboard and components. Show hire input, immutable version/price, job state, ENS authority, 0G verification, Storage proof, canonical receipt, and explicit failure/refusal states.
- Keep model output advisory. The UI cannot create authority, rewrite terminal state, or show success from mocks, cached flags, or missing evidence.
- Add functional API/integration tests for the complete path and refusal cases.
- Add one automated browser path covering hire -> progress -> verified delivery -> receipt, plus forgery/refusal and replay no-op. Use existing browser tooling; add the minimum direct test dependency only if no supported runner exists.
- Check desktop and mobile layouts, keyboard flow, labels, focus, loading, empty, error, offline, and long-content states. Capture same-SHA screenshots only after automation passes.

Gate: build/start, functional tests, automated critical-path UI tests, accessibility baseline, and two local reset/replays pass without manual data repair.

## A6 - optional Uniswap

Objective: add only an honestly admitted, load-bearing Uniswap contribution.

Entry requires all of: frozen green A5 core, current written admission for the exact track, required authorizations for the selected path (such as API, form, signing, network, or spend), successful removal test design, and at least six engineering hours before feature freeze.

If any entry condition fails: record `CUT_UNISWAP`; change no product code.

When admitted:

- Bind chain, tokens, atomic amount, recipient, slippage, deadline, spender, target, selector, quote/request ID, approval, and expected final state.
- Runtime-validate official responses; persist prepared transaction/calldata hash before signature; reconcile ambiguity by the same ID; never replace blindly.
- For Stack Contribution, produce genuinely reusable public tooling, tests/example, code pointers, `FEEDBACK.md`, and separately authorized form submission. A one-off wrapper is not Stack evidence.
- Verify rejection, malformed/tampered data, wrong policy fields, duplicate/restart, timeout, outage, revert, finality/balance deltas, and removal of the claimed guarantee.

## A7 - release and submission

Objective: prove and publish one reproducible release, not add features.

Deliver:

- Freeze one SHA; run the complete release contract in `docs/lisbon/GOALS.md` from a fresh checkout.
- Deploy web/API, PostgreSQL migration, and long-running worker from the same SHA only under exact current authorization. Expose non-secret release and evidence versions.
- Run authorized live 0G and ENS smokes; run Uniswap only if A6 passed.
- Run failure-first and success-plus-replay demos twice from resettable state within four minutes.
- Complete current sponsor requirements, README/setup, prior-work disclosure, changelog, AI disclosure, public identifiers, demo script/video, and submission evidence.
- Run the registered Bounty Auditor on the frozen SHA. No critical/high finding may remain.

Gate: `RELEASE_VALIDATED` only when code, deployment, UI, receipts, evidence, video, and track claims all bind the same SHA. Otherwise return the exact `BLOCKED`, `NARROW`, or `CUT` state.

## Required task return

```text
sprint:
start_sha:
exit_or_audit_sha:
changed_paths:
commands_and_exit_codes:
acceptance_items:
evidence_paths_and_public_ids:
external_effects_attempted:
claim_changes:
blockers:
verdict: PASS_TO_AUDIT | PASS_TO_NEXT_GATE | FIX | CUT | BLOCKED
next_action:
```
