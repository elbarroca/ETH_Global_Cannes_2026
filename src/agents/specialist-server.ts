import "dotenv/config";
import { createSpecialistServer } from "../payments/x402-server";
import { sealedInference } from "../og/inference";
import { PROMPTS, parseDualOutput } from "./prompts";
import { deriveSpecialistAddress } from "../config/wallets";
import { fetchSentimentData } from "./data/sentiment-data";
import { fetchWhaleData } from "./data/whale-data";
import { fetchMomentumData } from "./data/momentum-data";

const PROVIDER = process.env.OG_PROVIDER_ADDRESS!;

// ─── Local fallback when 0G inference is unavailable ─────────────────────────

function computeLocalFallback(
  name: string,
  rawData: string,
): { signal: string; confidence: number } {
  try {
    const data = JSON.parse(rawData);
    switch (name) {
      case "sentiment": {
        const fng = Number(data.fear_greed_value ?? 50);
        if (fng >= 65) return { signal: "BUY", confidence: Math.min(fng, 80) };
        if (fng <= 35) return { signal: "SELL", confidence: Math.min(100 - fng, 80) };
        return { signal: "HOLD", confidence: 50 };
      }
      case "whale": {
        const assessment = String(data.gas_assessment ?? "moderate");
        if (assessment === "high_activity") return { signal: "BUY", confidence: 60 };
        if (assessment === "low_activity") return { signal: "SELL", confidence: 55 };
        return { signal: "HOLD", confidence: 50 };
      }
      case "momentum": {
        const rsi = Number(data.rsi_14 ?? 50);
        if (rsi < 35) return { signal: "BUY", confidence: 65 };
        if (rsi > 65) return { signal: "SELL", confidence: 65 };
        return { signal: "HOLD", confidence: 50 };
      }
      default:
        return { signal: "HOLD", confidence: 40 };
    }
  } catch {
    return { signal: "HOLD", confidence: 30 };
  }
}

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

      let parsed: { signal: string; confidence: number; [k: string]: unknown };
      let reasoning: string;
      let attestationHash: string;
      let teeVerified: boolean;

      try {
        // 2. Pass through 0G sealed inference
        const result = await sealedInference(PROVIDER, s.prompt, `Current market data:\n${rawData}`);
        const dual = parseDualOutput(result.content, { signal: "HOLD" as const, confidence: 0 });
        parsed = dual.parsed;
        reasoning = dual.reasoning;
        attestationHash = result.attestationHash;
        teeVerified = result.teeVerified;
      } catch (err) {
        console.warn(`[specialist:${s.name}] 0G inference failed, using local fallback:`, err instanceof Error ? err.message : String(err));
        parsed = computeLocalFallback(s.name, rawData);
        reasoning = "Local fallback: 0G inference unavailable.";
        attestationHash = "local-fallback";
        teeVerified = false;
      }

      // 3. Return analysis + raw data snapshot for transparency
      let rawSnapshot: unknown;
      try { rawSnapshot = JSON.parse(rawData); } catch { rawSnapshot = rawData; }

      return {
        name: s.name,
        ...parsed,
        reasoning: reasoning || (parsed as { reasoning?: string }).reasoning || "",
        rawDataSnapshot: rawSnapshot,
        attestationHash,
        teeVerified,
      };
    });
  }

  console.log("Specialists started on :4001, :4002, :4003 (real data mode)");
}

// ─── Run directly (only when invoked via `npm run specialists`) ──────────────

const isDirectRun = process.argv[1]?.includes("specialist-server");
if (isDirectRun) {
  startSpecialists().catch((err) => {
    console.error("Failed to start specialists:", err);
    process.exit(1);
  });
}
