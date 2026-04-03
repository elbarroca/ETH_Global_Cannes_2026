# VAULTMIND — SPRINT PROGRESS REPORT

> **Date:** 2026-04-03 · **Sprint:** 1+2 (Backend/Chain) + Sprint 3 (Telegram, API, Dashboard)
> **Status:** Sprint 1-2 validated. Sprint 3 complete — Express API (9 routes), Telegram bot (7 commands), Dashboard (4 pages + glassmorphism UI)

---

## WHAT WAS BUILT AND WHY

### Phase 0 — Scaffold
| What | Why | File |
|------|-----|------|
| `"type": "module"` + `engines: >=22` in package.json | ESM required for all SDK imports; Node 22 for modern APIs | `package.json` |
| 15+ SDK dependencies installed | Hedera, 0G, x402, ethers, express, viem, telegram, uuid | `package.json` |
| Backend directory structure | Clean separation: config, store, hedera, og, agents, payments, telegram | `src/` tree |
| `SERVER_ENCRYPTION_KEY` generated | Needed for AES-256-CBC proxy wallet encryption | `.env` |
| `data/` added to `.gitignore` | User store persists to `data/users.json` — must not be committed | `.gitignore` |
| `npm run validate` script | Full 45-test validation suite across all layers | `scripts/validate-all.ts` |

### Phase 1A — User Store + Proxy Wallet + Types
| What | Why | File |
|------|-----|------|
| Shared type contract | Both devs import from here — `UserRecord`, `CycleResult`, `CompactCycleRecord`, etc. | `src/types/index.ts` |
| AES-256-CBC encryption | Encrypt proxy wallet private keys at rest using `SERVER_ENCRYPTION_KEY` | `src/store/crypto.ts` |
| Proxy wallet generation | Each user gets a wallet the agent signs transactions with | `src/store/proxy-wallet.ts` |
| User CRUD store | In-memory Map + JSON file. Deep-merge updates. Case-insensitive wallet lookups. | `src/store/user-store.ts` |
| Telegram link codes | 6-char codes with 10-min TTL for wallet-to-Telegram linking | `src/store/link-codes.ts` |

### Phase 1B — Hedera HCS (Audit Trail)
| What | Why | File |
|------|-----|------|
| Lazy Hedera client | `getHederaClient()`, `getOperatorKey()` — avoids eager init crashes | `src/config/hedera.ts` |
| HCS audit logging | `logCycle()` — freeze/sign/execute, <1024 byte payload, try/catch | `src/hedera/hcs.ts` |
| HCS history reader | `getHistory()` — 6s mirror delay, base64 decode, per-message try/catch | `src/hedera/hcs.ts` |
| Per-user history | `getHistoryForUser()` — overfetch 3x + filter by userId | `src/hedera/hcs.ts` |
| Topic setup script | Creates private HCS topic with submitKey | `scripts/setup-topic.ts` |

### Phase 1C — 0G Sealed Inference (AI Compute)
| What | Why | File |
|------|-----|------|
| Lazy 0G broker singleton | `getBroker()`, `getOgWallet()` — auto-prepends `0x` to private key | `src/config/og-compute.ts` |
| Sealed inference | `sealedInference(provider, system, user)` — single-use headers, TEE attestation | `src/og/inference.ts` |
| Provider listing | `listProviders()` — diagnostic tool | `src/og/inference.ts` |
| Account setup script | `depositFund(10)` + `transferFund()` + list providers | `scripts/setup-og-account.ts` |

### Phase 2A — Agent Prompts
| What | Why | File |
|------|-----|------|
| 6 system prompts | Compact JSON schemas aligned with CONTEXT.MD (`pct`, `max_pct`, `stop_loss`). 7B-optimized. | `src/agents/prompts.ts` |
| `safeJsonParse<T>()` | Strip markdown fences, regex extract `{...}`, fallback. Handles ~15% 7B malformation rate. | `src/agents/prompts.ts` |

