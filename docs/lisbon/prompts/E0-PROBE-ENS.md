# E0 - asynchronous ENS probe

C0-owned task template. Do not launch it manually.

```text
/goal

PROJECT PACKET
- project_id: alphadawg
- repo_root: resolve with `git rev-parse --show-toplevel`
- baseline_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
- branch: developer
- dispatcher: Goal C0 only
- dispatch_capability: required; C0 supplies task_instance_id, generation, dispatch/target/control SHA, goal source, dependencies, deadline, acceptance items, and retry budget
- writer_admission: sole writers additionally require admitted_at_sha, prerequisite digest, allowed paths, and unconsumed single-use admission
- read_first: AGENTS.md, docs/lisbon/README.md, docs/lisbon/BASELINE.md, docs/lisbon/ALPHADAWG-FILE-MAP.md, docs/lisbon/context/README.md, docs/lisbon/context/RUNBOOK.md, docs/lisbon/context/MASTER.md, docs/lisbon/GOALS.md
- writer_lock_mirror: docs/lisbon/ACTIVE-WRITER.md
- atomic_lease: <git-common-dir>/alphadawg-lisbon-writer.lock
- external_effects: denied unless exact current project-owner authorization passes
- evidence: docs/lisbon/EVIDENCE.md and docs/lisbon/evidence/
- canonical_return_envelope: required by C0
- no live identifier, no live claim

DISPATCH GUARD
- Do not self-start. Require a current Goal C0 packet for this exact read-only goal.
- Verify `mode: read_only`, unique `task_instance_id`, generation, pinned target/control SHA, `goal_source`, acceptance items, expiry, deadline, and explicit no-mutation boundary.
- Missing, stale, mismatched, duplicate, or non-C0 dispatch returns `BLOCKED_NOT_DISPATCHED` before install, product edit, live call, or external action.
- Return only the canonical C0 envelope; this task cannot open its own gate.

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
