# AlphaDawg — Setup Status & What Needs to Work

> Generated 2026-04-04 from live Supabase data + codebase analysis.
> Covers client agent pipeline only (OpenClaw integration is separate).

---

## LIVE DATABASE SNAPSHOT

| Table | Rows | Verdict |
|-------|------|---------|
| `users` | 5 (2 real, 3 test) | Working |
| `cycles` | 21 | Working |
| `agent_actions` | 268 | Working |
| `marketplace_agents` | 10 (5 active, 5 never hired) | Working |
| `debate_transcripts` | 92 | Working |
| `pending_cycles` | 26 (73% timed out) | Partial |
| `user_hired_agents` | 3 | Working |
| `chat_messages` | 0 | Not used |
| `naryo_events` | 0 | Not started |
| `naryo_correlations` | 0 | Not started |

---

## FEATURE STATUS MATRIX

### FULLY WORKING (no action needed)

| Feature | Evidence | Key Files |
|---------|----------|-----------|
| **Onboarding + wallet creation** | 5 users, all have proxy + hot wallet | `app/api/onboard/route.ts` |
| **Circle MPC proxy wallets** | All 5 users have `proxy_wallet.walletId` | `src/payments/circle-wallet.ts` |
| **USDC deposit + HTS mint** | User `0xe143` has $5 deposited, 5 HTS shares | `app/api/deposit/route.ts`, `src/hedera/hts.ts` |
| **x402 specialist payments** | 125 paid hires with `payment_tx_hash` | `src/config/arc.ts`, `src/payments/x402-client.ts` |
| **0G sealed inference** | 100% attestation rate on all 84 debate actions | `src/og/inference.ts` |
| **Adversarial debate** | 3-phase (intelligence→opening→decision) running | `src/agents/adversarial.ts` |
| **HCS audit logging** | 21/21 cycles logged (100%) | `src/hedera/hcs.ts` |
| **0G storage** | 19/20 cycles stored (95%) | `src/og/storage.ts` |
| **Marketplace + ELO reputation** | 5 agents with diverging scores (610-692) | `src/marketplace/registry.ts`, `src/marketplace/reputation.ts` |
| **Telegram bot** | 2 users linked, notifications working | `src/telegram/bot.ts` |
| **Heartbeat loop** | Running every 5 min, scheduling on Hedera | `src/agents/heartbeat.ts` |
| **Supabase persistence** | All tables synced, RLS enabled on all 10 | Prisma schema + migrations |

---

### BROKEN — Needs Fix

#### 1. On-chain Swap Execution
**Status:** 0 successful swaps out of 21 cycles
**Root cause:** `ARC_SWAP_ROUTER` not set → falls back to direct USDC self-transfer → that also fails (likely insufficient USDC on hot wallet on Arc testnet)

**What happens in code:**
```
arc-swap.ts:87 → if (!ARC_SWAP_ROUTER) → executeDirectTransfer()
                                        → transfer USDC to self → fails (no balance)
```

**Env vars needed:**
```env
# Option A: Set Uniswap router (if DEX exists on Arc testnet)
ARC_UNISWAP_ROUTER=0x...          # Uniswap V3 SwapRouter on Arc
ARC_WETH_ADDRESS=0x...             # WETH on Arc (currently defaults to 0x000...0)

# Option B: Fund the hot wallets with Arc testnet USDC
# User's hot wallet needs USDC on Arc chain to execute transfers
```

**Fix options (pick one):**
1. **Deploy a mock swap router** — simplest for demo, logs a real tx hash
2. **Fund hot wallets** — Circle `agentTransfer()` tops up hot wallet, but on Base Sepolia, not Arc
3. **Bridge USDC to Arc** — if Arc testnet has a faucet/bridge
4. **Accept direct_transfer as "swap"** — just needs hot wallet funding on Arc

**Files:** `src/execution/arc-swap.ts`, `src/config/arc-chain.ts`

---

#### 2. iNFT Minting (ERC-7857)
**Status:** 0 tokens minted across all 5 users (`inft_token_id` = null for all)
**Root cause:** `INFT_CONTRACT_ADDRESS` not set in runtime `.env`

