
> Multi-agent swarm economy for provable investment alpha. Your AI agent hires specialist sub-agents via nanopayments, runs adversarial debate, and proves every decision on-chain. Controlled via Telegram + Next.js dashboard.

## COMMANDS
```bash
npm install                                     # All dependencies
npm run dev                                     # Next.js 16.2 dev (Turbopack)
npm run build                                   # Production build
npx ts-node scripts/setup-topic.ts              # HCS audit topic → saves TOPIC_ID to .env
npx ts-node scripts/setup-token.ts              # HTS fund token → saves TOKEN_ID to .env
npx ts-node scripts/setup-og-account.ts         # Fund 0G broker (10 0G deposit)
npx ts-node src/agents/specialist-server.ts     # Start 3 specialists on :4001-4003
npx ts-node src/index.ts                        # Run full cycle
```

## WHAT THIS IS
**IS:** Telegram + dashboard app powering a multi-agent swarm hiring economy. Personal AI agent hires specialist sub-agents via $0.001 micropayments, debates adversarially inside TEE enclaves, logs every decision to immutable audit trail.

**IS NOT:** A hedge fund. A black-box bot. A portfolio manager.

Core product = **agent hiring economy**: autonomous agents discover, pay, and delegate tasks to specialists. Every interaction economically incentivized and cryptographically verified.

## STACK
- **Runtime:** Node.js >= 22 · TypeScript strict · ES modules (`"type": "module"`) · npm
- **Frontend:** Next.js 16.2 (App Router, Turbopack, React 19) · Tailwind CSS v4
- **Hedera:** `@hashgraph/sdk` ^2.69.0
- **0G Compute:** `@0glabs/0g-serving-broker` · `@types/crypto-js@4.2.2` · `crypto-js@4.2.0`
- **0G Storage:** `@0glabs/0g-ts-sdk`
- **Payments (seller):** `@x402/express` · `@x402/evm` · `@x402/core`
- **Payments (buyer):** `@x402/fetch` · `@x402/core` · `@x402/evm` · `viem`
- **Other:** ethers v6 · express · node-telegram-bot-api · dotenv

