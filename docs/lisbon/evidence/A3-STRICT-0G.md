# A3 Strict 0G Remediation G1 Evidence

- Task: `A3-STRICT-0G-REMEDIATION-G1-20260724`
- Sprint: `A3_remediation`
- Start/control SHA: `879072a728f0bec7a4b7a541594a7920cd815d69`
- Branch: `developer`
- Observed through: `2026-07-24T05:47:13Z`
- Exit SHA: `9a4f41f8c679469dc230cba584bce84fcc3c65e5`
- Result: `PASS_FIXTURE; PASS_INTEGRATION; PASS_REAUDIT; LOCAL_ONLY`
- Live result: `NOT_RUN; LIVE_EFFECT_BLOCKED`

## Result and boundary

A3 remediation G1 retains the strict local fixture integration while removing production live authority completely. The production adapter cannot construct or import a broker, signer, Storage client, verifier executable, funding path, uploader, or network transport from environment settings. Only an explicitly injected local fixture can execute Compute or Storage behavior. A deterministic local Compute fixture, an actual structured Go subprocess, and disposable loopback PostgreSQL complete one lawful result, receipt, settlement, and commission. Every negative fixture terminates with one failed effect and refund and creates zero receipt, settlement, commission, rating, trade action, second effect, or proof hash.

This is offline fixture and integration evidence only. No 0G provider, indexer, RPC, storage node, sponsor service, shared database, wallet, transaction, deployment, user signature, spend, push, form, or public identifier was contacted or created. `PASS_LIVE` remains blocked. This packet does not claim release, production readiness, bounty qualification, or Lisbon-window work classification.

The writer started clean on exact SHA `879072a728f0bec7a4b7a541594a7920cd815d69`, branch `developer`, atomically acquired common-Git-dir token `E83BB3D9-81C2-4FFF-9DE3-C64CD847F3EC`, and mirrored it before implementation. The package lock remains byte-identical with SHA-256 `b4a1aed30a52a74d1b4396da9f1d6535a5e475da1b40a99a6c744aae1a8c6b33`. The independent audit of `879072a728f0bec7a4b7a541594a7920cd815d69` returned `FIX_REQUIRED`; the single permitted remediation produced `9a4f41f8c679469dc230cba584bce84fcc3c65e5`, which the final independent re-audit accepted with no blocking finding.

## Strict Compute boundary

- Production live A3 is unconditionally unavailable, regardless of environment values. The retired `A3_0G_LIVE_ENABLED`, `A3_0G_FUNDING_AUTHORIZED`, `A3_0G_MAX_SPEND_ATOMIC`, and `A3_0G_SPEND_AUTHORIZATION` settings are rejected by environment validation and are absent from `.env.example`.
- Without an explicit injected fixture, `StrictA3Adapter` stores no runtime and immediately returns terminal `A3_LIVE_BLOCKED`. Its production construction path contains no dynamic or static import of the broker or TypeScript Storage SDK and cannot construct a broker, query signer status, request billing headers, fund an account, sign, upload, run the verifier, or call the network. A regression supplies every former flag and credential permissively, intercepts `fetch`, and proves zero network calls plus one failed effect/refund and no journal or success artifact.
- The explicitly local fixture service still requires one exact provider, exact model, `TeeML`, HTTPS base/endpoint equality, an acknowledged signer, strict known-key `additionalInfo`, `TargetSeparated: true`, and a lowercase `TargetTeeAddress`.
- The complete canonical request is constructed and durably hashed before any single-use billing header is requested. It binds creator ID/wallet, buyer ID/wallet, immutable agent version and manifest hash, JobIntent/input hash, provider/model, deterministic nonce, deadline, policy version, intent/job/effect IDs, instructions, and prompt.
- Every injected Compute operation receives one combined signal binding worker claim loss to the canonical journal deadline. Abort listeners are registered before invocation and rechecked, and every listener/timer is removed. A stalled request or exact-one signature fetch terminates promptly with `A3_REQUEST_DEADLINE_EXPIRED`, even while leases remain healthy.
- Exactly one signature object is fetched by the local fixture path. Its schema and signature shape must be exact, the injected verifier must return `true` against the separated TEE signer, and UTF-8 bytes of signed text must equal UTF-8 bytes accepted downstream. A request ID, `verified` flag, cached output, local model, or proof-looking string cannot substitute.

