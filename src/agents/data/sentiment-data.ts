// Fetches REAL sentiment data — CoinGecko + Fear & Greed Index + multi-token universe

import { cachedFetch } from "./cached-fetch";
import { fetchTokenUniverse, formatUniverseForPrompt } from "./token-universe";

function getCoinGeckoBase(): string {
  return process.env.COINGECKO_API_URL ?? "https://api.coingecko.com/api/v3";
}

function getCoinGeckoHeaders(): Record<string, string> | undefined {
  const key = process.env.COINGECKO_API_KEY;
  if (!key) return undefined;
  // Pro keys start with "CG-", demo keys are shorter
  const header = key.startsWith("CG-") ? "x-cg-pro-api-key" : "x-cg-demo-api-key";
  return { [header]: key };
}

export async function fetchSentimentData(): Promise<string> {
  const cg = getCoinGeckoBase();
  const headers = getCoinGeckoHeaders();
  const fngUrl = process.env.FNG_API_URL ?? "https://api.alternative.me/fng/?limit=1";
  const results: Record<string, unknown> = { fetched_at: new Date().toISOString() };

  // ETH market data + community sentiment
  try {
    const eth = await cachedFetch<Record<string, unknown>>(
      `${cg}/coins/ethereum?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false`,
      60_000,
      headers,
    );
    const md = eth.market_data as Record<string, unknown> | undefined;
    const cp = md?.current_price as Record<string, number> | undefined;
    results.eth_price = cp?.usd;
    results.eth_24h_change = md?.price_change_percentage_24h;
    results.eth_7d_change = md?.price_change_percentage_7d;
    results.eth_market_cap_rank = eth.market_cap_rank;
    results.eth_sentiment_up = eth.sentiment_votes_up_percentage;
    results.eth_sentiment_down = eth.sentiment_votes_down_percentage;
  } catch (err) {
    results.eth_error = String(err);
  }

  // Fear & Greed Index
  try {
    const fng = await cachedFetch<{ data: Array<{ value: string; value_classification: string }> }>(fngUrl);
    results.fear_greed_value = Number(fng.data?.[0]?.value ?? 50);
    results.fear_greed_label = fng.data?.[0]?.value_classification ?? "neutral";
  } catch {
    results.fear_greed_value = 50;
    results.fear_greed_label = "unavailable";
  }

  // Trending coins (market attention signal)
  try {
    const trending = await cachedFetch<{
      coins: Array<{ item: { name: string; symbol: string; market_cap_rank: number } }>;
    }>(`${cg}/search/trending`, 60_000, headers);
    results.trending_coins = trending.coins?.slice(0, 5).map((c) => ({
      name: c.item.name,
      symbol: c.item.symbol,
      rank: c.item.market_cap_rank,
    }));
  } catch {
    results.trending_coins = [];
  }

  // ── Multi-token research universe ────────────────────────────────────
  // The sentiment specialist is no longer ETH-only. We attach the top 20
  // tokens by market cap so the prompt can cross-reference Fear & Greed +
  // trending status + price action across the whole set and pick the 2-3
  // most promising candidates. This is the foundation of "specialists pick
  // any token" — each specialist will layer its own lens over this universe.
  try {
    const universe = await fetchTokenUniverse(20);
    const trendingSymbols = new Set(
      (results.trending_coins as Array<{ symbol: string }> | undefined ?? []).map((t) => t.symbol.toUpperCase()),
    );
    results.universe = universe.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      rank: t.rank,
      change24h: t.change24h,
      change7d: t.change7d,
      is_trending: trendingSymbols.has(t.symbol),
    }));
    results.universe_table = formatUniverseForPrompt(universe);
  } catch (err) {
    results.universe_error = String(err);
    results.universe = [];
  }

  return JSON.stringify(results);
}
