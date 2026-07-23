# Active Writer

At most one record may have `status: active`.

```yaml
owner: Codex under project-owner direction
task_id: A0-LEAN-GOAL-PACK
branch: developer
start_sha: eedcdc58a93065410d430db2d9c7d602927793b1
token: 35E26400-39E6-47C1-BD25-C0CCE1773013
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T23:12:41Z
expires_at: 2026-07-24T01:03:30Z
allowed_paths:
  - CHANGELOG-LISBON.md
  - docs/lisbon/**
started_at: 2026-07-24T00:03:30+01:00
expected_exit: lean canonical contract, sprint ledger, reusable executor/auditor prompts, and verified local commit
completed_at: 2026-07-24T00:12:41+01:00
exit_sha: 5e5b0282daea08d5d4937e54d687580ab8c3dbd7
lock_release: remove only token 35E26400-39E6-47C1-BD25-C0CCE1773013 after the commit succeeds
acceptance_evidence:
  - current prompt surface reduced from 13 files to 4
  - Markdown structure, links, A0-A7 coverage, diff hygiene, and secret patterns passed
  - physical and mirrored writer tokens match
  - TypeScript passed; inherited lint and missing test script remain explicit A1 blockers
  - independent read-only audit returned PASS after reconciliation
audit_verdict: PASS
closure_token: F5A1FCBE-FE70-462B-900D-4B086F16D48C
closure_start_sha: 5e5b0282daea08d5d4937e54d687580ab8c3dbd7
closure_reason: record the exact content exit SHA after commit
closure_completed_at: 2026-07-24T00:14:34+01:00
status: complete
```

```yaml
owner: Codex under project-owner direction
task_id: A0-CONTROL-PACK
branch: developer
start_sha: bfa7bd37c573e2e49525d965f7f937210e170d72
token: 5b76adc8-ac74-476e-a140-c2c818d57b20
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T18:45:13Z
expires_at: 2026-07-23T19:41:17Z
allowed_paths:
  - CHANGELOG-LISBON.md
  - docs/lisbon/**
started_at: 2026-07-23T18:06:32+01:00
expected_exit: self-contained control and goal pack validated and committed
exit_sha: 41325b6564c338d8b681c2756228add3a7b4dac3
completed_at: 2026-07-23T18:45:13Z
lock_release: remove the matching physical lease immediately after the closure commit
acceptance_evidence:
  - branch and baseline verified
  - no external effect
  - Markdown links and structure valid
  - independent prompt audit reconciled
status: complete
```

```yaml
owner: Codex under project-owner direction
task_id: A0-CONTEXT-MIRROR
branch: developer
start_sha: b000ba993e753a580f2c0b09d4fec8f0eac8d337
token: d17cd3a9-21a1-434a-a052-9bb5bb82a77e
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T19:13:32Z
expires_at: 2026-07-23T20:12:11Z
allowed_paths:
  - CHANGELOG-LISBON.md
  - docs/lisbon/**
started_at: 2026-07-23T18:55:09Z
expected_exit: full research-vault mirror, internal file map, link closure validation, and local commit
exit_sha: 11de852d0ca89563634f0512b45f1ca987670447
completed_at: 2026-07-23T19:13:32Z
lock_release: remove the matching physical lease immediately after the closure commit
acceptance_evidence:
  - all research-vault files mirrored byte-for-byte
  - all Obsidian and Markdown references resolve internally or are external URLs
  - execution prompts remain AlphaDawg-only
  - independent read-only audit reconciled
status: complete
```

```yaml
owner: Codex under project-owner direction
task_id: A0-LIVE-RECONCILIATION
branch: developer
start_sha: 2adaa1c165cdb76a762acea1e9177ba08cd65558
token: 396822ef-3f71-4418-845a-995e9ec987fa
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T19:19:55Z
expires_at: 2026-07-23T20:19:55Z
allowed_paths:
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/BASELINE.md
  - docs/lisbon/TRACK-MATRIX.md
  - docs/lisbon/CLAIM-MATRIX.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/EXTERNAL-EFFECTS.md
  - docs/lisbon/FRESH-CLONE.md
  - docs/lisbon/evidence/**
started_at: 2026-07-23T19:19:55Z
expected_exit: reconcile A0 live authority, P0/E0/U0 results, mirror audit boundary, and current release blockers in one docs-only commit
exit_sha: fa8bebbc624599f7ef1277a2a466ef72863b3142
completed_at: 2026-07-23T19:23:05Z
lock_release: remove the matching physical lease immediately after the closure commit
acceptance_evidence:
  - current official ETHGlobal and sponsor requirements timestamped
  - A0 release audit remains fail-closed
  - P0, E0, and U0 exact verdicts recorded
  - byte-preserved archive excluded explicitly from authored-whitespace gate
  - Markdown links, CSV, manifest, and git diff checks pass
status: complete
```