## Durable recovery and claim authority

Migration `20260724041000_strict_0g` has SHA-256 `ae8e4e629d44fa1bbab020fb31e783188611aa17304c3a2123701c55d73751ed`. It adds one unique-by-effect and unique-by-job `a3_execution_journals` record with versioned stages:

```text
PREPARED
  -> REQUEST_SENT
  -> RESPONSE_VERIFIED
  -> STORAGE_REQUESTED
  -> STORAGE_COMMITTED
  -> READBACK_VERIFIED

any nonterminal stage -> FAILED
```

The database requires an empty `PREPARED` insert, exact `version + 1` transitions, legal ordering, immutable binding columns, append-only evidence fields, immutable terminal rows, and no delete. It stores the exact canonical request bytes/hash, stable nonce, provider/model, response request ID/signer/content/hash, Compute receipt bytes/digest, Storage receipt bytes/digest, expected root/digest/size, readback root/digest/size, exact result, and final proof hash.

Before preparation and every journal transition, the transaction re-proves the A2 worker lease owner, worker epoch, exact job claim version/effect identity, and unexpired worker plus job leases. The existing A2 success/failure/requeue/finalization functions retain the same proof. Strict success additionally locks and matches one `READBACK_VERIFIED` journal, exact result JSON, proof hash, root, digest, and size before writing the effect or receipt.

Recovery rules are fail-closed:

- `PREPARED` may dispatch once.
- A recovered `REQUEST_SENT` becomes `A3_AMBIGUOUS_COMPUTE_REQUEST`; Compute is not called again.
- `RESPONSE_VERIFIED` skips every Compute call and proceeds to Storage.
- A recovered `STORAGE_REQUESTED` becomes `A3_AMBIGUOUS_STORAGE_REQUEST`; upload is not called again.
- `STORAGE_COMMITTED` skips Compute and upload and repeats proof-enabled readback only.
- `READBACK_VERIFIED` is reconstructed and re-proved from the immutable journal before adapter construction. It finalizes with zero adapter, Compute, Storage, or verifier calls.
- Heartbeat lease loss aborts active HTTP/subprocess work. Every later database mutation remains independently fenced if cancellation races.

The same journal-first recovery runs inside the adapter-exception path and expired-lease reconciliation. A hard kill after durable readback at `attempt=max` is recognized before attempt exhaustion, creates exactly one effect/receipt/settlement/commission, creates no refund, and invokes a supplied recovery adapter zero times. The in-process post-readback exception case passes at `attempt=max` without requeue or `ATTEMPTS_EXHAUSTED`.

The runner no longer turns malformed proof text into a valid-looking hash. A successful strict adapter must return one lowercase 64-hex proof already bound to the verified journal, or the effect fails.

## Pinned Go Storage verifier

The verifier is a small stdin/stdout Go module under `tools/0g-storage-verifier`:

- Toolchain: Go `1.23.10`.
- Authorized Darwin arm64 archive SHA-256: `25c64bfa8a8fd8e7f62fb54afa4354af8409a4bb2358c2699a1003b733e6fce5`.
- Official dependency: `github.com/0gfoundation/0g-storage-client v1.3.0`.
- Pinned upstream commit: `0c725b7323c1a134cdbf8071c4974549024bfef2`.
- Production construction: `indexer.NewClient(indexerURL, indexer.IndexerClientOption{FullTrusted: false})`.
- Proof path: `Download(ctx, root, temporaryFile, true)`.

