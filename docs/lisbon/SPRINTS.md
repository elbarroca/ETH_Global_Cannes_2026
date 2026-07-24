# AlphaDawg Lisbon Sprint Ledger

These are acceptance cards, not standalone prompts. C0 runs them in order using `prompts/SPRINT-EXECUTOR.md`, then audits the committed result with `prompts/SPRINT-AUDIT.md`.

## Sequence

| Sprint | Timebox | Mode | Depends on | Exit |
|---|---:|---|---|---|
| `A0` local admission + release/eligibility controls | 60-90 min | Read-only research + control writer | Owner authority | `A0_LOCAL` passes on Git provenance, local owner authority, and writer serialization; other gaps remain isolated release/claim/live blockers. |
| `A1` deterministic foundation | 3-4 h | Writer | A0_LOCAL | Clean install, real verification scripts, CI, schema, lint, typecheck, tests, and build pass. |
| `A2` authenticated kernel and runtime | 5-7 h | Writer | A1 | Immutable hiring flow and one restart-safe worker reject forgery and duplication. |
| `A3` strict 0G | 3-5 h | Writer | A2 + 0G static gate | Verified inference and proof-enabled Storage readback are mandatory for delivery. |
| `R0` agent and prompt readiness | 45-90 min | Control writer + read-only audit | Current controls | Every specialist has current paths/APIs, one non-overlapping domain, and complete A4-A7 acceptance coverage. |
| `A4` ENS authority | 2-4 h | Writer | A3 + R0 + ENS static gate | Canonical creator authority and deterministic agent subnames gate publication, 0G, and delivery. |
| `A5` product UI and E2E | 5-8 h | Writer | Accepted A4 | Creator -> publish -> external hire -> receipt, Telegram identity linking, required service health, and the UI are usable and automatically tested. |
| `A6` optional Uniswap | max 4 h | Writer or CUT | Frozen A5 core + admission + 6 h reserve | Exact admitted contribution passes removal and live gates, or is cut untouched. |
| `A7` release and submission | Remaining >=4 h | Writer | Required gates pass; A6 pass/cut | One SHA passes clean-clone release, two demos, deployment, evidence, and final audit. |

Only read-only A0 research and audits may overlap a product writer. A0 control edits are serialized under the writer lease. No two writers overlap.

## A0 - readiness and eligibility

Objective: admit safe local work independently from release, claim, and live-effect readiness.

Deliver:

- Verify repository root, branch, HEAD, baseline ancestry, worktrees, remotes, clean state, and writer lease.
- Preserve current H0, category, Continuity/change, team/IP/license, deadline, prize, mandatory-artifact, and sponsor requirements as release/claim controls; refresh time-sensitive sources before promotion or release.
- Reconcile existing 0G, ENS, and Uniswap research instead of rerunning it blindly. Refresh only stale, contradicted, or implementation-version-dependent evidence.
- Keep missing named owners, credentials/access readiness, and testnet budgets fail-closed for release or the affected live effect without exposing secret values.
- Update `BASELINE.md`, `TRACK-MATRIX.md`, `CLAIM-MATRIX.md`, and `EVIDENCE.md` only where current evidence changes them.

Gate: `A0_LOCAL` passes only when Git provenance, local owner authority, and writer serialization pass. It opens safe local A1 and authorizes later A2/offline A3 after their sequential prerequisites pass. Rights/license/team/owner/access/cap gaps, H0/event-window evidence, and P0 live proof remain `RELEASE_BLOCKED`, claim-blocked, or `LIVE_EFFECT_BLOCKED`; they do not close A1. URL reachability alone proves nothing.

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

Entry: A2 passes and the pinned official Go proof-verifier path plus exact installed 0G versions/APIs have current static evidence. The TypeScript Storage SDK proof limitation does not block implementing the Go boundary; it forbids treating the TypeScript proof flag as success. Live calls and promotion remain separately blocked.

Deliver:

- Bind creator, buyer, agent version/manifest, input hash, provider/model, policy, nonce, deadline, and effect ID before the request.
- Treat official response verification as fatal; provider text or a request ID is unusable without it.
- Store the canonical receipt payload and verify proof-enabled readback plus exact digest/root.
- Persist redacted request, proof, output, storage identifiers, and ambiguity-reconciliation state.
- Keep all local/mock/OpenClaw fallbacks non-authoritative.

Verify: local fixtures and integration first; missing/invalid/tampered proof, one-byte tamper, malformed response, timeout, outage, duplicate retry, and kill/restart produce no false success or replacement effect. `PASS_LIVE` requires separate exact authorization and public identifiers.

## R0 - agent and A4-A7 prompt readiness

Objective: make the registered specialists safe to dispatch against the current Lisbon protected path.

Deliver:

- Audit `AGENTS.md`, `.codex/agents/**`, the converted
  `.agents/skills/source-command-*/**` workflows, and the active
  coordinator/executor/auditor prompt chain. `.claude/**` is migration
  provenance only and cannot dispatch work.
- Give authentication/kernel, ENS, 0G, product UI/E2E, optional payments, cycle wiring, and final bounty audit exactly one owner each. ENS must explicitly own `src/ens/**` and its migrations/tests.
- Reconcile every declared path, package/API version, command, product name, event/bounty rule, and allowed effect against the current checkout. Remove stale Cannes-only, `VaultMind`, missing-path, and outdated-SDK guidance.
- Dry-dispatch each specialist read-only and record its domain, paths, commands, dependencies, conflicts, and verdict.

Gate: `R0_AGENT_READY` only when no required domain is unowned, no mutating scopes overlap, and every prompt is executable from the current checkout without inventing APIs or authority.

