import "dotenv/config";
import { createSpecialistServer } from "../payments/x402-server.js";

// ─── STUBS — replace with Dev A's real modules when available ───────────────

async function sealedInference(
  system: string,
  user: string
): Promise<{ content: string; attestationHash: string; teeVerified: boolean }> {
  // STUB: replace with import from "../og/inference.js"
  return {
    content: JSON.stringify({ signal: "BUY", confidence: 72, reasoning: "mock data" }),
    attestationHash: "stub_" + Date.now(),
    teeVerified: false,
  };
}

const PROMPTS = {
  sentiment:
    "You are a crypto sentiment analyst. Return ONLY JSON: {signal, confidence, reasoning}",
  whale:
    "You are a whale tracker. Return ONLY JSON: {signal, confidence, topMovement}",
  momentum:
    "You are a momentum scanner. Return ONLY JSON: {signal, confidence, trend}",
};

function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(
      raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
    ) as T;
  } catch {
    return fallback;
  }
}

// ─── Market context ──────────────────────────────────────────────────────────

const MARKET_CONTEXT = `Current date: ${new Date().toISOString()}.
BTC ~$67,000. ETH ~$3,400. Market sentiment: mixed.
Funding rates slightly elevated. Volume declining.`;

// ─── Start all specialists ───────────────────────────────────────────────────

export async function startSpecialists(): Promise<void> {
  const payTo = process.env.SPECIALIST_WALLET_ADDRESS;
  if (!payTo) throw new Error("SPECIALIST_WALLET_ADDRESS not set in .env");

  const specs = [
    { name: "sentiment", port: 4001, prompt: PROMPTS.sentiment },
    { name: "whale", port: 4002, prompt: PROMPTS.whale },
    { name: "momentum", port: 4003, prompt: PROMPTS.momentum },
  ];

  for (const s of specs) {
    createSpecialistServer(s.name, s.port, payTo, "$0.001", async () => {
      const result = await sealedInference(s.prompt, MARKET_CONTEXT);
      const parsed = safeJsonParse(result.content, {
        signal: "HOLD",
        confidence: 0,
      });
      return {
        name: s.name,
        ...parsed,
        attestationHash: result.attestationHash,
        teeVerified: result.teeVerified,
      };
    });
  }

  console.log("Specialists started on :4001, :4002, :4003");
}

// ─── Run directly ────────────────────────────────────────────────────────────

startSpecialists().catch((err) => {
  console.error("Failed to start specialists:", err);
  process.exit(1);
});
