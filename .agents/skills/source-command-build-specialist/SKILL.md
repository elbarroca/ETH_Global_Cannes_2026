---
name: source-command-build-specialist
description: Add or change one AlphaDawg specialist through sequential Codex agent owners.
---

# Build one AlphaDawg specialist

Use the specialist ID from the user's request. This workflow requires an active
C0 dispatch and never grants live, payment, sponsor, deployment, or claim
authority.

1. Read `AGENTS.md`, `docs/lisbon/GOALS.md`,
   `src/config/agent-registry.ts`, `src/agents/specialist-server.ts`,
   `src/agents/prompts.ts`, and `openclaw/openclaw.json`.
2. Reuse an existing registry entry and port when possible. Reject duplicate
   IDs, ports, endpoints, roles, or service names.
3. Split mutation by owner:
   - `cycle-wirer`: registry, server, prompt, orchestration, and tests.
   - `openclaw-builder`: workspace/config only when explicitly required.
4. Serialize those writers through C0; never give one writer both domains.
5. Keep output non-authoritative unless kernel, ENS, 0G, idempotency, and
   release policies admit it.
6. Run `npm run lint`, `npm run typecheck`, affected tests,
   `npm run scan:secrets`, and `npm run build`.

Do not start a live service or treat HTTP 402 as proof. A functional live
request requires exact current authorization and separate evidence.
