import "dotenv/config";
import { createSpecialistServer } from "../payments/x402-server";
import { sealedInference } from "../og/inference";
import { PROMPTS, parseDualOutput } from "./prompts";
import { deriveSpecialistAddress } from "../config/wallets";
import { fetchSentimentData } from "./data/sentiment-data";
import { fetchWhaleData } from "./data/whale-data";
import { fetchMomentumData } from "./data/momentum-data";
import { fetchMemecoinData } from "./data/memecoin-data";
import { fetchTwitterData } from "./data/twitter-data";
import { fetchDefiYieldData } from "./data/defi-yield-data";
import { fetchNewsData } from "./data/news-data";
import { fetchOnchainForensicsData } from "./data/onchain-forensics-data";
import { fetchOptionsData } from "./data/options-data";
import { fetchMacroData } from "./data/macro-data";

const PROVIDER = process.env.OG_PROVIDER_ADDRESS!;

// ─── Start all specialists ───────────────────────────────────────────────────

export async function startSpecialists(): Promise<void> {
  const specs = [
    { name: "sentiment", port: 4001, specIndex: 0, prompt: PROMPTS.sentiment.content, fetchData: fetchSentimentData },
    { name: "whale", port: 4002, specIndex: 1, prompt: PROMPTS.whale.content, fetchData: fetchWhaleData },
    { name: "momentum", port: 4003, specIndex: 2, prompt: PROMPTS.momentum.content, fetchData: fetchMomentumData },
    { name: "memecoin-hunter", port: 4004, specIndex: 3, prompt: PROMPTS.memecoin.content, fetchData: fetchMemecoinData },
    { name: "twitter-alpha", port: 4005, specIndex: 4, prompt: PROMPTS.twitter.content, fetchData: fetchTwitterData },
    { name: "defi-yield", port: 4006, specIndex: 5, prompt: PROMPTS.defiYield.content, fetchData: fetchDefiYieldData },
    { name: "news-scanner", port: 4007, specIndex: 6, prompt: PROMPTS.news.content, fetchData: fetchNewsData },
    { name: "onchain-forensics", port: 4008, specIndex: 7, prompt: PROMPTS.forensics.content, fetchData: fetchOnchainForensicsData },
    { name: "options-flow", port: 4009, specIndex: 8, prompt: PROMPTS.options.content, fetchData: fetchOptionsData },
    { name: "macro-correlator", port: 4010, specIndex: 9, prompt: PROMPTS.macro.content, fetchData: fetchMacroData },
  ];

  for (const s of specs) {
    // Each specialist derives its own payTo wallet from the master seed
    const payTo = deriveSpecialistAddress(s.specIndex);
    console.log(`[specialist] ${s.name} payTo: ${payTo}`);

    createSpecialistServer(s.name, s.port, payTo, "$0.001", async () => {
      // 1. Fetch REAL market data
      const rawData = await s.fetchData();
      console.log(`[specialist:${s.name}] Fetched real data (${rawData.length} bytes)`);

      // 2. Pass through 0G sealed inference. NO local heuristic fallback —
      // if 0G is unavailable the specialist throws (client sees 500) so the
      // orchestrator can flag the cycle as degraded instead of quietly serving
      // hardcoded signals. This enforces the "0G sealed inference is the only
      // source of truth" invariant from the 0G bounty.
      const result = await sealedInference(PROVIDER, s.prompt, `Current market data:\n${rawData}`);
      const { parsed, reasoning } = parseDualOutput(result.content, { signal: "HOLD" as const, confidence: 0 });

      // 3. Return analysis + raw data snapshot for transparency
      let rawSnapshot: unknown;
      try { rawSnapshot = JSON.parse(rawData); } catch { rawSnapshot = rawData; }

      return {
        name: s.name,
        ...parsed,
        reasoning: reasoning || (parsed as { reasoning?: string }).reasoning || "",
        rawDataSnapshot: rawSnapshot,
        attestationHash: result.attestationHash,
        teeVerified: result.teeVerified,
      };
    });
  }

  const portRange = specs.map((s) => `:${s.port}`).join(", ");
  console.log(`Specialists started on ${portRange} (real data mode — ${specs.length} agents)`);
}

// ─── Run directly (only when invoked via `npm run specialists`) ──────────────

const isDirectRun = process.argv[1]?.includes("specialist-server");
if (isDirectRun) {
  startSpecialists().catch((err) => {
    console.error("Failed to start specialists:", err);
    process.exit(1);
  });
}