## A4 - ENS authority

Objective: bind an authenticated creator wallet and immutable agent version to a canonical creator name and deterministic agent subname, then make that authority an authorization boundary for publication and A3.

Entry: A3 and `R0_AGENT_READY` pass. The stable Universal Resolver path and ENSv2 hierarchy/interfaces have current static proof. Direct ENSv2 live writes remain blocked until an official audited deployment packet and exact authorized write/readback exist.

Deliver:

- Treat SIWE wallet authentication, creator-name ownership, and ENS write authority as separate gates; reverse resolution is not authority.
- Normalize and DNS-encode the creator name and deterministic agent label. Bind the resulting full subname to immutable version, manifest, capability, service, price, payout, chain, owner/delegate, resolver policy, and freshness.
- Use the canonical Universal Resolver with CCIP Read. Prove readiness with the official `ur.integration-tests.eth` expected address.
- Under ENSv2 fixtures/interfaces, require a canonical creator registry, require the agent parent registry to equal it, verify `findOwner(agentName)`, and verify an exact agent registry when one exists. Reject aliases, broken parent backlinks, wrong roots, and unexpected inherited resolvers.
- Verify contract-wide/name roles and admin roles. Unexpected external grants, parent expiry/transfer, or subregistry replacement/removal deny authority.
- Resolve immediately before 0G and again before accepting delivery.
- Persist normalized/DNS names, root/Universal Resolver, canonical creator registry, agent parent/exact registry, ownership/roles, winning resolver and suffix, record hash, chain, block, transaction/time, freshness, and policy decision.
- Transfer, mutation, stale record, wrong chain/version/root/registry/resolver, missing record, CCIP failure, or outage causes zero new 0G calls and zero accepted delivery.

Verify: fixture first; authorized live write/read only when allowed. Cover forged writer, reverse-name spoofing, normalization/collision errors, registry aliasing, broken backlinks, external role grants, inherited-resolver mismatch, parent/agent transfer before and during execution, parent expiry/subregistry removal, stale data, CCIP failure, outage, duplicate/replay, and restart. Twenty duplicates still converge to one effect.

## A5 - product UI, functionality, and E2E

Objective: expose the protected path clearly without a broad redesign.

Deliver:

- Reuse the existing dashboard and components. Implement one stateful journey: private draft -> ENS name binding -> authorized readback -> immutable publication -> protected marketplace listing -> different authenticated buyer hire -> job -> verified receipt.
- Derive creator/buyer identity server-side. A draft is not hireable; publish only the exact immutable version/name binding; changes create a new version. Define “deploy agent” as activating the application version/runtime, never as unproven contract or sponsor deployment.
- Use only `/api/kernel/agents` and `/api/kernel/jobs` as protected authority. Legacy marketplace create/hire routes remain disabled or visibly non-authoritative.
- Show connected wallet, creator name, agent subname, canonical state, owner/delegate, immutable version/price, publication/hire eligibility, job state, ENS authority, 0G verification, Storage proof, canonical receipt, and explicit failure/refusal states.
- Bind Telegram to the authenticated app user through one short-lived, single-use code and private-chat numeric identity. Prove expiry, replay, cross-user, group-chat, forged-webhook, unlink/relink, and webhook-versus-polling refusal. Telegram commands use the same backend identity and never bypass the protected kernel.
- Select exactly one Telegram receive mode. Production webhook mode requires a configured secret and durable/awaited command handling; production must never accept unsigned updates when the secret is absent.
- Derive the expected agent/service fleet from one registry. Health requires fresh non-effectful checks plus exact release SHA/version; functional readiness requires separately authorized role-level smokes. UI badges never manufacture health.
- Treat the observed `12/13 ONLINE`, stale wallet authorization, permanent Arc wait, and empty feed as regression cases. Identify the failed agent, prove wallet retry recovery, and show optional Arc as healthy or explicitly cut instead of loading forever.
- Keep model output advisory. The UI cannot create authority, rewrite terminal state, or show success from mocks, cached flags, or missing evidence.
- Add functional API/integration tests for the complete path and refusal cases.
- Add one automated browser path with creator wallet A publishing an agent subname and buyer wallet B hiring its exact version through progress -> verified delivery -> receipt; cover self/cross-user refusal, forgery, stale authority, version substitution, duplicate hire, and replay no-op.
- Add a browser-plus-bot path for web link-code generation -> Telegram `/start CODE` -> web linked-state refresh -> linked command -> same-user result/proof notification -> unlink. Tokens, codes, chat IDs, and PII never enter logs, screenshots, or fixtures.
- Check desktop and mobile layouts, keyboard flow, labels, focus, loading, empty, error, offline, and long-content states. Capture same-SHA screenshots only after automation passes.

Gate: build/start, functional tests, automated critical-path UI tests, Telegram identity/security tests, required service health, accessibility baseline, zero required browser console/network errors, and two local reset/replays pass without manual data repair.

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
- Prove the same creator parent, agent subname, immutable version, marketplace listing, external-buyer job, receipt, and release SHA across UI, API, worker, database, evidence, deployment, and video.
- Prove the public app URL, Telegram receiver, worker, and every required agent report the same release SHA; verify Telegram webhook/polling state and an app-link command/result round-trip.
- Run failure-first and success-plus-replay demos twice from resettable state within four minutes.
- Complete current sponsor requirements, README/setup, prior-work disclosure, changelog, AI disclosure, public identifiers, demo script/video, and submission evidence.
- Re-run `R0_AGENT_READY`, then run the current Lisbon Bounty Auditor on the frozen SHA. No critical/high finding may remain.

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
