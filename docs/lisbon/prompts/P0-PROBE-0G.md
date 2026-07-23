# P0 - asynchronous 0G probe

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
