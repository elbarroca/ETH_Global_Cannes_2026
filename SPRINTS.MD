# VaultMind — Sprint Operations Bible

> Single source of truth. Every checkbox = a working deliverable. Every section = a demo-ready state.
> If it's not checked, it's not done. If it's not tested, it doesn't exist.

---

## PRODUCT FLOW — WHAT THE USER ACTUALLY EXPERIENCES

Before any code, this is the product we're building. Every sprint maps back to a moment in this flow.

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER JOURNEY MAP                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ENTRY POINT (choose one):                                      │
│  ┌──────────────┐    ┌──────────────────┐                       │
│  │  Telegram     │    │  Dashboard       │                       │
│  │  /start       │    │  vaultmind.xyz   │                       │
│  └──────┬───────┘    └────────┬─────────┘                       │
│         │                     │                                  │
│         └──────────┬──────────┘                                  │
│                    ▼                                             │
│  ┌──────────────────────────────────────┐                       │
│  │  ONBOARDING                          │                       │
│  │  1. Connect wallet (Arc/Base)        │                       │
│  │  2. Sign auth message                │                       │
│  │  3. Choose agent personality:        │                       │
│  │     □ Conservative (5% max per trade)│                       │
│  │     □ Balanced (12% max per trade)   │                       │
│  │     □ Aggressive (25% max per trade) │                       │
│  │  4. Set risk tolerance (slider)      │                       │
│  │  5. Pick notification preference:    │                       │
│  │     □ Every cycle (5 min)            │                       │
│  │     □ Only on trades                 │                       │
│  │     □ Daily digest                   │                       │
│  │  6. Optional: link Telegram          │                       │
│  └──────────────────┬───────────────────┘                       │
│                     ▼                                            │
│  ┌──────────────────────────────────────┐                       │
│  │  DEPOSIT                             │                       │
│  │  "Deposit USDC to activate agent"    │                       │
│  │  → Approve USDC spend               │                       │
│  │  → Transfer to fund contract         │                       │
│  │  → HTS fund shares minted           │                       │
│  │  → Agent activates automatically     │                       │
│  └──────────────────┬───────────────────┘                       │
│                     ▼                                            │
│  ┌──────────────────────────────────────┐                       │
│  │  AGENT RUNNING (continuous)          │                       │
│  │                                      │                       │
│  │  Every 5 minutes:                    │                       │
│  │  ┌────────────────────────────────┐  │                       │
│  │  │ Hire 3 specialists ($0.003)    │  │                       │
│  │  │ ↓                              │  │                       │
│  │  │ Adversarial debate (3 rounds)  │  │                       │
│  │  │ ↓                              │  │                       │
│  │  │ Execute / Hold / Reduce        │  │                       │
│  │  │ ↓                              │  │                       │
│  │  │ Log proof to Hedera            │  │                       │
│  │  │ ↓                              │  │                       │
│  │  │ Notify user                    │  │                       │
│  │  └────────────────────────────────┘  │                       │
│  │                                      │                       │
│  │  User can:                           │                       │
│  │  • Watch live on dashboard           │                       │
│  │  • Get Telegram pings                │                       │
│  │  • /why → see full debate            │                       │
│  │  • /stop → pause agent               │                       │
│  │  • /history → past 10 cycles         │                       │
│  │  • Click proof link → Hashscan       │                       │
│  └──────────────────┬───────────────────┘                       │
│                     ▼                                            │
│  ┌──────────────────────────────────────┐                       │
│  │  WITHDRAW (anytime)                  │                       │
│  │  → Burn HTS fund shares              │                       │
│  │  → Return USDC minus 1% fee          │                       │
│  │  → Agent pauses                      │                       │
│  └──────────────────────────────────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Dashboard Screens (5 total)

| Screen | URL | What User Sees | Data Source |
|--------|-----|----------------|-------------|
| **Landing** | `/` | Hero + "Connect Wallet" CTA + fund stats (TVL, cycles run, agents active) | HTS token info + HCS message count |
| **Onboarding** | `/setup` | 3-step wizard: connect → configure → deposit | Wallet connect + HTS mint |
| **Live Dashboard** | `/dashboard` | 3-column debate view (specialists / debate / proofs) + live cycle status | WebSocket or polling `/api/cycle/latest` |
| **History** | `/history` | Timeline of past cycles, each expandable with full debate + proofs | Mirror Node REST: `/api/v1/topics/{id}/messages` |
| **Portfolio** | `/portfolio` | Fund share balance, NAV chart, deposit/withdraw buttons | HTS balance query + HCS NAV history |

### Telegram Commands (7 total)

| Command | Response | Backend Call |
|---------|----------|-------------|
| `/start` | Welcome + wallet link instructions | — |
| `/status` | Current NAV, positions, agent state | HTS query + last HCS message |
| `/why` | Full adversarial debate from last cycle (Alpha → Risk → Executor) | Last HCS message decoded |
| `/history` | Last 10 cycles: action, result, proof link | Mirror Node query, limit=10 |
| `/run` | Trigger manual cycle immediately | `runCycle()` |
| `/stop` | Pause agent | Set `agentActive = false` |
| `/resume` | Resume agent | Set `agentActive = true` |

---

## SPRINT 1 — SKELETON + FIRST PROOF OF LIFE

