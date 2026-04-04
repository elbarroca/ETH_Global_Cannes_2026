# SPRINT 5 — Two-Phase Approval Flow + Callback System

> **Date:** 2026-04-04 · **Status:** Complete — 79/79 E2E tests passing
> **Scope:** Split monolithic `runCycle()` into analyze + approve + commit pipeline with human-in-the-loop decision gate. Telegram inline buttons. Dashboard ApprovalPanel. Timeout auto-resolution. Race condition hardening.

---

## WHAT WAS BUILT AND WHY

### 5.0 — Core Architecture: Two-Phase Cycle Split

| What | Why | File |
|------|-----|------|
| `analyzeCycle(user)` | Phase 1: hires specialists via x402, runs 0G sealed adversarial debate. Returns `AnalysisResult` — does NOT touch HCS/0G Storage | `src/agents/main-agent.ts` |
| `commitCycle(analysis, user, modifiedPct?)` | Phase 2: logs to Hedera HCS, stores to 0G, updates iNFT, saves to Supabase, evaluates reputations. Only runs after approval | `src/agents/main-agent.ts` |
| `rejectCycle(analysis, user, reason)` | Rejection path: advances `lastCycleId` (prevents reuse) but does NOT write to HCS/0G. Rejected cycles never go on-chain | `src/agents/main-agent.ts` |
| `runCycle(user)` preserved | Backward-compat wrapper: `analyzeCycle` + `commitCycle` in one call. Used by heartbeat `auto` mode | `src/agents/main-agent.ts` |
| `buildCompactRecord()` moved to Phase 1 | Compact record built during analysis, stored on pending cycle, committed unchanged (or with modified %) | `src/agents/main-agent.ts` |

### 5.1 — PendingCycle Persistence (Supabase/Prisma)

| What | Why | File |
|------|-----|------|
| `PendingCycle` Prisma model | Stores recommendation awaiting user decision: specialists, debate, compactRecord as JSON. Indexed on `(userId, status)` and `expiresAt` | `prisma/schema.prisma` |
| `createPendingCycle()` | Creates PENDING_APPROVAL row with calculated `expiresAt` | `src/store/pending-cycles.ts` |
| `getPendingCycle(id)` | Fetch by UUID | `src/store/pending-cycles.ts` |
| `getPendingForUser(userId)` | Returns most recent PENDING_APPROVAL for user (or null) — used as duplicate guard | `src/store/pending-cycles.ts` |
| `resolvePendingCycle(id, resolution)` | **Atomic** `UPDATE ... WHERE status = 'PENDING_APPROVAL'` — returns null if already resolved. This is the race condition gate | `src/store/pending-cycles.ts` |
| `getExpiredPending()` | Returns all expired PENDING_APPROVAL rows — used by timeout checker | `src/store/pending-cycles.ts` |

### 5.2 — Telegram Two-Phase `/run` + Approval Buttons

| What | Why | File |
|------|-----|------|
| `/run` now two-phase | Hire confirm -> `analyzeCycle()` -> sends recommendation preview with inline buttons | `src/telegram/bot.ts` |
| `approve_{pendingId}` callback | Validates ownership via chatId, resolves FIRST (atomic), then commits to HCS/0G | `src/telegram/bot.ts` |
| `reject_{pendingId}` callback | Validates ownership, resolves FIRST, then calls `rejectCycle()` | `src/telegram/bot.ts` |
| Duplicate pending guard | Checks `getPendingForUser()` before starting analysis — shows warning if pending exists | `src/telegram/bot.ts` |
| `sendApprovalNotification()` exported | Used by heartbeat to push approval request to Telegram for non-auto users | `src/telegram/bot.ts` |
| `editTelegramMessage()` exported | Used by timeout checker to update message after auto-resolution | `src/telegram/bot.ts` |

### 5.3 — Telegram Formatter Module

| What | Why | File |
|------|-----|------|
| `formatAnalysisPreview()` | Rich Markdown: specialist signals with reputation, debate summary, recommendation, countdown notice | `src/telegram/formatter.ts` |
| `formatApprovedResult()` | Post-approval: decision, TEE count, HCS seq#, Hashscan link | `src/telegram/formatter.ts` |
| `formatRejectedResult()` | Rejection confirmation: shows what was rejected, notes no HCS write | `src/telegram/formatter.ts` |
| `formatTimedOutResult()` | Auto-resolution notice: approved or rejected with risk profile context | `src/telegram/formatter.ts` |
| `buildApprovalKeyboard()` | 2-button inline keyboard: Approve + Reject. callback_data = 44 bytes (under 64-byte Telegram limit) | `src/telegram/formatter.ts` |
| `formatDebate()`, `formatCycleSummary()`, `signalEmoji()` | Extracted from `bot.ts` — reusable across all Telegram messages | `src/telegram/formatter.ts` |

