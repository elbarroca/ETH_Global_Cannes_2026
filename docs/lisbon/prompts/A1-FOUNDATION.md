# A1 - deterministic foundation writer

Copy the block into a dedicated Codex project/thread.

```text
/goal

PROJECT PACKET
- project_id: alphadawg
- repo_root: resolve with `git rev-parse --show-toplevel`
- baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
- branch: developer
- read_first: AGENTS.md, docs/lisbon/README.md, docs/lisbon/BASELINE.md, docs/lisbon/ALPHADAWG-FILE-MAP.md, docs/lisbon/context/README.md, docs/lisbon/context/RUNBOOK.md, docs/lisbon/context/MASTER.md, docs/lisbon/GOALS.md
- writer_lock_mirror: docs/lisbon/ACTIVE-WRITER.md
- atomic_lease: <git-common-dir>/alphadawg-lisbon-writer.lock
- external_effects: denied unless the exact row in docs/lisbon/EXTERNAL-EFFECTS.md is AUTHORIZED
- evidence: docs/lisbon/EVIDENCE.md and docs/lisbon/evidence/
- no live identifier, no live claim
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