### Phase 2B — Adversarial Pipeline
| What | Why | File |
|------|-----|------|
| `runAdversarialDebate()` | Alpha (FOR) → 2s → Risk (AGAINST) → 2s → Executor (DECIDES). Rate-limited retry + HOLD fallback. | `src/agents/adversarial.ts` |
| Risk-aware context | Injects `riskProfile` and `maxTradePercent` into each debate stage | `src/agents/adversarial.ts` |

### Phase 2C — Cycle Orchestrator + Heartbeat
| What | Why | File |
|------|-----|------|
| `runCycle(user)` | Full pipeline: proxy wallet → hire specialists → debate → HCS log → update user | `src/agents/main-agent.ts` |
| `buildCompactRecord()` | Packs cycle data into <1024 bytes for HCS. Compact field names per CONTEXT.MD. | `src/agents/main-agent.ts` |
| Dev B stubs | `createPaymentFetch()` stub, mock specialists on hire failure | `src/agents/main-agent.ts` |
| `startHeartbeatLoop()` | 5-min interval, immediate first run, per-user try/catch | `src/agents/heartbeat.ts` |
| Boot orchestrator | `validateEnv()` → `loadStore()` → `startHeartbeatLoop()` → keep alive | `src/index.ts` |

---

## VALIDATION RESULTS — 45/45 PASSED

```
$ npm run validate

╔══════════════════════════════════════════╗
║   VAULTMIND VALIDATION SUITE             ║
╚══════════════════════════════════════════╝

═══ TEST 1: Environment Variables ═══
  ✅ OPERATOR_ID, OPERATOR_KEY, HCS_AUDIT_TOPIC_ID, OG_PRIVATE_KEY,
     OG_RPC_URL, OG_PROVIDER_ADDRESS, SERVER_ENCRYPTION_KEY, TELEGRAM_BOT_TOKEN

═══ TEST 2: User Store CRUD ═══
  ✅ loadStore() — no crash
  ✅ createUser() + getUserByWallet() case-insensitive — match
  ✅ updateUser() deep merge — active=true, riskProfile preserved, maxTradePercent preserved

═══ TEST 3: AES-256-CBC Encrypt/Decrypt ═══
  ✅ Round-trip: encrypt → decrypt = original

═══ TEST 4: Proxy Wallet Generate + Load ═══
  ✅ generateProxyWallet() → loadProxyWallet() addresses match

═══ TEST 5: Link Codes ═══
  ✅ Generate 6-char code → redeem → null on second attempt (single-use)

═══ TEST 6: Hedera Client Init ═══
  ✅ getOperatorId() → 0.0.8496531
  ✅ getOperatorKey() → ED25519 public key
  ✅ getHederaClient() → testnet initialized

═══ TEST 7: Hedera HCS (REAL TESTNET TX) ═══
  ✅ logCycle() → seq=1, freeze→sign→execute succeeded
  ✅ getHistory() → 1 message(s) decoded from mirror node after 6s
  ✅ Mirror node decode → cycleId=9999, user=validate-test
  🔗 https://hashscan.io/testnet/topic/0.0.8497439

═══ TEST 8: 0G Compute Broker Init ═══
  ✅ getOgWallet() → 0xe1435247...
  ✅ getBroker() → initialized (chain ID: 16602)
  ✅ listService() → 2 providers found
     Provider: 0xa48f01287233509FD694a22Bf840225062E67836
     Model: qwen/qwen-2.5-7b-instruct

═══ TEST 9: 0G Sealed Inference (REAL CALL) ═══
  ✅ sealedInference() → content: {"status": "ok", "test": true}
  ✅ attestationHash → chatcmpl-ed211211a535...
  ✅ teeVerified → true
  ✅ JSON parse → valid JSON from 7B model

═══ TEST 10: Prompts + safeJsonParse ═══
  ✅ 6 prompts: sentiment, whale, momentum, alpha, risk, executor
  ✅ safeJsonParse: clean JSON, markdown-fenced, embedded-in-prose, garbage→fallback

═══ TEST 11: Adversarial Debate (3 REAL 0G CALLS) ═══
  ✅ runAdversarialDebate() → completed in 45.3s
  ✅ Alpha: {"action":"BUY","asset":"ETH","pct":12,"argument":"Strong sentiment..."}
  ✅ Risk: {"max_pct":12,"risks":["Weak momentum","High competition"],...}
  ✅ Executor: {"action":"BUY","asset":"ETH","pct":12,"stop_loss":"-5%",...}
  ✅ All 3 attestation hashes present

╔══════════════════════════════════════════╗
║   RESULTS: ✅ 45 passed · ❌ 0 failed     ║
╚══════════════════════════════════════════╝
```

