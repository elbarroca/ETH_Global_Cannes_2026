// Multi-token research universe.
//
// Every specialist currently fetches ETH-specific data. To let agents research
// and pick from a broader token set, this module exposes a shared "universe"
// fetcher that returns the top N tokens by market cap with the common metrics
// (price, 24h/7d change, volume, sentiment votes, trending status).
//
// Each specialist then layers its own domain lens over this universe:
//   · sentiment     → uses votes + trending + F&G
//   · momentum      → uses 1h/24h/7d change + ranks
//   · news-scanner  → cross-references with per-token news
//   · whale         → uses volume + market cap flow
//
// The universe is cached with a 60s TTL because CoinGecko rate-limits at
// 10 calls/minute on the free tier — fetching it per specialist would burn
// the rate limit in one cycle.

import { cachedFetch } from "./cached-fetch";

function getCoinGeckoBase(): string {
  return process.env.COINGECKO_API_URL ?? "https://api.coingecko.com/api/v3";
}

function getCoinGeckoHeaders(): Record<string, string> | undefined {
  const key = process.env.COINGECKO_API_KEY;
  if (!key) return undefined;
  const header = key.startsWith("CG-") ? "x-cg-pro-api-key" : "x-cg-demo-api-key";
  return { [header]: key };
}

export interface TokenUniverseEntry {
  id: string; // CoinGecko id — e.g. "ethereum"
  symbol: string; // uppercase ticker — e.g. "ETH"
  name: string; // human name — e.g. "Ethereum"
  rank: number; // market cap rank (1 = BTC)
  price: number; // current USD price
  marketCap: number; // market cap USD
  volume24h: number; // 24h volume USD
  change1h: number | null; // %
  change24h: number | null; // %
  change7d: number | null; // %
  sentimentUp: number | null; // % of CoinGecko community votes that are bullish
}

const EXCLUDED_SYMBOLS = new Set(["USDT", "USDC", "DAI", "TUSD", "USDP", "FDUSD", "USDD", "PYUSD", "WBTC", "WETH", "STETH", "WSTETH"]);

interface CoinGeckoMarketEntry {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank: number | null;
  current_price: number | null;
  market_cap: number | null;
  total_volume: number | null;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
}

/**
 * Fetch the top `limit` tokens by market cap from CoinGecko, filtered to
 * exclude stablecoins and wrapped/pegged assets (which aren't useful
 * investment targets for the swap layer).
 *
 * Returns up to `limit` entries. Falls back to a small hardcoded list on
 * rate-limit errors so specialists don't cascade-fail when CoinGecko is
 * unhappy.
 */
export async function fetchTokenUniverse(limit = 20): Promise<TokenUniverseEntry[]> {
  const cg = getCoinGeckoBase();
  const headers = getCoinGeckoHeaders();
  // Overfetch so we still have `limit` entries after filtering stablecoins out.
  const perPage = Math.min(limit + 15, 100);

  try {
    const markets = await cachedFetch<CoinGeckoMarketEntry[]>(
      `${cg}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=false&price_change_percentage=1h,24h,7d`,
      60_000,
      headers,
    );

    if (!Array.isArray(markets)) throw new Error("unexpected markets shape");

    const filtered = markets
      .filter((m) => !EXCLUDED_SYMBOLS.has(m.symbol.toUpperCase()))
      .filter((m) => m.current_price != null && m.market_cap != null)
      .slice(0, limit);

    return filtered.map<TokenUniverseEntry>((m) => ({
      id: m.id,
      symbol: m.symbol.toUpperCase(),
      name: m.name,
      rank: m.market_cap_rank ?? 999,
      price: m.current_price ?? 0,
      marketCap: m.market_cap ?? 0,
      volume24h: m.total_volume ?? 0,
      change1h: m.price_change_percentage_1h_in_currency ?? null,
      change24h: m.price_change_percentage_24h_in_currency ?? null,
      change7d: m.price_change_percentage_7d_in_currency ?? null,
      sentimentUp: null, // per-coin sentiment requires a separate API call; left null here
    }));
  } catch (err) {
    console.warn(`[token-universe] fetch failed, returning seed list: ${err instanceof Error ? err.message : String(err)}`);
    // Seed fallback so the pipeline doesn't break. These are deliberately
    // static; if the fetch recovers next cycle, real data resumes.
    return [
      { id: "bitcoin", symbol: "BTC", name: "Bitcoin", rank: 1, price: 95000, marketCap: 1900e9, volume24h: 40e9, change1h: 0, change24h: 1, change7d: 3, sentimentUp: null },
      { id: "ethereum", symbol: "ETH", name: "Ethereum", rank: 2, price: 3200, marketCap: 385e9, volume24h: 15e9, change1h: 0, change24h: 0.5, change7d: 2, sentimentUp: null },
      { id: "solana", symbol: "SOL", name: "Solana", rank: 5, price: 145, marketCap: 65e9, volume24h: 3e9, change1h: 0, change24h: 2, change7d: 5, sentimentUp: null },
      { id: "chainlink", symbol: "LINK", name: "Chainlink", rank: 13, price: 14, marketCap: 9e9, volume24h: 400e6, change1h: 0, change24h: 1.5, change7d: 4, sentimentUp: null },
      { id: "uniswap", symbol: "UNI", name: "Uniswap", rank: 22, price: 8, marketCap: 4.5e9, volume24h: 150e6, change1h: 0, change24h: 0.8, change7d: 1.5, sentimentUp: null },
    ];
  }
}

/**
 * Compress the universe into a single-line-per-token string suitable for
 * dropping into a 7B model prompt. The 7B models malform easily on large
 * JSON, so we pre-format a tight tabular view they can reason about.
 */
export function formatUniverseForPrompt(universe: TokenUniverseEntry[]): string {
  const header = "  rank  symbol  price      24h%    7d%    volume24h";
  const rows = universe.slice(0, 20).map((t) => {
    const price = t.price >= 1 ? t.price.toFixed(2) : t.price.toFixed(5);
    const c24 = t.change24h != null ? `${t.change24h.toFixed(1)}%` : "—";
    const c7 = t.change7d != null ? `${t.change7d.toFixed(1)}%` : "—";
    const volM = (t.volume24h / 1e6).toFixed(0);
    return `  #${String(t.rank).padStart(3)}  ${t.symbol.padEnd(6)}  $${price.padStart(9)}  ${c24.padStart(6)}  ${c7.padStart(6)}  $${volM.padStart(6)}M`;
  });
  return [header, ...rows].join("\n");
}
