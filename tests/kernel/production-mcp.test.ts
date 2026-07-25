import assert from "node:assert/strict";
import test from "node:test";
import {
  createProductionMcpProvider,
  theGraphProviderAvailability,
} from "../../src/kernel/production-mcp";
import type { McpBindingV1 } from "../../src/kernel/types";

const GRAPH_KEY = "graph_test_key_123456";
const PRIMARY_ID = "8e4dRt4P4WHXnKbEq7STaQfU2g99WZ5S4w39f2PcUTjD";
const FALLBACK_ID = "AXJd5my1nV3MMeoX2FPoxnE7hqqDHiSYEazARyd4xLMj";
const NOW = new Date("2026-07-25T20:01:00.000Z");

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
  requiredCapabilities: ["research", "market-analysis"],
};

function address(value: number): string {
  return `0x${value.toString(16).padStart(40, "0")}`;
}

function metadata(): Record<string, unknown> {
  return {
    deployment: "QmValidDeployment123456789012345678901234567890",
    hasIndexingErrors: false,
    block: { number: 20_000_000, hash: `0x${"a".repeat(64)}` },
  };
}

function pool(index: number, tvl = String(1_000 - index * 100)): Record<string, unknown> {
  return {
    id: address(index + 1),
    token0: { id: address(index + 101), symbol: `T${index}A` },
    token1: { id: address(index + 201), symbol: `T${index}B` },
    feeTier: "3000",
    totalValueLockedUSD: `${tvl}.0000`,
    volumeUSD: `${500 - index}.2500`,
    feesUSD: `${10 - index}.5000`,
    liquidity: String(10_000 - index),
    txCount: String(1_000 - index),
  };
}

function snapshotData(): Record<string, unknown> {
  return {
    _meta: metadata(),
    bundles: [{ id: "1", ethPriceUSD: "3210.5000" }],
    factories: [{
      id: address(999),
      poolCount: "100",
      txCount: "1000",
      totalVolumeUSD: "500000.000",
      totalFeesUSD: "1000.5000",
      totalValueLockedUSD: "250000.2500",
      totalValueLockedETH: "100.000",
    }],
    pools: Array.from({ length: 5 }, (_, index) => pool(index)),
  };
}

function json(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), init);
}

function graphProvider(fetchImpl: typeof fetch, now: () => Date = () => NOW) {
  return createProductionMcpProvider({ THE_GRAPH_API_KEY: GRAPH_KEY }, { fetch: fetchImpl, now });
}