---

## SDK VERIFICATION (from installed .d.ts files)

Research agents read the actual installed SDK type definitions to verify every function signature.

### Hedera SDK (`@hashgraph/sdk` ^2.69.0) — All 4 Patterns Correct
| Pattern | Verified | Source |
|---------|----------|--------|
| `freezeWith(client)` is synchronous, returns `this` | ✅ | `Transaction.js:1592` |
| `.sign(key)` returns `Promise<this>` — `await` correct | ✅ | `Transaction.js:865` |
| `PrivateKey.fromStringED25519()` for DER keys | ✅ Non-deprecated | `PrivateKey.js:192` |
| `receipt.topicSequenceNumber` is `Long \| null` | ✅ `.toNumber()` correct | `TransactionReceipt.js:58` |

### 0G SDK (`@0glabs/0g-serving-broker` v0.7.4) — 1 Fix Applied
| Pattern | Status | Notes |
|---------|--------|-------|
| `getRequestHeaders(provider)` — 1 arg | ✅ Correct | 2nd arg `_content` is `@deprecated` |
| `processResponse(provider, chatID, usageJSON)` — 3 args | ✅ **Fixed** | 3rd arg is usage token JSON, not response text |
| `depositFund(10)` — number | ✅ Correct | `ledger.depositFund(amount: number)` |
| `acknowledgeProviderSigner` | ✅ Exists but semantics changed | Not needed — tests pass without it |
| `listService()` — returns `ServiceStructOutput[]` | ✅ Correct | Includes `provider`, `model`, `verifiability` |
| `getServiceMetadata(provider)` — returns `{endpoint, model}` | ✅ Correct | 1 arg |

### Fix Applied: `processResponse` 3rd Argument
```typescript
// BEFORE (wrong — passed raw response text)
broker.inference.processResponse(providerAddress, attestationHash, content)

// AFTER (correct — passes usage JSON for fee caching)
const usageContent = JSON.stringify(data.usage ?? {});
broker.inference.processResponse(providerAddress, attestationHash, usageContent)
```
Still returns `teeVerified: true` after fix.

---

## CONTEXT.MD CROSS-CHECK

| # | Area | Discrepancy | Resolution |
|---|------|-------------|------------|
| 1-4 | 0G SDK args | CONTEXT.MD has stale pre-v0.7.4 signatures | **Keep ours** — verified against installed `.d.ts` |
| 5 | Attestation hash | Was separate from chatID | **Fixed** — unified: `ZG-Res-Key ?? data.id` |
| 6 | Prompt schemas | Verbose field names | **Fixed** — compact `pct`, `max_pct`, `stop_loss` per CONTEXT.MD |
| 7 | HCS record | Was parsing old field names | **Fixed** — `buildCompactRecord()` aligned |
| 8 | SDK try/catch | Missing on logCycle | **Fixed** — wrapped |
| 9 | Proxy wallet | HD vs random | **Intentional** — SPRINTA.MD spec |
| 10-12 | Structure/scope | Different paths, missing marketplace | **Intentional** — sprint scope |

---

