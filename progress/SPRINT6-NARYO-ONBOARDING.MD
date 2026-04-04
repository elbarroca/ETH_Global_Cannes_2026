# SPRINT 6 — Naryo Integration + Onboarding Flow Fix

> **Date:** 2026-04-04 (Day 2, afternoon) · **Status:** Complete — All on-chain, build passing
> **Scope:** Fix wallet→Telegram→deposit onboarding flow. Deploy Naryo multichain event listener for $3.5K bounty. Sync DB schema with Prisma.

---

## WHAT WAS BUILT AND WHY

### 6.1 — Onboarding Flow (Connect → Telegram → Fund)

The entire onboarding pipeline was broken. Users could connect a wallet but nothing happened after — no Telegram modal, no funding prompt, no proxy wallet display. Four root causes fixed:

| Problem | Root Cause | Fix | File |
|---------|-----------|-----|------|
| Chain error 4902 on wallet connect | Arc Testnet not in wallet, Dynamic Labs unhandled rejection | `ChainGuard` component auto-switches chain + suppresses 4902/4001 | `contexts/wagmi-provider.tsx` |
| Telegram link code not redeemable | Codes in in-memory `Map`, but Next.js and Express are separate processes | Rewrote to Supabase-backed: store in `telegram` JSONB column, atomic redeem via SQL | `src/store/link-codes.ts` |
| Link code regenerated every 10s | Stale closure: `linkCode` not in `useCallback` deps → `onboard()` called every poll | Added `linkCodeFetchedRef` to prevent repeated generation | `contexts/user-context.tsx` |
| Wrong Telegram bot username | Hardcoded `AlphaDawgBot` in dashboard | Changed to `ETHGlobal_Cannes_2026_Bot` | `app/dashboard/page.tsx` |

**New modals (unskippable):**

| Modal | When Shown | File |
|-------|-----------|------|
| `TelegramModal` | User onboarded but `telegram.verified === false` | `components/telegram-modal.tsx` → rendered in `app/dashboard/page.tsx` |
| `FundingModal` | Telegram verified but `fund.depositedUsdc === 0` | `components/funding-modal.tsx` → rendered in `app/dashboard/page.tsx` |

**Flow is now:** Connect Wallet → Telegram Modal (unskippable) → Fund Agent Modal (unskippable) → Dashboard

### 6.2 — Deposit Flow Fix

Deposits were completely broken — wrong transfer method and wrong decimals.

| Problem | Root Cause | Fix | File |
|---------|-----------|-----|------|
| Wallet shows suspicious tx / user denies | Used ERC-20 `writeContract` to precompile `0x3600...` | Arc native currency IS USDC → use `useSendTransaction` (native value transfer) | `app/deposit/page.tsx` |
| Amounts 10^12x too small | Used 6 decimals (standard USDC) | Arc USDC is 18 decimals (native token) | `app/deposit/page.tsx` |
| React render-time state update | Post-confirmation logic outside `useEffect` | Moved to proper `useEffect` with deps | `app/deposit/page.tsx` |
| Chain config says ETH | wagmi-provider `nativeCurrency.symbol = "ETH"` | Changed to `"USDC"` matching Arc Testnet | `contexts/wagmi-provider.tsx` |
| Hydration mismatch error | `AuthGuard` renders loading div conflicting with Dynamic Labs SSR | Added `mounted` state to defer conditional UI until hydration | `components/auth-guard.tsx` |

### 6.3 — Agent Wallet UI

| What | Why | File |
|------|-----|------|
| Agent Wallet card in status bar | Users had no visibility into proxy wallet address or balance | `app/dashboard/page.tsx` |
| Wallet icon + "Circle MPC" badge | Shows custody provider clearly | `app/dashboard/page.tsx` |
| Balance display (gold when funded) | Users need to see USDC balance at a glance | `app/dashboard/page.tsx` |
| Deposit/Manage button | Quick access to deposit page | `app/dashboard/page.tsx` |
| Status indicators row | Telegram, Agent active/paused, risk profile — all visible | `app/dashboard/page.tsx` |

### 6.4 — Telegram Bot Polling Fix