test("production MCP provider fetches bounded ETH/USD CoinGecko evidence unchanged", async () => {
  const calls: Array<{ url: string; headers: Headers }> = [];
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: new Headers(init?.headers) });
    if (url.includes("/simple/price")) {
      return json({
        ethereum: {
          usd: 3210.5,
          usd_market_cap: 100,
          usd_24h_vol: 20,
          usd_24h_change: 1.25,
          last_updated_at: 123,
          ignored: "not returned",
        },
      });
    }
    return json([{
      current_price: 3210.5,
      market_cap: 100,
      total_volume: 20,
      price_change_percentage_1h_in_currency: 0.5,
      price_change_percentage_24h_in_currency: 1.25,
      price_change_percentage_7d_in_currency: 4,
      last_updated: "2026-07-25T20:00:00.000Z",
      ignored: "not returned",
    }]);
  }) as typeof fetch;
  const provider = createProductionMcpProvider({
    COINGECKO_API_URL: "https://api.coingecko.test/api/v3",
    COINGECKO_API_KEY: "CG-pro-key",
  }, { fetch: fetchImpl, now: () => NOW });
  const signal = new AbortController().signal;
  const spot = await provider.invoke(binding("coingecko", "spot-price"), request, signal);
  const market = await provider.invoke(binding("coingecko", "market-snapshot"), request, signal);
  assert.deepEqual(spot, {
    provider: "coingecko",
    capability: "spot-price",
    source: "https://api.coingecko.test/api/v3/simple/price",
    fetchedAt: NOW.toISOString(),
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

test("The Graph uses only fixed POST documents and returns normalized primary evidence", async () => {
  const calls: Array<{ url: string; init: RequestInit; query: string }> = [];
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    assert.ok(init);
    const body = JSON.parse(String(init.body)) as { query: string };
    calls.push({ url: String(input), init, query: body.query });
    if (body.query.includes("PinnedDeploymentLookup")) {
      return json({ data: { _meta: metadata() } });
    }
    return json({ data: snapshotData() });
  }) as typeof fetch;
  const provider = graphProvider(fetchImpl);
  const signal = new AbortController().signal;
  const lookup = await provider.invoke(
    binding("the-graph", "pinned-deployment-lookup"),
    request,
    signal,
  );
  const snapshot = await provider.invoke(
    binding("the-graph", "liquidity-volume-snapshot"),
    request,
    signal,
  ) as {
    sourceMetadata: { subgraphId: string; completedAt: string };
    bundle: { ethPriceUSD: string };
    pools: Array<{ feeTier: string; totalValueLockedUSD: string; feesUSD: string }>;
  };
  assert.deepEqual(Object.keys(lookup as object), ["sourceMetadata"]);
  assert.equal(snapshot.sourceMetadata.subgraphId, PRIMARY_ID);
  assert.equal(snapshot.sourceMetadata.completedAt, NOW.toISOString());
  assert.equal(snapshot.bundle.ethPriceUSD, "3210.5");
  assert.equal(snapshot.pools.length, 5);
  assert.equal(snapshot.pools[0]?.feeTier, "3000");
  assert.equal(snapshot.pools[0]?.totalValueLockedUSD, "1000");
  assert.equal(snapshot.pools[0]?.feesUSD, "10.5");
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.url, `https://gateway.thegraph.com/api/subgraphs/id/${PRIMARY_ID}`);
    assert.equal(call.init.method, "POST");
    assert.equal(call.init.redirect, "error");
    assert.equal(new Headers(call.init.headers).get("authorization"), `Bearer ${GRAPH_KEY}`);
    assert.equal(new Headers(call.init.headers).get("content-type"), "application/json");
    assert.doesNotMatch(call.url, new RegExp(GRAPH_KEY));
    assert.deepEqual(Object.keys(JSON.parse(String(call.init.body)) as object), ["query"]);
  }
  assert.match(calls[0]?.query ?? "", /_meta \{ deployment hasIndexingErrors block \{ number hash \} \}/);
  assert.doesNotMatch(calls[0]?.query ?? "", /bundles|factories|pools/);
  assert.match(calls[1]?.query ?? "", /feeTier totalValueLockedUSD volumeUSD feesUSD liquidity txCount/);
  assert.doesNotMatch(calls[1]?.query ?? "", /feeTier: fee|feesUSD: totalFeesUSD/);
});

test("The Graph retries the fixed fallback once with the fallback aliases", async () => {
  const calls: Array<{ url: string; query: string }> = [];
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const query = (JSON.parse(String(init?.body)) as { query: string }).query;
    calls.push({ url: String(input), query });
    return calls.length === 1
      ? json({ errors: [{ message: "primary schema mismatch" }] })
      : json({ data: snapshotData() });
  }) as typeof fetch;
  const result = await graphProvider(fetchImpl).invoke(
    binding("the-graph", "liquidity-volume-snapshot"),
    request,
    new AbortController().signal,
  ) as { sourceMetadata: { subgraphId: string } };
  assert.equal(result.sourceMetadata.subgraphId, FALLBACK_ID);
  assert.deepEqual(calls.map((call) => call.url), [
    `https://gateway.thegraph.com/api/subgraphs/id/${PRIMARY_ID}`,
    `https://gateway.thegraph.com/api/subgraphs/id/${FALLBACK_ID}`,
  ]);
  assert.match(calls[1]?.query ?? "", /feeTier: fee/);
  assert.match(calls[1]?.query ?? "", /feesUSD: totalFeesUSD/);
});

