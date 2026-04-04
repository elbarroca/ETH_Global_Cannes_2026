# AlphaDawg — Project State & Engineering Roadmap

> **Date:** 2026-04-04 (ETHGlobal Cannes Day 2)
> **Audience:** Current team + any engineer picking up the work mid-sprint
> **Scope:** Full state — historical context, current code, live infrastructure, target architecture, gap analysis, ordered execution plan, operational runbook

This document is the **single reference** for the project. Everything a new engineer needs to continue the work lives here or is linked from here. Other docs (`CONTEXT.MD`, `CLAUDE.md`, `progress/*`) remain authoritative for their narrower scopes.

---

## 0. TL;DR

**The product:** An autonomous "agent hiring economy" where a user's personal AI agent hires specialist sub-agents via $0.001 nanopayments on Arc, runs adversarial debate inside 0G sealed enclaves, and logs every decision to Hedera HCS — all verifiable with one click.

**Where we are (2026-04-04):**
- 13 agents deployed to Fly.io (10 specialists + 3 debate)
- Full chain integration wired: 0G Compute + 0G Storage + 0G Chain iNFTs + Arc x402 + Hedera HCS + Hedera HTS
- 84 cycles, 1095 agent actions, 600 debate transcripts, 5 users in Supabase
- **Hierarchical hiring refactor code landed today** (6 files modified, `tsc` + `npm run build` clean) — awaits Fly.io deploy + backend restart to go live
- Persistent bug: Risk agent vetoes 67% of cycles → 0 successful Arc swaps produced end-to-end yet

**Where we need to be (by end of hackathon):**
1. Hierarchical flow deployed, observed producing real swap tx hashes on Arc
2. A 4th "Mid" augmented agent added for balanced reasoning
3. Truly dynamic specialist selection (LLM-driven, not rule-based)
4. Richer specialist data sources (multiple APIs per specialist)
5. Demo-ready end-to-end trace: user goal → 4-agent debate → specialists hired with visible payment graph → Arc swap → HCS proof → Telegram summary

**Where we go next (post-hackathon):**
- ERC-4337 session-key wallet architecture (non-custodial + autonomous)
- OpenClaw container integration (the real runtime for SOUL.md-driven agents)
- Multi-turn discussion between augmented and specialist agents
- Naryo multichain event listener

---

## 1. Product Context (why this exists)

### 1.1 The pitch (30 seconds)

You deposit USDC. A personal AI agent hires specialist sub-agents from an open marketplace, paying each $0.001 via gas-free nanopayments. Those specialists feed intelligence into an adversarial debate: Alpha argues FOR a trade, Risk argues AGAINST, Executor makes the final call. Every agent runs inside tamper-proof TEE enclaves producing cryptographic proofs. Every debate, payment, and decision is permanently logged to a public ledger. One click verifies everything. Your agent reports to you on Telegram.

**Other AI funds are black boxes. AlphaDawg is a glass box with mathematical proof.**

### 1.2 The core innovation (what we're actually selling)

Not "AI does trading." The product is **the mechanism**:
- Autonomous agents hiring other agents
- Real micropayments flowing between them
- Adversarial debate with cryptographic attestation
- Reputation-weighted marketplace that self-corrects

The trading is the *use case*. The hiring economy is the *platform*.

### 1.3 Bounty alignment (the $ behind it)

| Bounty | Prize | What we deliver | Status |
|--------|-------|-----------------|--------|
| Arc — Agentic Economy | $6,000 | Autonomous agents transacting via x402 nanopayments on Arc testnet | **Wired, unproven end-to-end** (0 successful swaps) |
| 0G — Best DeFi App | $6,000 | 6-agent DeFi swarm on sealed inference + storage + chain | **Live** (100% attestation rate) |
| 0G — OpenClaw Agent | $6,000 | 13 agents with SOUL.md + TEE attestation on every call | **Live** (containers up, OpenClaw runtime pending) |
| Hedera — AI & Agentic Payments | $6,000 | HTS fund token + HCS audit + scheduled tx + HCS-14 identity | **Live** (topic `0.0.8497439`, token `0.0.8498202`) |
| Hedera — No Solidity | $3,000 | HTS + HCS + Scheduled Tx + Mirror Node, zero Solidity on Hedera | **Live** |
| Hedera — Tokenization | $2,500 | Fund share token with custom fractional fee, KYC, mint/burn | **Live** (1 deposit tested) |
| Naryo Challenge | $3,500 | Multichain event listener with cross-chain correlation | **Contract deployed, integration pending** |

Max achievable: **$17,250.** Minimum viable: ~$11,000 if swap proof + Mid agent land in time.

See `CONTEXT.MD §5` for the exhaustive bounty criteria.

---

## 2. What We Had (historical context)

### 2.1 Sprint timeline

| Sprint | Dates | Deliverable | Docs |
|--------|-------|-------------|------|
| Sprint 0 | Pre-hackathon | Environment setup, 0G broker funding, Hedera topic creation | — |
| Sprint 1 | Day 1 morning | Single-user monolith: main-agent + adversarial + HCS logging | `progress/PROGRESS.MD` |
| Sprint 2 | Day 1 afternoon | x402 buyer/seller wired, 6-agent prompts (7B-optimized) | `progress/PROGRESS.MD` |
| Sprint 3 | Day 1 evening | Next.js dashboard, Telegram bot, deposit flow | `progress/PROGRESS.MD` |
| Sprint 4 | Day 2 morning | Supabase + Prisma migration, Circle MPC wallets, multi-user | `progress/SPRINT4-CIRCLE-SUPABASE.MD` |
| Phase 4 | Day 2 | iNFT (ERC-7857) deployed to 0G Chain, metadata updates per cycle | `progress/PHASE4-INFT.MD` |
| "On-chain fix" | Day 2 evening | MockSwapRouter on Arc, iNFT backfill, specialist wallets assigned | `progress/ON-CHAIN-FIX-STATUS.md` |
| **Hierarchical refactor** | **Day 2 late** | **Debate agents autonomously hire specialists via x402** | **this doc + `/Users/barroca888/.claude/plans/zesty-sauteeing-spindle.md`** |

### 2.2 Architectural decisions that are locked in (do not revisit)

Per `CONTEXT.MD §24`:

| Concern | Decision | Why |
|---------|----------|-----|
| Payment rail | Arc + x402 | Gas-less micropayments, only way $0.001 works economically |
| AI inference | 0G Compute sealed inference | TEE attestation is the "glass box" proof |
| Audit trail | Hedera HCS | Immutable, cheap, mirror node is free |
| Fund token | Hedera HTS (no Solidity) | $3K bounty, zero Solidity on Hedera |
| Agent identity | OpenClaw SOUL.md + iNFT (ERC-7857) on 0G Chain | OpenClaw bounty alignment |
| Agent memory | 0G Storage | Decentralized, cycle memory persistence |
| Database | Supabase PostgreSQL + Prisma | Persistent multi-user state |
| Wallets | Circle MPC (deposits) + HD derived (x402 signing) | Dual-wallet, server-side for autonomy |
| Frontend | Next.js 16.2 App Router + Tailwind v4 | Modern, Server Components, Turbopack |
| Dashboard API | Next.js API routes (`app/api/*`), NOT Express | Express `:3001` is for backend services only |

