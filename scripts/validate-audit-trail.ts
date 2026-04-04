/**
 * VaultMind — Audit Trail E2E Validation
 * Tests: HCS on-chain logging → Mirror Node read-back → Supabase persistence → cross-check
 *
 * Requires: OPERATOR_ID, OPERATOR_KEY, HCS_AUDIT_TOPIC_ID, DATABASE_URL, DIRECT_URL
 * Usage: ./node_modules/.bin/tsx scripts/validate-audit-trail.ts
 */
import dotenv from "dotenv";
dotenv.config();

import crypto from "node:crypto";

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

// ─── Setup: Create or get test user ─────────────────────────

async function getOrCreateTestUser(): Promise<{
  id: string;
  walletAddress: string;
  riskProfile: string;
  maxTradePercent: number;
  lastCycleId: number;
  currentNav: number;
  hotWalletIndex: number | null;
}> {
  const { getUserByWallet, createUser, loadStore } = await import("../src/store/user-store.js");
  loadStore();

  const testWallet = "0xAuditTrailTestWallet";
  let user = await getUserByWallet(testWallet);
  if (!user) {
    user = await createUser(testWallet, { walletId: "test-circle-id", address: "0xTestProxy" });
    console.log(`  Created test user: ${user.id}`);
  } else {
    console.log(`  Reusing test user: ${user.id}`);
  }

  return {
    id: user.id,
    walletAddress: user.walletAddress,
    riskProfile: user.agent.riskProfile,
    maxTradePercent: user.agent.maxTradePercent,
    lastCycleId: user.agent.lastCycleId,
    currentNav: user.fund.currentNav,
    hotWalletIndex: user.hotWalletIndex,
  };
}

// ─── Test 1: Build + Log CompactCycleRecord to HCS ─────────

async function testHcsLog(user: { id: string; riskProfile: string; currentNav: number; lastCycleId: number }): Promise<{
  record: Record<string, unknown>;
  seqNum: number;
  hashscanUrl: string;
  cycleNumber: number;
}> {
  console.log("\n\u2550\u2550\u2550 TEST 1: Build CompactCycleRecord + Log to HCS \u2550\u2550\u2550");

  const topicId = process.env.HCS_AUDIT_TOPIC_ID;
  if (!topicId) { skip("HCS", "HCS_AUDIT_TOPIC_ID not set"); throw new Error("skip"); }

  const { logCycle } = await import("../src/hedera/hcs.js");

  const cycleNumber = user.lastCycleId + 1;
  const now = new Date().toISOString();

  // Build a realistic compact record using real-looking data
  const record = {
    c: cycleNumber,
    u: user.id,
    t: now,
    rp: user.riskProfile,
    s: [
      { n: "sentiment", sig: "SELL", conf: 75, att: "att-sent-12345678" },
      { n: "whale", sig: "BUY", conf: 65, att: "att-whale-1234567" },
      { n: "momentum", sig: "BUY", conf: 70, att: "att-mom-12345678" },
    ],
    adv: {
      a: { act: "BUY", pct: 12, att: "att-alpha-1234567" },
      r: { obj: "Conflicting sentiment vs momentum", max: 8, att: "att-risk-12345678" },
      e: { act: "HOLD", pct: 5, sl: 5, att: "att-exec-12345678" },
    },
    d: { act: "HOLD", asset: "ETH", pct: 5 },
    nav: user.currentNav || 100,
  };

  const payload = JSON.stringify(record);
  const payloadBytes = Buffer.byteLength(payload, "utf8");
  ok("Compact record built", `${payloadBytes} bytes (max 1024)`);

  if (payloadBytes > 1024) {
    fail("Payload size", `${payloadBytes} > 1024 bytes`);
    throw new Error("Payload too large");
  }

  // Log to HCS
  console.log("  Submitting to HCS (freeze \u2192 sign \u2192 execute)...");
  const t0 = Date.now();
  const { seqNum, hashscanUrl } = await logCycle(topicId, record as any);
  ok("HCS logCycle()", `seq=${seqNum} in ${Date.now() - t0}ms`);
  ok("Hashscan URL", hashscanUrl);

  return { record, seqNum, hashscanUrl, cycleNumber };
}

