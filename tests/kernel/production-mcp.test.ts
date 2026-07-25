import assert from "node:assert/strict";
import test from "node:test";
import { createProductionMcpProvider } from "../../src/kernel/production-mcp";
import type { McpBindingV1 } from "../../src/kernel/types";

function binding(
  provider: McpBindingV1["provider"],
  capability: McpBindingV1["capability"],
): McpBindingV1 {
  return {
    schemaVersion: 1,
    id: `mcp.${provider}.${capability}`,
    provider,
    capability,
    access: "read-only",
    timeoutMs: 8000,
    maxResponseBytes: 32768,
  };
}

const request = {
  schemaVersion: 1 as const,
  objective: "Analyze bounded market evidence.",
  requiredCapabilities: ["market-analysis"],
};

test("production MCP provider fetches bounded ETH/USD CoinGecko evidence", async () => {
  const calls: Array<{ url: string; headers: Headers }> = [];
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: new Headers(init?.headers) });
    if (url.includes("/simple/price")) {
      return new Response(JSON.stringify({
        ethereum: {
          usd: 3210.5,
          usd_market_cap: 100,
          usd_24h_vol: 20,
          usd_24h_change: 1.25,
          last_updated_at: 123,
          ignored: "not returned",
        },
      }));
    }
    return new Response(JSON.stringify([{
      current_price: 3210.5,
      market_cap: 100,
      total_volume: 20,
      price_change_percentage_1h_in_currency: 0.5,
      price_change_percentage_24h_in_currency: 1.25,
      price_change_percentage_7d_in_currency: 4,
      last_updated: "2026-07-25T20:00:00.000Z",
      ignored: "not returned",
    }]));
  }) as typeof fetch;
  const provider = createProductionMcpProvider({
    COINGECKO_API_URL: "https://api.coingecko.test/api/v3",
    COINGECKO_API_KEY: "CG-pro-key",
  }, {
    fetch: fetchImpl,
    now: () => new Date("2026-07-25T20:01:00.000Z"),
  });
  const signal = new AbortController().signal;
  const spot = await provider.invoke(binding("coingecko", "spot-price"), request, signal);
  const market = await provider.invoke(binding("coingecko", "market-snapshot"), request, signal);
  assert.deepEqual(spot, {
    provider: "coingecko",
    capability: "spot-price",
    source: "https://api.coingecko.test/api/v3/simple/price",
    fetchedAt: "2026-07-25T20:01:00.000Z",
    params: { coinId: "ethereum", currency: "usd" },
    data: {
      price: 3210.5,
      marketCap: 100,
      volume24h: 20,
      change24hPercent: 1.25,
      lastUpdatedAt: 123,
    },
    missingInputs: [],
  });
  assert.equal((market as { data: { change7dPercent: number } }).data.change7dPercent, 4);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.headers.get("x-cg-pro-api-key"), "CG-pro-key");
  assert.match(calls[0]?.url ?? "", /ids=ethereum&vs_currencies=usd/);
});

test("production MCP provider records typed-input gaps without a network call", async () => {
  let calls = 0;
  const provider = createProductionMcpProvider({}, {
    fetch: (async () => {
      calls += 1;
      throw new Error("network must not run");
    }) as typeof fetch,
    now: () => new Date("2026-07-25T20:01:00.000Z"),
  });
  const result = await provider.invoke(
    binding("the-graph", "liquidity-volume-snapshot"),
    request,
    new AbortController().signal,
  );
  assert.equal(calls, 0);
  assert.deepEqual(result, {
    provider: "the-graph",
    capability: "liquidity-volume-snapshot",
    source: "unavailable:typed-input-required",
    fetchedAt: "2026-07-25T20:01:00.000Z",
    params: {},
    data: null,
    missingInputs: ["deploymentId", "chain", "contractAddress", "boundedQuery"],
  });
});

test("production MCP provider rejects unsafe configuration and oversized responses", async () => {
  assert.throws(
    () => createProductionMcpProvider({ COINGECKO_API_URL: "http://user:pass@example.test" }),
    /GOAL_MCP_CONTEXT_UNAVAILABLE/,
  );
  const provider = createProductionMcpProvider({}, {
    fetch: (async () => new Response(JSON.stringify({ value: "x".repeat(33_000) }))) as typeof fetch,
  });
  await assert.rejects(
    provider.invoke(binding("coingecko", "spot-price"), request, new AbortController().signal),
    /GOAL_MCP_RESPONSE_TOO_LARGE/,
  );
});
