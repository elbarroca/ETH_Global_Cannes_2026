# AlphaDawg Lisbon Autonomous `/goal` Pack

This file is the copy/paste control surface for a new Codex project opened at the AlphaDawg repository root. It has no dependency on the separate research vault.

## Shared contract

- Project: AlphaDawg only.
- Repository root: discover with `git rev-parse --show-toplevel`; never assume another checkout.
- Immutable prior state: `bfa7bd37c573e2e49525d965f7f937210e170d72`.
- Implementation branch: `developer`.
- One implementation worktree and one mutating writer at a time. The writer must atomically acquire a repo-local lock before editing; `ACTIVE-WRITER.md` is the human-readable mirror, not the lock primitive.
- Async probes and audits are read-only and use temporary directories.
- Every writer claims `docs/lisbon/ACTIVE-WRITER.md`, updates `CHANGELOG-LISBON.md`, stores evidence under `docs/lisbon/evidence/`, runs proportional checks, and makes one atomic commit.
- Execution precedence is `EXTERNAL-EFFECTS.md` -> `BASELINE.md` -> this file -> live track/claim/evidence controls -> dated context snapshots -> archive. Older pre-H0 wording in copied snapshots cannot close current project-owner local authority or open an external effect.
- Never erase unexpected changes, rewrite history, force-push, expose secrets, or treat inherited Cannes evidence as Lisbon evidence.
- Models propose typed records. Deterministic policy, authenticated humans, database constraints, and isolated signers authorize effects.
- Autonomous goals cannot promote an external-effect row to `AUTHORIZED`. Push, deployment, signatures, transactions, spend, forms, or other external effects run only from a separate authenticated project-owner authorization bound to exact scope, release SHA, cap, and timestamp, which the coordinator may mirror into `docs/lisbon/EXTERNAL-EFFECTS.md`. Otherwise return the exact blocker.
- Track promotion is monotonic: `NOT_RUN -> PASS_FIXTURE -> PASS_INTEGRATION -> PASS_LIVE -> PASS_RELEASE`.
- A reachable URL, installed SDK, local fixture, mock, database flag, or HTTP `200` is not sponsor evidence.

## Read order for every goal

1. `AGENTS.md`
2. `docs/lisbon/README.md`
3. `docs/lisbon/BASELINE.md`
4. `docs/lisbon/ALPHADAWG-FILE-MAP.md`
5. `docs/lisbon/context/README.md`
6. `docs/lisbon/context/RUNBOOK.md`
7. `docs/lisbon/context/MASTER.md`
8. `docs/lisbon/context/ENGINEERING-AUDIT.md`
9. `docs/lisbon/TRACK-MATRIX.md`
10. `docs/lisbon/CLAIM-MATRIX.md`
11. `docs/lisbon/EVIDENCE.md`
12. `docs/lisbon/EXTERNAL-EFFECTS.md`

## Sprint execution matrix

`A0` is the current control-pack gate. Start the three disposable probes and the independent audit asynchronously; run every code-writing sprint in order.

| Sprint | Timebox | Mode | Depends on | Sole writer | Read-only subagents | Exit or cut gate |
|---|---:|---|---|---|---|---|
| `A0` live authority and baseline | 60 min | Control only | Project-owner authority | Coordinator/root | `track-strategist`, `validation-submission-auditor` | Fresh official rules and repo provenance reconciled; unresolved rights/eligibility stay non-promotable. |
| `P0` 0G probe | 60–90 min | Async read-only | A0 local authority | None | `track-strategist`, `blockchain-architect` | `PASS_STATIC` for exact SDK/API/proof/storage compatibility or `BLOCKED`; no live request or product edit. |
| `E0` ENS probe | 60–90 min | Async read-only | A0 local authority | None | `track-strategist`, `blockchain-architect` | `PASS_STATIC_STABLE`; direct ENSv2 needs a complete official deployment packet; no write. |
| `U0` Uniswap probe | 45–60 min | Async read-only | A0 local authority | None | `track-strategist` | Admit Stack Continuity, mark API product-only, or reject; never infer admission. |
| `A1` deterministic foundation | 3–4 h | Sequential writer | A0 | `lean-implementation-engineer` | `validation-submission-auditor` after commit | Clean install, Prisma validation, lint, typecheck, tests, build, CI, and env validation pass. |
| `A2` auth and marketplace kernel | 4–6 h | Sequential writer | A1 | `lean-implementation-engineer` | `blockchain-architect` before; `smart-contract-security-auditor` after | Forgery, illegal transitions, and 20 concurrent duplicates fail safely; migration replay passes. |
| `A2R` shared runtime and cleanup | 2–3 h | Sequential writer | A2 | `lean-implementation-engineer` | `reliability-optimizer` after measurements | One version-bound worker; legacy-disabled boot; kill/restart creates no duplicate effect. |
| `A3` strict 0G | 3–5 h | Sequential writer | A2R + P0 | `lean-implementation-engineer` | `smart-contract-security-auditor` | Verification and proof-enabled readback are fatal; live claim requires authorized public IDs. |
| `A4` stable ENS | 2–4 h | Sequential writer | A3 + E0 | `lean-implementation-engineer` | `smart-contract-security-auditor` | Fresh owner/record resolution gates 0G; transfer/stale/outage creates zero downstream call. |
| `A5` conditional Uniswap | max 4 h | Sequential writer | A4 + U0 admission | `lean-implementation-engineer` | `track-strategist`, `smart-contract-security-auditor` | Run only with six hours remaining and a load-bearing admitted path; otherwise `CUT_UNISWAP`. |
| `A6/A7` E2E, deploy, demo, release | remaining ≥4 h | Sequential writer | Required tracks green; optional cut/pass | `lean-implementation-engineer` | `hackathon-ux-demo-director`, `reliability-optimizer`, `validation-submission-auditor` | Fresh clone, same SHA, two deterministic replays, mandatory artifacts, and authorized deployment pass. |
| `VA` independent audit | Continuous | Async read-only | A0 | None | `validation-submission-auditor` | Block the next gate on any unproven requirement; never repair. |