```yaml
owner: Codex under project-owner direction
task_id: A0-DEEP-C0
branch: developer
start_sha: de802b30a36680f6db05cf6f903f3e67d2b9ed66
token: d2bf7b68-c0e3-4a6c-a1ba-32d2add7e81e
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T22:06:27Z
expires_at: 2026-07-23T23:06:27Z
allowed_paths:
  - CHANGELOG-LISBON.md
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/EVIDENCE.md
  - docs/lisbon/GOALS.md
  - docs/lisbon/README.md
  - docs/lisbon/prompts/C0-COORDINATOR.md
  - docs/lisbon/prompts/README.md
  - docs/lisbon/prompts/A1-FOUNDATION.md
  - docs/lisbon/prompts/P0-PROBE-0G.md
  - docs/lisbon/prompts/E0-PROBE-ENS.md
  - docs/lisbon/prompts/U0-PROBE-UNISWAP.md
  - docs/lisbon/prompts/A2-AUTH-MARKETPLACE.md
  - docs/lisbon/prompts/A2R-SHARED-RUNTIME-CLEANUP.md
  - docs/lisbon/prompts/A3-0G.md
  - docs/lisbon/prompts/A4-ENS.md
  - docs/lisbon/prompts/A5-UNISWAP-CONDITIONAL.md
  - docs/lisbon/prompts/A6-A7-DEPLOY-RELEASE.md
  - docs/lisbon/prompts/VA-INDEPENDENT-AUDIT.md
started_at: 2026-07-23T22:06:27Z
expected_exit: one deeper C0 master goal plus C0-issued dispatch guards in every connected sprint prompt, with peer-goal handoff, monitoring, recovery, audit, and cut/stop controls
exit_sha: 4a9015f24913f33283fdf7063673f8982f7005d2
completed_at: 2026-07-23T22:23:21Z
lock_release: remove only the matching physical lease after the candidate commit
acceptance_evidence:
  - current A0/P0/E0/U0 state embedded accurately
  - C0 is the sole dispatcher and never duplicates writers
  - peer-task reports remain unverified until pinned-SHA evidence passes
  - independent read-only prompt audit reconciled
  - Markdown structure, fences, local links, dispatch parity, allowed paths, diff hygiene, and added-line secret patterns pass
status: complete
```

```yaml
owner: C0 coordinator thread 019f910a-2546-7c82-8a45-72b8678565fc
task_id: A0-C0-REPAIR
task_instance_id: A0-C0-REPAIR:g2:C17AB9DF
generation: 2
branch: developer
start_sha: 4a9015f24913f33283fdf7063673f8982f7005d2
control_sha: 4a9015f24913f33283fdf7063673f8982f7005d2
token: C17AB9DF-A4A0-4FAA-BC5A-C868E9961ED1
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T22:41:00Z
expires_at: 2026-07-23T23:36:54Z
allowed_paths:
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/GOALS.md
  - docs/lisbon/prompts/C0-COORDINATOR.md
  - docs/lisbon/prompts/A1-FOUNDATION.md
  - docs/lisbon/prompts/P0-PROBE-0G.md
  - docs/lisbon/prompts/E0-PROBE-ENS.md
  - docs/lisbon/prompts/U0-PROBE-UNISWAP.md
  - docs/lisbon/prompts/A2-AUTH-MARKETPLACE.md
  - docs/lisbon/prompts/A2R-SHARED-RUNTIME-CLEANUP.md
  - docs/lisbon/prompts/A3-0G.md
  - docs/lisbon/prompts/A4-ENS.md
  - docs/lisbon/prompts/A5-UNISWAP-CONDITIONAL.md
  - docs/lisbon/prompts/A6-A7-DEPLOY-RELEASE.md
  - docs/lisbon/prompts/VA-INDEPENDENT-AUDIT.md
started_at: 2026-07-23T22:36:54Z
expected_exit: exact RELEASE_VALIDATED terminal contract, separated dispatch guards, and exact prior closure SHA
acceptance_evidence:
  - every split prompt keeps its task body separate from the dispatch guard
  - RELEASE_VALIDATED is the only successful terminal state
  - BUILD, NARROW, and BLOCKED remain non-terminal checkpoints
  - prior A0-DEEP-C0 exit SHA is exact
  - full docs-only validation passed
completed_at: 2026-07-23T22:41:00Z
lock_release: release only token C17AB9DF-A4A0-4FAA-BC5A-C868E9961ED1 after the candidate commit
exit_sha: 225d82cafa831cad92d9357ccba81e3b4bd2b0c7
audit_verdict: BLOCK
audit_findings:
  - stale state-machine tail still terminated at BUILD, NARROW, or broad STOP
  - A6/A7 still used STOP for a red protected guarantee
status: rejected_for_remediation
```

