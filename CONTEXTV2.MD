# VAULTMIND — CONTEXT V2 (Updated April 4, 2026)

> Replaces the original CONTEXT.MD. Reflects actual codebase state after Sprint 4 (Supabase + Circle) and the validation audit.

---

## WHAT CHANGED FROM V1

| Area | V1 (Original) | V2 (Current Reality) |
|------|---------------|---------------------|
| User state | In-memory Map | Supabase PostgreSQL via Prisma |
| Proxy wallets | HD-derived only | Circle MPC (custody) + HD hot wallet (x402 signing) |
| Specialist wallets | Single `SPECIALIST_WALLET_ADDRESS` env var | Per-specialist wallet, generated at registration |
| Database | None | Supabase with `users`, `cycles`, `agent_actions`, `marketplace_agents` tables |
| ORM | Raw `postgres` (postgres.js) | Prisma Client with typed queries |
| Specialist data | Mock/stub inference | Real data fetching (CoinGecko, Etherscan, web scraping) + 0G inference |
| Marketplace | Not built | In-memory registry + reputation (persisted via Prisma) |
| Validation | 45/45 individual tests | Needs end-to-end: x402 flow, Arc chain ID, Telegram buttons |

---

## 1. DUAL WALLET ARCHITECTURE (Per User)

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

### .env — What Stays

```env
# Infrastructure (one per deployment)
OPERATOR_ID=0.0.XXXXXXX
OPERATOR_KEY=302e020100...
HCS_AUDIT_TOPIC_ID=0.0.XXXXXXX
HTS_FUND_TOKEN_ID=0.0.XXXXXXX
OG_PRIVATE_KEY=0x...
OG_RPC_URL=https://evmrpc-testnet.0g.ai
OG_PROVIDER_ADDRESS=0x...
TELEGRAM_BOT_TOKEN=123456:ABC-...
AGENT_MASTER_SEED="word1 word2 ... word12"   # Derives all HD hot wallets
SERVER_ENCRYPTION_KEY=...                     # AES for proxy wallet key encryption

# Supabase
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://...pooler.supabase.com:5432/postgres

# Circle MPC
CIRCLE_API_KEY=TEST_API_KEY:...
CIRCLE_ENTITY_SECRET=...
CIRCLE_WALLET_SET_ID=...

# x402
X402_FACILITATOR_URL=https://x402.org/facilitator

# DELETED — now dynamic:
# ❌ AGENT_EVM_PRIVATE_KEY    → derived per user from AGENT_MASTER_SEED
# ❌ AGENT_MNEMONIC           → renamed to AGENT_MASTER_SEED
# ❌ SPECIALIST_WALLET_ADDRESS → per specialist from marketplace_agents table
# ❌ TELEGRAM_CHAT_ID         → per user from users table
```

---

## 2. DATABASE LAYER (Supabase + Prisma)

### Prisma Schema (Key Models)

```prisma
model User {
  id              String   @id @default(uuid())
  walletAddress   String   @unique @map("wallet_address")
  proxyWalletId   String?  @map("proxy_wallet_id")    // Circle
  proxyAddress    String?  @map("proxy_address")       // Circle
  hotWalletIndex  Int      @map("hot_wallet_index")    // HD derivation index
  hotWalletAddr   String?  @map("hot_wallet_addr")     // Cached address
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

## 3. REAL SPECIALIST AGENTS (Live Data)

Each specialist fetches REAL market data from public APIs, then passes it through 0G sealed inference for analysis. No more mock data.

### Architecture Per Specialist

```
PUBLIC API (free, no auth)
       │ fetch real data
       ▼
┌──────────────────────────┐
│  DATA FETCHER            │  Node.js function
│  Returns raw JSON        │  ~200ms
└──────────────┬───────────┘
               │ raw data as context
               ▼
┌──────────────────────────┐
│  0G SEALED INFERENCE     │  TEE enclave
│  System: specialist      │  Analyzes raw data
│  prompt                  │  Returns structured JSON
│  User: fetched data      │  + attestation hash
└──────────────┬───────────┘
               │ analysis + attestation
               ▼
