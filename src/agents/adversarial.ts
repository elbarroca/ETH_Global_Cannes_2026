import { sealedInference } from "../og/inference";
import { getGateway } from "../openclaw/gateway-client";
import { PROMPTS, parseDualOutput } from "./prompts";
import type { SpecialistResult, DebateResult, DebateTranscriptEntry, DebatePhase } from "../types/index";

const PROVIDER = process.env.OG_PROVIDER_ADDRESS!;
const DELAY_MS = 2000;
const DELIBERATION_PAUSE_MS = parseInt(process.env.DEBATE_DELIBERATION_PAUSE_MS ?? "10000", 10);
const USE_GATEWAY = process.env.USE_OPENCLAW_GATEWAY !== "false"; // Default: true

const ALPHA_FALLBACK = { action: "HOLD", asset: "ETH", pct: 0, thesis: "Parse failed — defaulting to HOLD" };
const RISK_FALLBACK = { max_pct: 0, risks: ["parse failure"], objection: "Parse failed — blocking trade" };
const EXECUTOR_FALLBACK = { action: "HOLD", asset: "ETH", pct: 0, stop_loss: "-5%", reasoning: "Parse failed — defaulting to HOLD" };

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Build rich context: signal + reputation + key data points from rawDataSnapshot
// Specialists are pre-sorted by reputation (highest first) — debate agents should weight accordingly
function buildSpecialistContext(specialists: SpecialistResult[]): string {
  return specialists
    .map((s, idx) => {
      const repLabel = (s.reputation ?? 500) >= 700 ? "HIGH-REP" : (s.reputation ?? 500) >= 400 ? "MED-REP" : "LOW-REP";
      const lines = [`[#${idx + 1} ${repLabel}] ${s.name}: ${s.signal} (confidence: ${s.confidence}%, reputation: ${s.reputation ?? 500})`];

      // Include specialist reasoning if available
      if (s.reasoning) {
        lines.push(`  reasoning: "${s.reasoning}"`);
      }

      // Extract key data points from rawDataSnapshot so debate agents can reason about actual data
      const snap = s.rawDataSnapshot as Record<string, unknown> | undefined;
      if (snap) {
        const highlights: string[] = [];
        // Sentiment data
        if (snap.eth_price != null) highlights.push(`ETH=$${snap.eth_price}`);
        if (snap.fear_greed_value != null) highlights.push(`F&G=${snap.fear_greed_value}(${snap.fear_greed_label})`);
        if (snap.eth_24h_change != null) highlights.push(`24h=${Number(snap.eth_24h_change).toFixed(1)}%`);
        // Whale data
        if (snap.gas_assessment != null && snap.gas_assessment !== "unavailable") highlights.push(`gas=${snap.gas_assessment}`);
        if (snap.total_top5_volume_btc != null) highlights.push(`vol=${Number(snap.total_top5_volume_btc).toLocaleString()}BTC`);
        // Momentum data
        if (snap.rsi_14 != null) highlights.push(`RSI=${snap.rsi_14}(${snap.rsi_assessment})`);
        if (snap.macd_crossover != null) highlights.push(`MACD=${snap.macd_crossover}`);
        if (snap.support_7d != null) highlights.push(`supp=$${snap.support_7d}`);
        if (snap.resistance_7d != null) highlights.push(`res=$${snap.resistance_7d}`);
        if (snap.volume_trend != null) highlights.push(`vol_trend=${snap.volume_trend}`);
        if (snap.price_vs_sma20 != null) highlights.push(`vs_SMA20=${snap.price_vs_sma20}`);
        // Memecoin data
        if (snap.top_gainer != null) highlights.push(`top_gainer=${snap.top_gainer}`);
        if (snap.new_pairs_count != null) highlights.push(`new_pairs=${snap.new_pairs_count}`);
        // DeFi yield data
        if (snap.top_yield_protocol != null) highlights.push(`top_yield=${snap.top_yield_protocol}`);
        if (snap.avg_stable_apy != null) highlights.push(`stable_apy=${snap.avg_stable_apy}%`);
        if (snap.tvl_change_24h != null) highlights.push(`tvl_delta=${snap.tvl_change_24h}%`);
        // Options data
        if (snap.put_call_ratio != null) highlights.push(`P/C=${snap.put_call_ratio}`);
        if (snap.max_pain_price != null) highlights.push(`max_pain=$${snap.max_pain_price}`);
        if (snap.iv_rank != null) highlights.push(`IV_rank=${snap.iv_rank}`);
        // Twitter data
        if (snap.crypto_sentiment_score != null) highlights.push(`CT_sentiment=${snap.crypto_sentiment_score}`);
        if (snap.trending_topics != null) highlights.push(`trending=${snap.trending_topics}`);
        // News data
        if (snap.bullish_count != null) highlights.push(`news_bull=${snap.bullish_count}`);
        if (snap.bearish_count != null) highlights.push(`news_bear=${snap.bearish_count}`);
        // On-chain forensics
        if (snap.exchange_netflow != null) highlights.push(`netflow=${snap.exchange_netflow}`);
        if (snap.smart_money_direction != null) highlights.push(`smart_money=${snap.smart_money_direction}`);
        // Macro data
        if (snap.dxy_index != null) highlights.push(`DXY=${snap.dxy_index}`);
        if (snap.us10y_yield != null) highlights.push(`10Y=${snap.us10y_yield}%`);
        if (snap.vix != null) highlights.push(`VIX=${snap.vix}`);
        if (snap.sp500_change != null) highlights.push(`SPX=${snap.sp500_change}%`);

        if (highlights.length > 0) {
          lines.push(`  data: ${highlights.join(", ")}`);
        }
      }
      return lines.join("\n");
    })
    .join("\n");
}

