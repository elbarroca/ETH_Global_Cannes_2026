// Fetches REAL crypto Twitter sentiment — Twitter API v2 recent search

import { cachedFetch } from "./cached-fetch";

const TWITTER_SEARCH_URL = "https://api.twitter.com/2/tweets/search/recent";

interface TweetPublicMetrics {
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
}

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics: TweetPublicMetrics;
}

interface TwitterResponse {
  data?: Tweet[];
  meta?: { result_count: number };
}

const BULLISH_KEYWORDS = ["bullish", "moon", "pump", "ath", "breakout", "rally", "buy", "long", "accumulate"];
const BEARISH_KEYWORDS = ["bearish", "dump", "crash", "rug", "sell", "short", "capitulation", "fear"];

export async function fetchTwitterData(): Promise<string> {
  const results: Record<string, unknown> = { fetched_at: new Date().toISOString() };
  const token = process.env.TWITTER_BEARER_TOKEN;

  if (!token) {
    // Fallback — no Twitter API key configured
    results.crypto_sentiment_score = 65;
    results.trending_topics = "AI agents, memecoins, ETH ETF flows";
    results.tweet_count = 0;
    results.avg_engagement = 0;
    results.influencer_consensus = "cautiously bullish";
    results.source = "mock";
    return JSON.stringify(results);
  }

  try {
    const query = encodeURIComponent("#crypto OR $BTC OR $ETH");
    const url = `${TWITTER_SEARCH_URL}?query=${query}&max_results=100&tweet.fields=public_metrics,created_at`;
    const headers = { Authorization: `Bearer ${token}` };

    const data = await cachedFetch<TwitterResponse>(url, 120_000, headers);
    const tweets = data.data ?? [];
    const count = tweets.length;

    // Compute engagement metrics
    let totalEngagement = 0;
    let bullishCount = 0;
    let bearishCount = 0;

    for (const tweet of tweets) {
      const metrics = tweet.public_metrics;
      totalEngagement += metrics.like_count + metrics.retweet_count + metrics.reply_count + metrics.quote_count;

      const text = tweet.text.toLowerCase();
      if (BULLISH_KEYWORDS.some((kw) => text.includes(kw))) bullishCount++;
      if (BEARISH_KEYWORDS.some((kw) => text.includes(kw))) bearishCount++;
    }

    const avgEngagement = count > 0 ? Math.round(totalEngagement / count) : 0;
    const totalSentiment = bullishCount + bearishCount;
    const sentimentScore = totalSentiment > 0
      ? Math.round((bullishCount / totalSentiment) * 100)
      : 50;

    results.crypto_sentiment_score = sentimentScore;
    results.trending_topics = "crypto, BTC, ETH";
    results.tweet_count = count;
    results.avg_engagement = avgEngagement;
    results.bullish_mentions = bullishCount;
    results.bearish_mentions = bearishCount;
    results.influencer_consensus = sentimentScore > 65
      ? "bullish"
      : sentimentScore > 45
        ? "cautiously bullish"
        : sentimentScore > 30
          ? "cautiously bearish"
          : "bearish";
    results.source = "twitter_api_v2";
  } catch {
    results.crypto_sentiment_score = 65;
    results.trending_topics = "AI agents, memecoins, ETH ETF flows";
    results.tweet_count = 0;
    results.avg_engagement = 0;
    results.influencer_consensus = "cautiously bullish";
    results.source = "mock";
  }

  return JSON.stringify(results);
}
