# DEV A — Backend & Chain Infrastructure

> **Owns:** Hedera, 0G, cycle engine, API server, user store, heartbeat
> **Files:** `src/config/hedera.ts`, `src/config/og-*.ts`, `src/hedera/**`, `src/og/**`, `src/store/**`, `src/agents/adversarial.ts`, `src/agents/main-agent.ts`, `src/agents/heartbeat.ts`, `src/agents/prompts.ts`, `src/api/**`, `scripts/**`
>
> **Does NOT touch:** `src/payments/**`, `src/config/arc.ts`, `src/agents/specialist-server.ts`, `src/telegram/**`, `src/dashboard/**`

---

## PHASE 0 — SHARED SCAFFOLD (Do together, 30 min)

**Both devs pair on this. One types, one validates. Do NOT split this.**

```
□ package.json — type: module, engines >=22
□ tsconfig.json — strict, ES2022, NodeNext
□ .env — all key names from template
□ Full directory structure (mkdir -p all dirs)
□ src/index.ts — "VaultMind booting..." + exits clean

RUN TOGETHER:
  npm install @hashgraph/sdk \
    @0glabs/0g-serving-broker @0glabs/0g-ts-sdk @types/crypto-js@4.2.2 crypto-js@4.2.0 \
    @x402/express @x402/evm @x402/core @x402/fetch viem \
    ethers express dotenv node-telegram-bot-api uuid
  npm install -D typescript @types/express @types/node @types/uuid

  npx tsx src/index.ts → "VaultMind booting..." → exit 0

THEN: git add . && git commit -m "scaffold" && git push
THEN: split. Dev A continues below. Dev B switches to DEV-B.md.
```

---

## PHASE 1 — FOUNDATIONS (Hours 0.5-2.5)

### 1A-α — User Store + Proxy Wallet + Crypto (45 min)

**Files you create:**
- `src/store/user-store.ts`
- `src/store/crypto.ts`
- `src/store/proxy-wallet.ts`
- `src/store/link-codes.ts`
- `src/types/index.ts` (shared types — UserRecord, CycleResult, etc.)

```
src/types/index.ts — THE SHARED CONTRACT
  Both devs import types from here. Define once, import everywhere.

  export interface UserRecord {
    id: string;
    walletAddress: string;
    proxyWallet: { address: string; encryptedKey: string };
    telegram: {
      chatId: string | null;
      username: string | null;
      verified: boolean;
      notifyPreference: "every_cycle" | "trades_only" | "daily_digest";
    };
    agent: {
      active: boolean;
      riskProfile: "conservative" | "balanced" | "aggressive";
      maxTradePercent: number;
      lastCycleId: number;
      lastCycleAt: string | null;
    };
    fund: {
      depositedUsdc: number;
      htsShareBalance: number;
      currentNav: number;
    };
    createdAt: string;
    updatedAt: string;
  }

  export interface InferenceResult {
    content: string;
    attestationHash: string;
    teeVerified: boolean;
  }

  export interface SpecialistResult {
    name: string;
    signal: string;
    confidence: number;
    attestationHash: string;
    teeVerified: boolean;
    [key: string]: unknown;  // extra fields from specialist
  }

  export interface DebateResult {
    alpha:    { content: string; parsed: Record<string, unknown>; attestationHash: string; teeVerified: boolean };
    risk:     { content: string; parsed: Record<string, unknown>; attestationHash: string; teeVerified: boolean };
    executor: { content: string; parsed: Record<string, unknown>; attestationHash: string; teeVerified: boolean };
  }

  export interface CycleResult {
    userId: string;
    cycleId: number;
    specialists: SpecialistResult[];
    debate: DebateResult;
    decision: Record<string, unknown>;
    seqNum: number;
    hashscanUrl: string;
    timestamp: Date;
  }

  export interface CompactCycleRecord {
    c: number;        // cycleId
    u: string;        // userId
    t: string;        // ISO timestamp
    rp: string;       // riskProfile
    s: Array<{ n: string; sig: string; conf: number; att: string }>;
    adv: {
      a: { act: string; pct: number; att: string };
      r: { obj: string; max: number; att: string };
      e: { act: string; pct: number; sl: number; att: string };
    };
    d: { act: string; asset: string; pct: number };
    nav: number;
  }

src/store/user-store.ts — UserRecord CRUD
  Exports:
    loadStore(): void
    createUser(walletAddress, proxyWallet): UserRecord
    getUserById(id): UserRecord | undefined
    getUserByWallet(walletAddress): UserRecord | undefined
    getUserByChatId(chatId): UserRecord | undefined
    getActiveUsers(): UserRecord[]
    updateUser(id, patch): UserRecord
    getAllUsers(): UserRecord[]

  Implementation:
    In-memory Map<string, UserRecord> + JSON file persistence (data/users.json).
    loadStore() reads file on boot. persist() writes after every mutation.
    Wallet lookups are case-insensitive (.toLowerCase()).

src/store/crypto.ts — AES-256-CBC encrypt/decrypt
  Uses SERVER_ENCRYPTION_KEY from .env (32-byte hex).
  encrypt(plaintext) → "iv_hex:ciphertext_hex"
  decrypt(ciphertext) → plaintext

src/store/proxy-wallet.ts
  generateProxyWallet() → { address, encryptedKey }
  loadProxyWallet(encryptedKey, provider) → ethers.Wallet

src/store/link-codes.ts
  generateLinkCode(userId) → 6-char string (10 min TTL)
  redeemLinkCode(code) → userId | null
```