```yaml
owner: C0 coordinator thread 019f910a-2546-7c82-8a45-72b8678565fc
task_id: A0-C0-REPAIR
task_instance_id: A0-C0-REPAIR:g3:175370F5
generation: 3
branch: developer
start_sha: 225d82cafa831cad92d9357ccba81e3b4bd2b0c7
control_sha: 225d82cafa831cad92d9357ccba81e3b4bd2b0c7
token: 175370F5-49D5-4F5F-AD69-DF61C2982A6E
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T22:46:27Z
expires_at: 2026-07-23T23:44:57Z
allowed_paths:
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/GOALS.md
  - docs/lisbon/prompts/C0-COORDINATOR.md
  - docs/lisbon/prompts/A6-A7-DEPLOY-RELEASE.md
started_at: 2026-07-23T22:44:57Z
expected_exit: remove every stale early-terminal path and keep red guarantees in the repair loop
acceptance_evidence:
  - state machine exits successfully only at RELEASE_VALIDATED
  - BUILD, NARROW, WAIT_GATE, BLOCKED, CUT, and FAIL loop to reconciliation or waiting
  - STOP is limited to owner cancellation, deadline expiry, or unrecoverable repository integrity
  - A6/A7 returns blockers and remediation instead of stopping on a red guarantee
  - docs-only validation passed
completed_at: 2026-07-23T22:46:27Z
lock_release: release only token 175370F5-49D5-4F5F-AD69-DF61C2982A6E after the candidate commit
exit_sha: a89bb157e4cd5af0b07e67444b65b78e7b96b41c
audit_verdict: BLOCK
audit_findings:
  - protected timebox failure still allowed a generic STOP
  - retry and writer-ambiguity failure still allowed a generic STOP
status: rejected_for_remediation
```

```yaml
owner: C0 coordinator thread 019f910a-2546-7c82-8a45-72b8678565fc
task_id: A0-C0-REPAIR
task_instance_id: A0-C0-REPAIR:g4:EB730834
generation: 4
branch: developer
start_sha: a89bb157e4cd5af0b07e67444b65b78e7b96b41c
control_sha: a89bb157e4cd5af0b07e67444b65b78e7b96b41c
token: EB730834-6C8C-4C8C-84C6-1E612B0F42F3
lock_path: <git-common-dir>/alphadawg-lisbon-writer.lock
heartbeat_at: 2026-07-23T22:50:36Z
expires_at: 2026-07-23T23:49:12Z
allowed_paths:
  - docs/lisbon/ACTIVE-WRITER.md
  - docs/lisbon/GOALS.md
  - docs/lisbon/prompts/C0-COORDINATOR.md
started_at: 2026-07-23T22:49:12Z
expected_exit: reserve STOP exclusively for the three owner-authorized terminal conditions
acceptance_evidence:
  - protected sprint timebox failures become FAIL or BLOCKED and stay in repair
  - repeated protected failures and writer ambiguity become BLOCKED and stay in reconciliation
  - only exact global deadline expiry may trigger deadline-expired STOP
  - docs-only validation passed
completed_at: 2026-07-23T22:50:36Z
lock_release: release only token EB730834-6C8C-4C8C-84C6-1E612B0F42F3 after the candidate commit
exit_sha: a97b2a15a5b346f3d212f325746600ecc801f2b1
audit_target_sha: a97b2a15a5b346f3d212f325746600ecc801f2b1
audit_verdict: PASS_TO_NEXT_GATE
audit_findings: []
audit_scope:
  - exact three-file allowed-path diff
  - clean developer and absent physical lock
  - STOP limited to owner cancellation, global deadline expiry, or unrecoverable repository integrity
  - protected failures return to repair or reconciliation
  - RELEASE_VALIDATED is the only successful terminal state
  - A0, P0, and external-effect blocks remain intact
status: complete
```

Read-only probes/auditors may overlap but must not edit, install, format, commit, push, deploy, sign, transact, submit forms, or spend.