test("The Graph configuration and binding boundary fail closed without network access", async () => {
  assert.equal(theGraphProviderAvailability({}), "UNAVAILABLE");
  assert.equal(theGraphProviderAvailability({ THE_GRAPH_API_KEY: "bad key" }), "UNAVAILABLE");
  assert.equal(theGraphProviderAvailability({ THE_GRAPH_API_KEY: GRAPH_KEY }), "CONFIGURED");
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    throw new Error("network must not run");
  }) as typeof fetch;
  for (const environment of [{}, { THE_GRAPH_API_KEY: "bad key" }]) {
    const provider = createProductionMcpProvider(environment, { fetch: fetchImpl });
    await assert.rejects(
      provider.invoke(
        binding("the-graph", "liquidity-volume-snapshot"),
        request,
        new AbortController().signal,
      ),
      /GOAL_MCP_CONTEXT_UNAVAILABLE/,
    );
  }
  const provider = graphProvider(fetchImpl);
  await assert.rejects(
    provider.invoke(
      binding("the-graph", "bounded-query"),
      request,
      new AbortController().signal,
    ),
    /GOAL_MCP_BINDING_UNALLOWLISTED/,
  );
  await assert.rejects(
    provider.invoke(
      { ...binding("the-graph", "pinned-deployment-lookup"), endpoint: "https://evil.test" } as McpBindingV1,
      request,
      new AbortController().signal,
    ),
  );
  assert.equal(calls, 0);
});

test("wrong Graph credentials make exactly two sanitized fixed requests", async () => {
  const key = "wrong_key_12345678";
  const urls: string[] = [];
  const provider = createProductionMcpProvider({ THE_GRAPH_API_KEY: key }, {
    fetch: (async (input: URL | RequestInfo) => {
      urls.push(String(input));
      return new Response("denied", { status: 401 });
    }) as typeof fetch,
  });
  let message = "";
  await assert.rejects(
    provider.invoke(
      binding("the-graph", "pinned-deployment-lookup"),
      request,
      new AbortController().signal,
    ),
    (error: unknown) => {
      message = error instanceof Error ? error.message : String(error);
      return /GOAL_MCP_PROVIDER_FAILED/.test(message);
    },
  );
  assert.equal(urls.length, 2);
  assert.doesNotMatch(message, new RegExp(key));
  assert.ok(urls.every((url) => !url.includes(key)));
});

test("The Graph retries one transport failure and returns one sanitized provider error", async () => {
  let calls = 0;
  const provider = graphProvider((async () => {
    calls += 1;
    throw new Error("private transport detail");
  }) as typeof fetch);
  await assert.rejects(
    provider.invoke(
      binding("the-graph", "pinned-deployment-lookup"),
      request,
      new AbortController().signal,
    ),
    (error: unknown) => error instanceof Error && error.message === "GOAL_MCP_PROVIDER_FAILED",
  );
  assert.equal(calls, 2);
});

test("transport, redirect, GraphQL, indexing, and metadata failures all exhaust once", async (t) => {
  const cases: Array<{ name: string; response: () => Response }> = [
    { name: "non-2xx", response: () => new Response("unavailable", { status: 503 }) },
    {
      name: "redirect",
      response: () => {
        const response = json({ data: snapshotData() });
        Object.defineProperty(response, "redirected", { value: true });
        return response;
      },
    },
    { name: "graphql-errors", response: () => json({ errors: [{ message: "invalid" }] }) },
    {
      name: "indexing-errors",
      response: () => {
        const data = snapshotData();
        data._meta = { ...metadata(), hasIndexingErrors: true };
        return json({ data });
      },
    },
    {
      name: "missing-block",
      response: () => {
        const data = snapshotData();
        const meta = metadata();
        delete meta.block;
        data._meta = meta;
        return json({ data });
      },
    },
    {
      name: "missing-hash",
      response: () => {
        const data = snapshotData();
        data._meta = { ...metadata(), block: { number: 20_000_000 } };
        return json({ data });
      },
    },
  ];
  for (const entry of cases) {
    await t.test(entry.name, async () => {
      let calls = 0;
      const provider = graphProvider((async () => {
        calls += 1;
        return entry.response();
      }) as typeof fetch);
      await assert.rejects(
        provider.invoke(
          binding("the-graph", "liquidity-volume-snapshot"),
          request,
          new AbortController().signal,
        ),
        /GOAL_MCP_PROVIDER_FAILED/,
      );
      assert.equal(calls, 2);
    });
  }
});

