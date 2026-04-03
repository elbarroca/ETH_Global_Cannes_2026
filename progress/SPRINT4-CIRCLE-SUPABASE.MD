# SPRINT 4 — Circle MPC Wallets + Supabase Migration

> **Date:** 2026-04-04 · **Status:** Complete — 30/30 E2E tests passing
> **Scope:** Replace ethers random wallets with Circle MPC custody. Migrate user store from JSON file to Supabase PostgreSQL.

---

## WHAT WAS BUILT AND WHY

### 4.0 — Circle MPC Wallet Integration

| What | Why | File |
|------|-----|------|
| Circle SDK installed | `@circle-fin/developer-controlled-wallets@10.1.0` — MPC custody, keys never leave Circle HSM | `package.json` |
| `createProxyWallet(userId)` | Creates EOA on Base Sepolia via Circle MPC — tagged with userId as refId | `src/payments/circle-wallet.ts` |
| `getProxyBalance(walletId)` | Queries Circle for token balances on proxy wallet | `src/payments/circle-wallet.ts` |
| `agentTransfer(walletId, to, amount)` | Initiates USDC transfer from proxy wallet via Circle — fee level MEDIUM | `src/payments/circle-wallet.ts` |
| Circle setup script | One-time: registers entity secret, creates wallet set, tests wallet creation | `scripts/setup-circle.ts` |
| Entity secret registered | RSA-encrypted ciphertext stored at Circle — SDK handles per-request regeneration | Circle cloud |
| Wallet set created | `17d03558-550e-5d5e-9bac-48410f320485` — all agent wallets belong to this set | `.env` |
| Test wallet verified | `0xc8b2bf57ef75621db60aef129484ed68b8eae650` on Base Sepolia | Confirmed |
| Recovery file gitignored | `circle-recovery*` + `*.dat` in `.gitignore` — prevents secret leakage | `.gitignore` |
| Entity secret masked in stdout | Only shows first 6 + last 4 chars in console | `scripts/setup-circle.ts` |

### 4.1 — Supabase PostgreSQL Migration

| What | Why | File |
|------|-----|------|
| `postgres` (postgres.js) installed | Tagged template literals — SQL injection safe by construction | `package.json` |
| Database connection singleton | Lazy init via `DIRECT_URL` (port 5432, session mode, SSL required) | `src/config/database.ts` |
| Users table DDL | `id TEXT PK`, `wallet_address TEXT UNIQUE`, 4 JSONB columns, timestamps | `scripts/migrate.ts` |
| Auto `updated_at` trigger | `trg_users_updated_at` fires BEFORE UPDATE — no stale timestamps | `scripts/migrate.ts` |
| `user-store.ts` full rewrite | JSON file persistence replaced with Supabase postgres.js queries | `src/store/user-store.ts` |
| Atomic JSONB merge | Uses SQL `||` operator in UPDATE — no read-then-write race condition | `src/store/user-store.ts` |
| `createUser` accepts optional userId | Ensures Circle wallet `refId` matches stored user ID | `src/store/user-store.ts` |
| Same export signatures | All downstream callers unchanged except adding `await` | `src/store/user-store.ts` |

### 4.2 — Type Change: Circle Wallet Shape

| What | Before | After |
|------|--------|-------|
| `UserRecord.proxyWallet` | `{ address: string; encryptedKey: string }` | `{ walletId: string; address: string }` |
| Onboard route | `generateProxyWallet()` (ethers random) | `createProxyWallet(userId)` (Circle MPC) |
| Withdraw route | Burns HTS only | Burns HTS + `agentTransfer()` via Circle |
| Main agent cycle | `loadProxyWallet()` ethers Wallet | Address-only reference (Circle holds keys) |

### 4.3 — Async Cascading

All store functions now return `Promise<>`. Updated 7 downstream files:

| File | Functions Awaited |
|------|-------------------|
| `src/api/routes/onboard.ts` | `getUserByWallet`, `createUser`, `updateUser`, `getAllUsers`, `getActiveUsers` |
| `src/api/routes/cycle.ts` | `getUserById` |
| `src/api/routes/fund.ts` | `getUserById`, `updateUser` |
| `src/agents/main-agent.ts` | `updateUser` |
| `src/agents/heartbeat.ts` | `getActiveUsers` |
| `src/telegram/bot.ts` | `getUserByChatId`, `updateUser` (all 6 command handlers) |
| `src/index.ts` | `loadStore` (now no-op, connection lazy) |

---

## CODE REVIEW FIXES APPLIED

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| 1 | `updated_at` never set in UPDATE | Critical | Explicit `updated_at = NOW()` + DB trigger |
| 2 | `circle-recovery.dat` not gitignored | Critical | Added `circle-recovery*` + `*.dat` |
| 3 | `.mcp.json` exposes Supabase project ref | Critical | Added `.mcp.json` to `.gitignore` |
| 4 | Dual UUID — Circle `refId` != stored user ID | Critical | `createUser()` accepts optional `userId` param |
| 5 | Read-then-write race in `updateUser` | Important | Atomic SQL JSONB `||` merge |
| 8 | `GET /user/:wallet` missing error handler | Important | Added try/catch |
| 9 | Entity secret printed plaintext | Important | Masked output |

---

## E2E VALIDATION — 30/30 PASSED