## REPO STRUCTURE
```
vaultmind/
├── CLAUDE.md                           ← This file
├── .claude/
│   ├── agents/                         ← Specialist sub-agents (auto-delegated by Claude Code)
│   │   ├── og-integrator.md           ← 0G Compute + Storage integration
│   │   ├── hedera-integrator.md       ← HCS audit + HTS token integration
│   │   ├── payments-integrator.md     ← x402 buyer/seller integration
│   │   ├── frontend-builder.md        ← Next.js 16.2 dashboard
│   │   ├── openclaw-builder.md        ← OpenClaw agent workspaces
│   │   ├── cycle-wirer.md             ← End-to-end cycle orchestration
│   │   └── bounty-auditor.md          ← Bounty compliance checker
│   ├── rules/                          ← Path-specific rules (auto-loaded by Claude Code)
│   │   ├── og-compute.md              ← 0G SDK patterns (src/og/**)
│   │   ├── x402-payments.md           ← x402 patterns (src/payments/**)
│   │   ├── hedera.md                  ← Hedera patterns (src/hedera/**)
│   │   ├── openclaw.md               ← OpenClaw patterns (openclaw/**)
│   │   └── dashboard.md              ← Next.js 16.2 patterns (src/dashboard/**)
│   └── commands/                       ← Slash commands (/build-specialist, /test-cycle)
│       ├── build-specialist.md        ← Build a specialist with paywall + inference
│       └── test-cycle.md             ← Test full cycle end-to-end
├── package.json                        ← "type": "module", engines: { node: ">=22" }
├── package-lock.json
├── tsconfig.json                       ← strict: true
├── .env                                ← All secrets (gitignored)
├── src/
│   ├── config/
│   │   ├── hedera.ts                  ← Client.forTestnet().setOperator()
│   │   ├── og-compute.ts             ← createZGComputeNetworkBroker()
│   │   ├── og-storage.ts             ← Indexer init
│   │   └── arc.ts                     ← viem account for x402 buyer
│   ├── hedera/
│   │   ├── hcs.ts                     ← logCycle(), getHistory()
│   │   ├── hts.ts                     ← createFundToken(), mint(), burn()
│   │   └── scheduler.ts              ← Scheduled Transactions
│   ├── og/
│   │   ├── inference.ts               ← sealedInference() — core function
│   │   ├── storage.ts                 ← storeMemory(), loadMemory()
│   │   └── verify.ts                  ← TEE verification
│   ├── payments/
│   │   ├── x402-server.ts            ← Specialist paywall (seller middleware)
│   │   └── x402-client.ts            ← Main Agent payment client (buyer)
│   ├── agents/
│   │   ├── specialist-server.ts       ← 3 Express apps on :4001/:4002/:4003
│   │   ├── adversarial.ts            ← Alpha→Risk→Executor pipeline
│   │   ├── main-agent.ts             ← Full cycle orchestrator
│   │   └── prompts.ts                ← All 6 system prompts (optimized for 7B)
│   ├── telegram/
│   │   └── bot.ts                     ← /status, /why, /history, /stop, /resume
│   ├── dashboard/                     ← Next.js 16.2 App Router
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx              ← Landing
│   │   │   ├── dashboard/page.tsx    ← 3-column debate view
│   │   │   ├── history/page.tsx      ← Mirror Node cycles
│   │   │   └── invest/page.tsx       ← Deposit/withdraw
│   │   └── components/
│   └── index.ts                       ← Boot orchestrator
├── openclaw/                          ← 7 OpenClaw agent workspaces
│   ├── main-agent/
│   │   ├── SOUL.md                   ← Personality only
│   │   ├── AGENTS.md                 ← Cycle procedure steps
│   │   ├── HEARTBEAT.md              ← 5-min cycle trigger
│   │   ├── USER.md                   ← Investor preferences
│   │   └── TOOLS.md                  ← Available tools
│   ├── sentiment-agent/SOUL.md
│   ├── whale-agent/SOUL.md
│   ├── momentum-agent/SOUL.md
│   ├── alpha-agent/SOUL.md
│   ├── risk-agent/SOUL.md
│   └── executor-agent/SOUL.md
└── scripts/
    ├── setup-topic.ts                 ← Creates HCS topic → prints TOPIC_ID
    ├── setup-token.ts                 ← Creates HTS token → prints TOKEN_ID
    └── setup-og-account.ts            ← Deposits 10 0G + funds provider
```

## CODE STANDARDS
- No dead code. No `any` (only exception: `signer as any` for 0G ethers v5/v6).
- Single responsibility per file. Explicit try/catch on every SDK call.
- Async/await only. ES module imports only. No `.then()`.
- kebab-case files. camelCase functions/vars. PascalCase types/components.
- `JSON.parse()` from 0G inference ALWAYS in try/catch (7B model malforms JSON).
- No over-engineering. No factories. No DI. No wrapper abstractions around SDKs.

## .env VARIABLES
```env
# Hedera (portal.hedera.com)
OPERATOR_ID=0.0.XXXXXXX
OPERATOR_KEY=302e020100...
HCS_AUDIT_TOPIC_ID=0.0.XXXXXXX     # Output of setup-topic.ts
HTS_FUND_TOKEN_ID=0.0.XXXXXXX      # Output of setup-token.ts

# 0G (hub.0g.ai for testnet tokens)
OG_PRIVATE_KEY=0x...
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_PROVIDER_ADDRESS=0x...
OG_STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai

# x402 / Arc
AGENT_EVM_PRIVATE_KEY=0x...         # viem private key for buyer signing
SPECIALIST_WALLET_ADDRESS=0x...     # payTo address for specialists
X402_FACILITATOR_URL=https://x402.org/facilitator

# Telegram (@BotFather)
TELEGRAM_BOT_TOKEN=123456:ABC-...
TELEGRAM_CHAT_ID=your_chat_id
```

## VERIFIED SDK PATTERNS
Each domain has a dedicated rules file in `.claude/rules/` that auto-loads when working on matching paths. Key corrections from official docs:

**0G** (`.claude/rules/og-compute.md` → loaded for `src/og/**`):
- MUST call `acknowledgeProviderSigner()` before first inference
- Headers are SINGLE-USE — new headers per request
- `depositFund("10")` takes STRING
- `processResponse(provider, content, chatID)` — 3 args