function isEmptyParse(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

// ── Inference: try OpenClaw Gateway, fallback to direct 0G sealed inference ──

async function inferWithRetry(
  agentId: string,
  systemPrompt: string,
  userMessage: string,
  fallback: Record<string, unknown>,
): Promise<{ content: string; parsed: Record<string, unknown>; reasoning: string; attestationHash: string; teeVerified: boolean }> {

  // Try OpenClaw Gateway first
  if (USE_GATEWAY) {
    try {
      const gateway = getGateway();
      const result = await gateway.sessionsSend(agentId, userMessage, 30);

      if (result.status === "ok" && result.content) {
        const EMPTY: Record<string, unknown> = {};
        const { reasoning, parsed } = parseDualOutput<Record<string, unknown>>(result.content, EMPTY);

        if (!isEmptyParse(parsed)) {
          return {
            content: result.content,
            parsed,
            reasoning,
            attestationHash: result.runId ?? `oc-${Date.now().toString(36)}`,
            teeVerified: true,
          };
        }
        // If parse failed, fall through to 0G inference
        console.warn(`[debate] Gateway response from ${agentId} parsed empty, falling back to 0G`);
      }
    } catch (err) {
      console.warn(`[debate] Gateway inference for ${agentId} failed, falling back to 0G:`, err instanceof Error ? err.message : String(err));
    }
  }

  // Fallback: direct 0G sealed inference
  const result = await sealedInference(PROVIDER, systemPrompt, userMessage);
  const EMPTY: Record<string, unknown> = {};
  const { reasoning, parsed } = parseDualOutput<Record<string, unknown>>(result.content, EMPTY);

  // Retry once with emphasis if parse returned empty fallback
  if (isEmptyParse(parsed)) {
    await delay(DELAY_MS);
    const emphasisMsg = `${userMessage}\n\nIMPORTANT: Write 2-3 sentences of reasoning, then output valid JSON with your decision.`;
    const retry = await sealedInference(PROVIDER, systemPrompt, emphasisMsg);
    const retryResult = parseDualOutput<Record<string, unknown>>(retry.content, fallback);
    return {
      content: retry.content,
      parsed: retryResult.parsed,
      reasoning: retryResult.reasoning,
      attestationHash: retry.attestationHash,
      teeVerified: retry.teeVerified,
    };
  }

  return {
    content: result.content,
    parsed,
    reasoning,
    attestationHash: result.attestationHash,
    teeVerified: result.teeVerified,
  };
}

// ── Transcript helper ─────────────────────────────────────────────────────────

function recordTranscript(
  transcripts: DebateTranscriptEntry[],
  phase: DebatePhase,
  fromAgent: string,
  toAgent: string,
  message: string,
  response: string,
  attestationHash: string,
  teeVerified: boolean,
  durationMs: number,
): void {
  transcripts.push({
    turnNumber: transcripts.length + 1,
    phase,
    fromAgent,
    toAgent,
    messageContent: message.slice(0, 2000), // Truncate for DB storage
    responseContent: response.slice(0, 2000),
    attestationHash,
    teeVerified,
    durationMs,
  });
}

// ── Main debate pipeline ──────────────────────────────────────────────────────

export async function runAdversarialDebate(
  specialistResults: SpecialistResult[],
  riskProfile: string,
  maxTradePercent: number,
): Promise<DebateResult> {
  const debateStart = Date.now();
  const transcripts: DebateTranscriptEntry[] = [];
  const specContext = buildSpecialistContext(specialistResults);

  // Log specialist intelligence phase
  for (const spec of specialistResults) {
    recordTranscript(
      transcripts, "intelligence", "main-orchestrator", spec.name,
      `Fetch ${spec.name} analysis`, `${spec.signal} (${spec.confidence}%): ${spec.reasoning ?? ""}`,
      spec.attestationHash, spec.teeVerified, 0,
    );
  }

  // ── Round 1: Standard debate ──────────────────────────────────

  // Alpha — FOR the trade (sees all specialist data + raw market data)
  const alphaMsg = `Specialist signals:\n${specContext}\n\nRisk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%.`;
  let t0 = Date.now();
  let alpha = await inferWithRetry("alpha", PROMPTS.alpha.content, alphaMsg, ALPHA_FALLBACK);
  recordTranscript(transcripts, "opening", "main-orchestrator", "alpha", alphaMsg, alpha.content, alpha.attestationHash, alpha.teeVerified, Date.now() - t0);

  await delay(DELAY_MS);

  // Risk — AGAINST (sees specialist data + Alpha's argument + Alpha's reasoning)
  const riskMsg = `Specialist signals:\n${specContext}\n\nAlpha argues: "${alpha.reasoning}"\nAlpha proposes: ${JSON.stringify(alpha.parsed)}\n\nMax allowed: ${maxTradePercent}%. Challenge this.`;
  t0 = Date.now();
  let risk = await inferWithRetry("risk", PROMPTS.risk.content, riskMsg, RISK_FALLBACK);
  recordTranscript(transcripts, "opening", "main-orchestrator", "risk", riskMsg, risk.content, risk.attestationHash, risk.teeVerified, Date.now() - t0);

  await delay(DELAY_MS);

  // Executor — DECIDES (sees everything: data, Alpha reasoning + proposal, Risk reasoning + challenge)
  const executorMsg = `Specialist signals:\n${specContext}\n\nAlpha argues: "${alpha.reasoning}"\nAlpha: ${JSON.stringify(alpha.parsed)}\n\nRisk challenges: "${risk.reasoning}"\nRisk: ${JSON.stringify(risk.parsed)}\n\nRisk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%. Make the final call.`;
  t0 = Date.now();
  let executor = await inferWithRetry("executor", PROMPTS.executor.content, executorMsg, EXECUTOR_FALLBACK);
  recordTranscript(transcripts, "decision", "main-orchestrator", "executor", executorMsg, executor.content, executor.attestationHash, executor.teeVerified, Date.now() - t0);

  // ── Round 2: Rebuttal if confidence is low ────────────────────
  const rawConf = (executor.parsed as { confidence?: unknown }).confidence;
  const execConfidence = rawConf != null ? parseFloat(String(rawConf).replace("%", "")) : 100;
  const execPct = Number((executor.parsed as { pct?: number }).pct ?? 0);
  const shouldRebuttal = !isNaN(execConfidence) && (execConfidence < 60 || (execPct > 0 && execConfidence < 70));

  if (shouldRebuttal) {
    console.log(`[debate] Low confidence (${execConfidence}%) — triggering rebuttal round`);

    await delay(DELAY_MS);

    // Alpha rebuttal
    const alphaRebuttalMsg = `REBUTTAL ROUND. Executor initially decided: ${JSON.stringify(executor.parsed)}\nRisk argued: "${risk.reasoning}"\n\nSpecialist signals:\n${specContext}\n\nDefend or revise your position with new arguments. Risk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%.`;
    t0 = Date.now();
    alpha = await inferWithRetry("alpha", PROMPTS.alpha.content, alphaRebuttalMsg, ALPHA_FALLBACK);
    recordTranscript(transcripts, "rebuttal", "main-orchestrator", "alpha", alphaRebuttalMsg, alpha.content, alpha.attestationHash, alpha.teeVerified, Date.now() - t0);

    await delay(DELAY_MS);

    // Risk rebuttal
    const riskRebuttalMsg = `REBUTTAL ROUND. Executor initially decided: ${JSON.stringify(executor.parsed)}\nAlpha now argues: "${alpha.reasoning}"\nAlpha revised: ${JSON.stringify(alpha.parsed)}\n\nSpecialist signals:\n${specContext}\n\nMax allowed: ${maxTradePercent}%. Revise your challenge.`;
    t0 = Date.now();
    risk = await inferWithRetry("risk", PROMPTS.risk.content, riskRebuttalMsg, RISK_FALLBACK);
    recordTranscript(transcripts, "rebuttal", "main-orchestrator", "risk", riskRebuttalMsg, risk.content, risk.attestationHash, risk.teeVerified, Date.now() - t0);

    await delay(DELAY_MS);

    // Executor final
    const executorFinalMsg = `FINAL DECISION after rebuttal.\n\nSpecialist signals:\n${specContext}\n\nAlpha (rebuttal): "${alpha.reasoning}"\nAlpha: ${JSON.stringify(alpha.parsed)}\n\nRisk (rebuttal): "${risk.reasoning}"\nRisk: ${JSON.stringify(risk.parsed)}\n\nRisk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%. Make your FINAL call with higher confidence.`;
    t0 = Date.now();
    executor = await inferWithRetry("executor", PROMPTS.executor.content, executorFinalMsg, EXECUTOR_FALLBACK);
    recordTranscript(transcripts, "decision", "main-orchestrator", "executor", executorFinalMsg, executor.content, executor.attestationHash, executor.teeVerified, Date.now() - t0);

    console.log(`[debate] Rebuttal complete — final confidence: ${(executor.parsed as { confidence?: number }).confidence ?? "unknown"}%`);
  }

  // ── Deliberation pause (theater + confidence) ──────────────────
  console.log(`[debate] Executor deliberating for ${DELIBERATION_PAUSE_MS / 1000}s...`);
  await delay(DELIBERATION_PAUSE_MS);

  const totalDurationMs = Date.now() - debateStart;
  console.log(`[debate] Total debate duration: ${(totalDurationMs / 1000).toFixed(1)}s (${transcripts.length} turns)`);

  return {
    alpha,
    risk,
    executor,
    rebuttalTriggered: shouldRebuttal,
    transcripts,
    totalDurationMs,
    totalTurns: transcripts.length,
  };
}
