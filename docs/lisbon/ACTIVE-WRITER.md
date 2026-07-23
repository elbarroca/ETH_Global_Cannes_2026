# Active Writer

At most one record may have `status: active`.

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
exit_sha: returned_in_canonical_handoff
exit_sha_note: a single candidate commit cannot contain its own commit SHA
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

Read-only probes/auditors may overlap but must not edit, install, format, commit, push, deploy, sign, transact, submit forms, or spend.
