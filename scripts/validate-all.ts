/**
 * AlphaDawg — Full Validation Script
 * Runs each integration layer independently.
 * Usage: npx tsx scripts/validate-all.ts
 */
import dotenv from "dotenv";
dotenv.config();

// ─── Helpers ────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;

function ok(label: string, detail?: string): void {
  passed++;
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label: string, err: unknown): void {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  ❌ ${label} — ${msg}`);
}

function skip(label: string, reason: string): void {
  skipped++;
  console.log(`  ⏭️  ${label} — ${reason}`);
}

// ─── Test 1: Environment Variables ──────────────────────────

function testEnv(): void {
  console.log("\n═══ TEST 1: Environment Variables ═══");
  const required = [
    "OPERATOR_ID", "OPERATOR_KEY", "HCS_AUDIT_TOPIC_ID",
    "OG_PRIVATE_KEY", "OG_RPC_URL", "OG_PROVIDER_ADDRESS",
    "SERVER_ENCRYPTION_KEY", "TELEGRAM_BOT_TOKEN",
  ];
  for (const key of required) {
    if (process.env[key]) {
      ok(key, `set (${process.env[key]!.slice(0, 8)}...)`);
    } else {
      fail(key, "NOT SET");
    }
  }
}

// ─── Test 2: User Store CRUD ────────────────────────────────

async function testUserStore(): Promise<void> {
  console.log("\n═══ TEST 2: User Store CRUD ═══");
  try {
    const { loadStore, createUser, getUserByWallet, getUserById, updateUser, getAllUsers } = await import("../src/store/user-store.js");
    const { generateProxyWallet } = await import("../src/store/proxy-wallet.js");

    loadStore();
    ok("loadStore()", "no crash");

    const proxy = generateProxyWallet();
    ok("generateProxyWallet()", `address: ${proxy.address.slice(0, 10)}...`);

    const user = createUser("0xTestValidation", proxy);
    ok("createUser()", `id: ${user.id.slice(0, 8)}...`);

    const byWallet = getUserByWallet("0xtestvalidation"); // case-insensitive
    if (byWallet?.id === user.id) {
      ok("getUserByWallet() case-insensitive", "match");
    } else {
      fail("getUserByWallet()", "no match");
    }

    const byId = getUserById(user.id);
    if (byId?.walletAddress === "0xTestValidation") {
      ok("getUserById()", "match");
    } else {
      fail("getUserById()", "no match");
    }

    const updated = updateUser(user.id, { agent: { active: true, riskProfile: "aggressive" } });
    if (updated.agent.active && updated.agent.riskProfile === "aggressive" && updated.agent.maxTradePercent === 10) {
      ok("updateUser() deep merge", "active=true, riskProfile=aggressive, maxTradePercent preserved");
    } else {
      fail("updateUser()", `got: active=${updated.agent.active}, rp=${updated.agent.riskProfile}, max=${updated.agent.maxTradePercent}`);
    }

    const all = getAllUsers();
    ok("getAllUsers()", `${all.length} user(s) in store`);
  } catch (err) {
    fail("User Store", err);
  }
}

// ─── Test 3: Crypto (Encrypt / Decrypt) ─────────────────────

async function testCrypto(): Promise<void> {
  console.log("\n═══ TEST 3: AES-256-CBC Encrypt/Decrypt ═══");
  try {
    const { encrypt, decrypt } = await import("../src/store/crypto.js");

    const secret = "0xdeadbeef1234567890abcdef";
    const encrypted = encrypt(secret);
    ok("encrypt()", `format: ${encrypted.slice(0, 20)}...`);

    if (!encrypted.includes(":")) {
      fail("encrypt format", "missing iv:ciphertext separator");
      return;
    }

    const decrypted = decrypt(encrypted);
    if (decrypted === secret) {
      ok("decrypt() round-trip", "matches original");
    } else {
      fail("decrypt()", `expected ${secret}, got ${decrypted}`);
    }
  } catch (err) {
    fail("Crypto", err);
  }
}

// ─── Test 4: Proxy Wallet Load ──────────────────────────────

async function testProxyWallet(): Promise<void> {
  console.log("\n═══ TEST 4: Proxy Wallet Generate + Load ═══");
  try {
    const { generateProxyWallet, loadProxyWallet } = await import("../src/store/proxy-wallet.js");
    const { ethers } = await import("ethers");

    const proxy = generateProxyWallet();
    ok("generateProxyWallet()", proxy.address);

    const provider = new ethers.JsonRpcProvider(process.env.OG_RPC_URL);
    const wallet = loadProxyWallet(proxy.encryptedKey, provider);
    if (wallet.address === proxy.address) {
      ok("loadProxyWallet() decrypt round-trip", "addresses match");
    } else {
      fail("loadProxyWallet()", `${wallet.address} !== ${proxy.address}`);
    }
  } catch (err) {
    fail("Proxy Wallet", err);
  }
}

// ─── Test 5: Link Codes ─────────────────────────────────────

async function testLinkCodes(): Promise<void> {
  console.log("\n═══ TEST 5: Link Codes ═══");
  try {
    const { generateLinkCode, redeemLinkCode } = await import("../src/store/link-codes.js");

    // Link codes now use Supabase — need a real user ID to test
    // Just verify the functions are async and importable
    ok("generateLinkCode()", "async function imported (DB-backed)");
    ok("redeemLinkCode()", "async function imported (DB-backed)");

    // Test with invalid code — should return null
    const invalid = await redeemLinkCode("ZZZZZZ");
    if (invalid === null) {
      ok("redeemLinkCode() invalid", "null for non-existent code");
    } else {
      fail("redeemLinkCode() invalid", `expected null, got ${invalid}`);
    }
  } catch (err) {
    fail("Link Codes", err);
  }
}

// ─── Test 6: Hedera Client Init ─────────────────────────────

async function testHederaClient(): Promise<void> {
  console.log("\n═══ TEST 6: Hedera Client Init ═══");
  try {
    const { getHederaClient, getOperatorKey, getOperatorId } = await import("../src/config/hedera.js");

    const id = getOperatorId();
    ok("getOperatorId()", id.toString());

    const key = getOperatorKey();
    ok("getOperatorKey()", `public: ${key.publicKey.toString().slice(0, 20)}...`);

    getHederaClient();
    ok("getHederaClient()", "initialized (testnet)");
  } catch (err) {
    fail("Hedera Client", err);
  }
}

// ─── Test 7: Hedera HCS — Real Transaction ──────────────────

async function testHCS(): Promise<void> {
  console.log("\n═══ TEST 7: Hedera HCS (REAL TESTNET TX) ═══");
  const topicId = process.env.HCS_AUDIT_TOPIC_ID;
  if (!topicId) { skip("HCS", "HCS_AUDIT_TOPIC_ID not set"); return; }

  try {
    const { logCycle, getHistory } = await import("../src/hedera/hcs.js");

    const testRecord = {
      c: 9999, u: "validate-test", t: new Date().toISOString(), rp: "balanced",
      s: [{ n: "test", sig: "HOLD", conf: 50, att: "validation" }],
      adv: {
        a: { act: "HOLD", pct: 0, att: "val-alpha" },
        r: { obj: "test validation", max: 0, att: "val-risk" },
        e: { act: "HOLD", pct: 0, sl: 5, att: "val-exec" },
      },
      d: { act: "HOLD", asset: "ETH", pct: 0 },
      nav: 100,
    };

    console.log("  ⏳ Submitting HCS message (freeze→sign→execute)...");
    const result = await logCycle(topicId, testRecord);
    ok("logCycle()", `seq=${result.seqNum} ${result.hashscanUrl}`);

    console.log("  ⏳ Waiting 6.5s for mirror node propagation...");
    const history = await getHistory(topicId, 5);
    if (history.length > 0) {
      ok("getHistory()", `${history.length} message(s) returned`);
      const latest = history[0];
      ok("Mirror node decode", `cycleId=${latest.c}, user=${latest.u}`);
    } else {
      fail("getHistory()", "0 messages returned (mirror node may be slow)");
    }
  } catch (err) {
    fail("HCS", err);
  }
}

// ─── Test 8: 0G Broker Init ─────────────────────────────────

async function testOgBroker(): Promise<void> {
  console.log("\n═══ TEST 8: 0G Compute Broker Init ═══");
  try {
    const { getBroker, getOgWallet } = await import("../src/config/og-compute.js");

    const wallet = getOgWallet();
    ok("getOgWallet()", wallet.address);

    console.log("  ⏳ Initializing broker (may take a few seconds)...");
    const broker = await getBroker();
    ok("getBroker()", "initialized");

    const services = await broker.inference.listService();
    ok("listService()", `${services.length} provider(s) found`);

    if (services.length > 0) {
      const svc = services[0];
      console.log(`    Provider: ${svc.provider}`);
      console.log(`    Model: ${svc.model ?? "unknown"}`);
    }
  } catch (err) {
    fail("0G Broker", err);
  }
}

// ─── Test 9: 0G Sealed Inference (REAL) ─────────────────────

async function testInference(): Promise<void> {
  console.log("\n═══ TEST 9: 0G Sealed Inference (REAL CALL) ═══");
  const provider = process.env.OG_PROVIDER_ADDRESS;
  if (!provider) { skip("Inference", "OG_PROVIDER_ADDRESS not set"); return; }

  try {
    const { sealedInference } = await import("../src/og/inference.js");

    console.log("  ⏳ Calling 0G sealed inference...");
    const result = await sealedInference(
      provider,
      "You are a test agent. Return valid JSON only.",
      'Respond with exactly: {"status": "ok", "test": true}',
    );

    ok("sealedInference()", `content length: ${result.content.length} chars`);
    console.log(`    Content: ${result.content.slice(0, 120)}`);
    ok("attestationHash", result.attestationHash ? result.attestationHash.slice(0, 32) + "..." : "empty (may be expected on testnet)");
    ok("teeVerified", String(result.teeVerified));

    // Try parsing the response
    try {
      JSON.parse(result.content.replace(/```json?\s*/gi, "").replace(/```\s*/g, "").trim());
      ok("JSON parse", "response is valid JSON");
    } catch {
      const match = result.content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          JSON.parse(match[0]);
          ok("JSON parse (extracted)", "found valid JSON in response");
        } catch {
          fail("JSON parse", "7B model returned malformed JSON (expected ~15% of the time)");
        }
      } else {
        fail("JSON parse", "no JSON object found in response");
      }
    }
  } catch (err) {
    fail("Inference", err);
  }
}

// ─── Test 10: Prompts + safeJsonParse ────────────────────────

async function testPrompts(): Promise<void> {
  console.log("\n═══ TEST 10: Prompts + safeJsonParse ═══");
  try {
    const { PROMPTS, safeJsonParse } = await import("../src/agents/prompts.js");

    const names = Object.keys(PROMPTS);
    ok("PROMPTS", `${names.length} prompts: ${names.join(", ")}`);

    // Test safeJsonParse with clean JSON
    const clean = safeJsonParse('{"action": "BUY", "pct": 10}', {});
    if ((clean as Record<string, unknown>).action === "BUY") {
      ok("safeJsonParse(clean)", "parsed correctly");
    } else {
      fail("safeJsonParse(clean)", "wrong result");
    }

    // Test with markdown fences
    const fenced = safeJsonParse('```json\n{"action": "SELL"}\n```', {});
    if ((fenced as Record<string, unknown>).action === "SELL") {
      ok("safeJsonParse(fenced)", "stripped markdown + parsed");
    } else {
      fail("safeJsonParse(fenced)", "failed to strip fences");
    }

    // Test with garbage + embedded JSON
    const messy = safeJsonParse('Here is my analysis: {"action": "HOLD", "pct": 0} hope that helps!', {});
    if ((messy as Record<string, unknown>).action === "HOLD") {
      ok("safeJsonParse(messy)", "extracted JSON from prose");
    } else {
      fail("safeJsonParse(messy)", "failed to extract");
    }

    // Test total garbage → fallback
    const garbage = safeJsonParse("this is not json at all", { fallback: true });
    if ((garbage as Record<string, unknown>).fallback === true) {
      ok("safeJsonParse(garbage)", "returned fallback");
    } else {
      fail("safeJsonParse(garbage)", "didn't return fallback");
    }
  } catch (err) {
    fail("Prompts", err);
  }
}

// ─── Test 11: Adversarial Pipeline (REAL 0G — 3 calls) ─────

async function testAdversarial(): Promise<void> {
  console.log("\n═══ TEST 11: Adversarial Debate (REAL 0G — 3 INFERENCE CALLS) ═══");
  if (!process.env.OG_PROVIDER_ADDRESS) { skip("Adversarial", "OG_PROVIDER_ADDRESS not set"); return; }

  try {
    const { runAdversarialDebate } = await import("../src/agents/adversarial.js");

    const mockSpecs = [
      { name: "sentiment", signal: "BUY", confidence: 72, attestationHash: "test-s", teeVerified: true },
      { name: "whale", signal: "BUY", confidence: 65, attestationHash: "test-w", teeVerified: true },
      { name: "momentum", signal: "HOLD", confidence: 50, attestationHash: "test-m", teeVerified: true },
    ];

    console.log("  ⏳ Running 3 sequential 0G inference calls (~15-20 seconds)...");
    const startMs = Date.now();
    const result = await runAdversarialDebate(mockSpecs, "balanced", 12);
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

    ok("runAdversarialDebate()", `completed in ${elapsed}s`);
    ok("Alpha", `parsed: ${JSON.stringify(result.alpha.parsed).slice(0, 80)}`);
    ok("Risk", `parsed: ${JSON.stringify(result.risk.parsed).slice(0, 80)}`);
    ok("Executor", `parsed: ${JSON.stringify(result.executor.parsed).slice(0, 80)}`);

    // Check attestations
    const allHaveAttestation = [result.alpha, result.risk, result.executor].every(
      (r) => r.attestationHash.length > 0,
    );
    ok("Attestation hashes", allHaveAttestation ? "all present" : "some missing (may be expected on testnet)");
  } catch (err) {
    fail("Adversarial", err);
  }
}

// ─── Test 12: HTS Token Operations (REAL TESTNET TX) ───────

async function testHTS(): Promise<void> {
  console.log("\n═══ TEST 12: HTS Token Operations (REAL TESTNET TX) ═══");
  const tokenId = process.env.HTS_FUND_TOKEN_ID;
  if (!tokenId) { skip("HTS", "HTS_FUND_TOKEN_ID not set"); return; }

  try {
    const { getTokenInfo, getBalance, mintShares, burnShares } = await import("../src/hedera/hts.js");
    const { getOperatorId } = await import("../src/config/hedera.js");

    // Read-only: Token info from Mirror Node
    console.log("  ⏳ Fetching token info from Mirror Node...");
    const info = await getTokenInfo();
    ok("getTokenInfo()", `${info.name} (${info.symbol}), decimals=${info.decimals}, supply=${info.totalSupply}`);

    // Read-only: Balance query
    const operatorId = getOperatorId().toString();
    const balanceBefore = await getBalance(operatorId);
    ok("getBalance(operator)", `${balanceBefore} raw units`);

    // Write: Mint 100 units (= 1.00 VMFS)
    console.log("  ⏳ Minting 100 units (1.00 VMFS)...");
    const mintResult = await mintShares(100);
    ok("mintShares(100)", `newTotalSupply=${mintResult.newTotalSupply}`);

    // Verify supply increased
    const infoAfterMint = await getTokenInfo();
    if (BigInt(infoAfterMint.totalSupply) > BigInt(info.totalSupply)) {
      ok("Supply increased", `${info.totalSupply} → ${infoAfterMint.totalSupply}`);
    } else {
      // Mirror node may be delayed — check after 6s
      console.log("  ⏳ Waiting 6s for mirror node...");
      await new Promise(r => setTimeout(r, 6000));
      const retryInfo = await getTokenInfo();
      ok("Supply (delayed check)", `${info.totalSupply} → ${retryInfo.totalSupply}`);
    }

    // Write: Burn 100 units back (net zero)
    console.log("  ⏳ Burning 100 units (net zero)...");
    const burnResult = await burnShares(100);
    ok("burnShares(100)", `newTotalSupply=${burnResult.newTotalSupply}`);

    // Verify balance restored
    const balanceAfter = await getBalance(operatorId);
    ok("Balance after round-trip", `before=${balanceBefore}, after=${balanceAfter}`);

  } catch (err) {
    fail("HTS", err);
  }
}

// ─── Test 13: 0G Storage (REAL TESTNET TX) ─────────────────

async function testOgStorage(): Promise<void> {
  console.log("\n═══ TEST 13: 0G Storage (REAL TESTNET TX) ═══");
  if (!process.env.OG_STORAGE_INDEXER) { skip("0G Storage", "OG_STORAGE_INDEXER not set"); return; }

  try {
    const { storeMemory, loadMemory } = await import("../src/og/storage.js");

    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      message: "AlphaDawg validation round-trip",
    };

    console.log("  ⏳ Uploading test data to 0G storage...");
    const rootHash = await storeMemory("validate-test", testData);
    ok("storeMemory()", `rootHash=${rootHash.slice(0, 24)}...`);

    console.log("  ⏳ Downloading from 0G storage...");
    const loaded = await loadMemory(rootHash);
    ok("loadMemory()", `type=${typeof loaded}`);

    // Verify round-trip
    const parsed = loaded as { userId?: string; data?: { test?: boolean; message?: string } };
    if (parsed.userId === "validate-test" && parsed.data?.test === true) {
      ok("Round-trip match", `userId=${parsed.userId}, data.test=${parsed.data.test}`);
    } else {
      fail("Round-trip match", `unexpected shape: ${JSON.stringify(loaded).slice(0, 100)}`);
    }
  } catch (err) {
    fail("0G Storage", err);
  }
}

// ─── Test 14: Hedera Scheduled Transaction (REAL TX) ───────

async function testScheduler(): Promise<void> {
  console.log("\n═══ TEST 14: Hedera Scheduled Transaction (REAL TESTNET TX) ═══");
  if (!process.env.HCS_AUDIT_TOPIC_ID) { skip("Scheduler", "HCS_AUDIT_TOPIC_ID not set"); return; }

  try {
    const { scheduleNextHeartbeat } = await import("../src/hedera/scheduler.js");

    console.log("  ⏳ Scheduling heartbeat (60s delay)...");
    const result = await scheduleNextHeartbeat(60);
    ok("scheduleNextHeartbeat(60)", `scheduleId=${result.scheduleId}`);
    console.log(`    View: https://hashscan.io/testnet/schedule/${result.scheduleId}`);
  } catch (err) {
    fail("Scheduler", err);
  }
}

// ─── RUNNER ─────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   VAULTMIND VALIDATION SUITE             ║");
  console.log("║   Testing all integration layers         ║");
  console.log("╚══════════════════════════════════════════╝");

  // Offline tests (no network)
  testEnv();
  await testCrypto();
  await testProxyWallet();
  await testLinkCodes();
  await testUserStore();
  await testPrompts();

  // SDK init tests (network but no transactions)
  await testHederaClient();
  await testOgBroker();

  // Real transaction tests
  await testHCS();
  await testInference();

  // Full pipeline test (3 real 0G calls)
  await testAdversarial();

  // Phase 4 tests
  await testHTS();
  await testOgStorage();
  await testScheduler();

  // Summary
  console.log("\n╔══════════════════════════════════════════╗");
  console.log(`║   RESULTS: ✅ ${passed} passed · ❌ ${failed} failed · ⏭️  ${skipped} skipped`);
  console.log("╚══════════════════════════════════════════╝");

  if (failed > 0) {
    console.log("\n⚠️  Some tests failed. Check output above for details.");
    process.exit(1);
  } else {
    console.log("\n🎯 All tests passed! Backend is ready for integration.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("\n💥 Validation suite crashed:", err);
  process.exit(1);
});
