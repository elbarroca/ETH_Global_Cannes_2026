// Fetches REAL price history and computes technical indicators locally +
// broad-universe momentum rankings for multi-token picks.

import { cachedFetch } from "./cached-fetch";
import { fetchTokenUniverse, formatUniverseForPrompt, type TokenUniverseEntry } from "./token-universe";

function getCoinGeckoBase(): string {
  return process.env.COINGECKO_API_URL ?? "https://api.coingecko.com/api/v3";
}

function getCoinGeckoHeaders(): Record<string, string> | undefined {
  const key = process.env.COINGECKO_API_KEY;
  if (!key) return undefined;
  const header = key.startsWith("CG-") ? "x-cg-pro-api-key" : "x-cg-demo-api-key";
  return { [header]: key };
}

// ── Technical indicator computations ─────────────────────────

function computeRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  const recent = changes.slice(-period);
  const gains = recent.filter((c) => c > 0);
  const losses = recent.filter((c) => c < 0).map((c) => Math.abs(c));
  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;
  if (avgGain === 0 && avgLoss === 0) return 50; // flat market = neutral
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round(100 - 100 / (1 + rs));
}

function computeEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const ema = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    ema.push(prices[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function computeMACD(prices: number[]): {
  macd: number;
  signal: number;
  histogram: number;
  crossover: "bullish" | "bearish";
} {
  if (prices.length < 26) {
    return { macd: 0, signal: 0, histogram: 0, crossover: "bullish" as const };
  }
  const ema12 = computeEMA(prices, 12);
  const ema26 = computeEMA(prices, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = computeEMA(macdLine.slice(-9), 9);
  const macd = macdLine[macdLine.length - 1];
  const signal = signalLine[signalLine.length - 1];
  const histogram = macd - signal;
  return {
    macd: Math.round(macd * 100) / 100,
    signal: Math.round(signal * 100) / 100,
    histogram: Math.round(histogram * 100) / 100,
    crossover: histogram > 0 ? "bullish" : "bearish",
  };
}

function computeSMA(prices: number[], period: number): number {
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// ── Main fetch + compute function ────────────────────────────

export async function fetchMomentumData(): Promise<string> {
  const cg = getCoinGeckoBase();
  const headers = getCoinGeckoHeaders();
  const results: Record<string, unknown> = { fetched_at: new Date().toISOString() };

  try {
    // 30 days hourly data — enough for RSI-14, MACD(12,26,9), SMAs
    const chart = await cachedFetch<{ prices: number[][]; total_volumes: number[][] }>(
      `${cg}/coins/ethereum/market_chart?vs_currency=usd&days=30`,
      60_000,
      headers,
    );

    const prices = chart.prices.map((p) => p[1]);
    const volumes = chart.total_volumes.map((v) => v[1]);

    if (prices.length < 30) {
      return JSON.stringify({ error: "Insufficient price data", fetched_at: results.fetched_at });
    }

    const currentPrice = prices[prices.length - 1];
    const rsi = computeRSI(prices);
    const macd = computeMACD(prices);

    // Support/resistance from 7-day window (~168 hourly candles)
    const week = prices.slice(-168);
    const support = Math.min(...week);
    const resistance = Math.max(...week);

    // Volume trend (24h vs prior 24h)
    const recentVol = volumes.slice(-24);
    const prevVol = volumes.slice(-48, -24);
    const avgRecent = recentVol.reduce((a, b) => a + b, 0) / (recentVol.length || 1);
    const avgPrev = prevVol.reduce((a, b) => a + b, 0) / (prevVol.length || 1);
    const volChange = avgPrev > 0 ? ((avgRecent - avgPrev) / avgPrev) * 100 : 0;

    // Moving averages (hourly data, so 20 days = 20*24 candles)
    const sma20 = computeSMA(prices, 20 * 24);
    const sma30 = computeSMA(prices, Math.min(30 * 24, prices.length));

    results.current_price = Math.round(currentPrice * 100) / 100;
    results.rsi_14 = rsi;
    results.rsi_assessment =
      rsi > 70
        ? "overbought"
        : rsi < 30
          ? "oversold"
          : rsi > 60
            ? "bullish_zone"
            : rsi < 40
              ? "bearish_zone"
              : "neutral";
    results.macd = macd.macd;
    results.macd_signal = macd.signal;
    results.macd_histogram = macd.histogram;
    results.macd_crossover = macd.crossover;
    results.support_7d = Math.round(support * 100) / 100;
    results.resistance_7d = Math.round(resistance * 100) / 100;
    results.price_above_support_pct = Math.round((currentPrice / support - 1) * 100 * 100) / 100;
    results.price_below_resistance_pct = Math.round((1 - currentPrice / resistance) * 100 * 100) / 100;
    results.sma_20d = Math.round(sma20 * 100) / 100;
    results.sma_30d = Math.round(sma30 * 100) / 100;
    results.price_vs_sma20 = currentPrice > sma20 ? "above" : "below";
    results.volume_change_24h_pct = Math.round(volChange * 10) / 10;
    results.volume_trend =
      volChange > 20
        ? "surging"
        : volChange > 5
          ? "increasing"
          : volChange < -20
            ? "declining"
            : volChange < -5
              ? "decreasing"
              : "stable";
  } catch (err) {
    results.error = String(err);
  }

  // ── Multi-token momentum ranking ──────────────────────────────────────
  // The momentum specialist grades every top-20 token on a simple composite
  // score = weighted blend of 24h + 7d change. Full RSI/MACD are ETH-only
  // (the price-history fetch is expensive); for the broader universe we
  // use the cheap % deltas that come with the coins/markets endpoint.
  try {
    const universe: TokenUniverseEntry[] = await fetchTokenUniverse(20);
    const ranked = universe
      .map((t) => {
        const c24 = t.change24h ?? 0;
        const c7 = t.change7d ?? 0;
        // Composite: short-term (24h) weighted 0.6, medium (7d) weighted 0.4
        const score = c24 * 0.6 + c7 * 0.4;
        return {
          symbol: t.symbol,
          name: t.name,
          rank: t.rank,
          change24h: c24,
          change7d: c7,
          composite_score: Math.round(score * 100) / 100,
          volume24h: t.volume24h,
        };
      })
      .sort((a, b) => b.composite_score - a.composite_score);

    results.universe_top_momentum = ranked.slice(0, 10); // top 10 by composite
    results.universe_weakest = ranked.slice(-5).reverse(); // weakest 5 for SELL candidates
    results.universe_table = formatUniverseForPrompt(universe);
  } catch (err) {
    results.universe_error = String(err);
  }

  return JSON.stringify(results);
}