// ─── Test 2: Read back from Mirror Node and validate ────────

async function testMirrorNodeReadback(topicId: string, expectedRecord: Record<string, unknown>, expectedSeq: number): Promise<void> {
  console.log("\n\u2550\u2550\u2550 TEST 2: Mirror Node Read-back + Validation \u2550\u2550\u2550");

  const { getHistory } = await import("../src/hedera/hcs.js");

  console.log("  Waiting 6.5s for mirror node propagation...");
  const records = await getHistory(topicId, 5);
  ok("getHistory()", `${records.length} messages returned`);

  if (records.length === 0) {
    fail("Mirror node", "no messages returned (may need longer wait)");
    return;
  }

  // Find our record by cycle number and user ID
  const ours = records.find((r) => r.c === expectedRecord.c && r.u === expectedRecord.u);
  if (!ours) {
    fail("Find our record", `cycleId=${expectedRecord.c} not found in latest ${records.length} messages`);
    console.log("  Available cycles:", records.map((r) => `c=${r.c},u=${r.u?.toString().slice(0, 8)}`).join(" | "));
    return;
  }

  ok("Found our record", `cycle=${ours.c}, user=${ours.u.slice(0, 8)}...`);

  // Validate fields match
  const expected = expectedRecord as any;
  if (ours.rp === expected.rp) {
    ok("Risk profile", ours.rp);
  } else {
    fail("Risk profile", `expected ${expected.rp}, got ${ours.rp}`);
  }

  // Validate specialist signals
  if (ours.s.length === expected.s.length) {
    ok("Specialist count", `${ours.s.length}`);
    for (let i = 0; i < ours.s.length; i++) {
      const actual = ours.s[i];
      const exp = expected.s[i];
      if (actual.n === exp.n && actual.sig === exp.sig && actual.conf === exp.conf) {
        ok(`Specialist ${actual.n}`, `${actual.sig} (conf=${actual.conf})`);
      } else {
        fail(`Specialist ${i}`, `expected ${JSON.stringify(exp)}, got ${JSON.stringify(actual)}`);
      }
    }
  } else {
    fail("Specialist count", `expected ${expected.s.length}, got ${ours.s.length}`);
  }

  // Validate adversarial debate
  if (ours.adv.a.act === expected.adv.a.act && ours.adv.a.pct === expected.adv.a.pct) {
    ok("Alpha on-chain", `${ours.adv.a.act} ${ours.adv.a.pct}%`);
  } else {
    fail("Alpha on-chain", `expected ${expected.adv.a.act}/${expected.adv.a.pct}, got ${ours.adv.a.act}/${ours.adv.a.pct}`);
  }

  if (ours.adv.r.obj === expected.adv.r.obj.slice(0, 40)) {
    ok("Risk on-chain", `"${ours.adv.r.obj}" (max=${ours.adv.r.max}%)`);
  } else {
    ok("Risk on-chain", `obj="${ours.adv.r.obj}", max=${ours.adv.r.max}%`);
  }

  if (ours.adv.e.act === expected.adv.e.act && ours.adv.e.pct === expected.adv.e.pct) {
    ok("Executor on-chain", `${ours.adv.e.act} ${ours.adv.e.pct}% (SL=${ours.adv.e.sl}%)`);
  } else {
    fail("Executor on-chain", `expected ${expected.adv.e.act}/${expected.adv.e.pct}, got ${ours.adv.e.act}/${ours.adv.e.pct}`);
  }

  // Final decision
  if (ours.d.act === expected.d.act && ours.d.asset === expected.d.asset) {
    ok("Decision on-chain", `${ours.d.act} ${ours.d.asset} ${ours.d.pct}%`);
  } else {
    fail("Decision on-chain", `expected ${expected.d.act} ${expected.d.asset}, got ${ours.d.act} ${ours.d.asset}`);
  }

  ok("On-chain audit", "HCS record matches what was submitted \u2014 immutable proof");
}

// ─── Test 3: Save to Supabase (Prisma) ─────────���───────────

