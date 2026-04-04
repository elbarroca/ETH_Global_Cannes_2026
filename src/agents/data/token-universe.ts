// Multi-token research universe — EVM-tradeable only.
//
// CRITICAL HONESTY CONSTRAINT
// ───────────────────────────
// The agent's execution path is Uniswap V3 `exactInputSingle` on the chain
// set by `ARC_UNISWAP_ROUTER`. That means every ticker a specialist picks
// MUST be an ERC-20 (or native wrapped native) that:
//   (a) exists on the target execution chain, AND
//   (b) has a liquid Uniswap V3 pool against USDC.
//
// CoinGecko's global top-20 by market cap includes BTC (Bitcoin L1), SOL
// (Solana), ADA (Cardano), XRP (XRPL), TRX (Tron), TON (TON), BCH (Bitcoin
// Cash) — chain-native assets that are NOT EVM and cannot be swapped on any
// EVM chain. Suggesting them to users is a hallucination: the agent
// physically cannot execute those trades. See docs/SYSTEM_STATE_AND_FIXES.md
// Problem 1.
//
// This module maintains an explicit whitelist per execution chain. The
// specialist universe is populated from the whitelist — never from the raw
// CoinGecko top 20. If you add a new chain, extend EVM_TRADEABLE below.

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
  id: string; // CoinGecko id
  symbol: string; // uppercase ERC-20 ticker
  name: string;
  rank: number; // market cap rank at time of fetch
  price: number;
  marketCap: number;
  volume24h: number;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  sentimentUp: number | null;
  /** The chain on which this token is actually tradeable via our swap path. */
  tradableChain: ExecutionChain;
}

export type ExecutionChain = "arc" | "base-sepolia" | "ethereum";

/**
 * Per-chain whitelist of ERC-20 tokens that:
 *   · have a liquid Uniswap V3 pool against USDC on the target chain, AND
 *   · are tradeable via our existing swap execution path.
 *
 * Arc testnet has minimal ecosystem today — realistically only WETH against
 * USDC via MockSwapRouter. When we port to Base Sepolia (see Problem 9 in
 * SYSTEM_STATE_AND_FIXES.md), the base-sepolia list unlocks 10+ real tokens.
 */
export const EVM_TRADEABLE: Record<ExecutionChain, Array<{ symbol: string; cgId: string }>> = {
  arc: [
    // Arc testnet: USDC is native, WETH is the only meaningful swap target
    // via MockSwapRouter. See docs/MOCK_SWAP_ROUTER.md for why.
    { symbol: "WETH", cgId: "ethereum" },
  ],
  "base-sepolia": [
    // Base Sepolia has a real Uniswap V3 deployment with liquid pools for
    // most major ERC-20s. When AGENT_EXECUTION_CHAIN=base-sepolia, the agent
    // can pick from this list. See Problem 9 → migration path.
    { symbol: "WETH", cgId: "ethereum" },
    { symbol: "DAI", cgId: "dai" },
    { symbol: "UNI", cgId: "uniswap" },
    { symbol: "AAVE", cgId: "aave" },
    { symbol: "LINK", cgId: "chainlink" },
    { symbol: "CRV", cgId: "curve-dao-token" },
    { symbol: "COMP", cgId: "compound-governance-token" },
    { symbol: "SNX", cgId: "havven" },
    { symbol: "SUSHI", cgId: "sushi" },
    { symbol: "1INCH", cgId: "1inch" },
    { symbol: "ENS", cgId: "ethereum-name-service" },
    { symbol: "MKR", cgId: "maker" },
    { symbol: "LDO", cgId: "lido-dao" },
    { symbol: "ARB", cgId: "arbitrum" },
    { symbol: "OP", cgId: "optimism" },
  ],
  ethereum: [
    // Mainnet — full ERC-20 universe. Add as needed.
    { symbol: "WETH", cgId: "ethereum" },
    { symbol: "DAI", cgId: "dai" },
    { symbol: "UNI", cgId: "uniswap" },
    { symbol: "AAVE", cgId: "aave" },
    { symbol: "LINK", cgId: "chainlink" },
    { symbol: "CRV", cgId: "curve-dao-token" },
    { symbol: "MKR", cgId: "maker" },
    { symbol: "LDO", cgId: "lido-dao" },
    { symbol: "ENS", cgId: "ethereum-name-service" },
    { symbol: "SHIB", cgId: "shiba-inu" },
    { symbol: "PEPE", cgId: "pepe" },
    { symbol: "APE", cgId: "apecoin" },
  ],
};

