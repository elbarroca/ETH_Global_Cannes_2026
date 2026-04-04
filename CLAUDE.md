
> **AlphaDawg** — Multi-agent swarm economy for provable investment alpha. Your AI agent hires specialist sub-agents via nanopayments, runs adversarial debate inside TEE enclaves, and proves every decision on-chain. Controlled via Telegram + Next.js dashboard.

## COMMANDS
```bash
npm install                           # All dependencies
npm run dev                           # Next.js 16.2 dev (Turbopack) on :3000
npm run build                         # Production build
npm run backend                       # Boot backend: heartbeat + telegram + API on :3001
npm run specialists                   # Start 3 specialist servers on :4001-4003
npm run bot                           # Start Telegram bot standalone
npm run cycle                         # Run full cycle (alias for backend)
npm run setup:topic                   # HCS audit topic → saves TOPIC_ID to .env
npm run setup:token                   # HTS fund token → saves TOKEN_ID to .env
npm run setup:og                      # Fund 0G broker (10 0G deposit)
npm run setup:circle                  # Circle entity secret + wallet set
npm run migrate                       # Supabase DDL — script may need recreation
npx prisma db push                    # Alternative: sync schema via Prisma
npm run validate                      # 45-test validation suite
npm run prisma:generate               # Generate Prisma typed client
npm run prisma:push                   # Sync Prisma schema to Supabase
npm run prisma:studio                 # Visual DB browser
```

## WHAT THIS IS
**IS:** Telegram + dashboard app powering a multi-agent swarm hiring economy. Personal AI agent hires specialist sub-agents via $0.001 micropayments, debates adversarially inside TEE enclaves, logs every decision to immutable audit trail.

**IS NOT:** A hedge fund. A black-box bot. A portfolio manager.

Core product = **agent hiring economy**: autonomous agents discover, pay, and delegate tasks to specialists. Every interaction economically incentivized and cryptographically verified.

## STACK
- **Runtime:** Node.js >= 22 · TypeScript strict · ES modules (`"type": "module"`) · npm
- **Frontend:** Next.js 16.2 (App Router, Turbopack, React 19) · Tailwind CSS v4
- **Database:** Supabase PostgreSQL · `postgres` ^3.4.8 (user store) · `@prisma/client` ^6.19 (marketplace, actions)
- **Wallets:** `@circle-fin/developer-controlled-wallets` (MPC custody) · BIP-44 HD via ethers (hot wallet)
- **Hedera:** `@hashgraph/sdk` ^2.69.0
- **0G Compute:** `@0glabs/0g-serving-broker` · `@types/crypto-js@4.2.2` · `crypto-js@4.2.0`
- **0G Storage:** `@0gfoundation/0g-ts-sdk` ^1.2.1 (NOT `@0glabs`)
- **0G Chain:** ERC-7857 iNFT via Hardhat 2 · `@openzeppelin/contracts` ^5.6.1
- **Payments (seller):** `@x402/express` · `@x402/evm` · `@x402/core`
- **Payments (buyer):** `@x402/fetch` · `@x402/core` · `@x402/evm` · `viem`
- **Wallet Connect:** `@dynamic-labs/sdk-react-core` · `wagmi` · `@rainbow-me/rainbowkit`
- **Other:** ethers v6 · express · node-telegram-bot-api · dotenv

