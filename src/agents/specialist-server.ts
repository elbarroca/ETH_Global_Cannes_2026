import "dotenv/config";
import { createSpecialistServer } from "../payments/x402-server.js";
import { sealedInference } from "../og/inference.js";
import { PROMPTS, safeJsonParse } from "./prompts.js";
import { deriveSpecialistAddress } from "../config/wallets.js";

const PROVIDER = process.env.OG_PROVIDER_ADDRESS!;

function getMarketContext(): string {
  return `Current date: ${new Date().toISOString()}.
BTC ~$67,000. ETH ~$3,400. Market sentiment: mixed.
Funding rates slightly elevated. Volume declining.`;
}

// ─── Start all specialists ───────────────────────────────────────────────────

export async function startSpecialists(): Promise<void> {
  const specs = [
    { name: "sentiment", port: 4001, specIndex: 0, prompt: PROMPTS.sentiment.content },
    { name: "whale", port: 4002, specIndex: 1, prompt: PROMPTS.whale.content },
    { name: "momentum", port: 4003, specIndex: 2, prompt: PROMPTS.momentum.content },
  ];

  for (const s of specs) {
    // Each specialist derives its own payTo wallet from the master seed
    const payTo = deriveSpecialistAddress(s.specIndex);
    console.log(`[specialist] ${s.name} payTo: ${payTo}`);

    createSpecialistServer(s.name, s.port, payTo, "$0.001", async () => {
      const result = await sealedInference(PROVIDER, s.prompt, getMarketContext());
      const parsed = safeJsonParse(result.content, {
        signal: "HOLD" as const,
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