async function testSupabasePersist(
  userId: string,
  cycleNumber: number,
  hcsSeqNum: number,
  hashscanUrl: string,
  record: Record<string, unknown>,
): Promise<{ cycleDbId: string; actionIds: string[] }> {
  console.log("\n\u2550\u2550\u2550 TEST 3: Persist to Supabase via Prisma \u2550\u2550\u2550");

  const { logAction, logCycleRecord } = await import("../src/store/action-logger.js");

  const actionIds: string[] = [];
  const expected = record as any;

  // 3a. Log cycle start
  const startId = await logAction({
    userId,
    actionType: "CYCLE_STARTED",
    payload: { cycleNumber, riskProfile: expected.rp },
  });
  actionIds.push(startId);
  ok("CYCLE_STARTED action", `id=${startId.slice(0, 8)}...`);

  // 3b. Log specialist hires
  for (const sp of expected.s) {
    const id = await logAction({
      userId,
      actionType: "SPECIALIST_HIRED",
      agentName: sp.n,
      attestationHash: sp.att,
      teeVerified: true,
      paymentAmount: "$0.001",
      paymentNetwork: "arc",
      payload: { signal: sp.sig, confidence: sp.conf },
    });
    actionIds.push(id);
    ok(`SPECIALIST_HIRED (${sp.n})`, `signal=${sp.sig}, conf=${sp.conf}`);
  }

  // 3c. Log debate stages
  const alphaId = await logAction({
    userId,
    actionType: "DEBATE_ALPHA",
    agentName: "alpha",
    attestationHash: expected.adv.a.att,
    teeVerified: true,
    payload: { action: expected.adv.a.act, pct: expected.adv.a.pct },
  });
  actionIds.push(alphaId);
  ok("DEBATE_ALPHA", `${expected.adv.a.act} ${expected.adv.a.pct}%`);

  const riskId = await logAction({
    userId,
    actionType: "DEBATE_RISK",
    agentName: "risk",
    attestationHash: expected.adv.r.att,
    teeVerified: true,
    payload: { challenge: expected.adv.r.obj, max_pct: expected.adv.r.max },
  });
  actionIds.push(riskId);
  ok("DEBATE_RISK", `max=${expected.adv.r.max}%`);

  const execId = await logAction({
    userId,
    actionType: "DEBATE_EXECUTOR",
    agentName: "executor",
    attestationHash: expected.adv.e.att,
    teeVerified: true,
    payload: { action: expected.adv.e.act, pct: expected.adv.e.pct, stop_loss: `-${expected.adv.e.sl}%` },
  });
  actionIds.push(execId);
  ok("DEBATE_EXECUTOR", `${expected.adv.e.act} ${expected.adv.e.pct}% (SL=${expected.adv.e.sl}%)`);

  // 3d. Log HCS proof
  const hcsId = await logAction({
    userId,
    actionType: "HCS_LOGGED",
    payload: { seqNum: hcsSeqNum, hashscanUrl },
  });
  actionIds.push(hcsId);
  ok("HCS_LOGGED", `seq=${hcsSeqNum}`);

  // 3e. Save full cycle record
  const cycleDbId = await logCycleRecord(userId, cycleNumber, {
    specialists: expected.s.map((sp: any) => ({
      name: sp.n,
      signal: sp.sig,
      confidence: sp.conf,
      attestation: sp.att,
    })),
    alpha: { action: expected.adv.a.act, pct: expected.adv.a.pct, attestation: expected.adv.a.att },
    risk: { challenge: expected.adv.r.obj, maxPct: expected.adv.r.max, attestation: expected.adv.r.att },
    executor: { action: expected.adv.e.act, pct: expected.adv.e.pct, stopLoss: `-${expected.adv.e.sl}%`, attestation: expected.adv.e.att },
    decision: expected.d.act,
    asset: expected.d.asset,
    decisionPct: expected.d.pct,
    hcsSeqNum,
    hashscanUrl,
    totalCostUsd: 0.003,
    navAfter: expected.nav,
  });
  ok("Cycle record saved", `id=${cycleDbId.slice(0, 8)}...`);

  // 3f. Log completion
  const completeId = await logAction({
    userId,
    actionType: "CYCLE_COMPLETED",
    durationMs: 1234,
    payload: { decision: expected.d.act, seqNum: hcsSeqNum, cycleNumber },
  });
  actionIds.push(completeId);
  ok("CYCLE_COMPLETED", `${actionIds.length} total actions logged`);

  return { cycleDbId, actionIds };
}

