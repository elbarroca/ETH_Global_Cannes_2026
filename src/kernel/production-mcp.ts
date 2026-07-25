import type { McpBindingV1 } from "./types";
import {
  MCP_MAX_RESPONSE_BYTES,
  McpContextError,
  type McpContextProvider,
} from "./mcp-context";

const DEFAULT_COINGECKO_URL = "https://api.coingecko.com/api/v3";
const DEFAULT_COIN_ID = "ethereum";
const DEFAULT_CURRENCY = "usd";
const THE_GRAPH_GATEWAY = "https://gateway.thegraph.com/api/subgraphs/id/";
const THE_GRAPH_PRIMARY_ID = "8e4dRt4P4WHXnKbEq7STaQfU2g99WZ5S4w39f2PcUTjD";
const THE_GRAPH_FALLBACK_ID = "AXJd5my1nV3MMeoX2FPoxnE7hqqDHiSYEazARyd4xLMj";
const THE_GRAPH_KEY = /^[A-Za-z0-9_-]{8,128}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const BLOCK_HASH = /^0x[0-9a-fA-F]{64}$/;
const INTEGER = /^(?:0|[1-9][0-9]*)$/;
const DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const SYMBOL = /^[A-Za-z0-9.$+_-]{1,32}$/;
const DEPLOYMENT = /^[A-Za-z0-9]{20,128}$/;
const SENSITIVE_KEY = /(?:authorization|cookie|credential|secret|password|session|signature|link.?code|api.?key|private.?key|email|phone)/i;
const SENSITIVE_VALUE = /(?:\bBearer\s+|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:session|signature|link.?code|api.?key)\s*[:=])/i;

const LOOKUP_DOCUMENT = `query PinnedDeploymentLookup {
  _meta { deployment hasIndexingErrors block { number hash } }
}`;

const PRIMARY_SNAPSHOT_DOCUMENT = `query LiquidityVolumeSnapshot {
  _meta { deployment hasIndexingErrors block { number hash } }
  bundles(first: 1) { id ethPriceUSD }
  factories(first: 1) {
    id poolCount txCount totalVolumeUSD totalFeesUSD totalValueLockedUSD totalValueLockedETH
  }
  pools(first: 5, orderBy: totalValueLockedUSD, orderDirection: desc) {
    id token0 { id symbol } token1 { id symbol } feeTier totalValueLockedUSD volumeUSD feesUSD liquidity txCount
  }
}`;

const FALLBACK_SNAPSHOT_DOCUMENT = `query LiquidityVolumeSnapshot {
  _meta { deployment hasIndexingErrors block { number hash } }
  bundles(first: 1) { id ethPriceUSD }
  factories(first: 1) {
    id poolCount txCount totalVolumeUSD totalFeesUSD totalValueLockedUSD totalValueLockedETH
  }
  pools(first: 5, orderBy: totalValueLockedUSD, orderDirection: desc) {
    id token0 { id symbol } token1 { id symbol } feeTier: fee totalValueLockedUSD volumeUSD feesUSD: totalFeesUSD liquidity txCount
  }
}`;

type Fetch = typeof fetch;
type GraphCapability = "pinned-deployment-lookup" | "liquidity-volume-snapshot";

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

function graphKey(source: Record<string, string | undefined>): string | null {
  const key = source.THE_GRAPH_API_KEY;
  return key && THE_GRAPH_KEY.test(key) ? key : null;
}

export function theGraphProviderAvailability(
  source: Record<string, string | undefined> = process.env,
): "CONFIGURED" | "UNAVAILABLE" {
  return graphKey(source) ? "CONFIGURED" : "UNAVAILABLE";
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

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error("GRAPH_SCHEMA_INVALID");
  }
}

