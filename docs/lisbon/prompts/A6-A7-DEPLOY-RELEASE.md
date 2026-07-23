# A6/A7 - autonomous deployment, demo, and release writer

Copy the block into a dedicated Codex project/thread.

```text
/goal

PROJECT PACKET
- project_id: alphadawg
- repo_root: resolve with `git rev-parse --show-toplevel`
- baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
- branch: developer
- read_first: AGENTS.md, docs/lisbon/README.md, docs/lisbon/BASELINE.md, docs/lisbon/context/README.md, docs/lisbon/context/RUNBOOK.md, docs/lisbon/context/MASTER.md, docs/lisbon/GOALS.md
- writer_lock_mirror: docs/lisbon/ACTIVE-WRITER.md
- atomic_lease: <git-common-dir>/alphadawg-lisbon-writer.lock
- external_effects: denied unless the exact row in docs/lisbon/EXTERNAL-EFFECTS.md is AUTHORIZED
- evidence: docs/lisbon/EVIDENCE.md and docs/lisbon/evidence/
- no live identifier, no live claim
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