Maximum work in progress is one mutating writer plus bounded read-only probes/audits. No two writers may overlap.

### Atomic writer lease

- Goal C0 is the only dispatcher. Before any mutation, atomically acquire the repository-global lease with `mkdir -- "$(git rev-parse --git-common-dir)/alphadawg-lisbon-writer.lock"`; then record a unique token, task, owner, host/PID when available, start SHA, allowed paths, acquisition time, expiry, and heartbeat inside it. Mirror the same token in `ACTIVE-WRITER.md`.
- Lock acquisition failure, token mismatch, expired heartbeat, unexpected dirty state, or overlapping allowed paths returns `BLOCKED_WRITER_LOCK`. Never self-clear or steal a lock; preserve the diff and let the coordinator/project owner adjudicate.
- Handoff requires completed checks, one committed exit SHA, clean status, updated evidence/changelog, and release of the matching token. Coordinators and auditors do not edit while a writer lease exists; audits inspect a pinned committed SHA in a disposable worktree.

## Subagent contract

The coordinator owns reconciliation. Each delegated task must be concrete, bounded, and include this packet:

```text
project_id: alphadawg
repo_path: <git rev-parse --show-toplevel>
worktree: <absolute current worktree>
baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
track: <shared | 0g | ens | uniswap>
allowed_paths: <exact paths, or read-only>
acceptance_evidence: <commands, tests, IDs, and artifacts>
deadline_or_hour_gate: <timebox/cut time>
known_blockers: <explicit list>
```

- `hackathon-orchestrator`: schedules gates and makes build/narrow/cut/stop decisions; it does not implement.
- `track-strategist`: rechecks official rules, eligibility, artifacts, prize caps, and sponsor access; read-only.
- `blockchain-architect`: specifies trust boundaries, state machine, interfaces, invariants, and proof map before a writer starts.
- `lean-implementation-engineer`: the only product-code writer; exact allowed paths, no adjacent refactor.
- `smart-contract-security-auditor`: inspects auth, signers, transactions, idempotency, and economic failure paths; never repairs.
- `hackathon-ux-demo-director`: makes failure, sponsor state changes, receipts, and replay visible in the four-minute demo.
- `reliability-optimizer`: works only after the functional path is green and only from measurements.
- `validation-submission-auditor`: independently maps every requirement to code, tests, live evidence, and mandatory submission artifacts; never repairs.

Read-only agents may use disposable directories, but cannot edit/install/format in the product checkout, commit, push, deploy, sign, transact, submit forms, or spend. A subagent cannot authorize an external effect. The coordinator rejects duplicate tasks, mixed Project B context, generic `PASS` reports, or packets without exact evidence.

## Engineering validation ladder

Every writer stops at the first red layer, fixes the root cause inside its allowed paths, reruns from that layer, then requests an independent read-only audit:

1. provenance: branch, SHA, clean/expected diff, writer lock, allowed paths;
2. boundaries: strict environment and external-response validation, authentication, authorization, redaction;
3. static: Prisma validate/generate, lint, strict typecheck;
4. deterministic tests: unit, state transitions, canonical hashing, malformed input;
5. data: empty and upgraded migration replay, uniqueness, transaction rollback;
6. integration: exact adapter contracts with isolated fixtures;
7. adversarial: forgery, tamper, replay, concurrency, ambiguous outcome, outage;
8. resilience: worker kill/restart, lease recovery, idempotent retry, no duplicate terminal effect;
9. live sponsor smoke: only when the exact external-effect row is authorized; capture new public IDs;
10. release: build/start, secret scan, fresh clone, same-SHA deploys, two resettable demo replays.

No mock, fixture, UI badge, HTTP `200`, or request ID can promote a live claim.

Before signing or broadcasting any economic effect, persist a one-shot approval digest bound to release SHA, effect ID, chain/provider, asset, recipient, spender/target, atomic cap, deadline, nonce, and policy version. Persist signed bytes/hash before broadcast, reconcile `UNKNOWN` by the same identifier, and never issue a blind replacement.