**TEST:**
```bash
npx tsx -e "
  import { loadStore, createUser, getUserByWallet } from './src/store/user-store.js';
  import { generateProxyWallet, loadProxyWallet } from './src/store/proxy-wallet.js';
  import { ethers } from 'ethers';
  loadStore();
  const proxy = generateProxyWallet();
  const user = createUser('0xABC123', proxy);
  console.log('Created:', user.id, proxy.address);
  const found = getUserByWallet('0xabc123');
  console.log('Lookup:', found?.id === user.id);
  const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai');
  const wallet = loadProxyWallet(user.proxyWallet.encryptedKey, provider);
  console.log('Decrypted wallet:', wallet.address === proxy.address);
"
```

**COMMIT:** `git commit -m "feat: user store + proxy wallet + types"`

---

### 1B — Hedera HCS (45 min)

**Files you create:**
- `src/config/hedera.ts`
- `src/hedera/hcs.ts`
- `scripts/setup-topic.ts`

```
src/config/hedera.ts
  Exports: client, operatorKey (PrivateKey instance)
  Client.forTestnet().setOperator(OPERATOR_ID, OPERATOR_KEY)
  client.setDefaultMaxTransactionFee(new Hbar(5))

scripts/setup-topic.ts
  Creates private topic with submitKey.
  Prints topic ID → paste into .env HCS_AUDIT_TOPIC_ID.

src/hedera/hcs.ts
  Exports:
    logCycle(topicId, record): Promise<{ seqNum, hashscanUrl }>
      freeze → sign → execute (MANDATORY for private topics)
      Payload < 1024 bytes check.

    getHistory(topicId, limit = 25): Promise<CompactCycleRecord[]>
      6-second delay before mirror node query.
      Decode base64 → JSON.parse in try/catch per message.

    getHistoryForUser(topicId, userId, limit = 10): Promise<CompactCycleRecord[]>
      Overfetch + filter by record.u === userId.
```

**TEST:**
```bash
npx tsx scripts/setup-topic.ts
# → Topic created: 0.0.XXXXX

npx tsx -e "
  import { logCycle, getHistory } from './src/hedera/hcs.js';
  const r = await logCycle(process.env.HCS_AUDIT_TOPIC_ID!, { c: 1, u: 'test', t: new Date().toISOString(), test: true });
  console.log('Logged:', r.seqNum, r.hashscanUrl);
  await new Promise(r => setTimeout(r, 6500));
  const h = await getHistory(process.env.HCS_AUDIT_TOPIC_ID!, 1);
  console.log('Read back:', h[0]);
"
```

**COMMIT:** `git commit -m "feat: hedera HCS — topic + log + history"`

---

### 1C — 0G Inference (45 min)

**Files you create:**
- `src/config/og-compute.ts`
- `src/og/inference.ts`
- `scripts/setup-og-account.ts`