test("malformed, truncated, oversized, deep, and secret-bearing Graph payloads are sanitized", async (t) => {
  const cases: Array<{ name: string; response: () => Response }> = [
    { name: "malformed", response: () => new Response("not-json") },
    { name: "truncated", response: () => new Response('{"data":{"_meta":') },
    { name: "oversized", response: () => new Response("x".repeat(32_769)) },
    {
      name: "deep",
      response: () => json({ data: { _meta: metadata(), nested: { a: { b: { c: { d: { e: 1 } } } } } } }),
    },
    {
      name: "secret-bearing",
      response: () => json({ data: { ...snapshotData(), apiKey: "must-not-escape" } }),
    },
  ];
  for (const entry of cases) {
    await t.test(entry.name, async () => {
      const provider = graphProvider((async () => entry.response()) as typeof fetch);
      let message = "";
      await assert.rejects(
        provider.invoke(
          binding("the-graph", "liquidity-volume-snapshot"),
          request,
          new AbortController().signal,
        ),
        (error: unknown) => {
          message = error instanceof Error ? error.message : String(error);
          return /GOAL_MCP_PROVIDER_FAILED/.test(message);
        },
      );
      assert.doesNotMatch(message, /must-not-escape|graph_test_key/i);
    });
  }
});

test("malformed decimals, integers, addresses, symbols, pool count, duplicates, and order fail closed", async (t) => {
  const cases: Array<{ name: string; mutate: (data: Record<string, unknown>) => void }> = [
    {
      name: "decimal",
      mutate: (data) => { (data.bundles as Array<Record<string, unknown>>)[0]!.ethPriceUSD = "1e6"; },
    },
    {
      name: "integer",
      mutate: (data) => { (data.pools as Array<Record<string, unknown>>)[0]!.liquidity = "-1"; },
    },
    {
      name: "address",
      mutate: (data) => { (data.pools as Array<Record<string, unknown>>)[0]!.id = "0x1234"; },
    },
    {
      name: "symbol",
      mutate: (data) => {
        ((data.pools as Array<Record<string, unknown>>)[0]!.token0 as Record<string, unknown>).symbol = "BAD SYMBOL";
      },
    },
    { name: "not-five", mutate: (data) => { (data.pools as unknown[]).pop(); } },
    {
      name: "duplicate",
      mutate: (data) => {
        (data.pools as Array<Record<string, unknown>>)[1]!.id =
          (data.pools as Array<Record<string, unknown>>)[0]!.id;
      },
    },
    {
      name: "unsorted",
      mutate: (data) => {
        (data.pools as Array<Record<string, unknown>>)[1]!.totalValueLockedUSD = "999999.0";
      },
    },
  ];
  for (const entry of cases) {
    await t.test(entry.name, async () => {
      const provider = graphProvider((async () => {
        const data = snapshotData();
        entry.mutate(data);
        return json({ data });
      }) as typeof fetch);
      await assert.rejects(
        provider.invoke(
          binding("the-graph", "liquidity-volume-snapshot"),
          request,
          new AbortController().signal,
        ),
        /GOAL_MCP_PROVIDER_FAILED/,
      );
    });
  }
});

test("an aborted Graph request does not start fallback", async () => {
  const controller = new AbortController();
  let calls = 0;
  const provider = graphProvider((async (_input: URL | RequestInfo, init?: RequestInit) => {
    calls += 1;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    });
  }) as typeof fetch);
  const pending = provider.invoke(
    binding("the-graph", "liquidity-volume-snapshot"),
    request,
    controller.signal,
  );
  controller.abort(new Error("GOAL_MCP_TIMEOUT"));
  await assert.rejects(pending, /GOAL_MCP_TIMEOUT/);
  assert.equal(calls, 1);
});

test("production MCP provider still rejects unsafe CoinGecko configuration and oversized responses", async () => {
  assert.throws(
    () => createProductionMcpProvider({ COINGECKO_API_URL: "http://user:pass@example.test" }),
    /GOAL_MCP_CONTEXT_UNAVAILABLE/,
  );
  const provider = createProductionMcpProvider({}, {
    fetch: (async () => json({ value: "x".repeat(33_000) })) as typeof fetch,
  });
  await assert.rejects(
    provider.invoke(binding("coingecko", "spot-price"), request, new AbortController().signal),
    /GOAL_MCP_RESPONSE_TOO_LARGE/,
  );
});
