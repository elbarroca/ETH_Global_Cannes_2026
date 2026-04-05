// Single-agent server for Fly.io deployment
// Each Fly.io app runs ONE agent with x402 paywall + 0G sealed inference
// AGENT_NAME env var determines which agent this instance serves

import "dotenv/config";
import express from "express";
import { createGatewayMiddleware, type PaymentRequest } from "@circle-fin/x402-batching/server";
import { sealedInference } from "../og/inference";
import { OG_PROVIDER } from "../config/og-compute";
import { PROMPTS, parseDualOutput } from "./prompts";
import { fetchSentimentData } from "./data/sentiment-data";
import { fetchWhaleData } from "./data/whale-data";
import { fetchMomentumData } from "./data/momentum-data";
import { fetchMemecoinData } from "./data/memecoin-data";
import { fetchTwitterData } from "./data/twitter-data";
import { fetchDefiYieldData } from "./data/defi-yield-data";
import { fetchNewsData } from "./data/news-data";
import { fetchOnchainForensicsData } from "./data/onchain-forensics-data";
import { fetchOptionsData } from "./data/options-data";
import { fetchMacroData } from "./data/macro-data";
import { callSpecialist } from "./hire-specialist";
import { selectForRole, type RiskProfile, type MarketVolatility, type DebateRole } from "./role-manifests";
import { buildSpecialistContext } from "./adversarial";
import { injectLiquidityInto, formatLiquidityTable } from "./data/liquidity-injector";
import { deriveSpecialistAccount } from "../config/wallets";
import type {
  CallSpecialistResult,
  SpecialistResult,
  CycleLiquidity,
} from "../types/index";

const AGENT_NAME = process.env.AGENT_NAME;
if (!AGENT_NAME) {
  console.error("AGENT_NAME env var required. Set to: sentiment, whale, momentum, alpha, risk, executor, etc.");
  process.exit(1);
}

const PORT = parseInt(process.env.PORT ?? "8080", 10);

// Map agent names to their prompts
const PROMPT_MAP: Record<string, string> = {
  "sentiment": PROMPTS.sentiment.content,
  "whale": PROMPTS.whale.content,
  "momentum": PROMPTS.momentum.content,
  "memecoin-hunter": PROMPTS.memecoin.content,
  "twitter-alpha": PROMPTS.twitter.content,
  "defi-yield": PROMPTS.defiYield.content,
  "news-scanner": PROMPTS.news.content,
  "onchain-forensics": PROMPTS.forensics.content,
  "options-flow": PROMPTS.options.content,
  "macro-correlator": PROMPTS.macro.content,
  "alpha": PROMPTS.alpha.content,
  "risk": PROMPTS.risk.content,
  "executor": PROMPTS.executor.content,
};

// Map specialist agents to their data fetchers
const DATA_FETCHERS: Record<string, () => Promise<string>> = {
  "sentiment": fetchSentimentData,
  "whale": fetchWhaleData,
  "momentum": fetchMomentumData,
  "memecoin-hunter": fetchMemecoinData,
  "twitter-alpha": fetchTwitterData,
  "defi-yield": fetchDefiYieldData,
  "news-scanner": fetchNewsData,
  "onchain-forensics": fetchOnchainForensicsData,
  "options-flow": fetchOptionsData,
  "macro-correlator": fetchMacroData,
};

const LOCAL_FALLBACKS: Record<string, (data: string) => { signal: string; confidence: number }> = {
  "sentiment": (d) => { const v = Number(JSON.parse(d).fear_greed_value ?? 50); return v >= 65 ? { signal: "BUY", confidence: Math.min(v, 80) } : v <= 35 ? { signal: "SELL", confidence: Math.min(100 - v, 80) } : { signal: "HOLD", confidence: 50 }; },
  "whale": () => ({ signal: "HOLD", confidence: 50 }),
  "momentum": (d) => { const r = Number(JSON.parse(d).rsi_14 ?? 50); return r < 35 ? { signal: "BUY", confidence: 65 } : r > 65 ? { signal: "SELL", confidence: 65 } : { signal: "HOLD", confidence: 50 }; },
};

const app = express();
app.use(express.json());

