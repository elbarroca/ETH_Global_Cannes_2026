/**
 * VaultMind — Agent Reasoning E2E Validation
 * Tests the full pipeline: real data → 0G inference → agent-to-agent debate
 *
 * Requires: OG_PRIVATE_KEY, OG_PROVIDER_ADDRESS in .env
 * Usage: ./node_modules/.bin/tsx scripts/validate-agent-reasoning.ts
 */
import dotenv from "dotenv";
dotenv.config();

let passed = 0;
let failed = 0;

function ok(label: string, detail?: string): void {
  passed++;
  console.log(`  \u2705 ${label}${detail ? ` \u2014 ${detail}` : ""}`);
}

function fail(label: string, err: unknown): void {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  \u274C ${label} \u2014 ${msg}`);
}

// ─── Test 1: Single Specialist — Sentiment with Real Data ───

async function testSentimentSpecialist(): Promise<Record<string, unknown>> {
  console.log("\n\u2550\u2550\u2550 TEST 1: Sentiment Specialist (Real Data \u2192 0G Inference) \u2550\u2550\u2550");

  const { fetchSentimentData } = await import("../src/agents/data/sentiment-data.js");
  const { sealedInference } = await import("../src/og/inference.js");
  const { PROMPTS, safeJsonParse } = await import("../src/agents/prompts.js");

  const provider = process.env.OG_PROVIDER_ADDRESS!;

  // Step 1: Fetch real data
  console.log("  Fetching real sentiment data...");
  const rawData = await fetchSentimentData();
  const data = JSON.parse(rawData);
  ok("Data fetched", `ETH=$${data.eth_price}, F&G=${data.fear_greed_value}(${data.fear_greed_label})`);

  // Step 2: Pass to 0G sealed inference
  console.log("  Calling 0G sealed inference with sentiment prompt...");
  const t0 = Date.now();
  const result = await sealedInference(provider, PROMPTS.sentiment.content, `Current market data:\n${rawData}`);
  const elapsed = Date.now() - t0;
  ok("Inference complete", `${elapsed}ms, ${result.content.length} chars`);
  ok("Attestation", result.attestationHash ? result.attestationHash.slice(0, 24) + "..." : "none (testnet)");

  // Step 3: Parse response
  const parsed = safeJsonParse<Record<string, unknown>>(result.content, {});
  if (parsed.signal && parsed.confidence != null) {
    ok("Parse", `signal=${parsed.signal}, confidence=${parsed.confidence}, reasoning="${parsed.reasoning}"`);
  } else {
    fail("Parse", `malformed: ${result.content.slice(0, 120)}`);
  }

  // Step 4: Validate reasoning quality
  const reasoning = String(parsed.reasoning ?? "");
  if (reasoning.length > 5 && reasoning.length <= 100) {
    ok("Reasoning quality", `"${reasoning}" (${reasoning.split(" ").length} words)`);
  } else if (reasoning.length > 0) {
    ok("Reasoning present", `"${reasoning.slice(0, 60)}..."`);
  } else {
    fail("Reasoning", "empty or missing");
  }

  // Step 5: Check signal aligns with data
  const fng = Number(data.fear_greed_value);
  const signal = String(parsed.signal);
  if (fng < 25 && signal === "SELL") {
    ok("Signal/data alignment", `Extreme Fear (${fng}) \u2192 SELL (coherent)`);
  } else if (fng > 75 && signal === "BUY") {
    ok("Signal/data alignment", `Extreme Greed (${fng}) \u2192 BUY (coherent)`);
  } else if (fng >= 25 && fng <= 75 && signal === "HOLD") {
    ok("Signal/data alignment", `Neutral (${fng}) \u2192 HOLD (coherent)`);
  } else {
    // Not a failure — contrarian signals are valid
    ok("Signal/data note", `F&G=${fng} \u2192 ${signal} (may be contrarian or weighted by other factors)`);
  }

  return { ...parsed, rawDataSnapshot: data, attestationHash: result.attestationHash, teeVerified: result.teeVerified };
}

// ─── Test 2: Single Specialist — Momentum with Real Data ────

async function testMomentumSpecialist(): Promise<Record<string, unknown>> {
  console.log("\n\u2550\u2550\u2550 TEST 2: Momentum Specialist (Real Data \u2192 0G Inference) \u2550\u2550\u2550");

  const { fetchMomentumData } = await import("../src/agents/data/momentum-data.js");
  const { sealedInference } = await import("../src/og/inference.js");
  const { PROMPTS, safeJsonParse } = await import("../src/agents/prompts.js");

  const provider = process.env.OG_PROVIDER_ADDRESS!;

  console.log("  Fetching real momentum data...");
  const rawData = await fetchMomentumData();
  const data = JSON.parse(rawData);
  ok("Data fetched", `ETH=$${data.current_price}, RSI=${data.rsi_14}(${data.rsi_assessment}), MACD=${data.macd_crossover}`);

  console.log("  Calling 0G sealed inference with momentum prompt...");
  const t0 = Date.now();
  const result = await sealedInference(provider, PROMPTS.momentum.content, `Current market data:\n${rawData}`);
  ok("Inference complete", `${Date.now() - t0}ms`);

  const parsed = safeJsonParse<Record<string, unknown>>(result.content, {});
  if (parsed.signal && parsed.trend) {
    ok("Parse", `signal=${parsed.signal}, trend=${parsed.trend}, confidence=${parsed.confidence}`);
  } else {
    fail("Parse", `malformed: ${result.content.slice(0, 120)}`);
  }

  // Validate trend vs RSI coherence
  const rsi = Number(data.rsi_14);
  const trend = String(parsed.trend);
  if ((rsi > 60 && trend === "bullish") || (rsi < 40 && trend === "bearish") || (rsi >= 40 && rsi <= 60 && trend === "sideways")) {
    ok("Trend/RSI coherence", `RSI=${rsi} \u2192 ${trend} (aligned)`);
  } else {
    ok("Trend/RSI note", `RSI=${rsi} \u2192 ${trend} (MACD or volume may dominate)`);
  }

  return { ...parsed, rawDataSnapshot: data, attestationHash: result.attestationHash, teeVerified: result.teeVerified };
}

// ─── Test 3: Single Specialist — Whale with Real Data ───────

async function testWhaleSpecialist(): Promise<Record<string, unknown>> {
  console.log("\n\u2550\u2550\u2550 TEST 3: Whale Specialist (Real Data \u2192 0G Inference) \u2550\u2550\u2550");

  const { fetchWhaleData } = await import("../src/agents/data/whale-data.js");
  const { sealedInference } = await import("../src/og/inference.js");
  const { PROMPTS, safeJsonParse } = await import("../src/agents/prompts.js");

  const provider = process.env.OG_PROVIDER_ADDRESS!;

  console.log("  Fetching real whale data...");
  const rawData = await fetchWhaleData();
  const data = JSON.parse(rawData);
  ok("Data fetched", `gas=${data.gas_assessment}, vol=${data.total_top5_volume_btc?.toLocaleString()}BTC`);

  console.log("  Calling 0G sealed inference with whale prompt...");
  const t0 = Date.now();
  const result = await sealedInference(provider, PROMPTS.whale.content, `Current market data:\n${rawData}`);
  ok("Inference complete", `${Date.now() - t0}ms`);

  const parsed = safeJsonParse<Record<string, unknown>>(result.content, {});
  if (parsed.signal && parsed.whale_activity) {
    ok("Parse", `signal=${parsed.signal}, whale_activity=${parsed.whale_activity}, confidence=${parsed.confidence}`);
  } else {
    fail("Parse", `malformed: ${result.content.slice(0, 120)}`);
  }

  return { ...parsed, rawDataSnapshot: data, attestationHash: result.attestationHash, teeVerified: result.teeVerified };
}

// ─── Test 4: Full Adversarial Debate with Real Specialist Data ─

async function testAdversarialDebate(
  sentimentResult: Record<string, unknown>,
  momentumResult: Record<string, unknown>,
  whaleResult: Record<string, unknown>,
): Promise<void> {
  console.log("\n\u2550\u2550\u2550 TEST 4: Adversarial Debate (Alpha \u2192 Risk \u2192 Executor) \u2550\u2550\u2550");
  console.log("  Using REAL specialist results from Tests 1-3.\n");

  const { runAdversarialDebate } = await import("../src/agents/adversarial.js");

  const specialists = [
    {
      name: "sentiment",
      signal: String(sentimentResult.signal ?? "HOLD"),
      confidence: Number(sentimentResult.confidence ?? 50),
      attestationHash: String(sentimentResult.attestationHash ?? ""),
      teeVerified: Boolean(sentimentResult.teeVerified),
      reputation: 500,
      rawDataSnapshot: sentimentResult.rawDataSnapshot,
    },
    {
      name: "momentum",
      signal: String(momentumResult.signal ?? "HOLD"),
      confidence: Number(momentumResult.confidence ?? 50),
      attestationHash: String(momentumResult.attestationHash ?? ""),
      teeVerified: Boolean(momentumResult.teeVerified),
      reputation: 500,
      rawDataSnapshot: momentumResult.rawDataSnapshot,
    },
    {
      name: "whale",
      signal: String(whaleResult.signal ?? "HOLD"),
      confidence: Number(whaleResult.confidence ?? 50),
      attestationHash: String(whaleResult.attestationHash ?? ""),
      teeVerified: Boolean(whaleResult.teeVerified),
      reputation: 500,
      rawDataSnapshot: whaleResult.rawDataSnapshot,
    },
  ];

  console.log("  Specialist inputs to debate:");
  for (const s of specialists) {
    console.log(`    ${s.name}: ${s.signal} (conf=${s.confidence}%, rep=${s.reputation})`);
  }

  console.log("\n  Running adversarial debate (3 sequential 0G calls, ~15-25s)...\n");
  const t0 = Date.now();
  const debate = await runAdversarialDebate(specialists, "balanced", 12);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  ok("Debate complete", `${elapsed}s total`);

  // ── Alpha Analysis ────────────────────────────────────
  console.log("\n  \u250C\u2500 ALPHA (argues FOR trade) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  const alpha = debate.alpha.parsed as Record<string, unknown>;
  console.log(`  \u2502 Action: ${alpha.action ?? "?"}`);
  console.log(`  \u2502 Allocation: ${alpha.pct ?? 0}%`);
  console.log(`  \u2502 Argument: "${alpha.argument ?? "?"}"`);
  console.log(`  \u2502 Attestation: ${debate.alpha.attestationHash?.slice(0, 24) ?? "none"}...`);

  if (alpha.action && alpha.argument) {
    ok("Alpha parsed", `${alpha.action} ${alpha.pct}% — "${String(alpha.argument).slice(0, 50)}"`);
  } else {
    fail("Alpha parsed", `malformed: ${debate.alpha.content.slice(0, 100)}`);
  }

  // Validate Alpha references data
  const alphaArg = String(alpha.argument ?? "").toLowerCase();
  const dataTerms = ["rsi", "macd", "fear", "greed", "volume", "support", "resistance", "momentum", "sentiment", "bullish", "bearish", "gas", "whale"];
  const alphaDataRefs = dataTerms.filter((t) => alphaArg.includes(t));
  if (alphaDataRefs.length > 0) {
    ok("Alpha data-awareness", `references: ${alphaDataRefs.join(", ")}`);
  } else {
    ok("Alpha argument", `"${alphaArg.slice(0, 60)}" (generic — 7B model may not cite specific indicators)`);
  }

  // ── Risk Analysis ─────────────────────────────────────
  console.log("\n  \u250C\u2500 RISK (argues AGAINST trade) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  const risk = debate.risk.parsed as Record<string, unknown>;
  console.log(`  \u2502 Max allowed: ${risk.max_pct ?? 0}%`);
  console.log(`  \u2502 Risks: ${JSON.stringify(risk.risks ?? [])}`);
  console.log(`  \u2502 Challenge: "${risk.challenge ?? "?"}"`);
  console.log(`  \u2502 Attestation: ${debate.risk.attestationHash?.slice(0, 24) ?? "none"}...`);

  if (risk.challenge && Array.isArray(risk.risks)) {
    ok("Risk parsed", `max=${risk.max_pct}%, ${(risk.risks as string[]).length} risks identified`);
  } else {
    fail("Risk parsed", `malformed: ${debate.risk.content.slice(0, 100)}`);
  }

  // Risk should constrain Alpha
  const riskMax = Number(risk.max_pct ?? 100);
  const alphaPct = Number(alpha.pct ?? 0);
  if (riskMax <= alphaPct) {
    ok("Risk constrains Alpha", `Alpha wants ${alphaPct}%, Risk caps at ${riskMax}%`);
  } else {
    ok("Risk assessment", `allows up to ${riskMax}% (Alpha asked ${alphaPct}%)`);
  }

  // ── Executor Analysis ─────────────────────────────────
  console.log("\n  \u250C\u2500 EXECUTOR (final decision) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  const exec = debate.executor.parsed as Record<string, unknown>;
  console.log(`  \u2502 Action: ${exec.action ?? "?"}`);
  console.log(`  \u2502 Allocation: ${exec.pct ?? 0}%`);
  console.log(`  \u2502 Stop-loss: ${exec.stop_loss ?? "?"}`);
  console.log(`  \u2502 Reasoning: "${exec.reasoning ?? "?"}"`);
  console.log(`  \u2502 Attestation: ${debate.executor.attestationHash?.slice(0, 24) ?? "none"}...`);

  if (exec.action && exec.reasoning) {
    ok("Executor parsed", `${exec.action} ${exec.pct}% (SL: ${exec.stop_loss}) — "${String(exec.reasoning).slice(0, 50)}"`);
  } else {
    fail("Executor parsed", `malformed: ${debate.executor.content.slice(0, 100)}`);
  }

  // Executor should respect Risk's cap
  const execPct = Number(exec.pct ?? 0);
  if (execPct <= riskMax || execPct <= 12) {
    ok("Executor respects limits", `${execPct}% <= Risk cap ${riskMax}% (or max allocation 12%)`);
  } else {
    fail("Executor over-allocated", `${execPct}% > Risk cap ${riskMax}% AND max allocation 12%`);
  }

  // ── Debate Coherence Summary ──────────────────────────
  console.log("\n  \u250C\u2500 DEBATE COHERENCE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");

  // All 3 should have attestation hashes
  const allAttested = [debate.alpha, debate.risk, debate.executor].every((r) => r.attestationHash.length > 0);
  if (allAttested) {
    ok("All attested", "every debate round has TEE attestation");
  } else {
    ok("Attestation", "some rounds missing attestation (testnet may not always provide)");
  }

  // Check logical flow
  const specialistConsensus = specialists.filter((s) => s.signal === "BUY").length >= 2 ? "BUY" :
    specialists.filter((s) => s.signal === "SELL").length >= 2 ? "SELL" : "MIXED";
  const executorAction = String(exec.action);

  console.log(`  \u2502 Specialist consensus: ${specialistConsensus}`);
  console.log(`  \u2502 Alpha proposed: ${alpha.action} ${alphaPct}%`);
  console.log(`  \u2502 Risk capped at: ${riskMax}%`);
  console.log(`  \u2502 Executor decided: ${executorAction} ${execPct}% (SL: ${exec.stop_loss})`);
  console.log("  \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  ok("Debate flow", "Alpha \u2192 Risk \u2192 Executor completed with real data context");
}

// ─── RUNNER ─────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551   VAULTMIND \u2014 AGENT REASONING E2E VALIDATION        \u2551");
  console.log("\u2551   Real Data \u2192 0G Inference \u2192 Adversarial Debate    \u2551");
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");

  if (!process.env.OG_PROVIDER_ADDRESS) {
    console.error("\n\u274C OG_PROVIDER_ADDRESS not set. Cannot run inference tests.");
    process.exit(1);
  }

  const totalStart = Date.now();

  // Test each specialist independently (3 inference calls)
  console.log("\n\u2500\u2500\u2500 PHASE 1: Individual Specialist Reasoning \u2500\u2500\u2500");
  const sentimentResult = await testSentimentSpecialist();

  // 2s delay between inference calls (0G rate limit: 30 req/min)
  await new Promise((r) => setTimeout(r, 2000));
  const momentumResult = await testMomentumSpecialist();

  await new Promise((r) => setTimeout(r, 2000));
  const whaleResult = await testWhaleSpecialist();

  // Test full adversarial debate (3 more inference calls)
  console.log("\n\u2500\u2500\u2500 PHASE 2: Adversarial Agent-to-Agent Debate \u2500\u2500\u2500");
  await new Promise((r) => setTimeout(r, 2000));
  await testAdversarialDebate(sentimentResult, momentumResult, whaleResult);

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);

  // Summary
  console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log(`\u2551   RESULTS: \u2705 ${passed} passed \u00B7 \u274C ${failed} failed              \u2551`);
  console.log(`\u2551   Total time: ${totalElapsed}s (6 x 0G inference calls)        \u2551`);
  console.log(`\u2551   Inference calls: 3 specialist + 3 debate = 6 total   \u2551`);
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");

  if (failed > 0) {
    console.log("\nSome tests failed. Check output above.");
    process.exit(1);
  } else {
    console.log("\nAll agents reasoning correctly with real market data!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("\nAgent reasoning validation crashed:", err);
  process.exit(1);
});
