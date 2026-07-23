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

Read-only probes/auditors may overlap but must not edit, install, format, commit, push, deploy, sign, transact, submit forms, or spend.