## Sprint premortem controls

Assume each sprint already failed before starting it. Record the failure story, hidden assumption, warning, prevention, and cut decision in the sprint evidence.

| Sprint | Failure already happened because… | Observable warning | Required prevention / stop rule |
|---|---|---|---|
| A0 | stale rules or ambiguous rights made all later evidence ineligible | no fresh timestamped official-source ledger; unresolved license/admission | Recheck category, eligibility, primitive, network, repo/license, video/booth/form, and deadline before A1 and release; unknown means cut/stop. |
| A1 | inherited scripts passed selectively but a clean install/build failed | missing script target, implicit env, generated tracked output | Make one deterministic local suite and CI; do not start A2 with any red command. |
| A2 | caller-controlled identity or weak uniqueness created forged/duplicate work | route accepts `userId`/owner flags; no DB constraint; concurrency test duplicates | Derive identity server-side, constrain invariants in PostgreSQL, and stop the project if auth/state/idempotency stays red. |
| A2R | legacy fallbacks or per-agent servers bypassed the shared worker | OpenClaw required for local success; duplicate worker effect; unbounded process count | Legacy-disabled boot and four-job/kill-restart proof are mandatory; no success fallback. |
| A3 | a 0G request ID was mistaken for verified usable output | verifier optional; Storage digest/readback absent | Verification and proof-enabled readback are fatal; no live ID means no 0G claim. |
| A4 | ENS was cosmetic or stale cache authorized execution | no fresh owner/record block; refusal still calls 0G | Fresh pre/post resolution and zero-downstream refusal tests; cut ENS rather than use DB cache. |
| A5 | a one-off API call was mislabeled Stack Contribution | no reusable public artifact/removal test/admission | Run U0 first; generic API use is product-only; cut at four hours or six hours remaining. |
| A6/A7 | many completed tasks produced a flaky demo on mismatched SHAs | manual repair, non-resettable state, web/worker SHA mismatch | Freeze features, fresh-clone twice, reset/replay twice, and remove every claim without same-SHA evidence. |
| All | concurrent writers corrupted code and evidence | two active locks, overlapping paths, unexpected diff/commit | Stop mutations, preserve both diffs, reconcile under coordinator, then admit one writer only. |

### Premortem synthesis

- Most likely failure: component sprints pass, but clean-clone integration and deterministic demo replay fail too late.
- Most dangerous failure: an autonomous process self-authorizes or duplicates an economic effect after an ambiguous broadcast.
- Hidden assumption: cooperative agents and mutable Markdown alone enforce serialization, authorization, and evidence integrity.
- Revision: use an atomic writer lease, owner-only parameter-bound external authorization, live rule rechecks, independent pinned-SHA audits, and a frozen core replay before optional work.
- Before launch: confirm fresh rules/rights; acquire one writer token; prove server-derived auth plus database idempotency; require fatal 0G/ENS verification; freeze and replay the core twice from a clean checkout.

## Dependency map

```text
Goal C0 coordinator
  |
  +--> Goal A1 foundation -------------------------+
  |                                                |
  +--> Goal P0 0G probe (async read-only) ----------+--> Goal A2 marketplace/auth
  +--> Goal E0 ENS probe (async read-only)          |         |
  +--> Goal U0 Uniswap probe (async read-only)      |         v
  +--> Goal VA continuous audit (async read-only)   |    Goal A2R cleanup/isolation
                                                   |         |
                                                   +--> Goal A3 strict 0G
                                                             |
                                                        Goal A4 stable ENS
                                                             |
                                              optional Goal A5 Uniswap
                                                             |
                                                        Goal A6/A7 deploy/release
```

Only Goals P0, E0, U0, and VA may overlap a writer. Goals A1, A2, A2R, A3, A4, A5, and A6/A7 are sequential writers.

## Goal C0 - master autonomous coordinator

