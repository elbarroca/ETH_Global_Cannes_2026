# Lisbon Claim Matrix

| Claim | State | Required promotion evidence |
|---|---|---|
| Clean Cannes baseline | `CONFIRMED` | Commit/tree/lock hashes and clean event worktree. |
| Local Continuity implementation authority | `CONFIRMED_LOCAL_ONLY` | Project-owner thread authorization. |
| A0 release authority | `BLOCKED_PRE_H0_AND_CLEARANCE` | Live H0, rights/license/team/owners, exact evidence, and independent `PASS_TO_NEXT_GATE`. |
| Open-source/license authority | `PENDING` | Contributor authorization and root license. |
| 0G Keep qualification | `research_only_not_promotable; P0_FAIL_STATIC_LIVE_BLOCKED` | Proof-capable Storage path, A3 `PASS_LIVE`, then A7 `PASS_RELEASE`. |
| ENS Continuity qualification | `research_only_not_promotable; E0_PASS_STABLE_STATIC_LIVE_BLOCKED` | A4 live identifiers, refusal proof, booth/demo artifacts, A7. |
| Uniswap Stack qualification | `U0_ADMITTED_CONDITIONAL_NOT_OPEN` | Green frozen 0G+ENS core, upstream reusable contribution, live proof if applicable, FEEDBACK.md/form, A7. |
| Uniswap API qualification | `REJECTED_WITHOUT_WRITTEN_ADMISSION` | Written admission plus live API/onchain lifecycle and A7. |
| Sui qualification | `NOT_ADMITTED` | Explicit A5 admission and live causal evidence. |
| Production ready | `REJECTED_CURRENTLY` | Every required A1-A7 gate on one SHA. |
| Expected winnings | `UNPROVEN`; floor `$0` | Sponsor decision. |

Inherited Cannes IDs, local fixtures, mocks, installed SDKs, and documentation cannot promote a claim.
