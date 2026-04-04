import { getUserPaymentFetch } from "../config/arc";
import { sealedInference } from "../og/inference";
import { OG_PROVIDER } from "../config/og-compute";
import { discoverSpecialists, incrementAgentHires } from "../marketplace/registry";
import { logAction } from "../store/action-logger";
import { PROMPTS, parseDualOutput } from "./prompts";
import type { SpecialistResult } from "../types/index";

const SPECIALIST_PRICE = "$0.001";

// Map specialist IDs to their 0G inference prompts
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
};

// Specialist fallback when 0G inference fails
const SPECIALIST_FALLBACK: Record<string, unknown> = {
  signal: "HOLD",
  confidence: 50,
  reasoning: "0G inference unavailable — defaulting to HOLD",
};

// ── Hire a single specialist: x402 pay + 0G sealed inference ──────────────────
// Payment on Arc (x402 bounty), inference on 0G Compute (TEE-verified)

export async function hireSpecialist(
  specialistId: string,
  task: string,
  userId: string,
  userWalletIndex: number | null,
): Promise<SpecialistResult> {
  const start = Date.now();

  // Step 1: Pay specialist via x402 on Arc (satisfies Arc bounty)
  let paymentTxHash = "no-payment";
  if (userWalletIndex != null) {
    try {
      const payFetch = getUserPaymentFetch(userWalletIndex);
      const found = await discoverSpecialists({ tags: [specialistId], maxHires: 1 });
      if (found.length > 0 && found[0].endpoint) {
        const payRes = await payFetch(found[0].endpoint);
        if (payRes.ok) {
          paymentTxHash = payRes.headers.get("x-payment-tx") ?? "paid";
        }
      }
    } catch (err) {
      console.warn(`[hire] x402 payment for ${specialistId} failed (non-fatal):`, err instanceof Error ? err.message : String(err));
    }
  }

  // Step 2: Run inference on 0G Compute (the ONLY inference path)
  const prompt = PROMPT_MAP[specialistId];
  if (!prompt) {
    console.warn(`[hire] No prompt found for specialist ${specialistId} — returning fallback`);
    return {
      name: specialistId,
      signal: "HOLD",
      confidence: 50,
      reasoning: `No prompt configured for ${specialistId}`,
      attestationHash: "no-prompt",
      teeVerified: false,
      reputation: 500,
    };
  }

  let content = "";
  let attestationHash = "0g-failed";
  let teeVerified = false;
  let parsed: Record<string, unknown> = { ...SPECIALIST_FALLBACK };
  let reasoning = "";

  try {
    const result = await sealedInference(OG_PROVIDER, prompt, task);
    content = result.content;
    attestationHash = result.attestationHash;
    teeVerified = result.teeVerified;

    const parseResult = parseDualOutput<Record<string, unknown>>(content, SPECIALIST_FALLBACK as Record<string, unknown>);
    parsed = parseResult.parsed;
    reasoning = parseResult.reasoning;
  } catch (err) {
    console.warn(`[hire] 0G inference for ${specialistId} failed:`, err instanceof Error ? err.message : String(err));
    reasoning = `[0G_ERROR] ${err instanceof Error ? err.message : String(err)}`;
  }

  // Step 3: Increment hire count in marketplace
  try {
    await incrementAgentHires(specialistId);
  } catch {
    // non-fatal
  }

  // Step 4: Log action
  const durationMs = Date.now() - start;
  try {
    await logAction({
      userId,
      actionType: "SPECIALIST_HIRED",
      agentName: specialistId,
      attestationHash,
      teeVerified,
      paymentAmount: SPECIALIST_PRICE,
      paymentNetwork: "arc",
      paymentTxHash,
      durationMs,
      payload: { signal: parsed.signal, confidence: parsed.confidence, method: "0g_sealed_inference" },
    });
  } catch {
    // non-fatal
  }

  return {
    name: specialistId,
    signal: String(parsed.signal ?? "HOLD"),
    confidence: Number(parsed.confidence ?? 50),
    reasoning: reasoning || String(parsed.reasoning ?? ""),
    attestationHash,
    teeVerified,
    reputation: 500,
    rawDataSnapshot: parsed,
  };
}

// ── Hire multiple specialists in parallel (rate-limited by inference.ts semaphore) ─

export async function hireSpecialists(
  specialistIds: string[],
  task: string,
  userId: string,
  userWalletIndex: number | null,
): Promise<SpecialistResult[]> {
  const results = await Promise.allSettled(
    specialistIds.map((id) => hireSpecialist(id, task, userId, userWalletIndex)),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<SpecialistResult> => r.status === "fulfilled")
    .map((r) => r.value);
}
