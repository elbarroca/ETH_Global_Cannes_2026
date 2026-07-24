# A0 Local Build Admission Evidence

- Task: `A0-LOCAL-ADMISSION-20260724T0045WEST`
- Sprint: `A0`
- Start/control SHA: `2dd242d4ae217fd6cd370e598d3ffca3250ab1f7`
- Baseline: `bfa7bd37c573e2e49525d965f7f937210e170d72`
- Branch: `developer`
- Observed at: `2026-07-23T23:48:00Z`
- Scope: documentation/control correction only

## Admission result

| State | Verdict | Boundary |
|---|---|---|
| `LOCAL_BUILD_AUTHORIZED` | `PASS` | Safe local A1 and, after their sequential prerequisites pass, A2 and offline A3 implementation, tests, loopback processes, disposable local databases, and atomic commits on `developer`. |
| `RELEASE_BLOCKED` | `BLOCKED` | Rights/license, team/owner roster, access/caps, event-window classification, same-SHA release proof, push/deployment/submission, and sponsor/public claims. |
| `LIVE_EFFECT_BLOCKED` | `BLOCKED` | Sponsor/API calls, shared or managed database effects, provisioning/migration, signatures, transactions, forms, spend, and mainnet value. |

`A0_LOCAL` is `PASS`. Only Git provenance, local owner authority, and writer serialization participate in this gate. Release, claim, and sponsor-live evidence cannot close it.

## Exact start evidence

| Command/check | Exit | Observed |
|---|---:|---|
| `git rev-parse --show-toplevel` | 0 | `/Users/barroca888/Downloads/Dev/Personal/ETH_Global_Cannes_2026-lisbon` |
| `git branch --show-current` | 0 | `developer` |
| `git rev-parse HEAD` | 0 | `2dd242d4ae217fd6cd370e598d3ffca3250ab1f7` |
| `git status --porcelain=v2 --branch` | 0 | Branch OID/head only; no changed-path record before lease mirroring. |
| `git merge-base --is-ancestor bfa7bd37c573e2e49525d965f7f937210e170d72 HEAD` | 0 | Baseline is an ancestor. |
| `git worktree list --porcelain` | 0 | Cannes worktree at baseline on `feat/lisbon-agent-commerce`; Lisbon worktree at start SHA on `developer`. |
| Baseline-worktree `git status --porcelain=v2 --branch` | 0 | Branch OID/head only; no changed-path record. |
| `git show-ref --verify --hash refs/remotes/origin/main` | 0 | `bfa7bd37c573e2e49525d965f7f937210e170d72` |
| `git show-ref --verify --quiet refs/remotes/origin/developer` | 1 | Remote-tracking branch absent. |
| `git rev-list --left-right --count origin/main...HEAD` | 0 | `0 17` (local HEAD is 17 commits ahead). |
| Atomic noclobber creation of `<git-common-dir>/alphadawg-lisbon-writer.lock` | 0 | Unique token `EC59B765-2E1D-4FEF-B0DD-463DD4F9E48F` acquired and mirrored before other edits. |
| Physical-token/mirrored-token equality | 0 | Exact match. |

## Authority and disclosure

The project-owner instructions authorize AlphaDawg Continuity local implementation and atomic commits on `developer`, including disposable local files, tests, processes, and databases that cannot affect shared/external systems. They authorize no push, deployment, managed database effect, sponsor call, signature, transaction, form, spend, public claim, or mainnet value.

All work before H0 remains disclosed prior/pre-window work. This control correction does not classify any prior commit as Lisbon-window evidence and does not promote a sponsor, release, production, or prize claim.

## Closing verification

| Check | Exit | Observed |
|---|---:|---|
| Exact branch/start SHA, baseline ancestry, `origin/main`, absent `origin/developer`, and `0 17` divergence assertions | 0 | `PASS` |
| Physical/mirrored token equality and exactly one active record | 0 | `PASS` |
| Exact ten-path allowlist assertion | 0 | `PASS` |
| `git diff --check` | 0 | No output. |
| Markdown fence and local-link check over all ten changed documents | 0 | 10 files, 3 local links, no missing target. |
| Required state vocabulary in `BASELINE.md`, `GOALS.md`, `CLAIM-MATRIX.md`, and `EVIDENCE.md` | 0 | All three exact independent states present. |
| First-pass stale A1-block vocabulary assertion | 1 (`FAIL`) | Scope was too narrow and missed the contradictory active C0 prompt at line 48; independent audit required remediation. |
| Changed-line high-confidence secret-pattern scan | 0 | No match. |

Changed paths are exactly the ten paths authorized by the dispatch. The exit SHA is the commit containing this packet and is returned to C0 because a commit cannot embed its own SHA. Application lint, typecheck, tests, build, migrations, and sponsor smokes are outside this docs-only A0 correction and remain for their assigned sprints.

External effects attempted: none.

## Independent audit and remediation G1

- Audit target: `36783c69f249387943f6f4b89286e2b27660337e`
- Audit verdict: `FIX`
- Finding: `docs/lisbon/prompts/C0-COORDINATOR.md:48` still made rights, eligibility, access, and static compatibility A1 blockers, contradicting `A0_LOCAL`.
- Repair: replace only that gate with the exact local-build/release/live-effect split and make this packet's first-pass result truthful.
- Remediation start/control SHA: `36783c69f249387943f6f4b89286e2b27660337e`
- Remediation exit SHA: derive from the commit containing this section and return it to C0.

| Remediation check | Exit | Observed |
|---|---:|---|
| Contradictory A1-block scan across active non-archive Lisbon controls/prompts | 0 | No stale contradiction. |
| Markdown fence/local-link check for all five changed documents | 0 | No malformed structure or missing local target. |
| Exact five-path allowlist assertion | 0 | `PASS` |
| `git diff --check` | 0 | No output. |
| Changed-line high-confidence secret-pattern scan | 0 | No match. |

Claim promotion: none. External effects attempted: none.