**What happens:**
```
onboard/route.ts:58 → if (process.env.INFT_CONTRACT_ADDRESS) → skips mint
main-agent.ts:237   → if (user.inftTokenId && storageHash) → skips metadata update
```

**Contract is deployed** (per CLAUDE.md):
```
VaultMindAgent: 0x73e3016D0D3Bf2985c55860cd2A51FF017c2c874 (0G Chain 16602)
```

**Fix:**
```env
INFT_CONTRACT_ADDRESS=0x73e3016D0D3Bf2985c55860cd2A51FF017c2c874
```
Then re-onboard users or run a backfill script to mint iNFTs for existing users.

**Files:** `src/og/inft.ts`, `app/api/onboard/route.ts`

---

#### 3. Pending Cycle Timeouts (73% rate)
**Status:** 19/26 pending cycles timed out, only 2 approved, 1 rejected
**Root cause:** All cycles come from `heartbeat` origin with default 10-min TTL. User doesn't respond to Telegram approval fast enough.

**What happens:**
```
heartbeat.ts → createPendingCycle(10min TTL)
             → sends Telegram approval buttons
             → user doesn't tap in time
             → timeout-checker.ts resolves as TIMED_OUT
             → balanced profile → auto-approves on timeout
```

**Fix options:**
1. **Set approval mode to "auto"** for demo users — skips pending entirely
2. **Reduce TTL** from 10min to 3min
3. **Auto-approve on timeout** regardless of risk profile (already happens for `balanced`)

**Where to change:** User's `agent` JSON field:
```sql
UPDATE users SET agent = jsonb_set(agent, '{approvalMode}', '"auto"')
WHERE id = '6d2bc1ce-...';
```

**Files:** `src/agents/heartbeat.ts`, `src/store/pending-cycles.ts`

---

### NOT WIRED — Needs Integration

#### 4. Marketplace Wallet + OpenClaw Fields
**Status:** All 10 marketplace agents have `wallet_address = null` and `openclaw_agent_id = null`
**Impact:** Specialists can't receive x402 payments at their own address; can't be routed to OpenClaw sessions

**What CONTEXT.MD says:**
> Each specialist has own wallet... payTo for x402... Stored: marketplace_agents table

**What actually happens:**
- `registry.ts:registerSpecialist()` doesn't accept `walletAddress` or `openclawAgentId`
- x402 payments go to a hardcoded address from `specialist-server.ts` (not per-agent)
- When OpenClaw deploys, need to wire `openclawAgentId` for session routing

**Fix (after OpenClaw deploy):**
```sql
UPDATE marketplace_agents SET
  wallet_address = '0x...specialist_wallet...',
  openclaw_agent_id = 'openclaw-agent-uuid'
WHERE name = 'sentiment';
-- repeat for each specialist
```

**Files:** `src/marketplace/registry.ts`, `src/agents/specialist-server.ts`

---

#### 5. Naryo Event Listener
**Status:** NOT STARTED (0 events, 0 correlations)
**Build status in CLAUDE.md:** "NOT STARTED"

**What's needed:**
```env
HEDERA_EVM_PRIVATE_KEY=0x...     # ECDSA key (from setup-hedera-evm.ts)
HEDERA_EVM_ACCOUNT_ID=0.0.XXX   # Hedera EVM account
NARYO_AUDIT_CONTRACT_ADDRESS=0x... # Deploy via deploy-naryo-contract.ts
HEDERA_JSON_RPC_URL=https://testnet.hashio.io/api  # (has default)
```

**Setup steps:**
1. `npx tsx scripts/setup-hedera-evm.ts` → creates ECDSA Hedera account
2. `npx tsx scripts/deploy-naryo-contract.ts` → deploys AlphaDawgAuditLog.sol
3. Add output env vars to `.env`
4. Integrate Naryo SDK listener (external — not in repo yet)
5. Wire `processNaryoEvent()` to Naryo webhook endpoint

**Files:** `src/naryo/event-handler.ts`, `src/naryo/emit-event.ts`, `scripts/deploy-naryo-contract.ts`

---

#### 6. Chat Messages
**Status:** 0 rows, table exists but never written to
**Impact:** Low — not a bounty requirement
**Purpose:** Future conversational interface (user ↔ agent chat in dashboard)