function getActiveChain(): ExecutionChain {
  const raw = (process.env.AGENT_EXECUTION_CHAIN ?? "arc").toLowerCase() as ExecutionChain;
  return raw in EVM_TRADEABLE ? raw : "arc";
}

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
 * Fetch the execution-chain whitelist with live CoinGecko prices + % changes.
 *
 * IMPORTANT: never returns a token that isn't in EVM_TRADEABLE for the
 * active chain. If CoinGecko is rate-limited, we fall back to the whitelist
 * with zero prices rather than ever surfacing an off-chain token like ADA.
 *
 * @param limit Upper bound on returned entries. Actual count is min(limit,
 *   whitelist.length).
 */
export async function fetchTokenUniverse(limit = 20): Promise<TokenUniverseEntry[]> {
  const chain = getActiveChain();
  const whitelist = EVM_TRADEABLE[chain];
  const ids = whitelist.map((t) => t.cgId).join(",");
  const perPage = Math.min(limit, whitelist.length);

  try {
    const cg = getCoinGeckoBase();
    const headers = getCoinGeckoHeaders();
    const markets = await cachedFetch<CoinGeckoMarketEntry[]>(
      `${cg}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=false&price_change_percentage=1h,24h,7d`,
      60_000,
      headers,
    );

    if (!Array.isArray(markets)) throw new Error("unexpected markets shape");

    // Map CoinGecko symbols back to whitelist symbols (normalize case).
    const byId = new Map(markets.map((m) => [m.id, m]));
    const result: TokenUniverseEntry[] = [];
    for (const { symbol, cgId } of whitelist) {
      const m = byId.get(cgId);
      if (!m) continue;
      result.push({
        id: cgId,
        symbol, // use whitelist symbol, not CoinGecko's (WETH vs ethereum)
        name: m.name,
        rank: m.market_cap_rank ?? 999,
        price: m.current_price ?? 0,
        marketCap: m.market_cap ?? 0,
        volume24h: m.total_volume ?? 0,
        change1h: m.price_change_percentage_1h_in_currency ?? null,
        change24h: m.price_change_percentage_24h_in_currency ?? null,
        change7d: m.price_change_percentage_7d_in_currency ?? null,
        sentimentUp: null,
        tradableChain: chain,
      });
    }
    return result;
  } catch (err) {
    console.warn(
      `[token-universe] fetch failed, returning whitelist stubs: ${err instanceof Error ? err.message : String(err)}`,
    );
    return whitelist.map<TokenUniverseEntry>(({ symbol, cgId }) => ({
      id: cgId,
      symbol,
      name: symbol,
      rank: 999,
      price: 0,
      marketCap: 0,
      volume24h: 0,
      change1h: 0,
      change24h: 0,
      change7d: 0,
      sentimentUp: null,
      tradableChain: chain,
    }));
  }
}

/**
 * Return the list of tickers the agent is allowed to trade on the current
 * execution chain. Specialists can use this to hard-filter their output —
 * any pick with an asset not in this set should be rejected upstream.
 *
 * ETH is treated as an alias for WETH — the model calls the token "ETH"
 * colloquially even though the on-chain asset is WETH. We accept both.
 */
export function getTradableTickers(): Set<string> {
  const chain = getActiveChain();
  const tickers = new Set(EVM_TRADEABLE[chain].map((t) => t.symbol.toUpperCase()));
  if (tickers.has("WETH")) tickers.add("ETH"); // alias
  return tickers;
}

/**
 * Compress the universe into a single-line-per-token string suitable for
 * dropping into a 7B model prompt. The 7B models malform easily on large
 * JSON; we pre-format a tight tabular view they can reason about.
 */
export function formatUniverseForPrompt(universe: TokenUniverseEntry[]): string {
  if (universe.length === 0) {
    return "  (no tradeable tokens on this execution chain — defaulting to WETH)";
  }
  const header = `  EVM-tradeable tokens on ${universe[0].tradableChain}:`;
  const cols = "  symbol    price         24h%    7d%     volume24h";
  const rows = universe.slice(0, 20).map((t) => {
    const price = t.price >= 1 ? t.price.toFixed(2) : t.price.toFixed(5);
    const c24 = t.change24h != null ? `${t.change24h.toFixed(1)}%` : "—";
    const c7 = t.change7d != null ? `${t.change7d.toFixed(1)}%` : "—";
    const volM = (t.volume24h / 1e6).toFixed(0);
    return `  ${t.symbol.padEnd(8)}  $${price.padStart(10)}  ${c24.padStart(6)}  ${c7.padStart(6)}  $${volM.padStart(6)}M`;
  });
  return [header, cols, ...rows].join("\n");
}
