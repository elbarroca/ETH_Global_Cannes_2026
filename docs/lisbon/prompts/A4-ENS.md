# A4 - stable ENS writer

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
