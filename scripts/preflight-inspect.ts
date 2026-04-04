/**
 * Display-flow preflight: read-only inventory of the current system state.
 * Run this BEFORE triggering a live cycle to know what you're working with.
 *
 * Checks:
 *   1. Schema — cycles.goal/payments + pending_cycles.goal/rich_record exist
 *   2. Users — lists all users with fund balances + hot wallet status
 *   3. Cycles — latest cycle + total count
 *   4. Agent actions — SPECIALIST_HIRED rows in the last 24h with hiredBy breakdown
 *   5. Pending cycles — any unresolved cycles blocking a fresh run?
 *
 * Usage: npx tsx scripts/preflight-inspect.ts
 */
import "dotenv/config";
import { getPrisma } from "../src/config/prisma";

async function main() {
  const prisma = getPrisma();

  console.log("\n═══ 1. SCHEMA INTROSPECTION ═══");
  const cycleCols = (await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name='cycles' AND column_name IN ('goal','payments','swap_tx_hash','storage_hash','inft_token_id')
    ORDER BY column_name
  `)) as Array<{ column_name: string; data_type: string }>;
  console.table(cycleCols);

  const pendingCols = (await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name='pending_cycles' AND column_name IN ('goal','rich_record')
    ORDER BY column_name
  `)) as Array<{ column_name: string; data_type: string }>;
  console.table(pendingCols);

  const required = new Set(["goal", "payments", "swap_tx_hash", "storage_hash"]);
  const have = new Set(cycleCols.map((c) => c.column_name));
  const missing = [...required].filter((c) => !have.has(c));
  if (missing.length > 0) {
    console.log(`❌ MISSING columns on cycles: ${missing.join(", ")}`);
  } else {
    console.log("✅ cycles has goal + payments + swap_tx_hash + storage_hash");
  }
  if (pendingCols.find((c) => c.column_name === "rich_record") && pendingCols.find((c) => c.column_name === "goal")) {
    console.log("✅ pending_cycles has goal + rich_record");
  } else {
    console.log("❌ pending_cycles missing goal or rich_record");
  }

  console.log("\n═══ 2. USERS ═══");
  const users = await prisma.user.findMany({
    select: {
      id: true,
      walletAddress: true,
      hot_wallet_index: true,
      hot_wallet_address: true,
      agent: true,
      fund: true,
      inftTokenId: true,
    },
    orderBy: { createdAt: "desc" },
  });
  for (const u of users) {
    const agent = u.agent as { approvalMode?: string; riskProfile?: string; lastCycleId?: number };
    const fund = u.fund as { depositedUsdc?: number };
    console.log(
      `  • ${u.id.slice(0, 8)}… wallet=${u.walletAddress.slice(0, 10)}… hotWallet=${u.hot_wallet_index ?? "—"} balance=$${(fund.depositedUsdc ?? 0).toFixed(2)} approval=${agent.approvalMode ?? "—"} lastCycle=${agent.lastCycleId ?? 0} iNFT=${u.inftTokenId ?? "—"}`,
    );
  }
  console.log(`  total: ${users.length} users`);

  console.log("\n═══ 3. CYCLES ═══");
  const cycleCount = await prisma.cycle.count();
  const latestCycle = await prisma.cycle.findFirst({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      cycleNumber: true,
      userId: true,
      goal: true,
      decision: true,
      decisionPct: true,
      swapTxHash: true,
      storageHash: true,
      hcsSeqNum: true,
      payments: true,
      createdAt: true,
    },
  });
  console.log(`  total cycles: ${cycleCount}`);
  if (latestCycle) {
    console.log(`  latest: #${latestCycle.cycleNumber} for user ${latestCycle.userId.slice(0, 8)}… ${latestCycle.createdAt.toISOString()}`);
    console.log(`    goal:        ${latestCycle.goal ?? "(null)"}`);
    console.log(`    decision:    ${latestCycle.decision} ${latestCycle.decisionPct}%`);
    console.log(`    swap_tx:     ${latestCycle.swapTxHash ?? "(null)"}`);
    console.log(`    storageHash: ${latestCycle.storageHash ?? "(null)"}`);
    console.log(`    hcsSeqNum:   ${latestCycle.hcsSeqNum ?? "(null)"}`);
    const paymentsField = latestCycle.payments;
    const paymentsLen = Array.isArray(paymentsField) ? paymentsField.length : 0;
    console.log(`    payments[]:  ${paymentsLen} entries`);
    if (paymentsLen > 0 && Array.isArray(paymentsField)) {
      console.log(`      sample: ${JSON.stringify(paymentsField[0])}`);
    }
  } else {
    console.log("  (no cycles yet)");
  }

  console.log("\n═══ 4. AGENT ACTIONS (last 24h) ═══");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const hires = await prisma.agentAction.findMany({
    where: { actionType: "SPECIALIST_HIRED", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  if (hires.length === 0) {
    console.log("  (no SPECIALIST_HIRED rows in last 24h)");
  } else {
    const byHirer: Record<string, number> = {};
    for (const h of hires) {
      const payload = (h.payload ?? {}) as { hiredBy?: string };
      const hirer = payload.hiredBy ?? "unknown";
      byHirer[hirer] = (byHirer[hirer] ?? 0) + 1;
    }
    console.log(`  ${hires.length} SPECIALIST_HIRED rows in last 24h`);
    console.log(`  by hirer: ${Object.entries(byHirer).map(([k, v]) => `${k}=${v}`).join("  ")}`);
    console.log(`  newest: ${hires[0].agentName} hired by ${(hires[0].payload as { hiredBy?: string })?.hiredBy ?? "?"} tx=${hires[0].paymentTxHash?.slice(0, 10) ?? "—"}`);
  }

  console.log("\n═══ 5. PENDING CYCLES ═══");
  const pending = await prisma.pendingCycle.findMany({
    where: { status: "PENDING_APPROVAL" },
    select: { id: true, userId: true, cycleNumber: true, goal: true, expiresAt: true, createdAt: true },
  });
  if (pending.length === 0) {
    console.log("  (no pending cycles — safe to start a fresh one)");
  } else {
    for (const p of pending) {
      const expired = p.expiresAt < new Date();
      console.log(
        `  • pending #${p.cycleNumber} user=${p.userId.slice(0, 8)}… goal="${p.goal ?? "—"}" expires=${p.expiresAt.toISOString()} ${expired ? "(EXPIRED)" : ""}`,
      );
    }
  }

  console.log("\n═══ 6. CYCLE WITH FULL HIERARCHICAL DATA? ═══");
  // Find the most recent cycle that has BOTH goal AND payments populated —
  // this proves the new flow has run end-to-end at least once.
  const hierarchical = await prisma.cycle.findFirst({
    where: {
      goal: { not: null },
      NOT: { payments: { equals: "null" } },
    },
    orderBy: { createdAt: "desc" },
    select: { cycleNumber: true, userId: true, goal: true, payments: true, storageHash: true, createdAt: true },
  });
  if (hierarchical) {
    console.log(`  ✅ cycle #${hierarchical.cycleNumber} has goal + payments — hierarchical path already ran`);
    console.log(`     goal: "${hierarchical.goal}"`);
    const p = hierarchical.payments;
    if (Array.isArray(p)) {
      console.log(`     payments: ${p.length} entries, hirers: ${[...new Set(p.map((x) => (x as { hiredBy?: string }).hiredBy))].join(", ")}`);
    }
  } else {
    console.log("  ⚠️  no cycle has goal + payments yet — fresh flow has NOT run since schema migration");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("preflight failed:", err);
  process.exit(1);
});