```text
/goal
Operate AlphaDawg Lisbon Continuity from the current `developer` worktree through release. Work autonomously, enforce every gate, admit one mutating writer at a time, and keep read-only probes/audits asynchronous.

CONTRACT
- repo: discover from current working directory
- baseline: bfa7bd37c573e2e49525d965f7f937210e170d72
- branch: developer
- protected core: authenticated immutable agent hiring -> strict verified 0G Compute and proof-enabled Storage -> stable ENS creator/agent authority -> canonical receipt
- conditional third track: Uniswap Stack Contribution only after its probe and admission gate. The regular API track remains rejected without written Continuity admission.
- selected default tracks: 0G Keep + ENS Continuity
- status default: research_only_not_promotable

START
1. Read the Shared contract and Read order in docs/lisbon/GOALS.md.
2. Run blocking `A0-LIVE-AUTHORITY`: recheck timestamped official prize/rule/docs/repository/form sources and reconcile category, eligibility, sponsor primitive, network, public-repo/license, video/booth/form duties, and deadlines. Unknown or drifted requirements stay `research_only_not_promotable` and cut/block their writer.
3. Verify branch, HEAD, worktree census, dirty state, remote, Node/npm versions, atomic writer lock, and current ACTIVE-WRITER.
4. Never discard unknown changes. Stop on another active writer or branch mismatch.
5. Reconcile docs/lisbon/BASELINE.md and EXTERNAL-EFFECTS.md with current evidence, but never self-authorize an external effect.
6. Schedule the fixed writer chain: A1 -> A2 -> cleanup/isolation -> A3 0G -> A4 ENS -> core freeze/replay -> optional Uniswap -> deploy/release.
7. Permit P0, E0, U0, and Goal VA concurrently because they cannot edit the product checkout.
8. Delegate only through the Subagent contract and Sprint execution matrix. After every writer commit, obtain an independent read-only audit before opening the next gate.
9. After A4, freeze a core SHA and pass clean-worktree install/build/start plus two resettable four-minute 0G+ENS replays. Use a local clean clone if push is not authorized; remote fresh-clone release proof remains blocked. Do not open optional Uniswap until the core passes.

GATE RULES
- A1 must pass deterministic install, migration validation, lint, typecheck, tests, build, CI, and env validation before A2.
- A2 must prove authenticated ownership, immutable versions, legal state transitions, and 20-way idempotency before sponsor integration.
- Cleanup must remove success-shaped legacy behavior from the critical path without deleting useful inherited code blindly.
- A3 requires live usable 0G output, fatal verification, proof-enabled Storage readback, tamper refusal, and restart replay.
- A4 requires live ENS write/update/resolve plus transfer/stale/mismatch/outage refusal with zero new 0G calls.
- Admit Uniswap only if U0 proves the exact track/API path and the integration is load-bearing. A generic API call is not automatically a Stack Contribution.
- Deploy only when EXTERNAL-EFFECTS.md authorizes the exact providers/actions. All deployed services, receipts, evidence, and videos must share one release SHA.

OUTPUT
- Keep ACTIVE-WRITER, CHANGELOG-LISBON.md, TRACK-MATRIX.md, CLAIM-MATRIX.md, EVIDENCE.md, and FRESH-CLONE.md current.
- Make atomic commits on developer; do not create another implementation branch.
- Report each gate as PASS, FAIL, BLOCKED, or CUT with exact paths, commands, SHAs, and public identifiers.
- Finish BUILD only after PASS_RELEASE for every promoted claim; otherwise return NARROW or STOP.
```

## Goal A1 - deterministic foundation writer

```text
/goal
Own the sole writer slot for A1. Make the existing AlphaDawg repository reproducibly install, validate, test, lint, typecheck, build, and migrate without touching sponsor behavior or external systems.

PRECONDITIONS
- Read docs/lisbon/GOALS.md and all required context.
- Verify `developer`, current SHA, clean/expected diff, and no active competing writer.
- Claim ACTIVE-WRITER with allowed paths limited to package files, TypeScript/Next config, env validation, Prisma migrations, CI, tests, and Lisbon controls.

IMPLEMENT
- Use npm because package-lock.json is authoritative.
- Inventory every package script and referenced file. Remove a dead script only after proving no caller/docs/CI needs it; otherwise restore its smallest valid implementation.
- Add canonical `typecheck` and deterministic local `test` scripts. Separate local checks from `validate`, deploy, setup, mint, storage, payment, and other live-effect scripts.
- Materialize real `test:integration`, `test:redaction`, `clean:generated`, and `scan:secrets` scripts when their checks exist; never add empty success placeholders. Later sponsor goals must add their own machine-checkable smoke scripts before claiming their gate.
- Add strict environment parsing at process boundaries. Required variables fail with redacted names; optional legacy integrations stay disabled. Never log values.
- Reconcile `.env.example` with runtime reads, including OpenClaw gateway authentication. Do not add ENS/Sui/Uniswap secrets until their integration is admitted.
- Add additive Prisma migration history for the next kernel; never use `db push` as release evidence.
- Add minimal CI for npm install, Prisma validation/generation, lint, typecheck, tests, and build.
- Preserve baseline behavior; record inherited failures rather than hiding them.
- Do not add a root license unless contributor/license authority is recorded in BASELINE.md.

VERIFY
- `npm ci --legacy-peer-deps`
- `npx prisma validate`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- migration replay against empty and Cannes-shaped disposable databases when DATABASE_URL/DIRECT_URL are authorized

EXIT
- Update evidence and changelog with command exits and SHA.
- One atomic `chore:` commit on developer.
- Release ACTIVE-WRITER.
- Do not start marketplace or sponsor code.
```

## Goal P0 - asynchronous 0G probe

