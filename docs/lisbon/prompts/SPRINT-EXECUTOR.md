# Reusable Sprint Executor

C0-owned template. It is invalid without a current dispatch packet and one exact sprint card from `docs/lisbon/SPRINTS.md`.

```text
/goal

Execute one AlphaDawg Lisbon sprint as the sole writer.

REQUIRED DISPATCH
- exact `agent_type` from `.codex/agents/*.toml`
- task_id, task_instance_id, generation, sprint, mode, start SHA, control SHA, deadline
- exact sprint card and acceptance items
- exact allowed paths
- known blockers and current prerequisite evidence
- explicitly allowed external effects
- exact verification commands, evidence files, and return schema

The active C0 must spawn the matching Codex project agent itself. `.claude/**` is provenance, the converted source-command skills are workflows rather than agents, and a generic worker cannot replace a registered domain owner. If any field is missing, stale, mismatched, duplicated, or not issued by the active C0, return BLOCKED_NOT_DISPATCHED before editing or running an external action.

WORK
1. Confirm your `agent_type`, exclusive mutation domain, and dispatch paths match `AGENTS.md`. You are not alone in the codebase: preserve unrelated edits and never revert another owner's work. Then read docs/lisbon/GOALS.md, docs/lisbon/SPRINTS.md, current controls, the supplied sprint card, and every source/caller on the affected path. For Next.js changes, read the relevant installed `node_modules/next/dist/docs/` guide first. For unknown APIs, verify the installed version and current official docs.
2. State a short plan and acceptance checklist. Reuse existing code/platform features. Implement the minimum root-cause change; no speculative abstraction, adjacent refactor, or placeholder script.
3. Require clean expected Git state. Atomically acquire the common-dir writer lease and mirror its token in docs/lisbon/ACTIVE-WRITER.md. Touch only allowed paths.
4. Validate malformed boundary inputs, external responses, authorization, secrets/PII redaction, idempotency, ambiguity, and failure states required by the sprint.
5. Run every sprint check. Stop at the first red layer, fix the root cause in scope, and rerun from that layer. Never convert a required check into a skip.
6. Update exact evidence, affected docs/lisbon/CLAIM-MATRIX.md and docs/lisbon/TRACK-MATRIX.md rows, and CHANGELOG-LISBON.md. No live claim without authorized live identifiers and causal evidence.
7. Review the diff, run `git diff --check` and secret-pattern checks, make one conventional atomic commit, verify clean status, then release only your lease token.

BOUNDARY
- Never reset, stash, clean, rebase, force-push, overwrite, steal a lock, expose secrets, or treat inherited/mock/UI evidence as live proof.
- Never push, deploy, provision, migrate, call a paid/live sponsor service, sign, transact, submit a form, spend, or publish a claim unless the dispatch cites the exact current AUTHORIZED row.
- Do not open the next gate. Return evidence to C0 for independent audit.

RETURN
agent_type:
task_id:
task_instance_id:
generation:
sprint:
mode:
start_sha:
control_sha:
exit_sha:
changed_paths:
commands_and_exit_codes:
acceptance_items:
evidence_paths_and_public_ids:
lease_released:
external_effects_attempted:
claim_changes:
blockers:
verdict: PASS_TO_AUDIT | FIX | CUT | BLOCKED
next_action:
```
