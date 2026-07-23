# A0 Continuity Timing Clarification

Observed: `2026-07-23T23:20:52Z` through `2026-07-23T23:25:13Z`

Start SHA: `3cd11943faddcf5f6d7ed7455fec783dcfd6325f`

Status: `PASS_LOCAL_CONTINUITY_START; BLOCKED_A0_CLEARANCE_AND_STATIC_COMPATIBILITY`

## Decision

The project owner clarified that the official-start restriction applies to the From Scratch project and that AlphaDawg Continuity may start locally before H0. Current ETHGlobal rules support the narrow timing distinction:

- Classic From Scratch work must begin after official kickoff.
- Continuity may build on an existing codebase under the selected track rules.
- Continuity must disclose pre-existing work and must deliver substantive new features, improvements, or functionality developed during the event.

H0 is therefore cleared only as a local Continuity-build blocker. Any pre-H0 commit remains disclosed prior work and cannot be promoted as Lisbon-window evidence.

## Current official-source packet

| Source | SHA-256 | Current fact |
|---|---|---|
| `https://ethglobal.com/events/lisbon2026/info/details` | `27a9f02af461363da3d8036c1cefbc9dc57735e4f77ef074922403b2ac7f092e` | From Scratch must start after kickoff; Continuity may use existing code but needs event-window additions. H0 remains `2026-07-24T20:00:00Z`. |
| `https://ethglobal.com/rules` | `bb672f56ae5d688f90b5fbada03e893e6376db094066ff1a0e8e5bcfdacdbe17` | Prior work disclosure, open-source new work, event-window substantive additions, and version-control history are mandatory. |
| `https://ethglobal.com/events/lisbon2026/prizes/0g` | `3b4df5bcbb861c043da7fcded574fa10204695958108b6f4e0bf2b844863f36f` | 0G Keep Building remains Continuity-only and requires a dated Lisbon-window changelog. |
| `https://ethglobal.com/events/lisbon2026/prizes/ens` | `6ff98700391d64ba0ad6bac4f891aeb67db203253ee6cd0af8c88f139b76684c` | Best ENS Continuity Integration remains Continuity-only. |
| `https://ethglobal.com/events/lisbon2026/prizes/uniswap-foundation` | `665741e68cb2503d2cf907ecb9b35d20d5d98d1ad86c564245aa484b6999dd8a` | Best Uniswap Stack Contribution remains Continuity-only. |

The response hashes identify the exact inspected dynamic payloads; re-fetch before A7.

## Repository census

- Branch: `developer`.
- Start SHA: `3cd11943faddcf5f6d7ed7455fec783dcfd6325f`.
- Cannes baseline ancestry: pass for `bfa7bd37c573e2e49525d965f7f937210e170d72`.
- Both registered worktrees were clean.
- `origin/main` remains the Cannes baseline; no remote `developer` branch exists.
- GitHub reports the repository as public. No root `LICENSE*`, `COPYING*`, or `NOTICE*` file exists.
- Baseline history contains two named contributors. Written reuse/public-submission/license/prize consent is not recorded.
- No root local `.env*` file other than the tracked example was present in either worktree; access readiness remains unproven.

## Remaining fatal A0 gates

1. Written contributor reuse, modification, public-submission, attribution, license, and prize-treatment consent; then a root OSI license.
2. Accepted/staked Lisbon team evidence, changed-team Continuity treatment, and a named owner/backup/ENS booth-presenter roster.
3. Secret-safe 0G, ENS, database, and hosting access readiness plus exact caps and approvers.
4. A proof-capable official 0G Storage readback path and fatal Compute response binding; the recorded P0 static failure remains open.
5. Exact authorization for each external effect when needed.
6. A new independent pinned-SHA A0 audit after reconciliation.

No A1 writer is admitted by this clarification. No product file, dependency, push, deployment, signature, transaction, form, provisioned resource, spend, or claim promotion occurred.
