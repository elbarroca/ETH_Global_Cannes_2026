# AlphaDawg

### Own the agent. Verify the work. Trust the receipt.

> A protected marketplace where authenticated creators publish immutable AI
> agents, external buyers hire an exact version, and delivery requires fresh
> ENS authority plus verified 0G execution.

**ETHGlobal Lisbon 2026 Continuity · Local evidence only · Release blocked**

---

## The Problem

AI agents can recommend, trade, and coordinate, but most agent marketplaces
cannot prove four basic facts:

1. **Who controls the agent?** A connected wallet or display name is not proof
   of authority over an agent identity.
2. **What was hired?** Mutable instructions make it impossible to know which
   version produced a result.
3. **What actually ran?** A model response or success badge is not verified
   execution or durable delivery.
4. **What was authorized?** A swap transaction alone does not prove the agent's
   policy, route, limits, or approval.

## The Solution

AlphaDawg turns each claim into an explicit gate. The creator authenticates
with SIWE, binds an immutable agent version to a canonical ENS creator name and
deterministic agent subname, then publishes that exact version to the protected
marketplace. A different authenticated buyer hires it through an idempotent
job. Delivery is accepted only after fresh ENS checks, verified 0G Compute,
proof-enabled Storage readback, and one canonical receipt.

The protected journey is simple:

`wallet → ENSv2 identity → immutable agent → marketplace hire → verified 0G delivery → receipt/UI`

A different buyer performs the hire. Telegram can reach the same protected
flow, but neither a buyer wallet nor Telegram can replace creator authority.

---

## Architecture — Six Protected Stages

```mermaid
flowchart LR
    Wallet["Wallet"] --> Identity["ENSv2 Identity<br/>creator.eth / agent.creator.eth"]
    Identity --> Agent["Immutable Agent"]
    Agent --> Hire["Marketplace Hire"]
    Hire --> Delivery["Verified 0G Delivery"]
    Delivery --> Result["Receipt / UI"]

    Buyer["Different buyer wallet"] --> Hire
    Telegram["Linked Telegram account"] -. "same app identity" .-> Hire

    Result -. "after A4_ACCEPTED + frozen A5_ACCEPTED" .-> Swap["A6 Uniswap target<br/>quote → confirm/sign → Unichain Sepolia → UniswapToolReceipt"]
    Swap -. "missing live authority" .-> Blocked["A6_BLOCKED_LIVE"]
```

Solid arrows are the protected product path. Dashed arrows are secondary or
pre-gated paths; they are not implementation, eligibility, or live proof.

| Role | Component | What it proves |
|---|---|---|
| Identity | ENSv2 creator parent + deterministic agent subname | Who owns or is authorized to operate the named agent |
| Version | Immutable `AgentVersion` | The exact instructions, capability, service, price, policy, and owner hired |
| Commerce | Protected marketplace + different-buyer job | Who published, who hired, and which version was selected |
| Execution | 0G Compute + proof-enabled Storage readback | The accepted output matches the stored delivery |
| Receipt | Canonical terminal receipt | One delivery and one mutually exclusive financial outcome |
| Swap tooling | Mandatory pre-gated A6 Uniswap target | A buyer-approved testnet swap and separate tooling receipt |

---

## The Run — What Happens End to End

1. **Authenticate:** SIWE establishes the app user. Telegram and reverse ENS
   resolution never replace wallet authority.
2. **Bind the name:** the creator selects a parent such as `creator.eth`; the
   system derives a deterministic subname such as `agent-slug.creator.eth`.
3. **Freeze the version:** instructions, capability, service, price, payout,
   policy, chain, owner, and name binding become one immutable version.
4. **Publish:** only that protected version becomes visible and hireable in the
   marketplace.
5. **Hire:** a different authenticated buyer accepts an integer-atomic quote
   and submits one idempotent job.
6. **Recheck authority:** ENS is resolved immediately before the first 0G
   effect. Missing, stale, transferred, or inconsistent authority stops work.
7. **Execute and read back:** 0G output, proof, and Storage readback must match
   the immutable job and version.
8. **Deliver:** ENS is checked again before one canonical receipt is accepted
   and shown in the UI.
9. **Prove swap tooling:** after `A4_ACCEPTED` and frozen `A5_ACCEPTED`, A6 must
   prove its bounded Unichain Sepolia lifecycle before A7. Missing live
   authority yields `A6_BLOCKED_LIVE`; it never removes A6.

## ENSv2 — A Human Name With Machine Authority

The creator name and agent label are normalized separately. The agent subname
is deterministic and bound to the immutable version, so renaming, transfer,
role drift, resolver drift, broken parent links, or stale records cannot silently
change what the buyer hired.

Current evidence is local fixture/integration evidence. Direct ENSv2 live writes
and claims remain blocked until the official deployment packet and an exact
external-effect authorization exist.

## Marketplace — One Protected Listing

The protected marketplace lists only an immutable published version. A draft,
legacy marketplace row, unresolved ENS name, unavailable runtime, or self-hire
cannot satisfy the journey. Duplicate submissions converge on one job and one
effect identity.

## Proof — ENS + 0G + Receipt

Fresh ENS checks answer **who is authorized**. Verified 0G Compute and Storage
readback answer **what ran and what was delivered**. The canonical receipt binds
those facts to the exact buyer, job, version, hashes, and terminal outcome.

