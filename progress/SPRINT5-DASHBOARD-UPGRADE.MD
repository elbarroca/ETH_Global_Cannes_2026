# SPRINT 5 — Dashboard Spec Upgrade (Hunt Cards, Compute Page, Chat, Automation)

> **Date:** 2026-04-04 (Day 2) · **Status:** Complete — Build passing, all 6 chunks implemented
> **Scope:** Transform single-cycle dashboard into full command center. Add compute detail page, hunt card grid, cycle automation, trade execution, chat interface, precondition guards.

---

## WHAT WAS BUILT AND WHY

### 5.1 — Hunt Cards Grid (Dashboard)

| What | Why | File |
|------|-----|------|
| `HuntCard` component | Collapsed card showing hunt #, time, action, specialist count, cost — clickable to compute page | `components/hunt-card.tsx` |
| History fetch on mount | `getCycleHistory(userId, 20)` populates grid of past hunts via HCS mirror | `app/dashboard/page.tsx` |
| Grid layout below approval panel | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` responsive grid of past hunts | `app/dashboard/page.tsx` |
| Auto-refresh after approval | Hunt history refreshes immediately after user approves a pending cycle | `app/dashboard/page.tsx` |

**Before:** Dashboard showed one cycle in a 3-column layout. **After:** Grid of all past hunts, each clickable into a full compute detail page.

### 5.2 — Compute Page (`/dashboard/compute/[id]`)

| What | Why | File |
|------|-----|------|
| Cycle detail API | `GET /api/cycle/detail/:userId/:cycleNumber` — queries Prisma Cycle + AgentAction tables | `app/api/cycle/detail/[userId]/[cycleNumber]/route.ts` |
| `getCycleDetail()` client | Typed fetch for compute page data | `lib/api.ts` |
| `CycleDetail` + `AgentActionRecord` types | Frontend types matching Prisma Cycle and AgentAction models | `lib/types.ts` |
| `AgentGridCard` component | 2x2 agent card with emoji, border color, message, recommendation, attestation, sealed badge | `components/agent-grid-card.tsx` |
| `ComputeLog` component | Chronological event log with action type icons, timestamps, attestation hashes, duration | `components/compute-log.tsx` |
| Compute page | Full hunt view: header, mediator banner (sealPop animation), 2x2 agent grid, log panel, proof footer | `app/dashboard/compute/[id]/page.tsx` |
| Mediator banner | Color-coded decision display (green=BUY, red=SELL, gold=HOLD) with Hashscan proof link | `app/dashboard/compute/[id]/page.tsx` |

**Action type → label mapping in log:**

| ActionType | Icon | Label |
|-----------|------|-------|
| CYCLE_STARTED | `launch` | Hunt initiated |
| SPECIALIST_HIRED | `satellite` | Hired {agentName} ($0.001) |
| DEBATE_ALPHA | green circle | Alpha inference (0G sealed) |
| DEBATE_RISK | red circle | Risk challenge (0G sealed) |
| DEBATE_EXECUTOR | yellow circle | Executor decision (0G sealed) |
| HCS_LOGGED | memo | Logged to Hedera HCS |
| STORAGE_UPLOADED | floppy | Stored to 0G Storage |
| CYCLE_COMPLETED | checkmark | Hunt complete |

### 5.3 — Cycle Automation Config

| What | Why | File |
|------|-----|------|
| `cycleCount`, `cyclePeriodMs`, `cyclesRemaining` on UserRecord.agent | Configurable auto-hunt: how many cycles, at what interval, countdown tracker | `src/types/index.ts` |
| Configure endpoint extended | `POST /api/configure` accepts `cycleCount` (0-100) and `cyclePeriodMs` (5m/15m/30m/1h) | `src/api/routes/onboard.ts` |
| Per-user heartbeat timing | Heartbeat (1-min tick) checks each user's `cyclePeriodMs` and `lastCycleAt` before triggering | `src/agents/heartbeat.ts` |
| Cycle count decrement | After each cycle, re-reads fresh DB value and decrements `cyclesRemaining` atomically | `src/agents/heartbeat.ts` |
| Dashboard auto-hunt panel | Cycle count input + period selector + start button + remaining status display | `app/dashboard/page.tsx` |
| Frontend `configure()` updated | Now accepts `{ cycleCount, cyclePeriodMs }` alongside existing risk/notification config | `lib/api.ts` |

**Heartbeat logic change:** Previously hardcoded 5-min interval for all users. Now: 1-min tick, per-user period check, respects `cyclesRemaining` (skips when 0).

### 5.4 — Execute Trade Button

| What | Why | File |
|------|-----|------|
| Trade execution API | `POST /api/trade/execute` — validates percentage bounds + maxTradePercent, calls Circle `executeSwap()` | `app/api/trade/execute/route.ts` |
| `executeTrade()` client | Typed fetch: `(userId, action, asset, percentage) → TradeResult` | `lib/api.ts` |
| `ExecuteTradeModal` component | Confirmation modal: action/asset/amount/slippage/network, confirm/cancel, success/error states | `components/execute-trade-modal.tsx` |
| Compute page integration | Execute button (green for BUY, red for SELL, hidden for HOLD) with `huntPulse` animation | `app/dashboard/compute/[id]/page.tsx` |

**Security validations on trade endpoint:**
- `typeof percentage !== "number" || percentage <= 0 || percentage > 100` — strict type + bounds
- `percentage > user.agent.maxTradePercent` — respects risk profile limit (5%/12%/25%)
- Proxy wallet existence check before swap
- Action logged via `logAction({ actionType: "TRADE_EXECUTED", ... })`

### 5.5 — Chat Interface (Lead Dawg)

| What | Why | File |
|------|-----|------|
| `ChatMessage` Prisma model | `id`, `userId`, `role`, `content`, `metadata` (JSON), `createdAt` — indexed on `(userId, createdAt)` | `prisma/schema.prisma` |
| `POST /api/chat` endpoint | Keyword-based intent router: balance, last hunt, history, risk profile, hire, stop/resume | `app/api/chat/route.ts` |
| `GET /api/chat/history/:userId` | Returns last 50 messages for chat panel hydration | `app/api/chat/history/[userId]/route.ts` |
| `ChatPanel` component | Slide-over panel (right side, 400px): message bubbles, typing indicator, quick-action suggestions | `components/chat-panel.tsx` |
| Dashboard FAB | Fixed bottom-right wolf button toggles chat panel open/closed | `app/dashboard/page.tsx` |
| Message length limit | 2000 character cap on chat input to prevent abuse | `app/api/chat/route.ts` |
| Safe error handling | Internal errors logged server-side, generic message returned to client | `app/api/chat/route.ts` |

**Chat intents supported:**
| User Says | Lead Dawg Does |
|-----------|---------------|
| "balance" / "nav" / "how much" | Returns fund NAV, deposited USDC, HTS shares, agent status |
| "hunt" / "run" / "trigger" | Directs to Hunt button or /run Telegram command |
| "last" / "why" / "latest" | Fetches latest cycle from DB, shows debate summary |
| "history" | Shows last 5 cycles with decisions |
| "risk" / "profile" | Returns risk profile, max trade %, approval mode |
| "hire" / "pack" / "agent" | Directs to Marketplace page |
| "stop" / "pause" | Shows agent active/paused status |
| anything else | Returns capability menu |

### 5.6 — Precondition Modals

| What | Why | File |
|------|-----|------|
| `PreconditionModal` component | Generic modal: title, body, CTA button (navigates), dismiss button | `components/precondition-modal.tsx` |
| USDC balance guard | Before `analyzeCycle`, checks `user.fund.depositedUsdc >= 0.003` — shows deposit modal if insufficient | `app/dashboard/page.tsx` |

---

## FILES CREATED (11)

| File | Purpose | Lines |
|------|---------|-------|
| `components/hunt-card.tsx` | Collapsed hunt card for dashboard grid | 63 |
| `components/agent-grid-card.tsx` | 2x2 agent card for compute page | 44 |
| `components/compute-log.tsx` | Chronological event log | 80 |
| `components/execute-trade-modal.tsx` | Trade confirmation modal | 131 |
| `components/chat-panel.tsx` | Slide-over chat interface | 173 |
| `components/precondition-modal.tsx` | Hunt precondition warning | 48 |
| `app/dashboard/compute/[id]/page.tsx` | Full compute detail page | 240 |
| `app/api/cycle/detail/[userId]/[cycleNumber]/route.ts` | Cycle + actions API | 33 |
| `app/api/trade/execute/route.ts` | Circle MPC swap execution | 90 |
| `app/api/chat/route.ts` | Chat intent router | 113 |
| `app/api/chat/history/[userId]/route.ts` | Chat history fetch | 23 |

## FILES MODIFIED (7)

| File | Changes |
|------|---------|
| `app/dashboard/page.tsx` | +hunt cards grid, +auto-hunt config, +chat FAB, +precondition modal |
| `lib/api.ts` | +getCycleDetail, +executeTrade, +TradeResult, +configure(opts), +UserRecord.agent fields |
| `lib/types.ts` | +AgentActionRecord, +CycleDetail, +ComputeDetailResponse |
| `src/types/index.ts` | +cycleCount, +cyclePeriodMs, +cyclesRemaining on UserRecord.agent |
| `src/agents/heartbeat.ts` | Per-user timing, cycle count decrement, 1-min tick |
| `src/api/routes/onboard.ts` | +cycleCount/cyclePeriodMs validation in /api/configure |
| `prisma/schema.prisma` | +ChatMessage model, +chatMessages relation on User |

---

## ROUTES ADDED

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/cycle/detail/:userId/:cycleNumber` | Full cycle data + action log for compute page |
| POST | `/api/trade/execute` | Execute BUY/SELL via Circle MPC swap |
| POST | `/api/chat` | Chat with Lead Dawg (intent-based) |
| GET | `/api/chat/history/:userId` | Chat message history |