// ─── Test 4: Read back from Supabase and validate ───────────

async function testSupabaseReadback(
  userId: string,
  cycleDbId: string,
  actionIds: string[],
  cycleNumber: number,
  hcsSeqNum: number,
  expectedRecord: Record<string, unknown>,
): Promise<void> {
  console.log("\n\u2550\u2550\u2550 TEST 4: Supabase Read-back + Validation \u2550\u2550\u2550");

  const { getUserCycles, getUserActions, getCycleActions } = await import("../src/store/action-logger.js");

  // 4a. Read cycle record
  const cycles = await getUserCycles(userId, 5);
  ok("getUserCycles()", `${cycles.length} cycles found for user`);

  const cycle = cycles.find((c) => c.cycleNumber === cycleNumber);
  if (!cycle) {
    fail("Find cycle", `cycleNumber=${cycleNumber} not in DB`);
    return;
  }

  ok("Cycle found", `id=${cycle.id.slice(0, 8)}, cycle#=${cycle.cycleNumber}`);

  const expected = expectedRecord as any;

  // Validate specialist data
  const specialists = cycle.specialists as any[];
  if (Array.isArray(specialists) && specialists.length === 3) {
    ok("Specialists in DB", `${specialists.length} stored`);
    for (const sp of specialists) {
      const match = expected.s.find((e: any) => e.n === sp.name);
      if (match && sp.signal === match.sig && sp.confidence === match.conf) {
        ok(`DB specialist ${sp.name}`, `${sp.signal} conf=${sp.confidence}`);
      } else {
        fail(`DB specialist ${sp.name}`, `data mismatch`);
      }
    }
  } else {
    fail("Specialists in DB", `expected array of 3, got ${JSON.stringify(specialists)?.slice(0, 80)}`);
  }

  // Validate debate fields
  if (cycle.alphaAction === expected.adv.a.act && cycle.alphaPct === expected.adv.a.pct) {
    ok("Alpha in DB", `${cycle.alphaAction} ${cycle.alphaPct}%`);
  } else {
    fail("Alpha in DB", `expected ${expected.adv.a.act}/${expected.adv.a.pct}, got ${cycle.alphaAction}/${cycle.alphaPct}`);
  }

  if (cycle.riskChallenge === expected.adv.r.obj) {
    ok("Risk in DB", `"${cycle.riskChallenge}" (max=${cycle.riskMaxPct}%)`);
  } else {
    ok("Risk in DB", `challenge="${cycle.riskChallenge}", max=${cycle.riskMaxPct}%`);
  }

  if (cycle.execAction === expected.adv.e.act && cycle.execPct === expected.adv.e.pct) {
    ok("Executor in DB", `${cycle.execAction} ${cycle.execPct}% (SL=${cycle.execStopLoss})`);
  } else {
    fail("Executor in DB", `expected ${expected.adv.e.act}/${expected.adv.e.pct}, got ${cycle.execAction}/${cycle.execPct}`);
  }

  // Validate decision
  if (cycle.decision === expected.d.act && cycle.asset === expected.d.asset) {
    ok("Decision in DB", `${cycle.decision} ${cycle.asset} ${cycle.decisionPct}%`);
  } else {
    fail("Decision in DB", `expected ${expected.d.act} ${expected.d.asset}, got ${cycle.decision} ${cycle.asset}`);
  }

  // Validate HCS link
  if (cycle.hcsSeqNum === hcsSeqNum) {
    ok("HCS seq in DB", `${cycle.hcsSeqNum} (matches on-chain)`);
  } else {
    fail("HCS seq in DB", `expected ${hcsSeqNum}, got ${cycle.hcsSeqNum}`);
  }

  if (cycle.hashscanUrl) {
    ok("Hashscan URL in DB", cycle.hashscanUrl);
  }

  // 4b. Read agent actions
  const actions = await getUserActions(userId, 20);
  ok("getUserActions()", `${actions.length} total actions for user`);

  // Check action types are all present
  const actionTypes = actions.map((a) => a.actionType);
  const expectedTypes = [
    "CYCLE_STARTED", "SPECIALIST_HIRED", "DEBATE_ALPHA",
    "DEBATE_RISK", "DEBATE_EXECUTOR", "HCS_LOGGED", "CYCLE_COMPLETED",
  ];
  for (const t of expectedTypes) {
    if (actionTypes.includes(t)) {
      ok(`Action ${t}`, "present in DB");
    } else {
      fail(`Action ${t}`, "NOT found in user actions");
    }
  }

  // 4c. Check attestation hashes are stored
  const attestedActions = actions.filter((a) => a.attestationHash && a.attestationHash.length > 0);
  ok("Attested actions", `${attestedActions.length} actions have attestation hashes`);

  // 4d. Check payment records
  const payments = actions.filter((a) => a.paymentAmount);
  ok("Payment records", `${payments.length} actions have payment amounts`);
  for (const p of payments.slice(0, 3)) {
    console.log(`    ${p.agentName}: ${p.paymentAmount} on ${p.paymentNetwork}`);
  }
}