A fixture, installed SDK, HTTP `200`, request ID, or green UI badge is not live
sponsor proof.

## Uniswap — Mandatory, Pre-Gated Swap Tooling

Current state: `A6_REQUIRED_TARGET; PRE_GATES_CLOSED; NOT_IMPLEMENTED;
LIVE_EFFECT_BLOCKED`.

After `A4_ACCEPTED` and frozen `A5_ACCEPTED`, A6 must implement and independently
audit one narrow target: a server-proxied quote, explicit buyer confirmation and
wallet signing, Unichain Sepolia validation, and a separate immutable
`UniswapToolReceipt`. Mainnet, automatic signing, arbitrary tokens, cross-chain
routing, UniswapX, and server-held buyer keys are prohibited.

API, faucet, signature, transaction, push, and form effects each require an
exact current `AUTHORIZED` row. Without that authority, A6 is
`A6_BLOCKED_LIVE` and A7 stays closed. Any API value pasted into chat is treated
as compromised: it must never be used, echoed, logged, or committed, and must
be rotated before the first request.

## Bounty Fit — Plain English

| Track | What AlphaDawg is designed to demonstrate | Honest state |
|---|---|---|
| ENS | A creator controls a parent name, each agent gets a deterministic subname, and authority is checked again before execution and delivery. | Local evidence exists, but the Kernel publication handoff is `AUDIT_FIX`; no live ENS or eligibility claim. |
| 0G | Compute produces the result, Storage preserves it, and proof-enabled readback must match before delivery is accepted. | Deterministic local evidence exists; live 0G execution is `NOT_RUN`. |
| Uniswap | A server supplies a bounded quote, the buyer confirms and signs, Unichain Sepolia validates it, and a separate receipt records the tooling lifecycle. | Mandatory A6 target only; not implemented, audited, live-proven, or eligibility-proven. |

---

## Current Gate

The [Lisbon Claim Matrix](docs/lisbon/CLAIM-MATRIX.md) is the source of truth.

- `LOCAL_BUILD_AUTHORIZED`: deterministic local files, tests, loopback services,
  disposable databases, and atomic commits are allowed.
- A0-A3 have accepted local evidence; live 0G execution remains `NOT_RUN`.
- A4 W3 schema-v1 compatibility is `PASS_TO_NEXT_GATE`, but the Kernel
  publication handoff audit returned `FIX`; current `A4_ACCEPTED` remains
  closed.
- A5's Kernel lifecycle audit returned `FIX`; A5 remains local-only and is not
  accepted.
- A6 is mandatory after accepted A4 and frozen A5, but is not implemented and
  its pre-gates and live-effect gate remain closed.
- `RELEASE_BLOCKED` and `LIVE_EFFECT_BLOCKED` remain in force. Production
  readiness is rejected currently; expected winnings are unproven with floor
  `$0`.

## Project Structure

| Area | Paths |
|---|---|
| Authentication and commerce kernel | `src/auth/`, `src/kernel/`, `src/worker/` |
| ENS authority | `src/ens/` |
| 0G execution and verification | `src/og/`, `tools/0g-storage-verifier/` |
| Product UI and browser evidence | `app/`, `components/`, `tests/playwright/` |
| Telegram and protected cycle wiring | `src/telegram/`, `src/agents/` |
| Evidence and controls | `tests/`, `docs/lisbon/` |

Inherited OpenClaw, Hedera, Circle, Arc, Naryo, and legacy marketplace paths are
non-authoritative unless a current sprint explicitly admits them.

## Tech Stack

| Layer | Technology |
|---|---|
| Web | Next.js 16, React 19, TypeScript |
| Data | Neon PostgreSQL, Prisma |
| Identity | SIWE, viem, ENS Universal Resolver + ENSv2 readiness fixtures |
| Execution | 0G Compute, Storage, pinned Go proof verifier |
| UI verification | Playwright Chromium |
| Swap tooling | Mandatory pre-gated A6 target on Unichain Sepolia |

## Quick Start

Requires Node.js 22+ and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Core checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Never commit `.env.local` or treat configured credentials as permission for a
sponsor call, managed migration, signature, transaction, deployment, or spend.
The complete migration, integration, browser, resilience, Go verifier, secret,
and release floor is defined in [GOALS.md](docs/lisbon/GOALS.md).

## Control Center

| Document | Purpose |
|---|---|
| [GOALS.md](docs/lisbon/GOALS.md) | Canonical outcome, authority, evidence, and release contract |
| [SPRINTS.md](docs/lisbon/SPRINTS.md) | Ordered acceptance cards |
| [CLAIM-MATRIX.md](docs/lisbon/CLAIM-MATRIX.md) | Current fail-closed claim state |
| [EVIDENCE.md](docs/lisbon/EVIDENCE.md) | Append-only evidence ledger |
| [EXTERNAL-EFFECTS.md](docs/lisbon/EXTERNAL-EFFECTS.md) | Exact authorization for external actions |
| [C0-A4-CONTINUATION.md](docs/lisbon/prompts/C0-A4-CONTINUATION.md) | Current coordinator launch contract |

Previous Cannes code and evidence are reusable prior work, not Lisbon
eligibility, release evidence, production proof, or a prize forecast. Only
`RELEASE_VALIDATED` on one unchanged SHA is a successful terminal state.