| Problem | Fix | File |
|---------|-----|------|
| `ETELEGRAM: 409 Conflict` errors flooding logs | Next.js instrumentation was starting the bot alongside Express backend | `instrumentation.ts` |
| Two bot instances fighting | Bot only starts in instrumentation if `NEXT_START_BOT=true` | `instrumentation.ts` |

### 6.5 — Database Schema Sync

14 missing columns and 2 missing tables discovered and added via Supabase MCP:

| Table | Columns Added |
|-------|--------------|
| `cycles` | `alpha_reasoning`, `risk_reasoning`, `exec_reasoning`, `swap_tx_hash`, `swap_chain`, `swap_amount`, `swap_asset_in`, `swap_asset_out`, `swap_explorer_url`, `debate_duration_ms`, `debate_turns` |
| `marketplace_agents` | `specialist_type`, `data_sources`, `openclaw_agent_id`, `wallet_address` |
| `debate_transcripts` | **Created table** (full schema with indexes) |
| `chat_messages` | **Created table** (full schema with indexes) |

---

## 6.6 — Naryo Multichain Event Listener ($3.5K Bounty)

### What Is Naryo

Naryo is a Java/Spring Boot sidecar (Linux Foundation Decentralized Trust) that polls DLT nodes for events and pushes matches to your app via HTTP POST. Runs as a Docker container.

### Architecture

```
[Hedera Testnet Mirror Node]  +  [0G Chain RPC]
        |                              |
        | POLL 2s                      | POLL 5s
        v                              v
  [Naryo Docker Container — 2 nodes, 6 filters]
        |
        | HTTP POST
        v
  [Next.js API: /api/naryo/events/{source}]
        |
        v
  [Supabase naryo_events + naryo_correlations]
        |
        v
  [Dashboard NaryoFeed widget + cross-chain correlation proofs]
```

### Contract: AlphaDawgAuditLog.sol

Deployed to **Hedera Testnet EVM** (chainId 296). Emits events that Naryo captures.

| Event | Purpose | Tested |
|-------|---------|--------|
| `CycleCompleted(user, cycleId, action, asset, pct)` | Hunt cycle decision | tx `0xc4f8...` |
| `SpecialistHired(user, specialistName, cost)` | Specialist hiring | in contract |
| `DepositRecorded(user, amount, newNav)` | USDC deposit | tx `0x35c7...` |
| `HeartbeatEmitted(timestamp, activeUsers)` | Heartbeat tick | tx `0xae5c...` |
| `CrossChainCorrelation(sourceChain, eventType, txHash)` | Multi-DLT proof | tx `0x444d...` |

### On-Chain Assets

| Asset | Address / ID | Network |
|-------|-------------|---------|
| AlphaDawgAuditLog | `0x66D2b95e6228E7639f9326C5573466579dd7e139` | Hedera Testnet EVM |
| ECDSA Account | `0.0.8506642` | Hedera Testnet |
| EVM Address | `0xee02a15F871B8B3798F4931a9614225656C4C760` | Hedera Testnet EVM |

### Naryo Filters (6 total — 2 chains)

| # | Filter | Type | Target | Chain |
|---|--------|------|--------|-------|
| 1 | HCS topic messages | TRANSACTION | `0.0.8497439` | Hedera |
| 2 | HTS token transfers | TRANSACTION | `0.0.8498202` | Hedera |
| 3 | CycleCompleted | EVENT/CONTRACT | AuditLog | Hedera EVM |
| 4 | DepositRecorded | EVENT/CONTRACT | AuditLog | Hedera EVM |
| 5 | AgentMinted | EVENT/CONTRACT | VaultMindAgent | 0G Chain |
| 6 | MetadataUpdated | EVENT/CONTRACT | VaultMindAgent | 0G Chain |

### Files Created

