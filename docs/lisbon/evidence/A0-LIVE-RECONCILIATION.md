# A0 Live Authority And Probe Reconciliation

Observed: `2026-07-23T18:46:32Z` through `2026-07-23T19:19:55Z`

Start SHA: `2adaa1c165cdb76a762acea1e9177ba08cd65558`

Status: `BLOCKED_A0_PRE_H0_AND_CLEARANCE`

## Gate ledger

| Gate | Decision | Evidence |
|---|---|---|
| Repository | `PASS` | `developer`; clean start at `2adaa1c165cdb76a762acea1e9177ba08cd65558`; baseline `bfa7bd37c573e2e49525d965f7f937210e170d72`; tree `f39cc7e865d8e3ffaa02ea3e2397cee1bbed8c0a`; Node `22.22.3`; npm `10.9.8`; `origin/main` at baseline; no remote `developer`. |
| Official H0 | `BLOCKED` | ETHGlobal schedule event `6867`: `2026-07-24T20:00:00Z` = 21:00 WEST. Current observation preceded H0. |
| Submission | `PASS_REQUIREMENT` | Deadline `2026-07-26T08:00:00Z` = 09:00 WEST; up to three partner prizes. |
| Rights/license/team | `BLOCKED` | Two contributors, no root license, no redacted former-contributor permission, accepted/staked team evidence, changed-team ruling, or named owner roster. |
| 0G Keep category | `PASS_REQUIREMENT` | Continuity prize; up to three $1,500 awards; prior-state link, dated changelog, What's next, public repo/setup, runnable/live demo, Compute/Private Computer proof, and under-three-minute video required. |
| ENS Continuity category | `PASS_REQUIREMENT` | $2,000; non-cosmetic functional integration, video or live link, and Sunday-morning ENS booth presentation required. |
| Uniswap Stack category | `PASS_REQUIREMENT` | Continuity-only; three $1,000 awards; public OSS, `FEEDBACK.md`, README code pointers, and feedback form required. |
| Uniswap API category | `CUT` | Building-from-scratch category; no written Continuity admission. |
| External effects | `BLOCKED` | Every live sponsor write/call, form, push, deploy, database effect, signature, transaction, and spend remains unauthorized. |

Official sources:

- https://ethglobal.com/events/lisbon2026/info/details
- https://ethglobal.com/events/lisbon2026/prizes/0g
- https://ethglobal.com/events/lisbon2026/prizes/ens
- https://ethglobal.com/events/lisbon2026/prizes/uniswap-foundation
- https://ethglobal.com/rules
- https://ethglobal.com/showcase/alpha-dawg-fh6vm

## P0 - 0G

Decision: `FAIL`; live subgate `BLOCKED`.

- Current AlphaDawg Compute accepts ordinary `data.id`, treats verification errors as non-fatal, and can return usable content with `teeVerified=false`.
- Current split Compute SDK `@0gfoundation/0g-compute-ts-sdk@0.9.0` verifies separately fetched signed text; the application must additionally bind that text to the exact downstream response content.
- Current split Storage SDK `@0gfoundation/0g-storage-ts-sdk@1.2.10` ignores the `proof` argument in `downloadTask(..., _proof)` and contains `TODO: add proof check`.
- Required decision: split packages, fatal signed-content equality, and no Storage proof claim until a separately verified official proof-capable client exists.
- Official Galileo values observed: chain `16602`, RPC `https://evmrpc-testnet.0g.ai`, Turbo indexer `https://indexer-storage-testnet-turbo.0g.ai`, Flow `0x22E03a6A89B950F1c82ec5e74F8eCa321a105296`.
- No provider/model, live chat ID, transaction, root, or explorer ID was produced.

## E0 - ENS

Decision: `PASS_STABLE`; public-write subgate `BLOCKED`; `PASS_V2` denied.

- viem `2.47.6` passes ENS readiness; ethers `6.13.1` is below the ENS `6.17.0` minimum and is excluded from the path.
- Stable contracts: Registry `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`, Public Resolver `0xF29100983E058B709F3D539b0c765937B804AC15`, Universal Resolver `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe`.
- Live read-only mainnet fixture passed at block `25597384`; local mainnet-fork create/update/resolve/transfer tests and unauthorized/stale/wrong-chain/missing-resolver/mismatch/outage refusals passed.
- Direct ENSv2 remains blocked by temporary deployment/proxy state, missing persistence/reset SLA, and missing written Lisbon Continuity confirmation.
- No public ENS write or transaction occurred.

## U0 - Uniswap

Decision: `ADMIT_STACK_CONTINUITY`; optional writer remains closed.

- Honest path: event-window repair of the official `@uniswap/universal-router-sdk@5.11.0` Node 22 ESM packaging failure plus an upstream regression test and AlphaDawg consumer example.
- Existing Arc chain `5042002`, custom/mock router, zero-minimum-output path, and self-transfer fallback are not Uniswap evidence.
- Regular API track remains rejected without written admission. No key, quote, signature, transaction, or feedback form was used.

## Mirror acceptance repair

The 244-file research mirror is intentionally byte-for-byte. Its 156 inherited whitespace findings across 47 files are therefore governed by exact path/size/SHA-256 verification, not normalization. Authored controls must separately pass:

```bash
git diff --check b000ba993e753a580f2c0b09d4fec8f0eac8d337..2adaa1c165cdb76a762acea1e9177ba08cd65558 -- . ':(exclude)docs/lisbon/archive/research-vault/**'
```

Observed exit: `0`.

## Decision

`STOP_WRITERS_AT_A0` until all of these pass:

1. official H0/live dashboard signal;
2. contributor/license/team/changed-team evidence;
3. named owners/backups and signed `BUILD` decision;
4. exact external-effect authorizations for any live action;
5. independent audit of this reconciliation commit.

No product file, dependency, push, deployment, signature, transaction, form, provisioned database, or spend was created by this reconciliation.
