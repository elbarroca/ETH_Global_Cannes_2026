import "dotenv/config";
import { createSpecialistServer } from "../payments/x402-server.js";
import { sealedInference } from "../og/inference.js";
import { PROMPTS, safeJsonParse } from "./prompts.js";
import { deriveSpecialistAddress } from "../config/wallets.js";
import { fetchSentimentData } from "./data/sentiment-data.js";
import { fetchWhaleData } from "./data/whale-data.js";
import { fetchMomentumData } from "./data/momentum-data.js";

const PROVIDER = process.env.OG_PROVIDER_ADDRESS!;

// ─── Start all specialists ───────────────────────────────────────────────────

export async function startSpecialists(): Promise<void> {
  const specs = [
    { name: "sentiment", port: 4001, specIndex: 0, prompt: PROMPTS.sentiment.content, fetchData: fetchSentimentData },
    { name: "whale", port: 4002, specIndex: 1, prompt: PROMPTS.whale.content, fetchData: fetchWhaleData },
    { name: "momentum", port: 4003, specIndex: 2, prompt: PROMPTS.momentum.content, fetchData: fetchMomentumData },
  ];

  for (const s of specs) {
    // Each specialist derives its own payTo wallet from the master seed
    const payTo = deriveSpecialistAddress(s.specIndex);
    console.log(`[specialist] ${s.name} payTo: ${payTo}`);

    createSpecialistServer(s.name, s.port, payTo, "$0.001", async () => {
      // 1. Fetch REAL market data
      const rawData = await s.fetchData();
      console.log(`[specialist:${s.name}] Fetched real data (${rawData.length} bytes)`);

      // 2. Pass through 0G sealed inference
      const result = await sealedInference(PROVIDER, s.prompt, `Current market data:\n${rawData}`);
      const parsed = safeJsonParse(result.content, {
        signal: "HOLD" as const,
        confidence: 0,
      });

      // 3. Return analysis + raw data snapshot for transparency
      let rawSnapshot: unknown;
      try { rawSnapshot = JSON.parse(rawData); } catch { rawSnapshot = rawData; }

      return {
        name: s.name,
        ...parsed,
        rawDataSnapshot: rawSnapshot,
        attestationHash: result.attestationHash,
        teeVerified: result.teeVerified,
      };
    });
  }

  console.log("Specialists started on :4001, :4002, :4003 (real data mode)");
}

// ─── Run directly ────────────────────────────────────────────────────────────

startSpecialists().catch((err) => {
  console.error("Failed to start specialists:", err);
  process.exit(1);
});
