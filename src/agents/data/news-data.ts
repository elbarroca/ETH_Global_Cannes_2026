// Fetches REAL crypto news sentiment — CryptoPanic API

import { cachedFetch } from "./cached-fetch";
import { injectUniverseInto } from "./universe-injector";

interface CryptoPanicPost {
  kind: string;
  title: string;
  published_at: string;
  url: string;
  source: { title: string };
  votes: {
    positive: number;
    negative: number;
    important: number;
    liked: number;
    disliked: number;
    lol: number;
    toxic: number;
    saved: number;
  };
}

interface CryptoPanicResponse {
  count: number;
  results: CryptoPanicPost[];
}

export async function fetchNewsData(): Promise<string> {
  const results: Record<string, unknown> = { fetched_at: new Date().toISOString() };
  const apiKey = process.env.CRYPTOPANIC_API_KEY;

  if (!apiKey) {
    // Fallback — no CryptoPanic API key configured
    results.bullish_count = 12;
    results.bearish_count = 5;
    results.total_news = 25;
    results.breaking_headlines = [
      "Bitcoin ETF sees record inflows as institutional demand surges",
      "Ethereum L2 TVL hits new all-time high",
      "SEC signals clearer crypto regulatory framework",
      "AI agent tokens rally 40% on new partnerships",
      "DeFi protocol hack leads to $15M loss — users warned",
    ];
    results.source = "mock";
    return JSON.stringify(results);
  }

  try {
    const url = `https://cryptopanic.com/api/free/v1/posts/?auth_token=${apiKey}&kind=news&filter=hot&currencies=BTC,ETH`;
    const data = await cachedFetch<CryptoPanicResponse>(url, 120_000);
    const posts = data.results ?? [];

    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;

    for (const post of posts) {
      const positive = post.votes.positive + post.votes.liked;
      const negative = post.votes.negative + post.votes.disliked + post.votes.toxic;
      if (positive > negative) {
        bullishCount++;
      } else if (negative > positive) {
        bearishCount++;
      } else {
        neutralCount++;
      }
    }

    results.bullish_count = bullishCount;
    results.bearish_count = bearishCount;
    results.neutral_count = neutralCount;
    results.total_news = posts.length;
    results.breaking_headlines = posts.slice(0, 5).map((p) => p.title);
    results.top_sources = [...new Set(posts.slice(0, 10).map((p) => p.source.title))].slice(0, 5);
    results.source = "cryptopanic_api";
  } catch {
    results.bullish_count = 12;
    results.bearish_count = 5;
    results.total_news = 25;
    results.breaking_headlines = [
      "Bitcoin ETF sees record inflows as institutional demand surges",
      "Ethereum L2 TVL hits new all-time high",
      "SEC signals clearer crypto regulatory framework",
      "AI agent tokens rally 40% on new partnerships",
      "DeFi protocol hack leads to $15M loss — users warned",
    ];
    results.source = "mock";
  }

  // EVM universe for picks — news-scanner maps headlines to tradeable tickers.
  await injectUniverseInto(results);

  return JSON.stringify(results);
}
