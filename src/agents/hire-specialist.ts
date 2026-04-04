import { getUserPaymentFetch } from "../config/arc";
import { getGateway } from "../openclaw/gateway-client";
import { discoverSpecialists, incrementAgentHires } from "../marketplace/registry";
import { logAction } from "../store/action-logger";
import { parseDualOutput } from "./prompts";
import type { SpecialistResult } from "../types/index";

const SPECIALIST_PRICE = "$0.001";

// Specialist fallback signals — used when OpenClaw Gateway is unavailable
const SPECIALIST_FALLBACK: Record<string, unknown> = {
  signal: "HOLD",
  confidence: 50,
  reasoning: "Gateway unavailable — defaulting to HOLD",
};

// ── Hire a single specialist: x402 pay → sessions_send ────────────────────────
// Decouples payment (Arc bounty) from communication (OpenClaw bounty)

export async function hireSpecialist(
  specialistId: string,
  task: string,
  userId: string,
  userWalletIndex: number | null,
): Promise<SpecialistResult> {
  const start = Date.now();
  const gateway = getGateway();

  // Step 1: Pay specialist via x402 on Arc (satisfies Arc bounty)
  let paymentTxHash = "no-payment";
  if (userWalletIndex != null) {
    try {
      const payFetch = getUserPaymentFetch(userWalletIndex);
      // Find specialist endpoint for payment
      const found = await discoverSpecialists({ tags: [specialistId], maxHires: 1 });
      if (found.length > 0 && found[0].endpoint) {
        const payRes = await payFetch(found[0].endpoint);
        // The x402 wrapped fetch handles 402 → pay → retry automatically
        // We just need to make the request to trigger the payment
        if (payRes.ok) {
          paymentTxHash = payRes.headers.get("x-payment-tx") ?? "paid";
        }
      }
    } catch (err) {
      console.warn(`[hire] x402 payment for ${specialistId} failed (non-fatal):`, err instanceof Error ? err.message : String(err));
    }
  }

  // Step 2: Send task to specialist via OpenClaw sessions_send
  let content = "";
  let attestationHash = "gateway-" + Date.now().toString(36);
  let teeVerified = false;
  let parsed: Record<string, unknown> = { ...SPECIALIST_FALLBACK };
  let reasoning = "";

  try {
    const result = await gateway.sessionsSend(specialistId, task, 15);

    if (result.status === "ok" && result.content) {
      content = result.content;
      attestationHash = result.runId ?? attestationHash;

      // Parse dual output (reasoning text + JSON)
      const parseResult = parseDualOutput<Record<string, unknown>>(content, SPECIALIST_FALLBACK as Record<string, unknown>);
      parsed = parseResult.parsed;
      reasoning = parseResult.reasoning;
      teeVerified = false; // OpenClaw Gateway response — not a TEE attestation
    } else if (result.status === "error") {
      console.warn(`[hire] sessions_send to ${specialistId} failed: ${result.error}`);
      reasoning = `[GATEWAY_ERROR] ${result.error}`;
    }
  } catch (err) {
    console.warn(`[hire] OpenClaw send to ${specialistId} failed:`, err instanceof Error ? err.message : String(err));
    reasoning = `[GATEWAY_UNAVAILABLE] ${err instanceof Error ? err.message : String(err)}`;
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
      payload: { signal: parsed.signal, confidence: parsed.confidence, method: "openclaw_sessions_send" },
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
    reputation: 500, // Will be overridden by marketplace lookup
    rawDataSnapshot: parsed,
  };
}

// ── Hire multiple specialists in parallel ─────────────────────────────────────

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