```text
/goal
Probe current official 0G Compute/Private Computer and Storage compatibility for AlphaDawg without modifying the product checkout.

BOUNDARY
- Product repo is read-only. Use a disposable directory for packages, builds, caches, and logs.
- Read docs/lisbon/context/0G-READY.md and inspect current src/og/** read-only.
- Use current official 0G docs/repos only; record URL, accessed time, package version, network, provider/model, and exact API signatures.
- Do not run a live provider or Storage request, spend, sign, or create external state. A3 owns every authorized live 0G effect serially.

PROVE
- Exact supported request-header and response-processing flow.
- What constitutes usable verified output; a request/chat ID alone is insufficient.
- Proof-enabled Storage upload, root/transaction, download/readback, and content-digest equality.
- Tampered/malformed response and readback fail.
- Current split-package versus unified-package decision.

RETURN
- PASS_STATIC, FAIL, or BLOCKED.
- Exact redacted compile/fixture commands, versions, official example identifiers, observed output, failure logs, compatibility decision, required product changes, and expiry/recheck time.
- Do not edit, commit, push, deploy, or promote a track. The coordinator writes the evidence later while holding the writer lock.
```

## Goal E0 - asynchronous ENS probe

```text
/goal
Probe the current stable ENS write/update/resolve path and direct ENSv2 readiness without modifying the AlphaDawg product checkout.

BOUNDARY
- Product repo is read-only; use a disposable project.
- Read docs/lisbon/context/ENSV2-GATE.md and inspect installed viem/ethers versions read-only.
- Use current official ENS, viem, contract, deployment, and explorer sources only.
- Read-only RPC resolution is allowed. Do not sign, spend, or write a name/record; A4 owns every authorized ENS write serially.

PROVE
- Stable supported create/update/resolve path for creator and agent subnames.
- Owner, resolver, record/version/manifest, chain, block, and freshness fields available to runtime policy.
- Ownership transfer, stale/mismatch, wrong chain, missing resolver, and outage behavior.
- Direct ENSv2 only if exact official repo/commit, chain/RPC, registry/resolver addresses, ABI/source, faucet, reset policy, explorer, and Continuity eligibility are complete.

RETURN
- PASS_STATIC_STABLE, PASS_STATIC_V2, FAIL, or BLOCKED.
- Exact sources, versions, read-only commands, existing public name/block/node/owner/resolver identifiers, refusal observations, recommended adapter contract, and recheck time.
- Never guess workshop addresses or make the release depend on unpublished devnet infrastructure.
```

## Goal U0 - asynchronous Uniswap probe

```text
/goal
Determine the smallest honest Uniswap path for AlphaDawg and prove SDK/API compatibility without modifying the product checkout or executing value.

BOUNDARY
- Product repo is read-only; use a disposable directory.
- Use current official ETHGlobal Uniswap prize text, Uniswap Developer Platform/docs, Uniswap AI/open-source repos, and feedback form only.
- Distinguish `Best Uniswap API Integration` from Continuity-only `Best Uniswap Stack Contribution`.
- Never assume a regular API track accepts this Continuity project without written admission.
- Do not request quotes with private user data, sign calldata, approve tokens, or broadcast value unless a later writer has explicit authorization.

PROVE
- Current API auth/version/endpoints and supported networks/assets.
- Quote/route response fields required to bind chain, token in/out, amount, recipient, slippage, deadline, spender, target, calldata selector, request ID, and final status.
- Whether existing AlphaDawg can produce reusable Uniswap ecosystem tooling rather than a one-off API call. The current Lisbon Stack track does not require an API key unless the chosen contribution actually uses the API.
- Mandatory public repo, README code pointers, FEEDBACK.md, and feedback-form requirements; verify the form is reachable.

RETURN
- ADMIT_STACK_CONTINUITY, API_PRODUCT_ONLY_NO_TRACK, BLOCKED_ELIGIBILITY, REJECT_COSMETIC, or FAIL.
- Exact official sources, packages/API version, read-only request examples, proposed removal test, required artifacts, and recheck time.
- No product edit, commit, form submission, signature, transaction, or track claim.
```

## Goal A2 - authenticated marketplace and hiring kernel writer