**Duration:** 2 hours
**Exit state:** Project boots. One HCS message on Hashscan. One 0G inference with attestation. One 402 response from a specialist.

### 1A — Project Scaffold (30 min)

```
DELIVERABLES:
□ package.json with type: module, engines >=22, all 14 deps installed
□ tsconfig.json with strict, ES2022, NodeNext, outDir: dist
□ .env created from template with ALL key names (values blank for now)
□ Full directory structure created (matching Claude.md §repo structure)
□ Entry point: src/index.ts that logs "VaultMind booting..." and exits clean

ACCEPTANCE TEST:
  npx tsx src/index.ts
  → prints "VaultMind booting..." → exits 0

WHY THIS MATTERS:
  Every subsequent sprint assumes this works. If imports fail here, you're
  debugging npm for an hour instead of building features.
```

### 1B — Hedera: First Message On-Chain (45 min)

```
DELIVERABLES:
□ src/config/hedera.ts — exports client + operatorKey
  - Client.forTestnet().setOperator(id, key)
  - PrivateKey.fromStringED25519(process.env.OPERATOR_KEY)
  - MUST export both as named exports

□ scripts/setup-topic.ts — run once, creates audit topic
  - TopicCreateTransaction with submitKey + topicMemo
  - Prints: "Topic created: 0.0.XXXXXX"
  - You manually paste this into .env as HCS_AUDIT_TOPIC_ID

□ src/hedera/hcs.ts — exports logCycle() and getHistory()

  logCycle(topicId: string, record: object): Promise<{seqNum, hashscanUrl}>
    1. const payload = JSON.stringify(record)
    2. if (payload.length > 1024) throw Error("Record too large")
    3. const tx = new TopicMessageSubmitTransaction()
         .setTopicId(TopicId.fromString(topicId))
         .setMessage(payload)
         .freezeWith(client)                    // ← step 1: FREEZE
    4. const signed = await tx.sign(submitKey)   // ← step 2: SIGN
    5. const resp = await signed.execute(client) // ← step 3: EXECUTE
    6. const receipt = await resp.getReceipt(client)
    7. return {
         seqNum: receipt.topicSequenceNumber.toNumber(),
         hashscanUrl: `https://hashscan.io/testnet/topic/${topicId}/message/${seqNum}`
       }

  getHistory(topicId: string, limit = 25): Promise<CycleRecord[]>
    1. fetch(`https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages?limit=${limit}&order=desc`)
    2. Decode each: Buffer.from(m.message, "base64").toString("utf-8")
    3. JSON.parse each (try/catch per message — skip malformed)

ACCEPTANCE TEST:
  npx tsx scripts/setup-topic.ts
  → topic ID printed
  → manually verify at hashscan.io/testnet/topic/{id}

  npx tsx -e "
    import { logCycle } from './src/hedera/hcs.js';
    const r = await logCycle(process.env.HCS_AUDIT_TOPIC_ID, { test: true, t: Date.now() });
    console.log('Logged:', r.seqNum, r.hashscanUrl);
    await new Promise(r => setTimeout(r, 6500));
    const h = await getHistory(process.env.HCS_AUDIT_TOPIC_ID, 1);
    console.log('Read back:', h[0]);
  "
  → seqNum printed → hashscan URL opens → mirror node returns same record after 6s

KNOWN TRAPS:
  - INVALID_TOPIC_SUBMIT_KEY = you forgot freezeWith or sign
  - Mirror node empty = you queried before 6 seconds
  - seqNum is a Long, call .toNumber()
```

### 1C — 0G: First Inference With Attestation (45 min)

```
DELIVERABLES:
□ src/config/og-compute.ts — exports broker instance
  - JsonRpcProvider("https://evmrpc-testnet.0g.ai")
  - Wallet from OG_PRIVATE_KEY
  - createZGComputeNetworkBroker(wallet)
  - Export: broker, wallet

□ scripts/setup-og-account.ts — run once:
  1. broker.ledger.depositFund("10")
  2. broker.inference.listService() → find chatbot provider
  3. Print provider addresses + models available
  4. You pick one → paste OG_PROVIDER_ADDRESS into .env

□ src/og/inference.ts — exports sealedInference()

  sealedInference(systemPrompt, userMessage): Promise<InferenceResult>

    // Cache: only acknowledge once per session
    if (!acknowledged.has(PROVIDER)) {
      await broker.inference.acknowledgeProviderSigner(PROVIDER)
      acknowledged.add(PROVIDER)
    }

    const { endpoint, model } = await broker.inference.getServiceMetadata(PROVIDER)

    // CRITICAL: 2 args — content is for billing calculation
    const headers = await broker.inference.getRequestHeaders(PROVIDER, userMessage)

    const res = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ]
      })
    })

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ""

    // Attestation: check both header cases
    const chatID = res.headers.get("ZG-Res-Key")
                || res.headers.get("zg-res-key")
                || data.id

    // TEE verification: 3 args
    let teeVerified = false
    try {
      if (chatID) {
        teeVerified = await broker.inference.processResponse(PROVIDER, content, chatID)
      }
    } catch { /* verification optional for demo, log warning */ }

    return { content, attestationHash: chatID ?? "none", teeVerified }