### 5.4 — API Endpoints (Next.js + Express)

| Endpoint | Method | Purpose | File |
|----------|--------|---------|------|
| `/api/cycle/analyze/:userId` | POST | Phase 1: analyze + create pending. Returns `pendingId`, debate data, `expiresAt` | Next.js route + Express |
| `/api/cycle/approve/:pendingId` | POST | Phase 2: resolve + commit. Requires `userId` in body (auth). Validates `modifiedPct` bounds | Next.js route + Express |
| `/api/cycle/reject/:pendingId` | POST | Resolve + reject. Requires `userId` in body (auth) | Next.js route + Express |
| `/api/cycle/pending/:userId` | GET | Returns current PENDING_APPROVAL or null — used by dashboard to restore state on refresh | Next.js route + Express |
| `/api/cycle/run/:userId` | POST | Updated: if `approvalMode=auto` → full cycle. Otherwise → analyze + pending | Next.js route + Express |
| `/api/configure` | POST | Extended: now accepts `approvalMode` ("always"\|"trades_only"\|"auto") and `approvalTimeoutMin` (1-60) | Express |

### 5.5 — Dashboard ApprovalPanel

| What | Why | File |
|------|-----|------|
| Two-phase `handleHunt()` | Calls `analyzeCycle(userId)` instead of `triggerCycle()`. Stage animation shows "Hiring..." / "Debating..." | `app/dashboard/page.tsx` |
| `ApprovalPanel` component | Replaces RightColumn when pending: large recommendation display, countdown timer, Approve/Reject buttons styled blood-600/void-800 | `app/dashboard/page.tsx` |
| Pending state on mount | Calls `getPendingCycle(userId)` on load — restores approval UI if user refreshed mid-decision | `app/dashboard/page.tsx` |
| `handleApprove()` / `handleReject()` | Calls `approveCycle(pendingId, userId)` / `rejectCycle(pendingId, userId)` — passes userId for auth | `app/dashboard/page.tsx` |
| Commit stage animation | After approve, shows "Logging to HCS..." / "Storing to 0G..." stages before full result loads | `app/dashboard/page.tsx` |

### 5.6 — Heartbeat Conditional Approval

| What | Why | File |
|------|-----|------|
| `approvalMode` check | `auto` → `runCycle()` (unchanged). `always`/`trades_only` → `analyzeCycle()` + create pending + Telegram notification | `src/agents/heartbeat.ts` |
| Skip if pending exists | `getPendingForUser()` guard — avoids stacking multiple pending cycles per user | `src/agents/heartbeat.ts` |
| `trades_only` logic | HOLD decisions auto-commit (no approval needed). BUY/SELL create pending cycle | `src/agents/heartbeat.ts` |

### 5.7 — Timeout Checker

| What | Why | File |
|------|-----|------|
| `checkExpiredPendingCycles()` | 60-second interval. Queries `getExpiredPending()`, resolves each based on risk profile | `src/agents/timeout-checker.ts` |
| Conservative → auto-reject | Safety-first: if user doesn't respond, reject (no position taken) | `src/agents/timeout-checker.ts` |
| Balanced/Aggressive → auto-approve | Opportunity-first: if user doesn't respond, execute the recommendation | `src/agents/timeout-checker.ts` |
| Telegram message edit | Updates the original approval message with timeout result (if `telegramMsgId` was stored) | `src/agents/timeout-checker.ts` |
| Wired into boot | `startTimeoutChecker()` called from `src/index.ts` alongside heartbeat | `src/index.ts` |

### 5.8 — User Preferences

| What | Default | File |
|------|---------|------|
| `agent.approvalMode` | `"always"` — every cycle pauses for approval. New and existing users | `src/store/user-store.ts` |
| `agent.approvalTimeoutMin` | `10` — auto-resolves after 10 minutes based on risk profile | `src/store/user-store.ts` |
| Existing user backfill | `Object.assign({ approvalMode: "always", approvalTimeoutMin: 10 }, row.agent)` in `rowToUser()` — no migration needed | `src/store/user-store.ts` |

---

## SECURITY HARDENING

Five issues found via automated code review, all fixed before merge:

| # | Issue | Risk | Fix |
|---|-------|------|-----|
| 1 | `commitCycle()` ran before `resolvePendingCycle()` | Concurrent approve from Telegram + UI double-commits to HCS | Swapped order in all 4 callsites: atomic resolve first, abort if null |
| 2 | No auth on approve/reject endpoints | Any UUID guesser can approve another user's cycle | `userId` required in body, verified against `pending.userId` (403 if mismatch) |
| 3 | No duplicate pending guard | Double-clicking Hunt creates two pending cycles (wasted x402 payments) | `getPendingForUser()` returns 409 if pending exists |
| 4 | `modifiedPct` unbounded | Arbitrary % committed to immutable HCS | Validated `0 <= pct <= user.maxTradePercent` (400 if out of bounds) |
| 5 | `commitCycle` fails after resolve succeeds | Orphaned APPROVED row, `lastCycleId` never advanced, next cycle reuses cycleId | Inner try/catch: on failure calls `rejectCycle(analysis, user, "commit_failed")` to advance counter |