// Health check
app.get("/healthz", (_req, res) => {
  res.json({ agent: AGENT_NAME, status: "ok", provider: OG_PROVIDER });
});

// ── x402 nanopayment middleware (leaf specialists only) ──────────────────────
//
// Before this was wired, `app.all("/analyze", ...)` had no payment enforcement
// at all — the buyer's `payFetch` negotiated against a server that returned
// 200 immediately, so no on-chain payment ever happened and the tx hash was a
// hardcoded string. Fix: attach `createGatewayMiddleware` on the POST /analyze
// route so every call goes through Circle Gateway batched settlement on Arc
// testnet. The middleware populates `req.payment.transaction` after settling,
// which we echo back to the buyer in the response body.
//
// Debate agents (alpha/risk/executor) don't get the paywall — they only expose
// the internal /hire-and-analyze endpoint which is called by main-agent, not by
// paying users.
const SPECIALIST_PAY_INDEX: Record<string, number> = {
  sentiment: 1,
  whale: 2,
  momentum: 3,
  "memecoin-hunter": 4,
  "twitter-alpha": 5,
  "defi-yield": 6,
  "news-scanner": 7,
  "onchain-forensics": 8,
  "options-flow": 9,
  "macro-correlator": 10,
};

const isLeafSpecialist = DATA_FETCHERS[AGENT_NAME] != null;

// Resolve the seller address for this specialist.
//
// Order of precedence (allows Fly containers to run with OR without the full
// AGENT_MNEMONIC — new deploys set MNEMONIC as a Fly secret, existing deploys
// that only carry 0G keys can optionally set SPECIALIST_SELLER_ADDRESS):
//   1. SPECIALIST_SELLER_ADDRESS env var (explicit override per container)
//   2. deriveSpecialistAccount(SPECIALIST_PAY_INDEX[AGENT_NAME]) (needs AGENT_MNEMONIC)
//   3. null → paywall disabled, container runs without nanopayments
//
// We wrap this in try/catch so a missing mnemonic never kills the container.
// The specialist will still serve /analyze (unpaywalled) and the rest of the
// system degrades gracefully — main-agent's SSE layer already tolerates
// paymentTxHash being "no-payment" for legacy rows.
function resolveSellerAddress(): string | null {
  if (!isLeafSpecialist) return null;
  const override = process.env.SPECIALIST_SELLER_ADDRESS;
  if (override && override.startsWith("0x")) return override;
  const idx = SPECIALIST_PAY_INDEX[AGENT_NAME as keyof typeof SPECIALIST_PAY_INDEX];
  if (idx == null) {
    console.warn(`[fly] ${AGENT_NAME}: no SPECIALIST_PAY_INDEX entry — paywall DISABLED`);
    return null;
  }
  try {
    return deriveSpecialistAccount(idx).address;
  } catch (err) {
    console.warn(
      `[fly] ${AGENT_NAME}: cannot derive seller address (${err instanceof Error ? err.message : String(err)}) — paywall DISABLED`,
    );
    return null;
  }
}

const SELLER_ADDRESS = resolveSellerAddress();

// Build the middleware once at module init. `networks: ["eip155:5042002"]`
// pins the accepted chain to Arc testnet (CAIP-2). When the seller address
// couldn't be resolved, we fall through to paywall-less mode rather than
// crashing the container.
let gateway: ReturnType<typeof createGatewayMiddleware> | null = null;
if (isLeafSpecialist && SELLER_ADDRESS) {
  try {
    gateway = createGatewayMiddleware({
      sellerAddress: SELLER_ADDRESS,
      networks: ["eip155:5042002"],
      description: `${AGENT_NAME} specialist analysis`,
    });
    console.log(`[fly] ${AGENT_NAME}: x402 paywall active, seller=${SELLER_ADDRESS} price=$0.001`);
  } catch (err) {
    console.warn(
      `[fly] ${AGENT_NAME}: createGatewayMiddleware threw — running WITHOUT paywall. Error:`,
      err instanceof Error ? err.message : String(err),
    );
    gateway = null;
  }
} else if (isLeafSpecialist) {
  console.warn(
    `[fly] ${AGENT_NAME}: no seller address (set AGENT_MNEMONIC or SPECIALIST_SELLER_ADDRESS) — x402 paywall DISABLED, serving unpaid /analyze`,
  );
}