ACCEPTANCE TEST:
  npx tsx scripts/setup-og-account.ts
  → prints available providers + models

  npx tsx -e "
    import { sealedInference } from './src/og/inference.js';
    const r = await sealedInference('You are a market analyst.', 'Is ETH bullish? Reply JSON: {signal,confidence}');
    console.log('Content:', r.content);
    console.log('Attestation:', r.attestationHash);
    console.log('TEE Verified:', r.teeVerified);
  "
  → AI response printed → attestation hash exists → teeVerified = true

KNOWN TRAPS:
  - "insufficient funds" = depositFund below 3 0G minimum
  - No response = didn't acknowledge provider first
  - Stale headers = you reused them (they're single-use)
  - Rate limit = wait 2s between calls (30/min, 5 concurrent)
```

### 1D — x402: First 402 Response (30 min)

```
DELIVERABLES:
□ src/config/arc.ts — exports viem account
  - privateKeyToAccount(process.env.AGENT_EVM_PRIVATE_KEY as `0x${string}`)

□ src/payments/x402-server.ts — specialist paywall factory
  - createSpecialistServer(name, port, payTo, price, handler)
  - Uses @x402/express paymentMiddleware
  - Route format: "GET /analyze" (MUST include method)
  - Facilitator: https://facilitator.x402.org

□ src/payments/x402-client.ts — buyer fetch wrapper
  - createPaymentFetch() returns wrapped fetch
  - Uses @x402/fetch wrapFetchWithPayment
  - Uses viem/accounts for signing (NOT ethers)

ACCEPTANCE TEST:
  # Terminal 1: start a dummy specialist
  npx tsx -e "
    import { createSpecialistServer } from './src/payments/x402-server.js';
    createSpecialistServer('test', 4001, '0xYourAddress', '$0.001', async () => ({ test: true }));
  "

  # Terminal 2: curl it
  curl -v http://localhost:4001/analyze
  → HTTP 402 with X-Payment header containing JSON payment terms

  # Terminal 3: buyer auto-pays (requires funded wallet)
  npx tsx -e "
    import { createPaymentFetch } from './src/payments/x402-client.js';
    const f = createPaymentFetch();
    const res = await f('http://localhost:4001/analyze');
    console.log(res.status, await res.json());
  "
  → HTTP 200 with { test: true }

KNOWN TRAPS:
  - No 402 = route format wrong (needs "GET /analyze" with method prefix)
  - Payment sig fails = using ethers instead of viem for signing
  - Buyer wallet needs testnet USDC on Base Sepolia (faucet.cdp.coinbase.com)
```

### Sprint 1 Exit Gate

```
ALL MUST PASS:
✅ HCS message on Hashscan with valid consensus timestamp
✅ Mirror node returns the same message after 6s delay
✅ 0G inference returns AI content + attestation hash + teeVerified=true
✅ Specialist endpoint returns HTTP 402 without payment
✅ Buyer auto-pays and receives HTTP 200 with analysis data
✅ All three can run independently without crashing

IF ANY FAIL: Do NOT proceed to Sprint 2. Fix the broken integration first.
The full cycle (Sprint 2) chains all three — one broken link = entire cycle fails.
```

---

## SPRINT 2 — THE FULL CYCLE (ONE FUNCTION THAT DOES EVERYTHING)

**Duration:** 3-4 hours
**Exit state:** `runCycle()` hires specialists, debates adversarially, logs to Hedera, returns full result with proof link.

### 2A — Agent Prompts (45 min)

```
DELIVERABLES:
□ src/agents/prompts.ts — all 6 system prompts optimized for 7B model

  PROMPT OPTIMIZATION RULES FOR 7B MODELS:
  • Max 150 words per system prompt (7B context is small)
  • End EVERY prompt with: "Return ONLY valid JSON: { field1, field2 }"
  • Use simple field names: signal, confidence, reasoning (not nested objects)
  • No ambiguity: "BUY, SELL, or HOLD" not "provide your recommendation"
  • Add: "Do not include any text outside the JSON object"
  • Test each prompt 5 times — if JSON parse fails >1/5, rewrite it

  SPECIALISTS (hired via x402):
  ┌──────────────┬──────────────────────────────────────────────────────┐
  │ Sentiment    │ "You analyze crypto market sentiment from social     │
  │              │  data. Given current conditions, assess sentiment.   │
  │              │  Return ONLY JSON: { signal: BUY|SELL|HOLD,         │
  │              │  confidence: 0-100, reasoning: string }"            │
  ├──────────────┼──────────────────────────────────────────────────────┤
  │ Whale        │ "You track large wallet movements. Given current     │
  │              │  conditions, assess whale activity. Return ONLY      │
  │              │  JSON: { signal, confidence, topMovement: string }" │
  ├──────────────┼──────────────────────────────────────────────────────┤
  │ Momentum     │ "You analyze price momentum and technical            │
  │              │  indicators. Return ONLY JSON: { signal,            │
  │              │  confidence, trend: UP|DOWN|SIDEWAYS }"             │
  └──────────────┴──────────────────────────────────────────────────────┘

  ADVERSARIAL (run on 0G Sealed Inference):
  ┌──────────────┬──────────────────────────────────────────────────────┐
  │ Alpha        │ "You argue FOR trading opportunities. Given these    │
  │   (FOR)      │  specialist reports, build the strongest bull case.  │
  │              │  Return ONLY JSON: { action: BUY|SELL, asset,       │
  │              │  allocation_pct: number, thesis: string }"          │
  ├──────────────┼──────────────────────────────────────────────────────┤
  │ Risk         │ "You argue AGAINST. You see every specialist report  │
  │  (AGAINST)   │  and Alpha's argument. Find every flaw. Return      │
  │              │  ONLY JSON: { objection, max_safe_pct: number,      │
  │              │  risk_factors: string[] }"                          │
  ├──────────────┼──────────────────────────────────────────────────────┤
  │ Executor     │ "You are the final decision-maker. You see Alpha    │
  │  (DECIDES)   │  and Risk. Weigh both. Return ONLY JSON: { action:  │
  │              │  BUY|SELL|HOLD, asset, pct: number, stop_loss_pct,  │
  │              │  reasoning: string }"                               │
  └──────────────┴──────────────────────────────────────────────────────┘

ACCEPTANCE TEST:
  Run each prompt through sealedInference() 3 times.
  → JSON.parse succeeds ≥2/3 times for each prompt
  → All expected fields present in parsed output
  → No prompt returns empty string
```

### 2B — Specialist Servers (30 min)

```
DELIVERABLES:
□ src/agents/specialist-server.ts — boots 3 Express apps

  Each specialist:
  1. Receives GET /analyze (behind x402 paywall)
  2. Calls sealedInference() with its prompt
  3. Returns { name, analysis: <parsed JSON>, attestationHash, teeVerified }

  Ports: sentiment=4001, whale=4002, momentum=4003

  STARTUP:
  const servers = [
    { name: "sentiment", port: 4001, prompt: PROMPTS.sentiment },
    { name: "whale",     port: 4002, prompt: PROMPTS.whale },
    { name: "momentum",  port: 4003, prompt: PROMPTS.momentum },
  ]
  for (const s of servers) {
    createSpecialistServer(s.name, s.port, WALLET, "$0.001", async () => {
      const result = await sealedInference(s.prompt, MARKET_CONTEXT)
      return { name: s.name, ...safeJsonParse(result.content), attestationHash: result.attestationHash }
    })
  }

ACCEPTANCE TEST:
  Start servers → curl each → all return 402
  Start buyer → call all 3 → all return analysis with attestation hashes
```

### 2C — Adversarial Pipeline (45 min)

```
DELIVERABLES:
□ src/agents/adversarial.ts — exports runAdversarialDebate()

  async function runAdversarialDebate(specialistResults: SpecialistResult[])

  FLOW:
  1. Aggregate specialists: const context = JSON.stringify(specialistResults)
  2. Alpha (FOR):
     const alpha = await sealedInference(PROMPTS.alpha, context)
     await delay(2000)  // rate limit protection
  3. Risk (AGAINST — sees specialists + Alpha):
     const risk = await sealedInference(PROMPTS.risk,
       `Specialists: ${context}\nAlpha argues: ${alpha.content}`)
     await delay(2000)
  4. Executor (DECIDES — sees Alpha + Risk):
     const executor = await sealedInference(PROMPTS.executor,
       `Alpha: ${alpha.content}\nRisk: ${risk.content}`)

  RETURN:
  {
    alpha:    { content, parsed, attestationHash, teeVerified },
    risk:     { content, parsed, attestationHash, teeVerified },
    executor: { content, parsed, attestationHash, teeVerified }
  }

  JSON SAFETY WRAPPER:
  function safeJsonParse<T>(raw: string, fallback: T): T {
    try {
      // Strip markdown code fences (7B models love adding them)
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      return JSON.parse(cleaned)
    } catch {
      return fallback
    }
  }

  RETRY STRATEGY:
  If JSON parse fails on first attempt:
  1. Retry ONCE with " IMPORTANT: Return ONLY the JSON object, nothing else." appended
  2. If still fails, use fallback: { action: "HOLD", reasoning: "parse_error" }
  Do NOT retry more than once — burns 0G credits and time.

ACCEPTANCE TEST:
  const specs = [
    { name: "sentiment", signal: "BUY", confidence: 72 },
    { name: "whale", signal: "BUY", confidence: 65 },
    { name: "momentum", signal: "HOLD", confidence: 50 }
  ]
  const debate = await runAdversarialDebate(specs)
  → alpha.parsed has action + thesis
  → risk.parsed has objection + max_safe_pct
  → executor.parsed has action + pct + reasoning
  → all 3 have attestation hashes
```

### 2D — Full Cycle Orchestrator (45 min)

```
DELIVERABLES:
□ src/agents/main-agent.ts — exports runCycle()

  async function runCycle(cycleId: number): Promise<CycleResult>

  COMPLETE FLOW:
  ┌──────────────────────────────────────────────────────────┐
  │ 1. HIRE (parallel — all 3 specialists at once)           │
  │    const fetchWithPay = createPaymentFetch()              │
  │    const specs = await Promise.all([                      │
  │      hire(fetchWithPay, "http://localhost:4001/analyze"), │
  │      hire(fetchWithPay, "http://localhost:4002/analyze"), │
  │      hire(fetchWithPay, "http://localhost:4003/analyze"), │
  │    ])                                                     │
  ├──────────────────────────────────────────────────────────┤
  │ 2. DEBATE (sequential — each sees previous)              │
  │    const debate = await runAdversarialDebate(specs)       │
  ├──────────────────────────────────────────────────────────┤
  │ 3. LOG TO HEDERA                                         │
  │    const record = buildCompactRecord(cycleId, specs,     │
  │      debate, decision)                                    │
  │    const { seqNum, hashscanUrl } = await logCycle(       │
  │      TOPIC_ID, record)                                    │
  ├──────────────────────────────────────────────────────────┤
  │ 4. RETURN                                                │
  │    { cycleId, specialists: specs, debate, decision,      │
  │      seqNum, hashscanUrl, timestamp: new Date() }        │
  └──────────────────────────────────────────────────────────┘

  COMPACT RECORD FORMAT (must stay under 1024 bytes):
  {
    c: cycleId,                               // cycle number
    t: "2026-04-03T14:30:00Z",               // ISO timestamp
    s: [                                      // specialists (3)
      { n: "sent", sig: "BUY", conf: 72, att: "abc123" },
      { n: "whale", sig: "BUY", conf: 65, att: "def456" },
      { n: "mom", sig: "HOLD", conf: 50, att: "ghi789" }
    ],
    adv: {                                    // adversarial
      a: { act: "BUY", pct: 20, att: "jkl012" },      // alpha
      r: { obj: "rates high", max: 10, att: "mno345" }, // risk
      e: { act: "BUY", pct: 12, sl: 4, att: "pqr678" } // executor
    },
    d: { act: "BUY", asset: "ETH", pct: 12 },  // decision
    nav: 10240.50                               // net asset value
  }
  // ~380 bytes — safely under 1024

□ src/index.ts — boot script:
  1. Start 3 specialist servers
  2. Wait 1s for ports to bind
  3. Run single cycle
  4. Print full result + Hashscan URL
  5. Exit clean

ACCEPTANCE TEST:
  npx tsx src/index.ts
  → "Starting specialists on :4001, :4002, :4003"
  → "Hiring 3 specialists..."
  → "Running adversarial debate..."
  → "Logging to Hedera HCS..."
  → "Cycle #1 complete"
  → "Decision: BUY ETH 12%"
  → "Proof: https://hashscan.io/testnet/topic/0.0.XXXX/message/1"
  → open that URL → see the compact record

  FULL VALIDATION:
  ✅ 3 specialist payments processed (x402)
  ✅ 6 inference calls completed (0G)
  ✅ 6 attestation hashes present
  ✅ 1 HCS message on Hashscan
  ✅ Total cycle time < 90 seconds
```

### Sprint 2 Exit Gate

```
THE DEMO SENTENCE:
"I just ran one command and my AI agent autonomously hired 3 specialists
for $0.001 each, ran an adversarial debate with TEE proofs, and logged
everything to an immutable ledger. Here's the proof link."

IF YOU CAN'T SAY THAT WITH A HASHSCAN LINK → Sprint 2 is not done.

METRICS:
✅ Full cycle completes end-to-end in one command
✅ 3 x402 payments (HTTP 402 → auto-pay → 200)
✅ 6 0G inference calls with attestation hashes
✅ 1 HCS record on Hashscan < 1024 bytes
✅ Cycle time < 90 seconds
✅ No unhandled promise rejections
```

---

## SPRINT 3 — TELEGRAM + USER INTERFACE

**Duration:** 3-4 hours
**Exit state:** Telegram bot responds to all 7 commands. Dashboard shows live cycle data.

### 3A — Telegram Bot (1.5 hours)

```
DELIVERABLES:
□ src/telegram/bot.ts — full bot with all 7 commands

  INIT:
  import TelegramBot from "node-telegram-bot-api"
  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

  /start RESPONSE:
  "🧠 VaultMind Active
   Your AI agent is ready. Deposit USDC to begin.

   Commands:
   /status  — Current NAV + positions
   /why     — Last cycle's adversarial debate
   /history — Last 10 cycles
   /run     — Trigger cycle now
   /stop    — Pause agent
   /resume  — Resume agent"

  /status RESPONSE:
  "📊 VaultMind Status
   NAV: $10,240.50
   Positions: ETH 12%, SOL 5%
   Agent: ● Running
   Last cycle: 3 min ago
   Cycles today: 47"

  /why RESPONSE (pull last HCS message, decode, format):
  "🧠 Cycle #47 — Full Debate

   📡 Specialists:
   Sentiment: BUY (72%) — Social momentum rising
   Whale: BUY (65%) — 3 large accumulations
   Momentum: HOLD (50%) — RSI neutral

   🟢 Alpha: BUY 20% ETH
   'All three specialists lean bullish. Social + whale convergence.'

   🔴 Risk: MAX 10%
   'Funding rates elevated at 0.03%. Cut size.'

   ⚖️ Executor: BUY 12% ETH, SL -4%
   'Compromise on size. Tight stop.'

   🔗 Proof: https://hashscan.io/testnet/topic/..."

  /history RESPONSE:
  Calls getHistory(topicId, 10) → formats each as one-line summary:
  "#47 BUY ETH 12% ✅ | #46 HOLD ✅ | #45 SELL SOL 5% ✅ | ..."

  /run RESPONSE:
  Triggers runCycle() → sends /why-style summary when done

  /stop and /resume: Toggle agentActive flag

  CYCLE NOTIFICATION (sent automatically after each cycle):
  "📊 Cycle #48 Complete
   💰 Hired 3 specialists ($0.003)
   ⚖️ Decision: BUY ETH 12% (SL -4%)
   ✅ 6/6 TEE verified
   🔗 https://hashscan.io/testnet/topic/..."

ACCEPTANCE TEST:
  Start bot → send /start → get welcome
  Send /run → cycle executes → summary arrives
  Send /why → debate text appears with proof link
  Send /history → 10 cycle summaries
  Click proof link → Hashscan opens
```

### 3B — Dashboard: API Routes (45 min)

```
DELIVERABLES:
□ src/dashboard/ — Next.js 16.2 project with App Router

  API ROUTES (src/dashboard/app/api/):

  GET /api/cycle/latest
    → Fetch last HCS message from mirror node
    → Decode + parse → return JSON

  GET /api/cycle/history?limit=25
    → Fetch last N HCS messages
    → Decode + parse each → return array

  POST /api/cycle/run
    → Trigger runCycle() → return result

  GET /api/fund/info
    → Query HTS token info (supply, holders)
    → Return { totalSupply, holders, navPerShare }

  ALL ROUTES:
  • Return typed JSON
  • Include CORS headers for dev
  • Error responses: { error: string, code: number }

ACCEPTANCE TEST:
  npm run dev (inside dashboard dir)
  curl localhost:3000/api/cycle/latest → JSON cycle data
  curl localhost:3000/api/cycle/history?limit=5 → array of 5 cycles
```

### 3C — Dashboard: UI Pages (2 hours)

```
DELIVERABLES:
□ Landing page (/)
  - Hero section: "Your AI. Provable decisions. Glass box."
  - Stats bar: TVL · Cycles Run · Active Agents · Avg Cycle Time
  - "Launch Dashboard" CTA button
  - "Connect Wallet" secondary button

□ Live Dashboard (/dashboard) — THE MONEY SHOT FOR JUDGES
  ┌─────────────────────────────────────────────────────────────┐
  │ CYCLE #48                                          ● LIVE   │
  ├──────────────────┬────────────────────┬─────────────────────┤
  │  SPECIALISTS     │  ADVERSARIAL       │  PROOF CHAIN        │
  │                  │  DEBATE            │                     │
  │  ┌────────────┐  │                    │  Payment #1         │
  │  │ Sentiment  │  │  🟢 Alpha          │  0xabc...123 ✓      │
  │  │ BUY 72%    │  │  "All bullish.     │                     │
  │  │ ✅ TEE     │  │   BUY 20% ETH"    │  Payment #2         │
  │  └────────────┘  │                    │  0xdef...456 ✓      │
  │                  │  ──────────────    │                     │
  │  ┌────────────┐  │                    │  Payment #3         │
  │  │ Whale      │  │  🔴 Risk           │  0xghi...789 ✓      │
  │  │ BUY 65%    │  │  "Funding rates    │                     │
  │  │ ✅ TEE     │  │   elevated. MAX    │  ─────────────      │
  │  └────────────┘  │   10%."            │                     │
  │                  │                    │  Attestation #1     │
  │  ┌────────────┐  │  ──────────────    │  att_jkl012 ✅      │
  │  │ Momentum   │  │                    │                     │
  │  │ HOLD 50%   │  │  ⚖️ Executor       │  Attestation #2     │
  │  │ ✅ TEE     │  │  "BUY 12% ETH.    │  att_mno345 ✅      │
  │  └────────────┘  │   SL -4%."        │                     │
  │                  │                    │  Attestation #3     │
  │                  │                    │  att_pqr678 ✅      │
  │                  │                    │                     │
  │                  │                    │  📋 Hashscan ↗     │
  ├──────────────────┴────────────────────┴─────────────────────┤
  │  ← Prev Cycle    Cycle #48 of 203    Next Cycle →          │
  └─────────────────────────────────────────────────────────────┘

  IMPLEMENTATION:
  - Fetch /api/cycle/latest on mount + poll every 10s
  - Three columns using CSS grid (1fr 1.5fr 1fr)
  - TEE badges: green checkmark if teeVerified, yellow warning if not
  - Proof links open Hashscan in new tab
  - Cycle navigation arrows fetch /api/cycle/history with offset

□ History page (/history)
  - Timeline view: vertical list of cycle cards
  - Each card: cycle #, decision, timestamp, proof link
  - Click to expand: full debate view (reuse dashboard columns)
  - Pagination: "Load more" fetches next 25 from mirror node

□ Portfolio page (/portfolio)
  - Fund share balance (HTS query)
  - NAV chart (plot NAV from HCS history)
  - Deposit button → connect wallet → approve USDC → mint shares
  - Withdraw button → burn shares → return USDC

ACCEPTANCE TEST:
  Open localhost:3000 → landing renders with stats
  Click Dashboard → 3-column view shows last cycle data
  Click Hashscan link → opens correct testnet URL
  History → scrollable list of past cycles
  Portfolio → shows fund share balance
```

### Sprint 3 Exit Gate

```
DEMO FLOW (what you show judges):
1. Open Telegram → /run → cycle triggers
2. Open Dashboard → watch specialists appear → debate streams → proof chain fills
3. Click Hashscan link → immutable record
4. Back to Telegram → summary arrived with same proof link
5. /why → full debate text in chat
6. /history → last 10 cycles

ALL MUST PASS:
✅ Telegram bot responds to all 7 commands
✅ /run triggers real cycle with real payments + inference
✅ Dashboard 3-column view renders with real data
✅ Proof links resolve to valid Hashscan pages
✅ History loads from mirror node with pagination
✅ Portfolio shows HTS balance (even if 0)
```

---

## SPRINT 4 — HTS TOKEN + COMPLIANCE LAYER

**Duration:** 2 hours
**Exit state:** Fund token created with custom fees, KYC, freeze. Lifecycle ops working.

```
DELIVERABLES:
□ scripts/setup-token.ts — run once:
  TokenCreateTransaction:
  - name: "VaultMind Fund Share"
  - symbol: "VMFS"
  - decimals: 2
  - initialSupply: 0 (mint-on-deposit)
  - supplyKey: operatorKey (mint/burn)
  - adminKey: operatorKey
  - freezeKey: operatorKey
  - kycKey: operatorKey
  - customFees: [
      new CustomFractionalFee()
        .setNumerator(1).setDenominator(100)  // 1%
        .setFeeCollectorAccountId(treasuryId)
        .setAllCollectorsAreExempt(true)
    ]
  → Save TOKEN_ID to .env

□ src/hedera/hts.ts — exports:
  mintShares(amount: number)    // on USDC deposit
  burnShares(amount: number)    // on withdraw
  grantKyc(accountId: string)   // compliance
  freezeAccount(accountId: string)  // compliance
  unfreezeAccount(accountId: string)
  getTokenInfo()                // dashboard display

  ALL use @hashgraph/sdk — ZERO Solidity.
  ALL use freeze→sign→execute pattern.

□ Wire into dashboard:
  - Portfolio page shows token balance
  - Deposit triggers mintShares
  - Withdraw triggers burnShares

ACCEPTANCE TEST:
  npx tsx scripts/setup-token.ts
  → Token created: 0.0.XXXXX
  → Verify on Hashscan: custom fee visible, KYC key set

  npx tsx -e "
    import { mintShares, getTokenInfo } from './src/hedera/hts.js';
    await mintShares(1000);
    const info = await getTokenInfo();
    console.log('Supply:', info.totalSupply);
  "
  → Supply: 1000

BOUNTIES SERVED:
  ✅ Tokenization ($2.5K): HTS + custom fees + KYC + freeze + lifecycle
  ✅ No Solidity ($3K): 4th native service (HTS + HCS + Mirror + Scheduled)
```

---

## SPRINT 5 — 0G STORAGE + SCHEDULED TRANSACTIONS

**Duration:** 2 hours
**Exit state:** Agent memory persists across cycles. Cycles auto-trigger.

```
DELIVERABLES:
□ src/og/storage.ts — exports storeMemory() and loadMemory()
  - Uses @0glabs/0g-ts-sdk Indexer
  - storeMemory(data) → returns rootHash (Merkle proof)
  - loadMemory(rootHash) → returns stored data
  - Wire: after each cycle, store result to 0G Storage

□ src/hedera/scheduler.ts — Hedera Scheduled Transactions
  - scheduleNextCycle(delaySeconds: 300) creates a ScheduleCreateTransaction
  - Wraps a TopicMessageSubmitTransaction as the inner transaction
  - Auto-triggers next cycle every 5 minutes

  PATTERN:
  const inner = new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify({ trigger: "heartbeat", cycle: nextCycleId }))

  const scheduled = new ScheduleCreateTransaction()
    .setScheduledTransaction(inner)
    .setWaitForExpiry(true)
    .setExpirationTime(Timestamp.fromDate(new Date(Date.now() + 300_000)))