```
╔══════════════════════════════════════════╗
║   VaultMind E2E Validation — Dev A       ║
╚══════════════════════════════════════════╝

GATE 1 — User Store + Circle Wallet + Link Codes

[Circle Wallet]
  ✅ createProxyWallet returns walletId
  ✅ createProxyWallet returns address (0x...)

[User Store — Supabase]
  ✅ createUser returns matching id
  ✅ createUser stores walletId
  ✅ createUser stores address
  ✅ createUser defaults: agent.active=false
  ✅ createUser defaults: riskProfile=balanced
  ✅ createUser defaults: fund.depositedUsdc=0

[Lookups]
  ✅ getUserById finds user
  ✅ getUserByWallet case-insensitive

[Update User]
  ✅ updateUser: agent.active=true
  ✅ updateUser: riskProfile=aggressive
  ✅ updateUser: maxTradePercent=25
  ✅ updateUser: depositedUsdc=500
  ✅ updateUser: chatId set
  ✅ updateUser: updatedAt changed

[Partial Update — no data loss]
  ✅ partial update preserves riskProfile
  ✅ partial update preserves depositedUsdc
  ✅ partial update sets lastCycleId=5

[Chat ID Lookup]
  ✅ getUserByChatId finds user

[Active Users]
  ✅ getActiveUsers finds at least 1
  ✅ getActiveUsers includes our user

[Link Codes]
  ✅ generateLinkCode returns 6 chars
  ✅ redeemLinkCode returns correct userId
  ✅ redeemLinkCode single-use (null on second)
  ✅ redeemLinkCode invalid code returns null

[Multi-user]
  ✅ Second user created
  ✅ Second user has different wallet
  ✅ getAllUsers returns 2+ users

[Circle Balance]
  ✅ getProxyBalance returns array

╔══════════════════════════════════════════╗
║  Results: 30 passed, 0 failed            ║
╚══════════════════════════════════════════╝
```

### Supabase MCP Verification

```
mcp__supabase__list_tables → public.users (RLS disabled)
  id              TEXT PK
  wallet_address  TEXT UNIQUE
  proxy_wallet    JSONB  {walletId, address}
  telegram        JSONB  {chatId, username, verified, notifyPreference}
  agent           JSONB  {active, riskProfile, maxTradePercent, lastCycleId, lastCycleAt}
  fund            JSONB  {depositedUsdc, htsShareBalance, currentNav}
  inft_token_id   INTEGER nullable
  created_at      TIMESTAMPTZ (default NOW())
  updated_at      TIMESTAMPTZ (auto-trigger)

mcp__supabase__execute_sql("SELECT COUNT(*) FROM users") → 0 (clean after tests)
```

---

## .env KEYS ADDED

```env
# Supabase
DATABASE_URL=postgresql://...@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://...@aws-1-eu-west-2.pooler.supabase.com:5432/postgres

# Circle (console.circle.com)
CIRCLE_API_KEY=TEST_API_KEY:caa9caa4...
CIRCLE_ENTITY_SECRET=e752b8c4...
CIRCLE_WALLET_SET_ID=17d03558-550e-5d5e-9bac-48410f320485
USDC_BASE_SEPOLIA_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

---

## FILES CHANGED

| Action | File | What |
|--------|------|------|
| **CREATED** | `src/config/database.ts` | Supabase postgres.js connection singleton |
| **CREATED** | `src/payments/circle-wallet.ts` | Circle MPC wallet: create, balance, transfer |
| **CREATED** | `scripts/migrate.ts` | Users table DDL + updated_at trigger |
| **CREATED** | `scripts/setup-circle.ts` | Entity secret + wallet set + test wallet |
| **CREATED** | `scripts/test-e2e.ts` | 30-check E2E validation suite |
| **CREATED** | `scripts/test-db.ts` | Supabase connection + CRUD test |
| **CREATED** | `scripts/test-store.ts` | User-store module test |
| **REWRITTEN** | `src/store/user-store.ts` | JSON file → Supabase (atomic JSONB merge) |
| **MODIFIED** | `src/types/index.ts` | `proxyWallet: { walletId, address }` |
| **MODIFIED** | `src/api/routes/onboard.ts` | Circle wallet + userId passthrough |
| **MODIFIED** | `src/api/routes/fund.ts` | `agentTransfer` on withdraw |
| **MODIFIED** | `src/api/routes/cycle.ts` | Async store calls |
| **MODIFIED** | `src/agents/main-agent.ts` | Removed ethers wallet loading |
| **MODIFIED** | `src/agents/heartbeat.ts` | Async `getActiveUsers` |
| **MODIFIED** | `src/telegram/bot.ts` | Async store calls (all 6 handlers) |
| **MODIFIED** | `src/index.ts` | Updated boot message |
| **MODIFIED** | `.env` | Circle + Supabase credentials |
| **MODIFIED** | `.gitignore` | circle-recovery*, *.dat, .mcp.json |
| **MODIFIED** | `package.json` | 2 deps + migrate/setup:circle scripts |

---

## HOW TO VALIDATE

```bash
# Run migration (already done)
npm run migrate

# Run Circle setup (already done)
npm run setup:circle

# Run E2E validation
./node_modules/.bin/tsx scripts/test-e2e.ts

# Boot full backend
npm run backend
```