---

## TYPE CHANGES

| Type | Change | File |
|------|--------|------|
| `UserRecord.agent` | Added `approvalMode: "always" \| "trades_only" \| "auto"` and `approvalTimeoutMin: number` | `src/types/index.ts` |
| `AnalysisResult` | New: `{ userId, cycleId, specialists, debate, compactRecord }` — output of Phase 1 | `src/types/index.ts` |
| `PendingCycleRecord` | New: `{ id, userId, cycleNumber, status, origin, specialists, debate, compactRecord, expiresAt, telegramMsgId }` | `src/types/index.ts` |
| `PendingCycleStatus` | New: `"PENDING_APPROVAL" \| "APPROVED" \| "REJECTED" \| "TIMED_OUT"` | `src/types/index.ts` |
| `CycleOrigin` | New: `"ui" \| "telegram" \| "heartbeat"` | `src/types/index.ts` |
| `ActionType` | Added: `PENDING_APPROVAL`, `CYCLE_APPROVED`, `CYCLE_REJECTED`, `CYCLE_TIMED_OUT`, `AGENT_HIRED`, `AGENT_FIRED` | `src/store/action-logger.ts` |
| `CompactCycleRecord.adv` | Added optional `r?: string` (reasoning excerpt, 60 chars) on each debate stage. Auto-stripped if record > 950 bytes | `src/types/index.ts` |

---

## DATABASE CHANGES

```sql
-- New table (via Prisma db push)
CREATE TABLE pending_cycles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL REFERENCES users(id),
  cycle_number  INT NOT NULL,
  status        TEXT DEFAULT 'PENDING_APPROVAL',
  origin        TEXT DEFAULT 'ui',
  specialists   JSONB DEFAULT '[]',
  debate        JSONB DEFAULT '{}',
  compact_record JSONB DEFAULT '{}',
  expires_at    TIMESTAMPTZ NOT NULL,
  resolved_at   TIMESTAMPTZ,
  resolved_by   TEXT,
  modified_pct  INT,
  telegram_msg_id INT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pending_cycles_user_status ON pending_cycles(user_id, status);
CREATE INDEX idx_pending_cycles_expires ON pending_cycles(expires_at);
```

---

## E2E VALIDATION SUITE

**Script:** `scripts/validate-approval-flow.ts`
**Run:** `npm run validate:approval`
**Result:** 79/79 passed, 0 failed, 0 skipped

| Test | What It Proves |
|------|---------------|
| 1-9 | All env vars present for full stack |
| 10-18 | User creation with proxy wallet, JSONB defaults correct (`approvalMode=always`, `timeoutMin=10`) |
| 19-22 | Link code: 6-char, single-use, double-redeem blocked, case-insensitive |
| 23-28 | Telegram binding: chatId/username/verified set, deep merge preserves `notifyPreference` |
| 29-33 | Approval preferences: `approvalMode`/`approvalTimeoutMin` update independently |
| 34-40 | `analyzeCycle()`: returns specialists + debate + compactRecord, `lastCycleId` stays 0 |
| 41-53 | PendingCycle CRUD: create, get, expiry, JSON round-trip, resolve, **double-resolve → null** |
| 54-59 | `commitCycle()`: HCS seq# returned, 0G storage hash, user record updated |
| 60-61 | `rejectCycle()`: `lastCycleId` incremented, zero HCS/0G calls |
| 62-68 | Formatter: all format functions, `callback_data` ≤ 64 bytes |
| 69-73 | **Full pipeline (production order)**: resolve BEFORE commit, concurrent resolve blocked, final state consistent |
| 74-79 | Cleanup: all test data removed from Supabase |

### On-Chain Proof From Test Runs

| Infrastructure | Evidence |
|----------------|----------|
| Hedera HCS | seq #8-15 on topic `0.0.8497439` — [Hashscan](https://hashscan.io/testnet/topic/0.0.8497439) |
| 0G Storage | 3 cycle records stored with verified root hashes (txSeq 33280, 33281, 33292, 33295) |
| 0G Compute | 15 sealed inferences via TEE (5 test cycles x 3 debate stages) |
| Supabase | 126 agent actions created + cleaned up across test runs |

---

## FILE INVENTORY

### New Files (7)