```
src/config/og-compute.ts
  Exports: broker, ogWallet
  System wallet from OG_PRIVATE_KEY (shared, not per-user).

scripts/setup-og-account.ts
  depositFund("10") → listService() → print providers.
  Pick one → .env OG_PROVIDER_ADDRESS.

src/og/inference.ts
  Exports: sealedInference(systemPrompt, userMessage): Promise<InferenceResult>
  Acknowledge once per session (Set cache).
  Single-use headers per request.
  TEE verify with 3 args. Non-fatal catch on verify failure.
```

**TEST:**
```bash
npx tsx scripts/setup-og-account.ts
npx tsx -e "
  import { sealedInference } from './src/og/inference.js';
  const r = await sealedInference('You are a market analyst.', 'Is ETH bullish? Reply JSON: {\"signal\":\"BUY\",\"confidence\":75}');
  console.log(r.content, r.attestationHash, r.teeVerified);
"
```

**COMMIT:** `git commit -m "feat: 0G sealed inference + attestation"`

---

### PHASE 1 — YOUR EXIT GATE

```
Before proceeding, ALL must pass:
✅ User store: create → persist → reload → lookup by wallet/chatId
✅ Proxy wallet: generate → encrypt → decrypt → valid ethers.Wallet
✅ HCS message visible on Hashscan
✅ Mirror node returns message after 6s
✅ 0G inference returns content + attestation + teeVerified=true

DO NOT proceed until all green. Dev B may still be working on x402/specialists — that's fine.
You do NOT need x402 to continue to Phase 2.
```

---

## PHASE 2 — CYCLE ENGINE (Hours 2.5-5.5)

### 2A — Agent Prompts (30 min)

**File:** `src/agents/prompts.ts`

```
All 6 system prompts. Optimized for 7B models.

SPECIALISTS: sentiment, whale, momentum
  Each ends with: "Return ONLY valid JSON: { signal, confidence, ... }"

ADVERSARIAL: alpha, risk, executor
  Each accepts user risk context as part of the user message.
  Alpha: "Risk profile: {rp}. Max: {max}%."
  Risk: "Max allowed: {max}%."
  Executor: "Risk profile: {rp}. Max: {max}%."

Export: PROMPTS object with all 6.

Also export:
  safeJsonParse<T>(raw: string, fallback: T): T
    Strip markdown fences → JSON.parse → catch → fallback.
```

**COMMIT:** `git commit -m "feat: 6 agent prompts for 7B"`

---

### 2B — Adversarial Pipeline (45 min)

**File:** `src/agents/adversarial.ts`

```
Exports:
  runAdversarialDebate(
    specialistResults: SpecialistResult[],
    riskProfile: string,
    maxTradePercent: number
  ): Promise<DebateResult>

Flow:
  1. Build context with specialists + risk constraints
  2. Alpha (FOR) → sealedInference → parse → 2s delay
  3. Risk (AGAINST, sees Alpha) → sealedInference → parse → 2s delay
  4. Executor (DECIDES, sees Alpha + Risk) → sealedInference → parse

Retry: If JSON parse fails, retry ONCE with emphasis suffix. Then fallback HOLD.

DOES NOT import anything from payments or specialists.
Takes SpecialistResult[] as parameter — doesn't care where they came from.
```

**TEST (mock specialists, real 0G):**
```bash
npx tsx -e "
  import { runAdversarialDebate } from './src/agents/adversarial.js';
  const specs = [
    { name: 'sentiment', signal: 'BUY', confidence: 72, attestationHash: 'a', teeVerified: true },
    { name: 'whale', signal: 'BUY', confidence: 65, attestationHash: 'b', teeVerified: true },
    { name: 'momentum', signal: 'HOLD', confidence: 50, attestationHash: 'c', teeVerified: true },
  ];
  const result = await runAdversarialDebate(specs, 'balanced', 12);
  console.log('Alpha:', result.alpha.parsed);
  console.log('Risk:', result.risk.parsed);
  console.log('Executor:', result.executor.parsed);
"
```

**COMMIT:** `git commit -m "feat: adversarial pipeline with risk constraints"`

---

### 2C — Full Cycle Orchestrator + Heartbeat (1.5 hours)