```text
/goal
Own the sole writer slot for A2. Replace AlphaDawg's trust-on-userId marketplace behavior with one authenticated creator, one immutable agent version, one authenticated buyer, and one replay-safe job lifecycle.

PRECONDITIONS
- A1 is green on one SHA.
- Claim ACTIVE-WRITER for prisma/schema.prisma, new migrations, src/auth/**, src/commerce/**, the minimum existing marketplace routes/UI seam, tests, and Lisbon controls.
- Inspect every caller before changing shared auth, user, marketplace, cycle, deposit, withdraw, configure, or trade behavior.

IMPLEMENT
- EIP-4361-compatible wallet challenge bound to domain, chain, account, action, nonce, audience, and expiry; consume once.
- Derive user/creator/buyer identity server-side. Caller-supplied userId, owner, payout, active, endpoint, price, or proof flags never grant authority.
- Immutable AgentVersion with canonical manifest/input/output/tool-policy/provider/proof hashes.
- Creator lifecycle: authenticated draft -> immutable version -> validated dry run -> published/discoverable version -> suspended/archived.
- Buyer lifecycle: discover -> exact version quote -> accept -> order -> job -> verified delivery -> canonical receipt.
- Canonical Quote and JobIntent with stable domain-separated SHA-256 serialization; bind buyer, creator, version, task/input, atomic price, asset/network, payout, expiry, and nonce. Reject floats, undefined, malformed addresses, and unknown variants.
- Explicit job states, append-only events, optimistic state version, bounded lease/heartbeat/recovery, and deterministic effect IDs.
- Database uniqueness for owner/slug, agent/version, manifest, quote, buyer/idempotency key, order, job/effect, settlement, commission/refund, and receipt.
- Implement typed Settlement, CommissionEntry, and Refund state with mutually exclusive terminal outcomes and at-most-one constraints. Local tests may use an explicit fake rail; it is never sponsor evidence. No live value rail runs without separate authorization.
- One protected demo loop only. Reputation, trading, marketplace breadth, and arbitrary tools stay outside the critical path.
- Quarantine legacy mutating endpoints from the Lisbon flow until they use the same authenticated boundary.

TEST
- malformed/expired/cross-domain/replayed signatures
- forged/cross-user create, configure, hire, cycle, deposit, withdraw, and trade attempts create zero mutation/effects
- immutable-version mutation refusal
- legal and illegal state transitions
- 20 concurrent identical submissions create one job and one effect identity
- duplicate/concurrent settlement produces at most one settlement and one commission; a failed delivery produces no commission and an explicit refund/recovery state
- crash before effect, after effect receipt, and before terminal persistence reconciles without duplication
- cancellation, lease expiry, restart, terminal failure, unknown external data

EXIT
- Run lint, typecheck, tests, build, and disposable migration replay.
- Commit one atomic `feat:` change, update evidence/changelog, release ACTIVE-WRITER.
- Do not integrate 0G, ENS, or Uniswap yet.
```

## Goal A2R - cleanup, Crawbot/OpenClaw isolation, and measured optimization writer

```text
/goal
Own the sole writer slot for the post-A2 cleanup gate. Remove dead or unsafe critical-path behavior, isolate OpenClaw/Crawbot legacy surfaces, and optimize only measured demo bottlenecks without changing the A2 contract.

PRECONDITIONS
- A1 and A2 pass.
- Claim ACTIVE-WRITER with exact cleanup paths. Do not overlap Goal A3.
- Search all callers before deleting or moving anything. Preserve useful Cannes code outside the Lisbon runtime.

CLEANUP AND SHARED RUNTIME
- Prove whether Crawbot exists. If it does not, record `NO_CRAWBOT_INTEGRATION_FOUND`; do not invent work.
- Require authentication for any retained OpenClaw gateway; missing token fails closed.
- Make the Lisbon worker boot and complete local fixtures with OpenClaw, Telegram, Naryo, payment, trading, and per-agent servers disabled.
- Implement one shared long-running worker that claims PostgreSQL jobs by immutable `agentVersionId`, short leases, `FOR UPDATE SKIP LOCKED` or the existing safe equivalent, bounded concurrency, heartbeat, and expired-lease recovery.
- The worker loads frozen schemas/policy by version and invokes fixed allowlisted adapters. It never launches one server/container per marketplace agent.
- Remove success-shaped fallbacks: provider failure, swap failure, fake callbacks, local signals, or cached flags cannot become verified completion.
- Remove/repair dead scripts, stale config, generated tracked artifacts, and duplicate code only when call/reference evidence supports it.

OPTIMIZE
- Measure install/build time, API validation/quote p95, queue claim p95, worker heartbeat/recovery, and demo cold start first.
- Fix only bottlenecks that threaten the four-minute demo or reliability. No Redis, generic plugin framework, new cache layer, or broad UI rewrite without measurement.
- Keep accessibility, error states, structured redacted logs, and deterministic reset behavior.

VERIFY
- legacy-disabled boot
- four simultaneous fixture jobs through one shared worker and one version-bound execution path
- worker kill/restart reclaims expired leases with zero duplicate terminal effects
- auth-required OpenClaw probe
- failure paths produce zero success receipts/effects
- baseline regression checks
- before/after measurements on the same SHA/environment
- lint, typecheck, tests, build

EXIT
- Atomic `refactor:` or `fix:` commit, evidence/changelog, release ACTIVE-WRITER.
```

## Goal A3 - strict 0G writer

```text
/goal
Own the sole writer slot for A3. Integrate one strict 0G Compute/Private Computer and proof-enabled Storage path into the authenticated A2 job lifecycle.

PRECONDITIONS
- A1, A2, cleanup gate, and P0 pass.
- Use only the package/version/API proven by P0.
- Claim ACTIVE-WRITER for src/og/**, the minimum worker/receipt seam, tests, and evidence.

IMPLEMENT
- Bind creator, immutable version/manifest, buyer, JobIntent/input hash, provider/model, nonce, deadline, policy version, and effect ID before calling 0G.
- Persist exact request bytes/hash and provider request identifier before execution when the SDK permits.
- Treat official response processing/verification as fatal. A request/chat ID or provider text without successful verification is unusable.
- Upload the canonical receipt payload to 0G Storage; enable proof verification on readback and compare exact digest/root.
- Persist request/proof/output/storage identifiers and redacted raw evidence before terminal success.
- Reconcile ambiguous outcomes by the same identifier; never issue a blind replacement effect.
- Provider outage, timeout, malformed response, tamper, verification failure, or readback mismatch yields explicit non-success.
- Keep OpenClaw/Crawbot/local-signal fallbacks outside the authoritative worker.

TEST
- live verified success when `0g_live_smoke` is authorized
- missing/invalid/tampered proof
- one-byte output and Storage tamper
- request ID exists but usable verification fails
- timeout/outage/malformed variant
- duplicate/concurrent retry
- kill before request, after response, and after receipt persistence; one terminal effect

EXIT
- Lint, typecheck, tests, build, authorized live smoke, restart replay.
- Atomic `feat:` commit with new Lisbon public IDs; update track/claim/evidence files; release ACTIVE-WRITER.
```

