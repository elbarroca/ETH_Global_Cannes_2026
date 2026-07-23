# Prompt Launch Index

Every file is copy-ready and self-contained. All code writers share `developer`; never run two writers together.

## Start together

| Prompt | Mode | Purpose |
|---|---|---|
| [`C0-COORDINATOR.md`](C0-COORDINATOR.md) | Coordinator | Owns gates, scheduling, cuts, evidence, and completion. |
| [`A1-FOUNDATION.md`](A1-FOUNDATION.md) | Sole writer | Deterministic npm/Prisma/CI/env/test/build foundation. |
| [`P0-PROBE-0G.md`](P0-PROBE-0G.md) | Async read-only | Current 0G Compute and Storage compatibility; no live effect. |
| [`E0-PROBE-ENS.md`](E0-PROBE-ENS.md) | Async read-only | Stable ENS and direct ENSv2 readiness; no write. |
| [`U0-PROBE-UNISWAP.md`](U0-PROBE-UNISWAP.md) | Async read-only | Stack Continuity admission and API/product distinction. |
| [`VA-INDEPENDENT-AUDIT.md`](VA-INDEPENDENT-AUDIT.md) | Async read-only | Continuous code, security, evidence, and submission audit. |

## Sequential writers after foundation

1. [`A2-AUTH-MARKETPLACE.md`](A2-AUTH-MARKETPLACE.md)
2. [`A2R-SHARED-RUNTIME-CLEANUP.md`](A2R-SHARED-RUNTIME-CLEANUP.md)
3. [`A3-0G.md`](A3-0G.md)
4. [`A4-ENS.md`](A4-ENS.md)
5. [`A5-UNISWAP-CONDITIONAL.md`](A5-UNISWAP-CONDITIONAL.md) only if admitted
6. [`A6-A7-DEPLOY-RELEASE.md`](A6-A7-DEPLOY-RELEASE.md)

The three probes and independent audit never edit the checkout. The coordinator stores their returned evidence between writer packets.
