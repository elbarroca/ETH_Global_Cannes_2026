import { getUserPaymentFetch } from "../config/arc";
import { getAgent } from "../config/agent-registry";
import { incrementAgentHires } from "../marketplace/registry";
import { logAction } from "../store/action-logger";
import { parseDualOutput } from "./prompts";
import type { CallSpecialistResult, SpecialistResult, TokenPick } from "../types/index";

// Normalize a `picks` array coming out of the specialist's JSON. The 7B
// model sometimes emits picks with lowercase tickers, string confidence
// values, or missing fields — coerce everything into the TokenPick shape
// so downstream code can trust it.
function normalizePicks(raw: unknown): TokenPick[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const normalized: TokenPick[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    const asset = String(p.asset ?? p.ticker ?? p.symbol ?? "").toUpperCase().trim();
    if (!asset) continue;
    const signalRaw = String(p.signal ?? "HOLD").toUpperCase();
    const signal: TokenPick["signal"] =
      signalRaw === "BUY" || signalRaw === "SELL" ? signalRaw : "HOLD";
    normalized.push({
      asset,
      signal,
      confidence: Math.max(0, Math.min(100, Number(p.confidence ?? 50))),
      reason: String(p.reason ?? p.reasoning ?? ""),
    });
    if (normalized.length >= 5) break; // safety cap
  }
  return normalized.length > 0 ? normalized : undefined;
}

const SPECIALIST_PRICE = "$0.001";
const SPECIALIST_PRICE_USD = 0.001;

const SPECIALIST_FALLBACK: Record<string, unknown> = {
  signal: "HOLD",
  confidence: 50,
  reasoning: "Specialist unavailable — defaulting to HOLD",
};

// ── PURE network call: x402 pay + HTTP to specialist endpoint ─────────────────
// No DB writes, no reputation updates — safe to use inside Fly.io containers.
// Debate agents (vm-alpha, vm-risk, vm-executor) call this directly when they
// hire their own specialists; main-agent uses the hireSpecialist() wrapper
// below to also log to Supabase.

export async function callSpecialist(
  specialistId: string,
  task: string,
  userWalletIndex: number | null,
): Promise<CallSpecialistResult> {
  const start = Date.now();

  const agent = getAgent(specialistId);
  if (!agent) {
    return {
      name: specialistId,
      signal: "HOLD",
      confidence: 50,
      reasoning: `Agent ${specialistId} not in registry`,
      attestationHash: "not-found",
      teeVerified: false,
      rawDataSnapshot: null,
      paymentTxHash: "no-payment",
      priceUsd: 0,
      durationMs: Date.now() - start,
    };
  }

  const analyzeUrl = `${agent.url}/analyze`;

  let payFetch: typeof fetch;
  if (userWalletIndex != null) {
    try {
      payFetch = getUserPaymentFetch(userWalletIndex);
    } catch (err) {
      console.warn(`[call] x402 setup failed for ${specialistId}:`, err instanceof Error ? err.message : String(err));
      payFetch = fetch;
    }
  } else {
    payFetch = fetch;
  }

  let content = "";
  let attestationHash = "http-failed";
  let teeVerified = false;
  let parsed: Record<string, unknown> = { ...SPECIALIST_FALLBACK };
  let reasoning = "";
  let paymentTxHash = "no-payment";
  let rawDataSnapshot: unknown = null;

  try {
    const res = await payFetch(analyzeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${specialistId} returned ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    paymentTxHash = res.headers.get("x-payment-tx") ?? "paid";

    if (data.signal) {
      parsed = data;
      attestationHash = String(data.attestationHash ?? attestationHash);
      teeVerified = Boolean(data.teeVerified);
      reasoning = String(data.reasoning ?? "");
      rawDataSnapshot = data.rawDataSnapshot ?? null;
    } else if (data.content || typeof data === "string") {
      content = String(data.content ?? data);
      const parseResult = parseDualOutput<Record<string, unknown>>(content, SPECIALIST_FALLBACK as Record<string, unknown>);
      parsed = parseResult.parsed;
      reasoning = parseResult.reasoning;
    }
  } catch (err) {
    console.warn(`[call] HTTP call to ${specialistId} (${analyzeUrl}) failed:`, err instanceof Error ? err.message : String(err));
    reasoning = `[HTTP_ERROR] ${err instanceof Error ? err.message : String(err)}`;
  }

  // Multi-token picks — present only when the specialist's prompt emits them
  // (currently sentiment + momentum). Normalized to tolerate 7B JSON quirks.
  const picks = normalizePicks(parsed.picks);

  return {
    name: specialistId,
    signal: String(parsed.signal ?? "HOLD"),
    confidence: Number(parsed.confidence ?? 50),
    reasoning: reasoning || String(parsed.reasoning ?? ""),
    attestationHash,
    teeVerified,
    rawDataSnapshot,
    paymentTxHash,
    priceUsd: SPECIALIST_PRICE_USD,
    durationMs: Date.now() - start,
    picks,
  };
}

// ── Logging wrapper: calls + writes to Supabase + bumps reputation ────────────
// Used by main-agent (has DB access). Debate containers should NOT use this —
// they should use callSpecialist() and let main-agent log the actions based on
// the specialists_hired array returned in the response.

export async function hireSpecialist(
  specialistId: string,
  task: string,
  userId: string,
  userWalletIndex: number | null,
  hiredBy: string = "main-agent",
): Promise<SpecialistResult> {
  const result = await callSpecialist(specialistId, task, userWalletIndex);

  // Increment hire count in marketplace (non-fatal)
  try {
    await incrementAgentHires(specialistId);
  } catch {
    // non-fatal
  }

  // Log SPECIALIST_HIRED action (non-fatal)
  try {
    await logAction({
      userId,
      actionType: "SPECIALIST_HIRED",
      agentName: specialistId,
      attestationHash: result.attestationHash,
      teeVerified: result.teeVerified,
      paymentAmount: SPECIALIST_PRICE,
      paymentNetwork: "arc",
      paymentTxHash: result.paymentTxHash,
      durationMs: result.durationMs,
      payload: {
        signal: result.signal,
        confidence: result.confidence,
        method: "http_x402",
        url: `${getAgent(specialistId)?.url ?? "unknown"}/analyze`,
        hiredBy,
      },
    });
  } catch {
    // non-fatal
  }

  return {
    name: result.name,
    signal: result.signal,
    confidence: result.confidence,
    reasoning: result.reasoning,
    attestationHash: result.attestationHash,
    teeVerified: result.teeVerified,
    reputation: 500,
    rawDataSnapshot: result.rawDataSnapshot,
    hiredBy,
    paymentTxHash: result.paymentTxHash,
    priceUsd: result.priceUsd,
    picks: result.picks,
  };
}

// ── Hire multiple specialists in parallel (kept for legacy/fallback use) ──────

export async function hireSpecialists(
  specialistIds: string[],
  task: string,
  userId: string,
  userWalletIndex: number | null,
  hiredBy: string = "main-agent",
): Promise<SpecialistResult[]> {
  const results = await Promise.allSettled(
    specialistIds.map((id) => hireSpecialist(id, task, userId, userWalletIndex, hiredBy)),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<SpecialistResult> => r.status === "fulfilled")
    .map((r) => r.value);
}
