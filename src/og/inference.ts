import { getBroker } from "../config/og-compute";
import type { InferenceResult } from "../types/index";

// ── Concurrency limiter: 0G allows max 5 concurrent, 30 req/min ────────────
const MAX_CONCURRENT = 3;
const INTER_REQUEST_DELAY_MS = 2000;
let activeRequests = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return;
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      activeRequests++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeRequests--;
  const next = waitQueue.shift();
  if (next) {
    // Small delay between releasing and granting next slot
    setTimeout(next, INTER_REQUEST_DELAY_MS);
  }
}

// ── Sealed inference on 0G Compute Network (TEE-verified) ───────────────────

export interface PriorMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Sealed inference on 0G Compute. Each call runs inside a TEE enclave and
 * returns a response with an attestation hash that can be verified on-chain.
 *
 * Optional `history` folds prior turns in between the system prompt and the
 * current user message, enabling multi-turn conversations (e.g. the Lead Dawg
 * chat modal). Specialist and debate callers pass no history — their prompts
 * are single-turn by design.
 */
export async function sealedInference(
  providerAddress: string,
  systemPrompt: string,
  userMessage: string,
  history: PriorMessage[] = [],
): Promise<InferenceResult> {
  await acquireSlot();

  try {
    const broker = await getBroker();

    const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);

    // Single-use headers — fresh per call
    const headers = await broker.inference.getRequestHeaders(providerAddress);

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 768,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`0G inference failed (${response.status}): ${text}`);
    }

    const data = (await response.json()) as {
      id: string;
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const content = data.choices?.[0]?.message?.content ?? "";

    // Attestation hash: prefer ZG-Res-Key header, fallback to data.id
    const attestationHash =
      response.headers.get("ZG-Res-Key") ??
      response.headers.get("zg-res-key") ??
      data.id ??
      "";

    // TEE verification — non-fatal
    // processResponse(provider, chatID, usageContent) — v0.7.4 signature
    let teeVerified = false;
    if (attestationHash) {
      try {
        const usageContent = JSON.stringify(data.usage ?? {});
        teeVerified = (await broker.inference.processResponse(providerAddress, attestationHash, usageContent)) ?? false;
      } catch (err) {
        console.warn("[0G] TEE verification failed (non-fatal):", err);
      }
    }

    return { content, attestationHash, teeVerified };
  } finally {
    releaseSlot();
  }
}

export async function listProviders(): Promise<Array<{ provider: string; model: string }>> {
  const broker = await getBroker();
  const services = await broker.inference.listService();
  return services.map((s: { provider: string; model: string }) => ({
    provider: s.provider,
    model: s.model,
  }));
}
