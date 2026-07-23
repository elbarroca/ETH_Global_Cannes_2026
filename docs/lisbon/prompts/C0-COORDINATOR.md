# C0 - master autonomous coordinator

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
