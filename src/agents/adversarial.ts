import { sealedInference } from "../og/inference.js";
import { PROMPTS, safeJsonParse } from "./prompts.js";
import type { SpecialistResult, DebateResult } from "../types/index.js";

const PROVIDER = process.env.OG_PROVIDER_ADDRESS!;
const DELAY_MS = 2000;

const ALPHA_FALLBACK = { action: "HOLD", asset: "ETH", allocationPercent: 0, reasoning: "Parse failed — defaulting to HOLD", conviction: 0 };
const RISK_FALLBACK = { objection: "Parse failed", maxSafeAllocation: 0, riskLevel: "extreme" as const, reasoning: "Parse failed — blocking trade" };
const EXECUTOR_FALLBACK = { action: "HOLD", asset: "ETH", allocationPercent: 0, stopLossPercent: 5, reasoning: "Parse failed — defaulting to HOLD" };

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildSpecialistContext(specialists: SpecialistResult[]): string {
  return specialists
    .map((s) => `${s.name}: ${s.signal} (confidence: ${s.confidence}%)`)
    .join("\n");
}

async function inferWithRetry(
  systemPrompt: string,
  userMessage: string,
  fallback: Record<string, unknown>,
): Promise<{ content: string; parsed: Record<string, unknown>; attestationHash: string; teeVerified: boolean }> {
  const result = await sealedInference(PROVIDER, systemPrompt, userMessage);
  let parsed = safeJsonParse<Record<string, unknown>>(result.content, null as unknown as Record<string, unknown>);

  // Retry once with emphasis if parse failed
  if (!parsed) {
    const emphasisMsg = `${userMessage}\n\nIMPORTANT: Return ONLY valid JSON. No explanations.`;
    const retry = await sealedInference(PROVIDER, systemPrompt, emphasisMsg);
    parsed = safeJsonParse<Record<string, unknown>>(retry.content, fallback);
    return {
      content: retry.content,
      parsed,
      attestationHash: retry.attestationHash,
      teeVerified: retry.teeVerified,
    };
  }

  return {
    content: result.content,
    parsed,
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

  // Alpha — FOR the trade
  const alphaMsg = `Specialist signals:\n${specContext}\n\nRisk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%.`;
  const alpha = await inferWithRetry(PROMPTS.alpha.content, alphaMsg, ALPHA_FALLBACK);

  await delay(DELAY_MS);

  // Risk — AGAINST (sees Alpha's output)
  const riskMsg = `Specialist signals:\n${specContext}\n\nAlpha proposes: ${JSON.stringify(alpha.parsed)}\n\nMax allowed: ${maxTradePercent}%. Challenge this.`;
  const risk = await inferWithRetry(PROMPTS.risk.content, riskMsg, RISK_FALLBACK);

  await delay(DELAY_MS);

  // Executor — DECIDES (sees both)
  const executorMsg = `Specialist signals:\n${specContext}\n\nAlpha: ${JSON.stringify(alpha.parsed)}\nRisk: ${JSON.stringify(risk.parsed)}\n\nRisk profile: ${riskProfile}. Max allocation: ${maxTradePercent}%. Make the final call.`;
  const executor = await inferWithRetry(PROMPTS.executor.content, executorMsg, EXECUTOR_FALLBACK);

  return { alpha, risk, executor };
}