ACCEPTANCE TEST:
  Run cycle → memory stored → rootHash returned
  Load memory with rootHash → same data returned
  Schedule next → verify scheduled tx on Hashscan → fires after delay

BOUNTIES SERVED:
  ✅ 0G DeFi ($6K): Storage for agent memory (scoring boost)
  ✅ Hedera AI ($6K): Scheduled Transactions (optional enhancement)
  ✅ No Solidity ($3K): 4th native service confirmed
```

---

## SPRINT 6 — STRETCH: OPENCLAW + iNFT

**Duration:** 2-3 hours (only if Sprints 1-5 complete)
**Exit state:** OpenClaw agents with personalities. Agent identity as iNFT.

```
DELIVERABLES:
□ openclaw/ — 7 SOUL.md files (one per agent)
  Each defines: personality, boundaries, tool access
  Main agent SOUL.md also gets HEARTBEAT.md (5-min interval)

□ 0G Chain iNFT (ERC-7857):
  - Deploy agent identity NFT on 0G Chain
  - Links agent wallet → SOUL.md → performance history
  - Makes agents tradeable/composable

□ HEARTBEAT.md for auto-cycling:
  triggers:
    - every: "5m"
      action: "Run investment cycle"
      tools: ["hire-specialists", "run-debate", "log-hedera", "notify-telegram"]