## REPO STRUCTURE
```
alphadawg/
├── CLAUDE.md                           ← This file
├── CONTEXT.MD                          ← Full engineering bible (V2)
├── DESING.MD                           ← AlphaDawg design system + UI spec
├── .claude/
│   ├── agents/                         ← Claude Code sub-agents
│   ├── rules/                          ← Path-specific rules (auto-loaded)
│   │   ├── og-compute.md              ← 0G SDK patterns (src/og/**)
│   │   ├── x402-payments.md           ← x402 patterns (src/payments/**)
│   │   ├── hedera.md                  ← Hedera patterns (src/hedera/**)
│   │   ├── openclaw.md               ← OpenClaw patterns (openclaw/**)
│   │   └── dashboard.md              ← Next.js patterns (app/**)
│   └── commands/                       ← Slash commands
├── package.json                        ← "type": "module", engines: { node: ">=22" }
├── tsconfig.json                       ← strict: true, ES2022, bundler resolution
├── hardhat.config.cjs                  ← Hardhat 2 for 0G Chain contracts
├── prisma/schema.prisma               ← User, Cycle, AgentAction, MarketplaceAgent
├── .env                                ← All secrets (gitignored)
├── contracts/
│   ├── VaultMindAgent.sol             ← ERC-7857 iNFT (0G Chain, NOT Hedera)
│   └── MockOracle.sol                 ← TEE/ZKP oracle stub
├── src/
│   ├── index.ts                       ← Boot: validateEnv → loadStore → startBot → startApi → heartbeat
│   ├── types/index.ts                 ← UserRecord, CycleResult, CompactCycleRecord, etc.
│   ├── config/
│   │   ├── hedera.ts                  ← Lazy Hedera client + operator key
│   │   ├── og-compute.ts             ← Lazy 0G broker + wallet
│   │   ├── og-storage.ts             ← 0G Flow contract + indexer URL
│   │   ├── arc.ts                     ← getUserPaymentFetch(index) — per-user x402
│   │   ├── wallets.ts                 ← BIP-44 HD derivation from AGENT_MNEMONIC
│   │   ├── database.ts               ← postgres.js singleton (Supabase)
│   │   └── prisma.ts                  ← Prisma client singleton
│   ├── store/
│   │   ├── user-store.ts              ← Supabase CRUD with atomic JSONB merge
│   │   ├── action-logger.ts           ← logAction(), logCycleRecord() via Prisma
│   │   ├── crypto.ts                  ← AES-256-CBC encrypt/decrypt
│   │   ├── proxy-wallet.ts            ← Wallet helpers (Circle MPC is primary path)
│   │   └── link-codes.ts             ← 6-char Telegram link codes (10-min TTL)
│   ├── hedera/
│   │   ├── hcs.ts                     ← logCycle(), getHistory(), getHistoryForUser()
│   │   ├── hts.ts                     ← mintShares(), burnShares(), grantKyc(), getTokenInfo()
│   │   └── scheduler.ts              ← scheduleNextHeartbeat() — Scheduled Transactions
│   ├── og/
│   │   ├── inference.ts               ← sealedInference(), listProviders()
│   │   ├── storage.ts                 ← storeMemory(), loadMemory()
│   │   └── inft.ts                    ← mintAgentNFT(), updateAgentMetadata(), getAgentInfo()
│   ├── payments/
│   │   ├── x402-server.ts            ← Specialist paywall (seller middleware)
│   │   ├── x402-client.ts            ← createPaymentFetch() — viem signing
│   │   └── circle-wallet.ts          ← createProxyWallet(), agentTransfer(), executeSwap()
│   ├── marketplace/
│   │   ├── registry.ts                ← Specialist discovery, hiring, Prisma-backed
│   │   └── reputation.ts             ← ELO scoring (K=32, bounds 0-1000)
│   ├── agents/
│   │   ├── main-agent.ts             ← runCycle() — full pipeline orchestrator
│   │   ├── adversarial.ts            ← Alpha→Risk→Executor with retry + HOLD fallback
│   │   ├── specialist-server.ts       ← 3 Express apps on :4001/:4002/:4003
│   │   ├── heartbeat.ts              ← 5-min loop for active users
│   │   ├── prompts.ts                ← 6 system prompts (7B optimized) + safeJsonParse
│   │   └── data/
│   │       ├── sentiment-data.ts     ← CoinGecko Fear & Greed + ETH price
│   │       ├── whale-data.ts         ← Gas + top 5 volume tracking
│   │       ├── momentum-data.ts      ← RSI, MACD, support/resistance
│   │       └── cached-fetch.ts       ← Response caching for market APIs
│   ├── telegram/
│   │   └── bot.ts                     ← /start /status /why /history /run /stop /resume + notifyUser
│   └── api/
│       ├── server.ts                  ← Express on :3001, CORS, error handler
│       └── routes/
│           ├── onboard.ts            ← POST /api/onboard + /configure + GET /user/:wallet + /stats
│           ├── cycle.ts              ← GET /cycle/latest/:userId + /history/:userId + POST /run/:userId
│           ├── fund.ts               ← POST /deposit + /withdraw + GET /fund/info
│           └── actions.ts            ← GET /actions/:userId + /actions/cycle/:cycleId
├── app/                               ← Next.js 16.2 App Router (frontend)
│   ├── layout.tsx                     ← Root layout with providers
│   ├── page.tsx                       ← Landing (real HCS + HTS stats)
│   ├── globals.css                    ← AlphaDawg dark theme (blood/gold/void)
│   ├── dashboard/page.tsx             ← 3-column debate view, 10s polling
│   ├── history/page.tsx               ← Expandable hunt log
│   ├── deposit/page.tsx               ← Deposit/withdraw USDC
│   ├── marketplace/page.tsx           ← Specialist pack + community agents
│   ├── verify/page.tsx                ← TEE attestation verification
│   ├── portfolio/page.tsx             ← Fund balance + NAV
│   └── api/                           ← Next.js API routes (proxy to backend or mirror node)
│       ├── cycle/latest/route.ts
│       ├── cycle/history/route.ts
│       └── fund/info/route.ts
├── components/                        ← Shared React components
│   ├── ui/card.tsx, ui/badge.tsx
│   ├── cycle-view.tsx, debate-column.tsx, nav.tsx
│   ├── proof-column.tsx, specialist-card.tsx, wallet-connect.tsx
├── lib/                               ← Frontend utilities
│   ├── api.ts                         ← apiFetch<T>(), onboard, cycle, fund API calls
│   ├── types.ts                       ← Frontend-specific types
│   ├── cycle-mapper.ts               ← HCS CompactCycleRecord → frontend Cycle
│   └── mock-data.ts                  ← Development mock data
├── contexts/
│   ├── user-context.tsx               ← UserProvider + useUser() hook
│   └── wagmi-provider.tsx             ← Dynamic Labs + wagmi config
├── hooks/
│   └── use-vaultmind.ts              ← Data fetching hooks
├── openclaw/                          ← 7 OpenClaw agent workspaces
│   ├── main-agent/ (SOUL, IDENTITY, AGENTS, USER, TOOLS, HEARTBEAT, MEMORY)
│   ├── sentiment-agent/ (SOUL, IDENTITY)
│   ├── whale-agent/ (SOUL, IDENTITY)
│   ├── momentum-agent/ (SOUL, IDENTITY)
│   ├── alpha-agent/ (SOUL, IDENTITY)
│   ├── risk-agent/ (SOUL, IDENTITY)
│   └── executor-agent/ (SOUL, IDENTITY)
├── scripts/
│   ├── setup-topic.ts                 ← Creates HCS topic
│   ├── setup-token.ts                 ← Creates HTS token
│   ├── setup-og-account.ts            ← Funds 0G broker
│   ├── setup-circle.ts               ← Circle entity secret + wallet set
│   ├── deploy-inft.ts                ← Deploy iNFT to 0G Chain
│   ├── test-inft.ts                  ← 25-test iNFT E2E
│   ├── test-phase4.ts               ← HTS + Storage + Scheduler tests
│   ├── validate-all.ts               ← 45-test validation suite
│   ├── validate-real-data.ts         ← Market data feed tests
│   └── validate-agent-reasoning.ts   ← Adversarial debate tests
└── progress/                          ← Sprint progress docs
    ├── PROGRESS.MD                    ← Sprint 1-3 report
    ├── SPRINT4-CIRCLE-SUPABASE.MD    ← Sprint 4 report
    └── PHASE4-INFT.MD               ← iNFT deployment report
```

