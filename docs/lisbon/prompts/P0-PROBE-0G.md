# P0 - asynchronous 0G probe

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
- Return only the canonical C0 envelope; this task cannot open its own gate.Probe current official 0G Compute/Private Computer and Storage compatibility for AlphaDawg without modifying the product checkout.

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