┌──────────────────────────┐
│  x402 PAYWALL            │  HTTP 402 → pay → response
│  Express middleware       │  $0.001 per query
└──────────────────────────┘
```

### Specialist 1: Sentiment Agent (port 4001)

**Data sources (all free, no API key):**
- CoinGecko `/api/v3/search/trending` — trending coins
- CoinGecko `/api/v3/coins/{id}` — community data, sentiment votes
- Alternative.me Fear & Greed Index — `api.alternative.me/fng/`

```typescript
// src/agents/data/sentiment-data.ts
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const FNG_URL = "https://api.alternative.me/fng/?limit=1";

export async function fetchSentimentData(): Promise<string> {
  const [ethData, fng, trending] = await Promise.all([
    fetch(`${COINGECKO_BASE}/coins/ethereum?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false`).then(r => r.json()),
    fetch(FNG_URL).then(r => r.json()),
    fetch(`${COINGECKO_BASE}/search/trending`).then(r => r.json()),
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

**Prompt (passes real data to 0G):**
```
You are a crypto sentiment analyst. Given REAL market data, assess sentiment.
DATA: {fetchedData}
Return ONLY JSON: {"signal":"BUY|SELL|HOLD","confidence":0-100,"fear_greed":<number>,"reasoning":"<15 words max>"}
```

### Specialist 2: Whale Agent (port 4002)

**Data sources (free):**
- Etherscan API (free tier: 5 req/s) — large ETH transfers
- blockchain.com — BTC large transactions
- Alternative: whale-alert.io API or ethplorer.io

```typescript
// src/agents/data/whale-data.ts
const ETHERSCAN_BASE = "https://api.etherscan.io/api";
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY ?? "YourApiKeyToken"; // free tier

export async function fetchWhaleData(): Promise<string> {
  // Get recent large internal transactions (whale activity proxy)
  const [ethPrice, gasOracle, topAccounts] = await Promise.all([
    fetch(`${ETHERSCAN_BASE}?module=stats&action=ethprice&apikey=${ETHERSCAN_KEY}`).then(r => r.json()),
    fetch(`${ETHERSCAN_BASE}?module=gastracker&action=gasoracle&apikey=${ETHERSCAN_KEY}`).then(r => r.json()),
    // Exchange flow proxy: check top exchange wallets
    fetch("https://api.coingecko.com/api/v3/exchanges?per_page=5").then(r => r.json()),
  ]);

  // CoinGecko exchange volume as whale flow proxy
  const exchangeVolume = topAccounts.slice(0, 5).map((ex: any) => ({
    name: ex.name,
    volume_btc_24h: ex.trade_volume_24h_btc,
    trust_score: ex.trust_score,
  }));

  return JSON.stringify({
    eth_price_usd: ethPrice.result?.ethusd,
    eth_price_btc: ethPrice.result?.ethbtc,
    gas_safe: gasOracle.result?.SafeGasPrice,
    gas_fast: gasOracle.result?.FastGasPrice,
    top_exchange_volumes: exchangeVolume,
    high_gas_indicates: "network congestion / whale activity",
    fetched_at: new Date().toISOString(),
  });
}
```

**Prompt:**
```
You are a whale movement tracker. Given REAL exchange and gas data, assess whale behavior.
DATA: {fetchedData}
Return ONLY JSON: {"signal":"BUY|SELL|HOLD","confidence":0-100,"whale_activity":"accumulating|distributing|neutral","reasoning":"<15 words max>"}
```

### Specialist 3: Momentum Agent (port 4003)

**Data sources (free):**
- CoinGecko `/api/v3/coins/{id}/market_chart` — price history for RSI/MACD
- Computed locally from price data

```typescript
// src/agents/data/momentum-data.ts
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

function computeRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  const recent = changes.slice(-period);
  const gains = recent.filter(c => c > 0);
  const losses = recent.filter(c => c < 0).map(c => Math.abs(c));
  const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length ? losses.reduce((a, b) => a + b, 0) / period : 0;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round(100 - 100 / (1 + rs));
}

function computeEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function computeMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = computeEMA(prices, 12);
  const ema26 = computeEMA(prices, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = computeEMA(macdLine.slice(-9), 9);
  const macd = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  return { macd: Math.round(macd * 100) / 100, signal: Math.round(signal * 100) / 100, histogram: Math.round((macd - signal) * 100) / 100 };
}

export async function fetchMomentumData(): Promise<string> {
  // 30 days of hourly data for technical analysis
  const res = await fetch(`${COINGECKO_BASE}/coins/ethereum/market_chart?vs_currency=usd&days=30`);
  const data = await res.json();
  const prices: number[] = data.prices.map((p: number[]) => p[1]);
  const volumes: number[] = data.total_volumes.map((v: number[]) => v[1]);

  const currentPrice = prices[prices.length - 1];
  const rsi = computeRSI(prices);
  const macd = computeMACD(prices);

  // Support/resistance from recent highs/lows
  const recent30 = prices.slice(-720); // ~30 days hourly
  const support = Math.min(...recent30.slice(-168)); // 7-day low
  const resistance = Math.max(...recent30.slice(-168)); // 7-day high

  // Volume trend
  const recentVol = volumes.slice(-24);
  const prevVol = volumes.slice(-48, -24);
  const avgRecent = recentVol.reduce((a, b) => a + b, 0) / recentVol.length;
  const avgPrev = prevVol.reduce((a, b) => a + b, 0) / prevVol.length;
  const volumeTrend = avgRecent > avgPrev * 1.2 ? "increasing" : avgRecent < avgPrev * 0.8 ? "decreasing" : "stable";

  return JSON.stringify({
    current_price: Math.round(currentPrice * 100) / 100,
    rsi_14: rsi,
    macd: macd.macd,
    macd_signal: macd.signal,
    macd_histogram: macd.histogram,
    macd_crossover: macd.histogram > 0 ? "bullish" : "bearish",
    support_7d: Math.round(support * 100) / 100,
    resistance_7d: Math.round(resistance * 100) / 100,
    price_vs_support: Math.round((currentPrice / support - 1) * 10000) / 100,
    price_vs_resistance: Math.round((1 - currentPrice / resistance) * 10000) / 100,
    volume_trend: volumeTrend,
    fetched_at: new Date().toISOString(),
  });
}
```

**Prompt:**
```
You are a technical momentum scanner. Given REAL computed indicators, assess momentum.
DATA: {fetchedData}
Return ONLY JSON: {"signal":"BUY|SELL|HOLD","confidence":0-100,"trend":"bullish|bearish|sideways","reasoning":"<15 words max>"}
```

### Unified Specialist Server

```typescript
// src/agents/specialist-server.ts (updated)
import { sealedInference } from "../og/inference.js";
import { PROMPTS } from "./prompts.js";
import { createSpecialistServer } from "../payments/x402-server.js";
import { fetchSentimentData } from "./data/sentiment-data.js";
import { fetchWhaleData } from "./data/whale-data.js";
import { fetchMomentumData } from "./data/momentum-data.js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const PROVIDER = process.env.OG_PROVIDER_ADDRESS!;

// Each specialist gets its own wallet
function generateSpecialistWallet(name: string): string {
  // For hackathon: deterministic from name. Production: store in DB.
  const key = generatePrivateKey();
  const account = privateKeyToAccount(key);
  console.log(`[specialist] ${name} payTo: ${account.address}`);
  return account.address;
}

const SPECS = [
  { name: "sentiment", port: 4001, fetchData: fetchSentimentData, prompt: PROMPTS.sentiment },
  { name: "whale",     port: 4002, fetchData: fetchWhaleData,     prompt: PROMPTS.whale },
  { name: "momentum",  port: 4003, fetchData: fetchMomentumData,  prompt: PROMPTS.momentum },
];

export async function startSpecialists(): Promise<void> {
  for (const s of SPECS) {
    const payTo = generateSpecialistWallet(s.name);

    createSpecialistServer(s.name, s.port, payTo, "$0.001", async () => {
      // 1. Fetch REAL market data
      const rawData = await s.fetchData();

      // 2. Pass through 0G sealed inference
      const result = await sealedInference(
        PROVIDER,
        s.prompt.content,
        `Current market data:\n${rawData}`,
      );

      // 3. Parse response
      const parsed = safeJsonParse(result.content, {
        signal: "HOLD", confidence: 0, reasoning: "parse failed",
      });

      return {
        name: s.name,
        ...parsed,
        rawDataSnapshot: JSON.parse(rawData), // Include raw data for transparency
        attestationHash: result.attestationHash,
        teeVerified: result.teeVerified,
      };
    });
  }
}
```

---

## 4. UPDATED PROMPTS (Real Data Aware)

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

## 5. MAIN AGENT CYCLE (Updated Flow)

```typescript
// src/agents/main-agent.ts — key changes from V1:
// 1. Uses per-user HD hot wallet for x402 signing
// 2. Logs every action to Prisma
// 3. Specialists fetch real data
// 4. Marketplace reputation passed to adversarial layer

export async function runCycle(user: UserRecord): Promise<CycleResult> {
  const cycleId = crypto.randomUUID();
  const cycleNumber = user.lastCycleId + 1;

  // Per-user x402 client (signs with THIS user's HD hot wallet)
  const payFetch = getUserPaymentFetch(user.hotWalletIndex);

  // Log: cycle started
  await logAction({ userId: user.id, cycleId, actionType: "CYCLE_STARTED" });

  // 1. HIRE SPECIALISTS (real data + real payments)
  //    Specialist URLs come from marketplace registry, NOT hardcoded
  const specialists = await hireFromMarketplace(payFetch, {
    tags: ["sentiment", "whale", "momentum"],
    minReputation: 300,
    maxHires: 3,
  });

  // 2. ADVERSARIAL DEBATE (includes reputation metadata)
  const debate = await runAdversarialDebate(
    specialists,        // includes reputation scores
    user.riskProfile,
    user.maxTradePct,
  );

  // 3. LOG TO HCS
  const record = buildCompactRecord(cycleNumber, user, specialists, debate);
  const { seqNum, hashscanUrl } = await logCycle(TOPIC_ID, record);

  // 4. STORE MEMORY (0G)
  const storageHash = await storeMemory(user.id, record);

  // 5. SAVE TO PRISMA (full cycle + all actions)
  await logCycleRecord(user.id, cycleNumber, { ... });

  // 6. NOTIFY (Telegram with buttons)
  notifyUser(user, result);

  return result;
}
```

---

## 6. VALIDATION SEQUENCE (What to Test Now)

```bash
# ── STEP 1: Prisma setup ──
npx prisma generate
npx prisma db push

# ── STEP 2: Verify Arc chain ID ──
curl -s https://rpc-testnet.arc.network -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","id":1}'
# If NOT 0x14a34 (84532), update NETWORK in x402-client.ts + x402-server.ts

# ── STEP 3: Generate master seed (if not set) ──
node -e "console.log(require('viem/accounts').generateMnemonic())"
# Add to .env as AGENT_MASTER_SEED

# ── STEP 4: Start specialists with real data ──
npx tsx src/agents/specialist-server.ts
# Should log: sentiment/whale/momentum wallets + "listening on :4001/4002/4003"

# ── STEP 5: Verify 402 response ──
curl -v http://localhost:4001/analyze
# Expected: HTTP 402 + x402 payment header

# ── STEP 6: Backend + frontend ──
npx tsx src/index.ts      # Backend on :3001
npm run dev               # Frontend on :3000

# ── STEP 7: Full flow ──
# Browser: Connect wallet → auto-onboard → deposit → Run Cycle
# Telegram: /run → inline buttons → hire → debate → HCS proof

# ── STEP 8: Verify real data ──
# Check specialist responses contain actual ETH prices, RSI values, etc.
# Not "mock data" or "stub_12345"
```

---

## 7. REPO STRUCTURE (Current)

```
vaultmind/
├── prisma/
│   └── schema.prisma              ← Prisma schema (User, Cycle, AgentAction, MarketplaceAgent)
├── src/
│   ├── config/
│   │   ├── hedera.ts              ← Client.forTestnet().setOperator()
│   │   ├── og-compute.ts          ← createZGComputeNetworkBroker()
│   │   ├── og-storage.ts          ← getFlowContract()
│   │   ├── arc.ts                 ← getUserPaymentFetch(index) — per-user
│   │   ├── wallets.ts             ← deriveUserAccount(index) — HD from master seed
│   │   └── prisma.ts              ← PrismaClient singleton
│   ├── store/
│   │   ├── user-store.ts          ← Prisma-backed CRUD (replaces raw SQL)
│   │   └── action-logger.ts       ← logAction(), logCycleRecord()
│   ├── agents/
│   │   ├── main-agent.ts          ← Per-user cycle with real x402 + logging
│   │   ├── adversarial.ts         ← Alpha→Risk→Executor with retry
│   │   ├── specialist-server.ts   ← Real data + real 0G inference
│   │   ├── prompts.ts             ← Data-aware prompts
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
│   │   ├── circle-wallet.ts       ← Circle MPC custody
│   │   ├── x402-client.ts         ← wrapFetchWithPayment (viem signing)
│   │   └── x402-server.ts         ← paymentMiddleware (per-specialist payTo)
│   ├── api/
│   │   ├── server.ts              ← Express on :3001
│   │   └── routes/
│   │       ├── onboard.ts         ← Circle wallet + iNFT mint + Supabase
│   │       ├── cycle.ts           ← GET history, POST run
│   │       ├── fund.ts            ← Deposit (mint HTS) + Withdraw (burn + Circle transfer)
│   │       └── actions.ts         ← Agent action history (Prisma)
│   ├── telegram/bot.ts            ← /run with inline hire buttons + callback_query
│   └── index.ts                   ← Boot: validate env → Prisma → bot → API → heartbeat
├── app/                           ← Next.js 16.2 App Router (frontend)
├── contracts/                     ← VaultMindAgent.sol (0G Chain only, NOT Hedera)
├── openclaw/                      ← 7 agent workspaces (SOUL.md)
└── scripts/                       ← Setup + validation
```

---

## 8. CoinGecko Rate Limits

CoinGecko free tier: 10-30 req/min depending on endpoint. With 3 specialists each fetching ~2-3 endpoints, that's ~9 calls per cycle. At 5-min intervals, well within limits.

If rate-limited, cache responses for 60 seconds — market data doesn't change faster than that anyway.

```typescript
// Simple cache helper
const cache = new Map<string, { data: any; expires: number }>();

async function cachedFetch(url: string, ttlMs = 60_000): Promise<any> {
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return cached.data;
  const data = await fetch(url).then(r => r.json());
  cache.set(url, { data, expires: Date.now() + ttlMs });
  return data;
}
```

---

## 9. DECISIONS UPDATED

| Decision | V1 | V2 | Why Changed |
|----------|----|----|------------|
| User state | In-memory Map | Supabase + Prisma | Persistence across restarts, relational queries for action history |
| Proxy wallets | HD-derived only | Circle (custody) + HD (signing) | Circle gives MPC security for custody; HD gives viem signing for x402 |
| Specialist data | Mock inference | Real APIs + 0G inference | Judges need to see real data, not "signal: BUY, confidence: 72, reasoning: mock data" |
| Specialist wallets | Global env var | Per-specialist generated | Dynamic marketplace requires each specialist to have its own payTo |
| Database ORM | Raw postgres.js | Prisma | Typed queries, migration tracking, Prisma Studio for demo |

**Unchanged from V1:** Hedera HCS/HTS patterns, 0G inference patterns, x402 SDK patterns, OpenClaw workspace structure, adversarial debate pipeline, demo script structure.