import type { McpBindingV1 } from "./types";
import {
  MCP_MAX_RESPONSE_BYTES,
  McpContextError,
  type McpContextProvider,
} from "./mcp-context";

const DEFAULT_COINGECKO_URL = "https://api.coingecko.com/api/v3";
const DEFAULT_COIN_ID = "ethereum";
const DEFAULT_CURRENCY = "usd";

type Fetch = typeof fetch;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function baseUrl(source: Record<string, string | undefined>): URL {
  try {
    const url = new URL(source.COINGECKO_API_URL ?? DEFAULT_COINGECKO_URL);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error();
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    return url;
  } catch {
    throw new McpContextError("GOAL_MCP_CONTEXT_UNAVAILABLE");
  }
}

function headers(source: Record<string, string | undefined>): HeadersInit | undefined {
  const key = source.COINGECKO_API_KEY;
  if (!key) return undefined;
  return { [key.startsWith("CG-") ? "x-cg-pro-api-key" : "x-cg-demo-api-key"]: key };
}

function missing(binding: McpBindingV1, now: Date): unknown {
  const required = binding.provider === "the-graph"
    ? ["deploymentId", "chain", "contractAddress", "boundedQuery"]
    : ["network", "address", "poolAddress", "timeframe"];
  return {
    provider: binding.provider,
    capability: binding.capability,
    source: "unavailable:typed-input-required",
    fetchedAt: now.toISOString(),
    params: {},
    data: null,
    missingInputs: required,
  };
}

export function createProductionMcpProvider(
  source: Record<string, string | undefined> = process.env,
  dependencies: { fetch?: Fetch; now?: () => Date } = {},
): McpContextProvider {
  const coinGeckoBase = baseUrl(source);
  const requestHeaders = headers(source);
  const fetchImpl = dependencies.fetch ?? fetch;
  const clock = dependencies.now ?? (() => new Date());

  async function fetchJson(path: string, signal: AbortSignal): Promise<{
    source: string;
    value: unknown;
  }> {
    const url = new URL(path, coinGeckoBase);
    let response: Response;
    try {
      response = await fetchImpl(url, { headers: requestHeaders, signal });
    } catch {
      throw new McpContextError("GOAL_MCP_PROVIDER_FAILED");
    }
    if (!response.ok) throw new McpContextError("GOAL_MCP_PROVIDER_FAILED");
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MCP_MAX_RESPONSE_BYTES) {
      throw new McpContextError("GOAL_MCP_RESPONSE_TOO_LARGE");
    }
    try {
      return { source: `${url.origin}${url.pathname}`, value: JSON.parse(text) as unknown };
    } catch {
      throw new McpContextError("GOAL_MCP_PROVIDER_FAILED");
    }
  }

  return {
    invoke: async (binding, _request, signal) => {
      const now = clock();
      if (binding.provider !== "coingecko") return missing(binding, now);
      if (binding.capability === "spot-price") {
        const response = await fetchJson(
          `simple/price?ids=${DEFAULT_COIN_ID}&vs_currencies=${DEFAULT_CURRENCY}` +
          "&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true" +
          "&include_last_updated_at=true",
          signal,
        );
        const ethereum = record(record(response.value)?.ethereum);
        if (!ethereum) throw new McpContextError("GOAL_MCP_PROVIDER_FAILED");
        return {
          provider: binding.provider,
          capability: binding.capability,
          source: response.source,
          fetchedAt: now.toISOString(),
          params: { coinId: DEFAULT_COIN_ID, currency: DEFAULT_CURRENCY },
          data: {
            price: numberOrNull(ethereum.usd),
            marketCap: numberOrNull(ethereum.usd_market_cap),
            volume24h: numberOrNull(ethereum.usd_24h_vol),
            change24hPercent: numberOrNull(ethereum.usd_24h_change),
            lastUpdatedAt: numberOrNull(ethereum.last_updated_at),
          },
          missingInputs: [],
        };
      }
      if (binding.capability === "market-snapshot") {
        const response = await fetchJson(
          `coins/markets?vs_currency=${DEFAULT_CURRENCY}&ids=${DEFAULT_COIN_ID}` +
          "&price_change_percentage=1h,24h,7d&per_page=1&page=1&sparkline=false",
          signal,
        );
        const market = Array.isArray(response.value) ? record(response.value[0]) : null;
        if (!market) throw new McpContextError("GOAL_MCP_PROVIDER_FAILED");
        return {
          provider: binding.provider,
          capability: binding.capability,
          source: response.source,
          fetchedAt: now.toISOString(),
          params: { coinId: DEFAULT_COIN_ID, currency: DEFAULT_CURRENCY },
          data: {
            price: numberOrNull(market.current_price),
            marketCap: numberOrNull(market.market_cap),
            volume24h: numberOrNull(market.total_volume),
            change1hPercent: numberOrNull(market.price_change_percentage_1h_in_currency),
            change24hPercent: numberOrNull(market.price_change_percentage_24h_in_currency),
            change7dPercent: numberOrNull(market.price_change_percentage_7d_in_currency),
            lastUpdated: typeof market.last_updated === "string" ? market.last_updated : null,
          },
          missingInputs: [],
        };
      }
      if (binding.capability === "trending") {
        const response = await fetchJson("search/trending", signal);
        const coins = record(response.value)?.coins;
        const data = Array.isArray(coins) ? coins.slice(0, 10).map((entry) => {
          const item = record(record(entry)?.item);
          return {
            id: typeof item?.id === "string" ? item.id : null,
            name: typeof item?.name === "string" ? item.name : null,
            symbol: typeof item?.symbol === "string" ? item.symbol : null,
            marketCapRank: numberOrNull(item?.market_cap_rank),
          };
        }) : [];
        return {
          provider: binding.provider,
          capability: binding.capability,
          source: response.source,
          fetchedAt: now.toISOString(),
          params: {},
          data,
          missingInputs: [],
        };
      }
      return missing(binding, now);
    },
  };
}