---

### GAPS vs CONTEXT.MD

| CONTEXT.MD Says | Reality | Gap |
|-----------------|---------|-----|
| 5 debate phases (intelligence, opening, rebuttal, decision, execution) | Only 3 phases recorded (intelligence, opening, decision) | Rebuttal only triggers when confidence < 60%. Execution phase never recorded — happens at main-agent level, not debate level |
| Specialist wallets stored in `marketplace_agents` | All `wallet_address` = null | x402 payments use hardcoded address from specialist-server |
| iNFT minted on onboard | All `inft_token_id` = null | Contract deployed but env var not set in runtime |
| Arc swap execution | 0 successful swaps | No router + no hot wallet balance on Arc |
| Naryo multichain listener | 0 events | Not started (bounty #16) |
| User Prisma schema has flat columns | Actual schema uses JSONB blobs (`agent`, `fund`, `telegram`, `proxy_wallet`) | Diverged from CONTEXT.MD spec — working fine, just different structure |
| `AGENT_MASTER_SEED` env var | Actual code uses `AGENT_MNEMONIC` | Naming difference — code works |

---

## SETUP CHECKLIST — What to Do Now

### Priority 1: Demo-Critical (do before demo)

- [ ] **Set `INFT_CONTRACT_ADDRESS`** in `.env` → enables iNFT minting on onboard
  ```
  INFT_CONTRACT_ADDRESS=0x73e3016D0D3Bf2985c55860cd2A51FF017c2c874
  ```

- [ ] **Set approval mode to "auto"** for demo user → eliminates 73% timeout issue
  ```sql
  UPDATE users SET agent = jsonb_set(agent, '{approvalMode}', '"auto"')
  WHERE wallet_address = '0xe1435247b7373dac9027c4bd3e135e122e6aeb9a';
  ```

- [ ] **Backfill iNFT** for existing users (or re-onboard a fresh user)

- [ ] **Fund hot wallet on Arc testnet** with USDC for swap demo
  - Get Arc testnet USDC from faucet
  - Or deploy mock swap router

### Priority 2: Bounty-Critical (do before submission)

- [ ] **Deploy Naryo contract** → `npx tsx scripts/setup-hedera-evm.ts` + `scripts/deploy-naryo-contract.ts`
- [ ] **Set Naryo env vars** (`HEDERA_EVM_PRIVATE_KEY`, `NARYO_AUDIT_CONTRACT_ADDRESS`)
- [ ] **Wire Naryo webhook** to `processNaryoEvent()`
- [ ] **Populate `marketplace_agents.wallet_address`** for at least the 5 active specialists
- [ ] **Test full cycle with iNFT** — confirm mint + metadata update in same flow

### Priority 3: Polish (nice-to-have)

- [ ] Wire `openclaw_agent_id` after OpenClaw deploy
- [ ] Add rebuttal phase logging when confidence < 60%
- [ ] Add execution phase to debate transcript schema
- [ ] Implement chat messages feature
- [ ] Clean up 3 test users from DB

---

## CURRENT DATA HEALTH

### Active User: `0xe143...` (your main test user)
- **21 cycles** completed
- **$5 USDC** deposited, **5 HTS shares** minted
- **20/21 HCS logged**, **19/21 stored to 0G**
- **0 swaps** executed (Arc swap broken)
- **0 iNFT** (contract not set)
- **Telegram linked** ✓
- **2 marketplace agents hired** (whale, sentiment)

### Marketplace Leaderboard
| Rank | Agent | ELO | Hires | Accuracy |
|------|-------|-----|-------|----------|
| 1 | momentum | 692 | 24 | 104% (overcounted) |
| 2 | whale | 670 | 24 | 92% |
| 3 | onchain-forensics | 650 | 24 | 71% |
| 4 | defi-yield | 618 | 24 | 67% |
| 5 | sentiment | 610 | 24 | 100% |
| 6-10 | twitter-alpha, news-scanner, options-flow, macro-correlator, memecoin-hunter | 500 | 0 | — |

### Pending Cycles Health
- 19 TIMED_OUT (auto-resolved)
- 4 PENDING_APPROVAL (stale — should be cleaned up)
- 2 APPROVED
- 1 REJECTED
