import { getBroker } from "../config/og-compute.js";
import type { InferenceResult } from "../types/index.js";

export async function sealedInference(
  providerAddress: string,
  systemPrompt: string,
  userMessage: string,
): Promise<InferenceResult> {
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
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`0G inference failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    id: string;
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content ?? "";
  const chatID = data.id;

  // Extract attestation hash from response headers
  const attestationHash =
    response.headers.get("ZG-Res-Key") ??
    response.headers.get("zg-res-key") ??
    "";

  // TEE verification — non-fatal
  let teeVerified = false;
  if (chatID) {
    try {
      teeVerified = (await broker.inference.processResponse(providerAddress, chatID, content)) ?? false;
    } catch (err) {
      console.warn("[0G] TEE verification failed (non-fatal):", err);
    }
  }

  return { content, attestationHash, teeVerified };
}

export async function listProviders(): Promise<Array<{ provider: string; model: string }>> {
  const broker = await getBroker();
  const services = await broker.inference.listService();
  return services.map((s: { provider: string; model: string }) => ({
    provider: s.provider,
    model: s.model,
  }));
}
