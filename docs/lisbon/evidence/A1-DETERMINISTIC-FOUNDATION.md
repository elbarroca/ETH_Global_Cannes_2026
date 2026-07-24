# A1 Deterministic Foundation Evidence

- Task: `A1-DETERMINISTIC-FOUNDATION-20260724T0107WEST`
- Sprint: `A1`
- Start/control SHA: `8c07b80a515405947b5994c6540f9038e7f5058f`
- Baseline: `bfa7bd37c573e2e49525d965f7f937210e170d72`
- Branch: `developer`
- Observed through: `2026-07-24T01:38:37Z`
- Exit SHA: derive from the commit containing this packet
- Result: `PASS_LOCAL_ONLY; REMEDIATION_G1_PASS_TO_AUDIT`

## Result and boundary

The lockfile install, Prisma schema validation and generation, lint, TypeScript, unit tests, disposable-database integration tests, and production build pass on one working tree rooted at the start SHA above. The build uses the CI's deliberately non-live public Dynamic UUID because the client provider requires a syntactically non-empty identifier during prerender. Database-only schema commands use loopback URL placeholders and do not connect. Migration integration creates and removes its own loopback PostgreSQL cluster.

This is local engineering evidence only. It is not release, production, live sponsor, shared-database, or Lisbon-window proof. The effectful `npm run validate` command was never executed.

## Implementation surface

| Area | Implemented evidence |
|---|---|
| Commands | Real `typecheck`, `test`, `test:integration`, `test:e2e`, `test:resilience`, `test:redaction`, `clean:generated`, `scan:secrets`, and `validate:env` scripts. |
| Dead targets | Restored `migrate` as `prisma migrate deploy`; removed unimplemented `setup:gateway` and `validate:x402` targets after caller checks; removed the stale README caller. |
| Environment | Typed validation for URLs, booleans, integers, database pairs, loopback detection, and redacted failures. Runtime database access validates only `DATABASE_URL`. Prisma pool options preserve caller pooler classification; Postgres.js removes Prisma-only query parameters. |
| Migrations | Committed PostgreSQL baseline plus migration lock, empty-database deploy, and synthetic Cannes-shaped upgrade replay with schema, migration-history, sentinel-data, and sequence-state checks. |
| CI | Node 22, lockfile install, PostgreSQL 14 service, Prisma validation/generation, environment, lint, typecheck, all A1 test categories, secret scan, and build with background workers disabled. |
| Lint/build repairs | Removed all 23 inherited lint errors without weakening the global rules. Two database-backed GET handlers are explicitly request-time so an offline build does not query a database. React fixes preserve behavior while removing render/effect state violations and non-deterministic render-time timestamps. |

Two C0 scope amendments were made only after the cold build proved each route failure:

1. `app/api/swarm/metrics/route.ts` changed from cached prerendering to `dynamic = "force-dynamic"`.
2. `app/api/marketplace/earnings/route.ts` received the same request-time correction.

Both paths are mirrored in the active lease. No other scope expansion occurred.

## Migration provenance and replay

No committed migration history or live Cannes database dump existed at the start SHA. The new baseline is generated from the committed Prisma schema, then extended with an explicit application-owned `hot_wallet_index_seq` definition required by `src/store/user-store.ts`. Its canonical A1 definition is `BIGINT`, start/minimum/increment/cache `1`, maximum `9223372036854775807`, `NO CYCLE`, and `OWNED BY NONE`. The migration SQL SHA-256 is `2139a8fb87e3e64ea454519204fbc551427b4342aaa61c8c88898e02c184b477`; it contains 12 tables and 25 indexes.

The upgrade lane is deliberately **synthetic Cannes-shaped**, not a restored live Cannes dump and not proof of unknown historical DDL equivalence. It creates the current schema with `prisma db push`, creates the explicit canonical sequence, sets its last value to `42`, and inserts one deterministic sentinel row with explicit identity, JSON values, token/hot-wallet fields, and timestamps. Before baseline resolution, the harness canonicalizes every sentinel column, hashes it with Node SHA-256, then resolves and deploys the baseline. It verifies:

- exactly one sentinel with ID `a1-cannes-sentinel` and wallet `0xa1cannessentinel` exists;
- its pre/post canonical row hashes are exactly equal to `fb8aece1677586a330f0cfeb0850b71488849302324eb1d6a079673e35e3829e`;
- exactly one finished baseline migration is recorded;
- table and sequence identities exist;
- every sequence property matches the canonical definition; and
- the next sequence value is `43`.

The empty lane deploys the same migration into a fresh database and verifies the same relation/migration/sequence fingerprint with next value `1`. Both lanes run only against an auto-created loopback PostgreSQL 14 cluster and remove it on exit.

## Cold gate

Toolchain: Node `v22.22.3`, npm `10.9.8`, Prisma and Prisma Client `6.19.3`, TypeScript `5.9.3`, PostgreSQL client/server `14.23`. The committed lock SHA-256 remains `b4a1aed30a52a74d1b4396da9f1d6535a5e475da1b40a99a6c744aae1a8c6b33`.