**x402** (`.claude/rules/x402-payments.md` → loaded for `src/payments/**`):
- Buyer signing uses `viem/accounts` (NOT ethers)
- `wrapFetchWithPayment()` handles 402 flow automatically
- Route config: `"GET /analyze"` (method space path)

**Hedera** (`.claude/rules/hedera.md` → loaded for `src/hedera/**`):
- freeze→sign→execute for private topics (always)
- 6-second mirror node delay
- Zero Solidity for "No Solidity" bounty

**OpenClaw** (`.claude/rules/openclaw.md` → loaded for `openclaw/**`):
- 7 files: SOUL.md, IDENTITY.md, AGENTS.md, USER.md, TOOLS.md, HEARTBEAT.md, MEMORY.md
- SOUL.md = personality only. Procedures → AGENTS.md
- Heartbeat default 30m, override in openclaw.json

## ERROR → FIX
| Error | Cause | Fix |
|-------|-------|-----|
| `INVALID_TOPIC_SUBMIT_KEY` | Missing freeze/sign | `.freezeWith(client)` → `.sign(key)` → `.execute(client)` |
| 0G inference returns nothing | Underfunded | `depositFund("10")` then `transferFund(provider, "inference", 1n * 10n**18n)` |
| 0G inference auth fails | Didn't acknowledge | `broker.inference.acknowledgeProviderSigner(provider)` first |
| 0G reused headers | Headers single-use | Generate new `getRequestHeaders()` per request |
| Mirror node empty | Queried too fast | `await new Promise(r => setTimeout(r, 6000))` |
| x402 no 402 response | Wrong route format | `"GET /analyze"` not `"/analyze"` |
| x402 payment sig fails | Using ethers for signing | Use `privateKeyToAccount` from `viem/accounts` |
| TS error on signer | ethers v5/v6 mismatch | `signer as any` (0G storage only) |
| `ERR_MODULE_NOT_FOUND` | Missing module type | `"type": "module"` in package.json |
| `listService()` empty | Wrong RPC | `https://evmrpc-testnet.0g.ai` exactly |
| HTTP 429 from 0G | Rate limited | 2s delay between calls (30 req/min limit) |
| 0G JSON parse fails | 7B model malformed output | try/catch JSON.parse, retry or fallback |
| OpenClaw heartbeat too slow | Default 30 min | Set `heartbeat.every: "5m"` in openclaw.json |

## BUILD PRIORITY
| # | Task | Unlocks | $ |
|---|------|---------|---|
| 1 | 0G Sealed Inference + attestation | 0G DeFi, OpenClaw | $12K |
| 2 | 6 agent prompts (7B optimized) | Same | — |
| 3 | x402 nanopayments | Arc | $6K |
| 4 | HCS cycle logging | Hedera AI, No Solidity | $9K |
| 5 | HTS fund token + fees | Tokenization, No Solidity | $5.5K |
| 6 | Dashboard 3-column debate | All (MVP req) | — |
| 7 | Telegram bot | Hedera AI (wow) | — |
| 8 | 0G Storage memory | 0G scoring | — |
| 9 | iNFT on 0G Chain | OpenClaw | — |
| 10 | OpenClaw SOUL.md + heartbeat | OpenClaw | — |
| 11 | Scheduled Transactions | Hedera AI | — |
| 12 | Naryo listener | Naryo | $3.5K |

**P1-7: $11K · P1-10: $13.75K · All 12: $17.25K**

## TESTING FLOW
Validate each integration independently BEFORE wiring the cycle:
1. `npx ts-node scripts/setup-topic.ts` → topic ID appears → check Hashscan
2. `npx ts-node scripts/setup-og-account.ts` → broker funded → listService() returns models
3. `npx ts-node src/og/test-inference.ts` → inference response + attestation hash
4. `npx ts-node src/agents/specialist-server.ts` then `curl localhost:4001/analyze` → HTTP 402
5. Full cycle: hire → debate → execute → log → verify on Hashscan

## INVARIANTS — DECIDED. DO NOT REVISIT.
Payment: x402 on Arc · Inference: 0G Sealed · Audit: Hedera HCS · Token: HTS
Agents: OpenClaw · Memory: 0G Storage · Frontend: Next.js 16.2 · Style: Tailwind v4