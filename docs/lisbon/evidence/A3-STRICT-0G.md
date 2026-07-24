# A3 Strict 0G Fixture and Integration Evidence

- Task: `A3-STRICT-0G-FIXTURE-INTEGRATION-20260724`
- Sprint: `A3`
- Start/control SHA: `dd336b840edb4de97fc382298c5a0c0c658f6f9f`
- Branch: `developer`
- Observed through: `2026-07-24T04:41:00Z`
- Exit SHA: derive from the commit containing this packet
- Result: `PASS_FIXTURE; PASS_INTEGRATION; PASS_TO_AUDIT; LOCAL_ONLY`
- Live result: `NOT_RUN; LIVE_EFFECT_BLOCKED`

## Result and boundary

A3 replaces the authoritative worker's `A3_NOT_CONFIGURED` seam with one strict, fail-closed 0G adapter. A deterministic local Compute fixture, an actual structured Go subprocess, and disposable loopback PostgreSQL complete one lawful result, receipt, settlement, and commission. Every negative fixture terminates with one failed effect and refund and creates zero receipt, settlement, commission, rating, trade action, second effect, or proof hash.

This is offline fixture and integration evidence only. No 0G provider, indexer, RPC, storage node, sponsor service, shared database, wallet, transaction, deployment, user signature, spend, push, form, or public identifier was contacted or created. `PASS_LIVE` remains blocked. This packet does not claim release, production readiness, bounty qualification, or Lisbon-window work classification.

The writer started clean on exact SHA `dd336b840edb4de97fc382298c5a0c0c658f6f9f`, branch `developer`, atomically acquired common-Git-dir token `3EFB753E-44AB-4FC5-AC06-DF67929282E8`, and mirrored it before implementation. The package lock remains byte-identical with SHA-256 `b4a1aed30a52a74d1b4396da9f1d6535a5e475da1b40a99a6c744aae1a8c6b33`.

## Strict Compute boundary

- The default runtime is disabled. Live construction requires server-only `A3_0G_LIVE_ENABLED=true`, explicit funding authority, a bounded spend cap, and an authorization value that exactly binds the lowercase provider, model, and cap. It also requires exact HTTPS RPC/indexer URLs, a normalized verifier executable path, and a private key. Disabled and fixture execution do not load the broker module, construct a broker/indexer, request billing headers, or fund an account.
- The installed `@0glabs/0g-serving-broker@0.7.4` CommonJS module is loaded only inside the authorized live boundary. The adapter never calls `processResponse` and never acknowledges or replaces a signer.
- Service selection requires one exact provider, exact model, `TeeML`, HTTPS base/endpoint equality, an already acknowledged service signer, strict known-key `additionalInfo`, `TargetSeparated: true`, and a lowercase `TargetTeeAddress`.
- The complete canonical request is constructed and durably hashed before any single-use billing header is requested. It binds creator ID/wallet, buyer ID/wallet, immutable agent version and manifest hash, JobIntent/input hash, provider/model, deterministic nonce, deadline, policy version, intent/job/effect IDs, instructions, and prompt.
- Live HTTP request and signature fetch receive the worker `AbortSignal`. Only a non-empty `ZG-Res-Key` is accepted; there is no response-ID fallback. Status, provider, model, response shape, and bounded assistant content are validated.
- Exactly one signature object is fetched. Its schema and signature shape must be exact, the installed `InferenceVerifier.verifySignature` must return `true` against the separated TEE signer, and UTF-8 bytes of signed text must equal UTF-8 bytes accepted downstream. A request ID, `verified` flag, cached output, local model, or proof-looking string cannot substitute.

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
- `READBACK_VERIFIED` returns the exact persisted result/proof with zero Compute, Storage, or verifier calls.
- Heartbeat lease loss aborts active HTTP/subprocess work. Every later database mutation remains independently fenced if cancellation races.

The runner no longer turns malformed proof text into a valid-looking hash. A successful strict adapter must return one lowercase 64-hex proof already bound to the verified journal, or the effect fails.

## Pinned Go Storage verifier

The verifier is a small stdin/stdout Go module under `tools/0g-storage-verifier`:

- Toolchain: Go `1.23.10`.
- Authorized Darwin arm64 archive SHA-256: `25c64bfa8a8fd8e7f62fb54afa4354af8409a4bb2358c2699a1003b733e6fce5`.
- Official dependency: `github.com/0gfoundation/0g-storage-client v1.3.0`.
- Pinned upstream commit: `0c725b7323c1a134cdbf8071c4974549024bfef2`.
- Production construction: `indexer.NewClient(indexerURL, indexer.IndexerClientOption{FullTrusted: false})`.
- Proof path: `Download(ctx, root, temporaryFile, true)`.

