# Reusable Sprint Audit

C0-owned, read-only template. It audits one committed sprint SHA and never repairs it.

```text
/goal

Independently audit one AlphaDawg Lisbon sprint.

REQUIRED DISPATCH
- `agent_type: bounty-auditor` from `.codex/agents/bounty-auditor.toml`
- task_id, task_instance_id, generation, sprint, mode, immutable audit SHA, control SHA, deadline
- exact sprint card and acceptance items
- exact allowed read paths, writer return, known blockers, and evidence paths
- explicit read-only effects boundary, verification commands, and return schema

C0 must spawn the registered Codex `bounty-auditor` itself in read-only mode. Never dispatch `.claude/**`, paste this prompt into a peer task, or reuse the writer as auditor. Missing, stale, mismatched, moving, or duplicate scope returns BLOCKED_NOT_DISPATCHED.

AUDIT
1. Confirm the loaded agent is `bounty-auditor` and remains read-only. Use a disposable checkout at the exact audit SHA. Read AGENTS.md, docs/lisbon/GOALS.md, docs/lisbon/SPRINTS.md, current controls, the sprint card, changed code, callers, tests, logs, and evidence. Never modify the product checkout or repair findings.
2. Verify start/exit ancestry, changed paths, atomic scope, clean state, writer lease release, and no unauthorized external effect.
3. Map every acceptance item to source, an independently observed command/result, and exact evidence. Rerun deterministic checks in the disposable checkout when safe.
4. Test or inspect applicable boundary, auth, state-machine, database, idempotency, concurrency, tamper, replay, outage, restart, functional, UI, accessibility, redaction, migration, build/start, and fresh-clone behavior.
5. For track claims, require current primary-source eligibility, load-bearing sponsor causality, authorized live identifiers, raw redacted evidence, and removal/refusal proof. HTTP `200`, mock, request ID, cached flag, screenshot, or UI badge is insufficient.
6. For A5, require automated critical-path and refusal UI tests plus desktop/mobile/accessibility evidence. For A7, require one frozen SHA across code, deployment, receipts, evidence, video, and final Bounty Auditor result.

RETURN
agent_type:
task_id:
task_instance_id:
generation:
sprint:
mode:
audit_sha:
control_sha:
findings: ranked CRITICAL | HIGH | MEDIUM | LOW with file:line, failure path, affected gate, and smallest root-cause repair
acceptance_matrix: PROVEN | CONTRADICTED | INCOMPLETE | MISSING
commands_and_exit_codes:
evidence_or_claim_drift:
blockers:
verdict: PASS_TO_NEXT_GATE | FIX | CUT | BLOCKED
next_action:

Never return generic PASS and never implement the fix. The verdict is stale if the audited code, control, or evidence SHA changes.
```
