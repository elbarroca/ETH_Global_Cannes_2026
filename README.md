# 🔮 VaultMind

### The Agent Economy for Provable Investment Alpha

> Your personal AI agent hires specialists, debates every trade adversarially, and proves every decision on-chain. Zero black boxes. Full mathematical proof.

**ETHGlobal Cannes 2026 · 3 Chains · 7 Agents · 7 Bounties · $17,250**

---

## 💡 The Problem

AI hedge funds and trading bots are **black boxes**. You deposit money, cross your fingers, and hope. You can't see the reasoning. You can't verify the decisions. You can't prove anything.

## ✅ The Solution

VaultMind is a **glass box with mathematical proof**.

You deposit USDC. A personal AI agent:

1. **Hires specialist sub-agents** from an open marketplace — paying each $0.001 via gas-free nanopayments
2. **Runs adversarial debate** — Alpha argues FOR, Risk argues AGAINST, Executor decides — all inside tamper-proof hardware enclaves
3. **Logs every decision** to an immutable audit trail — one click verifies everything on-chain
4. **Reports to you** on Telegram with proof links

Every agent's reasoning is sealed. Every payment is tracked. Every decision is permanent.

---

## 🏗️ Architecture — Three Chains, Three Roles

```
  👤 USER                💰 ARC                 🧠 0G                  📜 HEDERA
  ─────────             ─────────              ─────────              ─────────
  Dashboard             USDC Deposits          Sealed Inference       HCS Audit Trail
  Telegram Bot          x402 Nanopayments      0G Storage             HTS Fund Token
                        ($0.001/specialist)    iNFT Identity          Scheduled Tx
                        Gas-free via Circle    Specialist Market      Mirror Node

          Deposit USDC ──→    Pay specialists ──→   Decision + proofs ──→
      ←── Proof links ─────────────────────────────────────────────────┘
```

| Chain | Role | What It Does |
|-------|------|-------------|
| **Arc** (Circle) | 💰 Money | x402 nanopayments ($0.001/specialist), USDC deposits, gas-free agent-to-agent commerce |
| **0G** | 🧠 Brain | Sealed Inference (TEE), Storage (agent memory), Chain (iNFT identity), Compute marketplace |
| **Hedera** | 📜 Truth | HCS (immutable audit), HTS (fund tokens + KYC + fees), Scheduled Tx, Mirror Node |

---

## 🔄 The Cycle — What Happens Every 5 Minutes

```
  ⏰ Trigger (Heartbeat / Scheduled Tx)
       │
       ▼
  ┌─── STEP 1 — HIRE SPECIALISTS ($0.003 total) ───────────────────┐
  │  🤖 Main Agent → 🏪 Marketplace (discover top 3 by reputation) │
  │       ├──→ 📊 Sentiment:  GET /analyze → 402 → pay $0.001      │
  │       ├──→ 🐋 Whale:      GET /analyze → 402 → pay $0.001      │
  │       └──→ 📈 Momentum:   GET /analyze → 402 → pay $0.001      │
  │  Each returns: { analysis, attestationHash, paymentId }         │
  └─────────────────────────────────────────────────────────────────┘
       │
       ▼
  ┌─── STEP 2 — ADVERSARIAL DEBATE (TEE sealed) ──────────────┐
  │  🟢 Alpha:    "BUY 20% ETH" + TEE attestation             │
  │  🔴 Risk:     "MAX 10%, funding rates high" + attestation  │
  │  🟡 Executor: "BUY 12% ETH, SL -4%" + attestation         │
  └────────────────────────────────────────────────────────────┘
       │
       ▼
  ┌─── STEP 3-4 — EXECUTE + LOG ─────────────────────┐
  │  Parse decision → Log to 📜 Hedera HCS (~400 B)  │
  │  freeze → sign → execute                          │
  └───────────────────────────────────────────────────┘
       │
       ▼
  ┌─── STEP 5-6 — REMEMBER + NOTIFY ─────────────────┐
  │  Store memory → 0G Storage                        │
  │  Send summary + Hashscan link → 📱 Telegram       │
  └───────────────────────────────────────────────────┘
```

### Per Cycle Cost

| Item | Count | Cost |
|------|-------|------|
| Specialist hires (x402) | 3 | $0.003 |
| 0G inference calls | 6 | ~0.003 0G |
| HCS message | 1 | $0.0008 |
| 0G Storage write | 1 | negligible |
| **Total** | | **~$0.004** |

---

## 👤 User Onboarding — Dynamic, Zero Hardcoding

No chat IDs in config files. No wallet addresses baked in. Every user onboards dynamically through a 3-step flow.

```
  🔗 Connect Wallet  ──→  📱 Connect Telegram  ──→  💵 Deposit USDC  ──→  ✅ Agent Live
  MetaMask/WC              t.me/bot?start=wallet     Proxy wallet           Cycle every 5m
```