## CODE STANDARDS
- No dead code. No `any` (only exception: `signer as any` for 0G ethers v5/v6).
- Single responsibility per file. Explicit try/catch on every SDK call.
- Async/await only. ES module imports only. No `.then()`.
- kebab-case files. camelCase functions/vars. PascalCase types/components.
- `JSON.parse()` from 0G inference ALWAYS in try/catch (7B model malforms JSON).
- No over-engineering. No factories. No DI. No wrapper abstractions around SDKs.
- All store functions are async (Supabase). Always `await` store calls.

## .env VARIABLES
```env
# Hedera (portal.hedera.com)
OPERATOR_ID=0.0.XXXXXXX
OPERATOR_KEY=302e020100...
HCS_AUDIT_TOPIC_ID=0.0.XXXXXXX     # Output of setup-topic.ts
HTS_FUND_TOKEN_ID=0.0.XXXXXXX      # Output of setup-token.ts

# 0G Compute (hub.0g.ai for testnet tokens)
OG_PRIVATE_KEY=0x...                 # Must have 0x prefix
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_PROVIDER_ADDRESS=0x...
OG_STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
OG_FLOW_CONTRACT=0x...               # Optional — has sensible default

# 0G Chain / iNFT
INFT_CONTRACT_ADDRESS=0x73e3...      # ERC-7857 on 0G Chain (optional — skips if missing)

# Wallets
AGENT_MNEMONIC="word1 word2 ... word12"  # BIP-44 HD seed for hot wallets
SERVER_ENCRYPTION_KEY=...             # 32-byte hex for AES-256-CBC

# Supabase
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://...pooler.supabase.com:5432/postgres

# Circle MPC (console.circle.com)
CIRCLE_API_KEY=TEST_API_KEY:...
CIRCLE_ENTITY_SECRET=...
CIRCLE_WALLET_SET_ID=...

# x402 / Arc
X402_FACILITATOR_URL=https://x402.org/facilitator
USDC_ARC_ADDRESS=0x...                # USDC on Arc (has default in code)
USDC_BASE_SEPOLIA_ADDRESS=0x036C...   # USDC on Base Sepolia (has default)

# Telegram (@BotFather)
TELEGRAM_BOT_TOKEN=123456:ABC-...    # Optional — bot disabled if missing
# NOTE: No TELEGRAM_CHAT_ID — chat IDs are per-user in Supabase

# Market Data (optional — uses public endpoints if missing)
COINGECKO_API_URL=https://api.coingecko.com/api/v3
COINGECKO_API_KEY=...                 # Optional — higher rate limits
ETHERSCAN_API_URL=https://api.etherscan.io/api
ETHERSCAN_API_KEY=...                 # Optional — higher rate limits
FNG_API_URL=https://api.alternative.me/fng

# Server
SERVER_PORT=3001                      # Express API port (default 3001)

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001    # Backend API base
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID=...
```

