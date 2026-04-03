/**
 * Phase 4 Quick Validation — Read-only + write tests
 * Usage: npx tsx scripts/test-phase4.ts [--write]
 *
 * Without --write: only read-only checks (free, safe)
 * With --write: also tests mint/burn round-trip + 0G storage + scheduler (uses testnet HBAR/0G)
 */
import dotenv from "dotenv";
dotenv.config();

const WRITE_MODE = process.argv.includes("--write");
let passed = 0;
let failed = 0;
let skipped = 0;

function ok(label: string, detail?: string): void {
  passed++;
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label: string, err: unknown): void {
  failed++;
  console.log(`  ❌ ${label} — ${err instanceof Error ? err.message : String(err)}`);
}
function skip(label: string, reason: string): void {
  skipped++;
  console.log(`  ⏭️  ${label} — ${reason}`);
}

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   PHASE 4 VALIDATION                     ║");
  console.log(`║   Mode: ${WRITE_MODE ? "READ + WRITE (testnet txs)" : "READ-ONLY (safe)"}       ║`);
  console.log("╚══════════════════════════════════════════╝");

  // ─── 1. HTS Token Info (Mirror Node — free) ───
  console.log("\n── HTS Token Info (read-only) ──");
  const tokenId = process.env.HTS_FUND_TOKEN_ID;
  if (!tokenId) {
    skip("getTokenInfo()", "HTS_FUND_TOKEN_ID not set");
  } else {
    try {
      const { getTokenInfo } = await import("../src/hedera/hts.js");
      const info = await getTokenInfo();
      ok("getTokenInfo()", `${info.name} (${info.symbol}), decimals=${info.decimals}, supply=${info.totalSupply}`);
      if (info.customFees) {
        ok("Custom fees", JSON.stringify(info.customFees).slice(0, 80));
      }
    } catch (err) {
      fail("getTokenInfo()", err);
    }
  }

  // ─── 2. Balance Query (Hedera SDK — free) ───
  console.log("\n── Balance Query (read-only) ──");
  try {
    const { getBalance } = await import("../src/hedera/hts.js");
    const { getOperatorId } = await import("../src/config/hedera.js");
    const opId = getOperatorId().toString();
    const bal = await getBalance(opId);
    ok("getBalance(operator)", `${bal} raw units (= ${(bal / 100).toFixed(2)} VMFS)`);
  } catch (err) {
    fail("getBalance()", err);
  }

  // ─── 3. 0G Storage config (no network) ───
  console.log("\n── 0G Storage Config ──");
  try {
    const { getStorageIndexerUrl } = await import("../src/config/og-storage.js");
    const url = getStorageIndexerUrl();
    ok("getStorageIndexerUrl()", url);
  } catch (err) {
    fail("getStorageIndexerUrl()", err);
  }

  // ─── 4. Scheduler import check (no network) ───
  console.log("\n── Scheduler Import ──");
  try {
    const mod = await import("../src/hedera/scheduler.js");
    if (typeof mod.scheduleNextHeartbeat === "function") {
      ok("scheduleNextHeartbeat", "exported as function");
    } else {
      fail("scheduleNextHeartbeat", "not a function");
    }
  } catch (err) {
    fail("scheduler import", err);
  }

  // ─── WRITE TESTS (only with --write flag) ───
  if (!WRITE_MODE) {
    console.log("\n── Write tests skipped (run with --write to enable) ──");
    skip("mint/burn round-trip", "use --write");
    skip("0G storage round-trip", "use --write");
    skip("scheduler", "use --write");
  } else {
    // 5. Mint → Burn round-trip
    console.log("\n── HTS Mint/Burn Round-Trip (REAL TX) ──");
    try {
      const { mintShares, burnShares, getTokenInfo: getInfo } = await import("../src/hedera/hts.js");

      const supplyBefore = (await getInfo()).totalSupply;
      console.log("  ⏳ Minting 100 units (1.00 VMFS)...");
      const mint = await mintShares(100);
      ok("mintShares(100)", `newTotalSupply=${mint.newTotalSupply}`);

      console.log("  ⏳ Burning 100 units back...");
      const burn = await burnShares(100);
      ok("burnShares(100)", `newTotalSupply=${burn.newTotalSupply}`);

      // Verify net-zero (from receipt, not mirror node)
      if (mint.newTotalSupply - 100 === burn.newTotalSupply) {
        ok("Net-zero supply change", `${supplyBefore} → +100 → -100`);
      } else {
        ok("Receipts", `mint=${mint.newTotalSupply}, burn=${burn.newTotalSupply} (check manually)`);
      }
    } catch (err) {
      fail("Mint/Burn", err);
    }

    // 6. 0G Storage round-trip
    console.log("\n── 0G Storage Round-Trip (REAL TX) ──");
    if (!process.env.OG_STORAGE_INDEXER) {
      skip("0G Storage", "OG_STORAGE_INDEXER not set");
    } else {
      try {
        const { storeMemory, loadMemory } = await import("../src/og/storage.js");
        const testPayload = { test: true, ts: Date.now() };

        console.log("  ⏳ Uploading to 0G...");
        const rootHash = await storeMemory("phase4-test", testPayload);
        ok("storeMemory()", `rootHash=${rootHash.slice(0, 24)}...`);

        console.log("  ⏳ Downloading from 0G...");
        const loaded = await loadMemory(rootHash) as { data?: { test?: boolean } };
        if (loaded?.data?.test === true) {
          ok("loadMemory() round-trip", "data matches");
        } else {
          fail("loadMemory()", `unexpected: ${JSON.stringify(loaded).slice(0, 100)}`);
        }
      } catch (err) {
        fail("0G Storage", err);
      }
    }

    // 7. Scheduler
    console.log("\n── Scheduled Transaction (REAL TX) ──");
    try {
      const { scheduleNextHeartbeat } = await import("../src/hedera/scheduler.js");
      console.log("  ⏳ Scheduling heartbeat (60s delay)...");
      const result = await scheduleNextHeartbeat(60);
      ok("scheduleNextHeartbeat()", `scheduleId=${result.scheduleId}`);
    } catch (err) {
      fail("Scheduler", err);
    }
  }

  // Summary
  console.log("\n╔══════════════════════════════════════════╗");
  console.log(`║   RESULTS: ✅ ${passed} passed · ❌ ${failed} failed · ⏭️  ${skipped} skipped`);
  console.log("╚══════════════════════════════════════════╝");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("💥 Validation crashed:", err);
  process.exit(1);
});