| File | Purpose |
|------|---------|
| `contracts/AlphaDawgAuditLog.sol` | Event-emitting contract for Hedera EVM |
| `scripts/setup-hedera-evm.ts` | Creates ECDSA account for Hedera EVM |
| `scripts/deploy-naryo-contract.ts` | Deploys AuditLog to Hedera EVM |
| `scripts/register-evm-alias.ts` | Registers EVM address alias (required for JSON-RPC) |
| `scripts/fund-evm-account.ts` | Transfers HBAR to EVM address |
| `scripts/test-naryo-events.ts` | Tests all 4 event types (4/4 passed) |
| `src/naryo/emit-event.ts` | Non-fatal event emitters (cycle, deposit, heartbeat, cross-chain) |
| `src/naryo/event-handler.ts` | Processes Naryo HTTP broadcasts + cross-chain correlation |
| `naryo/docker-compose.yml` | Naryo server + MongoDB containers |
| `naryo/application.yml` | 2 nodes, 6 filters, HTTP broadcaster config |
| `naryo/.env` | Contract addresses for Naryo YAML |
| `app/api/naryo/events/[source]/route.ts` | POST endpoint receiving Naryo broadcasts |
| `app/api/naryo/feed/route.ts` | GET endpoint for dashboard widget |
| `components/naryo-feed.tsx` | Multichain event stream widget with correlation badges |

### Files Modified

| File | Change |
|------|--------|
| `hardhat.config.cjs` | Added `hedera-testnet` network (chainId 296) |
| `src/agents/main-agent.ts` | Calls `emitCycleEvent()` after HCS log (non-fatal) |
| `app/api/deposit/route.ts` | Calls `emitDepositEvent()` after mintShares (non-fatal) |
| `src/store/action-logger.ts` | Added 6 Naryo action types |
| `prisma/schema.prisma` | Added `NaryoEvent` + `NaryoCorrelation` models |
| `app/dashboard/page.tsx` | Added NaryoFeed card with LiveBadge |
| `package.json` | Added `setup:hedera-evm`, `deploy:naryo`, `naryo:up/down/logs` scripts |

### Database Tables Created

| Table | Columns |
|-------|---------|
| `naryo_events` | id, source, chain, event_type, tx_hash, decoded_data, raw_payload, correlation_id, created_at |
| `naryo_correlations` | id, description, chains[], proof_tx_hash, created_at |

---

## BOUNTY SCORING COVERAGE

| Requirement | How Satisfied |
|---|---|
| **Deploy smart contracts on Hedera Testnet EVM** | `AlphaDawgAuditLog.sol` at `0x66D2...` on chainId 296 |
| **Leverage Naryo multichain event listener** | Docker container, 2 nodes, 6 filters, HTTP broadcaster |
| **Use Hedera Mirror Node and/or JSON-RPC relay** | Naryo polls Mirror Node; deploy + emit via JSON-RPC relay (hashio) |
| **Public GitHub repo + Hashscan verified** | Repo public; contract at `hashscan.io/testnet/contract/0x66D2...` |
| **Extra: Multi-DLT correlation** | Hedera + 0G Chain events correlated within 60s window, proven on-chain via `CrossChainCorrelation` event |
| **Extra: Multiple Hedera services** | HCS + HTS + Smart Contracts + Mirror Node + Scheduled Txns (5 services) |
| **Extra: Open-source tooling** | Naryo (Linux Foundation) + Hardhat for Hedera EVM |

---

## STARTUP COMMANDS

```bash
# One-time setup (already done)
npm run setup:hedera-evm           # Create ECDSA account
npm run deploy:naryo               # Deploy contract to Hedera EVM

# Run Naryo
npm run naryo:up                   # Start Naryo + MongoDB containers
npm run naryo:logs                 # View Naryo event detection logs
npm run naryo:down                 # Stop containers

# Run AlphaDawg
npm run dev                        # Next.js on :3000
npm run backend                    # Express + Telegram + heartbeat on :3001
```

---

## VALIDATION RESULTS

| Test | Result |
|------|--------|
| TypeScript compilation | PASS |
| Solidity compilation | PASS |
| ECDSA account creation | PASS (`0.0.8506642`) |
| EVM alias registration | PASS (41 HBAR balance) |
| Contract deployment | PASS (`0x66D2...`) |
| CycleCompleted event | PASS (tx `0xc4f8...`) |
| DepositRecorded event | PASS (tx `0x35c7...`) |
| HeartbeatEmitted event | PASS (tx `0xae5c...`) |
| CrossChainCorrelation event | PASS (tx `0x444d...`) |
| **Overall: 9/9** | **ALL PASS** |