Before official `Download`, the Go process applies Unix `RLIMIT_FSIZE` at 1 MiB (or a pre-existing lower hard limit) and includes `SIGXFSZ` in its signal-aware context. This kernel bound prevents an oversized regular file from first consuming unbounded disk. The logical 1 MiB check remains independent. The Go boundary also limits stdin and receipt sizes; uses `DisallowUnknownFields`; rejects arrays, missing/wrong/unknown fields, non-lowercase roots/digests, noncanonical receipt JSON, and trailing JSON; binds receipt effect/root/digest/size; hashes exact downloaded bytes with SHA-256; and emits one typed JSON object only on success. All failures exit nonzero.

The Node boundary owns a fresh per-invocation `TMPDIR` and recursively removes it only after the child closes, including malformed output, crash, nonzero exit, timeout, caller abort, stdout/stderr overflow, oversized temporary output, cooperative termination, and forced-kill fallback. It registers abort before rechecking the signal, removes every timer/listener, sends `SIGTERM` first, then uses a short bounded `SIGKILL` fallback. It retains `spawn` with `shell: false`, 64 KiB stdout/stderr bounds, strict exact-key/type parsing, and independent effect/root/digest/size comparisons. `verified: true` alone is insufficient.

## Negative and recovery evidence

Twelve focused TypeScript tests pass. The fixture matrix covers:

- deterministic signed-content plus Go proof/readback success and twenty identical submissions converging to one effect;
- signature verifier `false`, missing/malformed signature objects, wrong signer, and one-byte Compute-content mismatch;
- one-byte Storage readback mutation, wrong root, digest, size, schema, missing receipt field, unknown receipt field, missing verifier output, and unknown verifier output;
- malformed JSON, array, wrong output type, unknown field, `verified: true` alone, wrong binding, extra JSON object, oversized stdout/stderr, nonzero exit, process signal/crash, timeout, caller abort, pre-abort, forced-kill fallback, and per-exit temporary-tree cleanup;
- malformed Go-style output, process crash, nonzero exit, timeout, abort, and oversized output through the full strict adapter, journal, worker, failure, and refund path;
- never-resolving Compute send and signature retrieval under the canonical deadline, with no accepted output or downstream effect;
- crashes before any Compute call, after `RESPONSE_VERIFIED`, after `STORAGE_COMMITTED`, and after `READBACK_VERIFIED`, proving stage-specific zero-repeat behavior plus same-process terminal recovery;
- expired `attempt=max` readback recovery before exhaustion with zero adapter calls;
- recovered ambiguous Compute and Storage dispatch markers, proving no blind retry;
- A-to-B lease replacement during service resolution, proving no later A journal, header, request, signature, upload, readback, receipt, settlement, or commission mutation; and
- illegal skipped transition and terminal-journal mutation refusal.

The 14 original terminal mutation cases plus six subprocess-process failures, two deadline stalls, and one permissive-live-settings attempt each produced a failed job/effect, one refund, zero receipt/settlement/commission/rating/trade action, one effect total, and no accepted proof. Process and deadline cases also produced a terminal `FAILED` journal; the production-authority block stopped before journal preparation.

Three Go tests independently prove `withProof=true`, exact byte/digest/size success, strict request JSON, one-byte downloaded-content rejection, and kernel rejection of a regular file exceeding 1 MiB. The combined integration command passed 17/17 reported TypeScript tests: twelve A3 tests plus the five pre-existing database URL and A2 worker-fencing tests.

## Migration replay

Both disposable PostgreSQL paths passed with three finished migrations and eight named invariant triggers:

1. empty database deployment; and
2. inherited baseline materialization, baseline resolution, then A2+A3 forward deployment.

The synthetic Cannes sentinel remains `a1-cannes-sentinel`, wallet `0xa1cannessentinel`, SHA-256 `fb8aece1677586a330f0cfeb0850b71488849302324eb1d6a079673e35e3829e`, with next sequence value `43`. This is synthetic upgrade evidence, not a managed or live Cannes migration.

## Cold local gate

Toolchain: Node `v22.22.3`, npm `10.9.8`, Prisma/Client `6.19.3`, TypeScript `5.9.3`, Go `1.23.10`, local PostgreSQL `12.17`.

