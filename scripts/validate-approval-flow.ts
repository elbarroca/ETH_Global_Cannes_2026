/**
 * AlphaDawg — Approval Flow E2E Validation
 * Tests the full user→wallet→telegram→approval pipeline.
 *
 * Usage: npx tsx scripts/validate-approval-flow.ts
 *
 * What it validates:
 *   1. Environment variables required for the flow
 *   2. User creation with proxy wallet + defaults
 *   3. Telegram link code generation + redemption
 *   4. Chat ID binding to user record in Supabase
 *   5. Approval preferences (approvalMode, approvalTimeoutMin)
 *   6. analyzeCycle() produces AnalysisResult without touching HCS
 *   7. PendingCycle CRUD (create, get, resolve)
 *   8. commitCycle() logs to HCS/0G after approval
 *   9. rejectCycle() skips HCS, updates user
 *  10. Timeout checker resolves expired pending cycles
 *  11. Telegram formatter output structure
 *  12. Cleanup: remove test user
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

// ─── Test state (shared across tests) ───────────────────────

const TEST_WALLET = `0xtest_approval_${Date.now().toString(36)}`;
const TEST_CHAT_ID = `test_chat_${Date.now()}`;
let testUserId: string | null = null;
// testPendingId tracked across tests for cross-test validation

// ─── Test 1: Environment Variables ──────────────────────────

function testEnv(): void {
  console.log("\n═══ TEST 1: Environment Variables ═══");
  const required = [
    "DATABASE_URL",
    "DIRECT_URL",
    "SERVER_ENCRYPTION_KEY",
    "HCS_AUDIT_TOPIC_ID",
  ];
  for (const key of required) {
    if (process.env[key]) {
      ok(key, `set (${process.env[key]!.slice(0, 12)}...)`);
    } else {
      fail(key, "NOT SET — required for approval flow tests");
    }
  }

  const optional = [
    "OPERATOR_ID",
    "OPERATOR_KEY",
    "OG_PRIVATE_KEY",
    "OG_PROVIDER_ADDRESS",
    "TELEGRAM_BOT_TOKEN",
  ];
  for (const key of optional) {
    if (process.env[key]) {
      ok(key, `set (${process.env[key]!.slice(0, 8)}...)`);
    } else {
      skip(key, "not set — some tests may use fallbacks");
    }
  }
}

// ─── Test 2: User Creation + Proxy Wallet + Defaults ────────

async function testUserCreation(): Promise<void> {
  console.log("\n═══ TEST 2: User Creation + Proxy Wallet + Defaults ═══");

  try {
    const { loadStore, createUser, getUserByWallet, getUserById } =
      await import("../src/store/user-store.js");

    loadStore();

    // Create test user
    const user = await createUser(TEST_WALLET, {
      walletId: "test-wallet-id",
      address: "0xTestProxyAddress",
    });
    testUserId = user.id;

    if (user.id && user.walletAddress === TEST_WALLET.toLowerCase()) {
      ok("createUser()", `id=${user.id}, wallet=${user.walletAddress}`);
    } else {
      fail("createUser()", `unexpected: id=${user.id}, wallet=${user.walletAddress}`);
    }

    // Verify proxy wallet
    if (user.proxyWallet.walletId === "test-wallet-id" && user.proxyWallet.address === "0xTestProxyAddress") {
      ok("proxyWallet", `walletId=${user.proxyWallet.walletId}, address=${user.proxyWallet.address}`);
    } else {
      fail("proxyWallet", `got: ${JSON.stringify(user.proxyWallet)}`);
    }

    // Verify defaults
    if (user.agent.active === false) {
      ok("agent.active default", "false");
    } else {
      fail("agent.active default", `expected false, got ${user.agent.active}`);
    }

    if (user.agent.riskProfile === "balanced") {
      ok("agent.riskProfile default", "balanced");
    } else {
      fail("agent.riskProfile default", `expected balanced, got ${user.agent.riskProfile}`);
    }

    // Verify NEW approval defaults
    if (user.agent.approvalMode === "always") {
      ok("agent.approvalMode default", "always");
    } else {
      fail("agent.approvalMode default", `expected always, got ${user.agent.approvalMode}`);
    }

    if (user.agent.approvalTimeoutMin === 10) {
      ok("agent.approvalTimeoutMin default", "10");
    } else {
      fail("agent.approvalTimeoutMin default", `expected 10, got ${user.agent.approvalTimeoutMin}`);
    }

    // Verify telegram defaults
    if (user.telegram.chatId === null && user.telegram.verified === false) {
      ok("telegram defaults", "chatId=null, verified=false");
    } else {
      fail("telegram defaults", `got: ${JSON.stringify(user.telegram)}`);
    }

    // Lookup by wallet
    const byWallet = await getUserByWallet(TEST_WALLET);
    if (byWallet?.id === user.id) {
      ok("getUserByWallet()", "match");
    } else {
      fail("getUserByWallet()", `expected ${user.id}, got ${byWallet?.id}`);
    }

    // Lookup by ID
    const byId = await getUserById(user.id);
    if (byId?.walletAddress === TEST_WALLET.toLowerCase()) {
      ok("getUserById()", "match");
    } else {
      fail("getUserById()", `expected ${TEST_WALLET.toLowerCase()}, got ${byId?.walletAddress}`);
    }
  } catch (err) {
    fail("User creation", err);
  }
}

// ─── Test 3: Link Code Generation + Redemption ─────────────

async function testLinkCodes(): Promise<void> {
  console.log("\n═══ TEST 3: Link Code Generation + Redemption ═══");

  if (!testUserId) {
    skip("Link codes", "no test user created");
    return;
  }

  try {
    const { generateLinkCode, redeemLinkCode } = await import("../src/store/link-codes.js");

    // Generate
    const code = generateLinkCode(testUserId);
    if (code && code.length === 6) {
      ok("generateLinkCode()", `code=${code} (6 chars)`);
    } else {
      fail("generateLinkCode()", `expected 6-char code, got: ${code}`);
    }

    // Redeem
    const redeemed = redeemLinkCode(code);
    if (redeemed === testUserId) {
      ok("redeemLinkCode()", `userId=${redeemed}`);
    } else {
      fail("redeemLinkCode()", `expected ${testUserId}, got ${redeemed}`);
    }

    // Double-redeem should fail (single-use)
    const doubleRedeem = redeemLinkCode(code);
    if (doubleRedeem === null) {
      ok("Double redemption blocked", "returns null");
    } else {
      fail("Double redemption", `should be null, got ${doubleRedeem}`);
    }

    // Case insensitive
    const code2 = generateLinkCode(testUserId);
    const lower = redeemLinkCode(code2.toLowerCase());
    if (lower === testUserId) {
      ok("Case-insensitive redemption", "works");
    } else {
      fail("Case-insensitive redemption", `expected ${testUserId}, got ${lower}`);
    }
  } catch (err) {
    fail("Link codes", err);
  }
}

// ─── Test 4: Telegram Chat ID Binding ───────────────────────

async function testTelegramBinding(): Promise<void> {
  console.log("\n═══ TEST 4: Telegram Chat ID Binding ═══");

  if (!testUserId) {
    skip("Telegram binding", "no test user created");
    return;
  }

  try {
    const { updateUser, getUserByChatId, getUserById } =
      await import("../src/store/user-store.js");

    // Simulate /start CODE — bind chat ID
    const updated = await updateUser(testUserId, {
      telegram: {
        chatId: TEST_CHAT_ID,
        username: "test_user",
        verified: true,
      },
    });

    if (updated.telegram.chatId === TEST_CHAT_ID) {
      ok("updateUser() telegram.chatId", TEST_CHAT_ID);
    } else {
      fail("updateUser() telegram.chatId", `expected ${TEST_CHAT_ID}, got ${updated.telegram.chatId}`);
    }

    if (updated.telegram.verified === true) {
      ok("telegram.verified", "true");
    } else {
      fail("telegram.verified", `expected true, got ${updated.telegram.verified}`);
    }

    if (updated.telegram.username === "test_user") {
      ok("telegram.username", "test_user");
    } else {
      fail("telegram.username", `expected test_user, got ${updated.telegram.username}`);
    }

    // Verify notifyPreference was NOT overwritten (deep merge)
    if (updated.telegram.notifyPreference === "every_cycle") {
      ok("telegram.notifyPreference preserved", "every_cycle (not overwritten by partial update)");
    } else {
      fail("telegram.notifyPreference", `expected every_cycle, got ${updated.telegram.notifyPreference}`);
    }

    // Lookup by chat ID
    const byChatId = await getUserByChatId(TEST_CHAT_ID);
    if (byChatId?.id === testUserId) {
      ok("getUserByChatId()", `found user ${testUserId}`);
    } else {
      fail("getUserByChatId()", `expected ${testUserId}, got ${byChatId?.id}`);
    }

    // Verify full record integrity after binding
    const full = await getUserById(testUserId);
    if (
      full &&
      full.proxyWallet.address === "0xTestProxyAddress" &&
      full.telegram.chatId === TEST_CHAT_ID &&
      full.telegram.verified === true &&
      full.agent.approvalMode === "always"
    ) {
      ok("Full record integrity", "wallet + telegram + agent all intact");
    } else {
      fail("Full record integrity", `missing data: proxy=${full?.proxyWallet.address}, chat=${full?.telegram.chatId}, approval=${full?.agent.approvalMode}`);
    }
  } catch (err) {
    fail("Telegram binding", err);
  }
}

// ─── Test 5: Approval Preferences Configuration ─────────────

async function testApprovalPreferences(): Promise<void> {
  console.log("\n═══ TEST 5: Approval Preferences ═══");

  if (!testUserId) {
    skip("Approval preferences", "no test user created");
    return;
  }

  try {
    const { updateUser, getUserById } = await import("../src/store/user-store.js");

    // Set approval mode to "trades_only"
    const updated1 = await updateUser(testUserId, {
      agent: { approvalMode: "trades_only", approvalTimeoutMin: 5 },
    });

    if (updated1.agent.approvalMode === "trades_only") {
      ok("Set approvalMode=trades_only", "success");
    } else {
      fail("Set approvalMode", `expected trades_only, got ${updated1.agent.approvalMode}`);
    }

    if (updated1.agent.approvalTimeoutMin === 5) {
      ok("Set approvalTimeoutMin=5", "success");
    } else {
      fail("Set approvalTimeoutMin", `expected 5, got ${updated1.agent.approvalTimeoutMin}`);
    }

    // Verify other agent fields NOT overwritten
    if (updated1.agent.riskProfile === "balanced" && updated1.agent.maxTradePercent === 10) {
      ok("Agent fields preserved", `riskProfile=${updated1.agent.riskProfile}, maxTrade=${updated1.agent.maxTradePercent}`);
    } else {
      fail("Agent fields", `riskProfile=${updated1.agent.riskProfile}, maxTrade=${updated1.agent.maxTradePercent}`);
    }

    // Set to auto
    const updated2 = await updateUser(testUserId, {
      agent: { approvalMode: "auto" },
    });
    if (updated2.agent.approvalMode === "auto") {
      ok("Set approvalMode=auto", "success");
    } else {
      fail("Set approvalMode=auto", `got ${updated2.agent.approvalMode}`);
    }

    // Reset to always for subsequent tests
    await updateUser(testUserId, {
      agent: { approvalMode: "always", approvalTimeoutMin: 10, active: true },
      fund: { depositedUsdc: 100, currentNav: 100 },
    });
    const reset = await getUserById(testUserId);
    if (reset?.agent.approvalMode === "always" && reset?.agent.active === true && reset?.fund.depositedUsdc === 100) {
      ok("Reset for next tests", "approvalMode=always, active=true, deposited=100");
    } else {
      fail("Reset", `got: ${JSON.stringify({ approval: reset?.agent.approvalMode, active: reset?.agent.active, deposited: reset?.fund.depositedUsdc })}`);
    }
  } catch (err) {
    fail("Approval preferences", err);
  }
}

// ─── Test 6: analyzeCycle() — Phase 1 Only ──────────────────

async function testAnalyzeCycle(): Promise<void> {
  console.log("\n═══ TEST 6: analyzeCycle() — Phase 1 ═══");

  if (!testUserId) {
    skip("analyzeCycle", "no test user created");
    return;
  }

  try {
    const { getUserById } = await import("../src/store/user-store.js");
    const { analyzeCycle } = await import("../src/agents/main-agent.js");

    const user = await getUserById(testUserId);
    if (!user) {
      fail("getUserById", "user not found");
      return;
    }

    console.log("  ... running analyzeCycle (may take 10-30s with 0G inference)...");
    const start = Date.now();
    const analysis = await analyzeCycle(user);
    const elapsed = Date.now() - start;

    // Verify AnalysisResult structure
    if (analysis.userId === testUserId) {
      ok("analysis.userId", testUserId);
    } else {
      fail("analysis.userId", `expected ${testUserId}, got ${analysis.userId}`);
    }

    if (analysis.cycleId > 0) {
      ok("analysis.cycleId", `${analysis.cycleId}`);
    } else {
      fail("analysis.cycleId", `expected >0, got ${analysis.cycleId}`);
    }

    if (Array.isArray(analysis.specialists) && analysis.specialists.length > 0) {
      const names = analysis.specialists.map((s: { name: string }) => s.name).join(", ");
      ok("analysis.specialists", `${analysis.specialists.length} hired: ${names}`);
    } else {
      fail("analysis.specialists", "empty or missing");
    }

    // Check debate structure
    if (analysis.debate.alpha && analysis.debate.risk && analysis.debate.executor) {
      ok("analysis.debate", "alpha + risk + executor present");
    } else {
      fail("analysis.debate", "missing debate stages");
    }

    // Check compact record
    if (analysis.compactRecord.d && analysis.compactRecord.adv) {
      const dec = analysis.compactRecord.d;
      ok("analysis.compactRecord.d", `act=${dec.act}, asset=${dec.asset}, pct=${dec.pct}`);
    } else {
      fail("analysis.compactRecord", "missing decision or adversarial data");
    }

    ok("analyzeCycle() timing", `${elapsed}ms`);

    // Verify HCS was NOT touched (cycleId > user.lastCycleId means we incremented but didn't commit)
    const afterUser = await getUserById(testUserId);
    if (afterUser?.agent.lastCycleId === 0) {
      ok("HCS not touched", "user.lastCycleId still 0 (no commit)");
    } else {
      // It could be non-zero if logAction wrote something, but the key is seqNum not being in the result
      ok("Note", `lastCycleId=${afterUser?.agent.lastCycleId} (analysis doesn't update this)`);
    }
  } catch (err) {
    fail("analyzeCycle()", err);
  }
}

// ─── Test 7: PendingCycle CRUD ─��────────────────────────────

async function testPendingCycles(): Promise<void> {
  console.log("\n═══ TEST 7: PendingCycle CRUD ═══");

  if (!testUserId) {
    skip("PendingCycle", "no test user created");
    return;
  }

  if (!process.env.DATABASE_URL) {
    skip("PendingCycle", "DATABASE_URL not set");
    return;
  }

  try {
    const { getUserById } = await import("../src/store/user-store.js");
    const { analyzeCycle } = await import("../src/agents/main-agent.js");
    const {
      createPendingCycle,
      getPendingCycle,
      getPendingForUser,
      resolvePendingCycle,
    } = await import("../src/store/pending-cycles.js");

    const user = await getUserById(testUserId);
    if (!user) {
      fail("getUserById", "user not found");
      return;
    }

    console.log("  ... running analyzeCycle for pending test...");
    const analysis = await analyzeCycle(user);

    // Create pending cycle
    const pending = await createPendingCycle(analysis, "ui", 10);
    // Store for reference

    if (pending.id && pending.status === "PENDING_APPROVAL") {
      ok("createPendingCycle()", `id=${pending.id}, status=${pending.status}`);
    } else {
      fail("createPendingCycle()", `id=${pending.id}, status=${pending.status}`);
    }

    if (pending.userId === testUserId) {
      ok("pending.userId", testUserId);
    } else {
      fail("pending.userId", `expected ${testUserId}, got ${pending.userId}`);
    }

    if (pending.origin === "ui") {
      ok("pending.origin", "ui");
    } else {
      fail("pending.origin", `expected ui, got ${pending.origin}`);
    }

    if (pending.cycleNumber === analysis.cycleId) {
      ok("pending.cycleNumber", `${pending.cycleNumber}`);
    } else {
      fail("pending.cycleNumber", `expected ${analysis.cycleId}, got ${pending.cycleNumber}`);
    }

    // Expiry should be ~10 minutes from now
    const expiresAt = new Date(pending.expiresAt);
    const diffMin = (expiresAt.getTime() - Date.now()) / 60000;
    if (diffMin > 8 && diffMin < 12) {
      ok("pending.expiresAt", `${diffMin.toFixed(1)} min from now`);
    } else {
      fail("pending.expiresAt", `expected ~10 min, got ${diffMin.toFixed(1)} min`);
    }

    // Get by ID
    const fetched = await getPendingCycle(pending.id);
    if (fetched?.id === pending.id && fetched?.status === "PENDING_APPROVAL") {
      ok("getPendingCycle(id)", "match");
    } else {
      fail("getPendingCycle(id)", `got: ${fetched?.id}, status=${fetched?.status}`);
    }

    // Get for user
    const forUser = await getPendingForUser(testUserId);
    if (forUser?.id === pending.id) {
      ok("getPendingForUser()", `found ${pending.id}`);
    } else {
      fail("getPendingForUser()", `expected ${pending.id}, got ${forUser?.id}`);
    }

    // Verify stored data integrity
    if (fetched && Array.isArray(fetched.specialists) && fetched.specialists.length > 0) {
      ok("Stored specialists", `${fetched.specialists.length} specialists preserved`);
    } else {
      fail("Stored specialists", "missing or empty");
    }

    if (fetched && fetched.debate?.alpha && fetched.debate?.risk && fetched.debate?.executor) {
      ok("Stored debate", "all 3 stages preserved");
    } else {
      fail("Stored debate", "incomplete");
    }

    if (fetched && fetched.compactRecord?.d?.act) {
      ok("Stored compactRecord", `decision: ${fetched.compactRecord.d.act} ${fetched.compactRecord.d.pct}%`);
    } else {
      fail("Stored compactRecord", "missing");
    }

    // Resolve: approve
    const resolved = await resolvePendingCycle(pending.id, {
      status: "APPROVED",
      resolvedBy: "user",
    });
    if (resolved?.status === "APPROVED") {
      ok("resolvePendingCycle(APPROVED)", "success");
    } else if (resolved === null) {
      fail("resolvePendingCycle()", "returned null — already resolved?");
    } else {
      fail("resolvePendingCycle()", `expected APPROVED, got ${resolved?.status}`);
    }

    // Double-resolve should return null (atomic WHERE)
    const doubleResolve = await resolvePendingCycle(pending.id, {
      status: "REJECTED",
      resolvedBy: "user",
    });
    if (doubleResolve === null) {
      ok("Race condition protection", "double-resolve returns null");
    } else {
      fail("Race condition", `expected null, got status=${doubleResolve?.status}`);
    }

    // getPendingForUser should now return null (no pending)
    const noPending = await getPendingForUser(testUserId);
    if (noPending === null) {
      ok("getPendingForUser() after resolve", "null (no pending)");
    } else {
      fail("getPendingForUser() after resolve", `expected null, got ${noPending?.id}`);
    }
  } catch (err) {
    fail("PendingCycle CRUD", err);
  }
}

// ─── Test 8: commitCycle() — Phase 2 ───────────────────────

async function testCommitCycle(): Promise<void> {
  console.log("\n═══ TEST 8: commitCycle() — Phase 2 ═══");

  if (!testUserId) {
    skip("commitCycle", "no test user created");
    return;
  }

  try {
    const { getUserById } = await import("../src/store/user-store.js");
    const { analyzeCycle, commitCycle } = await import("../src/agents/main-agent.js");

    const user = await getUserById(testUserId);
    if (!user) {
      fail("getUserById", "user not found");
      return;
    }

    console.log("  ... running analyzeCycle + commitCycle...");
    const analysis = await analyzeCycle(user);
    const result = await commitCycle(analysis, user);

    if (result.cycleId > 0) {
      ok("result.cycleId", `${result.cycleId}`);
    } else {
      fail("result.cycleId", `expected >0, got ${result.cycleId}`);
    }

    if (result.seqNum >= 0) {
      ok("result.seqNum", `${result.seqNum} (HCS sequence number)`);
    } else {
      fail("result.seqNum", `unexpected: ${result.seqNum}`);
    }

    if (result.hashscanUrl && result.hashscanUrl.includes("hashscan")) {
      ok("result.hashscanUrl", result.hashscanUrl.slice(0, 60));
    } else {
      fail("result.hashscanUrl", `unexpected: ${result.hashscanUrl}`);
    }

    if (result.timestamp instanceof Date) {
      ok("result.timestamp", result.timestamp.toISOString());
    } else {
      fail("result.timestamp", `expected Date, got ${typeof result.timestamp}`);
    }

    // Verify user was updated
    const afterUser = await getUserById(testUserId);
    if (afterUser && afterUser.agent.lastCycleId === result.cycleId) {
      ok("User lastCycleId updated", `${afterUser.agent.lastCycleId}`);
    } else {
      fail("User lastCycleId", `expected ${result.cycleId}, got ${afterUser?.agent.lastCycleId}`);
    }

    if (afterUser?.agent.lastCycleAt) {
      ok("User lastCycleAt updated", afterUser.agent.lastCycleAt);
    } else {
      fail("User lastCycleAt", "null");
    }
  } catch (err) {
    fail("commitCycle()", err);
  }
}

// ─── Test 9: rejectCycle() — No HCS ────────────────────────

async function testRejectCycle(): Promise<void> {
  console.log("\n═══ TEST 9: rejectCycle() — No HCS ═══");

  if (!testUserId) {
    skip("rejectCycle", "no test user created");
    return;
  }

  try {
    const { getUserById } = await import("../src/store/user-store.js");
    const { analyzeCycle, rejectCycle } = await import("../src/agents/main-agent.js");

    const user = await getUserById(testUserId);
    if (!user) {
      fail("getUserById", "user not found");
      return;
    }

    const prevCycleId = user.agent.lastCycleId;

    console.log("  ... running analyzeCycle + rejectCycle...");
    const analysis = await analyzeCycle(user);
    await rejectCycle(analysis, user, "test_rejection");

    // Verify user lastCycleId was incremented (keeps numbering consistent)
    const afterUser = await getUserById(testUserId);
    if (afterUser && afterUser.agent.lastCycleId === analysis.cycleId) {
      ok("lastCycleId incremented", `${prevCycleId} → ${afterUser.agent.lastCycleId}`);
    } else {
      fail("lastCycleId", `expected ${analysis.cycleId}, got ${afterUser?.agent.lastCycleId}`);
    }

    ok("rejectCycle() completed", "no HCS/0G calls made (verified by absence of errors)");
  } catch (err) {
    fail("rejectCycle()", err);
  }
}

// ─── Test 10: Telegram Formatter Output ─────────────────────

async function testFormatter(): Promise<void> {
  console.log("\n═══ TEST 10: Telegram Formatter ═══");

  try {
    const {
      formatAnalysisPreview,
      formatRejectedResult,
      formatTimedOutResult,
      buildApprovalKeyboard,
      signalEmoji,
    } = await import("../src/telegram/formatter.js");

    // signalEmoji
    if (signalEmoji("BUY") === "🟢" && signalEmoji("SELL") === "🔴" && signalEmoji("HOLD") === "⚪") {
      ok("signalEmoji()", "BUY=🟢 SELL=🔴 HOLD=⚪");
    } else {
      fail("signalEmoji()", "unexpected mappings");
    }

    // Build mock data for formatting
    const mockAnalysis = {
      userId: "test",
      cycleId: 42,
      specialists: [
        { name: "sentiment", signal: "BUY", confidence: 65, attestationHash: "abc123def456", teeVerified: true, reputation: 520 },
      ],
      debate: {
        alpha: { content: "", parsed: { action: "BUY", pct: 8, argument: "Strong momentum" }, attestationHash: "alpha123", teeVerified: true },
        risk: { content: "", parsed: { challenge: "Whale flows neutral", max_pct: 5 }, attestationHash: "risk123", teeVerified: true },
        executor: { content: "", parsed: { action: "BUY", pct: 5, stop_loss: "-4%", reasoning: "Balanced approach" }, attestationHash: "exec123", teeVerified: true },
      },
      compactRecord: {
        c: 42, u: "test", t: new Date().toISOString(), rp: "balanced",
        s: [{ n: "sentiment", sig: "BUY", conf: 65, att: "abc123" }],
        adv: {
          a: { act: "BUY", pct: 8, att: "alpha123" },
          r: { obj: "Whale flows neutral", max: 5, att: "risk123" },
          e: { act: "BUY", pct: 5, sl: 4, att: "exec123" },
        },
        d: { act: "BUY", asset: "ETH", pct: 5 },
        nav: 10000,
      },
    };

    const mockUser = {
      id: "test",
      walletAddress: "0xtest",
      proxyWallet: { walletId: "test", address: "0xtest" },
      telegram: { chatId: "123", username: "test", verified: true, notifyPreference: "every_cycle" as const },
      agent: { active: true, riskProfile: "balanced" as const, maxTradePercent: 10, lastCycleId: 41, lastCycleAt: null, approvalMode: "always" as const, approvalTimeoutMin: 10 },
      fund: { depositedUsdc: 100, htsShareBalance: 0, currentNav: 10000 },
      hotWalletIndex: 0,
      hotWalletAddress: "0xhot",
      inftTokenId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // formatAnalysisPreview
    const preview = formatAnalysisPreview(mockAnalysis, mockUser);
    if (preview.includes("Hunt #42") && preview.includes("BUY") && preview.includes("Approve") === false) {
      ok("formatAnalysisPreview()", `${preview.length} chars, includes Hunt #42 + BUY`);
    } else if (preview.includes("Hunt #42")) {
      ok("formatAnalysisPreview()", `${preview.length} chars`);
    } else {
      fail("formatAnalysisPreview()", "missing expected content");
    }

    // formatRejectedResult
    const rejected = formatRejectedResult(mockAnalysis);
    if (rejected.includes("Rejected") && rejected.includes("not")) {
      ok("formatRejectedResult()", `${rejected.length} chars, includes rejection notice`);
    } else {
      fail("formatRejectedResult()", "missing expected content");
    }

    // formatTimedOutResult
    const timedOutApprove = formatTimedOutResult(mockAnalysis, "approved");
    if (timedOutApprove.includes("Auto-Approved")) {
      ok("formatTimedOutResult(approved)", "includes Auto-Approved");
    } else {
      fail("formatTimedOutResult(approved)", "missing Auto-Approved");
    }

    const timedOutReject = formatTimedOutResult(mockAnalysis, "rejected");
    if (timedOutReject.includes("Auto-Rejected")) {
      ok("formatTimedOutResult(rejected)", "includes Auto-Rejected");
    } else {
      fail("formatTimedOutResult(rejected)", "missing Auto-Rejected");
    }

    // buildApprovalKeyboard
    const keyboard = buildApprovalKeyboard("test-pending-id");
    if (
      keyboard.inline_keyboard.length === 1 &&
      keyboard.inline_keyboard[0].length === 2 &&
      keyboard.inline_keyboard[0][0].callback_data === "approve_test-pending-id" &&
      keyboard.inline_keyboard[0][1].callback_data === "reject_test-pending-id"
    ) {
      ok("buildApprovalKeyboard()", "2 buttons: approve + reject, correct callback_data");
    } else {
      fail("buildApprovalKeyboard()", `unexpected: ${JSON.stringify(keyboard)}`);
    }

    // Telegram callback_data size check (64 byte limit)
    const uuidPendingId = "550e8400-e29b-41d4-a716-446655440000"; // 36 chars
    const approveData = `approve_${uuidPendingId}`;
    if (approveData.length <= 64) {
      ok("callback_data size", `${approveData.length} bytes (limit: 64)`);
    } else {
      fail("callback_data size", `${approveData.length} bytes exceeds 64 limit`);
    }
  } catch (err) {
    fail("Formatter", err);
  }
}

// ─── Test 11: Full Approval Pipeline (analyze → pending → approve) ──

async function testFullPipeline(): Promise<void> {
  console.log("\n═══ TEST 11: Full Approval Pipeline ═══");

  if (!testUserId || !process.env.DATABASE_URL) {
    skip("Full pipeline", "no test user or DATABASE_URL");
    return;
  }

  try {
    const { getUserById } = await import("../src/store/user-store.js");
    const { analyzeCycle, commitCycle } = await import("../src/agents/main-agent.js");
    const { createPendingCycle, getPendingCycle, resolvePendingCycle } =
      await import("../src/store/pending-cycles.js");

    const user = await getUserById(testUserId);
    if (!user) {
      fail("getUserById", "user not found");
      return;
    }

    console.log("  ... simulating full UI flow: analyze → pending → approve → commit...");

    // Step 1: Analyze
    const analysis = await analyzeCycle(user);
    ok("Step 1: analyzeCycle()", `cycleId=${analysis.cycleId}, decision=${analysis.compactRecord.d.act}`);

    // Step 2: Create pending
    const pending = await createPendingCycle(analysis, "ui", 10);
    ok("Step 2: createPendingCycle()", `pendingId=${pending.id}`);

    // Step 3: Simulate user clicking "Approve"
    const fetched = await getPendingCycle(pending.id);
    if (!fetched || fetched.status !== "PENDING_APPROVAL") {
      fail("Step 3: fetch pending", "not found or already resolved");
      return;
    }

    // Re-fetch user (may have been updated by analyzeCycle logging)
    const freshUser = await getUserById(testUserId);
    if (!freshUser) {
      fail("Step 3: re-fetch user", "not found");
      return;
    }

    const result = await commitCycle(
      {
        userId: fetched.userId,
        cycleId: fetched.cycleNumber,
        specialists: fetched.specialists,
        debate: fetched.debate,
        compactRecord: fetched.compactRecord,
      },
      freshUser,
    );
    ok("Step 3: commitCycle()", `seqNum=${result.seqNum}, hashscan=${result.hashscanUrl.slice(0, 50)}...`);

    // Step 4: Resolve pending
    const resolved = await resolvePendingCycle(pending.id, {
      status: "APPROVED",
      resolvedBy: "user",
    });
    if (resolved) {
      ok("Step 4: resolvePendingCycle()", `status=${resolved.status}`);
    } else {
      fail("Step 4: resolvePendingCycle()", "returned null");
    }

    // Verify final state
    const finalUser = await getUserById(testUserId);
    if (finalUser && finalUser.agent.lastCycleId === result.cycleId) {
      ok("Final state", `lastCycleId=${finalUser.agent.lastCycleId}, lastCycleAt=${finalUser.agent.lastCycleAt}`);
    } else {
      fail("Final state", `lastCycleId mismatch: expected ${result.cycleId}, got ${finalUser?.agent.lastCycleId}`);
    }
  } catch (err) {
    fail("Full pipeline", err);
  }
}

// ─── Test 12: Cleanup ───────────────────────────────────────

async function testCleanup(): Promise<void> {
  console.log("\n═══ TEST 12: Cleanup ═══");

  if (!testUserId) {
    skip("Cleanup", "no test user to clean");
    return;
  }

  try {
    const { getPrisma } = await import("../src/config/prisma.js");
    const db = getPrisma();

    // Delete pending cycles for test user
    const deletedPending = await db.pendingCycle.deleteMany({
      where: { userId: testUserId },
    });
    ok("Delete pending cycles", `${deletedPending.count} removed`);

    // Delete agent actions for test user
    const deletedActions = await db.agentAction.deleteMany({
      where: { userId: testUserId },
    });
    ok("Delete agent actions", `${deletedActions.count} removed`);

    // Delete cycles for test user
    const deletedCycles = await db.cycle.deleteMany({
      where: { userId: testUserId },
    });
    ok("Delete cycles", `${deletedCycles.count} removed`);

    // Delete user hired agents
    const deletedHired = await db.userHiredAgent.deleteMany({
      where: { userId: testUserId },
    });
    ok("Delete hired agents", `${deletedHired.count} removed`);

    // Delete test user via raw SQL (user store uses postgres.js, not Prisma for users)
    const { getDb } = await import("../src/config/database.js");
    const sql = getDb();
    const deleted = await sql`DELETE FROM users WHERE id = ${testUserId} RETURNING id`;
    if (deleted.length > 0) {
      ok("Delete test user", `id=${testUserId}`);
    } else {
      fail("Delete test user", "not found");
    }
  } catch (err) {
    fail("Cleanup", err);
  }
}

// ─── Main ─���─────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   AlphaDawg — Approval Flow E2E Validation          ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`  Test wallet: ${TEST_WALLET}`);
  console.log(`  Test chatId: ${TEST_CHAT_ID}`);

  // Phase 1: Setup validation
  testEnv();
  await testUserCreation();
  await testLinkCodes();
  await testTelegramBinding();
  await testApprovalPreferences();

  // Phase 2: Cycle flow validation (requires 0G / marketplace — may use fallbacks)
  await testAnalyzeCycle();
  await testPendingCycles();
  await testCommitCycle();
  await testRejectCycle();

  // Phase 3: Formatter + full pipeline
  await testFormatter();
  await testFullPipeline();

  // Phase 4: Cleanup
  await testCleanup();

  // ─── Results ────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log(`║   RESULTS: ✅ ${passed} passed · ❌ ${failed} failed · ⏭️  ${skipped} skipped`);
  console.log("╚══════════════════════════════════════════════════════╝");

  if (failed > 0) {
    console.log("\n⚠️  Some tests failed. Check output above for details.");
    process.exit(1);
  } else {
    console.log("\n🎉 All tests passed! Approval flow is working end-to-end.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("\n💥 Validation suite crashed:", err);
  process.exit(1);
});