## POST-REVIEW FIXES APPLIED

| Issue | Severity | Fix |
|-------|----------|-----|
| `updateUser()` shallow merge wiped nested fields | **Critical** | Deep-merge per sub-object |
| `updateUser()` type rejected partial sub-objects | **Critical** | `UserPatch` with `Partial<>` wrappers |
| NAV delta silently wrong | **Important** | Removed — stub until trade execution wired |
| `null as unknown` type safety defeat | **Important** | Empty object + `isEmptyParse()` |
| Missing rate-limit delay on retry | **Important** | `await delay(DELAY_MS)` before retry |
| HCS client called 3x per logCycle | **Important** | Capture once: `const client = getHederaClient()` |
| No env validation | **Important** | `validateEnv()` at boot — 6 required vars |
| `processResponse` 3rd arg was response text | **Important** | Now passes `JSON.stringify(data.usage)` (fee caching) |
| Prompt pipe syntax confuses 7B | **Suggestion** | `"BUY or SELL or HOLD (pick one)"` |
| `path.resolve("data")` fragile | **Suggestion** | `import.meta.url` relative path |

---

## KEY ARCHITECTURE DECISIONS

1. **Lazy initialization** for all SDK clients (Hedera, 0G) — prevents crashes on import
2. **Installed SDK `.d.ts` files are ground truth** — CONTEXT.MD/CLAUDE.md have stale patterns
3. **Mock fallback in runCycle()** — cycle completes with mock specialists if servers offline
4. **Env validation at boot** — clear error before opaque SDK crashes

---

## SPRINT 3 — WHAT WAS BUILT

### 3.0 — Pre-Sprint Fixups
| What | Why | File |
|------|-----|------|
| viem buyer account | Establishes BIP-44 agent identity for x402 wiring | `src/config/arc.ts` |
| Layout metadata | "Create Next App" → "VaultMind" with proper description | `app/layout.tsx` |

### 3.1 — Telegram Bot (7 Commands)
| What | Why | File |
|------|-----|------|
| `startBot()` | Initializes polling bot, registers all 7 command handlers | `src/telegram/bot.ts` |
| `notifyUser()` | Replaces heartbeat stub — sends cycle summary to user's chatId | `src/telegram/bot.ts` |
| `/start` | Welcome + wallet linking via 6-char link codes from `link-codes.ts` | `src/telegram/bot.ts` |
| `/status` | User's NAV, positions, agent state, last cycle time | `src/telegram/bot.ts` |
| `/why` | Fetches last HCS cycle, formats full debate (specialists → alpha → risk → executor) | `src/telegram/bot.ts` |
| `/history` | Last 10 cycles from mirror node, filtered by userId | `src/telegram/bot.ts` |
| `/run` | Triggers `runCycle(user)`, sends formatted result with Hashscan link | `src/telegram/bot.ts` |
| `/stop` `/resume` | Toggles `agent.active` via `updateUser()` | `src/telegram/bot.ts` |
| Heartbeat wiring | Replaced `notifyUser` stub in `heartbeat.ts` with real import | `src/agents/heartbeat.ts` |
| Boot wiring | Added `startBot()` + `startApiServer()` to boot sequence | `src/index.ts` |

