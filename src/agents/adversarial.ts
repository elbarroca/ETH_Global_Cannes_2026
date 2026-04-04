import { sealedInference } from "../og/inference";
import { PROMPTS, parseDualOutput } from "./prompts";
import type { SpecialistResult, DebateResult } from "../types/index";

const PROVIDER = process.env.OG_PROVIDER_ADDRESS!;
const DELAY_MS = 2000;

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

async function inferWithRetry(
  systemPrompt: string,
  userMessage: string,
  fallback: Record<string, unknown>,
): Promise<{ content: string; parsed: Record<string, unknown>; reasoning: string; attestationHash: string; teeVerified: boolean }> {
  const result = await sealedInference(PROVIDER, systemPrompt, userMessage);
  const EMPTY: Record<string, unknown> = {};
  const { reasoning, parsed } = parseDualOutput<Record<string, unknown>>(result.content, EMPTY);

  // Retry once with emphasis if parse returned empty fallback
  if (isEmptyParse(parsed)) {
    await delay(DELAY_MS); // Rate-limit protection before retry
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

export async function runAdversarialDebate(
  specialistResults: SpecialistResult[],
  riskProfile: string,
  maxTradePercent: number,
): Promise<DebateResult> {
  const specContext = buildSpecialistContext(specialistResults);

  // ── Round 1: Standard debate ──────────────────────────────────

  // Alpha — FOR the trade (sees all specialist data + raw market data)
  const alphaMsg = `Specialist signals:\n${specContext}\n\nRisk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%.`;
  let alpha = await inferWithRetry(PROMPTS.alpha.content, alphaMsg, ALPHA_FALLBACK);

  await delay(DELAY_MS);

  // Risk — AGAINST (sees specialist data + Alpha's argument + Alpha's reasoning)
  const riskMsg = `Specialist signals:\n${specContext}\n\nAlpha argues: "${alpha.reasoning}"\nAlpha proposes: ${JSON.stringify(alpha.parsed)}\n\nMax allowed: ${maxTradePercent}%. Challenge this.`;
  let risk = await inferWithRetry(PROMPTS.risk.content, riskMsg, RISK_FALLBACK);

  await delay(DELAY_MS);

  // Executor — DECIDES (sees everything: data, Alpha reasoning + proposal, Risk reasoning + challenge)
  const executorMsg = `Specialist signals:\n${specContext}\n\nAlpha argues: "${alpha.reasoning}"\nAlpha: ${JSON.stringify(alpha.parsed)}\n\nRisk challenges: "${risk.reasoning}"\nRisk: ${JSON.stringify(risk.parsed)}\n\nRisk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%. Make the final call.`;
  let executor = await inferWithRetry(PROMPTS.executor.content, executorMsg, EXECUTOR_FALLBACK);

  // ── Round 2: Rebuttal if confidence is low ────────────────────
  // If Executor's confidence is below threshold, Alpha and Risk get to see
  // the decision and rebut, then Executor makes a final refined call.
  // Parse confidence defensively — 7B models may return "72%" or "high" instead of 72
  const rawConf = (executor.parsed as { confidence?: unknown }).confidence;
  const execConfidence = rawConf != null ? parseFloat(String(rawConf).replace("%", "")) : 100;
  const execPct = Number((executor.parsed as { pct?: number }).pct ?? 0);
  // Trigger rebuttal for low-confidence decisions: <60% for HOLD, <70% for trades
  const shouldRebuttal = !isNaN(execConfidence) && (execConfidence < 60 || (execPct > 0 && execConfidence < 70));

  if (shouldRebuttal) {
    console.log(`[debate] Low confidence (${execConfidence}%) — triggering rebuttal round`);

    await delay(DELAY_MS);

    // Alpha rebuttal — sees Executor's initial decision + Risk's challenge
    const alphaRebuttalMsg = `REBUTTAL ROUND. Executor initially decided: ${JSON.stringify(executor.parsed)}\nRisk argued: "${risk.reasoning}"\n\nSpecialist signals:\n${specContext}\n\nDefend or revise your position with new arguments. Risk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%.`;
    alpha = await inferWithRetry(PROMPTS.alpha.content, alphaRebuttalMsg, ALPHA_FALLBACK);

    await delay(DELAY_MS);

    // Risk rebuttal — sees Executor's initial decision + Alpha's revised argument
    const riskRebuttalMsg = `REBUTTAL ROUND. Executor initially decided: ${JSON.stringify(executor.parsed)}\nAlpha now argues: "${alpha.reasoning}"\nAlpha revised: ${JSON.stringify(alpha.parsed)}\n\nSpecialist signals:\n${specContext}\n\nMax allowed: ${maxTradePercent}%. Revise your challenge.`;
    risk = await inferWithRetry(PROMPTS.risk.content, riskRebuttalMsg, RISK_FALLBACK);

    await delay(DELAY_MS);

    // Executor final — full context from both rounds
    const executorFinalMsg = `FINAL DECISION after rebuttal.\n\nSpecialist signals:\n${specContext}\n\nAlpha (rebuttal): "${alpha.reasoning}"\nAlpha: ${JSON.stringify(alpha.parsed)}\n\nRisk (rebuttal): "${risk.reasoning}"\nRisk: ${JSON.stringify(risk.parsed)}\n\nRisk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%. Make your FINAL call with higher confidence.`;
    executor = await inferWithRetry(PROMPTS.executor.content, executorFinalMsg, EXECUTOR_FALLBACK);

    console.log(`[debate] Rebuttal complete — final confidence: ${(executor.parsed as { confidence?: number }).confidence ?? "unknown"}%`);
  }

  return { alpha, risk, executor, rebuttalTriggered: shouldRebuttal };
}