**Files:**
- `src/agents/main-agent.ts`
- `src/agents/heartbeat.ts`

```
src/agents/main-agent.ts

  Exports: runCycle(user: UserRecord): Promise<CycleResult>

  FLOW:
  1. LOAD PROXY WALLET
     const proxyWallet = loadProxyWallet(user.proxyWallet.encryptedKey, provider);
     const viemAccount = privateKeyToAccount(decrypt(user.proxyWallet.encryptedKey) as `0x${string}`);

  2. HIRE SPECIALISTS
     const fetchWithPay = createPaymentFetch(viemAccount);  // ← imported from Dev B's module
     const specs = await Promise.all([
       hire(fetchWithPay, "http://localhost:4001/analyze"),
       hire(fetchWithPay, "http://localhost:4002/analyze"),
       hire(fetchWithPay, "http://localhost:4003/analyze"),
     ]);

  3. ADVERSARIAL DEBATE
     const debate = await runAdversarialDebate(
       specs, user.agent.riskProfile, user.agent.maxTradePercent);

  4. LOG TO HEDERA
     const cycleId = user.agent.lastCycleId + 1;
     const record = buildCompactRecord(cycleId, user, specs, debate);
     const { seqNum, hashscanUrl } = await logCycle(TOPIC_ID, record);

  5. UPDATE USER
     updateUser(user.id, { agent: { ...user.agent, lastCycleId: cycleId, lastCycleAt: new Date().toISOString() }, fund: { ...user.fund, currentNav: calculateNav(debate) } });

  6. RETURN CycleResult

  buildCompactRecord():
    Packs into <1024 byte JSON with userId, riskProfile, specialist attestations,
    adversarial attestations, decision, NAV.

  hire(fetchWithPay, url):
    const res = await fetchWithPay(url);
    if (!res.ok) throw new Error(`Specialist ${url} returned ${res.status}`);
    return await res.json() as SpecialistResult;

  ⚠️ DEPENDENCY ON DEV B:
  This file imports createPaymentFetch from src/payments/x402-client.ts.
  If Dev B hasn't built it yet, use this STUB:

    // STUB — replace when Dev B delivers x402-client.ts
    function createPaymentFetch(_account: any) {
      return async (url: string) => {
        const res = await fetch(url);
        return res;
      };
    }

  When Dev B commits x402-client.ts, remove the stub and import the real one.
  The interface is: createPaymentFetch(viemAccount) → fetch-compatible function.

---

src/agents/heartbeat.ts

  Exports:
    runHeartbeat(): Promise<void>
      Gets all active users → runs cycle for each sequentially.
      try/catch per user — one failure doesn't crash the loop.
      Returns after processing all users.

    startHeartbeatLoop(): void
      setInterval(runHeartbeat, 5 * 60 * 1000)
      Also runs one immediate heartbeat on start.

  ⚠️ DEPENDENCY ON DEV B (for notifications):
  After each cycle, call notifyUser(user, result).
  If Dev B hasn't built telegram/bot.ts yet, use this STUB:

    // STUB — replace when Dev B delivers telegram/bot.ts
    export function notifyUser(user: UserRecord, result: CycleResult): void {
      console.log(`[NOTIFY STUB] User ${user.id}: cycle ${result.cycleId} — ${result.hashscanUrl}`);
    }
```

**TEST (with stubs):**
```bash
# Create test user
npx tsx -e "
  import { loadStore, createUser, updateUser } from './src/store/user-store.js';
  import { generateProxyWallet } from './src/store/proxy-wallet.js';
  loadStore();
  const proxy = generateProxyWallet();
  const u = createUser('0xTestDev', proxy);
  updateUser(u.id, { agent: { ...u.agent, active: true, riskProfile: 'aggressive', maxTradePercent: 25 }, fund: { ...u.fund, depositedUsdc: 100 } });
  console.log('User:', u.id);
"

# Full cycle (specialists must be running — ask Dev B, or test with stubs)
npx tsx src/index.ts
```

**COMMIT:** `git commit -m "feat: runCycle(user) + heartbeat loop"`

---

## PHASE 3 — API SERVER (Hours 5.5-8)

### 3A — Onboarding + Cycle API (2.5 hours)

