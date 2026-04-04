# VAULTMIND — UNIFIED ENGINEERING BIBLE (V2)

> **ETHGlobal Cannes 2026 · April 3-5 · 7 bounties · $17,250 max payout**
> Single source of truth. Reflects actual codebase after Sprint 4 (Supabase + Circle). Every SDK pattern verified.

---

## TABLE OF CONTENTS

1. [What VaultMind Is](#1-what-vaultmind-is)
2. [Why It Wins](#2-why-it-wins)
3. [Architecture — Three Chains, Three Roles](#3-architecture)
4. [The Cycle — Every 5 Minutes](#4-the-cycle)
5. [All 7 Bounties](#5-bounties)
6. [Tech Stack — Exact Versions](#6-tech-stack)
7. [Repo Structure (Current V2)](#7-repo-structure)
8. [Environment Variables](#8-env)
9. [Database Layer — Supabase + Prisma](#9-database)
10. [Dual Wallet Architecture](#10-wallets)
11. [Hedera SDK Reference](#11-hedera)
12. [0G Compute SDK Reference](#12-og-compute)
13. [0G Storage — Agent Memory](#13-og-storage)
14. [x402 Nanopayments Reference](#14-x402)
15. [Real Specialist Agents (Live Data)](#15-specialists)
16. [All 6 Agent Prompts (V2 — Data-Aware)](#16-prompts)
17. [Marketplace + Reputation System](#17-marketplace)
18. [Multi-User Dynamic Architecture](#18-multi-user)
19. [OpenClaw Agent Framework](#19-openclaw)
20. [Error → Fix Map](#20-errors)
21. [Build Priority](#21-build-priority)
22. [Validation Checklist](#22-validation)
23. [Demo Script — 3 Minutes](#23-demo)
24. [Decisions Made — Do Not Revisit](#24-decisions)
25. [Code Standards](#25-code-standards)
26. [Official Sources](#26-sources)

---

## 1. WHAT VAULTMIND IS

### 30-Second Pitch
You deposit USDC. A personal AI agent hires specialist sub-agents from an open marketplace, paying each $0.001 via gas-free nanopayments. Those specialists feed intelligence into an adversarial debate: Alpha argues FOR a trade, Risk argues AGAINST, Executor makes the final call. Every agent runs inside tamper-proof TEE enclaves producing cryptographic proofs. Every debate, payment, and decision is permanently logged to a public ledger. One click verifies everything. Your agent reports to you on Telegram.

**Other AI funds are black boxes. VaultMind is a glass box with mathematical proof.**

### What VaultMind IS
- A Telegram + dashboard app powering a multi-agent swarm hiring economy
- **Multi-user from day one** — each user connects wallet → Telegram → deposits → gets their own agent cycle
- Autonomous AI agents that discover, negotiate, pay, and delegate to specialist sub-agents
- An open specialist marketplace with **reputation scoring** — good agents rise, bad agents sink
- Every interaction economically incentivized via real micropayments
- Every inference cryptographically verified via TEE attestation
- Every decision immutably logged with one-click proof verification
- **Persistent state via Supabase** — all user data, cycles, actions, marketplace agents stored in PostgreSQL via Prisma

### What VaultMind IS NOT
- Not a hedge fund
- Not a black-box trading bot
- Not a portfolio manager
- Not a custodial service

### The Core Innovation
The **agent hiring economy**. Not "AI does trading." The product is the mechanism: autonomous agents hiring other agents, paying them real money, debating adversarially, and proving every step. The trading is the use case. The hiring economy is the platform.

**Second innovation: marketplace reputation.** Specialists compete on accuracy. Every cycle, reputation scores update based on whether the specialist's signal matched the actual market outcome. The adversarial layer weights high-reputation agents heavily and treats low-reputation agents as noise. Bad agents get priced out. Good agents earn more hires. The marketplace self-corrects.

**Third innovation: dual wallet architecture.** Each user gets a Circle MPC custody wallet (for deposits/withdrawals) and an HD-derived hot wallet (for x402 micropayment signing). Agent never touches user private keys. Funds are isolated per user but managed by one orchestrator.

---

## 2. WHY IT WINS

| Sponsor | They Asked For | We Give Them |
|---------|---------------|--------------|
| **Arc** | Autonomous AI agents transacting via nanopayments | Main Agent hires from open marketplace with reputation scoring, $0.001 each, zero gas, zero human intervention, N concurrent users |
| **Hedera** | AI agents moving value autonomously | HTS fund token + HCS audit trail + Scheduled Tx + HCS-14 identity + Mirror Node — ALL via SDK, zero Solidity, dynamic multi-user onboarding |
| **0G** | AI-native DeFi, autonomous + verifiable | 6-agent swarm on Sealed Inference + Storage memory (incl. reputation history) + Chain settlement |
| **0G (OpenClaw)** | OpenClaw + 0G infrastructure | 7 OpenClaw agents with SOUL.md, 0G Compute/Storage/Chain/iNFTs |
| **Naryo** | Multichain event listener | Hedera EVM contracts + Naryo + Mirror Node + Hashscan |

**The unfair advantage:** One product hits 7 bounties simultaneously because the architecture was designed to maximize overlap. Every chain does exactly one thing. Multi-user dynamic architecture means it's not a toy demo — it's a product.

---

## 3. ARCHITECTURE — THREE CHAINS, THREE ROLES

```
┌──────────────────────────────────────────────────────────┐
│  USERS (N concurrent)                                    │
│  Dashboard: Connect Wallet → Connect Telegram → Deposit  │
│  Each user gets: Circle wallet + HD wallet + agent cycle │
└────────┬─────────────────────────────────────┬───────────┘
         │ USDC → Circle custody wallet        │ Telegram (per chat ID)
         │ Agent tops up HD hot wallet          │
         ▼                                     │
┌──────────────────────────────────────────────┼───────────┐
│  0G CHAIN — AI COMPUTE LAYER                 │           │
│                                              │           │
│  ┌──────────────────┐   Hires    ┌───────────┴────────┐  │
│  │ User's Agent     │ ────────→  │ Specialist         │  │
│  │ (per-user cycle) │           │ Marketplace        │  │
│  │ Sealed Inference  │           │ ┌── Reputation ──┐ │  │
│  └────────┬─────────┘           │ │ Good agents ↑  │ │  │
│           │                      │ │ Bad agents ↓   │ │  │
│  ┌────────▼─────────┐           │ └────────────────┘ │  │
│  │ Adversarial      │           │ Sealed Inference   │  │
│  │ Layer            │           └────────────────────┘  │
│  │ (weights by rep) │   ┌────────────────┐              │
│  └────────┬─────────┘──→│ 0G Storage     │              │
│           │              │ Agent Memory   │              │
└───────────┼──────────────────────────────────────────────┘
            │ Decision + payments
            ▼
┌──────────────────────────────────────────────────────────┐
│  HEDERA TESTNET — PAYMENTS + AUDIT + TOKENS              │
│                                                          │
│  x402 Payments · HCS Audit Trail · HTS Fund Token        │
│  Scheduled Txns · HCS-14 Agent Identity · Mirror Node    │
└──────────────────────────────────────────────────────────┘

STATE MANAGEMENT:
┌──────────────────────────────────────────────────────────┐
│  SUPABASE (PostgreSQL via Prisma)                        │
│  Users · Cycles · AgentActions · MarketplaceAgents       │
│  Persistent across restarts. Relational queries.         │
└──────────────────────────────────────────────────────────┘
```

### Chain Roles

**Arc (Circle) — THE MONEY LAYER**
Everything involving USDC: deposits, withdrawals, $0.001 specialist payments. Circle Nanopayments bundles thousands of tiny off-chain payments into batched on-chain settlement. Circle covers the gas. Only way a $0.001 payment makes economic sense.

What breaks without it: No agent marketplace. No specialist hiring. No economic coordination. The swarm economy stops.

**0G — THE BRAIN LAYER**
Every AI inference call (all 6 agents per cycle) runs on 0G Compute inside Sealed Inference (TEE enclaves). Model processes prompts inside hardware isolation. Response comes back with cryptographic signature proving no tampering. Agent memory lives on 0G Storage. Agent identities are iNFTs (ERC-7857) on 0G Chain.

What breaks without it: No verifiable AI. Without sealed inference, any agent could be lying. The "glass box" narrative collapses. 0G judges specifically look for TEE attestation depth.

**Hedera — THE TRUTH LAYER**
Every cycle produces one atomic HCS message: all specialist analyses (with attestation hashes), all adversarial arguments (with attestation hashes), all payment IDs (from Arc), final trade decision. Message gets consensus timestamp + sequence number. Immutable. Anyone queries it from mirror node or verifies on Hashscan with one link.

Fund share tokens (HTS) represent investor positions. Custom fee schedules handle 1% management fee. Scheduled Transactions auto-trigger cycles. HCS-14 gives every agent a Universal Agent ID.

What breaks without it: No audit trail. No proof any cycle happened. No fund token. No compliance.

---

## 4. THE CYCLE — EVERY 5 MINUTES

```
TRIGGER (Heartbeat / Scheduled Transaction)
    │
    ▼
STEP 1: HIRE SPECIALISTS [Arc + x402]
    │  Main Agent calls 3 specialist HTTP endpoints
    │  Each returns 402 → Agent signs EIP-3009 via HD hot wallet → Retries with payment
    │  Each specialist fetches REAL market data then runs 0G Sealed Inference
    │  Returns: { analysis, attestationHash, paymentId }
    │  Cost: $0.001 × 3 = $0.003 total
    │
    ▼
STEP 2: ADVERSARIAL DEBATE [0G Compute]
    │  Alpha reads all 3 specialist reports (with reputation scores)
    │    → "All bullish. BUY 20% ETH." + TEE attestation
    │  Risk reads specialists + Alpha's argument
    │    → "Funding rates elevated. MAX 10%." + TEE attestation
    │  Executor reads Alpha + Risk
    │    → "BUY 12% ETH. Stop-loss -4%." + TEE attestation
    │
    ▼
STEP 3: EXECUTE TRADE
    │  Parse Executor's JSON decision
    │  Execute position change
    │
    ▼
STEP 4: LOG TO HEDERA HCS [Hedera]
    │  Pack everything into one JSON message (~400 bytes):
    │    - 3 specialist attestation hashes + payment IDs
    │    - 3 adversarial attestation hashes + arguments
    │    - Trade decision + tx hash + NAV update
    │  Submit: freeze→sign→execute
    │  Get sequence number + Hashscan URL
    │
    ▼
STEP 5: STORE MEMORY [0G Storage]
    │  Save cycle results to 0G Storage
    │
    ▼
STEP 6: SAVE TO DATABASE [Supabase via Prisma]
    │  Full cycle record + all agent actions
    │
    ▼
STEP 7: NOTIFY USER [Telegram]
    │  Send summary with proof link + inline buttons
    │
    ▼
STEP 8: SCHEDULE NEXT [Hedera Scheduled Tx]
    │  Queue next cycle trigger in 5 minutes
    │
    ▼
DONE — wait for next trigger
```

**Per cycle:** 6 inference calls + 3 nanopayments + 1 HCS message + 1 storage write + 1 Prisma write + 1 Telegram message.

### Compact HCS Record Format (~400 bytes)

```json
{
  "c": 48,
  "t": "2026-04-03T14:32:07Z",
  "s": [
    {"n":"sent","a":"0x7f2a","p":"arc_001","$":"0.001"},
    {"n":"whale","a":"0xe41b","p":"arc_002","$":"0.001"},
    {"n":"mom","a":"0x3c8f","p":"arc_003","$":"0.001"}
  ],
  "adv": {
    "al": {"d":"BUY 20% ETH","a":"0x1234"},
    "ri": {"d":"MAX 10%","a":"0x5678"},
    "ex": {"d":"BUY 12% ETH SL-4%","a":"0x9abc"}
  },
  "tr": {"a":"BUY 12% ETH","sl":"-4%","tx":"0xdef0"},
  "nav": "512.34"
}
```

Fields: `c` = cycle number, `t` = timestamp, `s` = specialists (name, attestation, payment, cost), `adv` = adversarial (alpha/risk/executor with decision + attestation), `tr` = trade (action, stop-loss, tx hash), `nav` = net asset value.

---

## 5. ALL 7 BOUNTIES

### 5.1 — Arc: Best Agentic Economy with Nanopayments ($6,000)
**1st: $4,000 · 2nd: $2,000**

Judges want: Autonomous AI agents transacting via nanopayments on Arc. Gas-free micropayments. Agent-to-agent commerce.

We deliver: Main Agent autonomously hires 3 specialists from open marketplace, $0.001 each via x402. Gas-free. No human intervention. Marketplace with reputation.

Required: MVP + frontend + backend + architecture diagram + demo video + GitHub repo.

Stack: x402 buyer (`@x402/fetch` + `@x402/core` + `@x402/evm` + `viem`) → x402 seller (`@x402/express` + `@x402/evm` + `@x402/core`).

### 5.2 — Hedera: AI & Agentic Payments ($6,000)
**Up to 2 teams × $3,000**

Judges want: AI agents moving value autonomously on Hedera. ≥1 payment/token op on testnet.

We deliver: HTS fund token + HCS audit trail + Scheduled Tx + HCS-14 identity + Mirror Node. ALL via `@hashgraph/sdk`.

Bonus points we hit: HCS-14 identity, Scheduled Tx, HCS audit trails, custom fee schedules, x402.

### 5.3 — 0G: Best DeFi App ($6,000)
**1st: $3,000 · 2nd: $2,000 · 3rd: $1,000**

Judges want: AI-native DeFi. Autonomous, verifiable, economically self-sustaining. Full stack: Chain + Storage + Compute.

We deliver: 6-agent DeFi swarm on Compute with Sealed Inference, sharing memory on Storage, settling on Chain.

Required: Contract addresses + GitHub + ≤3 min demo + live link + explain SDKs used.

### 5.4 — 0G: Best OpenClaw Agent ($6,000)
**1st: $3,000 · 2nd: $2,000 · 3rd: $1,000**

Judges want: OpenClaw + 0G Compute/Storage/Chain/iNFTs (ERC-7857).

We deliver: 7 OpenClaw agents with SOUL.md, 0G Compute inference, 0G Storage memory, 0G Chain iNFTs.

### 5.5 — Hedera: No Solidity ($3,000)
**Up to 3 teams × $1,000**

Judges want: Hedera SDK only. Zero Solidity. ≥2 native services.

We deliver: 4 services (HTS + HCS + Scheduled Tx + Mirror Node), zero Solidity.

**CRITICAL:** Every Hedera op must use SDK transactions, not Solidity. HTS token = `TokenCreateTransaction`, not ERC-20.

### 5.6 — Hedera: Tokenization ($2,500)
**Up to 2 teams × $1,250**

Judges want: HTS tokenization with compliance/lifecycle management.

We deliver: Fund share token (VMFS), 1% custom fractional fee, KYC grants, freeze, mint on deposit / burn on withdraw.

### 5.7 — Naryo Challenge ($3,500)
**1st: $2,000 · 2nd: $750 · 3rd: $750**

Judges want: Naryo multichain event listener. ≥1 DLT.

**⚠️ CONFLICT:** Requires Solidity on Hedera EVM → conflicts with "No Solidity" bounty. Solution: separate deployment.

### Prize Math

| Scenario | Total |
|----------|-------|
| **Minimum (P1-7)** | **$11,000** |
| **Expected (P1-10)** | **$13,750** |
| **Best case (all 12)** | **$17,250** |

---

## 6. TECH STACK — EXACT VERSIONS

| Layer | Package | Version | Why |
|-------|---------|---------|-----|
| Runtime | Node.js | >= 22 | 0G requirement |
| Language | TypeScript | strict mode | No `any` except `signer as any` for 0G |
| Modules | ES modules | `"type": "module"` | Required by Hedera SDK |
| Frontend | Next.js | 16.2 | App Router, Turbopack, React 19, Server Components |
| Styling | Tailwind CSS | v4 | Utility-first, no custom CSS |
| Database | Supabase (PostgreSQL) | — | Persistent state |
| ORM | Prisma | latest | Typed queries, migrations |
| Hedera | `@hashgraph/sdk` | ^2.69.0 | Also `@hiero-ledger/sdk` compatible |
| 0G Compute | `@0glabs/0g-serving-broker` | latest | + `@types/crypto-js@4.2.2` + `crypto-js@4.2.0` |
| 0G Storage | `@0glabs/0g-ts-sdk` | latest | Upload/download |
| Payments (seller) | `@x402/express` + `@x402/evm` + `@x402/core` | v2+ | NOT old unscoped `x402-express` |
| Payments (buyer) | `@x402/fetch` + `@x402/core` + `@x402/evm` + `viem` | latest | viem for signing, NOT ethers |
| Custody | Circle MPC SDK | latest | Per-user custody wallets |
| Ethereum | ethers | v6 | Import paths differ from v5 |
| Server | express | latest | Specialist HTTP endpoints + API |
| Telegram | node-telegram-bot-api | latest | Bot interface |
| Config | dotenv | latest | Environment variables |

### Install Command
```bash
npm install @hashgraph/sdk \
  @0glabs/0g-serving-broker @0glabs/0g-ts-sdk @types/crypto-js@4.2.2 crypto-js@4.2.0 \
  @x402/express @x402/evm @x402/core @x402/fetch viem \
  ethers express dotenv node-telegram-bot-api next react react-dom tailwindcss \
  @prisma/client

npm install -D typescript ts-node @types/express @types/node prisma
```

### package.json Requirements
```json
{
  "type": "module",
  "engines": { "node": ">=22.0.0" }
}
```

---

## 7. REPO STRUCTURE (Current V2)

```
vaultmind/
├── prisma/
│   └── schema.prisma              ← Prisma schema (User, Cycle, AgentAction, MarketplaceAgent)
├── src/
│   ├── config/
│   │   ├── hedera.ts              ← Client.forTestnet().setOperator()
│   │   ├── og-compute.ts          ← createZGComputeNetworkBroker()
│   │   ├── og-storage.ts          ← getFlowContract()
│   │   ├── arc.ts                 ← getUserPaymentFetch(index) — per-user HD hot wallet
│   │   ├── wallets.ts             ← deriveUserAccount(index) — HD from master seed
│   │   └── prisma.ts              ← PrismaClient singleton
│   ├── store/
│   │   ├── user-store.ts          ← Prisma-backed CRUD
│   │   └── action-logger.ts       ← logAction(), logCycleRecord()
│   ├── agents/
│   │   ├── main-agent.ts          ← Per-user cycle with real x402 + logging
│   │   ├── adversarial.ts         ← Alpha→Risk→Executor with retry
│   │   ├── specialist-server.ts   ← Real data + real 0G inference + per-specialist wallets
│   │   ├── prompts.ts             ← Data-aware prompts (V2)
│   │   ├── heartbeat.ts           ← 5-min loop for active users
│   │   └── data/
│   │       ├── sentiment-data.ts  ← CoinGecko + Fear&Greed
│   │       ├── whale-data.ts      ← Etherscan + exchange volume
│   │       └── momentum-data.ts   ← Price history + RSI/MACD computation
│   ├── marketplace/
│   │   ├── registry.ts            ← Register/discover/hire specialists
│   │   └── reputation.ts          ← ELO scoring + accuracy tracking
│   ├── hedera/
│   │   ├── hcs.ts                 ← freeze→sign→execute (validated)
│   │   ├── hts.ts                 ← mint/burn/KYC/freeze (validated)
│   │   └── scheduler.ts           ← Scheduled Transactions (validated)
│   ├── og/
│   │   ├── inference.ts           ← sealedInference() (validated)
│   │   ├── inft.ts                ← mintAgentNFT() + updateMetadata()
│   │   └── storage.ts             ← storeMemory() (validated)
│   ├── payments/
│   │   ├── circle-wallet.ts       ← Circle MPC custody: createProxyWallet(), agentTransfer()
│   │   ├── x402-client.ts         ← wrapFetchWithPayment (viem signing)
│   │   └── x402-server.ts         ← paymentMiddleware (per-specialist payTo)
│   ├── api/
│   │   ├── server.ts              ← Express on :3001
│   │   └── routes/
│   │       ├── onboard.ts         ← Circle wallet + iNFT mint + Supabase
│   │       ├── cycle.ts           ← GET history, POST run
│   │       ├── fund.ts            ← Deposit (mint HTS) + Withdraw (burn + Circle transfer)
│   │       └── actions.ts         ← Agent action history (Prisma)
│   ├── telegram/bot.ts            ← /run with inline hire buttons + callback_query + deep-link binding
│   └── index.ts                   ← Boot: validate env → Prisma → bot → API → heartbeat
├── app/                           ← Next.js 16.2 App Router (frontend)
│   ├── layout.tsx
│   ├── page.tsx                   ← Landing + connect wallet
│   ├── onboard/page.tsx           ← 3-step: wallet → telegram → deposit
│   ├── dashboard/page.tsx         ← Per-user 3-column debate view
│   ├── marketplace/page.tsx       ← Specialist leaderboard + reputation
│   ├── history/page.tsx           ← Mirror Node cycle history
│   └── invest/page.tsx            ← Deposit/withdraw
├── contracts/                     ← VaultMindAgent.sol (0G Chain only, NOT Hedera)
├── openclaw/                      ← 7 OpenClaw agent workspaces
│   ├── main-agent/
│   │   ├── SOUL.md               ← Personality ONLY
│   │   ├── AGENTS.md             ← Cycle procedure steps
│   │   ├── HEARTBEAT.md          ← 5-min cycle trigger
│   │   ├── USER.md               ← Investor preferences
│   │   └── TOOLS.md              ← Available tools
│   ├── sentiment-agent/SOUL.md
│   ├── whale-agent/SOUL.md
│   ├── momentum-agent/SOUL.md
│   ├── alpha-agent/SOUL.md
│   ├── risk-agent/SOUL.md
│   └── executor-agent/SOUL.md
├── scripts/
│   ├── setup-topic.ts             ← Creates HCS topic → prints TOPIC_ID
│   ├── setup-token.ts             ← Creates HTS token → prints TOKEN_ID
│   ├── setup-og-account.ts        ← Deposits 10 0G + funds provider
│   └── validate-all.ts            ← Full pre-hackathon checklist
├── .claude/
│   ├── rules/                     ← Path-specific rules (auto-loaded by Claude Code)
│   │   ├── og-compute.md
│   │   ├── x402-payments.md
│   │   ├── hedera.md
│   │   ├── openclaw.md
│   │   └── dashboard.md
│   └── commands/
│       ├── setup.md
│       └── test-cycle.md
├── CLAUDE.md
├── package.json                   ← "type": "module", engines: { node: ">=22" }
└── tsconfig.json                  ← strict: true
```

---

## 8. ENVIRONMENT VARIABLES

```env
# ═══════════════════════════════════════════════════
# HEDERA TESTNET (portal.hedera.com)
# ═══════════════════════════════════════════════════
OPERATOR_ID=0.0.XXXXXXX
OPERATOR_KEY=302e020100300506032b6570042204...
HCS_AUDIT_TOPIC_ID=0.0.XXXXXXX       # Output of setup-topic.ts
HTS_FUND_TOKEN_ID=0.0.XXXXXXX        # Output of setup-token.ts

# ═══════════════════════════════════════════════════
# 0G NETWORK (hub.0g.ai for testnet tokens)
# ═══════════════════════════════════════════════════
OG_PRIVATE_KEY=0x...
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_PROVIDER_ADDRESS=0xa48f...
OG_STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai

# ═══════════════════════════════════════════════════
# ARC TESTNET + NANOPAYMENTS (x402)
# ═══════════════════════════════════════════════════
ARC_RPC_URL=https://rpc-testnet.arc.network
USDC_ARC_ADDRESS=0x...
X402_FACILITATOR_URL=https://x402.org/facilitator

# ═══════════════════════════════════════════════════
# WALLETS
# ═══════════════════════════════════════════════════
AGENT_MASTER_SEED="word1 word2 word3 ... word12"   # Derives all HD hot wallets per user
SERVER_ENCRYPTION_KEY=...                            # AES for proxy wallet key encryption

# ═══════════════════════════════════════════════════
# SUPABASE
# ═══════════════════════════════════════════════════
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://...pooler.supabase.com:5432/postgres

# ═══════════════════════════════════════════════════
# CIRCLE MPC
# ═══════════════════════════════════════════════════
CIRCLE_API_KEY=TEST_API_KEY:...
CIRCLE_ENTITY_SECRET=...
CIRCLE_WALLET_SET_ID=...

# ═══════════════════════════════════════════════════
# TELEGRAM (@BotFather)
# ═══════════════════════════════════════════════════
TELEGRAM_BOT_TOKEN=123456:ABC-...
# ⚠️ NO TELEGRAM_CHAT_ID — chat IDs are dynamic per user, stored in Supabase

# ═══════════════════════════════════════════════════
# OPENCLAW
# ═══════════════════════════════════════════════════
OPENCLAW_MODEL=claude-sonnet-4-20250514
OPENCLAW_WORKSPACE=~/.openclaw/agents
```

### What's GONE from V1 .env (now dynamic)
```
# ❌ AGENT_EVM_PRIVATE_KEY    → derived per user from AGENT_MASTER_SEED
# ❌ AGENT_MNEMONIC           → renamed to AGENT_MASTER_SEED
# ❌ SPECIALIST_WALLET_ADDRESS → per specialist from marketplace_agents table
# ❌ TELEGRAM_CHAT_ID         → per user from users table in Supabase
```

---

## 9. DATABASE LAYER — SUPABASE + PRISMA

### Prisma Schema (Key Models)

```prisma
model User {
  id              String   @id @default(uuid())
  walletAddress   String   @unique @map("wallet_address")
  proxyWalletId   String?  @map("proxy_wallet_id")    // Circle MPC wallet ID
  proxyAddress    String?  @map("proxy_address")       // Circle MPC address
  hotWalletIndex  Int      @map("hot_wallet_index")    // HD derivation index
  hotWalletAddr   String?  @map("hot_wallet_addr")     // Cached HD address
  telegramChatId  String?  @map("telegram_chat_id")
  agentActive     Boolean  @default(false)
  riskProfile     String   @default("balanced")
  maxTradePct     Int      @default(12)
  lastCycleId     Int      @default(0)
  depositedUsdc   Float    @default(0)
  currentNav      Float    @default(0)
  inftTokenId     Int?     @map("inft_token_id")
  cycles          Cycle[]
  actions         AgentAction[]
}

model Cycle {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  cycleNumber     Int      @map("cycle_number")
  specialists     Json     @default("[]")
  alphaAction     String?
  riskChallenge   String?
  execAction      String?
  decision        String?
  hcsSeqNum       Int?
  hashscanUrl     String?
  storageHash     String?
  user            User     @relation(fields: [userId], references: [id])
  actions         AgentAction[]
}

model AgentAction {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  cycleId         String?  @map("cycle_id")
  actionType      String   @map("action_type")
  agentName       String?  @map("agent_name")
  status          String   @default("success")
  payload         Json?
  attestationHash String?
  teeVerified     Boolean?
  paymentAmount   String?
  durationMs      Int?
  createdAt       DateTime @default(now())
  user            User     @relation(fields: [userId], references: [id])
  cycle           Cycle?   @relation(fields: [cycleId], references: [id])
}

model MarketplaceAgent {
  id              String   @id @default(uuid())
  name            String   @unique
  endpoint        String
  walletAddress   String   @map("wallet_address")  // payTo for x402
  price           String   @default("$0.001")
  tags            String[] @default([])
  reputation      Int      @default(500)
  totalHires      Int      @default(0)
  correctCalls    Int      @default(0)
  active          Boolean  @default(true)
}
```

### Commands
```bash
npx prisma generate       # Generate typed client
npx prisma db push        # Sync schema to Supabase
npx prisma studio         # Visual DB browser
```

---

## 10. DUAL WALLET ARCHITECTURE (Per User)

Every user gets TWO wallets. This is the critical architectural change from V1.

```
USER DEPOSITS USDC
       │
       ▼
┌──────────────────────────────────┐
│  CIRCLE CUSTODY WALLET           │  Circle holds keys (HSM)
│  Created: onboard API call       │  Purpose: deposit/withdraw USDC
│  Stored: Supabase (walletId +    │  Signing: Circle SDK server-side
│          address)                 │  Never exposes private key
└──────────────┬───────────────────┘
               │ agentTransfer() tops up ~$0.05
               ▼
┌──────────────────────────────────┐
│  HD HOT WALLET                   │  YOU hold key (derived from master seed)
│  Derived: AGENT_MASTER_SEED +    │  Purpose: sign x402 micropayments
│           user.hotWalletIndex    │  Signing: viem privateKeyToAccount()
│  Stored: address in Supabase     │  Small balance only
└──────────────┬───────────────────┘
               │ x402 payment ($0.001 each)
               ▼
┌──────────────────────────────────┐
│  SPECIALIST WALLETS              │  Each specialist has own wallet
│  Generated: at registration      │  Purpose: receive payment for analysis
│  Stored: marketplace_agents      │  NOT a global env var
│          table                   │
└──────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `src/config/wallets.ts` | `deriveUserAccount(index)` — viem HD derivation from master seed |
| `src/payments/circle-wallet.ts` | `createProxyWallet()`, `agentTransfer()` — Circle MPC SDK |
| `src/config/arc.ts` | `getUserPaymentFetch(index)` — per-user x402 payment client |
| `src/payments/x402-client.ts` | `createPaymentFetch(account)` — wraps fetch with x402 auto-pay |

### HD Wallet Derivation
```typescript
// src/config/wallets.ts
import { HDNodeWallet, Wallet } from "ethers";

const masterSeed = process.env.AGENT_MASTER_SEED!;
const masterNode = HDNodeWallet.fromPhrase(masterSeed);

export function deriveProxyWallet(userIndex: number): Wallet {
  const child = masterNode.derivePath(`m/44'/60'/0'/0/${userIndex}`);
  return new Wallet(child.privateKey);
}

export function getProxyAddress(userIndex: number): string {
  return deriveProxyWallet(userIndex).address;
}
```

### Security Boundary
Only `main-agent.ts` (the orchestrator) imports the master signing key. Specialist agents and adversarial agents (Alpha/Risk/Executor) are inference-only — they receive data, return analysis, never touch keys.

---

## 11. HEDERA SDK REFERENCE

### Client Setup
```typescript
import { Client, PrivateKey, Hbar } from "@hashgraph/sdk";
const client = Client.forTestnet().setOperator(process.env.OPERATOR_ID!, process.env.OPERATOR_KEY!);
client.setDefaultMaxTransactionFee(new Hbar(5));
```

### HCS: Create Private Topic (run once)
```typescript
import { TopicCreateTransaction } from "@hashgraph/sdk";
const submitKey = PrivateKey.fromStringED25519(process.env.OPERATOR_KEY!);
const tx = await new TopicCreateTransaction()
  .setTopicMemo("VaultMind Audit Trail v1")
  .setSubmitKey(submitKey)
  .execute(client);
const receipt = await tx.getReceipt(client);
// → Save receipt.topicId to .env as HCS_AUDIT_TOPIC_ID
```

### HCS: Submit — FREEZE→SIGN→EXECUTE (mandatory for private topics)
```typescript
import { TopicMessageSubmitTransaction, TopicId } from "@hashgraph/sdk";

async function logCycle(topicId: string, record: object) {
  const submitKey = PrivateKey.fromStringED25519(process.env.OPERATOR_KEY!);
  const tx = new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topicId))
    .setMessage(JSON.stringify(record))
    .freezeWith(client);       // 1. FREEZE
  await tx.sign(submitKey);     // 2. SIGN
  const response = await tx.execute(client);  // 3. EXECUTE
  const receipt = await response.getReceipt(client);
  return {
    seqNum: receipt.topicSequenceNumber!.toNumber(),
    url: `https://hashscan.io/testnet/topic/${topicId}`,
  };
}
```
**⚠️ Missing freeze or sign → `INVALID_TOPIC_SUBMIT_KEY`.** Always all three.

### HCS: Mirror Node Query (FREE, no auth)
```typescript
async function getHistory(topicId: string, limit = 25) {
  await new Promise(r => setTimeout(r, 6000));  // 6-SECOND DELAY REQUIRED
  const url = `https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=${limit}&order=desc`;
  const res = await fetch(url);
  const data = await res.json();
  return data.messages.map((m: any) =>
    JSON.parse(Buffer.from(m.message, "base64").toString("utf-8"))
  );
}
```

Query params: `?limit=N`, `?order=desc`, `?sequencenumber=gte:N`, `?timestamp=gt:TIMESTAMP`

### HCS Message Size
Max 1024 bytes/chunk. SDK auto-chunks if larger (default 20 chunks max = ~20 KB). Keep records ~400 bytes to stay in single chunk.

### HTS: Fund Token (SDK, NO Solidity)
```typescript
import {
  TokenCreateTransaction, TokenType, TokenSupplyType,
  CustomFractionalFee, AccountId
} from "@hashgraph/sdk";

const key = PrivateKey.fromStringED25519(process.env.OPERATOR_KEY!);
const operatorId = AccountId.fromString(process.env.OPERATOR_ID!);

const fee = new CustomFractionalFee()
  .setNumerator(1).setDenominator(100)
  .setFeeCollectorAccountId(operatorId);

const tokenTx = await new TokenCreateTransaction()
  .setTokenName("VaultMind Fund Shares").setTokenSymbol("VMFS")
  .setTokenType(TokenType.FungibleCommon).setDecimals(2)
  .setInitialSupply(0).setSupplyType(TokenSupplyType.Infinite)
  .setSupplyKey(key).setAdminKey(key).setFreezeKey(key).setKycKey(key)
  .setCustomFees([fee]).setTreasuryAccountId(operatorId)
  .execute(client);
// → Save receipt.tokenId to .env as HTS_FUND_TOKEN_ID
```

---

## 12. 0G COMPUTE SDK REFERENCE

### Broker Init
```typescript
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ethers } from "ethers";
const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const wallet = new ethers.Wallet(process.env.OG_PRIVATE_KEY!, provider);
const broker = await createZGComputeNetworkBroker(wallet);
```

### Fund Account (ONE-TIME, in this exact order)
```typescript
// 1. Deposit to ledger — STRING arg, minimum "3"
await broker.ledger.depositFund("10");

// 2. Discover providers
const services = await broker.inference.listService();
const chatbots = services.filter(s => s.serviceType === "chatbot");
const providerAddress = chatbots[0].provider;

// 3. Transfer to provider — minimum 1 0G
await broker.ledger.transferFund(providerAddress, "inference", BigInt(3) * BigInt(10 ** 18));

// 4. ACKNOWLEDGE provider — REQUIRED before first call, skip = SILENT FAILURE
await broker.inference.acknowledgeProviderSigner(providerAddress);
```

### Sealed Inference Call — THE Core Function
```typescript
async function sealedInference(
  providerAddress: string,
  systemPrompt: string,
  userMessage: string
) {
  const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);

  // ⚠️ SINGLE-USE headers — new per request, reuse = silent auth failure
  const headers = await broker.inference.getRequestHeaders(providerAddress, userMessage);

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  const data = await response.json();
  const content = data.choices[0].message.content;
  const chatID = response.headers.get("ZG-Res-Key") || data.id;

  // TEE verify — 3 arguments
  let teeVerified = false;
  if (chatID) {
    teeVerified = await broker.inference.processResponse(providerAddress, content, chatID);
  }

  return { content, attestationHash: chatID, teeVerified };
}
```

### Testnet Models (April 2026)

| Model | Type | Input/1M tokens | Output/1M tokens |
|-------|------|-----------------|------------------|
| `qwen-2.5-7b-instruct` | Chatbot | 0.05 0G | 0.10 0G |
| `qwen-image-edit-2511` | Image-Edit | — | 0.005 0G/img |

### 7B Model Prompt Rules
- Keep prompts under 200 words
- Demand JSON explicitly: `"Return ONLY valid JSON. No markdown. No explanation."`
- Show exact schema with field names and types
- One task per prompt — don't combine
- Always `try/catch JSON.parse()` — ~15% malformation rate
- Retry once on parse failure, then regex fallback

### Rate Limits
30 req/min, 5 concurrent per provider. 6 calls/cycle safe at ≥12s intervals. HTTP 429 = wait 2s retry.

### Fee Settlement
Delayed batch settlement. Balance may appear higher then drop when a batch settles. By design.

---

## 13. 0G STORAGE — AGENT MEMORY

### Upload
```typescript
import { Indexer, MemData } from "@0glabs/0g-ts-sdk";
const indexer = new Indexer("https://indexer-storage-testnet-turbo.0g.ai");

async function storeMemory(agentId: string, data: object) {
  const payload = JSON.stringify({ agentId, timestamp: new Date().toISOString(), ...data });
  const memData = new MemData(new TextEncoder().encode(payload));
  // ⚠️ signer as any — required, ethers v5/v6 mismatch, documented in official starter kit
  const [tx, err] = await indexer.upload(memData, "https://evmrpc-testnet.0g.ai", signer as any);
  if (err === null) return tx.rootHash;
  throw new Error(`Upload failed: ${err}`);
}
```

### Download
```typescript
async function loadMemory(rootHash: string, outputPath: string) {
  const err = await indexer.download(rootHash, outputPath, true);
  if (err !== null) throw new Error(`Download failed: ${err}`);
  return JSON.parse(fs.readFileSync(outputPath, "utf-8"));
}
```

### Gotchas
- `indexer.download()` uses `fs.appendFileSync` — does NOT work in browsers. Browser needs `StorageNode.downloadSegmentByTxSeq()`.
- Turbo and standard are separate networks. File on turbo NOT available on standard. Default = turbo.
- Indexer auto-discovers the flow contract — do NOT pass a contract address manually.

---

## 14. x402 NANOPAYMENTS REFERENCE

### ⚠️ CRITICAL: `@x402/express` (scoped, v2) not `x402-express` (unscoped, legacy). Different API.

### How Nanopayments Work
1. Buyer deposits USDC into Circle Gateway wallet (only on-chain tx)
2. Buyer signs EIP-3009 authorizations off-chain per payment
3. Circle validates signature, locks balance, confirms instantly
4. Circle batches thousands of payments, settles on-chain
5. Circle covers all gas at batch layer

### Seller (Specialist Server)
```typescript
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const app = express();
const facilitatorClient = new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" });
const server = new x402ResourceServer(facilitatorClient)
  .register("eip155:84532", new ExactEvmScheme());  // Base Sepolia (swap for Arc chain ID)

app.use(paymentMiddleware({
  "GET /analyze": {                  // ⚠️ METHOD + SPACE + PATH (exact format)
    accepts: {
      scheme: "exact",
      price: "$0.001",
      network: "eip155:84532",       // CAIP-2 format
      payTo: specialistWalletAddress, // Per-specialist from marketplace_agents table
    },
    description: "Specialist analysis",
  },
}, server));
```

### Buyer (Main Agent) — AUTOMATIC 402 handling
```typescript
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

// ⚠️ VIEM for signing, NOT ethers — per-user HD hot wallet
const signer = privateKeyToAccount(derivedPrivateKey as `0x${string}`);
const client = new x402Client();
registerExactEvmScheme(client, { signer });
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Just fetch. Payment is invisible — handles 402→pay→retry automatically.
const response = await fetchWithPayment("http://localhost:4001/analyze");
```

### Facilitator Options
| Facilitator | URL | Networks |
|-------------|-----|----------|
| x402.org | `https://x402.org/facilitator` | Base Sepolia, Solana devnet |
| CDP (Coinbase) | `https://api.cdp.coinbase.com/platform/v2/x402` | Base, Polygon, more |
| Self-hosted | Your URL | Any EVM you configure |

**Arc caveat:** x402.org may not support Arc chain ID yet. Fallback: Base Sepolia for demo, or self-host.

---

## 15. REAL SPECIALIST AGENTS (Live Data)

Each specialist fetches REAL market data from public APIs, then passes it through 0G sealed inference. No mock data.

### Architecture Per Specialist
```
PUBLIC API (free, no auth) → DATA FETCHER (~200ms) → 0G SEALED INFERENCE (TEE) → x402 PAYWALL ($0.001)
```

### Specialist 1: Sentiment Agent (port 4001)
**Sources:** CoinGecko trending + community data, Alternative.me Fear & Greed Index

```typescript
// src/agents/data/sentiment-data.ts
export async function fetchSentimentData(): Promise<string> {
  const [ethData, fng, trending] = await Promise.all([
    fetch(`https://api.coingecko.com/api/v3/coins/ethereum?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false`).then(r => r.json()),
    fetch("https://api.alternative.me/fng/?limit=1").then(r => r.json()),
    fetch("https://api.coingecko.com/api/v3/search/trending").then(r => r.json()),
  ]);
  return JSON.stringify({
    eth_price: ethData.market_data?.current_price?.usd,
    eth_24h_change: ethData.market_data?.price_change_percentage_24h,
    eth_7d_change: ethData.market_data?.price_change_percentage_7d,
    eth_sentiment_up: ethData.sentiment_votes_up_percentage,
    eth_sentiment_down: ethData.sentiment_votes_down_percentage,
    fear_greed_value: fng.data?.[0]?.value,
    fear_greed_label: fng.data?.[0]?.value_classification,
    trending_coins: trending.coins?.slice(0, 5).map((c: any) => c.item?.name),
    fetched_at: new Date().toISOString(),
  });
}
```

### Specialist 2: Whale Agent (port 4002)
**Sources:** Etherscan API (gas + prices), CoinGecko exchange volumes

```typescript
// src/agents/data/whale-data.ts
export async function fetchWhaleData(): Promise<string> {
  const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY ?? "YourApiKeyToken";
  const [ethPrice, gasOracle, topAccounts] = await Promise.all([
    fetch(`https://api.etherscan.io/api?module=stats&action=ethprice&apikey=${ETHERSCAN_KEY}`).then(r => r.json()),
    fetch(`https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${ETHERSCAN_KEY}`).then(r => r.json()),
    fetch("https://api.coingecko.com/api/v3/exchanges?per_page=5").then(r => r.json()),
  ]);
  return JSON.stringify({
    eth_price_usd: ethPrice.result?.ethusd,
    gas_safe: gasOracle.result?.SafeGasPrice,
    gas_fast: gasOracle.result?.FastGasPrice,
    top_exchange_volumes: topAccounts.slice(0, 5).map((ex: any) => ({
      name: ex.name, volume_btc_24h: ex.trade_volume_24h_btc,
    })),
    fetched_at: new Date().toISOString(),
  });
}
```

### Specialist 3: Momentum Agent (port 4003)
**Sources:** CoinGecko 30-day price history, locally computed RSI/MACD

```typescript
// src/agents/data/momentum-data.ts — computes RSI, MACD, support/resistance from real price data
export async function fetchMomentumData(): Promise<string> {
  const res = await fetch("https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=30");
  const data = await res.json();
  const prices: number[] = data.prices.map((p: number[]) => p[1]);
  // Compute RSI-14, MACD(12,26,9), 7-day support/resistance, volume trend
  // Returns real computed indicators
}
```

### CoinGecko Rate Limits
Free tier: 10-30 req/min. With 3 specialists × ~3 endpoints = ~9 calls per cycle. At 5-min intervals, well within limits.

```typescript
// Simple cache helper — 60s TTL
const cache = new Map<string, { data: any; expires: number }>();
async function cachedFetch(url: string, ttlMs = 60_000): Promise<any> {
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.data;
  const data = await fetch(url).then(r => r.json());
  cache.set(url, { data, expires: Date.now() + ttlMs });
  return data;
}
```

### Unified Specialist Server (per-specialist wallets)
```typescript
// Each specialist gets its own wallet — NOT a global env var
const SPECS = [
  { name: "sentiment", port: 4001, fetchData: fetchSentimentData, prompt: PROMPTS.sentiment },
  { name: "whale",     port: 4002, fetchData: fetchWhaleData,     prompt: PROMPTS.whale },
  { name: "momentum",  port: 4003, fetchData: fetchMomentumData,  prompt: PROMPTS.momentum },
];

for (const s of SPECS) {
  const payTo = generateSpecialistWallet(s.name); // Stored in marketplace_agents table
  createSpecialistServer(s.name, s.port, payTo, "$0.001", async () => {
    const rawData = await s.fetchData();           // 1. Fetch REAL market data
    const result = await sealedInference(PROVIDER, s.prompt.content, rawData); // 2. 0G inference
    return { name: s.name, ...safeJsonParse(result.content), attestationHash: result.attestationHash };
  });
}
```

---

## 16. ALL 6 AGENT PROMPTS (V2 — Data-Aware)

```typescript
export const PROMPTS = {
  sentiment: {
    name: "Sentiment Analyst",
    content: `You are a crypto sentiment analyst. You receive REAL market data including Fear & Greed Index, price changes, community sentiment votes, and trending coins.
Analyze the data and assess overall market sentiment.
Return ONLY this JSON, nothing else:
{"signal":"<BUY or SELL or HOLD>","confidence":<0-100>,"fear_greed":<number>,"reasoning":"<max 15 words>"}`,
  },

  whale: {
    name: "Whale Tracker",
    content: `You are a whale movement tracker. You receive REAL exchange volume data, gas prices, and flow metrics.
High gas = network congestion from large transactions. Rising exchange volume = potential distribution. Declining = accumulation.
Return ONLY this JSON, nothing else:
{"signal":"<BUY or SELL or HOLD>","confidence":<0-100>,"whale_activity":"<accumulating or distributing or neutral>","reasoning":"<max 15 words>"}`,
  },

  momentum: {
    name: "Momentum Scanner",
    content: `You are a technical momentum scanner. You receive REAL computed indicators: RSI, MACD, support/resistance levels, volume trend.
RSI > 70 = overbought. RSI < 30 = oversold. MACD histogram positive = bullish crossover.
Return ONLY this JSON, nothing else:
{"signal":"<BUY or SELL or HOLD>","confidence":<0-100>,"trend":"<bullish or bearish or sideways>","reasoning":"<max 15 words>"}`,
  },

  alpha: {
    name: "Alpha Synthesizer",
    content: `You are an aggressive opportunity finder. Given specialist analyses with REAL market data and reputation scores, argue FOR a trade.
Weight high-reputation specialists (>700) heavily. Treat low-reputation (<300) as noise.
Return ONLY this JSON, nothing else:
{"action":"<BUY or SELL>","asset":"ETH","pct":<1-100>,"argument":"<max 25 words>"}`,
  },

  risk: {
    name: "Risk Challenger",
    content: `You are a paranoid risk manager. Given specialist data AND Alpha's argument, find every reason NOT to trade.
Flag if Alpha relies on low-reputation specialists. Check if high-rep agents disagree.
Return ONLY this JSON, nothing else:
{"max_pct":<0-100>,"risks":["<risk1>","<risk2>"],"challenge":"<max 25 words>"}`,
  },

  executor: {
    name: "Executor Judge",
    content: `You are a rational decision maker. Given Alpha's argument and Risk's challenge with REAL market data, make the final call.
Return ONLY this JSON, nothing else:
{"action":"<BUY or SELL or HOLD>","asset":"ETH","pct":<0-100>,"stop_loss":"<-X%>","reasoning":"<max 15 words>"}`,
  },
} as const;
```

---

## 17. MARKETPLACE + REPUTATION SYSTEM

### ELO-Style Scoring
Every specialist starts at 500 reputation (0-1000 scale). After each cycle, scores update based on whether the specialist's signal matched the actual market outcome.

```typescript
interface SpecialistRecord {
  address: string;
  name: string;
  endpoint: string;
  price: string;
  reputation: number;       // 0-1000, starts 500
  totalCycles: number;
  accuracy: number;         // Rolling 0.0-1.0
  lastHired: string;
  tags: string[];
}

function updateReputation(specialist, prediction, actualOutcome, magnitude) {
  const correct = /* prediction matches outcome */;
  const delta = correct ? 15 + (magnitude * 10) : -(20 + (magnitude * 5));
  specialist.reputation = Math.max(0, Math.min(1000, specialist.reputation + delta));
}
```

### How Adversarial Layer Uses Reputation
Main Agent passes reputation scores alongside specialist data to Alpha/Risk/Executor. Alpha weights high-rep (>700) specialists heavily, treats low-rep (<300) as noise. Risk flags if Alpha over-relies on low-rep specialists.

### Marketplace Discovery
```typescript
// Main Agent hiring strategy:
// 1. Discover all specialists tagged for this cycle's needs
// 2. Filter by minReputation (default 300)
// 3. Sort by reputation descending
// 4. Hire top N (default 3) — pay each $0.001
// 5. Pass reputation metadata to adversarial layer
```

---

## 18. MULTI-USER DYNAMIC ARCHITECTURE

### Onboarding Flow (3 Steps in Dashboard)

```
STEP 1: CONNECT WALLET → Dashboard captures address → Create user in Supabase
STEP 2: CONNECT TELEGRAM → Deep link t.me/VaultMindBot?start={wallet} → Bot captures chat ID → Update Supabase
STEP 3: DEPOSIT USDC → Circle creates custody wallet → HD hot wallet derived → HTS shares minted → Cycle starts
```

### Telegram Bot — Dynamic Chat ID Binding
```typescript
bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const walletAddress = match![1].toLowerCase();
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) { bot.sendMessage(chatId, "❌ Connect wallet first."); return; }
  await prisma.user.update({ where: { walletAddress }, data: { telegramChatId: String(chatId) } });
  bot.sendMessage(chatId, "✅ Telegram connected! Waiting for deposit.");
});
```

### Per-User Cycle Runner
Each user gets their own async cycle on independent 5-minute intervals.

```typescript
// src/agents/main-agent.ts — takes user record, not global constants
export async function runCycle(user: User): Promise<CycleResult> {
  const payFetch = getUserPaymentFetch(user.hotWalletIndex); // Per-user x402 client
  const specialists = await hireFromMarketplace(payFetch, { tags: [...], minReputation: 300 });
  const debate = await runAdversarialDebate(specialists, user.riskProfile, user.maxTradePct);
  const { seqNum, hashscanUrl } = await logCycle(TOPIC_ID, buildCompactRecord(...));
  const storageHash = await storeMemory(user.id, record);
  await logCycleRecord(user.id, cycleNumber, { ... }); // Prisma
  await notifyUser(user, result); // Telegram via dynamic chatId
}
```

### Dashboard Pages
- **Landing** — Connect wallet button, global stats
- **Onboard** — 3-step progress (wallet → telegram → deposit)
- **Dashboard** — Per-user 3-column debate view (specialists / debate / proof)
- **Marketplace** — Specialist leaderboard with reputation scores
- **History** — Mirror Node cycle history
- **Invest** — Deposit (mint HTS) / Withdraw (burn + Circle transfer)

---

## 19. OPENCLAW AGENT FRAMEWORK

### Workspace Files (the agent IS the files)
```
agent-name/
├── SOUL.md        ← WHO: personality, tone, values (keep under 500 lines)
├── AGENTS.md      ← HOW: numbered procedures, workflows, decision trees
├── HEARTBEAT.md   ← WHEN: scheduled tasks in plain English (not cron)
├── USER.md        ← FOR WHOM: investor preferences, timezone
├── TOOLS.md       ← WITH WHAT: tool usage instructions
└── MEMORY.md      ← LEARNED: auto-maintained by agent
```

**⚠️ SOUL.md = personality ONLY. Procedures go in AGENTS.md. Mixing = the #1 mistake.**

### openclaw.json Config
```json5
{
  identity: { name: "VaultMind", emoji: "🔮" },
  agent: {
    workspace: "./openclaw/main-agent",
    model: { primary: "anthropic/claude-sonnet-4-6" },
  },
  agents: {
    defaults: {
      heartbeat: {
        every: "5m",              // Override from 30m default
        isolatedSession: true,    // Fresh session per beat
        lightContext: true,       // Only HEARTBEAT.md loaded
        target: "last",
      },
    },
  },
  channels: {
    telegram: { enabled: true, botToken: "${TELEGRAM_BOT_TOKEN}" },
  },
}
```

### Main Agent SOUL.md
```markdown
# VaultMind Main Agent

You are the VaultMind fund orchestrator. You manage a user's USDC portfolio
through an AI swarm of specialist agents and an adversarial debate system.

## Responsibilities
1. Every 5 minutes, hire specialist agents via x402 nanopayments on Arc
2. Feed specialist intelligence into the adversarial layer (Alpha→Risk→Executor)
3. Execute the Executor's trade decision
4. Log everything to Hedera Consensus Service (one atomic message)
5. Report results to the user via Telegram

## Tools
- marketplace_hire: Pay specialist via x402 nanopayment, receive analysis
- og_inference: Run sealed inference on 0G Compute, get TEE attestation
- og_memory_store/load: 0G Storage
- hcs_log: Submit cycle record to Hedera HCS topic
- telegram_notify: Send cycle summary to user

## Personality
Methodical, transparent, always verifies. Never skips adversarial debate.
Always logs proof. Reports honestly even when positions lose money.
```

---

## 20. ERROR → FIX MAP

| Error | Cause | Fix |
|-------|-------|-----|
| `INVALID_TOPIC_SUBMIT_KEY` | Missing freeze/sign | `.freezeWith(client)` → `.sign(key)` → `.execute(client)` |
| 0G returns nothing | Underfunded | `depositFund("10")` then `transferFund(provider, "inference", 1n*10n**18n)` |
| 0G auth fails silently | Didn't acknowledge | `broker.inference.acknowledgeProviderSigner(provider)` |
| 0G reused headers | Headers single-use | New `getRequestHeaders()` per request |
| 0G `depositFund` fails | Below 3 0G minimum | Use `depositFund("10")` not `depositFund("1")` |
| Mirror node empty | Queried too fast | `setTimeout(6000)` before query |
| x402 no 402 | Wrong route format | `"GET /analyze"` not `"/analyze"` |
| x402 payment fails | Using ethers for signing | Use `privateKeyToAccount` from `viem/accounts` |
| x402 USDC rejected | Missing EIP-3009 | Verify Arc USDC contract has `transferWithAuthorization` |
| TS signer error | ethers v5/v6 | `signer as any` (0G storage only) |
| `ERR_MODULE_NOT_FOUND` | Missing type | `"type": "module"` in package.json |
| `listService()` empty | Wrong RPC | `https://evmrpc-testnet.0g.ai` exactly |
| HTTP 429 | Rate limited | 2s delay (30 req/min limit) |
| 0G JSON parse fail | 7B malformed | try/catch, retry once, regex fallback |
| Heartbeat too slow | OpenClaw default 30m | `heartbeat.every: "5m"` in openclaw.json |
| Browser storage download | `indexer.download()` uses `fs` | Use `StorageNode.downloadSegmentByTxSeq()` |
| 0G fee looks wrong | Delayed batch settlement | By design — fees settle in batches |

---

## 21. BUILD PRIORITY

| # | Task | Unlocks | $ |
|---|------|---------|---|
| 1 | 0G Sealed Inference + attestation | 0G DeFi, OpenClaw | $12K |
| 2 | 6 agent prompts (7B optimized, data-aware) | Same | — |
| 3 | x402 nanopayments (hire specialists) | Arc | $6K |
| 4 | HCS cycle logging | Hedera AI, No Solidity | $9K |
| 5 | HTS fund token + custom fees | Tokenization, No Solidity | $5.5K |
| 5.5 | Supabase + Prisma + dynamic onboarding | Multi-user, persistence | All |
| 5.6 | Dual wallet architecture (Circle + HD) | Per-user signing | Arc, Hedera |
| 5.7 | Telegram deep-link binding | Multi-user Telegram | All |
| 6 | Dashboard 3-column debate view | All (MVP required) | — |
| 6.5 | Marketplace registry + reputation scoring | Arc (open economy), 0G | — |
| 7 | Telegram bot with cycle summaries | Hedera AI (wow factor) | — |
| 8 | 0G Storage agent memory | Deepens 0G integration | — |
| 9 | iNFT minting on 0G Chain | OpenClaw | — |
| 10 | OpenClaw SOUL.md + heartbeat | OpenClaw | — |
| 11 | Scheduled Transactions | Hedera AI | — |
| 12 | Naryo event listener | Naryo | $3.5K |

**P1-7 = $11K · P1-10 = $13.75K · All 12 = $17.25K**

---

## 22. VALIDATION CHECKLIST

### Infrastructure (run before business logic)

| # | System | Test | Expected |
|---|--------|------|----------|
| 1 | Supabase | `npx prisma db push` | Tables created |
| 2 | Hedera | Account at portal.hedera.com | HBAR balance > 0 |
| 3 | Hedera | `TopicCreateTransaction` | Topic ID `0.0.XXXXX` |
| 4 | Hedera | `TopicMessageSubmitTransaction` freeze+sign | No error |
| 5 | Hedera | Mirror node after 6s | Base64 message visible |
| 6 | Hedera | Hashscan | Message on explorer |
| 7 | 0G | `createZGComputeNetworkBroker(wallet)` | No error |
| 8 | 0G | `depositFund("10")` | Success |
| 9 | 0G | `transferFund(provider, "inference", 1e18)` | Success |
| 10 | 0G | `listService()` | Models list |
| 11 | 0G | `fetch(endpoint/chat/completions)` | AI response |
| 12 | 0G | `processResponse(provider, content, chatID)` | `true` |
| 13 | 0G | `indexer.upload(memData, rpc, signer)` | Root hash |
| 14 | x402 | Express with `paymentMiddleware` | Listening |
| 15 | x402 | `curl localhost:4001/analyze` | HTTP 402 |
| 16 | x402 | Agent pays and gets data | Analysis JSON |

### End-to-End (V2 specific)
```bash
npx prisma generate && npx prisma db push
# Verify Arc chain ID:
curl -s https://rpc-testnet.arc.network -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}'
# Start specialists with real data:
npx tsx src/agents/specialist-server.ts
curl -v http://localhost:4001/analyze  # → HTTP 402
# Backend + frontend:
npx tsx src/index.ts      # :3001
npm run dev               # :3000
# Full flow: Connect wallet → onboard → deposit → Run Cycle
# Verify real data in responses (actual ETH prices, RSI values)
```

---

## 23. DEMO SCRIPT — 3 MINUTES

```
0:00  "Other AI tools are black boxes. VaultMind is a glass box."

0:20  Live onboarding: Connect wallet → click Telegram deep link →
      bot confirms "✅ Connected!" → deposit $50 USDC
      → Circle custody wallet created → HTS fund shares minted

0:45  Show marketplace: specialist leaderboard with reputation scores.
      "Agents compete. Good ones rise. Bad ones sink."

1:00  Trigger cycle. Dashboard streams in real-time:
      LEFT:   3 specialist reports with ✅ TEE Verified + reputation scores
      CENTER: Alpha argues → Risk challenges → Executor decides
      RIGHT:  Arc payment hashes + Hashscan proof link

1:45  Click Hashscan link. Show immutable HCS record.
      Point at attestation hashes. "One link proves the entire cycle."

2:15  Telegram summary arriving on phone. Tap to verify proof.

2:30  "3 chains. A swarm of AI agents. Every hire paid.
       Every decision proven. Connect your wallet, live in 30 seconds.
       VaultMind — the agent economy for provable alpha."
```

---

## 24. DECISIONS MADE — DO NOT REVISIT

| Decision | Chosen | Why |
|----------|--------|-----|
| Payment rail | x402 on Arc | Only viable gas-free agent-to-agent micropayment infra |
| AI inference | 0G Sealed Inference | TEE attestation = provable AI |
| Audit trail | Hedera HCS | $0.0008/msg, no Solidity, sub-second finality |
| Fund token | Hedera HTS | Native KYC/freeze/custom fees, zero contracts |
| Agent framework | OpenClaw | SOUL.md personalities, Telegram native, heartbeat |
| Agent memory | 0G Storage | Decentralized, Merkle-verified, persistent |
| Agent identity | ERC-7857 iNFT on 0G Chain | Tradeable, composable, ownable agents |
| Frontend | Next.js 16.2 + Tailwind v4 | Turbopack, React 19, Server Components |
| User state | Supabase + Prisma | Persistence across restarts, relational queries |
| Proxy wallets | Circle (custody) + HD (signing) | MPC security for custody; HD for x402 signing |
| Specialist data | Real APIs + 0G inference | Judges need real data, not mocks |
| Specialist wallets | Per-specialist generated | Dynamic marketplace, each has own payTo |
| Chat IDs | Dynamic via Telegram deep link | N users, no hardcoding |
| Marketplace | Open registry with ELO reputation | Self-correcting quality |

---

## 25. CODE STANDARDS

- No dead code. No `any` (only: `signer as any` for 0G ethers v5/v6).
- Single responsibility per file. Explicit try/catch on all SDK calls.
- Async/await only. ES module imports. No `.then()`.
- kebab-case files. camelCase functions. PascalCase types/components.
- Always try/catch `JSON.parse()` on 0G responses (7B ~15% malformation).
- No over-engineering. No factories. No DI. No wrapper abstractions.

---

## 26. OFFICIAL SOURCES

| Resource | URL |
|----------|-----|
| Hedera Create Topic | `docs.hedera.com/hedera/getting-started-hedera-native-developers/create-a-topic` |
| Hedera Submit Message | `docs.hedera.com/hedera/sdks-and-apis/sdks/consensus-service/submit-a-message` |
| Hedera Private Topics | `docs.hedera.com/hedera/tutorials/consensus/submit-message-to-private-topic` |
| Hedera Mirror Node | `testnet.mirrornode.hedera.com/api/v1/topics/{id}/messages` |
| Hedera Portal | `portal.hedera.com` |
| Hashscan | `hashscan.io/testnet` |
| 0G Compute Inference | `docs.0g.ai/developer-hub/building-on-0g/compute-network/inference` |
| 0G Compute Marketplace | `compute-marketplace.0g.ai/inference` |
| 0G Storage SDK | `docs.0g.ai/developer-hub/building-on-0g/storage/sdk` |
| 0G Compute Starter Kit | `github.com/0gfoundation/0g-compute-ts-starter-kit` |
| 0G Storage Starter Kit | `github.com/0gfoundation/0g-storage-ts-starter-kit` |
| 0G Agent Skills | `github.com/0gfoundation/0g-agent-skills` |
| 0G iNFT Docs | `docs.0g.ai/developer-hub/building-on-0g/inft/inft-overview` |
| 0G Hub (faucet) | `hub.0g.ai` |
| 0G Chain Explorer | `chainscan.0g.ai` |
| npm: 0g-serving-broker | `npmjs.com/package/@0glabs/0g-serving-broker` |
| npm: 0g-ts-sdk | `npmjs.com/package/@0glabs/0g-ts-sdk` |
| npm: @x402/express | `npmjs.com/package/@x402/express` |
| npm: @x402/core | `npmjs.com/package/@x402/core` |
| x402 Seller Quickstart | `docs.cdp.coinbase.com/x402/quickstart-for-sellers` |
| x402 GitHub | `github.com/coinbase/x402` |
| Circle Nanopayments | `circle.com/nanopayments` |
| Circle x402 Tutorial | `circle.com/blog/autonomous-payments-using-circle-wallets-usdc-and-x402` |
| x402.org Facilitator | `x402.org/facilitator` |
| OpenClaw GitHub | `github.com/openclaw/openclaw` |
| OpenClaw Agent Docs | `docs.openclaw.ai/concepts/agent` |
| OpenClaw Center | `openclawcenter.com/docs` |

---

*Last updated: April 4, 2026 — ETHGlobal Cannes Day 2 · V2 Unified (Supabase + Circle + Real Data)*