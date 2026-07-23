# C0-Managed Prompt Index

Only C0 is operator-launched. Every other file is a C0-owned task template requiring a current dispatch capability; manual launch returns `BLOCKED_NOT_DISPATCHED`.

## Launch only this

| Prompt | Mode | Purpose |
|---|---|---|
| [`C0-COORDINATOR.md`](C0-COORDINATOR.md) | Coordinator | Owns gates, scheduling, cuts, evidence, and completion. |

## C0-dispatched read-only templates

| Prompt | Mode | Purpose |
|---|---|---|
| [`P0-PROBE-0G.md`](P0-PROBE-0G.md) | Async read-only | Current 0G Compute and Storage compatibility; no live effect. |
| [`E0-PROBE-ENS.md`](E0-PROBE-ENS.md) | Async read-only | Stable ENS and direct ENSv2 readiness; no write. |
| [`U0-PROBE-UNISWAP.md`](U0-PROBE-UNISWAP.md) | Async read-only | Stack Continuity admission and API/product distinction. |
| [`VA-INDEPENDENT-AUDIT.md`](VA-INDEPENDENT-AUDIT.md) | Async read-only | Continuous code, security, evidence, and submission audit. |

## C0-dispatched sequential writers

1. [`A1-FOUNDATION.md`](A1-FOUNDATION.md), only after A0 passes and C0 admits it
2. [`A2-AUTH-MARKETPLACE.md`](A2-AUTH-MARKETPLACE.md)
3. [`A2R-SHARED-RUNTIME-CLEANUP.md`](A2R-SHARED-RUNTIME-CLEANUP.md)
4. [`A3-0G.md`](A3-0G.md)
5. [`A4-ENS.md`](A4-ENS.md)
6. [`A5-UNISWAP-CONDITIONAL.md`](A5-UNISWAP-CONDITIONAL.md), only if admitted
7. [`A6-A7-DEPLOY-RELEASE.md`](A6-A7-DEPLOY-RELEASE.md)

C0 permits at most one writer and three non-duplicate read-only subagents. A 15-minute return is review input, not PASS; C0 independently reconciles every acceptance item and pinned SHA.
