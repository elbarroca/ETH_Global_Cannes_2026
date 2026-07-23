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
| `A0-ARCHIVE-001` | Repo-local context | `PASS` | 42 copied provenance inputs plus `archive/README.md`; supplied prize-text SHA-256 `630007d7...bf774`; ENS workshop image SHA-256 `0760b12c...3724`. |
| `A1-FOUNDATION-001` | Foundation | `NOT_RUN` | Await Goal A1. |
| `A3-0G-001` | 0G | `NOT_RUN` | No Lisbon live ID. |
| `A4-ENS-001` | ENS | `NOT_RUN` | No Lisbon live ID. |
| `U0-UNISWAP-001` | Uniswap admission | `NOT_RUN` | Await Goal U0. |

HTTP `200`, a database flag, UI badge, inherited receipt, or mock is not terminal evidence.

## A0 verification scope

This gate changes documentation and control state only. It ran Markdown structure/link checks, prompt-set and header checks, async no-effect checks, common-dir lock/token equality, branch/baseline verification, active-doc secret-pattern scanning, and `git diff --check`. Application lint, typecheck, tests, build, migrations, and live sponsor smokes remain `NOT_RUN` for A1 and later code sprints; `node_modules` was absent and no dependency installation occurred.