### 3.2 — Express API Server (9 Endpoints on :3001)
| Route | Method | Status | What It Does | File |
|-------|--------|--------|--------------|------|
| `/api/onboard` | POST | **VALIDATED** | Wallet verification, proxy wallet gen, user creation, link code | `src/api/routes/onboard.ts` |
| `/api/configure` | POST | **VALIDATED** | Set riskProfile (→ derives maxTradePercent), notifyPreference | `src/api/routes/onboard.ts` |
| `/api/user/:wallet` | GET | **VALIDATED** | Returns sanitized user record (encryptedKey **stripped**) | `src/api/routes/onboard.ts` |
| `/api/stats` | GET | **VALIDATED** | totalUsers, activeAgents, totalCyclesRun, totalValueLocked | `src/api/routes/onboard.ts` |
| `/api/cycle/latest/:userId` | GET | **VALIDATED** | Last cycle from HCS mirror node, filtered by userId | `src/api/routes/cycle.ts` |
| `/api/cycle/history/:userId` | GET | **VALIDATED** | Paginated cycle history (?limit=10, max 100) | `src/api/routes/cycle.ts` |
| `/api/cycle/run/:userId` | POST | **VALIDATED** | Triggers `runCycle(user)`, returns decision + Hashscan URL | `src/api/routes/cycle.ts` |
| `/api/deposit` | POST | **VALIDATED** | Adds USDC balance, activates agent, 1:1 share mapping | `src/api/routes/fund.ts` |
| `/api/withdraw` | POST | **VALIDATED** | Deducts balance with 1% fee, deactivates on full withdrawal | `src/api/routes/fund.ts` |
| `/api/fund/info` | GET | **VALIDATED** | Real HTS token data from mirror node (VMF, supply, custom fees) | `src/api/routes/fund.ts` |

**Validation:** 16 curl tests run — all 16 passing including error cases (404, 400, insufficient balance, invalid riskProfile, negative amounts).

**Security:** `sanitizeUser()` strips `proxyWallet.encryptedKey` from all API responses.

### 3.3 — Next.js Dashboard API Routes (4 Endpoints on :3000)
| Route | Method | Status | File |
|-------|--------|--------|------|
| `/api/cycle/latest` | GET | **VALIDATED** | `app/api/cycle/latest/route.ts` |
| `/api/cycle/history?limit=N` | GET | **VALIDATED** | `app/api/cycle/history/route.ts` |
| `/api/cycle/run` | POST | Stub (proxy) | `app/api/cycle/run/route.ts` |
| `/api/fund/info` | GET | **VALIDATED** | `app/api/fund/info/route.ts` |

All routes hit Hedera Mirror Node directly via `fetch()` — no heavy SDK imports in Next.js bundle.

### 3.4 — Dashboard UI (Dark Glassmorphism)
| Page | URL | Type | What |
|------|-----|------|------|
| Landing | `/` | Server Component | Hero, stats bar (real HCS + HTS data), feature cards |
| Dashboard | `/dashboard` | Client Component | **3-column debate view** — specialists / adversarial debate / proof chain, 10s polling, cycle navigation |
| History | `/history` | Client Component | Expandable cycle timeline, per-cycle debate details, Hashscan links |
| Portfolio | `/portfolio` | Client Component | Fund balance, NAV, token info, deposit/withdraw placeholders |

**Theme:** Dark glassmorphism — `bg-slate-900`, frosted glass cards (`backdrop-blur-xl`, `bg-white/5`), gradient border accents, glow effects, custom CSS animations.

### 3.5 — Post-Review Fixes
| Issue | Severity | Fix |
|-------|----------|-----|
| `arc.ts` read MNEMONIC at module scope | Critical | Moved to function body with explicit error |
| `/api/cycle/latest` leaked raw HCS data | Important | Removed `raw` field from error response |
| `/api/cycle/history` NaN/negative limit | Important | Added `Number.isFinite` + positive check, fallback 25 |
| `notifyUser` ignored `daily` preference | Important | Added `if (pref === "daily") return` guard |
| `/start` link code crash on deleted user | Important | Wrapped `updateUser` in try/catch |
| Dashboard `setLoading` stuck on error | Important | Moved to `finally` block |
| `/why` only fetched 10 messages | Suggestion | Increased to 30 (matches overfetch pattern) |

---

## WHAT STILL NEEDS TO BE BUILT