## Goal A4 - stable ENS writer

```text
/goal
Own the sole writer slot for A4. Make creator-controlled ENS identity a mandatory runtime authority boundary for the same A3 job.

PRECONDITIONS
- A3 and E0 `PASS_STATIC_STABLE`.
- Claim ACTIVE-WRITER for the minimum ENS module, schema/evidence fields, worker seam, tests, and UI evidence surface.

IMPLEMENT
- Publish one creator name/subname and one agent-specific subname bound to immutable version, manifest, capability, and service metadata.
- Use the stable official client/network proven by E0. Direct ENSv2 is optional only after `PASS_STATIC_V2` plus an authorized A4 live write/readback.
- Freshly resolve trusted root, creator owner, agent owner/delegate, resolver, version, manifest, service, chain, block, and freshness immediately before 0G.
- Repeat resolution before accepting delivery.
- Persist exact name/node/owner/resolver/record hash/chain/block/transaction/time and policy decision in the job receipt.
- Parent or agent transfer suspends old authority. New owner must publish a new immutable version; authority never silently transfers.
- Missing/stale/mismatched/wrong-chain/outage state causes zero new 0G calls and zero accepted delivery.

TEST
- authorized write/update/resolve
- forged writer
- parent and agent transfer before execution
- transfer/mutation during execution
- stale record, wrong version/manifest/chain/resolver
- RPC/resolver outage and restart
- explicit zero downstream 0G calls for each refusal

EXIT
- Lint, typecheck, tests, build, authorized live ENS smoke and full ENS -> 0G -> delivery replay.
- Atomic `feat:` commit with public identifiers; update evidence/claims; release ACTIVE-WRITER.
```

## Goal A5 - conditional Uniswap writer

```text
/goal
Own the sole writer slot for the conditional Uniswap slice. Implement nothing unless Goal U0 and the coordinator explicitly admit an honest product or Continuity path.

ADMISSION
- A1-A4 pass; protected 0G+ENS core is frozen and green.
- The frozen core SHA passes clean-clone install/build/start and two resettable four-minute 0G+ENS replays.
- U0 returned ADMIT_STACK_CONTINUITY, or written organizer/sponsor evidence separately admits the regular API track. `API_PRODUCT_ONLY_NO_TRACK` cannot open a prize claim.
- EXTERNAL-EFFECTS.md authorizes the needed API, form, signing, network, assets, wallet, and cap separately.
- At least six engineering hours remain before feature freeze.
- If any condition fails, record `CUT_UNISWAP` and make no code change.

IMPLEMENT
- Keep model output advisory. Deterministic policy and explicit human approval bind chain, token in/out, atomic amount, recipient, slippage, deadline, spender, target, function selector, quote/request ID, and expected final status.
- Use the official Uniswap API with a valid Developer Platform key only if admitted. Runtime-validate every external response.
- Persist prepared transaction/calldata hash and approval before signature; reconcile the same tx/request after ambiguous broadcast.
- Failed routing, signing, broadcast, receipt, or balance-delta verification stays failed. Never use AlphaDawgSwap/self-transfer as Uniswap success.
- For Stack Contribution, produce genuinely reusable tooling outside AlphaDawg, public code pointers, tests/example, FEEDBACK.md, and authorized feedback-form submission. A one-off API wrapper cannot claim Stack. Do not impose API-key or transaction-ID requirements on Stack unless the selected contribution actually needs them.
- Never settle or trade the same JobIntent twice.

TEST
- valid authorized quote/execution/finality and balance deltas
- wrong chain/token/recipient/amount/slippage/deadline/spender/target/selector
- malformed/tampered API response and calldata
- duplicate/restart/timeout reconciliation
- rejected human approval yields zero signature/broadcast
- provider/API outage and reverted transaction
- removal test proving the claimed Uniswap guarantee disappears

EXIT
- Full checks plus authorized live lifecycle.
- Atomic `feat:` commit, FEEDBACK.md if admitted, public IDs/evidence, release ACTIVE-WRITER.
- Promote only the exact track U0 admitted.
```

## Goal A6/A7 - autonomous deployment, demo, and release writer