function assertSafePayload(value: unknown, depth = 0): void {
  if (depth > 6) throw new Error("GRAPH_PAYLOAD_UNSAFE");
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("GRAPH_PAYLOAD_UNSAFE");
    return;
  }
  if (typeof value === "string") {
    if (value.length > 4_096 || SENSITIVE_VALUE.test(value)) throw new Error("GRAPH_PAYLOAD_UNSAFE");
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 16) throw new Error("GRAPH_PAYLOAD_UNSAFE");
    for (const entry of value) assertSafePayload(entry, depth + 1);
    return;
  }
  const object = record(value);
  if (!object || Object.keys(object).length > 32) throw new Error("GRAPH_PAYLOAD_UNSAFE");
  for (const [key, entry] of Object.entries(object)) {
    if (key.length < 1 || key.length > 64 || SENSITIVE_KEY.test(key)) {
      throw new Error("GRAPH_PAYLOAD_UNSAFE");
    }
    assertSafePayload(entry, depth + 1);
  }
}

function integer(value: unknown): string {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("GRAPH_INTEGER_INVALID");
    return String(value);
  }
  if (typeof value !== "string" || value.length > 78 || !INTEGER.test(value)) {
    throw new Error("GRAPH_INTEGER_INVALID");
  }
  return value;
}

