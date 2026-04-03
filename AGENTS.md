<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# VaultMind — Agent Registry

> 7 specialist Claude Code agents + 2 slash commands. Each agent owns a domain, knows the verified SDK patterns, and can be delegated to autonomously.

## Specialist Agents (`.claude/agents/`)

| Agent | File | Domain | When to Use |
|-------|------|--------|-------------|
| **0G Integrator** | `og-integrator.md` | `src/og/**`, `src/config/og-*.ts` | Sealed inference, TEE attestation, 0G Storage memory |
| **Hedera Integrator** | `hedera-integrator.md` | `src/hedera/**`, `scripts/setup-*.ts` | HCS audit logging, HTS fund token, Scheduled Transactions |
| **Payments Integrator** | `payments-integrator.md` | `src/payments/**`, `src/config/arc.ts` | x402 buyer client, seller middleware, nanopayments |
| **Frontend Builder** | `frontend-builder.md` | `src/dashboard/**`, `app/**` | Next.js 16.2 dashboard, 3-column debate view, pages |
| **OpenClaw Builder** | `openclaw-builder.md` | `openclaw/**` | SOUL.md, AGENTS.md, HEARTBEAT.md, agent personalities |
| **Cycle Wirer** | `cycle-wirer.md` | `src/agents/**`, `src/index.ts` | End-to-end cycle: hire → debate → execute → log → report |
| **Bounty Auditor** | `bounty-auditor.md` | Entire repo | Audit code against 7 bounty requirements before submission |

## Slash Commands (`.claude/commands/`)

| Command | File | Purpose |
|---------|------|---------|
| `/build-specialist` | `build-specialist.md` | Build a specialist agent with x402 paywall + 0G inference |
| `/test-cycle` | `test-cycle.md` | Test full investment cycle end-to-end, step by step |

## Path-Based Rules (`.claude/rules/`)

Auto-loaded when editing matching files — no manual invocation needed.

| Rule | Glob | Enforces |
|------|------|----------|
| `og-compute.md` | `src/og/**` | Single-use headers, `acknowledgeProviderSigner()`, JSON try/catch |
| `x402-payments.md` | `src/payments/**` | viem signing (not ethers), `"GET /analyze"` route format |
| `hedera.md` | `src/hedera/**` | freeze→sign→execute, 6s mirror delay, zero Solidity |
| `openclaw.md` | `openclaw/**` | SOUL.md = personality only, procedures in AGENTS.md |
| `dashboard.md` | `src/dashboard/**` | Server Components default, named exports, Tailwind v4 |

## Agent Delegation Guide

### When building a single subsystem
Use the matching specialist agent directly:
- Working on 0G inference? → **0G Integrator**
- Adding HCS logging? → **Hedera Integrator**
- Setting up x402 paywall? → **Payments Integrator**
- Building a dashboard page? → **Frontend Builder**
- Writing OpenClaw SOUL files? → **OpenClaw Builder**

### When connecting subsystems
Use **Cycle Wirer** — it understands how all pieces connect:
- `main-agent.ts` orchestration
- `adversarial.ts` debate pipeline
- `specialist-server.ts` Express servers
- `index.ts` boot sequence

### Before submitting to a bounty
Use **Bounty Auditor** — it checks every requirement:
- 0G DeFi Agent ($5K)
- 0G OpenClaw ($7K)
- Arc / x402 ($6K)
- Hedera AI Agent ($5K)
- Hedera No Solidity ($2K)
- Hedera Tokenization ($2.5K)
- Naryo ($3.5K)

### Parallel delegation
For independent work, agents can run in parallel:
```
Example: Build 0G inference + Hedera HCS + x402 payments simultaneously
→ Launch og-integrator + hedera-integrator + payments-integrator in parallel
```

## Build Priority → Agent Mapping

| # | Task | Agent |
|---|------|-------|
| 1 | 0G Sealed Inference + attestation | 0G Integrator |
| 2 | 6 agent prompts (7B optimized) | OpenClaw Builder |
| 3 | x402 nanopayments | Payments Integrator |
| 4 | HCS cycle logging | Hedera Integrator |
| 5 | HTS fund token + fees | Hedera Integrator |
| 6 | Dashboard 3-column debate | Frontend Builder |
| 7 | Telegram bot | Cycle Wirer |
| 8 | 0G Storage memory | 0G Integrator |
| 9 | iNFT on 0G Chain | 0G Integrator |
| 10 | OpenClaw SOUL.md + heartbeat | OpenClaw Builder |
| 11 | Scheduled Transactions | Hedera Integrator |
| 12 | Naryo listener | Cycle Wirer |