**Step 1 — Connect Wallet:** User visits dashboard, connects wallet. Backend creates `UserRecord` in memory.

**Step 2 — Connect Telegram:** Dashboard shows unique deep-link `t.me/VaultMindBot?start={walletAddress}`. User clicks, bot captures `chat.id`, binds it to their wallet. No hardcoded `TELEGRAM_CHAT_ID`.

**Step 3 — Deposit USDC:** User deposits to a proxy wallet derived from a master HD seed. The orchestrator agent signs on their behalf. Fund shares (HTS) are minted proportionally. First cycle triggers immediately.

---

## 🔐 Proxy Wallet Architecture

Only the Main Agent orchestrator holds the signing key. Specialists and adversarial agents are **inference-only** — they never touch private keys.

```
                        🔑 Master Seed (BIP-39)
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
     m/44'/60'/0'/0/0   m/44'/60'/0'/0/1   m/44'/60'/0'/0/N
            │                  │                  │
       Proxy Wallet A    Proxy Wallet B    Proxy Wallet N
       (User A funds)    (User B funds)    (User N funds)
            │                  │                  │
            └──────────────────┼──────────────────┘
                               │
                  🤖 Main Agent signs for all
                  (ONLY component with key access)

       🧪 Specialists ─── ❌ cannot sign
       ⚔️ Alpha/Risk/Exec ─ ❌ cannot sign
```

---

## 🏪 Marketplace — Reputation System

Specialists compete on accuracy. Good agents rise. Bad agents sink. The adversarial layer weights signals by reputation.

```
  Agent Registers (endpoint, price, tags)
       │
       ▼
  Starting Reputation: 500
       │
       ▼
  Hired for Cycle → Agent Predicts (bullish / bearish / neutral)
       │
       ▼
  Market Outcome
       ├── ✅ Correct → Reputation +15 to +25
       └── ❌ Wrong   → Reputation -20 to -25
       │
       ▼
  Re-ranked → Main Agent Discovers (next cycle)
       ├── Rep > 700  → 🟢 High Weight (primary signal)
       ├── 300–700    → 🟡 Normal Weight
       └── Rep < 300  → 🔴 Treated as Noise
       │
       ▼
  All fed to Alpha / Risk / Executor (with reputation metadata)
```

The adversarial layer sees reputation scores alongside each specialist's analysis:

- **Alpha** weights high-rep specialists heavily when building bullish thesis
- **Risk** flags if Alpha is over-relying on low-rep specialists
- **Executor** cross-references: do high-rep and low-rep agents agree or disagree?

