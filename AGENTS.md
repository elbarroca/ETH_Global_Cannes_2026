<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Read the relevant installed guide in
`node_modules/next/dist/docs/` before changing Next.js code.
<!-- END:nextjs-agent-rules -->

## Database and AI tooling

- Neon Postgres is the canonical managed database.
- `DATABASE_URL` uses the pooled `-pooler` endpoint; `DIRECT_URL` uses the
  matching direct endpoint for Prisma migrations.
- Load `.env.local` for an authorized managed migration:
  `node --env-file=.env.local ./node_modules/prisma/build/index.js migrate deploy`.
- Never commit database URLs, passwords, API keys, OAuth credentials, wallet
  material, Telegram secrets, sessions, or link codes.
- Configured credentials are not external-effect authority.

# AlphaDawg Lisbon Codex agent registry

The active product contract is `docs/lisbon/GOALS.md`; the current launch
contract is `docs/lisbon/prompts/C0-A4-CONTINUATION.md`.

Codex loads project agents from `.codex/agents/*.toml`. Files under
`.claude/**` are migration source/provenance only and must not dispatch work.

## Owners

| Owner | Codex agent | Exclusive mutation domain |
|---|---|---|
| **0G Integrator** | `.codex/agents/og-integrator.toml` | `src/og/**`, `src/config/og-*.ts`, `tools/0g-storage-verifier/**`, `tests/a3/**`, `prisma/migrations/20260724041000_strict_0g/**` |
| **Hedera Integrator** | `.codex/agents/hedera-integrator.toml` | `src/hedera/**`, `src/config/hedera.ts`, `scripts/setup-topic.ts`, `scripts/setup-token.ts` |
| **Payments Integrator** | `.codex/agents/payments-integrator.toml` | `src/payments/**`, `src/config/arc*.ts`, `src/execution/**`; optional A6 only |
| **Frontend Builder** | `.codex/agents/frontend-builder.toml` | page/layout/style files under `app/**`, `components/**`, `contexts/**`, `hooks/**`, client UI helpers under `lib/**`, `tests/a5/**`, `tests/playwright/**`; not `app/api/**` |
| **OpenClaw Builder** | `.codex/agents/openclaw-builder.toml` | `openclaw/**`; inherited non-authoritative path |
| **Kernel Integrator** | `.codex/agents/kernel-integrator.toml` | `src/auth/**`, `src/kernel/**`, `src/worker/**`, protected `app/api/auth/**` and `app/api/kernel/**`, `tests/auth/**`, `tests/kernel/**`, `tests/integration/worker-fencing.test.ts`, `prisma/migrations/20260724024500_authenticated_kernel/**` |
| **Cycle Wirer** | `.codex/agents/cycle-wirer.toml` | `src/agents/**`, `src/telegram/**`, `src/config/agent-registry.ts`, `src/index.ts`, `app/api/telegram/**` |
| **ENS Integrator** | `.codex/agents/ens-integrator.toml` | `src/ens/**`, `tests/a4/**`, `tests/helpers/ens.ts`, `prisma/migrations/20260724130000_ens_authority/**` |
| **Bounty Auditor** | `.codex/agents/bounty-auditor.toml` | Read-only repository and current official-source audit |

An owner may not mutate another row's domain. Cross-domain work is split into
sequential C0 dispatches with exact path amendments. Cycle Wirer coordinates
the flow but does not own another specialist's implementation.

## Codex skills

| Skill | Purpose |
|---|---|
| `.agents/skills/source-command-build-specialist/SKILL.md` | Add or change one specialist through sequential domain owners |
| `.agents/skills/source-command-test-cycle/SKILL.md` | Run the protected deterministic local verification contract |

## Dispatch rules

- One persistent C0 coordinator, one mutating writer, at most two useful
  read-only tasks.
- Every dispatch binds task ID, sprint, mode, start/control SHA, allowed paths,
  acceptance items, deadline, blockers, effects, checks, evidence, and return
  schema.
- Writers use `docs/lisbon/prompts/SPRINT-EXECUTOR.md`; auditors use
  `docs/lisbon/prompts/SPRINT-AUDIT.md` against an immutable SHA.
- No agent may grant authority, promote a fixture to live proof, open a later
  gate, or claim bounty/release success.
- Legacy marketplace, hunt, OpenClaw, Hedera, Circle, Arc, and Naryo paths are
  non-authoritative unless the current sprint explicitly admits them.

## Verification floor

Before sprint acceptance, run `npm run lint`, `npm run typecheck`,
`npm test`, affected test lanes, both migration lanes when schema is
affected, `npm run scan:secrets`, `git diff --check`, and
`npm run build`. The full release floor is in `docs/lisbon/GOALS.md`.

Push, deploy, managed migration, webhook registration, sponsor/live calls,
signatures, transactions, funding, uploads, forms, spend, and public claims
require an exact current `AUTHORIZED` row in
`docs/lisbon/EXTERNAL-EFFECTS.md`. Mainnet value is prohibited.