// Shared handler — runs for both paywalled (specialist) and paywall-less
// (debate agent) paths. The middleware above determines which one is active.
const analyzeHandler = async (req: express.Request, res: express.Response) => {
  const prompt = PROMPT_MAP[AGENT_NAME];
  if (!prompt) {
    res.status(404).json({ error: `No prompt for agent: ${AGENT_NAME}` });
    return;
  }

  try {
    let userMessage: string;
    let rawSnapshot: unknown = null;
    const body = req.body as {
      userMessage?: string;
      systemPrompt?: string;
      task?: string;
      cycleLiquidity?: CycleLiquidity;
    };

    if (DATA_FETCHERS[AGENT_NAME]) {
      // Specialist: fetch real data, inject liquidity (if caller provided it),
      // then run 0G inference. The LIQUIDITY block grounds the 7B model's
      // confidence in the user's real buying power — no more recommending
      // sizes the user can't execute.
      const rawData = await DATA_FETCHERS[AGENT_NAME]();
      let parsedData: Record<string, unknown> = {};
      try {
        parsedData = JSON.parse(rawData) as Record<string, unknown>;
      } catch {
        parsedData = { raw: rawData };
      }
      if (body.cycleLiquidity) {
        injectLiquidityInto(parsedData, body.cycleLiquidity);
      }
      rawSnapshot = parsedData;
      userMessage = `Current market data:\n${JSON.stringify(parsedData, null, 2)}`;
    } else {
      // Debate agent: use the provided context from request body
      userMessage = body.userMessage ?? body.task ?? JSON.stringify(req.body);
    }

    // 0G sealed inference (TEE-verified)
    const result = await sealedInference(OG_PROVIDER, prompt, userMessage);
    const { reasoning, parsed } = parseDualOutput(result.content, { signal: "HOLD", confidence: 50 });

    // Capture the x402 settlement id when the middleware ran.
    // `req.payment.transaction` comes from `BatchFacilitatorClient.settle()`;
    // the SDK’s SettleResponse only exposes `transaction`, `network`, `payer`
    // (no separate “batch tx” vs “receipt id” fields). Gateway may return an
    // Arc `0x` or a settlement identifier depending on timing — see Circle
    // nanopayments + batched settlement docs. We echo the single string as-is.
    const payment = (req as unknown as PaymentRequest).payment;
    const paymentTxHash = payment?.transaction ?? "no-payment";

    res.json({
      name: AGENT_NAME,
      content: result.content,
      ...parsed,
      reasoning,
      rawDataSnapshot: rawSnapshot,
      attestationHash: result.attestationHash,
      teeVerified: result.teeVerified,
      paymentTxHash,
      paymentNetwork: payment?.network ?? null,
      paymentPayer: payment?.payer ?? null,
    });
  } catch (err) {
    console.error(`[${AGENT_NAME}] Inference failed:`, err);

    // Local fallback for specialists
    const fallbackFn = LOCAL_FALLBACKS[AGENT_NAME];
    if (fallbackFn && DATA_FETCHERS[AGENT_NAME]) {
      try {
        const rawData = await DATA_FETCHERS[AGENT_NAME]();
        const fallback = fallbackFn(rawData);
        res.json({
          name: AGENT_NAME,
          ...fallback,
          reasoning: `[FALLBACK] 0G inference failed: ${err instanceof Error ? err.message : String(err)}`,
          attestationHash: "local-fallback",
          teeVerified: false,
        });
        return;
      } catch { /* fall through */ }
    }

    res.status(500).json({
      name: AGENT_NAME,
      signal: "HOLD",
      confidence: 50,
      reasoning: `[ERROR] ${err instanceof Error ? err.message : String(err)}`,
      attestationHash: "error",
      teeVerified: false,
    });
  }
};

// Wire the /analyze route: paywalled POST for leaf specialists, paywall-less
// POST for debate agents. Debate agents also accept GET for health-check-style
// introspection from the orchestrator — the pre-sprint code used app.all, we
// keep only POST here to make the contract explicit.
if (isLeafSpecialist && gateway) {
  app.post("/analyze", gateway.require("$0.001"), analyzeHandler);
} else {
  app.post("/analyze", analyzeHandler);
}

