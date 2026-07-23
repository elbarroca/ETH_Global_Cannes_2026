# C0 - Autonomous AlphaDawg Lisbon Coordinator

Paste this `/goal` once. Do not launch the executor or auditor manually.

```text
/goal

Own the AlphaDawg Lisbon program from current state to RELEASE_VALIDATED. Work autonomously through the repo-defined sprints, but fail closed on eligibility, evidence, security, and external authority.

READ FIRST
1. AGENTS.md
2. docs/lisbon/BASELINE.md
3. docs/lisbon/EXTERNAL-EFFECTS.md
4. docs/lisbon/GOALS.md
5. docs/lisbon/SPRINTS.md
6. docs/lisbon/TRACK-MATRIX.md
7. docs/lisbon/CLAIM-MATRIX.md
8. docs/lisbon/EVIDENCE.md
9. only the context files needed by the selected sprint

BOOT
- Resolve the repository with `git rev-parse --show-toplevel`; require branch `developer` and verify baseline `bfa7bd37c573e2e49525d965f7f937210e170d72` ancestry.
- Inspect HEAD, status, all worktrees, remotes, runtime/lockfile, common-dir writer lease, ACTIVE-WRITER mirror, current controls, and existing evidence.
- Stop mutation on unexpected changes, an unknown/expired writer, branch mismatch, or ambiguous external effect. Preserve evidence; never reset, stash, clean, rebase, overwrite, or steal a lock.
- Treat recorded states as evidence to reconcile, not truth to repeat. Recheck time-sensitive official rules from primary sources before A0 and A7.
- Select the earliest sprint in docs/lisbon/SPRINTS.md that is neither independently passed nor evidence-backed CUT.

EXECUTION
- Maintain one concise task row per active sprint: sprint, role, mode, start/target SHA, scope, state, deadline, evidence, blocker, next action.
- Use the matching specialist already registered in AGENTS.md. Delegate only concrete non-duplicate work. Maximum: one mutating writer plus two useful read-only tasks.
- Every delegated task gets: sprint card, unique task ID, mode, start/target SHA, exact allowed paths, acceptance items, deadline, known blockers, allowed external effects, and required return schema.
- Use docs/lisbon/prompts/SPRINT-EXECUTOR.md for every writer. Writers run sequentially.
- After the writer self-verifies and commits, use docs/lisbon/prompts/SPRINT-AUDIT.md against that immutable exit SHA in a disposable checkout. Auditors never repair.
- Recompute the verdict yourself. Agent `PASS` text opens no gate.
- On findings, send one narrowed root-cause repair to the same sprint if time remains, then reverify and reaudit. Cut optional scope before weakening a protected guarantee.
- Update EVIDENCE.md, affected track/claim controls, CHANGELOG-LISBON.md, and ACTIVE-WRITER.md only with exact observed facts.
- Continue to the next sprint without asking for routine choices. Ask only for an owner-controlled blocker: rights, eligibility clarification, secret/access provisioning, spend, signature, transaction, push, deploy, form, or material scope change.

WRITER SAFETY
- Before editing, atomically acquire `$(git rev-parse --git-common-dir)/alphadawg-lisbon-writer.lock` and mirror the same unique token in docs/lisbon/ACTIVE-WRITER.md.
- Admit exactly one writer for one sprint, one start SHA, and exact paths. Lock failure or token mismatch is BLOCKED_WRITER_LOCK; never self-clear another writer.
- A writer exits only after proportional checks, evidence, one atomic commit, clean status, and release of its own token.
- Push, deployment, provisioning, migration, live sponsor calls, signatures, transactions, form submission, spend, and public claims require an exact current AUTHORIZED row in docs/lisbon/EXTERNAL-EFFECTS.md. Credentials alone are not authority.

GATES
- Follow the Definition of Done and evidence ladder in docs/lisbon/GOALS.md.
- Required missing scripts, skipped required checks, mocks presented as live behavior, stale rules, moving SHAs, or incomplete evidence are blockers.
- H0 does not block local Continuity work, but pre-H0 commits are disclosed prior work and never Lisbon-window evidence. A0 blocks product writers until rights, eligibility, required access, and static compatibility pass.
- A3 cannot code around failed 0G verification or proof readback.
- A6 is optional and is CUT unless every entry gate passes with six hours reserved.
- A7 runs the complete fresh-clone, functionality, UI, security, deployment, documentation, eligibility, demo, and bounty audit on one frozen SHA.

RECOVERY
- One retry maximum for transient read-only/tool failure. Deterministic failures require root-cause repair, not blind rerun.
- On writer crash, preserve its checkout, lock, diff, logs, and possible external-effect state for owner adjudication.
- On coordinator restart, reconstruct state from Git, lease/mirror, controls, evidence, task returns, and observable agents before dispatch.
- BLOCKED is non-terminal while safe work remains. Record exact missing evidence, owner action, affected gate, and wake condition.
- STOP only on explicit owner cancellation, deadline expiry, or unrecoverable repository integrity.

TERMINAL
Declare RELEASE_VALIDATED only when the full release contract in docs/lisbon/GOALS.md passes on one unchanged SHA and every required sprint is PASS_TO_NEXT_GATE, while optional A6 is PASS or evidence-backed CUT. Otherwise report the exact non-terminal state without promoting claims.

After every gate, output:
checkpoint:
head_sha:
decision: BUILD | NARROW | WAIT_GATE | CUT | BLOCKED | RELEASE_VALIDATED
completed:
active:
blockers:
evidence:
next_action_or_wake_condition:
```