Reputation history is stored in **0G Storage** (Merkle-verified, can't be faked) and deltas are logged in **Hedera HCS** alongside cycle records.

---

## ⚔️ Adversarial Debate — Chain of Thought

This is the core product. Three agents with opposing mandates, all running in TEE enclaves.

```
  📊 3 Specialist Reports (+ reputation scores)
       │
       ▼
  🟢 ALPHA — Opportunity Finder
  │  Argues FOR trade. Picks asset, %, direction. Uses high-rep signals.
  │  └──→ TEE attestation hash
  │
  ▼
  🔴 RISK — Paranoid Manager
  │  Argues AGAINST trade. Finds every flaw. Challenges Alpha's sources.
  │  └──→ TEE attestation hash
  │
  ▼
  🟡 EXECUTOR — Final Decision Maker
  │  Weighs Alpha vs Risk. Can side with either. Sets stop-loss.
  │  └──→ TEE attestation hash
  │
  ▼
  📋 Decision: { action, asset, pct, stop_loss }
       │
       ▼
  📜 Hedera HCS — All 3 hashes + decision in one atomic message
```

### Example Debate

| Agent | Output |
|-------|--------|
| **📊 Sentiment** (rep: 780) | `{ score: 72, class: "bullish", fear_greed: 68 }` |
| **🐋 Whale** (rep: 650) | `{ net_flow: "accumulating", exchange_flow: "outflow" }` |
| **📈 Momentum** (rep: 420) | `{ rsi: 58, macd: "bullish", trend: "up" }` |
| **🟢 Alpha** | "Sentiment + Whale both bullish (high rep). BUY 20% ETH." |
| **🔴 Risk** | "Momentum agent has low rep (420). RSI approaching overbought. MAX 10%." |
| **🟡 Executor** | `{ action: "BUY", asset: "ETH", pct: 12, stop_loss: "-4%" }` |

One Hashscan link proves the entire debate happened inside sealed enclaves.

---

## 📜 Proof — What Gets Logged to Hedera

Every cycle produces one compact HCS message (~400 bytes):

```
  Cycle #48 (2026-04-03T14:32:07Z)
       │
       ├── Specialists:  3x { name, attestation, paymentId, $0.001 }
       ├── Adversarial:  Alpha decision + Risk challenge + Executor final (each with attestation)
       ├── Trade:        { action, stop_loss, tx_hash }
       └── NAV:          $512.34
       │
       ▼
  📜 Hedera HCS — Immutable, timestamped, sequence number assigned
       │
       ├──→ 🔗 hashscan.io/testnet/topic/0.0.XXXXX (one click to verify)
       └──→ 🌐 Mirror Node REST (free, no auth, dashboard pulls from here)
```

---

## 🔧 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | >= 22 |
| Language | TypeScript (strict) | ES modules |
| Frontend | Next.js 16.2 | App Router, Turbopack, React 19 |
| Styling | Tailwind CSS v4 | Utility-first |
| Hedera | `@hashgraph/sdk` | ^2.69.0 |
| 0G Compute | `@0glabs/0g-serving-broker` | latest |
| 0G Storage | `@0glabs/0g-ts-sdk` | latest |
| Payments (seller) | `@x402/express` + `@x402/evm` | v2+ |
| Payments (buyer) | `@x402/fetch` + `viem` | latest |
| Ethereum | ethers v6 | — |
| Telegram | node-telegram-bot-api | latest |

---

## 📁 Project Structure

```
vaultmind/
├── src/
│   ├── config/           # Chain clients + wallet derivation
│   │   ├── hedera.ts         Client.forTestnet().setOperator()
│   │   ├── og-compute.ts     createZGComputeNetworkBroker()
│   │   ├── og-storage.ts     Indexer init
│   │   ├── arc.ts            viem account for x402
│   │   └── wallets.ts        HD proxy wallet derivation
│   │
│   ├── state/            # In-memory dynamic state
│   │   └── user-store.ts     Map-based UserStore (N users)
│   │
│   ├── marketplace/      # Specialist economy
│   │   ├── registry.ts       Registration + discovery
│   │   └── reputation.ts     ELO scoring + accuracy
│   │
│   ├── hedera/           # Truth layer
│   │   ├── hcs.ts            logCycle(), getHistory()
│   │   ├── hts.ts            Fund token (mint/burn/fees)
│   │   └── scheduler.ts      Scheduled Transactions
│   │
│   ├── og/               # Brain layer
│   │   ├── inference.ts      sealedInference() — core function
│   │   ├── storage.ts        Agent memory (upload/download)
│   │   └── verify.ts         TEE attestation verification
│   │
│   ├── payments/          # Money layer
│   │   ├── x402-server.ts    Specialist paywall (seller)
│   │   └── x402-client.ts    Agent payment client (buyer)
│   │
│   ├── agents/            # The swarm
│   │   ├── main-agent.ts     Per-user cycle orchestrator
│   │   ├── cycle-runner.ts   Async interval manager
│   │   ├── adversarial.ts    Alpha → Risk → Executor
│   │   ├── specialist-server.ts  3 Express apps
│   │   └── prompts.ts        6 system prompts (7B-optimized)
│   │
│   ├── telegram/bot.ts    # Dynamic Telegram binding
│   ├── dashboard/         # Next.js 16.2 App Router
│   └── index.ts           # Boot
│
├── openclaw/              # 7 OpenClaw agent workspaces
│   ├── main-agent/           SOUL.md + AGENTS.md + HEARTBEAT.md
│   ├── sentiment-agent/      SOUL.md
│   ├── whale-agent/          SOUL.md
│   ├── momentum-agent/       SOUL.md
│   ├── alpha-agent/          SOUL.md
│   ├── risk-agent/           SOUL.md
│   └── executor-agent/       SOUL.md
│
└── scripts/               # One-time setup
    ├── setup-topic.ts        HCS audit topic
    ├── setup-token.ts        HTS fund token
    └── setup-og-account.ts   0G broker funding
```

---

## 🚀 Quick Start

### 1. Install

```bash
git clone https://github.com/your-org/vaultmind.git
cd vaultmind
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Fill in: Hedera operator, 0G keys, Telegram bot token, master seed
```

### 3. One-Time Setup

```bash
npx ts-node scripts/setup-topic.ts       # → HCS_AUDIT_TOPIC_ID
npx ts-node scripts/setup-token.ts       # → HTS_FUND_TOKEN_ID
npx ts-node scripts/setup-og-account.ts  # → Funds 0G broker
```

### 4. Run

```bash
# Terminal 1: Start specialist marketplace
npx ts-node src/agents/specialist-server.ts

# Terminal 2: Start the full system
npx ts-node src/index.ts

# Terminal 3: Start dashboard
npm run dev
```

### 5. Verify

```bash
curl -s -o /dev/null -w "%{http_code}" localhost:4001/analyze  # → 402
# Visit dashboard → connect wallet → connect Telegram → deposit → watch cycles
```

---

## 🏆 Bounties Targeted

| Bounty | Prize | What We Use |
|--------|-------|-------------|
| **💰 Arc** | $6K | Nanopayments, agent-to-agent USDC, gas-free marketplace |
| **📜 Hedera AI** | $6K | HTS fund token, HCS audit trail, Scheduled Tx, HCS-14 identity |
| **🧠 0G DeFi** | $6K | Sealed Inference, TEE attestation, Storage memory, Chain settlement |
| **🤖 0G OpenClaw** | $6K | 7 SOUL.md agents, iNFT identity, 0G full stack |
| **📜 No Solidity** | $3K | 4 native services, zero .sol files, SDK only |
| **🪙 Tokenization** | $2.5K | HTS compliance, KYC + freeze, custom 1% fee |
| **📡 Naryo** | $3.5K | Multichain events, Hedera EVM, Mirror Node |
| | **$17,250** | |

---

## ⚡ Data Flow — End to End

```
  👤 User deposits USDC
       │
       ▼
  Proxy Wallet (HD-derived) ──→ HTS Mint (fund shares)
       │
       ▼
  🤖 Main Agent hires 3 specialists ($0.001 each via x402 on Arc)
       ├──→ 📊 Sentiment (TEE sealed)
       ├──→ 🐋 Whale (TEE sealed)
       └──→ 📈 Momentum (TEE sealed)
                    │
                    ▼
              All reports fed to:
              🟢 Alpha (TEE sealed)
                    │
                    ▼
              🔴 Risk (TEE sealed)
                    │
                    ▼
              🟡 Executor (TEE sealed)
                    │
          ┌─────────┼─────────────┐
          ▼         ▼             ▼
     Execute    Log to HCS    Store in 0G
     Trade      (~400 bytes)  Storage
                    │
                    ▼
             Hashscan Proof Link
              ├──→ 📱 Telegram (summary + link)
              └──→ 🖥️ Dashboard (3-column debate view)
```

---

## 🛡️ Security Model

| Component | Access Level | Why |
|-----------|-------------|-----|
| Main Agent (orchestrator) | ✅ Master seed, signs transactions | Only component that moves money |
| Specialist agents | 🔒 Inference only, no keys | Receive data → return analysis |
| Alpha / Risk / Executor | 🔒 Inference only, no keys | Receive data → return decisions |
| User proxy wallets | 🔐 Derived from master, isolated per user | Funds can't cross between users |
| 0G Sealed Inference | 🔐 TEE enclave, hardware-isolated | Nobody sees data during processing |
| HCS Audit Trail | 📜 Append-only, submit-key protected | Only our agent can write |

---

## 📊 Dashboard Views

| Page | What It Shows |
|------|--------------|
| **Landing** | Connect wallet button, global stats (users, cycles, hires) |
| **Onboard** | 3-step progress: ✅ Wallet → ✅ Telegram → ✅ Deposit |
| **Dashboard** | 3-column live debate view (specialists / debate / proof) |
| **Marketplace** | Specialist leaderboard, reputation scores, accuracy history |
| **History** | Past cycles from Mirror Node REST API |
| **Invest** | Deposit/withdraw USDC, fund share balance |

---

## 🧪 Testing

```bash
# Validate each integration independently
npx ts-node scripts/setup-topic.ts         # Hedera HCS ✓
npx ts-node scripts/setup-token.ts         # Hedera HTS ✓
npx ts-node scripts/setup-og-account.ts    # 0G broker ✓
npx ts-node src/og/test-inference.ts       # 0G inference + TEE ✓
npx ts-node src/agents/specialist-server.ts # Start specialists
curl localhost:4001/analyze                 # → HTTP 402 ✓
npx ts-node src/index.ts                   # Full cycle ✓
```

---

## 🏛️ Architecture Decisions

| Decision | Chosen | Why |
|----------|--------|-----|
| Payment rail | x402 on Arc | Only viable gas-free micropayment infra |
| AI inference | 0G Sealed Inference | TEE attestation = provable AI |
| Audit trail | Hedera HCS | $0.0008/msg, no Solidity, sub-second finality |
| Fund token | Hedera HTS (SDK) | Native KYC/freeze/fees, zero contracts |
| Agent framework | OpenClaw | SOUL.md personalities, Telegram native |
| User state | In-memory Map | Zero deps, swappable to Redis |
| Chat IDs | Dynamic Telegram deep-link | N users, no hardcoding |
| Wallets | HD-derived proxy wallets | One seed, isolated per user |
| Marketplace | Open registry + ELO reputation | Self-correcting quality |

---

## 👥 Team

Built at ETHGlobal Cannes 2026 in 48 hours.

---

## 📄 License

MIT