**Files:**
- `src/api/server.ts`
- `src/api/routes/onboard.ts`
- `src/api/routes/cycle.ts`
- `src/api/routes/fund.ts`

```
src/api/server.ts
  Express app on SERVER_PORT (3001).
  CORS enabled. JSON body parser. Error wrapper.
  Mounts all route modules.

src/api/routes/onboard.ts
  POST /api/onboard
    Verify wallet signature (ethers.verifyMessage).
    Check existing user (getUserByWallet).
    Generate proxy wallet.
    Create user record.
    Generate Telegram link code.
    Return { userId, proxyWalletAddress, telegramLinkCode }.

  POST /api/configure
    Validate riskProfile → derive maxTradePercent.
    Update user.

  GET /api/user/:walletAddress
    Return user record (strip encryptedKey from response!).

  GET /api/stats
    Return { totalUsers, activeAgents, totalCyclesRun, totalValueLocked }.

src/api/routes/cycle.ts
  GET /api/cycle/latest/:userId
    getHistoryForUser(topicId, userId, 1) → return first.

  GET /api/cycle/history/:userId?limit=10
    getHistoryForUser(topicId, userId, limit).

  POST /api/cycle/run/:userId
    Load user → runCycle(user) → return result.

src/api/routes/fund.ts
  POST /api/deposit
    Update fund record. Mint HTS shares (if Sprint 5 done, else mock).
    Set agent.active = true.

  POST /api/withdraw
    Burn shares. Update fund. If full withdrawal → agent.active = false.
```

**⚠️ IMPORTANT: API response for user records must NEVER include `proxyWallet.encryptedKey`.**

Strip it:
```typescript
function sanitizeUser(user: UserRecord) {
  const { proxyWallet, ...rest } = user;
  return { ...rest, proxyWalletAddress: proxyWallet.address };
}
```

**TEST:**
```bash
# Start API
npx tsx src/api/server.ts &

# Onboard
curl -X POST http://localhost:3001/api/onboard \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"0xDEV_A_TEST","signature":"mock","message":"mock"}'

# Configure
curl -X POST http://localhost:3001/api/configure \
  -H "Content-Type: application/json" \
  -d '{"userId":"<uuid-from-above>","riskProfile":"aggressive","notifyPreference":"every_cycle"}'

# Deposit
curl -X POST http://localhost:3001/api/deposit \
  -H "Content-Type: application/json" \
  -d '{"userId":"<uuid>","amount":100}'

# Trigger cycle
curl -X POST http://localhost:3001/api/cycle/run/<uuid>

# Get history
curl http://localhost:3001/api/cycle/history/<uuid>?limit=5
```

**COMMIT:** `git commit -m "feat: onboarding API + cycle endpoints"`

---

## PHASE 4 — HTS TOKEN + STORAGE (Hours 8-10)

### 4A — HTS Fund Token (1 hour)

**Files:**
- `scripts/setup-token.ts`
- `src/hedera/hts.ts`

```
scripts/setup-token.ts
  TokenCreateTransaction: VMFS, decimals 2, supply 0, custom 1% fee.
  All keys = operatorKey. → Print TOKEN_ID.

src/hedera/hts.ts
  Exports:
    mintShares(amount): freeze→sign→execute
    burnShares(amount): freeze→sign→execute
    grantKyc(accountId): freeze→sign→execute
    freezeAccount(accountId)
    unfreezeAccount(accountId)
    getTokenInfo(): { totalSupply, ... }
    getBalance(accountId): number

Wire into API:
  POST /api/deposit → grantKyc (first time) → mintShares → update user
  POST /api/withdraw → burnShares → update user
```

**COMMIT:** `git commit -m "feat: HTS fund token + lifecycle ops"`

---

### 4B — 0G Storage (1 hour)

**Files:**
- `src/config/og-storage.ts`
- `src/og/storage.ts`

```
src/og/storage.ts
  Exports:
    storeMemory(userId, data): Promise<string>  // returns rootHash
    loadMemory(rootHash): Promise<unknown>

  Wire into main-agent.ts: after logCycle, store cycle result to 0G.
```

**COMMIT:** `git commit -m "feat: 0G storage for agent memory"`

---

### 4C — Hedera Scheduled Transactions (30 min)

