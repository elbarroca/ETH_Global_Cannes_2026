# ETHGlobal Lisbon 2026 Agent Operating Contract

## Scope

This workspace is a research and execution-planning vault. Product repositories are separate. Preserve Markdown/CSV-only vault outputs unless the task explicitly targets `.codex` configuration.

The current Lisbon prize snapshot supplied by the user controls over older vault notes. Recheck official rules at H0 and before submission. Never convert an announced pool, pending track, inherited feature, mock, or local-only receipt into a qualification or winnings claim.

## Source order

1. Current official ETHGlobal event, prize, rule, sponsor-doc, and repository sources.
2. The user-supplied Lisbon prize snapshot.
3. Current canonical master documents.
4. Dated supporting vault notes.
5. Entrant-authored showcase claims, labeled `UNVERIFIED` unless repository/runtime evidence confirms them.

Use `CONFIRMED`, `CONDITIONAL`, `PENDING`, `BLOCKED`, and `REJECTED` explicitly. Preserve `research_only_not_promotable` until every eligibility and live-evidence gate passes.

## Delegation router

| Need | Custom agent | Expected output |
|---|---|---|
| Cross-workstream plan and cut decisions | `hackathon-orchestrator` | Critical path, ownership, gates, cuts, final decision |
| Live prize/rule/eligibility analysis | `track-strategist` | Track ledger with exact requirements and confidence |
| Chain and protocol architecture | `blockchain-architect` | Minimal architecture, invariants, interfaces, proof map |
| Small event-window implementation | `lean-implementation-engineer` | Surgical code, tests, commands, evidence |
| Contracts/economic/security review | `smart-contract-security-auditor` | Ranked findings and blocking invariants |
| Judge-facing UX and demo | `hackathon-ux-demo-director` | State model, screen flow, demo script, accessibility gates |
| Submission and evidence audit | `validation-submission-auditor` | Requirement-to-evidence matrix and go/no-go result |
| Prior-winner-driven ideation | `winner-pattern-ideator` | Distinct ideas, comparable analysis, scored shortlist |
| Post-green-path performance/reliability | `reliability-optimizer` | Measurements, bottlenecks, bounded patches, regression proof |

Delegate only bounded, independent work. Prefer read-only parallel audits; assign one writer per file. The root agent owns reconciliation and the final claim matrix. Wait for required audits before declaring a gate green.

Every delegated task must include:

```text
project_id: alphadawg | project_b
repo_path:
worktree:
baseline_sha:
track:
allowed_paths:
acceptance_evidence:
deadline_or_hour_gate:
known_blockers:
```

Reject a task packet that can mix AlphaDawg and Project B context. Security and submission auditors inspect but do not repair; the orchestrator selects, the architect specifies, and a writer implements.

## Shared engineering rules

- Start with the user loss, one replayable loop, one sponsor-native state change, and one inspectable proof artifact.
- Sponsor primitives must be load-bearing. Remove any track whose primitive can be removed without changing the product guarantee.
- Models propose typed records. Deterministic policy, explicit human approval where required, and isolated signers authorize effects.
- Persist exact signed artifacts and identifiers before broadcast. Reconcile ambiguous outcomes; never create a replacement economic effect blindly.
- Use atomic units for value, runtime validation at external boundaries, allowlists/caps/deadlines, idempotency keys, append-only events, and explicit terminal failure states.
- No arbitrary model-generated calldata, private-key access, secret logging, mainnet value, unapproved spend, or success-shaped mocks.
- Keep AlphaDawg continuity code frozen until official H0. New Project B code and design must begin after H0 in a clean, separately owned repository.

## Deliverable contract

Every plan or implementation must state:

- exact user/failure and why an agent is necessary;
- selected tracks, eligibility state, first-slot cap, and mandatory sponsor-native implementation;
- MVP and non-goals;
- architecture, trust boundaries, state machine, invariants, module map, and external dependencies;
- success, refusal/tamper, replay/restart, partial-failure, and sponsor-unavailable tests;
- four-minute demo sequence and public evidence identifiers;
- hour gates, cut order, and `BUILD`, `NARROW`, or `STOP` decision.

## Verification

This vault has no package manifest or executable application suite. For vault-only work, replace unavailable application lint/typecheck/test commands with proportional checks:

1. Parse every new TOML file.
2. Validate Markdown structure, local links/wikilinks, source URLs, and allowed extensions.
3. Audit every explicit requirement against current file evidence.

Application repositories still require their own lint, typecheck, test, build, live sponsor smokes, fresh clone, secret scan, and end-to-end replay before any completion claim.
