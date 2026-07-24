# R0 Codex Agent Readiness Evidence

- Task: `R0-AGENT-READY-20260724`
- Sprint: `R0`
- Start/control SHA: `7134e1ec0227250c0f9927259ed64d5e0267081d`
- Branch: `Eth_global_lisbon_`
- Observed through: `2026-07-24T22:06:10Z`
- Exit SHA: derive from the containing commit
- Result: `PASS_TO_AUDIT; LOCAL_ONLY`

## Start and authority

The start worktree was clean, the physical writer lock was absent, and both
`bfa7bd37c573e2e49525d965f7f937210e170d72` and accepted A3 SHA
`9a4f41f8c679469dc230cba584bce84fcc3c65e5` are ancestors. Local HEAD was
seven commits ahead of `origin/Eth_global_lisbon_`; no push is authorized.
The common-dir R0 token was acquired before edits and mirrored in
`ACTIVE-WRITER.md`.

No live service, deployment, managed migration, webhook, sponsor call, wallet,
signature, transaction, form, funding, upload, spend, or claim was attempted.

## Codex-native migration

The official Codex custom-agent format was refreshed from the current Codex
manual. Project agents are standalone `.codex/agents/*.toml` files with
`name`, `description`, and `developer_instructions`; the read-only auditor
also sets `sandbox_mode = "read-only"`. The migration workflow ran scan,
plan, doctor, dry-run, real subagent conversion, manual reconciliation, and
target validation.

The seven source agents were converted and repaired in Codex format. Two
missing protected owners were added. The two source commands were converted
into Codex skills. `.claude/**` remains byte-identical to HEAD as inactive
migration provenance and cannot dispatch work.

| Protected domain | Sole Codex owner | Mutation boundary | Verdict |
|---|---|---|---|
| Authentication/kernel | `kernel-integrator` | auth, kernel, worker, protected routes, exact migration and tests | `READY_LOCAL` |
| ENS | `ens-integrator` | `src/ens/**`, A4 fixtures/helpers, exact ENS migration | `READY_LOCAL` |
| 0G | `og-integrator` | `src/og/**`, 0G config, pinned Go verifier, exact migration, A3 tests | `READY_LOCAL` |
| Product UI/E2E | `frontend-builder` | page/UI/client helpers, A5 and Playwright tests; no API routes | `READY_LOCAL` |
| Optional payments | `payments-integrator` | payment/Arc/execution only; dormant until A6 admission | `READY_LOCAL_CLOSED` |
| Cycle wiring | `cycle-wirer` | agents, Telegram, agent registry and boot only | `READY_LOCAL` |
| Final bounty audit | `bounty-auditor` | read-only frozen-SHA audit | `READY_READ_ONLY` |
| Hedera legacy support | `hedera-integrator` | inherited Hedera files only | `READY_NON_AUTHORITATIVE` |
| OpenClaw legacy support | `openclaw-builder` | inherited OpenClaw workspaces only | `READY_NON_AUTHORITATIVE` |

The two converted skills are:

- `source-command-build-specialist`: sequential Cycle/OpenClaw owners, no
  cross-domain writer or live proof;
- `source-command-test-cycle`: deterministic package gates only, with every
  live/setup path denied absent exact authorization.

## Version, path, and command reconciliation

Observed installed versions are broker `0.7.8`, TypeScript Storage SDK
`1.2.8`, pinned Go Storage client `v1.3.0`, Hashgraph SDK `2.81.0`, x402
`2.9.0`, Circle batching `2.0.4`, Viem `2.47.6`, Wagmi `3.6.0`, Next
`16.2.11`, React `19.2.4`, Playwright `1.61.1`, Telegram
`0.67.0`, and Prisma `6.19.3`.

All declared root paths exist. Every declared package verification command
exists. Active Codex artifacts contain no VaultMind identity, obsolete
`src/dashboard/**` path, stale broker/Storage version, historical x402
signature, stale live-cycle command, unsupported Claude model pin, or
Cannes-only bounty contract.

## Current official/static checks

Primary official sources rechecked on 2026-07-24:

- `https://ethglobal.com/rules`: Continuity may use prior work, but must
  disclose it and ship substantive open-source event-window additions.
- `https://ethglobal.com/events/lisbon2026/prizes`: selected current paths
  remain 0G Keep Building, ENS Continuity, and conditional Uniswap Stack.
- `https://docs.ens.domains/contracts/ensv2/overview/`: ENSv2 hierarchy and
  permission documentation remains work in progress pending finalized design
  and audits.
- `https://docs.ens.domains/resolvers/universal/` and
  `https://docs.ens.domains/web/ensv2-readiness/`: canonical Universal
  Resolver address, normalization/DNS encoding, CCIP Read, Viem
  `>=2.35.0`, and the `ur.integration-tests.eth` expected result remain
  current.

The Universal Resolver live readiness request was not run because
`ens_probe` is `NOT_AUTHORIZED`. Static compatibility and local fixtures do
not promote live ENS evidence.

## Validation

| Check | Result |
|---|---|
| Codex migration scan/plan/doctor/dry-run | source surfaces and manual migrations identified |
| Real subagent conversion | seven source agents written as Codex TOML |
| Manual Codex repair | nine non-overlapping agents and two skills |
| `--validate-target ./.codex/` | every agent TOML, converted skill, existing skill, and `AGENTS.md` valid |
| Source preservation | `git diff --exit-code HEAD -- .claude` passed |
| Active stale-instruction scan | passed |
| Declared path scan | passed |
| Required package-script scan | passed |
| `npm run lint` | passed with zero errors and 23 inherited warnings |
| `npm run typecheck` | passed |
| `npm test` | 9 of 9 passed |
| `npm run scan:secrets` | passed |
| `npm run build` | passed |
| `git diff --check` | passed |

An independent current-snapshot dry-dispatch audit is required before the
containing SHA can be accepted as `R0_AGENT_READY`.

## Boundary

This packet proves local dispatch readiness only. It does not prove A4/A5
acceptance, a live service fleet, production readiness, sponsor qualification,
or `RELEASE_VALIDATED`.