| Command/check | Exit | Observed |
|---|---:|---|
| `npm run clean:generated` | 0 | Known outputs removed; the later build regenerated `.next`. |
| `npm ci --legacy-peer-deps` | 0 | 2,129 packages installed from the unchanged lock; Prisma postinstall generation passed. npm reported 103 inherited audit findings: 19 low, 41 moderate, 42 high, and 1 critical. No dependency upgrade was attempted in this surgical sprint. |
| `npx prisma validate` | 0 | Schema valid with non-connecting loopback `DATABASE_URL` and `DIRECT_URL` placeholders. A prior empty-env invocation failed closed on missing `DIRECT_URL`, as designed. |
| `npx prisma generate` | 0 | Prisma Client `6.19.3` generated. |
| `npm run lint` | 0 | 0 errors and 23 inherited warnings. Pre-change result was 23 errors and 28 warnings. |
| `npm run typecheck` | 0 | `tsc --noEmit --incremental false` passed. |
| `npm test` | 0 | 5/5 foundation tests passed. |
| `npm run test:integration` | 0 | 3/3 database URL tests, invalid/anchored pipeline timestamp assertions, and empty plus synthetic Cannes-shaped migration lanes passed. The sentinel identity and exact pre/post SHA-256 matched. |
| `npm run build` | 0 | Next.js `16.2.2` compiled, typechecked, generated 26/26 static pages, and classified both database aggregate routes as request-time. The job-level public UUID is `00000000-0000-4000-8000-000000000000`; it is deliberately non-live and is not sponsor evidence. |
| `npm run test:e2e` | 0 | 2/2 offline environment CLI tests passed. |
| `npm run test:resilience` | 0 | 1/1 bounded generated-output cleanup test passed. |
| `npm run test:redaction` | 0 | 2/2 secret/error redaction tests passed. |
| `npm run validate:env` | 0 | Offline mode accepted absent database and sponsor secrets with background workers disabled. |

The two initially cached database routes failed at prerender in sequence and were repaired only after each exact failure was observed and C0 extended the path allowlist. A separate initial migration-harness run stalled because the background PostgreSQL server retained `spawnSync`'s captured stream; assigning `pg_ctl` a disposable logfile fixed the harness without changing migration semantics.

## Independent audit and remediation G1

- Audit target: `c2359f766e61ea0d5b8735992de971101ee962bd`
- Audit verdict: `FIX`
- Remediation task: `A1-DETERMINISTIC-FOUNDATION-REMEDIATION-G1-20260724`
- Remediation start/control SHA: `c2359f766e61ea0d5b8735992de971101ee962bd`
- Remediation exit SHA: derive from the commit containing this section
- Remediation result: `PASS_TO_AUDIT`

| Audit finding | Root-cause closure |
|---|---|
| README bypassed migrations with `prisma:push`. | `npm run migrate` is the canonical authorized-database setup command. `prisma:push` is labeled noncanonical and disposable-development-only because it omits custom migration SQL such as `hot_wallet_index_seq`. |
| Upgrade replay checked only user count while evidence claimed sentinel preservation. | The fixture now uses deterministic values for every sentinel column and normalizes timestamps to UTC. Node SHA-256 snapshots before resolution and after deploy must match exactly, in addition to the expected ID/wallet assertion. This remains synthetic Cannes-shaped evidence only. |
| Historical live-testnet bounty rows read as current claims. | The README section, table headers/statuses, and `$27K` estimate are explicitly inherited Cannes prior-work statements; they point to the current fail-closed Lisbon claim matrix and disclaim eligibility, sponsor proof, release evidence, expected winnings, and production status. |
| Invalid cycle timestamp plus no action anchor produced epoch-zero display times. | A pure resolver returns null for every node in that malformed no-anchor case, which renders `—`. Existing cycle/action-anchor interpolation remains deterministic and is covered by no-anchor, action-anchor, and cycle-anchor assertions in the integration harness. |

### Remediation G1 verification

| Command/check | Exit | Observed |
|---|---:|---|
| `npm run clean:generated` | 0 | Known generated outputs removed before the cold gate. |
| `npm ci --legacy-peer-deps` | 0 | Lockfile install and Prisma postinstall generation passed; the same 103 inherited audit findings remain outside this narrow repair. |
| `npx prisma validate` | 0 | Schema valid with non-connecting loopback placeholders. |
| `npx prisma generate` | 0 | Prisma Client `6.19.3` generated. |
| `npm run lint` | 0 | 0 errors and 23 inherited warnings. |
| `npm run typecheck` | 0 | TypeScript passed. |
| `npm test` | 0 | 5/5 foundation tests passed. |
| `npm run test:integration` | 0 | 3/3 URL tests, three pipeline timestamp assertions, empty deploy, and exact sentinel identity/hash replay passed. |
| `npm run build` | 0 | Next.js compiled/typechecked and generated 26/26 static pages with the non-live CI UUID. |
| `npm run test:e2e` | 0 | 2/2 passed. |
| `npm run test:resilience` | 0 | 1/1 passed. |
| `npm run test:redaction` | 0 | 2/2 passed. |
| `npm run validate:env` | 0 | Offline mode passed with workers disabled. |
| `npm run scan:secrets` | 0 | No high-confidence pattern in tracked files. |

## Remaining blocks

- The synthetic upgrade lane does not establish compatibility with an unavailable live Cannes dump. Any shared or managed database inspection/migration remains `LIVE_EFFECT_BLOCKED`.
- The CI-only Dynamic UUID proves deterministic prerendering, not Dynamic authentication or sponsor connectivity.
- npm's inherited 103 audit findings remain unremediated and prevent treating this sprint as production-readiness evidence.
- Rights, license, team/owner roster, event-window classification, sponsor credentials/caps, push, deployment, submission, live identifiers, and public claims remain at their existing release, claim, or live-effect gates.

External effects attempted: none. Managed/shared database effects: none. Sponsor calls: none. Signatures, transactions, forms, deployment, push, spend, mainnet value, and claim promotion: none.
