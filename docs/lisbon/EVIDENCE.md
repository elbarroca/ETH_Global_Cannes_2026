# Lisbon Evidence Ledger

Status: `research_only_not_promotable`

## Baseline

- Commit: `bfa7bd37c573e2e49525d965f7f937210e170d72`
- Tree: `f39cc7e865d8e3ffaa02ea3e2397cee1bbed8c0a`
- Lock SHA-256: `b4a1aed30a52a74d1b4396da9f1d6535a5e475da1b40a99a6c744aae1a8c6b33`
- Prior showcase: `https://ethglobal.com/showcase/alpha-dawg-fh6vm`

## Entry schema

```text
evidence_id:
gate:
release_sha:
observed_at_utc:
environment_or_network:
command_or_action:
expected:
observed:
public_identifiers:
artifact_paths:
redactions:
status: PASS | FAIL | BLOCKED
```

| Evidence ID | Gate | State | Evidence |
|---|---|---|---|
| `A0-BASELINE-001` | Baseline | `PASS` | `BASELINE.md` and Git object/hash checks. |
| `A0-AUTH-001` | Local start | `PASS_LOCAL_ONLY` | Thread authorization; external effects remain denied. |
| `A0-PROMPT-001` | Prompt pack | `PASS` | `GOALS.md` contains the dependency matrix, subagent contract, validation ladder, premortems, and 12 consistently named split prompts. Markdown fences, local links, prompt headers, and async no-effect boundaries passed. |
| `A0-LOCK-001` | Writer serialization | `PASS` | Atomic common-dir lease exists; physical and mirrored tokens match. |
| `A0-AUDIT-001` | Independent prompt audit | `PASS` | Concurrency, live-probe, naming, and lock-mirror findings reconciled; independent result was `PASS_IF_A0_CLOSED`; A0 content commit `41325b6564c338d8b681c2756228add3a7b4dac3` satisfied the condition. |
| `A0-ARCHIVE-001` | Repo-local context | `PASS` | All 244 research-vault files mirrored byte-for-byte and indexed in `ALPHADAWG-FILE-MANIFEST.csv`; 1,033 internal file links resolve; two preserved stale heading names have repo-local redirects in `ALPHADAWG-FILE-MAP.md`; the only two direct root-level research files were archived safely. |
| `A0-MIRROR-001` | Internal accessibility | `PASS` | Content commit `11de852d0ca89563634f0512b45f1ca987670447`; exact results in `evidence/A0-CONTEXT-MIRROR-VALIDATION.md`; independent read-only audit returned `PASS_IF_COMMITTED_AND_LOCK_RELEASED`. |
| `A0-MIRROR-AUDIT-002` | Mirror post-commit audit | `BLOCKED` | Final SHA `2adaa1c165cdb76a762acea1e9177ba08cd65558` was clean and hash/link/lock checks passed, but full-range `git diff --check` found 156 source whitespace defects inside the intentionally byte-preserved archive. Acceptance is repaired by hash-verifying the archive and whitespace-checking authored controls separately; re-audit required. |
| `A0-LIVE-AUTHORITY-002` | Live rules/authority | `BLOCKED` | Official H0 is 2026-07-24 21:00 WEST; rights/license/team/owners/access remain incomplete. Exact ledger: `evidence/A0-LIVE-RECONCILIATION.md`. |
| `A0-EXIT-AUDIT-002` | Independent A0 release audit | `BLOCKED` | Pinned audit of `b000ba993e753a580f2c0b09d4fec8f0eac8d337` contradicted H0, clearance, evidence, handoff, and privacy gates. A1 stays closed. |
| `A1-FOUNDATION-001` | Foundation | `NOT_RUN` | Await Goal A1. |
| `P0-0G-001` | 0G compatibility | `FAIL` | Current Compute response binding is fail-open and Storage SDK `1.2.10` ignores proof-enabled download. Live subgate `BLOCKED`; no Lisbon live ID. |
| `E0-ENS-001` | ENS compatibility | `PASS` | Stable viem/Registry/Public Resolver/Universal Resolver path passed live reads and local-fork refusal tests; public write subgate `BLOCKED`; direct ENSv2 `BLOCKED`. |
| `U0-UNISWAP-001` | Uniswap admission | `PASS` | `ADMIT_STACK_CONTINUITY` only for a reusable upstream Node 22 ESM SDK fix; existing Arc/custom-router path rejected; optional writer remains closed. |

HTTP `200`, a database flag, UI badge, inherited receipt, or mock is not terminal evidence.

## A0 verification scope

This gate changes documentation and control state only. It ran Markdown structure/link checks, prompt-set and header checks, async no-effect checks, common-dir lock/token equality, branch/baseline verification, active-doc secret-pattern scanning, and authored-control `git diff --check`. The intentionally byte-preserved `docs/lisbon/archive/research-vault/**` corpus is verified by exact path, size, and SHA-256 manifest and is excluded from whitespace normalization/checks. Application lint, typecheck, tests, build, migrations, and live sponsor smokes remain `NOT_RUN` for A1 and later code sprints.

## Downstream boundary

Completing the context mirror does not open Goal A1. The independent A0 release audit remains `BLOCKED` on pre-H0 timing, rights/license/team/owner gaps, evidence/atomicity defects, and external-effect authorization.