**File:** `src/hedera/scheduler.ts`

```
  scheduleNextHeartbeat(delaySec = 300):
    ScheduleCreateTransaction wrapping TopicMessageSubmitTransaction.
    Auto-triggers heartbeat.
```

**COMMIT:** `git commit -m "feat: hedera scheduled transactions"`

---

## PHASE 5 — INTEGRATION + STRETCH (Hours 10+)

```
By this point Dev B should have:
  ✅ x402 client + server
  ✅ Specialist servers
  ✅ Telegram bot (multi-tenant)
  ✅ Dashboard UI

YOUR TASKS:
1. Remove stubs:
   - Replace createPaymentFetch stub with real import from Dev B
   - Replace notifyUser stub with real import from Dev B
   - Test full cycle end-to-end

2. Wire HTS into deposit/withdraw API endpoints (real minting)

3. Wire 0G Storage into cycle (store after each cycle)

4. If time: OpenClaw SOUL.md files + iNFT deployment (Sprint 7)

5. Pre-run 50 cycles for demo data
```

---

## YOUR FILE OWNERSHIP (Don't touch Dev B's files)

```
YOU OWN (create + edit freely):
  src/types/index.ts          ← shared types (coordinate with Dev B)
  src/store/**                ← user store, crypto, proxy wallet, link codes
  src/config/hedera.ts
  src/config/og-compute.ts
  src/config/og-storage.ts
  src/hedera/**               ← hcs.ts, hts.ts, scheduler.ts
  src/og/**                   ← inference.ts, storage.ts, verify.ts
  src/agents/prompts.ts
  src/agents/adversarial.ts
  src/agents/main-agent.ts
  src/agents/heartbeat.ts
  src/api/**                  ← server.ts, all route files
  scripts/**                  ← setup-topic.ts, setup-token.ts, setup-og-account.ts
  data/                       ← users.json (gitignored)

DEV B OWNS (don't touch):
  src/config/arc.ts
  src/payments/**
  src/agents/specialist-server.ts
  src/telegram/**
  src/dashboard/**

SHARED (coordinate edits):
  src/types/index.ts          ← add types here, tell Dev B
  src/index.ts                ← boot script (both contribute to boot sequence)
  package.json                ← only for adding deps
  .env                        ← both add their keys
```

---

## SYNC POINTS WITH DEV B

| When | What You Need From Dev B | What Dev B Needs From You |
|------|--------------------------|---------------------------|
| After Phase 0 | Nothing yet | `src/types/index.ts` committed |
| After your Phase 1 | Nothing yet | User store working + types stable |
| Start of your Phase 2C | `createPaymentFetch()` interface (or use stub) | `sealedInference()` exported + working |
| After your Phase 3 | Telegram bot calling your API routes | API server running on :3001 |
| After Dev B's dashboard | Nothing | All API routes documented + tested |
| Integration | `specialist-server.ts` running on :4001-4003 | `runCycle(user)` accepts SpecialistResult[] |
| Integration | `notifyUser()` exported from telegram/bot.ts | heartbeat calls notifyUser after each cycle |

---

## TIMELINE (Your Track)

```
HOUR 0-0.5     Phase 0 (with Dev B)
HOUR 0.5-1.25  1A-α: User store + proxy wallet + types
HOUR 1.25-2    1B: Hedera HCS
HOUR 2-2.75    1C: 0G inference
HOUR 2.75      ── EXIT GATE 1 ──
HOUR 2.75-3.25 2A: Prompts
HOUR 3.25-4    2B: Adversarial pipeline
HOUR 4-5.5     2C: Full cycle + heartbeat (stub payments if needed)
HOUR 5.5       ── EXIT GATE 2 ──
HOUR 5.5-8     Phase 3: API server (onboard + cycle + fund routes)
HOUR 8         ── EXIT GATE 3 ── (Dev B should have Telegram + x402 by now)
HOUR 8-9       4A: HTS token
HOUR 9-10      4B: 0G Storage + 4C: Scheduled Tx
HOUR 10        ── EXIT GATE 4 ──
HOUR 10-11     Remove stubs, wire real imports, integration test
HOUR 11+       Stretch: OpenClaw, iNFT, pre-run demo cycles
```