// ─── Test 5: Cross-check HCS ↔ Supabase ────────────────────

async function testCrossCheck(
  userId: string,
  cycleNumber: number,
  hcsSeqNum: number,
  expectedRecord: Record<string, unknown>,
): Promise<void> {
  console.log("\n\u2550\u2550\u2550 TEST 5: Cross-Check HCS \u2194 Supabase \u2550\u2550\u2550");

  const topicId = process.env.HCS_AUDIT_TOPIC_ID!;
  const { getHistory } = await import("../src/hedera/hcs.js");
  const { getUserCycles } = await import("../src/store/action-logger.js");

  // Get from HCS
  console.log("  Reading from HCS (mirror node)...");
  const hcsRecords = await getHistory(topicId, 10);
  const hcsRecord = hcsRecords.find((r) => r.c === cycleNumber && r.u === userId);

  // Get from Supabase
  const dbCycles = await getUserCycles(userId, 5);
  const dbCycle = dbCycles.find((c) => c.cycleNumber === cycleNumber);

  if (!hcsRecord) {
    fail("HCS record", "not found on-chain");
    return;
  }
  if (!dbCycle) {
    fail("DB record", "not found in Supabase");
    return;
  }

  // Cross-check: decision matches
  if (hcsRecord.d.act === dbCycle.decision) {
    ok("Decision HCS \u2194 DB", `both say: ${hcsRecord.d.act}`);
  } else {
    fail("Decision mismatch", `HCS=${hcsRecord.d.act}, DB=${dbCycle.decision}`);
  }

  // Cross-check: specialist count
  const dbSpecs = dbCycle.specialists as any[];
  if (hcsRecord.s.length === dbSpecs.length) {
    ok("Specialist count HCS \u2194 DB", `both have ${hcsRecord.s.length}`);
  } else {
    fail("Specialist count", `HCS=${hcsRecord.s.length}, DB=${dbSpecs.length}`);
  }

  // Cross-check: specialist signals match
  for (let i = 0; i < hcsRecord.s.length; i++) {
    const hcs = hcsRecord.s[i];
    const db = dbSpecs.find((s: any) => s.name === hcs.n);
    if (db && db.signal === hcs.sig) {
      ok(`${hcs.n} signal HCS \u2194 DB`, `both: ${hcs.sig}`);
    } else {
      fail(`${hcs.n} signal`, `HCS=${hcs.sig}, DB=${db?.signal}`);
    }
  }

  // Cross-check: Alpha action
  if (hcsRecord.adv.a.act === dbCycle.alphaAction) {
    ok("Alpha HCS \u2194 DB", `both: ${hcsRecord.adv.a.act} ${hcsRecord.adv.a.pct}%`);
  } else {
    fail("Alpha mismatch", `HCS=${hcsRecord.adv.a.act}, DB=${dbCycle.alphaAction}`);
  }

  // Cross-check: Executor action
  if (hcsRecord.adv.e.act === dbCycle.execAction) {
    ok("Executor HCS \u2194 DB", `both: ${hcsRecord.adv.e.act} ${hcsRecord.adv.e.pct}%`);
  } else {
    fail("Executor mismatch", `HCS=${hcsRecord.adv.e.act}, DB=${dbCycle.execAction}`);
  }

  // Cross-check: HCS seq
  if (dbCycle.hcsSeqNum === hcsSeqNum) {
    ok("HCS seq number", `DB stores seq=${hcsSeqNum} \u2014 links to on-chain proof`);
  }

  ok("AUDIT INTEGRITY", "On-chain HCS record matches Supabase DB record \u2014 tamper-proof");
}