function decimal(value: unknown): string {
  if (typeof value !== "string" || value.length > 128 || !DECIMAL.test(value)) {
    throw new Error("GRAPH_DECIMAL_INVALID");
  }
  const [rawInteger = "0", rawFraction = ""] = value.split(".");
  const whole = rawInteger.replace(/^0+(?=[0-9])/, "");
  const fraction = rawFraction.replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function address(value: unknown): string {
  if (typeof value !== "string" || !ADDRESS.test(value)) throw new Error("GRAPH_ADDRESS_INVALID");
  return value.toLowerCase();
}

function symbol(value: unknown): string {
  if (typeof value !== "string" || !SYMBOL.test(value)) throw new Error("GRAPH_SYMBOL_INVALID");
  return value;
}

function compareDecimals(left: string, right: string): number {
  const [leftWhole = "0", leftFraction = ""] = left.split(".");
  const [rightWhole = "0", rightFraction = ""] = right.split(".");
  if (leftWhole.length !== rightWhole.length) return leftWhole.length > rightWhole.length ? 1 : -1;
  if (leftWhole !== rightWhole) return leftWhole > rightWhole ? 1 : -1;
  const length = Math.max(leftFraction.length, rightFraction.length);
  const leftPadded = leftFraction.padEnd(length, "0");
  const rightPadded = rightFraction.padEnd(length, "0");
  return leftPadded === rightPadded ? 0 : leftPadded > rightPadded ? 1 : -1;
}

function metadata(value: unknown, subgraphId: string, completedAt: Date) {
  const meta = record(value);
  if (!meta) throw new Error("GRAPH_METADATA_INVALID");
  exactKeys(meta, ["deployment", "hasIndexingErrors", "block"]);
  if (meta.hasIndexingErrors !== false || typeof meta.deployment !== "string" ||
    !DEPLOYMENT.test(meta.deployment)) {
    throw new Error("GRAPH_METADATA_INVALID");
  }
  const block = record(meta.block);
  if (!block) throw new Error("GRAPH_METADATA_INVALID");
  exactKeys(block, ["number", "hash"]);
  const blockNumber = integer(block.number);
  if (blockNumber === "0" || typeof block.hash !== "string" || !BLOCK_HASH.test(block.hash) ||
    /^0x0{64}$/i.test(block.hash)) {
    throw new Error("GRAPH_METADATA_INVALID");
  }
  if (!Number.isFinite(completedAt.getTime())) throw new Error("GRAPH_METADATA_INVALID");
  return {
    subgraphId,
    deploymentId: meta.deployment,
    network: "mainnet" as const,
    blockNumber,
    blockHash: block.hash.toLowerCase(),
    completedAt: completedAt.toISOString(),
  };
}

function token(value: unknown) {
  const item = record(value);
  if (!item) throw new Error("GRAPH_TOKEN_INVALID");
  exactKeys(item, ["id", "symbol"]);
  return { id: address(item.id), symbol: symbol(item.symbol) };
}

function normalizeGraphResponse(
  value: unknown,
  capability: GraphCapability,
  subgraphId: string,
  completedAt: Date,
): unknown {
  assertSafePayload(value);
  const root = record(value);
  if (!root || Object.hasOwn(root, "errors")) throw new Error("GRAPH_RESPONSE_INVALID");
  exactKeys(root, ["data"]);
  const data = record(root.data);
  if (!data) throw new Error("GRAPH_RESPONSE_INVALID");
  if (capability === "pinned-deployment-lookup") {
    exactKeys(data, ["_meta"]);
    return { sourceMetadata: metadata(data._meta, subgraphId, completedAt) };
  }
  exactKeys(data, ["_meta", "bundles", "factories", "pools"]);
  if (!Array.isArray(data.bundles) || data.bundles.length !== 1 ||
    !Array.isArray(data.factories) || data.factories.length !== 1 ||
    !Array.isArray(data.pools) || data.pools.length !== 5) {
    throw new Error("GRAPH_RESPONSE_INVALID");
  }
  const rawBundle = record(data.bundles[0]);
  const rawFactory = record(data.factories[0]);
  if (!rawBundle || !rawFactory) throw new Error("GRAPH_RESPONSE_INVALID");
  exactKeys(rawBundle, ["id", "ethPriceUSD"]);
  exactKeys(rawFactory, [
    "id", "poolCount", "txCount", "totalVolumeUSD", "totalFeesUSD",
    "totalValueLockedUSD", "totalValueLockedETH",
  ]);
  const bundle = { id: integer(rawBundle.id), ethPriceUSD: decimal(rawBundle.ethPriceUSD) };
  const factory = {
    id: address(rawFactory.id),
    poolCount: integer(rawFactory.poolCount),
    txCount: integer(rawFactory.txCount),
    totalVolumeUSD: decimal(rawFactory.totalVolumeUSD),
    totalFeesUSD: decimal(rawFactory.totalFeesUSD),
    totalValueLockedUSD: decimal(rawFactory.totalValueLockedUSD),
    totalValueLockedETH: decimal(rawFactory.totalValueLockedETH),
  };
  const pools = data.pools.map((entry) => {
    const pool = record(entry);
    if (!pool) throw new Error("GRAPH_POOL_INVALID");
    exactKeys(pool, [
      "id", "token0", "token1", "feeTier", "totalValueLockedUSD", "volumeUSD",
      "feesUSD", "liquidity", "txCount",
    ]);
    const token0 = token(pool.token0);
    const token1 = token(pool.token1);
    if (token0.id === token1.id) throw new Error("GRAPH_POOL_INVALID");
    return {
      id: address(pool.id),
      token0,
      token1,
      feeTier: integer(pool.feeTier),
      totalValueLockedUSD: decimal(pool.totalValueLockedUSD),
      volumeUSD: decimal(pool.volumeUSD),
      feesUSD: decimal(pool.feesUSD),
      liquidity: integer(pool.liquidity),
      txCount: integer(pool.txCount),
    };
  });
  if (new Set(pools.map((pool) => pool.id)).size !== pools.length) {
    throw new Error("GRAPH_POOL_DUPLICATE");
  }
  for (let index = 1; index < pools.length; index += 1) {
    if (compareDecimals(pools[index - 1]!.totalValueLockedUSD, pools[index]!.totalValueLockedUSD) < 0) {
      throw new Error("GRAPH_POOL_ORDER_INVALID");
    }
  }
  return {
    sourceMetadata: metadata(data._meta, subgraphId, completedAt),
    bundle,
    factory,
    pools,
  };
}

async function boundedText(response: Response): Promise<string> {
  const declared = response.headers.get("content-length");
  if (declared !== null && (!INTEGER.test(declared) || Number(declared) > MCP_MAX_RESPONSE_BYTES)) {
    throw new Error("GRAPH_RESPONSE_TOO_LARGE");
  }
  if (!response.body) throw new Error("GRAPH_RESPONSE_MALFORMED");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MCP_MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("GRAPH_RESPONSE_TOO_LARGE");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function assertFixedRequest(binding: McpBindingV1, request: Readonly<{
  schemaVersion: 1;
  objective: string;
  requiredCapabilities: readonly string[];
}>): GraphCapability {
  exactKeys(binding, ["schemaVersion", "id", "provider", "capability", "access", "timeoutMs", "maxResponseBytes"]);
  exactKeys(request as Record<string, unknown>, ["schemaVersion", "objective", "requiredCapabilities"]);
  if (binding.provider !== "the-graph" ||
    (binding.capability !== "pinned-deployment-lookup" &&
      binding.capability !== "liquidity-volume-snapshot") ||
    binding.id !== `mcp.the-graph.${binding.capability}` || binding.schemaVersion !== 1 ||
    binding.access !== "read-only" || binding.timeoutMs !== 8_000 ||
    binding.maxResponseBytes !== MCP_MAX_RESPONSE_BYTES || request.schemaVersion !== 1 ||
    typeof request.objective !== "string" || !Array.isArray(request.requiredCapabilities)) {
    throw new McpContextError("GOAL_MCP_BINDING_UNALLOWLISTED");
  }
  return binding.capability;
}

export function createProductionMcpProvider(
  source: Record<string, string | undefined> = process.env,
  dependencies: { fetch?: Fetch; now?: () => Date } = {},
): McpContextProvider {
  const coinGeckoBase = baseUrl(source);
  const requestHeaders = headers(source);
  const fetchImpl = dependencies.fetch ?? fetch;
  const clock = dependencies.now ?? (() => new Date());

  async function fetchCoinGeckoJson(path: string, signal: AbortSignal): Promise<{
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

  async function fetchGraph(
    binding: McpBindingV1,
    request: Readonly<{ schemaVersion: 1; objective: string; requiredCapabilities: readonly string[] }>,
    signal: AbortSignal,
  ): Promise<unknown> {
    const capability = assertFixedRequest(binding, request);
    const key = graphKey(source);
    if (!key) throw new McpContextError("GOAL_MCP_CONTEXT_UNAVAILABLE");
    const attempts = [THE_GRAPH_PRIMARY_ID, THE_GRAPH_FALLBACK_ID] as const;
    for (let index = 0; index < attempts.length; index += 1) {
      const subgraphId = attempts[index];
      if (!subgraphId) break;
      if (signal.aborted) {
        throw signal.reason instanceof Error ? signal.reason : new Error("GOAL_MCP_ABORTED");
      }
      try {
        const query = capability === "pinned-deployment-lookup"
          ? LOOKUP_DOCUMENT
          : index === 0 ? PRIMARY_SNAPSHOT_DOCUMENT : FALLBACK_SNAPSHOT_DOCUMENT;
        const response = await fetchImpl(`${THE_GRAPH_GATEWAY}${subgraphId}`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${key}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ query }),
          redirect: "error",
          signal,
        });
        if (response.redirected || !response.ok) throw new Error("GRAPH_HTTP_FAILED");
        const text = await boundedText(response);
        const parsed = JSON.parse(text) as unknown;
        return normalizeGraphResponse(parsed, capability, subgraphId, clock());
      } catch {
        if (signal.aborted) {
          throw signal.reason instanceof Error ? signal.reason : new Error("GOAL_MCP_ABORTED");
        }
      }
    }
    throw new McpContextError("GOAL_MCP_PROVIDER_FAILED");
  }

  return {
    invoke: async (binding, request, signal) => {
      if (binding.provider === "the-graph") return fetchGraph(binding, request, signal);
      const now = clock();
      if (binding.provider !== "coingecko") return missing(binding, now);
      if (binding.capability === "spot-price") {
        const response = await fetchCoinGeckoJson(
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
        const response = await fetchCoinGeckoJson(
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
        const response = await fetchCoinGeckoJson("search/trending", signal);
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