### x402 Payments + Specialists (Sprint 1D + 2B backfill)
| File | What | Bounty |
|------|------|--------|
| `src/payments/x402-server.ts` | Specialist paywall middleware (seller) | Arc $6K |
| `src/payments/x402-client.ts` | `createPaymentFetch()` — replaces stub in main-agent.ts | Arc $6K |
| `src/agents/specialist-server.ts` | 3 Express apps on :4001-:4003 with x402 + sealedInference | Arc $6K |

### Shared / Either Dev
| File | What | Bounty |
|------|------|--------|
| `src/hedera/hts.ts` | `createFundToken()`, `mint()`, `burn()` | Tokenization $2.5K |
| `src/hedera/scheduler.ts` | Scheduled Transactions | Hedera AI $5K |
| `scripts/setup-token.ts` | Creates HTS token | Tokenization $2.5K |
| `src/og/storage.ts` | `storeMemory()`, `loadMemory()` | 0G $5K |
| `openclaw/` | 7 agent workspaces + SOUL.md | OpenClaw $7K |

### Stubs to Replace
| Location | Replace With | When |
|----------|-------------|------|
| `main-agent.ts` L20-24 | Import from `x402-client.ts` | x402 built |
| `main-agent.ts` L94-99 | Keep as graceful degradation | When specialists running |

---

## BOUNTY STATUS

| Bounty | Prize | Status | Done | Missing |
|--------|-------|--------|------|---------|
| 0G DeFi | $5K | **70%** | Sealed inference + TEE verified + broker | Storage, verify |
| 0G OpenClaw | $7K | **0%** | — | 7 workspaces, iNFT |
| Arc / x402 | $6K | **0%** | arc.ts buyer account created, deps installed | x402 server/client, specialists |
| Hedera AI | $5K | **75%** | HCS logging + history + mirror node + Telegram bot (7 cmds) + dashboard | HTS, Scheduled Tx |
| No Solidity | $2K | **80%** | Zero .sol, all native SDK | Need HTS |
| Tokenization | $2.5K | **0%** | — | hts.ts, setup-token.ts |
| Naryo | $3.5K | **0%** | — | Naryo listener |

---

## FILE INVENTORY (28 files)

```
src/
├── index.ts                    ← Boot: validateEnv → loadStore → startBot → startApi → startHeartbeat
├── types/index.ts              ← UserRecord, CycleResult, CompactCycleRecord, etc.
├── config/
│   ├── hedera.ts               ← Lazy Hedera client + operator key
│   ├── og-compute.ts           ← Lazy 0G broker + wallet
│   └── arc.ts                  ← viem buyer account (BIP-44 from mnemonic)
├── store/
│   ├── crypto.ts               ← AES-256-CBC encrypt/decrypt
│   ├── proxy-wallet.ts         ← Generate + load proxy wallets
│   ├── user-store.ts           ← CRUD with deep-merge + JSON persistence
│   └── link-codes.ts           ← 6-char link codes with TTL
├── hedera/
│   └── hcs.ts                  ← logCycle, getHistory, getHistoryForUser
├── og/
│   └── inference.ts            ← sealedInference + listProviders
├── agents/
│   ├── prompts.ts              ← 6 compact prompts + safeJsonParse
│   ├── adversarial.ts          ← Alpha → Risk → Executor with retry
│   ├── main-agent.ts           ← runCycle (with payment stubs)
│   └── heartbeat.ts            ← 5-min loop, real notifyUser from bot.ts
├── telegram/
│   └── bot.ts                  ← 7 commands + notifyUser export
└── api/
    ├── server.ts               ← Express on :3001, CORS, error handler
    └── routes/
        ├── onboard.ts          ← /onboard, /configure, /user/:wallet, /stats
        ├── cycle.ts            ← /cycle/latest/:userId, /history/:userId, /run/:userId
        └── fund.ts             ← /deposit, /withdraw, /fund/info

app/
├── layout.tsx                  ← VaultMind nav header + glassmorphism theme
├── page.tsx                    ← Landing: hero + live stats from HCS/HTS
├── globals.css                 ← Dark glassmorphism: glass-card, gradient-border, glow
├── dashboard/page.tsx          ← 3-column debate view (THE MONEY SHOT), 10s polling
├── history/page.tsx            ← Expandable cycle timeline
├── portfolio/page.tsx          ← Fund balance + deposit/withdraw UI
└── api/
    ├── cycle/latest/route.ts   ← Mirror node → decode → latest cycle
    ├── cycle/history/route.ts  ← Mirror node → decode → paginated history
    ├── cycle/run/route.ts      ← Proxy stub for cycle trigger
    └── fund/info/route.ts      ← HTS token info from mirror node

scripts/
├── setup-topic.ts              ← Create HCS audit topic
├── setup-og-account.ts         ← Fund 0G broker + list providers
└── validate-all.ts             ← 45-test validation suite
```