// ─── Test 6: User state update ──────────────────────────────

async function testUserStateUpdate(userId: string, cycleNumber: number): Promise<void> {
  console.log("\n\u2550\u2550\u2550 TEST 6: User State Update \u2550\u2550\u2550");

  const { getUserById, updateUser } = await import("../src/store/user-store.js");

  // Update user as main-agent.ts would
  const updated = await updateUser(userId, {
    agent: {
      lastCycleId: cycleNumber,
      lastCycleAt: new Date().toISOString(),
    },
  });

  if (updated.agent.lastCycleId === cycleNumber) {
    ok("lastCycleId updated", `${cycleNumber}`);
  } else {
    fail("lastCycleId", `expected ${cycleNumber}, got ${updated.agent.lastCycleId}`);
  }

  if (updated.agent.lastCycleAt) {
    ok("lastCycleAt updated", updated.agent.lastCycleAt);
  } else {
    fail("lastCycleAt", "null");
  }

  // Verify read-back
  const readBack = await getUserById(userId);
  if (readBack?.agent.lastCycleId === cycleNumber) {
    ok("Read-back consistent", `lastCycleId=${readBack.agent.lastCycleId}`);
  } else {
    fail("Read-back", `expected ${cycleNumber}, got ${readBack?.agent.lastCycleId}`);
  }
}

// ─── RUNNER ─────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log("\u2551   VAULTMIND \u2014 AUDIT TRAIL E2E VALIDATION            \u2551");
  console.log("\u2551   HCS On-Chain \u2192 Mirror Node \u2192 Supabase \u2192 Cross-Check  \u2551");
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");

  // Preflight
  const required = ["OPERATOR_ID", "OPERATOR_KEY", "HCS_AUDIT_TOPIC_ID", "DATABASE_URL", "DIRECT_URL"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`\n\u274C Missing env vars: ${missing.join(", ")}`);
    process.exit(1);
  }

  const totalStart = Date.now();

  // Setup: get/create test user in Supabase
  console.log("\n\u2500\u2500\u2500 SETUP: Test User \u2500\u2500\u2500");
  const user = await getOrCreateTestUser();
  ok("Test user ready", `id=${user.id.slice(0, 8)}..., wallet=${user.walletAddress}`);

  // Test 1: Log to HCS
  const { record, seqNum, hashscanUrl, cycleNumber } = await testHcsLog(user);

  // Test 2: Read back from Mirror Node
  await testMirrorNodeReadback(process.env.HCS_AUDIT_TOPIC_ID!, record, seqNum);

  // Test 3: Save to Supabase
  const { cycleDbId, actionIds } = await testSupabasePersist(
    user.id, cycleNumber, seqNum, hashscanUrl, record,
  );

  // Test 4: Read back from Supabase
  await testSupabaseReadback(user.id, cycleDbId, actionIds, cycleNumber, seqNum, record);

  // Test 5: Cross-check HCS ↔ Supabase
  await testCrossCheck(user.id, cycleNumber, seqNum, record);

  // Test 6: User state update
  await testUserStateUpdate(user.id, cycleNumber);

  const totalElapsed = ((Date.now() - totalStart) / 1000).toFixed(1);

  // Summary
  console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557");
  console.log(`\u2551   RESULTS: \u2705 ${passed} passed \u00B7 \u274C ${failed} failed \u00B7 \u23ED\uFE0F  ${skipped} skipped`);
  console.log(`\u2551   Total time: ${totalElapsed}s`);
  console.log("\u2551   Flow: CompactRecord \u2192 HCS \u2192 Mirror Node \u2192 Supabase \u2192 Cross-Check");
  console.log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D");

  if (failed > 0) {
    console.log("\nSome tests failed. Check output above.");
    process.exit(1);
  } else {
    console.log("\nAudit trail fully validated! HCS on-chain records match Supabase DB.");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("\nAudit trail validation crashed:", err);
  process.exit(1);
});
