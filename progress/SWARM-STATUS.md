# AlphaDawg Swarm — Status & Gap Analysis

> **Date:** 2026-04-04 · ETHGlobal Cannes Day 2
> **Status:** 13 agents live on Fly.io + Railway orchestrator. Core flow works. Hierarchical hiring + agent-to-agent nanopayment requests need final wiring.

---

## 1. The Vision (Target Architecture)

The user wants a **hierarchical agent economy** with three distinct tiers. Each tier has different responsibilities and economics.

```
┌──────────────────────────────────────────────────────────────┐
│  TIER 0 — USER GOAL                                          │
│  "Grow my portfolio, max 10% per trade, balanced risk"       │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│  TIER 1 — ORCHESTRATOR (Railway / Next.js backend)           │
│  Main agent: receives user goal, forwards to augmented layer │
│  Does NOT make trading decisions. Only coordinates.          │
└─────────────────────┬────────────────────────────────────────┘
                      │ forward goal
                      ▼
┌──────────────────────────────────────────────────────────────┐
│  TIER 2 — AUGMENTED LAYER (the brain trust)                  │
│  3 agents on Fly.io with hiring budgets + tool access:       │
│                                                              │
│    vm-alpha.fly.dev     → argues FOR a trade                 │
│    vm-risk.fly.dev      → argues AGAINST                     │
│    vm-executor.fly.dev  → final judge                        │
│                                                              │
│  EACH ONE decides which specialists it needs.                │
│  Each hires via x402 nanopayment ($0.001/call).              │
│  Discusses the results, proposes action.                     │
└─────────────────────┬────────────────────────────────────────┘
                      │ hire via x402 POST
                      ▼
┌──────────────────────────────────────────────────────────────┐
│  TIER 3 — MARKETPLACE SPECIALISTS (the intelligence layer)   │
│  10 agents on Fly.io, each exposes /analyze behind x402:     │
│                                                              │
│    vm-sentiment         F&G + CoinGecko sentiment            │
│    vm-whale             Exchange flows, gas                  │
│    vm-momentum          RSI, MACD, volume                    │
│    vm-memecoin-hunter   DexScreener new pairs                │
│    vm-twitter-alpha     CT narrative + engagement            │
│    vm-defi-yield        DeFi Llama APY/TVL                   │
│    vm-news-scanner      CryptoPanic breaking news            │
│    vm-onchain-forensics Etherscan whale tracking             │
│    vm-options-flow      Deribit put/call, max pain           │
│    vm-macro-correlator  FRED: DXY, VIX, 10Y yield            │
│                                                              │
│  Each fetches REAL market data → runs 0G sealed inference    │
│  → returns {signal, confidence, reasoning, attestation}      │
└─────────────────────┬────────────────────────────────────────┘
                      │ aggregated decision
                      ▼
┌──────────────────────────────────────────────────────────────┐
│  TIER 4 — EXECUTION (real on-chain settlement)               │
│  · x402 nanopayments settled on Arc testnet                  │
│  · Uniswap V3 swap via MockSwapRouter on Arc                 │
│  · HCS audit record on Hedera                                │
│  · 0G Storage for cycle memory                               │
│  · iNFT metadata update on 0G Chain                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. What's DONE — Infrastructure Layer

### 2.1 All 13 agents live on Fly.io ✓

Verified with `/healthz` — all responding with 0G provider address.

| Agent | URL | Tier | Status |
|-------|-----|------|--------|
| vm-sentiment | https://vm-sentiment.fly.dev | Specialist | LIVE |
| vm-whale | https://vm-whale.fly.dev | Specialist | LIVE |
| vm-momentum | https://vm-momentum.fly.dev | Specialist | LIVE |
| vm-memecoin-hunter | https://vm-memecoin-hunter.fly.dev | Specialist | LIVE |
| vm-twitter-alpha | https://vm-twitter-alpha.fly.dev | Specialist | LIVE |
| vm-defi-yield | https://vm-defi-yield.fly.dev | Specialist | LIVE |
| vm-news-scanner | https://vm-news-scanner.fly.dev | Specialist | LIVE |
| vm-onchain-forensics | https://vm-onchain-forensics.fly.dev | Specialist | LIVE |
| vm-options-flow | https://vm-options-flow.fly.dev | Specialist | LIVE |
| vm-macro-correlator | https://vm-macro-correlator.fly.dev | Specialist | LIVE |
| vm-alpha | https://vm-alpha.fly.dev | Augmented | LIVE |
| vm-risk | https://vm-risk.fly.dev | Augmented | LIVE |
| vm-executor | https://vm-executor.fly.dev | Augmented | LIVE |

Each agent:
- Runs 0G Compute (provider `0xa48f01287233509FD694a22Bf840225062E67836`)
- Auto-suspends when idle → **$0 cost**
- Auto-wakes on HTTP request
- 256MB shared-cpu-1x, Paris (cdg) region

### 2.2 0G Compute integration ✓

- `src/og/inference.ts` — `sealedInference()` with TEE attestation (ZG-Res-Key)
- `src/config/og-compute.ts` — broker singleton, auto-funding, `createRequire` CJS fix for broken ESM build
- Concurrency semaphore (max 3 concurrent, 2s delay) to respect 30 req/min limit
- **Every agent call = 0G TEE sealed inference. No Anthropic.**

### 2.3 Real data sources (10 specialists) ✓

Located in `src/agents/data/*.ts`:

| Specialist | Data Source | Auth |
|-----------|------------|------|
| sentiment | CoinGecko + Fear & Greed | None |
| whale | Etherscan + exchange volume | None |
| momentum | Coin prices + RSI/MACD compute | None |
| memecoin-hunter | DexScreener boosts + profiles | None |
| twitter-alpha | Twitter API v2 | TWITTER_BEARER_TOKEN |
| defi-yield | DeFi Llama pools | None |
| news-scanner | CryptoPanic posts | CRYPTOPANIC_API_KEY |
| onchain-forensics | Etherscan Pro | ETHERSCAN_PRO_API_KEY |
| options-flow | Deribit public API | None |
| macro-correlator | FRED economic data | FRED_API_KEY |

All with local fallbacks — if API key missing, realistic mock data returned.

### 2.4 x402 payment layer ✓

- `src/payments/x402-client.ts` — `createPaymentFetch()` via viem + Circle Gateway
- `src/payments/x402-server.ts` — Express middleware for specialist paywalls
- `src/config/arc.ts` — per-user HD wallet derivation for payment signing
- Payment happens BEFORE analysis — agent returns 402 if unpaid, client auto-signs and retries

### 2.5 On-chain execution ✓

- `src/execution/arc-swap.ts` — Uniswap V3 + direct transfer fallback on Arc testnet (chainId 5042002)
- MockSwapRouter deployed at `0xaac18860AfDcBDd8Cd6D4De8f603a09607D64C96`
- Test swap succeeded: `0xc1abd0b9fa640faf7129bde15d1535ffa03d91c87a6e2449d843a6eb9ed03dbd`

### 2.6 Audit trail ✓

- **Hedera HCS topic** `0.0.8497439` — every cycle logged with compact record + attestation hashes
- **0G Storage** — full cycle memory via `storeMemory()` in `src/og/storage.ts`
- **Supabase `debate_transcripts` table** — every turn of the debate logged
- **iNFT (ERC-7857) on 0G Chain** — `VaultMindAgent` at `0x73e3016D0D3Bf2985c55860cd2A51FF017c2c874`, 2 users already minted

### 2.7 Dashboard (Next.js on Railway) ✓

- User onboarding via wallet signature
- Telegram verification flow
- 3-column debate view
- Marketplace leaderboard (reputation scores)
- Cycle history with HCS proofs
- Debate transcript replay via `/api/cycle/debate/[cycleId]`

---

## 3. What's DONE — Code Flow (Current State)

### Current flow in `src/agents/main-agent.ts` (`analyzeCycle`):

```
1. User triggers cycle (Telegram /run OR dashboard button)
2. main-agent.ts reads user.agent.riskProfile + user.agent.maxTradePercent
3. selectSpecialists() picks 5 specialists BASED ON STATIC RULES:
     - always: sentiment, momentum, onchain-forensics
     - if aggressive profile: + memecoin-hunter, twitter-alpha
     - if balanced: + defi-yield
     - (hardcoded marketVolatility="medium", recentNewsCount=0)
4. hireSpecialists() calls ALL 5 Fly.io URLs in parallel via HTTP + x402
5. Each specialist: fetch real data → 0G sealed inference → return signal
6. runAdversarialDebate() receives all specialist results
7. Alpha → Risk → Executor (each calls their Fly.io URL via HTTP)
8. If confidence < 60%, trigger rebuttal round
9. 10s deliberation pause
10. Arc swap if BUY/SELL → HCS log → 0G Storage → iNFT update → Telegram notify
```

**This works end-to-end.** The debate transcripts are logged. 0G attestation hashes are real. Payment flow is wired.

---

## 4. What's MISSING — The Hierarchical Hiring Gap

The user's vision is that **the augmented layer (alpha/risk/executor) should drive specialist hiring**, not the orchestrator. Currently the flow is flat:

```
CURRENT:  main-agent → [fixed rules] → hires ALL 5 specialists → debate gets all data
DESIRED:  main-agent → debate layer → debate decides what they need → debate hires specialists
```

This is the key gap. Let me break it down.

### 4.1 Alpha/Risk/Executor can't currently hire specialists

**Evidence:** `src/agents/fly-agent-server.ts` lines 82-93 — the debate agents' `/analyze` endpoint only accepts `userMessage`/`systemPrompt` in the request body. It has no ability to call OTHER agents mid-inference.

**What the user wants:**
```
POST /analyze to vm-alpha
  Body: { userGoal: "grow portfolio 10% balanced risk" }

vm-alpha reasons:
  "I need to build a bullish case. I need sentiment data and momentum data."
  → vm-alpha calls vm-sentiment/analyze (pays $0.001 via x402)
  → vm-alpha calls vm-momentum/analyze (pays $0.001 via x402)
  → vm-alpha synthesizes the real data into a bullish thesis
  → returns { thesis, specialists_hired, total_cost, attestation }
```

**To build this:** Each debate agent needs:
1. A "tools" layer — function calling or tool use via 0G inference
2. An HTTP client with x402 payment baked in (already exists in `src/payments/x402-client.ts`)
3. The AGENT_REGISTRY baked into the Fly.io container so each agent knows the other URLs
4. A hire budget per call (e.g., alpha can hire max 3 specialists for $0.003 per debate turn)

### 4.2 Main-agent doesn't delegate — it orchestrates

**Current:** `analyzeCycle()` in `main-agent.ts` lines 107-145 — decides specialists via `selectSpecialists()`, hires them directly, THEN passes data to debate.

**Desired:** `analyzeCycle()` should:
1. Receive user goal
2. POST to `vm-alpha.fly.dev/analyze` with just the goal
3. POST to `vm-risk.fly.dev/analyze` with Alpha's output
4. POST to `vm-executor.fly.dev/analyze` with both
5. Each debate agent internally hires specialists it needs
6. Main-agent collects final decision and executes swap

### 4.3 Real market data flow is verified per-call but not end-to-end

Each specialist does fetch real data when called — verified in `fly-agent-server.ts` via `DATA_FETCHERS[AGENT_NAME]()`. But the debate agents never see the RAW data snapshot because it's passed as a reasoning string, not as structured tool results. Alpha/Risk/Executor reason about "high RSI = bearish" without actually seeing the RSI number.

### 4.4 Marketplace reputation isn't fed back to the debate

`src/marketplace/reputation.ts` has ELO scoring (K=32), and it IS updated after each cycle. But the debate agents don't currently receive per-specialist reputation when making hiring decisions. If they were hiring themselves, they'd want to favor higher-reputation specialists.

---

## 5. What's MISSING — Execution Layer Improvements

### 5.1 Transaction hierarchy in one atomic flow

**Current:** `commitCycle()` in `main-agent.ts` executes each step sequentially with individual try/catch. If HCS fails, we continue to swap. If swap fails, we continue to 0G storage. This is "best-effort" logging.

**User wants:** A proper transaction hierarchy where failures cascade appropriately:
```
1. Debate produces decision
2. IF decision = BUY/SELL:
   a. Reserve USDC in proxy wallet
   b. Execute Uniswap swap on Arc (real tx hash)
   c. IF swap succeeds → log to HCS with tx hash
   d. IF swap fails → log FAILURE to HCS, no 0G Storage
3. IF decision = HOLD:
   a. Log to HCS with "HOLD" action
   b. Still store debate to 0G Storage (valuable data)
```

The hierarchy is correct conceptually but the error paths aren't clean.

### 5.2 Nanopayment metadata in HCS record

Currently the HCS `CompactCycleRecord` doesn't include which specialists were paid or how much. For the Arc bounty judges, this is a miss — they want to see the full payment trail on-chain.

**Fix:** Add `payments: [{to: "vm-sentiment", amount: "$0.001", txHash: "0xabc..."}]` to the compact record.

### 5.3 Dashboard doesn't show live Fly.io agent status

`/app/marketplace/page.tsx` pulls from the DB marketplace_agents table but doesn't ping the live Fly.io URLs. Judges can see "sentiment has 83% accuracy" but not "vm-sentiment.fly.dev is online and responding in 1.2s".

**Fix:** Add a health-check API route that pings all 13 Fly.io URLs and shows green/red dots in the marketplace UI.

---

## 6. What's MISSING — Next.js UI Flow

### 6.1 User goal capture

**Current:** User clicks "Run Hunt" button. No goal input. The cycle runs with fixed risk profile from onboarding.

**Desired:** A prompt box where user types natural-language goals:
> "Find me a safe entry for ETH this week"
> "I think there's alpha in AI tokens, help me find it"
> "Hedge my portfolio, VIX is spiking"

**Where to add:** `app/dashboard/page.tsx` — new `<GoalInput>` component that passes the goal string to `/api/cycle/run/[userId]` in the POST body.

### 6.2 Live debate visualization

**Current:** Dashboard polls `/api/cycle/latest/[userId]` every 10s. When cycle is running, user sees the spinner, then suddenly sees the full debate. No turn-by-turn replay.

**Desired:** Stream debate turns as they happen. When Alpha speaks, show Alpha's card. When Alpha hires vm-sentiment, show an animated arrow from Alpha to vm-sentiment. When vm-sentiment responds, show the data flowing back.

**Where to add:** `app/api/cycle/debate/[cycleId]/stream/route.ts` (new SSE endpoint) + `components/debate-theater.tsx` (new client component with EventSource).

### 6.3 Fly.io status in marketplace

**Current:** `app/marketplace/page.tsx` — static list from DB.

**Desired:** Each specialist card shows:
- Fly.io URL (clickable, opens in new tab)
- Online/offline dot (pings /healthz)
- Last response time
- 0G TEE verified badge
- Reputation score
- Hire count

---

## 7. Summary — Built vs. Missing

### ✓ BUILT (infrastructure is solid)

| Layer | Component | Status |
|-------|-----------|--------|
| Compute | 0G sealed inference (TEE) | ✓ Working, all 13 agents |
| Storage | 0G decentralized storage | ✓ Working |
| Chain | 0G iNFT (ERC-7857) | ✓ 2 users minted |
| Payments | x402 nanopayments on Arc | ✓ Working |
| Execution | Arc Uniswap V3 swap | ✓ Test swap confirmed |
| Audit | Hedera HCS cycle logging | ✓ Working |
| Data | 10 real market data sources | ✓ All wired |
| Hosting | 13 Fly.io agents | ✓ All live, auto-suspend |
| DB | Supabase debate transcripts | ✓ Schema + API ready |
| UI | Next.js dashboard basic | ✓ Working on Railway |

### ⚠ NEEDS WORK (the hierarchy gap)

| Layer | Component | Effort |
|-------|-----------|--------|
| Augmented | Alpha/Risk/Executor hire their own specialists | 3-4 hours |
| Augmented | Tool use via 0G inference (function calling) | 2 hours |
| Augmented | Hire budget enforcement per debate turn | 1 hour |
| Orchestrator | Delegate to debate layer instead of orchestrating | 1 hour |
| Data | Pass structured data snapshots to debate (not just strings) | 1 hour |
| UI | Goal input on dashboard | 1 hour |
| UI | Live debate streaming (SSE) | 2 hours |
| UI | Fly.io status in marketplace | 1 hour |
| Execution | Cleaner tx hierarchy (swap → HCS → Storage → iNFT) | 1 hour |
| Execution | Nanopayment metadata in HCS record | 30 min |

**Total remaining:** ~12-15 hours of focused work to deliver the full vision.

---

## 8. Validation Checklist — Is the Swarm Actually Talking?

Run these in order to verify the full flow:

### 8.1 Agent reachability
```bash
for agent in sentiment whale momentum memecoin-hunter twitter-alpha \
             defi-yield news-scanner onchain-forensics options-flow \
             macro-correlator alpha risk executor; do
  echo -n "$agent: "
  curl -sf -m 10 "https://vm-$agent.fly.dev/healthz" | jq -r .status
done
# Expected: all "ok"
```

### 8.2 Real data fetch (wake up a specialist)
```bash
curl -sf -m 30 -X POST "https://vm-sentiment.fly.dev/analyze" \
  -H "Content-Type: application/json" \
  -d '{"task": "Analyze current ETH sentiment"}'
# Expected: JSON with signal, confidence, reasoning, rawDataSnapshot (with real F&G value)
```

### 8.3 0G attestation present
```bash
curl -sf -X POST "https://vm-momentum.fly.dev/analyze" \
  -H "Content-Type: application/json" -d '{}' | jq '.attestationHash'
# Expected: a real hash like "0x..." (not "local-fallback" or "error")
```

### 8.4 Debate agent responds to context
```bash
curl -sf -X POST "https://vm-alpha.fly.dev/analyze" \
  -H "Content-Type: application/json" \
  -d '{"userMessage": "Specialist signals: sentiment=BUY(70%), momentum=BUY(65%). Risk profile: balanced. Max allocation: 10%."}'
# Expected: JSON with reasoning + action/asset/pct
```

### 8.5 Full cycle via Telegram
```
1. Open @ETHGlobal_Cannes_2026_Bot in Telegram
2. Send /run
3. Watch logs: railway logs | grep -E "cycle|debate|specialist"
4. Verify: all Fly.io URLs are called (check Fly dashboard — machines move Suspended → Running)
5. Verify: Telegram returns message with Hashscan + ArcScan links
6. Verify: Supabase `debate_transcripts` table has new rows with tee_verified=true
```

### 8.6 On-chain proof
```bash
# HCS audit
open https://hashscan.io/testnet/topic/0.0.8497439

# Swap tx (from latest cycle)
# Check Supabase: SELECT swap_tx_hash FROM cycles ORDER BY created_at DESC LIMIT 1;
# Then: open https://testnet.arcscan.app/tx/<hash>

# iNFT metadata update
open https://chainscan-newton.0g.ai/address/0x73e3016D0D3Bf2985c55860cd2A51FF017c2c874
```

---

## 9. Recommended Next Steps (Priority Order)

Based on time constraints and judge impact:

**Priority 1 — Make the hierarchy real (4 hours):**
1. Add `/hire` endpoint to each debate agent (alpha/risk/executor) that:
   - Receives user goal
   - Picks 2-3 specialists from hardcoded list based on agent's role
   - Calls each specialist URL via `fetchWithPayment` (x402)
   - Synthesizes data + returns enriched response
2. Update `main-agent.ts` to call the debate agents' `/hire` endpoints instead of hiring directly
3. Rename the debate agents' HTTP layer to reflect the hierarchy

**Priority 2 — Make the demo visual (3 hours):**
4. Add goal input to dashboard
5. Live Fly.io status cards in marketplace
6. Debate theater with turn-by-turn SSE streaming

**Priority 3 — Clean execution (2 hours):**
7. Transaction hierarchy in `commitCycle` — swap first, then audit
8. Nanopayment metadata in HCS compact record
9. End-to-end test with real tx hash in final record

**Priority 4 — Bounty polish (1 hour):**
10. Record 3-minute demo video showing:
    - User goal input
    - 13 agents on Fly.io dashboard
    - Debate theater animation
    - Hashscan + ArcScan proof links
    - Reputation leaderboard

---

## 10. Architecture Files Map

Critical files for implementing the remaining work:

| File | Purpose | Needs Change? |
|------|---------|---------------|
| `src/agents/main-agent.ts` | Cycle orchestration | YES — delegate to debate layer |
| `src/agents/fly-agent-server.ts` | Per-agent Fly server | YES — add /hire endpoint to debate agents |
| `src/agents/hire-specialist.ts` | x402 + HTTP hire flow | REUSE — debate agents call this |
| `src/agents/adversarial.ts` | Debate pipeline | MINOR — receive structured data |
| `src/config/agent-registry.ts` | Agent URL mapping | NO — already built |
| `src/marketplace/hiring-strategy.ts` | Specialist selection | DEPRECATE — move logic to debate agents |
| `src/og/inference.ts` | 0G sealed inference | NO — working |
| `src/execution/arc-swap.ts` | Arc swap | MINOR — tx hierarchy cleanup |
| `src/store/action-logger.ts` | Supabase logging | NO — working |
| `app/dashboard/page.tsx` | Main UI | YES — add goal input |
| `app/marketplace/page.tsx` | Agent marketplace | YES — add Fly status |
| `app/api/cycle/run/[userId]/route.ts` | Cycle trigger | YES — accept goal param |
| `fly/deploy-agent.sh` | Fly deploy script | NO — all 13 deployed |

---

## 11. Bounty Alignment

| Bounty | What We Have | What This Unlocks |
|--------|-------------|-------------------|
| **0G OpenClaw ($6K)** | 14 agents with SOUL.md + 0G inference on every call | Strong — 13 live on Fly, all TEE-attested |
| **0G DeFi ($6K)** | Full DeFi agent swarm with real market data | Strong — specialists cover sentiment/onchain/options/macro |
| **Arc Agentic Economy ($6K)** | Real x402 nanopayments between independent services | Strong — each Fly agent has own wallet, pays/gets paid |
| **Hedera AI Agents ($6K)** | Every cycle logged to HCS with debate + attestations | Strong — topic `0.0.8497439` has real records |
| **Hedera No-Solidity ($2.5K)** | HTS fund token + HCS audit + scheduled transactions | Strong — zero Solidity on Hedera |
| **Hedera Tokenization ($2.5K)** | HTS fund token `0.0.8498202` for fractional shares | Medium — works, needs polish |

**Total potential:** $29K across 6 bounties. The hierarchy gap is the main thing standing between "we used these chains" and "we built an autonomous agent economy on these chains."

---

*This document reflects the exact state as of Apr 4, 2026. The 13 agents are confirmed live via `/healthz` checks. The gap analysis is the author's best-effort reading of the current code vs. the user's stated vision.*