The Go boundary limits stdin, receipt, and downloaded file sizes; uses `DisallowUnknownFields`; rejects arrays, missing/wrong/unknown fields, non-lowercase roots/digests, noncanonical receipt JSON, and trailing JSON; binds receipt effect/root/digest/size; uses a private temporary directory; cleans it recursively; hashes exact downloaded bytes with SHA-256; and emits one typed JSON object only on success. All failures exit nonzero.

The Node boundary uses `spawn` with `shell: false`, bounded stdout/stderr, timeout and claim-loss kills, strict exact-key/type parsing, and independent effect/root/digest/size comparisons. `verified: true` alone is insufficient. The production request schema has no fixture path, fixture content, root derivation, or transport selector. The separate test command obtains fixture bytes only through a test-only environment value and rejects a root not derived from those bytes.

## Negative and recovery evidence

Eight focused TypeScript tests pass. The fixture matrix covers:

- deterministic signed-content plus Go proof/readback success and twenty identical submissions converging to one effect;
- signature verifier `false`, missing/malformed signature objects, wrong signer, and one-byte Compute-content mismatch;
- one-byte Storage readback mutation, wrong root, digest, size, schema, missing receipt field, unknown receipt field, missing verifier output, and unknown verifier output;
- malformed JSON, array, wrong output type, unknown field, `verified: true` alone, wrong binding, extra JSON object, oversized stdout, nonzero exit, process signal, timeout, and caller abort;
- crashes before any Compute call, after `RESPONSE_VERIFIED`, after `STORAGE_COMMITTED`, and after `READBACK_VERIFIED`, proving stage-specific zero-repeat behavior;
- recovered ambiguous Compute and Storage dispatch markers, proving no blind retry;
- A-to-B lease replacement during service resolution, proving no later A journal, header, request, signature, upload, readback, receipt, settlement, or commission mutation; and
- illegal skipped transition and terminal-journal mutation refusal.

All fourteen terminal mutation cases produced a failed job/effect, one refund, zero receipt/settlement/commission/rating/trade action, one effect total, a `FAILED` journal, and a null proof hash.

Two Go tests independently prove `withProof=true`, exact byte/digest/size success, strict request JSON, and one-byte downloaded-content rejection. The combined integration command passed 13/13 reported TypeScript tests: eight A3 tests plus the five pre-existing database URL and A2 worker-fencing tests.

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
| `npm run test:go` | 0 | Two Go tests passed; production verifier command built. |
| `npm run test:integration` | 0 | 13/13 TypeScript tests plus both migration lanes passed. |
| `npm run test:e2e` | 0 | 4/4 protected CLI/boot/entrypoint tests passed. |
| `npm run test:resilience` | 0 | 1/1 cleanup test passed. |
| `npm run test:redaction` | 0 | 3/3 redaction tests passed. |
| `npm run test:boot` | 0 | Protected smoke booted with both worker classes disabled and no sponsor credential. |
| `bash -n docker-entrypoint.sh` | 0 | Entrypoint syntax passed. |
| `npm run scan:secrets` | 0 | No high-confidence pattern in the complete staged A3 file set. |
| `npm run build` | 0 | Next.js `16.2.2` compiled, typechecked, and generated 31/31 static pages with a deliberately non-live public Dynamic UUID. |
| `git diff --check` and exact allowlist scan | 0 | No whitespace defect, package-lock change, generated artifact, or out-of-scope path. |

The atomic commit and physical lease release are verified immediately after the containing commit. Independent pinned-SHA audit remains pending and is not preclaimed here.

## Remaining blocks

- `PASS_LIVE` is `NOT_RUN` and `LIVE_EFFECT_BLOCKED`: no exact external-effect authorization or public Compute request, signer, Storage root, proof, transaction, or explorer identifier exists.
- Rights/license/team/owner records, event-window classification, sponsor access/caps, inherited dependency findings, README first-viewport claim drift, deployment, push, forms, and independent release audit remain unresolved.
- A3 local fixture/integration success does not establish 0G bounty qualification, production readiness, release validity, or expected winnings.

External effects attempted: none. Sponsor calls: none. Managed/shared database effects: none. User signatures, network transactions, deployments, pushes, forms, spend, mainnet value, live proof, and claim promotion: none.