## VERIFIED SDK PATTERNS
Each domain has a dedicated rules file in `.claude/rules/` that auto-loads when working on matching paths.

**0G Compute** (`.claude/rules/og-compute.md` → loaded for `src/og/**`):
- `depositFund(10)` takes NUMBER (not string)
- `getRequestHeaders(provider)` takes 1 arg (2nd is @deprecated)
- Headers are SINGLE-USE — new headers per request
- `processResponse(provider, chatID, usageJSON)` — 3rd arg is `JSON.stringify(data.usage)` for fee caching
- `acknowledgeProviderSigner()` exists but is NOT required

**0G Storage** (`@0gfoundation/0g-ts-sdk` — NOT `@0glabs`):
- `import { Indexer } from '@0gfoundation/0g-ts-sdk'`
- `storeMemory()` / `loadMemory()` in `src/og/storage.ts`

**x402** (`.claude/rules/x402-payments.md` → loaded for `src/payments/**`):
- Buyer signing uses `viem/accounts` (NOT ethers)
- `wrapFetchWithPayment()` handles 402 flow automatically
- Route config: `"GET /analyze"` (method space path)

**Hedera** (`.claude/rules/hedera.md` → loaded for `src/hedera/**`):
- freeze→sign→execute for private topics (always)
- 6-second mirror node delay
- Zero Solidity for "No Solidity" bounty (Solidity is 0G Chain only)

**Circle** (`src/payments/circle-wallet.ts`):
- `createProxyWallet(userId)` — Circle MPC custody wallet
- `agentTransfer(walletId, to, amount)` — USDC transfer
- `getProxyBalance(walletId)` — token balances

**OpenClaw** (`.claude/rules/openclaw.md` → loaded for `openclaw/**`):
- 7 files: SOUL.md, IDENTITY.md, AGENTS.md, USER.md, TOOLS.md, HEARTBEAT.md, MEMORY.md
- SOUL.md = personality only. Procedures → AGENTS.md
- Heartbeat default 30m, override in openclaw.json