| File | Lines | Purpose |
|------|-------|---------|
| `src/store/pending-cycles.ts` | ~120 | PendingCycle CRUD with atomic resolution |
| `src/telegram/formatter.ts` | ~130 | All Telegram message formatting + keyboard builder |
| `src/agents/timeout-checker.ts` | ~95 | Expired pending cycle auto-resolution |
| `app/api/cycle/analyze/[userId]/route.ts` | ~45 | Next.js: Phase 1 analyze endpoint |
| `app/api/cycle/approve/[pendingId]/route.ts` | ~75 | Next.js: Phase 2 approve endpoint |
| `app/api/cycle/reject/[pendingId]/route.ts` | ~55 | Next.js: reject endpoint |
| `app/api/cycle/pending/[userId]/route.ts` | ~25 | Next.js: get pending cycle |
| `scripts/validate-approval-flow.ts` | ~960 | 79-test E2E validation suite |

### Modified Files (12)

| File | Change |
|------|--------|
| `prisma/schema.prisma` | +PendingCycle model, +User relation |
| `src/types/index.ts` | +AnalysisResult, +PendingCycleRecord, extended UserRecord.agent |
| `src/agents/main-agent.ts` | Split into analyzeCycle/commitCycle/rejectCycle + commit-failure recovery |
| `src/telegram/bot.ts` | Two-phase /run, approve/reject callbacks, duplicate guard |
| `src/agents/heartbeat.ts` | Conditional approval by approvalMode |
| `src/store/user-store.ts` | Defaults for approvalMode/approvalTimeoutMin, backfill in rowToUser |
| `src/store/action-logger.ts` | +6 action types, +reasoning fields |
| `src/api/routes/cycle.ts` | +analyze/approve/reject/pending Express routes |
| `src/api/routes/onboard.ts` | Extended /configure with approvalMode/approvalTimeoutMin |
| `src/index.ts` | Wire timeout checker |
| `lib/api.ts` | +analyzeCycle/approveCycle/rejectCycle/getPendingCycle, extended UserRecord |
| `app/dashboard/page.tsx` | Two-phase hunt + ApprovalPanel component |
| `app/api/cycle/run/[userId]/route.ts` | Updated for two-phase with duplicate guard |
| `package.json` | +validate:approval script |

---

## FLOW DIAGRAMS

### User → Wallet → Telegram → Approval (Happy Path)

```
1. User connects wallet (Dynamic Labs SDK)
   └─ Frontend auto-calls POST /api/onboard
      └─ Creates Circle MPC proxy wallet
      └─ Stores user in Supabase (approvalMode=always, timeoutMin=10)
      └─ Returns telegramLinkCode (6-char, 10-min TTL)

2. User opens Telegram → /start CODE
   └─ Bot redeems code → gets userId
   └─ updateUser(userId, { telegram: { chatId, username, verified: true } })
   └─ User's wallet is now bound to Telegram chatId

3. User clicks Hunt (dashboard) or /run (Telegram)
   └─ Duplicate guard: getPendingForUser() → 409 if exists
   └─ analyzeCycle(user)
      ├─ hireFromMarketplace() → 3 specialists via x402 ($0.003)
      └─ runAdversarialDebate() → Alpha→Risk→Executor via 0G sealed inference
   └─ createPendingCycle(analysis, origin, timeoutMin)
   └─ Send recommendation to user:
      ├─ Telegram: formatted preview + Approve/Reject inline buttons
      └─ Dashboard: ApprovalPanel with countdown timer

4. User approves
   └─ resolvePendingCycle(id, APPROVED) ← atomic gate
   └─ commitCycle(analysis, user)
      ├─ logCycle() → Hedera HCS (seq# + hashscanUrl)
      ├─ storeMemory() → 0G Storage (rootHash)
      ├─ updateAgentMetadata() → iNFT on 0G Chain
      └─ logCycleRecord() → Supabase (full data)
   └─ Update user (lastCycleId, lastCycleAt)
   └─ Show proof: HCS link, 0G hash, TEE count

5. User rejects (or timeout fires)
   └─ resolvePendingCycle(id, REJECTED/TIMED_OUT) ← atomic gate
   └─ rejectCycle(analysis, user, reason)
      └─ Advances lastCycleId (no HCS write)
   └─ Edit Telegram message with rejection/timeout notice
```

---

## WHAT'S NEXT

| Priority | Task | Notes |
|----------|------|-------|
| High | Wire specialist servers for live hiring | Currently falls back to mock data (specialists not running) |
| Medium | `modifiedPct` UI in ApprovalPanel | Allow user to drag % before approving |
| Medium | `/settings` Telegram command | Change approvalMode/timeoutMin from chat |
| Low | Daily digest notification | `notifyPreference=daily` currently suppressed |
| Low | Price movement accuracy tracking | Currently uses executor decision as proxy for correctness |