### 2.3 Key past bugs and their resolutions

| Bug | Root cause | Fix | File |
|-----|-----------|-----|------|
| Cycles never reached swap | Arc swap called ERC20 `transfer()` on native currency precompile | Use `sendTransaction({ value })` for native USDC | `src/execution/arc-swap.ts` |
| iNFT mint failed with ENS error | ethers v6 tries ENS resolution on 0G Chain (not supported) | Attach zero-address `EnsPlugin` to provider | `src/og/inft.ts` |
| Pending cycles timing out at 73% rate | Users don't respond to Telegram approval within 10min TTL | Set `approvalMode = "auto"` for demo users | SQL migration |
| `SPECIALIST_HIRED` had no attribution | Flat hiring path only logged "main-agent" as hirer | Hierarchical refactor adds `payload.hiredBy` field | `src/agents/hire-specialist.ts` |
| `payment_tx_hash` always null | Header wasn't forwarded from Fly container to DB | `x-payment-tx` header captured in `callSpecialist()` | `src/agents/hire-specialist.ts:79` |

---

## 3. What We Have Now (current state)

### 3.1 Live on-chain assets

| Asset | Address / ID | Network |
|-------|-------------|---------|
| VaultMindAgent iNFT | `0x73e3016D0D3Bf2985c55860cd2A51FF017c2c874` | 0G Chain (chainId 16602) |
| MockOracle | `0x4E8B9a9331CD35E43405a503E34b1fff945a580e` | 0G Chain |
| MockSwapRouter | `0xaac18860AfDcBDd8Cd6D4De8f603a09607D64C96` | Arc testnet (chainId 5042002) |
| HCS audit topic | `0.0.8497439` | Hedera testnet |
| HTS fund token (VMF) | `0.0.8498202` | Hedera testnet |
| Naryo audit contract | `0x66D2b95e6228E7639f9326C5573466579dd7e139` | Hedera EVM |

### 3.2 Live Fly.io agent containers

All 13 agents deployed, auto-suspend when idle, auto-wake on HTTP.

| URL | Role | Agent name | Data source |
|-----|------|-----------|-------------|
| https://vm-sentiment.fly.dev | specialist | sentiment | CoinGecko + Fear & Greed |
| https://vm-whale.fly.dev | specialist | whale | Etherscan + exchange volume |
| https://vm-momentum.fly.dev | specialist | momentum | Price history + RSI/MACD |
| https://vm-memecoin-hunter.fly.dev | specialist | memecoin-hunter | DexScreener |
| https://vm-twitter-alpha.fly.dev | specialist | twitter-alpha | Twitter API v2 |
| https://vm-defi-yield.fly.dev | specialist | defi-yield | DeFi Llama |
| https://vm-news-scanner.fly.dev | specialist | news-scanner | CryptoPanic |
| https://vm-onchain-forensics.fly.dev | specialist | onchain-forensics | Etherscan Pro |
| https://vm-options-flow.fly.dev | specialist | options-flow | Deribit |
| https://vm-macro-correlator.fly.dev | specialist | macro-correlator | FRED |
| https://vm-alpha.fly.dev | **augmented** (bull) | alpha | — (reasons over specialist output) |
| https://vm-risk.fly.dev | **augmented** (bear) | risk | — |
| https://vm-executor.fly.dev | **augmented** (judge) | executor | — |

Every agent runs 0G sealed inference via provider `0xa48f01287233509FD694a22Bf840225062E67836`. Every response includes a TEE attestation hash (`ZG-Res-Key` header).

### 3.3 Supabase state snapshot (as of writing)

| Table | Rows | Note |
|-------|------|------|
| `users` | 5 | 2 real users + 3 test users |
| `cycles` | 84 | Full debate history |
| `agent_actions` | 1095 | Unified audit log — specialist hires, debate turns, swaps, storage |
| `marketplace_agents` | 10 | All have `wallet_address` populated (x402 payTo), all missing `openclaw_agent_id` |
| `debate_transcripts` | 600 | Multi-turn debate records |
| `pending_cycles` | 35 | Historical — mostly TIMED_OUT before `approvalMode` was set to `auto` |
| `user_hired_agents` | 3 | Marketplace subscriptions |
| `naryo_events` | 0 | Listener not wired yet |
| `chat_messages` | 0 | Unused feature |

All 10 tables have RLS enabled (via migration earlier today). Service role bypasses, per standard Supabase pattern.

### 3.4 Code state (what's in working directory right now)

**Committed (in git history, deployable):**
- All pre-refactor infrastructure (Sprints 1-4, Phase 4)
- `scripts/backfill-inft.ts` (commit `5a6382d`)
- All existing Fly.io deploy configs