```text
/goal
Own the sole writer slot for deployment and release. Freeze features, deploy the same SHA autonomously where authorized, verify the complete story, and fail closed on missing credentials or evidence.

PRECONDITIONS
- Required code gates pass; optional tracks are PASS_LIVE or explicitly CUT.
- EXTERNAL-EFFECTS.md authorizes each exact push, hosting, database migration, sponsor smoke, transaction, form, and spend action.
- Claim ACTIVE-WRITER for deployment config, readiness, deterministic demo tooling, docs, and evidence only.

DEPLOY
- Prefer the existing minimal target: Vercel web/API, managed PostgreSQL, Railway long-running worker.
- Deploy web and worker from one frozen developer SHA; expose releaseSha, migrationVersion, receiptSchemaVersion, policyVersion, workerHeartbeat, selectedTracks, network, and evidence age without secrets.
- Apply reviewed additive migrations; never repair production manually.
- Add deterministic demo seed/reset/assert that refuses unknown namespaces and production deletion.
- On deployment failure, preserve logs, stop new effects, and roll back to the last known-green same-SHA release when authorized. Never fabricate readiness.

RELEASE GATE
1. clean install (`npm ci`; if A1 proves a repository-scoped legacy-peer setting is required, commit that setting and still use `npm ci`)
2. Prisma validation plus empty/upgraded migration replay
3. lint
4. typecheck
5. unit/integration/adversarial tests
6. production build/start
7. secret, PII, plaintext, and history scan
8. authorized live 0G and ENS smokes; Uniswap only if admitted
9. success, forged owner, tamper, duplicate, timeout, partial failure, sponsor outage, kill/restart, ENS transfer; Uniswap rejection if admitted
10. fresh clone of remote developer
11. same SHA across web, worker, receipt, evidence, video, and public IDs
12. two resettable four-minute rehearsals: failure-first, then success plus replay no-op
13. public README/setup, prior state, dated changelog, What's Next, AI disclosure, a shared 2:00-2:59 video satisfying 0G's under-three-minute rule, Uniswap form/FEEDBACK.md if admitted, and ENS Sunday-morning booth material
14. stable scripts exist and pass: `clean:generated`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `test:resilience`, `test:redaction`, `build`, `scan:secrets`, selected sponsor smokes, `demo:reset`, and `demo:replay`; no placeholder scripts

EXIT
- Update every Lisbon control file with exact evidence.
- Atomic release commit; push/deploy only when authorized.
- Return BUILD only for PASS_RELEASE claims, NARROW for a green core with cuts, or STOP for a red protected guarantee.
```

## Goal VA - continuous independent change audit

Run this in a separate Codex project/thread. It is always read-only and can overlap any writer.

```text
/goal
Continuously audit all AlphaDawg Lisbon changes on `developer` without repairing them. Compare current state with baseline bfa7bd37c573e2e49525d965f7f937210e170d72 and fail closed.

BOUNDARY
- Read-only: no edits, installs, formatters, commits, pushes, deployments, signatures, transactions, forms, or spend.
- Inspect one pinned committed SHA from a disposable worktree; do not audit a moving dirty checkout.
- Read AGENTS.md, docs/lisbon/GOALS.md, context, controls, git history/diff, tests, logs, evidence, and deployed/public state when available.
- Never accept another agent's PASS without inspecting the evidence scope.

AUDIT EACH CHANGE
- Branch/worktree provenance, start/end SHA, atomic commit, allowed paths, and one-writer compliance.
- Requirement-to-code-to-test-to-live-evidence traceability.
- Auth and cross-user isolation; runtime validation; no arbitrary model authority.
- Immutable version, canonical hashing, state transitions, DB constraints, leases, idempotency, restart/reconciliation.
- No success-shaped 0G, Storage, ENS, OpenClaw, Naryo, swap, payment, callback, or UI fallback.
- Sponsor primitive is load-bearing and removal/refusal tests cause zero downstream effects.
- Secrets/PII/plaintext absent from tracked files, history, logs, screenshots, videos, receipts, and evidence.
- Lint/typecheck/tests/build/migrations/fresh clone actually cover changed paths.
- Deployed web/worker/database/public IDs all bind the same release SHA and JobIntent.
- Track rules, mandatory artifacts, forms, videos, booth, public code pointers, and claim wording match current official evidence.

RETURN
- Ranked CRITICAL/HIGH/MEDIUM/LOW findings with file:line, exploit/failure path, required evidence, and blocking gate.
- Requirement matrix: PROVEN, CONTRADICTED, INCOMPLETE, WEAK, or MISSING.
- Final decision: PASS_TO_NEXT_GATE, BLOCK, CUT_TRACK, NARROW, or STOP.
- Do not implement fixes. Give the coordinator the smallest root-cause repair packet.
```

## Launch sequence

1. Primary project: paste Goal C0.
2. Writer project: paste Goal A1 only after A0 is closed.
3. Async read-only projects: paste P0, E0, U0, and VA.
4. After A1: run A2, A2R, A3, and A4 sequentially.
5. Run A5 only if admitted.
6. Finish with A6/A7 while VA audits the frozen candidate.