// ── Hierarchical hiring endpoint — debate agents only ────────────────────────
// When this container runs as a debate agent (alpha/risk/executor), it exposes
// /hire-and-analyze. The orchestrator (main-agent.ts) posts a user goal + wallet
// index, and this container autonomously:
//   1. Selects specialists from its role manifest
//   2. Hires them in parallel via x402 (using the user's hot wallet for signing)
//   3. Builds a specialist context string
//   4. Runs its own 0G sealed inference over the context + debate chain
//   5. Returns the enriched response with specialists_hired metadata
//
// This enables the "agent hiring economy" narrative: each debate agent has real
// economic agency and pays real nanopayments for the intelligence it uses.

const DEBATE_ROLES = new Set<string>(["alpha", "risk", "executor"]);

if (DEBATE_ROLES.has(AGENT_NAME)) {
  app.post("/hire-and-analyze", async (req, res) => {
    const body = req.body as {
      userGoal?: string;
      userWalletIndex?: number | null;
      riskProfile?: RiskProfile;
      marketVolatility?: MarketVolatility;
      alphaThesis?: string;
      alphaParsed?: Record<string, unknown>;
      riskChallenge?: string;
      riskParsed?: Record<string, unknown>;
      maxTradePercent?: number;
      cycleLiquidity?: CycleLiquidity;
      reputationScores?: Record<string, number>;
      cycleSeed?: number;
      /** RAG context from 0G Storage — last 3 committed cycles for this user,
       *  formatted by formatPriorCyclesForPrompt. Appended to the debate agent's
       *  userMessage so the 7B model can cite its own history. */
      priorContext?: string;
    };

    const prompt = PROMPT_MAP[AGENT_NAME];
    if (!prompt) {
      res.status(404).json({ error: `No prompt for agent: ${AGENT_NAME}` });
      return;
    }

    const role = AGENT_NAME as DebateRole;
    const userGoal = body.userGoal ?? "Grow portfolio, balanced risk";
    const riskProfile = body.riskProfile ?? "balanced";
    const marketVolatility = body.marketVolatility ?? "medium";
    const maxTradePercent = body.maxTradePercent ?? 10;
    const cycleLiquidity = body.cycleLiquidity;

    try {
      // 1. Select specialists for this role via dynamic rotation. main-agent
      //    forwards a reputation snapshot + per-cycle seed; selectForRole
      //    ranks the pool by score (reputation + context boost + jitter) and
      //    picks the top N. The full scoring table rides back in the response
      //    so downstream UI + Telegram can show "picked X,Y from pool of 4".
      const selection = selectForRole(
        role,
        { riskProfile, userGoal, marketVolatility },
        body.reputationScores ?? {},
        body.cycleSeed ?? 0,
      );
      const specIds = selection.picked;
      console.log(
        `[${AGENT_NAME}] Rotation picked [${specIds.join(", ") || "(none)"}] from pool [${selection.pool.join(", ")}] scores=${JSON.stringify(selection.scores)}`,
      );
      if (cycleLiquidity) {
        console.log(
          `[${AGENT_NAME}] Liquidity context: $${cycleLiquidity.availableUsd.toFixed(4)} available (proxy $${cycleLiquidity.proxyUsd.toFixed(4)})`,
        );
      }

      // 2. Hire them in parallel via x402 (user's wallet signs payments) —
      //    pass cycleLiquidity so each specialist's data payload includes the
      //    LIQUIDITY block and the 7B model recommends sizes against real
      //    buying power rather than a phantom budget.
      const hireTask = `Analyze for ${AGENT_NAME} debate. User goal: "${userGoal}". Risk profile: ${riskProfile}.`;
      const hireResults = await Promise.allSettled(
        specIds.map((id) => callSpecialist(id, hireTask, body.userWalletIndex ?? null, cycleLiquidity)),
      );
      const hiredSpecs: CallSpecialistResult[] = hireResults
        .filter((r): r is PromiseFulfilledResult<CallSpecialistResult> => r.status === "fulfilled")
        .map((r) => r.value);

      // 3. Build context string. callSpecialist returns a CallSpecialistResult which
      //    is a subset of SpecialistResult — cast via unknown is safe because buildSpecialistContext
      //    only reads fields that both types have. Pass cycleLiquidity so the
      //    AVAILABLE LIQUIDITY block is prepended before the confluence table.
      const specContext = hiredSpecs.length > 0
        ? buildSpecialistContext(hiredSpecs as unknown as SpecialistResult[], cycleLiquidity)
        : cycleLiquidity
          ? `${formatLiquidityTable(cycleLiquidity)}\n\n(none — no specialists hired for this role)`
          : "(none — no specialists hired for this role)";

      // 4. Compose the role-specific debate message. The specContext already
      //    carries the LIQUIDITY block, so prompts can reference it by name.
      //    RAG memory block is appended at the end of every message so the 7B
      //    model sees the user's own history (last 3 cycles from 0G Storage).
      //    Empty string when no prior cycles exist → no-op append.
      const priorBlock = body.priorContext && body.priorContext.length > 0
        ? `\n\n${body.priorContext}`
        : "";
      let userMessage: string;
      if (role === "alpha") {
        userMessage = `User goal: "${userGoal}"\n\nSpecialist signals (you hired these):\n${specContext}\n\nRisk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%.${priorBlock}`;
      } else if (role === "risk") {
        userMessage = `User goal: "${userGoal}"\n\nAlpha's thesis: "${body.alphaThesis ?? "(no thesis provided)"}"\nAlpha proposes: ${JSON.stringify(body.alphaParsed ?? {})}\n\nDefensive specialists (you hired these):\n${specContext}\n\nMax allowed: ${maxTradePercent}%. Challenge Alpha based on YOUR defensive data.${priorBlock}`;
      } else {
        // executor
        userMessage = `User goal: "${userGoal}"\n\nAlpha argues: "${body.alphaThesis ?? ""}"\nAlpha: ${JSON.stringify(body.alphaParsed ?? {})}\n\nRisk challenges: "${body.riskChallenge ?? ""}"\nRisk: ${JSON.stringify(body.riskParsed ?? {})}\n\n${hiredSpecs.length > 0 ? `Tiebreakers (you hired):\n${specContext}\n\n` : cycleLiquidity ? `${formatLiquidityTable(cycleLiquidity)}\n\n` : ""}Risk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%. Make the final call.${priorBlock}`;
      }

      // 5. Run 0G sealed inference locally (inside this container)
      const result = await sealedInference(OG_PROVIDER, prompt, userMessage);
      const { reasoning, parsed } = parseDualOutput(result.content, { signal: "HOLD", confidence: 50 });

      res.json({
        name: AGENT_NAME,
        content: result.content,
        reasoning,
        parsed,
        attestationHash: result.attestationHash,
        teeVerified: result.teeVerified,
        specialists_hired: hiredSpecs.map((s) => ({
          name: s.name,
          signal: s.signal,
          confidence: s.confidence,
          reasoning: s.reasoning,
          attestation: s.attestationHash,
          teeVerified: s.teeVerified,
          paymentTxHash: s.paymentTxHash,
          priceUsd: s.priceUsd,
          rawDataSnapshot: s.rawDataSnapshot,
          picks: s.picks, // multi-token shortlist from sentiment/momentum etc.
        })),
        total_cost_usd: hiredSpecs.reduce((sum, s) => sum + s.priceUsd, 0),
        // Rotation rationale — which pool, who was picked, and the full
        // scoring table. Main-agent threads this onto DebateStageResult so
        // the Telegram formatter can show "Alpha picked X,Y from 4".
        rotation: selection,
      });
    } catch (err) {
      console.error(`[${AGENT_NAME}] hire-and-analyze failed:`, err);
      res.status(500).json({
        error: err instanceof Error ? err.message : String(err),
        name: AGENT_NAME,
      });
    }
  });

  console.log(`[fly] ${AGENT_NAME}: /hire-and-analyze endpoint enabled (debate role)`);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[fly] ${AGENT_NAME} agent on :${PORT} (0G provider: ${OG_PROVIDER})`);
});