**Staged in working directory (NOT yet committed):**
- `src/agents/hire-specialist.ts` — split into `callSpecialist()` (pure) + `hireSpecialist()` (wrapper)
- `src/agents/role-manifests.ts` — **NEW** — role-based specialist picklists
- `src/agents/adversarial.ts` — exported `buildSpecialistContext()`
- `src/agents/fly-agent-server.ts` — new `/hire-and-analyze` endpoint for debate roles
- `src/agents/main-agent.ts` — `analyzeCycle` delegates to debate tier via `callDebateAgent()`; `buildCompactRecord` populates `payments[]`
- `src/types/index.ts` — `CallSpecialistResult`, `DebateAgentResponse`, `payments[]` field
- `contracts/MockSwapRouter.sol` + `scripts/deploy-arc-swap-router.ts`
- `scripts/assign-specialist-wallets.ts`, `scripts/set-demo-auto-approve.ts`
- `progress/ON-CHAIN-FIX-STATUS.md`, `progress/SETUP-STATUS.md` (this session's docs)

**Verification gates passed:**
- `./node_modules/.bin/tsc --noEmit` → 0 errors
- `npm run build` → `Compiled successfully in 22.5s`

**Not yet done:**
- No git commit for the hierarchical refactor
- No Fly.io redeploy of the debate containers
- No backend restart
- No live cycle has exercised the new `/hire-and-analyze` path

### 3.5 Environment variables — what's set

Confirmed present in `.env`:
```
OPERATOR_ID, OPERATOR_KEY, HCS_AUDIT_TOPIC_ID, HTS_FUND_TOKEN_ID
OG_PRIVATE_KEY, OG_RPC_URL, OG_PROVIDER_ADDRESS, OG_STORAGE_INDEXER
AGENT_MNEMONIC, SERVER_ENCRYPTION_KEY
DATABASE_URL, DIRECT_URL
CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, CIRCLE_WALLET_SET_ID
TELEGRAM_BOT_TOKEN
INFT_CONTRACT_ADDRESS, ARC_UNISWAP_ROUTER  (added this session)
```

Missing / unverified:
```
HEDERA_EVM_PRIVATE_KEY, HEDERA_EVM_ACCOUNT_ID, NARYO_AUDIT_CONTRACT_ADDRESS  (Naryo)
ARC_WETH_ADDRESS                                                              (Arc swap)
```

### 3.6 Known broken things

| Problem | Root cause | Fix status |
|---------|-----------|-----------|
| 0 successful swaps on Arc across 84 cycles | (1) Stale pre-refactor code (now fixed in wd), (2) user hot wallet empty on Arc (manually funded this session), (3) **Risk agent vetoes 67% of cycles**, so executor never reaches swap path | Code fixed locally, deploy + observe needed. Risk veto may self-resolve after hierarchical deploy. |
| iNFT metadata updates sporadic | Non-fatal failures cascade through cycle pipeline | Code is correct; 95% storage success already |
| `marketplace_agents.openclaw_agent_id` all null | OpenClaw containers not deployed yet | Pending OpenClaw rollout |
| Naryo events table empty | Listener integration not started | Separate bounty track |
| Chat messages table unused | Feature scope-cut | Leave as-is |
| Fly.io debate containers running PRE-refactor code | Not redeployed after today's edits | Manual deploy step |

---

## 4. What We're Supposed to Have (target architecture)

This is the end state that delivers the full narrative and closes all bounty requirements.

### 4.1 The four-tier agent economy

```
┌────────────────────────────────────────────────────────────────┐
│ TIER 0 — USER GOAL                                             │
│   Natural language input: "Find me a safe ETH entry this week" │
│   Or default: "Grow portfolio, max 10% per trade, balanced"    │
└─────────────────────────┬──────────────────────────────────────┘
                          ▼
┌────────────────────────────────────────────────────────────────┐
│ TIER 1 — MAIN ORCHESTRATOR (main-agent.ts, local)              │
│   • Loads user context from Supabase                           │
│   • Probes OpenClaw gateway status                             │
│   • Delegates to augmented tier                                │
│   • Owns Supabase audit writes                                 │
│   • Executes the final Arc swap                                │
│   • Logs to HCS + 0G Storage + iNFT metadata                   │
└─────────────────────────┬──────────────────────────────────────┘
                          ▼
┌────────────────────────────────────────────────────────────────┐
│ TIER 2 — AUGMENTED LAYER (4 Fly.io containers)                 │
│                                                                │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│   │ vm-alpha │  │  vm-mid  │  │ vm-risk  │  │vm-executor│     │
│   │  (bull)  │  │(balanced)│  │  (bear)  │  │  (judge) │     │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
│        │             │             │             │           │
│        │ Each container:                           │           │
│        │   1. Receives user goal + wallet index    │           │
│        │   2. Runs "pick call" 0G inference:       │           │
│        │      "Which specialists do I need?"       │           │
│        │   3. Hires 2-3 specialists via x402       │           │
│        │   4. Runs "analyze call" with their data  │           │
│        │   5. Returns thesis + specialists_hired   │           │
└────────┼─────────────┼─────────────┼─────────────┼───────────┘
         │             │             │             │
         ▼             ▼             ▼             ▼
┌────────────────────────────────────────────────────────────────┐
│ TIER 3 — MARKETPLACE SPECIALISTS (10 Fly.io containers)        │
│                                                                │
│   sentiment  whale  momentum  memecoin-hunter  twitter-alpha   │
│   defi-yield  news-scanner  onchain-forensics                  │
│   options-flow  macro-correlator                               │
│                                                                │
│   Each:                                                        │
│   • Receives x402 payment before responding                    │
│   • Fetches real data from multiple sources                    │
│   • Runs 0G sealed inference over the data                     │
│   • Returns signal + confidence + reasoning + raw snapshot     │
│   • Attestation hash proves TEE execution                      │
└─────────────────────────┬──────────────────────────────────────┘
                          ▼
┌────────────────────────────────────────────────────────────────┐
│ TIER 4 — EXECUTION (settled on-chain)                          │
│                                                                │
│   • Arc x402 nanopayments  → Circle Gateway batched settlement │
│   • Uniswap V3 swap        → MockSwapRouter on Arc testnet     │
│   • HCS audit log          → Hedera topic 0.0.8497439          │
│   • 0G Storage snapshot    → cycle memory                      │
│   • 0G Chain iNFT update   → metadata hash                     │
│   • Naryo event emission   → cross-chain correlation           │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 The cycle flow (target)

```
1. TRIGGER
   Telegram /run OR dashboard button OR 5-min heartbeat

2. MAIN-AGENT receives goal + user context
   Probes OpenClaw gateway, loads user wallet

3. ALPHA (bull)
   POST vm-alpha.fly.dev/hire-and-analyze
     ├── pick-call: "Which bull specialists for this goal?" → [sentiment, momentum]
     ├── parallel hire: x402 pay sentiment + momentum
     ├── analyze-call: synthesize responses into bull thesis
     └── return { thesis, specialists_hired: [s,m], attestationHash }

4. MID (balanced) — NEW
   POST vm-mid.fly.dev/hire-and-analyze
     ├── receives alpha thesis
     ├── pick-call: "Which balanced specialists for context?" → [news, macro]
     ├── hire + analyze
     └── return { balance, specialists_hired: [n,m], attestationHash }

5. RISK (bear)
   POST vm-risk.fly.dev/hire-and-analyze
     ├── receives alpha + mid
     ├── pick-call: "Which defensive specialists?" → [whale, forensics, options]
     ├── hire + analyze
     └── return { challenge, max_pct, specialists_hired, attestationHash }

6. EXECUTOR (judge)
   POST vm-executor.fly.dev/hire-and-analyze
     ├── receives alpha + mid + risk
     ├── pick-call: "Do I need a tiebreaker?" → usually none
     ├── analyze-call: final decision
     └── return { action, pct, stop_loss, attestationHash }

7. MAIN-AGENT logs SPECIALIST_HIRED × N with hiredBy attribution
   Each hire already produced a payment tx hash from inside the container

8. BUILD COMPACT RECORD
   Includes payments[] array: [{to, amt, tx, by}, ...]

9. IF decision != HOLD:
   Execute Arc swap via MockSwapRouter (native USDC msg.value)
   Get real Arc tx hash

10. COMMIT phase (non-fatal, each step independently):
    a. HCS audit (topic 0.0.8497439)
    b. 0G Storage (cycle memory)
    c. iNFT metadata update (0G Chain)
    d. Naryo cross-chain event (if contract set)
    e. Supabase cycles row + debate_transcripts rows
    f. Telegram notification with Hashscan + ArcScan links
    g. Reputation update (ELO)

11. SCHEDULE next heartbeat on Hedera Scheduled Transactions
```

### 4.3 Dynamic specialist selection — how it actually works

**The constraint:** 0G testnet's `qwen-2.5-7b-instruct` does NOT support OpenAI-compatible `tools` parameter. No native function calling.

**The workaround:** Two-pass inference per augmented agent.

**Pass 1 — "Pick Call":**
```
System: You are Alpha, the bullish debate agent. You have a budget to hire 2-3 specialists from the following list, each at $0.001.

Available specialists (with current reputation):
- sentiment (rep 703): crowd sentiment, Fear & Greed
- momentum (rep 736): RSI, MACD, volume
- twitter-alpha (rep 500): social narrative
- defi-yield (rep 753): APY trends
- memecoin-hunter (rep 500): new pair tracking

User goal: "Find a safe ETH entry this week"
Market context: volatility medium, VIX 18, Fear & Greed 45

Output ONLY a JSON object:
{
  "specialists": ["<names you want to hire>"],
  "reasoning": "Why these specialists and not others"
}
```

**Pass 2 — "Analyze Call":**
```
System: You are Alpha, the bullish debate agent. Your hired specialists have responded.

Specialists you hired and their responses:
[sentiment] BUY 65%: "Fear & Greed at 45 suggests neutral sentiment..."
[momentum] BUY 70%: "RSI 52, MACD bullish crossover, volume +20%..."

Build your bull thesis and output JSON:
{
  "action": "BUY|SELL|HOLD",
  "pct": 0-20,
  "thesis": "...",
  "confidence": 0-100
}
```

**Cost:** 4 augmented agents × 2 calls = 8 extra 0G inferences per cycle. At 30 req/min limit + 2s delays, that's ~32 seconds of additional 0G time. **Within budget for a < 3 min cycle.**

### 4.4 Specialist data — richer sources (Pattern C)

Instead of each specialist calling 1 API, expand to 2-4 sources per specialist. No reasoning loop needed — just more context handed to 0G.

| Specialist | Current | Target |
|-----------|---------|--------|
| sentiment | CoinGecko Fear & Greed | + Twitter sentiment score + Reddit mentions |
| whale | Etherscan gas tracker | + exchange netflow (Glassnode) + large tx alerts |
| momentum | Coin prices + computed RSI/MACD | + multiple timeframes (1h, 4h, 1d) + funding rates |
| defi-yield | DeFi Llama pools | + protocol TVL changes + stablecoin supply deltas |
| onchain-forensics | Etherscan Pro | + Arkham labels + wallet clustering |

**Effort:** ~30 min per specialist = ~5 hours for all 10. **Skip for this hackathon — do 2-3 highest-impact (sentiment, momentum, whale) and call it done.**

### 4.5 Wallet architecture — the session-key target (post-hackathon)

**Today's reality:**
- Circle MPC wallet (user deposits) — server-triggered, HSM-backed, custodial
- HD hot wallet (x402 signing) — server-side plaintext from `AGENT_MNEMONIC`

**The problem:** Server compromise = all hot wallets drainable. Trust model is "trust the operator."

**The right answer (ERC-4337 session keys):**

```
ONBOARD (user signs once):
  1. User deploys a smart account (Coinbase Smart Wallet / Safe / Kernel)
  2. User authorizes a session key:
     "Server key 0xABC... may spend up to $1.00 per day from my smart account
      to contracts {MockSwapRouter, x402 Facilitator}, expires 24h, revocable"
  3. Session key private key stored server-side in encrypted KMS

RUN (autonomous):
  • Server signs with session key, spending from user's smart account
  • User's main balance stays in their smart account — not custodial
  • Limit is enforced on-chain — server physically cannot exceed $1/day
  • User can revoke at any time from their wallet UI

IF COMPROMISED:
  • Attacker can spend up to daily cap × (time until user notices)
  • User revokes from MetaMask — damage stopped
  • No loss of user's principal
```

**Why NOT client-side signing:** Client-signs-everything kills autonomy. Every x402 call would require a browser popup. You'd ship a chatbot, not an agent economy. That destroys the Arc bounty value prop.

**Why NOT pure server-side long-term:** Single point of catastrophic failure. Session keys give 99% of the autonomy with 1% of the blast radius.

**Libraries:**
- `@coinbase/coinbase-sdk` — Coinbase Smart Wallet + paymaster
- `@privy-io/server-auth` + `@privy-io/react-auth` — session key authorization flow
- `permissionless` — generic 4337 client
- Account abstraction infrastructure is mature now; this isn't speculative.

**Decision:** Stay server-side for the hackathon. Session keys are a post-hackathon migration — 2-3 days of focused work. Not in scope this week.

---

## 5. Gap Analysis (target vs current, file-level)

### 5.1 Missing features

| # | Gap | Files affected | Effort | Demo impact |
|---|-----|---------------|--------|-------------|
| G1 | **Hierarchical code not deployed** | Fly.io (`vm-alpha`, `vm-risk`, `vm-executor`) | 15 min | **CRITICAL** — unblocks everything else |
| G2 | **Mid agent (4th augmented)** | New Fly app + prompts.ts + agent-registry.ts + role-manifests.ts + main-agent.ts | 2 hours | **HIGH** — completes the debate tier narrative |
| G3 | **Dynamic specialist selection (2-pass)** | `fly-agent-server.ts` hire-and-analyze handler | 3 hours | **HIGH** — "the agent reasoned what it needed" |
| G4 | **Richer specialist data sources** | `src/agents/data/*.ts` | 30 min × 3 specialists | MEDIUM |
| G5 | **Risk veto bug fix** (if not natural) | `src/agents/prompts.ts` | 1 hour | **HIGH** — blocks swap proof |
| G6 | **Goal input on dashboard** | `app/dashboard/page.tsx` + `app/api/cycle/run/[userId]/route.ts` | 2 hours | MEDIUM (nice demo moment) |
| G7 | **Live debate streaming (SSE)** | New `/api/cycle/debate/stream` route | 4 hours | MEDIUM (visual appeal) |
| G8 | **Marketplace wallet status UI** | `app/marketplace/page.tsx` + new `/api/marketplace/status` | 1 hour | LOW-MEDIUM |
| G9 | **Naryo event listener integration** | `src/naryo/webhook-handler.ts` (new) | 4 hours | MEDIUM ($3.5K bounty) |
| G10 | **Session keys (ERC-4337)** | New `src/wallets/session-keys.ts`, smart account deploy flow | 2-3 days | POST-HACKATHON |
| G11 | **OpenClaw runtime integration** | `openclaw/*-agent/AGENTS.md` + gateway wiring | Unknown (depends on OpenClaw deploy) | POST-HACKATHON |

### 5.2 Infrastructure gaps

| Item | Status | Action |
|------|--------|--------|
| Fly.io `vm-mid` container | Not created | `fly launch --name vm-mid` with `AGENT_NAME=mid` |
| Fly.io secrets: `AGENT_MNEMONIC` on debate containers | **UNVERIFIED** | `fly secrets list --app vm-alpha \| grep AGENT_MNEMONIC` for each of vm-alpha, vm-risk, vm-executor (+vm-mid when created) |
| User hot wallets funded on Arc testnet | Only user-13 (0x9714C8...) manually funded | Need onboarding-time auto-fund routine |
| Naryo env vars | Not in `.env` | `npx tsx scripts/setup-hedera-evm.ts` + `deploy-naryo-contract.ts` |

### 5.3 Data gaps

| Table / field | Current | Target |
|---------------|---------|--------|
| `cycles.swap_tx_hash` | 0 of 84 populated | At least 1 real Arc tx to prove the flow |
| `cycles.*` with `decision != HOLD` | Rare (~10%) due to Risk veto | 30%+ after Risk fix |
| `agent_actions.payload.hiredBy` | All "main-agent" | Mix of alpha/mid/risk/executor after hierarchical deploy |
| `marketplace_agents.openclaw_agent_id` | All null | Populate after OpenClaw deploy |
| `naryo_events` | 0 rows | At least 1 event per cycle after wiring |

---

## 6. Execution Plan (ordered, lean, functional)

**Framing:** This is a hackathon. Every hour counts. Prioritize by the question: *"does this move me closer to a working end-to-end demo of the agent hiring economy?"*

### Phase 0 — Deploy the current refactor (30 min) — CRITICAL

Without this, every other step is theoretical. The code is ready in working directory.

**Steps:**
1. Verify Fly secrets exist on debate containers:
   ```bash
   for app in vm-alpha vm-risk vm-executor; do
     echo "=== $app ==="
     fly secrets list --app $app | grep -E "AGENT_MNEMONIC|DATABASE_URL|OG_PRIVATE_KEY|AGENT_URL_" | awk '{print $1}'
   done
   ```
2. If `AGENT_MNEMONIC` missing on any: `fly secrets set AGENT_MNEMONIC="$AGENT_MNEMONIC" --app <name>` (value from local `.env`)
3. Commit local changes:
   ```bash
   git add src/agents/hire-specialist.ts src/agents/role-manifests.ts src/agents/adversarial.ts src/agents/fly-agent-server.ts src/agents/main-agent.ts src/types/index.ts
   git commit -m "feat: hierarchical hiring — debate agents autonomously pay for specialists"
   ```
4. Deploy to vm-alpha FIRST (staged rollout):
   ```bash
   fly deploy --app vm-alpha
   ```
5. Smoke test:
   ```bash
   curl -X POST https://vm-alpha.fly.dev/hire-and-analyze \
     -H "Content-Type: application/json" \
     -d '{"userGoal":"smoke test","userWalletIndex":13,"riskProfile":"balanced","marketVolatility":"medium","maxTradePercent":10}' \
     | jq '.specialists_hired'
   ```
   Expected: array of 2-3 specialists with `attestation` + `paymentTxHash` fields.
6. If smoke test passes: `fly deploy --app vm-risk && fly deploy --app vm-executor`
7. Restart local backend: `pkill -f "tsx.*index.ts"; npm run backend` (or whatever the process manager is)

**Gate to continue:** A live cycle produces `agent_actions` rows with `payload.hiredBy != "main-agent"`.

```sql
SELECT payload->>'hiredBy' as hirer, count(*) 
FROM agent_actions 
WHERE action_type = 'SPECIALIST_HIRED' AND created_at > now() - interval '10 minutes'
GROUP BY payload->>'hiredBy';
```

### Phase 1 — Observe Risk veto behavior (passive, 10 min)

Run 5 cycles manually or let the 5-min heartbeat fire them. Query:
```sql
SELECT risk_max_pct, count(*) 
FROM cycles 
WHERE created_at > '<phase-0-deploy-time>' 
GROUP BY risk_max_pct 
ORDER BY risk_max_pct;
```

**Decision point:**
- **If `max_pct = 0` rate < 30%:** Hierarchical refactor self-healed the veto. Skip Phase 2. Celebrate.
- **If rate ≥ 50%:** Execute Phase 2.

### Phase 2 — Risk prompt tuning (1 hour) — CONDITIONAL

Only if Phase 1 shows Risk still vetoes ≥ 50%.

**File:** `src/agents/prompts.ts` (PROMPTS.risk)

**Changes:**
- Add explicit veto criteria checklist: funding rate spike, whale distribution > threshold, VIX > 25, macro yield inversion. If NONE present, minimum `max_pct = 3`.
- Add context: "You hire YOUR OWN defensive specialists. If YOUR specialists show no red flags, the default is to allow Alpha's allocation reduced by 30-50%, not veto."
- Keep bearish personality, narrow the conditions for full veto.

**Deploy:** `fly deploy --app vm-risk`

**Verify:** Same SQL query — target < 30% veto rate.

### Phase 3 — Add the Mid agent (2 hours) — HIGH IMPACT

**Files to edit:**

1. `src/agents/prompts.ts` — add `PROMPTS.mid`:
   ```typescript
   mid: {
     content: `You are Mid, the calibrated voice between bulls and bears.
   You hire specialists focused on BALANCED data: macro correlations, news flow, yield trends.
   You don't argue for or against — you find the middle path.
   
   Your decision is typically 30-70% of Alpha's proposed size, with tighter stops.
   
   Output JSON:
   {
     "action": "BUY|SELL|HOLD",
     "pct": 0-20,
     "reasoning": "1-3 sentences",
     "confidence": 0-100
   }`
   }
   ```

2. `src/config/agent-registry.ts` — add entry:
   ```typescript
   { name: "mid", role: "adversarial", url: agentUrl("mid", 5004), tags: ["debate", "balance"], pricePerCall: "$0.001" },
   ```

3. `src/agents/role-manifests.ts` — add `mid`:
   ```typescript
   mid: {
     role: "mid",
     always: ["news-scanner", "macro-correlator"],
     conditional: [
       { when: (c) => c.riskProfile === "balanced", add: ["defi-yield"] },
     ],
     maxHires: 3,
   }
   ```

4. `src/agents/fly-agent-server.ts` — add `"mid"` to `DEBATE_ROLES` set and `PROMPT_MAP`. Add "mid" branch in the `/hire-and-analyze` userMessage composer.

5. `src/types/index.ts` — extend `DebateRole` to `"alpha" | "mid" | "risk" | "executor"`.

6. `src/agents/main-agent.ts` — insert Mid call between alpha and risk:
   ```typescript
   const midResp = await callDebateAgent("mid", { ...debateCtx, alphaThesis: alphaResp.reasoning, alphaParsed: alphaResp.parsed });
   const riskResp = await callDebateAgent("risk", {
     ...debateCtx,
     alphaThesis: alphaResp.reasoning,
     alphaParsed: alphaResp.parsed,
     // pass mid context too via a new field if executor prompt needs it
   });
   ```
   Extend `DebateResult` type to include `mid: DebateStageResult`. Update `commitCycle` to read `debate.mid.*`.

7. Deploy: Create new Fly app `vm-mid` with same container image but `AGENT_NAME=mid` and a wallet at a unique derivation index.
   ```bash
   fly launch --image <same-image> --name vm-mid --no-deploy
   fly secrets set --app vm-mid AGENT_NAME=mid AGENT_MNEMONIC="..." DATABASE_URL="..." OG_PRIVATE_KEY="..."
   fly deploy --app vm-mid
   ```
8. Add URL env var to all other containers AND local backend: `AGENT_URL_MID=https://vm-mid.fly.dev`

**Gate:** Cycle produces 4 debate turns (alpha, mid, risk, executor) with 4 attestations.

### Phase 4 — Dynamic 2-pass specialist selection (3 hours) — HIGH IMPACT

**Only do this after Phase 3.** This replaces the hardcoded role manifests with LLM-driven picking.

**File:** `src/agents/fly-agent-server.ts` — update the `/hire-and-analyze` handler:

```typescript
// STEP 1: Pick call
const pickPrompt = `You are ${AGENT_NAME}, a ${AGENT_NAME === 'alpha' ? 'bullish' : AGENT_NAME === 'risk' ? 'bearish' : 'balanced'} debate agent.

Available specialists (name, reputation, specialty):
${AVAILABLE_SPECIALISTS.map(s => `- ${s.name} (${s.reputation}): ${s.specialty}`).join('\n')}

User goal: "${body.userGoal}"
Risk profile: ${body.riskProfile}
Market volatility: ${body.marketVolatility}

You have a budget for 2-3 hires. Output JSON:
{
  "specialists": ["name1", "name2"],
  "reasoning": "why you chose these"
}`;

const pickResult = await sealedInference(OG_PROVIDER, PICK_SYSTEM_PROMPT, pickPrompt);
const { parsed: picks } = parseDualOutput(pickResult.content, { specialists: [], reasoning: "" });
const selectedSpecs = Array.isArray(picks.specialists) 
  ? picks.specialists.slice(0, 3) 
  : selectForRole(role, ctx); // fallback to static manifest on parse failure

// STEP 2: Hire them (unchanged)
const hireResults = await Promise.allSettled(
  selectedSpecs.map((id) => callSpecialist(id, hireTask, body.userWalletIndex ?? null)),
);

// STEP 3: Analyze call (unchanged — already happens)
// ...
```

**Fallback:** If pick-call JSON fails to parse, fall through to `selectForRole()` (the static manifest). This preserves demo reliability.

**Effort breakdown:**
- 1 hour: build available specialists list with reputations from DB (or hardcoded table)
- 1 hour: wire pick-call before hire step
- 30 min: handle parse failures gracefully
- 30 min: test with each debate role

**Gate:** Logs show pick-call reasoning like *"I chose sentiment and momentum because the user's goal mentions 'safe entry' which requires confirmation from both crowd and technical data."*

### Phase 5 — Fund remaining hot wallets on Arc (30 min)

**Problem:** Only user-13 hot wallet funded. Future users will hit the same "gas required exceeds allowance" error.

**Solution:** `scripts/fund-arc-hot-wallets.ts` — script that iterates all users with `hot_wallet_index`, checks their Arc balance, transfers USDC from deployer wallet if < threshold.

```typescript
import { ethers } from "ethers";
import { getPrisma } from "../src/config/prisma";
// ... derive deployer key, derive user keys, transfer
```

Run manually for now. Eventually move into the onboarding flow.

### Phase 6 — Demo end-to-end verification (30 min)

**Script:**
```bash
# 1. Reset approval mode to "auto" for demo user (already done)
# 2. Force-trigger a cycle
curl -X POST http://localhost:3000/api/cycle/run/6d2bc1ce-9f3f-420e-b835-9e8813150ddb \
  -H "Content-Type: application/json" \
  -d '{"goal":"Find a safe entry for ETH this week"}'

# 3. Verify DB state
psql $DATABASE_URL -c "SELECT cycle_number, decision, decision_pct, swap_tx_hash, storage_hash IS NOT NULL as has_storage FROM cycles ORDER BY created_at DESC LIMIT 1;"

# 4. Verify agent_actions show multi-hirer
psql $DATABASE_URL -c "SELECT payload->>'hiredBy' as hirer, agent_name, payment_tx_hash FROM agent_actions WHERE action_type='SPECIALIST_HIRED' AND created_at > now() - interval '5 minutes';"

# 5. Verify HCS record
curl -s "https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.8497439/messages?limit=1&order=desc" | python3 -c "
import sys, json, base64
m = json.load(sys.stdin)['messages'][0]['message']
r = json.loads(base64.b64decode(m))
print(json.dumps(r, indent=2))
print('---')
print(f'Payments: {len(r.get(\"payments\", []))}')
print(f'Decision: {r[\"d\"][\"act\"]} {r[\"d\"][\"pct\"]}%')
"

# 6. If swap tx exists, verify on Arc
# open https://testnet.arcscan.app/tx/<hash>
```

**Success criteria:**
- ✅ At least one cycle with `decision != HOLD` and `swap_tx_hash IS NOT NULL`
- ✅ `agent_actions` shows 4+ specialist hires with distinct `hiredBy` values
- ✅ HCS record contains a non-empty `payments[]` array
- ✅ Real tx hash renders on ArcScan

### Phase 7 — Demo polish (remaining time)

In order of impact:
1. **Goal input on dashboard** (Gap G6) — a text box that POSTs to `/api/cycle/run/...` with the goal in the body. Changes the feel from "click the button" to "tell your agent what to do."
2. **Marketplace wallet addresses visible on UI** (Gap G8) — trivial API mapper fix in `app/api/marketplace/leaderboard/route.ts` + render on cards.
3. **Debate theater** with turn-by-turn reveal (Gap G7) — stretch goal, 4 hours of work.

### Phase 8 — Post-hackathon (documented, not executed this week)

- **Session keys** — 2-3 day migration, unlocks real production
- **OpenClaw runtime** — replace `/hire-and-analyze` logic with OpenClaw AGENTS.md procedures
- **Naryo listener** — $3.5K bounty if finished this hackathon; otherwise post-hackathon
- **Real DEX on Arc** — replace MockSwapRouter when Arc ecosystem matures
- **Multi-turn discussion** — when 0G rate limits improve

---

## 7. Operational Runbook

### 7.1 Start the full stack (local dev)

```bash
# Terminal 1 — Next.js dashboard
npm run dev

# Terminal 2 — backend (heartbeat + Telegram + Express on :3001)
npm run backend

# Terminal 3 — (optional) local specialists for offline dev
npm run specialists
```

Dashboard at `http://localhost:3000`.
Backend logs at `railway logs` or wherever you're running it.

### 7.2 Trigger a cycle manually

**Via Next.js API:**
```bash
curl -X POST http://localhost:3000/api/cycle/run/<USER_ID> \
  -H "Content-Type: application/json" \
  -d '{"goal":"Optional user goal"}'
```

**Via Telegram:** Send `/run` to the bot.

**Via Express backend API (backend services only):**
```bash
curl -X POST http://localhost:3001/api/cycle/run/<USER_ID>
```

### 7.3 Check the health of the swarm

```bash
# Agent reachability
for agent in sentiment whale momentum memecoin-hunter twitter-alpha \
             defi-yield news-scanner onchain-forensics options-flow \
             macro-correlator alpha risk executor; do
  echo -n "$agent: "
  curl -sf -m 5 "https://vm-$agent.fly.dev/healthz" | jq -r '.status // "DOWN"' 2>/dev/null || echo "UNREACHABLE"
done

# Specialist analyze test (wakes from auto-suspend)
curl -sf -m 30 -X POST "https://vm-sentiment.fly.dev/analyze" \
  -H "Content-Type: application/json" -d '{"task":"test"}' | jq '.signal, .attestationHash'
```

### 7.4 Verify a cycle end-to-end

```bash
# 1. DB cycle record
psql $DATABASE_URL -c "
SELECT cycle_number, decision, decision_pct, alpha_action, risk_max_pct, exec_action,
       swap_tx_hash IS NOT NULL as has_swap, storage_hash IS NOT NULL as has_storage
FROM cycles ORDER BY created_at DESC LIMIT 1;
"

# 2. Debate transcripts
psql $DATABASE_URL -c "
SELECT phase, from_agent, to_agent, substring(message_content, 1, 60) as msg
FROM debate_transcripts
WHERE cycle_id = (SELECT id FROM cycles ORDER BY created_at DESC LIMIT 1)
ORDER BY turn_number;
"

# 3. Payment graph (agent actions)
psql $DATABASE_URL -c "
SELECT payload->>'hiredBy' as hirer, agent_name, payment_tx_hash, attestation_hash
FROM agent_actions
WHERE action_type = 'SPECIALIST_HIRED' AND created_at > now() - interval '10 minutes'
ORDER BY created_at;
"

# 4. HCS mirror node
curl -s "https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.8497439/messages?limit=1&order=desc" \
  | python3 -c "import sys,json,base64; m=json.load(sys.stdin)['messages'][0]['message']; print(json.dumps(json.loads(base64.b64decode(m)), indent=2))"

# 5. Arc tx (if swap happened)
# open https://testnet.arcscan.app/tx/<swap_tx_hash>
```

### 7.5 Common debugging

| Symptom | Where to look | Fix |
|---------|--------------|-----|
| Cycle always decides HOLD | `cycles.risk_max_pct` — if 0, it's the Risk veto | Phase 2 prompt tuning |
| Swap fails with "gas required exceeds allowance" | User hot wallet has 0 USDC on Arc | Fund via `scripts/fund-arc-hot-wallets.ts` or Phase 5 |
| Debate transcripts missing rebuttal phase | Executor confidence ≥ 60% on first pass → skipped by design | Not a bug |
| `SPECIALIST_HIRED` rows all say hirer=main-agent | Hierarchical path not deployed | Phase 0 |
| Prisma fails with `debateTranscript does not exist` in IDE | Stale TS server cache (tsc is fine) | Restart IDE |
| `Can't reach database server` | Supabase project paused (free tier auto-pause) | Resume from supabase.com dashboard |
| x402 payment signature fails | Wrong library (ethers instead of viem) | Use `privateKeyToAccount` from `viem/accounts` |
| 0G inference returns nothing | Account underfunded | `broker.inference.depositFund(10)` |
| `INVALID_TOPIC_SUBMIT_KEY` on Hedera | Missing freeze/sign | `.freezeWith(client).sign(operatorKey)` |

### 7.6 Where things live

| Resource | Location |
|---------|----------|
| Production dashboard | `cannes2026.railway.app` (or wherever deployed) |
| Agent containers | `vm-*.fly.dev` (Fly dashboard → `alphadawg` org) |
| Supabase project | `aws-1-eu-west-2.pooler.supabase.com` |
| HCS audit topic | `https://hashscan.io/testnet/topic/0.0.8497439` |
| HTS fund token | `https://hashscan.io/testnet/token/0.0.8498202` |
| iNFT contract | `https://chainscan-newton.0g.ai/address/0x73e3016D0D3Bf2985c55860cd2A51FF017c2c874` |
| MockSwapRouter | `https://testnet.arcscan.app/address/0xaac18860AfDcBDd8Cd6D4De8f603a09607D64C96` |
| Plans directory | `~/.claude/plans/` |
| Memory directory | `~/.claude/projects/.../memory/` |
| Code | `/Users/barroca888/Downloads/Dev/Cannes2026/cannes2026` |

---

## 8. Decisions Log (with reasoning)

### 8.1 Why hierarchical hiring over flat

**Flat:** main-agent picks specialists via static rules, hires them, passes data to debate. One decision-maker.

**Hierarchical:** Each debate agent picks and pays for its own specialists. Three decision-makers.

**Decision:** Hierarchical.

**Reasoning:**
- Delivers the "agent hiring economy" narrative literally (not metaphorically)
- Each debate agent has real economic agency — provable via payment graph in HCS
- Aligns with Arc bounty requirement ("autonomous agents transacting")
- Doesn't materially increase latency (same number of 0G calls, re-distributed)
- Keeps Main-agent's role clear: orchestration + on-chain settlement, not intelligence gathering

### 8.2 Why 4-tier debate (Alpha + Mid + Risk + Executor), not 3

**3-tier (current):** Alpha ↔ Risk ↔ Executor. Two extremes + judge.

**4-tier (target):** Alpha → Mid → Risk → Executor. Bull + balanced + bear + judge.

**Decision:** 4-tier.

**Reasoning:**
- Current 3-tier shows the Risk agent winning 97% of arguments (67% full veto + 30% max_pct ≤ 2). The structure forces Executor into a binary choice between extremes, and it defers to Risk because "safety first."
- Adding Mid provides an anchor point. Executor's default becomes "Mid's proposal" rather than "either extreme." Alpha and Risk argue at the margins rather than being the only voices.
- Cost: 1 extra 0G call per cycle (8 → 10 inferences at 2-pass selection). Still within rate limits.
- Marginal value is huge because the current debate is lopsided by structure, not by prompt.

### 8.3 Why NOT native tool calling (workaround via 2-pass)

0G Compute's `qwen-2.5-7b-instruct` does not expose an OpenAI-compatible `tools` parameter. Tried and confirmed — `/chat/completions` accepts `messages` only.

**Options considered:**
- (A) Native tool calling: **not available**
- (B) 2-pass JSON loop: pick → analyze: **chosen**
- (C) Pre-compute static rules: **current fallback**

Pattern B is the idiomatic 0G workaround. When 0G upgrades its model (rumor: tool-calling support in Q2 2026), this can be swapped for native tools with zero architectural change — the `role-manifests.ts` fallback pattern remains the same shape.

### 8.4 Why server-side wallets NOW (session keys LATER)

See §4.5. Summary: Client-side signing kills autonomy and breaks the Arc bounty narrative. Pure server-side is fine for hackathon but dangerous long-term. ERC-4337 session keys are the correct non-custodial-but-autonomous pattern — scheduled for post-hackathon migration.

### 8.5 Why keep the old flat path as fallback (not delete immediately)

Plan step 7 explicitly says: keep legacy flat path as fallback for one successful end-to-end cycle. Rationale:
- Rollback insurance if hierarchical fails to deploy cleanly
- Degraded-mode operation if one or more debate containers go down
- Observable regression detection — if both paths produce identical DB signatures, something's wrong

Delete after Phase 6 verification passes.

### 8.6 Why not OpenClaw runtime this week

OpenClaw workspaces exist on disk (`openclaw/*-agent/SOUL.md`) but the containers aren't deployed. OpenClaw integration would require:
1. Running OpenClaw binary on each container
2. Wiring the gateway (`openclaw/gateway-client.ts`)
3. Translating current TS logic into OpenClaw AGENTS.md procedures
4. End-to-end validation

That's ≥ 2 days of focused work with an unknown runtime. The current Fly.io containers achieve 95% of the narrative using plain TS + 0G inference. The SOUL.md files are sufficient OpenClaw bounty deliverables even if the runtime isn't the execution layer.

**Decision:** Treat OpenClaw as documentation layer this week, runtime next week.

---

## 9. Open Questions

| # | Question | Impact | When to resolve |
|---|----------|--------|----------------|
| OQ1 | Does the hierarchical refactor naturally fix the Risk veto, or do we need Phase 2 prompt tuning? | Blocks swap proof | After Phase 0 deploy — observe 5-10 cycles |
| OQ2 | Should the Mid agent participate in rebuttal round when it triggers? | Low | After Phase 3 lands |
| OQ3 | Do we need a budget cap per augmented agent (max $ per cycle)? | Medium (prevents runaway) | Observe first 10 cycles — if any exceed expected cost, add cap |
| OQ4 | Should HCS `payments[]` include the hirer's own wallet address? | Low (extra bytes) | Decide if HCS record stays under 950 bytes |
| OQ5 | Is the current 90s timeout on `/hire-and-analyze` enough for 2-pass inference + 3 specialist hires? | Medium (could cause false negatives) | Monitor after deploy — bump to 120s if seeing timeouts |
| OQ6 | For session keys, do we use Coinbase Smart Wallet, Safe, or Kernel? | Post-hackathon | Week after hackathon |
| OQ7 | Does OpenClaw's gateway support HTTP proxy mode, or do we need native OpenClaw containers? | Post-hackathon | During OpenClaw deploy planning |

---

## 10. Reference Links

| Document | Purpose |
|----------|---------|
| `CONTEXT.MD` | Sprint 4 engineering bible — SDK patterns, exact versions, prompt text |
| `CLAUDE.md` | Claude Code session instructions, repo layout, error→fix map |
| `progress/SETUP-STATUS.md` | Earlier audit of live DB state + feature matrix |
| `progress/ON-CHAIN-FIX-STATUS.md` | iNFT + MockSwapRouter + specialist wallet rollout |
| `progress/PHASE4-INFT.MD` | iNFT deployment history |
| `progress/SPRINT4-CIRCLE-SUPABASE.MD` | Circle + Supabase migration history |
| `~/.claude/plans/zesty-sauteeing-spindle.md` | Hierarchical refactor plan (this session) |
| `.claude/rules/og-compute.md` | Verified 0G SDK patterns |
| `.claude/rules/x402-payments.md` | Verified x402 SDK patterns |
| `.claude/rules/hedera.md` | Verified Hedera SDK patterns |
| `.claude/rules/openclaw.md` | OpenClaw file structure conventions |
| `.claude/rules/dashboard.md` | Next.js 16.2 conventions |

---

## 11. Acceptance Criteria for "Done Enough for Demo"

Check every box before presenting to judges:

- [ ] Phase 0 deployed: hierarchical code live on vm-alpha, vm-risk, vm-executor
- [ ] At least one cycle with `decision != HOLD` (Alpha BUY/SELL reached Executor approval)
- [ ] At least one cycle with `swap_tx_hash` populated and verifiable on ArcScan
- [ ] HCS record contains non-empty `payments[]` array with ≥ 4 entries attributed to different hirers
- [ ] Phase 3 Mid agent live (4-tier debate in transcripts)
- [ ] Dashboard renders the cycle with: specialists by hirer, debate reasoning, Arc tx link, Hashscan link
- [ ] Telegram `/run` triggers an end-to-end cycle and sends a summary message with proof links
- [ ] Marketplace page shows 10 specialists with reputations
- [ ] Verify page shows TEE attestation hashes with "Verify on 0G" links
- [ ] Demo script (3 min) runs cleanly without manual DB edits

**Stretch (if time permits):**
- [ ] Dynamic 2-pass specialist selection (Phase 4)
- [ ] Goal input text box on dashboard
- [ ] Live debate streaming (SSE)

---

## 12. What This Document is NOT

- Not a duplicate of `CONTEXT.MD` — read that for SDK patterns and exact package versions
- Not a marketing doc — judges read the pitch, not the engineering doc
- Not a postmortem — this is a forward-looking plan, not a retrospective
- Not exhaustive — references `progress/*` for historical depth
- Not set in stone — update after each phase lands

**Update this file** after:
- Any Fly.io deploy (note new containers, new URLs)
- Any schema migration
- Any phase completion (check off boxes in §11)
- Any scope change from stakeholder

---

*Last updated: 2026-04-04 during the hierarchical hiring refactor session. Next update: after Phase 0 deploy.*
