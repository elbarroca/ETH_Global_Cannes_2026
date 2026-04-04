// Shared helper: inject the EVM-tradeable token universe into any specialist's
// data snapshot so it can reason across tradeable tickers instead of only ETH.
//
// Every specialist (whale, twitter, defi, news, forensics, options, macro,
// memecoin) now needs to emit picks[] drawn from the universe. Rather than
// copy/paste the same 10 lines of fetch+format into each data fetcher, they
// all call `injectUniverseInto(results)` at the end of their fetch function.

import { fetchTokenUniverse, formatUniverseForPrompt } from "./token-universe";

/**
 * Fetch the current EVM-tradeable token universe and add two keys to the
 * given results object:
 *   · `universe`       — array of { symbol, name, rank, change24h, change7d }
 *   · `universe_table` — single-line-per-token string for the 7B prompt
 *
 * Non-fatal: if CoinGecko is down, writes an empty array and logs a warning.
 * Safe to call on the hot path — `fetchTokenUniverse` has its own 60s cache.
 */
export async function injectUniverseInto(
  results: Record<string, unknown>,
  limit = 20,
): Promise<void> {
  try {
    const universe = await fetchTokenUniverse(limit);
    results.universe = universe.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      rank: t.rank,
      change24h: t.change24h,
      change7d: t.change7d,
    }));
    results.universe_table = formatUniverseForPrompt(universe);
  } catch (err) {
    console.warn(
      "[universe-injector] fetch failed, falling back to empty universe:",
      err instanceof Error ? err.message : String(err),
    );
    results.universe = [];
    results.universe_table = "(universe unavailable — default to WETH)";
  }
}