| Command/check | Exit | Observed |
|---|---:|---|
| `npm run clean:generated` | 0 | Removed only known generated outputs. |
| `npm ci --legacy-peer-deps` | 0 | Reinstalled from the unchanged committed lockfile; the actual npm PID was observed through exit before later checks. |
| `npx prisma validate` | 0 | Passed with non-connecting loopback URL placeholders. |
| `npx prisma generate` | 0 | Prisma Client `6.19.3` generated. |
| `npm run validate:env` | 0 | Offline protected defaults passed with strict A3 disabled. |
| `npm run validate:env -- --require-database` | 0 | Loopback placeholder pair passed without connecting. |
| `npm run lint` | 0 | Zero errors; 23 inherited warnings and no A3 warning. |
| `npm run typecheck` | 0 | Strict TypeScript passed. |
| `npm test` | 0 | 9/9 foundation and pure kernel tests passed. |
| `npm run test:auth` | 0 | 7/7 authentication tests passed. |
| `npm run test:kernel` | 0 | 13/13 reported A2 kernel tests passed. |
| `npm run test:go` | 0 | Three Go tests passed; production verifier command built with pinned Go `1.23.10`. |
| `npm run test:integration` | 0 | 17/17 TypeScript tests plus both migration lanes passed. |
| `npm run test:e2e` | 0 | 4/4 protected CLI/boot/entrypoint tests passed. |
| `npm run test:resilience` | 0 | 1/1 cleanup test passed. |
| `npm run test:redaction` | 0 | 3/3 redaction tests passed. |
| `npm run test:boot` | 0 | Protected smoke booted with both worker classes disabled and no sponsor credential. |
| `bash -n docker-entrypoint.sh` | 0 | Entrypoint syntax passed. |
| `npm run scan:secrets` | 0 | No high-confidence pattern in the complete staged A3 file set. |
| `npm run build` | 0 | Next.js `16.2.2` compiled, typechecked, and generated 31/31 static pages with a deliberately non-live public Dynamic UUID. |
| `git diff --check` and exact allowlist scan | 0 | No whitespace defect, package-lock change, generated artifact, or out-of-scope path. |

The atomic commit and physical lease release were verified at exact SHA `9a4f41f8c679469dc230cba584bce84fcc3c65e5`.

## Independent remediation re-audit

The final read-only audit returned `PASS_A3_REMEDIATION` on exact SHA `9a4f41f8c679469dc230cba584bce84fcc3c65e5` with parent `879072a728f0bec7a4b7a541594a7920cd815d69`, eighteen allowlisted remediation paths, clean `developer`, and no physical writer lock.

It independently closed all five original findings: production live authority is absent; immutable `READBACK_VERIFIED` recovery precedes adapter construction and attempt exhaustion; Node and Go termination/cleanup/file bounds are enforced; the canonical deadline reaches Compute, signature retrieval, Storage, and the verifier; and subprocess failures are proven through worker persistence and deterministic refund. It repeated the pinned Go build/tests, Prisma, environment, lint/typecheck, foundation/auth/kernel/A3/integration/migrations/e2e/resilience/redaction/boot/secret/shell/build gates without a blocker.

## Remaining blocks

- `PASS_LIVE` is `NOT_RUN` and `LIVE_EFFECT_BLOCKED`: production A3 live execution is unconditionally unavailable in this remediation, and no provider/indexer/RPC call, public Compute request, signer, Storage root, proof, transaction, or explorer identifier exists.
- Rights/license/team/owner records, event-window classification, sponsor access/caps, inherited dependency findings, README first-viewport claim drift, deployment, push, forms, and independent release audit remain unresolved.
- A3 local fixture/integration success does not establish 0G bounty qualification, production readiness, release validity, or expected winnings.

External effects attempted: none. Sponsor calls: none. Managed/shared database effects: none. User signatures, network transactions, deployments, pushes, forms, spend, mainnet value, live proof, and claim promotion: none.