## ERROR → FIX
| Error | Cause | Fix |
|-------|-------|-----|
| `INVALID_TOPIC_SUBMIT_KEY` | Missing freeze/sign | `.freezeWith(client)` → `.sign(key)` → `.execute(client)` |
| 0G inference returns nothing | Underfunded | `broker.inference.depositFund(10)` |
| 0G reused headers | Headers single-use | Generate new `getRequestHeaders(provider)` per request |
| Mirror node empty | Queried too fast | `await new Promise(r => setTimeout(r, 6000))` |
| x402 no 402 response | Wrong route format | `"GET /analyze"` not `"/analyze"` |
| x402 payment sig fails | Using ethers for signing | Use `privateKeyToAccount` from `viem/accounts` |
| TS error on signer | ethers v5/v6 mismatch | `signer as any` (0G storage only) |
| `ERR_MODULE_NOT_FOUND` | Missing module type | `"type": "module"` in package.json |
| `listService()` empty | Wrong RPC | `https://evmrpc-testnet.0g.ai` exactly |
| HTTP 429 from 0G | Rate limited | 2s delay between calls (30 req/min limit) |
| 0G JSON parse fails | 7B model malformed | try/catch JSON.parse, retry or fallback |
| OpenClaw heartbeat too slow | Default 30 min | Set `heartbeat.every: "5m"` in openclaw.json |
| Circle wallet creation fails | Missing API key | Set CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET |
| `DIRECT_URL not set` | Missing Supabase config | Set DIRECT_URL in .env (port 5432, not 6543) |
| Prisma Client not initialized | Missing generate | Run `npm run prisma:generate` |
| iNFT mint skipped | Missing contract addr | Set INFT_CONTRACT_ADDRESS in .env (non-fatal) |
| 0G Storage upload fails | Indexer down | Check OG_STORAGE_INDEXER URL, retry later |
| `0x` prefix missing on OG key | Key format | OG_PRIVATE_KEY must start with `0x` |
| `hot_wallet_index_seq` missing | DB not migrated | Run `npm run migrate` |

## BUILD STATUS
| # | Task | Status | Bounty |
|---|------|--------|--------|
| 1 | 0G Sealed Inference + attestation | DONE | 0G DeFi $5K |
| 2 | 6 agent prompts (7B optimized) | DONE | — |
| 3 | x402 nanopayments | DONE | Arc $6K |
| 4 | HCS cycle logging | DONE | Hedera AI $5K |
| 5 | HTS fund token + fees | DONE | Tokenization $2.5K |
| 6 | Dashboard 3-column debate | DONE | — |
| 7 | Telegram bot (7 commands) | DONE | — |
| 8 | 0G Storage memory | DONE | 0G scoring |
| 9 | iNFT on 0G Chain (ERC-7857) | DONE | OpenClaw |
| 10 | OpenClaw SOUL.md + heartbeat | DONE | OpenClaw $7K |
| 11 | Scheduled Transactions | DONE | Hedera AI |
| 12 | Circle MPC wallets | DONE | — |
| 13 | Marketplace + reputation | DONE | — |
| 14 | Real market data feeds | DONE | — |
| 15 | Supabase migration | DONE | — |
| 16 | Naryo listener | NOT STARTED | Naryo $3.5K |

## TESTING FLOW
```bash
npm run validate                      # 45-test suite (all layers)
npm run setup:circle                  # Circle wallet E2E
npx tsx scripts/test-inft.ts          # 25-test iNFT E2E
npx tsx scripts/test-phase4.ts --write # HTS + Storage + Scheduler
npx tsx scripts/validate-real-data.ts # Market data feeds
npm run backend                       # Boot full backend → test via curl
npm run dev                           # Dashboard on :3000
npm run build                         # Verify production build
```

## LIVE ON-CHAIN ASSETS
| Asset | ID / Address | Network |
|-------|-------------|---------|
| VaultMindAgent (iNFT) | `0x73e3016D0D3Bf2985c55860cd2A51FF017c2c874` | 0G Chain (16602) |
| MockOracle | `0x4E8B9a9331CD35E43405a503E34b1fff945a580e` | 0G Chain (16602) |
| HTS Fund Token (VMF) | `0.0.8498202` | Hedera testnet |
| HCS Audit Topic | `0.0.8497439` | Hedera testnet |

## INVARIANTS — DECIDED. DO NOT REVISIT.
Payment: x402 on Arc · Inference: 0G Sealed · Audit: Hedera HCS · Token: HTS
Agents: OpenClaw · Memory: 0G Storage · Frontend: Next.js 16.2 · Style: Tailwind v4
Database: Supabase PostgreSQL · Wallets: Circle MPC (proxy) + BIP-44 HD (hot)
iNFT: ERC-7857 on 0G Chain (NOT Hedera) · Contracts: Hardhat 2 + Solidity 0.8.24 (0G Chain only — Hedera uses native SDK, zero Solidity)