BOUNTIES SERVED:
  ✅ 0G OpenClaw ($6K): All 4 0G services + iNFT + SOUL.md
```

---

## OPTIMIZATION STRATEGIES

### Performance

| Optimization | Where | Impact |
|-------------|-------|--------|
| Parallel specialist hiring | Sprint 2D | 3 sequential calls → 1 parallel batch. Saves ~10s per cycle. |
| Cache acknowledgeProviderSigner | Sprint 1C | Call once per session, not once per inference. Saves 1 RPC call per inference. |
| Pre-warm specialist servers | Sprint 2B | Keep Express apps hot. Cold start adds ~2s per specialist. |
| Batch HCS logging | Sprint 2D | One message per cycle, not one per step. Saves 5 HCS messages ($0.004). |
| Mirror node pagination | Sprint 3C | Use `?sequencenumber=gte:N` instead of fetching all + filtering client-side. |
| Connection pooling | Sprint 1C | Reuse ethers provider + 0G broker across calls. Don't re-init per inference. |

### Demo Impact

| Trick | When | Why |
|-------|------|-----|
| Pre-run 50 cycles before demo | Night before | History page looks real, not empty |
| WebSocket for live dashboard | Sprint 3C | Cycle data appears instantly, no polling lag |
| Animate debate reveal | Sprint 3C | Specialists → Alpha → Risk → Executor appear sequentially with fade-in |
| Sound on Telegram notify | Sprint 3A | Judge's phone dings during demo = memorable |
| Hashscan tab pre-loaded | Demo | Click proof → instant verification, no load time |

### Cost Management (Testnet)

| Resource | Rate Limit | Strategy |
|----------|-----------|----------|
| 0G Inference | 30 req/min, 5 concurrent | 2s delay between adversarial calls |
| 0G Deposit | Min 3 0G, min 1 per provider | Deposit 10 0G upfront, don't micro-manage |
| Hedera HCS | ~$0.0008/msg | Irrelevant on testnet, batch in one msg anyway |
| x402 Payments | Facilitator rate limits unknown | Parallel specialist hiring, sequential fallback |
| Mirror Node | Free, no auth | Cache responses for 10s on dashboard |

---

## FULL BUILD SEQUENCE (OPTIMIZED)

```
HOUR  0-0.5   Sprint 1A (scaffold)
HOUR  0.5-2   Sprint 1B + 1C + 1D (parallel across devs)
              ├── Dev A: Hedera HCS (1B)
              ├── Dev B: 0G Inference (1C)
              └── Dev C: x402 Paywall (1D)
