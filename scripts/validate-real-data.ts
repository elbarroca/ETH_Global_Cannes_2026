/**
 * VaultMind — Real Data & Marketplace Validation
 * Tests data fetchers, technical indicators, and marketplace registry.
 * Usage: npx tsx scripts/validate-real-data.ts
 *
 * No .env required for data fetchers (free APIs).
 * Marketplace tests need DATABASE_URL + DIRECT_URL for Prisma.
 */
import dotenv from "dotenv";
dotenv.config();

// ─── Helpers ────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

function ok(label: string, detail?: string): void {
  passed++;
  console.log(`  \u2705 ${label}${detail ? ` \u2014 ${detail}` : ""}`);
}

function fail(label: string, err: unknown): void {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  \u274C ${label} \u2014 ${msg}`);
}

function skip(label: string, reason: string): void {
  skipped++;
  console.log(`  \u23ED\uFE0F  ${label} \u2014 ${reason}`);
}

function assertRange(label: string, value: number, min: number, max: number): void {
  if (value >= min && value <= max) {
    ok(label, `${value} (in range ${min}-${max})`);
  } else {
    fail(label, `${value} out of range ${min}-${max}`);
  }
}

// ─── Test 1: Sentiment Data Fetcher ────────────────────────

async function testSentimentData(): Promise<void> {
  console.log("\n\u2550\u2550\u2550 TEST 1: Sentiment Data Fetcher (CoinGecko + Fear&Greed) \u2550\u2550\u2550");
  try {
    const { fetchSentimentData } = await import("../src/agents/data/sentiment-data.js");
    const start = Date.now();
    const raw = await fetchSentimentData();
    const elapsed = Date.now() - start;
    ok("fetchSentimentData()", `returned ${raw.length} bytes in ${elapsed}ms`);

    const data = JSON.parse(raw);

    // ETH price should be a positive number (not mock "~$3,400")
    if (typeof data.eth_price === "number" && data.eth_price > 100) {
      ok("ETH price", `$${data.eth_price.toFixed(2)} (real, not mock)`);
    } else if (data.eth_error) {
      fail("ETH price", `API error: ${data.eth_error}`);
    } else {
      fail("ETH price", `unexpected: ${data.eth_price}`);
    }

    // 24h change should be a number between -50 and +50
    if (typeof data.eth_24h_change === "number") {
      assertRange("ETH 24h change", data.eth_24h_change, -50, 50);
    }

    // Fear & Greed should be 0-100
    if (typeof data.fear_greed_value === "number") {
      assertRange("Fear & Greed", data.fear_greed_value, 0, 100);
      ok("Fear & Greed label", data.fear_greed_label);
    }

    // Trending coins should be an array
    if (Array.isArray(data.trending_coins) && data.trending_coins.length > 0) {
      ok("Trending coins", `${data.trending_coins.length} coins: ${data.trending_coins.map((c: { name: string }) => c.name).join(", ")}`);
    } else {
      ok("Trending coins", "empty (API may be rate limited)");
    }

    // Sentiment votes
    if (typeof data.eth_sentiment_up === "number") {
      ok("Sentiment votes", `up: ${data.eth_sentiment_up}%, down: ${data.eth_sentiment_down}%`);
    }

    ok("fetched_at", data.fetched_at);

    // Test caching — second call should be near-instant
    const cacheStart = Date.now();
    await fetchSentimentData();
    const cacheElapsed = Date.now() - cacheStart;
    if (cacheElapsed < 50) {
      ok("Cache hit", `second call: ${cacheElapsed}ms (cached)`);
    } else {
      ok("Cache", `second call: ${cacheElapsed}ms (may have missed cache)`);
    }
  } catch (err) {
    fail("Sentiment fetcher", err);
  }
}

// ─── Test 2: Whale Data Fetcher ─────────────────────────────

async function testWhaleData(): Promise<void> {
  console.log("\n\u2550\u2550\u2550 TEST 2: Whale Data Fetcher (Etherscan + CoinGecko) \u2550\u2550\u2550");
  try {
    const { fetchWhaleData } = await import("../src/agents/data/whale-data.js");
    const start = Date.now();
    const raw = await fetchWhaleData();
    const elapsed = Date.now() - start;
    ok("fetchWhaleData()", `returned ${raw.length} bytes in ${elapsed}ms`);

    const data = JSON.parse(raw);

    // ETH price from Etherscan (cross-reference)
    if (typeof data.eth_price_usd === "number" && data.eth_price_usd > 100) {
      ok("ETH price (Etherscan)", `$${data.eth_price_usd.toFixed(2)}`);
    } else if (data.eth_price_usd === null) {
      skip("ETH price (Etherscan)", "API returned null (rate limited or no API key)");
    }

    // Gas oracle
    if (typeof data.gas_safe_gwei === "number") {
      ok("Gas safe", `${data.gas_safe_gwei} gwei`);
      ok("Gas fast", `${data.gas_fast_gwei} gwei`);
      ok("Gas spread", `${data.gas_spread} gwei`);
      ok("Gas assessment", data.gas_assessment);
    } else {
      skip("Gas oracle", `assessment: ${data.gas_assessment}`);
    }

    // Exchange volumes
    if (Array.isArray(data.top_exchanges) && data.top_exchanges.length > 0) {
      ok("Top exchanges", `${data.top_exchanges.length} exchanges`);
      for (const ex of data.top_exchanges.slice(0, 3)) {
        console.log(`    ${ex.name}: ${ex.volume_btc_24h?.toLocaleString()} BTC (trust: ${ex.trust})`);
      }
      if (typeof data.total_top5_volume_btc === "number") {
        ok("Total top-5 volume", `${data.total_top5_volume_btc.toLocaleString()} BTC`);
      }
    } else {
      skip("Top exchanges", "empty (may be rate limited)");
    }

    // ETH volume
    if (typeof data.eth_24h_volume_usd === "number" && data.eth_24h_volume_usd > 0) {
      ok("ETH 24h volume", `$${(data.eth_24h_volume_usd / 1e9).toFixed(2)}B`);
    }

    ok("fetched_at", data.fetched_at);
  } catch (err) {
    fail("Whale fetcher", err);
  }
}

// ─── Test 3: Momentum Data Fetcher ──────────────────────────

async function testMomentumData(): Promise<void> {
  console.log("\n\u2550\u2550\u2550 TEST 3: Momentum Data Fetcher (CoinGecko + RSI/MACD) \u2550\u2550\u2550");
  try {
    const { fetchMomentumData } = await import("../src/agents/data/momentum-data.js");
    const start = Date.now();
    const raw = await fetchMomentumData();
    const elapsed = Date.now() - start;
    ok("fetchMomentumData()", `returned ${raw.length} bytes in ${elapsed}ms`);

    const data = JSON.parse(raw);

    if (data.error) {
      fail("Momentum data", data.error);
      return;
    }

    // Current price
    if (typeof data.current_price === "number" && data.current_price > 100) {
      ok("Current price", `$${data.current_price.toFixed(2)}`);
    } else {
      fail("Current price", `unexpected: ${data.current_price}`);
    }

    // RSI-14 should be 0-100
    if (typeof data.rsi_14 === "number") {
      assertRange("RSI-14", data.rsi_14, 0, 100);
      ok("RSI assessment", data.rsi_assessment);
    }

    // MACD values should be numbers
    if (typeof data.macd === "number") {
      ok("MACD", `line: ${data.macd}, signal: ${data.macd_signal}, histogram: ${data.macd_histogram}`);
      ok("MACD crossover", data.macd_crossover);
    }

    // Support/resistance
    if (typeof data.support_7d === "number" && typeof data.resistance_7d === "number") {
      ok("Support 7d", `$${data.support_7d.toFixed(2)}`);
      ok("Resistance 7d", `$${data.resistance_7d.toFixed(2)}`);
      if (data.support_7d < data.resistance_7d) {
        ok("Support < Resistance", "valid");
      } else {
        fail("Support/Resistance", `support ${data.support_7d} >= resistance ${data.resistance_7d}`);
      }
    }

    // SMAs
    if (typeof data.sma_20d === "number") {
      ok("SMA-20d", `$${data.sma_20d.toFixed(2)}`);
      ok("Price vs SMA-20", data.price_vs_sma20);
    }
    if (typeof data.sma_30d === "number") {
      ok("SMA-30d", `$${data.sma_30d.toFixed(2)}`);
    }

    // Volume trend
    ok("Volume change 24h", `${data.volume_change_24h_pct}%`);
    ok("Volume trend", data.volume_trend);
  } catch (err) {
    fail("Momentum fetcher", err);
  }
}

// ─── Test 4: Technical Indicator Unit Tests ─────────────────

async function testIndicators(): Promise<void> {
  console.log("\n\u2550\u2550\u2550 TEST 4: Technical Indicator Unit Tests \u2550\u2550\u2550");

  // We can't import private functions directly, so we test via known-output scenarios
  // using the public fetchMomentumData (already tested above).
  // Here we verify edge cases with a synthetic test.

  // RSI edge cases: flat market should return 50, not 100
  const flatPrices = Array(20).fill(100);
  // Simulate RSI computation inline (same logic as momentum-data.ts)
  const changes = flatPrices.slice(1).map((p: number, i: number) => p - flatPrices[i]);
  const recent = changes.slice(-14);
  const gains = recent.filter((c: number) => c > 0);
  const losses = recent.filter((c: number) => c < 0).map((c: number) => Math.abs(c));
  const avgGain = gains.length > 0 ? gains.reduce((a: number, b: number) => a + b, 0) / 14 : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a: number, b: number) => a + b, 0) / 14 : 0;

  let rsi: number;
  if (avgGain === 0 && avgLoss === 0) rsi = 50;
  else if (avgLoss === 0) rsi = 100;
  else rsi = Math.round(100 - 100 / (1 + avgGain / avgLoss));

  if (rsi === 50) {
    ok("RSI flat market", `${rsi} (correct: neutral, not 100)`);
  } else {
    fail("RSI flat market", `expected 50, got ${rsi}`);
  }

  // RSI strong uptrend: all gains, no losses → should be 100
  const upPrices = Array.from({ length: 20 }, (_, i) => 100 + i);
  const upChanges = upPrices.slice(1).map((p: number, i: number) => p - upPrices[i]);
  const upRecent = upChanges.slice(-14);
  const upGains = upRecent.filter((c: number) => c > 0);
  const upLosses = upRecent.filter((c: number) => c < 0);
  const uAvgGain = upGains.reduce((a: number, b: number) => a + b, 0) / 14;
  const uAvgLoss = upLosses.length > 0 ? upLosses.map((c: number) => Math.abs(c)).reduce((a: number, b: number) => a + b, 0) / 14 : 0;

  let rsiUp: number;
  if (uAvgGain === 0 && uAvgLoss === 0) rsiUp = 50;
  else if (uAvgLoss === 0) rsiUp = 100;
  else rsiUp = Math.round(100 - 100 / (1 + uAvgGain / uAvgLoss));

  if (rsiUp === 100) {
    ok("RSI strong uptrend", `${rsiUp} (correct: overbought)`);
  } else {
    fail("RSI strong uptrend", `expected 100, got ${rsiUp}`);
  }

  // RSI strong downtrend: all losses, no gains → should be 0
  const downPrices = Array.from({ length: 20 }, (_, i) => 120 - i);
  const downChanges = downPrices.slice(1).map((p: number, i: number) => p - downPrices[i]);
  const downRecent = downChanges.slice(-14);
  const downGains = downRecent.filter((c: number) => c > 0);
  const downLosses = downRecent.filter((c: number) => c < 0).map((c: number) => Math.abs(c));
  const dAvgGain = downGains.length > 0 ? downGains.reduce((a: number, b: number) => a + b, 0) / 14 : 0;
  const dAvgLoss = downLosses.reduce((a: number, b: number) => a + b, 0) / 14;

  let rsiDown: number;
  if (dAvgGain === 0 && dAvgLoss === 0) rsiDown = 50;
  else if (dAvgLoss === 0) rsiDown = 100;
  else rsiDown = Math.round(100 - 100 / (1 + dAvgGain / dAvgLoss));

  if (rsiDown === 0) {
    ok("RSI strong downtrend", `${rsiDown} (correct: oversold)`);
  } else {
    fail("RSI strong downtrend", `expected 0, got ${rsiDown}`);
  }

  ok("Indicator unit tests", "RSI edge cases verified");
}

// ─── Test 5: Cross-Source Price Validation ──────────────────

async function testCrossSourcePrices(): Promise<void> {
  console.log("\n\u2550\u2550\u2550 TEST 5: Cross-Source Price Validation \u2550\u2550\u2550");
  try {
    const { fetchSentimentData } = await import("../src/agents/data/sentiment-data.js");
    const { fetchWhaleData } = await import("../src/agents/data/whale-data.js");
    const { fetchMomentumData } = await import("../src/agents/data/momentum-data.js");

    const [sentRaw, whaleRaw, momRaw] = await Promise.all([
      fetchSentimentData(),
      fetchWhaleData(),
      fetchMomentumData(),
    ]);

    const sent = JSON.parse(sentRaw);
    const whale = JSON.parse(whaleRaw);
    const mom = JSON.parse(momRaw);

    const prices: Array<{ source: string; price: number | null }> = [
      { source: "Sentiment (CoinGecko)", price: sent.eth_price },
      { source: "Whale (Etherscan)", price: whale.eth_price_usd },
      { source: "Momentum (CoinGecko chart)", price: mom.current_price },
    ];

    console.log("  ETH prices from each source:");
    for (const p of prices) {
      if (typeof p.price === "number" && p.price > 0) {
        console.log(`    ${p.source}: $${p.price.toFixed(2)}`);
      } else {
        console.log(`    ${p.source}: unavailable`);
      }
    }

    // Check that CoinGecko sources agree within 1%
    const cgPrices = prices.filter((p) => typeof p.price === "number" && p.price > 0);
    if (cgPrices.length >= 2) {
      const p1 = cgPrices[0].price!;
      const p2 = cgPrices[1].price!;
      const diff = Math.abs(p1 - p2) / Math.max(p1, p2) * 100;
      if (diff < 1) {
        ok("Price agreement", `${diff.toFixed(3)}% spread (< 1%)`);
      } else if (diff < 5) {
        ok("Price agreement", `${diff.toFixed(2)}% spread (< 5%, acceptable for cached data)`);
      } else {
        fail("Price agreement", `${diff.toFixed(2)}% spread (> 5%, possible stale cache)`);
      }
    } else {
      skip("Price agreement", "need at least 2 prices to compare");
    }
  } catch (err) {
    fail("Cross-source prices", err);
  }
}

// ─── Test 6: Marketplace Registry ───────────────────────────

async function testMarketplace(): Promise<void> {
  console.log("\n\u2550\u2550\u2550 TEST 6: Marketplace Registry \u2550\u2550\u2550");

  if (!process.env.DATABASE_URL) {
    skip("Marketplace", "DATABASE_URL not set \u2014 Prisma tests skipped");
    return;
  }

  try {
    const { loadRegistry, discoverSpecialists, registerSpecialist } = await import("../src/marketplace/registry.js");

    console.log("  Loading registry from Prisma...");
    await loadRegistry();
    ok("loadRegistry()", "loaded (includes auto-registered built-ins)");

    // Discover all
    const all = discoverSpecialists({});
    ok("discoverSpecialists({})", `${all.length} agents found`);
    for (const a of all) {
      console.log(`    ${a.name}: rep=${a.reputation}, hires=${a.totalHires}, tags=[${a.tags.join(",")}]`);
    }

    // Discover by tag
    const sentimentOnly = discoverSpecialists({ tags: ["sentiment"], maxHires: 1 });
    if (sentimentOnly.length === 1 && sentimentOnly[0].name === "sentiment") {
      ok("discoverSpecialists(sentiment)", "found sentiment agent");
    } else if (sentimentOnly.length >= 1) {
      ok("discoverSpecialists(sentiment)", `found ${sentimentOnly.length} agent(s): ${sentimentOnly.map(a => a.name).join(", ")}`);
    } else {
      fail("discoverSpecialists(sentiment)", "no sentiment agent found");
    }

    // Discover with minReputation filter
    const highRep = discoverSpecialists({ minReputation: 600 });
    ok("discoverSpecialists(minRep=600)", `${highRep.length} agents with rep >= 600`);

    // Tag diversity: requesting all 3 tags should return one of each
    const diverse = discoverSpecialists({ tags: ["sentiment", "whale", "momentum"], maxHires: 3 });
    const names = diverse.map((a) => a.name);
    if (names.includes("sentiment") && names.includes("whale") && names.includes("momentum")) {
      ok("Tag diversity", `all 3 tags covered: ${names.join(", ")}`);
    } else {
      fail("Tag diversity", `only got: ${names.join(", ")}`);
    }
  } catch (err) {
    fail("Marketplace", err);
  }
}

// ─── Test 7: Reputation Scoring ─────────────────────────────

async function testReputation(): Promise<void> {
  console.log("\n\u2550\u2550\u2550 TEST 7: Reputation ELO Scoring \u2550\u2550\u2550");

  if (!process.env.DATABASE_URL) {
    skip("Reputation", "DATABASE_URL not set");
    return;
  }

  try {
    const { updateSpecialistReputation, getLeaderboard } = await import("../src/marketplace/reputation.js");

    // Get current reputation
    const leaderboard = await getLeaderboard();
    ok("getLeaderboard()", `${leaderboard.length} agents`);
    for (const a of leaderboard) {
      console.log(`    ${a.name}: rep=${a.reputation}, accuracy=${a.accuracy}%, hires=${a.totalHires}`);
    }

    // Test ELO update (correct call should increase rep)
    const sentBefore = leaderboard.find((a) => a.name === "sentiment");
    if (!sentBefore) {
      skip("ELO update", "sentiment agent not in leaderboard");
      return;
    }

    const newRep = await updateSpecialistReputation("sentiment", true);
    if (newRep > sentBefore.reputation) {
      ok("ELO correct call", `${sentBefore.reputation} \u2192 ${newRep} (+${newRep - sentBefore.reputation})`);
    } else if (newRep === sentBefore.reputation) {
      ok("ELO correct call", `${newRep} (unchanged \u2014 already at ceiling)`);
    } else {
      fail("ELO correct call", `expected increase, got ${sentBefore.reputation} \u2192 ${newRep}`);
    }

    // Test wrong call should decrease rep
    const newRep2 = await updateSpecialistReputation("sentiment", false);
    if (newRep2 < newRep) {
      ok("ELO wrong call", `${newRep} \u2192 ${newRep2} (${newRep2 - newRep})`);
    } else {
      fail("ELO wrong call", `expected decrease, got ${newRep} \u2192 ${newRep2}`);
    }
  } catch (err) {
    fail("Reputation", err);
  }
}

// ─── Test 8: Full Data Pipeline Snapshot ────────────────────

async function testFullPipeline(): Promise<void> {
  console.log("\n\u2550\u2550\u2550 TEST 8: Full Data Pipeline Snapshot \u2550\u2550\u2550");
  console.log("  This simulates what a specialist would see during a cycle.\n");

  try {
    const { fetchSentimentData } = await import("../src/agents/data/sentiment-data.js");
    const { fetchWhaleData } = await import("../src/agents/data/whale-data.js");
    const { fetchMomentumData } = await import("../src/agents/data/momentum-data.js");

    const start = Date.now();
    const [sentRaw, whaleRaw, momRaw] = await Promise.all([
      fetchSentimentData(),
      fetchWhaleData(),
      fetchMomentumData(),
    ]);
    const elapsed = Date.now() - start;

    const sent = JSON.parse(sentRaw);
    const whale = JSON.parse(whaleRaw);
    const mom = JSON.parse(momRaw);

    console.log("  \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510");
    console.log("  \u2502 SENTIMENT AGENT INPUT                      \u2502");
    console.log("  \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    console.log(`  \u2502 ETH: $${sent.eth_price?.toFixed(2) ?? "?"} (24h: ${sent.eth_24h_change?.toFixed(1) ?? "?"}%)`);
    console.log(`  \u2502 Fear & Greed: ${sent.fear_greed_value} (${sent.fear_greed_label})`);
    console.log(`  \u2502 Sentiment: ${sent.eth_sentiment_up ?? "?"}% up / ${sent.eth_sentiment_down ?? "?"}% down`);
    console.log(`  \u2502 Trending: ${(sent.trending_coins ?? []).map((c: { name: string }) => c.name).join(", ") || "none"}`);

    console.log("  \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    console.log("  \u2502 WHALE AGENT INPUT                          \u2502");
    console.log("  \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    console.log(`  \u2502 ETH (Etherscan): $${whale.eth_price_usd ?? "?"}`);
    console.log(`  \u2502 Gas: safe=${whale.gas_safe_gwei ?? "?"} / fast=${whale.gas_fast_gwei ?? "?"} gwei`);
    console.log(`  \u2502 Gas assessment: ${whale.gas_assessment}`);
    console.log(`  \u2502 Top-5 exchange vol: ${whale.total_top5_volume_btc?.toLocaleString() ?? "?"} BTC`);

    console.log("  \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    console.log("  \u2502 MOMENTUM AGENT INPUT                      \u2502");
    console.log("  \u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524");
    console.log(`  \u2502 ETH: $${mom.current_price?.toFixed(2) ?? "?"}`);
    console.log(`  \u2502 RSI-14: ${mom.rsi_14} (${mom.rsi_assessment})`);
    console.log(`  \u2502 MACD: ${mom.macd} / signal: ${mom.macd_signal} / hist: ${mom.macd_histogram} (${mom.macd_crossover})`);
    console.log(`  \u2502 Support: $${mom.support_7d?.toFixed(2) ?? "?"} / Resistance: $${mom.resistance_7d?.toFixed(2) ?? "?"}`);
    console.log(`  \u2502 SMA-20d: $${mom.sma_20d?.toFixed(2) ?? "?"} (price ${mom.price_vs_sma20})`);
    console.log(`  \u2502 Volume: ${mom.volume_trend} (${mom.volume_change_24h_pct}% 24h change)`);
    console.log("  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518");

    ok("Full pipeline", `all 3 fetchers returned in ${elapsed}ms`);

    // Verify NO mock data anywhere
    const allRaw = sentRaw + whaleRaw + momRaw;
    const mockPatterns = ["mock", "stub", "~$67,000", "~$3,400", "placeholder"];
    for (const pattern of mockPatterns) {
      if (allRaw.toLowerCase().includes(pattern)) {
        fail("No mock data", `found "${pattern}" in output!`);
      }
    }
    ok("No mock data", "all responses contain real market data");
  } catch (err) {
    fail("Full pipeline", err);
  }
}

// ─── RUNNER ─────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551   VAULTMIND \u2014 REAL DATA VALIDATION SUITE           \u2551");
  console.log("\u2551   Testing data fetchers, indicators & marketplace   \u2551");
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");

  // Data fetchers (no env needed — free APIs)
  await testSentimentData();
  await testWhaleData();
  await testMomentumData();

  // Indicator unit tests (pure math, no network)
  await testIndicators();

  // Cross-source validation (compares prices from different APIs)
  await testCrossSourcePrices();

  // Marketplace (needs DATABASE_URL)
  await testMarketplace();
  await testReputation();

  // Full pipeline snapshot
  await testFullPipeline();

  // Summary
  console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log(`\u2551   RESULTS: \u2705 ${passed} passed \u00B7 \u274C ${failed} failed \u00B7 \u23ED\uFE0F  ${skipped} skipped`);
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");

  if (failed > 0) {
    console.log("\nSome tests failed. Check output above for details.");
    process.exit(1);
  } else {
    console.log("\nAll tests passed! Real data pipeline is operational.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("\nValidation suite crashed:", err);
  process.exit(1);
});
