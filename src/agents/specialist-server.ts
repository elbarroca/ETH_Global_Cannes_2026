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
      case "memecoin-hunter": {
        const newPairs = Number(data.new_pairs_count ?? 0);
        if (newPairs > 50) return { signal: "BUY", confidence: 55 };
        return { signal: "HOLD", confidence: 45 };
      }
      case "twitter-alpha": {
        const score = Number(data.crypto_sentiment_score ?? 50);
        if (score > 70) return { signal: "BUY", confidence: Math.min(score, 75) };
        if (score < 30) return { signal: "SELL", confidence: Math.min(100 - score, 75) };
        return { signal: "HOLD", confidence: 50 };
      }
      case "defi-yield": {
        const apy = Number(data.avg_stable_apy ?? 3);
        if (apy > 6) return { signal: "BUY", confidence: 60 };
        return { signal: "HOLD", confidence: 50 };
      }
      case "news-scanner": {
        const bull = Number(data.bullish_count ?? 0);
        const bear = Number(data.bearish_count ?? 0);
        if (bull > bear * 2) return { signal: "BUY", confidence: 60 };
        if (bear > bull * 2) return { signal: "SELL", confidence: 60 };
        return { signal: "HOLD", confidence: 45 };
      }
      case "onchain-forensics": {
        const direction = String(data.smart_money_direction ?? "neutral");
        if (direction === "accumulating") return { signal: "BUY", confidence: 65 };
        if (direction === "distributing") return { signal: "SELL", confidence: 65 };
        return { signal: "HOLD", confidence: 50 };
      }
      case "options-flow": {
        const pcRatio = Number(data.put_call_ratio ?? 1);
        if (pcRatio < 0.7) return { signal: "BUY", confidence: 60 };
        if (pcRatio > 1.3) return { signal: "SELL", confidence: 60 };
        return { signal: "HOLD", confidence: 50 };
      }
      case "macro-correlator": {
        const vix = Number(data.vix ?? 20);
        if (vix > 30) return { signal: "SELL", confidence: 65 };
        if (vix < 15) return { signal: "BUY", confidence: 55 };
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
        parsed = { ...computeLocalFallback(s.name, rawData), degraded: true };
        reasoning = `[FALLBACK] Local heuristic — 0G inference unavailable: ${err instanceof Error ? err.message : String(err)}`;
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