HOUR  2       EXIT GATE 1 — all three integrations working independently

HOUR  2-3     Sprint 2A + 2B (prompts + specialist servers)
HOUR  3-5     Sprint 2C + 2D (adversarial pipeline + full cycle)
HOUR  5       EXIT GATE 2 — runCycle() works end-to-end with proof link

HOUR  5-7     Sprint 3A (Telegram bot)
HOUR  5-9     Sprint 3B + 3C (Dashboard — can run parallel with Telegram)
              ├── Dev A: API routes (3B)
              └── Dev B: UI pages (3C)
HOUR  9       EXIT GATE 3 — Telegram + Dashboard showing real cycle data

HOUR  9-11    Sprint 4 (HTS token + compliance)
HOUR  9-11    Sprint 5 (0G Storage + Scheduled Tx) — parallel with Sprint 4
HOUR  11      EXIT GATE 4 — all bounty requirements met for $17K

HOUR  11-14   Sprint 6 (OpenClaw + iNFT — stretch)
HOUR  14-16   Polish: pre-run 50 cycles, fix edge cases, practice demo

HOUR  16      SUBMIT
```

**Solo dev:** multiply hours by 1.5-2x. Skip Sprint 6, defer Sprint 5.
**2 devs:** ~12-14 hours realistic.
**4 devs:** ~9-11 hours with coordination overhead.

---

## FINAL SUBMISSION CHECKLIST

```
ASSETS:
□ GitHub repo (public) with README covering setup + architecture
□ Architecture diagram (use the uploaded one)
□ Demo video ≤3 min for 0G bounties, ≤5 min for Hedera bounties
□ Live demo link (deployed on Vercel or similar)
□ Team names + Telegram handles + X handles

PER BOUNTY:
□ Arc ($6K):       Demo shows autonomous agent-to-agent USDC payments
□ Hedera AI ($6K): ≥1 payment/token op on Hedera Testnet + video
□ 0G DeFi ($6K):   Show all 3 services: Compute + Storage + Chain
□ 0G OpenClaw ($6K): SOUL.md + iNFT + all 4 0G services
□ No Solidity ($3K): Confirm zero .sol files. ≥2 native services (we do 4)
□ Tokenization ($2.5K): Token on Hashscan with custom fee + KYC + lifecycle op
□ Naryo ($3.5K):   Event listener + Hedera EVM contracts (separate from No Solidity)

SMOKE TEST (run 1 hour before submission):
□ npm install from clean clone works
□ Full cycle completes without manual intervention
□ Telegram bot responds to /run and /why
□ Dashboard loads and shows real cycle data
□ All Hashscan links resolve
□ Demo video uploaded and watchable
```