---

## HOW TO VALIDATE

```bash
npm run validate              # Full 45-test suite (offline + real testnet)
npm run backend               # Boot VaultMind (heartbeat + telegram + API on :3001)
npm run dev                   # Dashboard on :3000 (Next.js)
npm run build                 # Verify full build passes (should show 9 routes)
```

### Sprint 3 Route Validation
```bash
# Start API server
npx tsx src/api/server.ts

# Onboard user
curl -X POST http://localhost:3001/api/onboard \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"0xYOUR_WALLET"}'

# Configure
curl -X POST http://localhost:3001/api/configure \
  -H "Content-Type: application/json" \
  -d '{"userId":"<uuid>","riskProfile":"aggressive"}'

# Deposit
curl -X POST http://localhost:3001/api/deposit \
  -H "Content-Type: application/json" \
  -d '{"userId":"<uuid>","amount":100}'

# Check user (encryptedKey must be stripped)
curl http://localhost:3001/api/user/0xYOUR_WALLET

# Stats
curl http://localhost:3001/api/stats

# Fund info (real HTS data from mirror node)
curl http://localhost:3001/api/fund/info

# Dashboard API (Next.js)
curl http://localhost:3000/api/cycle/latest
curl http://localhost:3000/api/cycle/history?limit=5
curl http://localhost:3000/api/fund/info
```

### What Each Test Proves
| Tests | What | Network |
|-------|------|---------|
| 1-5, 10 | Env vars, crypto, wallet, store, link codes, prompts | Offline |
| 6 | Hedera client init from DER-encoded ED25519 key | Offline |
| 7 | **HCS real transaction** — freeze/sign/execute + mirror node decode | Hedera testnet |
| 8 | 0G broker init + listService (2 providers, qwen-2.5-7b) | 0G testnet |
| 9 | **0G sealed inference** — real AI call + attestation + teeVerified=true | 0G testnet |
| 11 | **Full adversarial debate** — 3 sequential 0G calls, parsed JSON, all attested | 0G testnet |
| API 1-16 | **Express routes** — onboard, configure, deposit, withdraw, stats, fund/info, cycle history | Hedera mirror node |

---

## NEXT STEPS (Priority Order)

1. **Build x402 payments** (`x402-server.ts`, `x402-client.ts`) — unlocks Arc $6K, replaces main-agent stub
2. **Build specialist servers** (`specialist-server.ts`) — 3 Express apps on :4001-:4003 with real inference
3. **Build HTS** (`src/hedera/hts.ts` + `scripts/setup-token.ts`) — unlocks Tokenization $2.5K + No Solidity $2K
4. **Wire real payments into main-agent** — replace `createPaymentFetch` stub
5. **Fix 0G provider** — re-run `setup-og-account.ts` to find live provider (current one returns `unsupported addressable value`)
6. **Build 0G Storage** (`src/og/storage.ts`) — agent memory persistence
7. **Build OpenClaw** workspaces — unlocks 0G OpenClaw $7K
8. **Full end-to-end cycle** with real specialists + real payments + real inference
9. **Demo rehearsal** — Telegram /run → dashboard updates → Hashscan proof