## ROUTES MODIFIED

| Method | Path | Change |
|--------|------|--------|
| POST | `/api/configure` | Now accepts `cycleCount`, `cyclePeriodMs` |

---

## REVIEWER FINDINGS & FIXES

| Finding | Severity | Fix Applied |
|---------|----------|-------------|
| Trade endpoint: no `maxTradePercent` enforcement | CRITICAL | Added `percentage > user.agent.maxTradePercent` check |
| Trade endpoint: weak percentage validation | CRITICAL | Added `typeof` check + strict bounds (1-100) |
| Chat endpoint: raw error leak via `String(err)` | CRITICAL | Replaced with generic "Internal server error" |
| Chat endpoint: no message length limit | IMPORTANT | Added 2000-char cap |
| `execStopLoss` type: `number` vs Prisma `String?` | IMPORTANT | Changed to `string \| null` |
| `paymentAmount` type: `number` vs Prisma `String?` | IMPORTANT | Changed to `string \| null`, removed `.toFixed()` |
| Heartbeat stale `remaining` snapshot | IMPORTANT | Re-reads fresh DB value before decrement |

---

## VERIFICATION

```
npm run build          ✅ Compiled successfully in 14.7s
                       ✅ 21/21 static pages generated
                       ✅ All new routes registered (4 new API, 1 new page)
npx prisma generate    ✅ Client generated with PendingCycle + ChatMessage models
```

## WHAT'S NEXT

| Task | Priority | Estimate |
|------|----------|----------|
| Telegram intent parsing (paste Twitter links) | P2 | 2h |
| Chat: full LLM integration via 0G sealed inference | P1 | 3h |
| Chat: function-calling for swaps/transfers | P1 | 2h |
| Register agent community endpoint in marketplace | P2 | 1h |
| Real-time cycle streaming on compute page | P2 | 2h |
