import dotenv from "dotenv";
dotenv.config();

import {
  emitCycleEvent,
  emitDepositEvent,
  emitHeartbeatEvent,
  emitCrossChainEvent,
} from "../src/naryo/emit-event";

async function main() {
  console.log("═══ Testing Naryo Event Emissions on Hedera EVM ═══\n");

  // 1. CycleCompleted
  console.log("1. Emitting CycleCompleted...");
  const tx1 = await emitCycleEvent(
    "0x9E18dc5A9a86256A21954f2c6b107b2eBB8d9a86",
    1, "HOLD", "ETH", 0,
  );
  console.log("   Result:", tx1 ? `OK (${tx1})` : "FAILED");

  // 2. DepositRecorded
  console.log("\n2. Emitting DepositRecorded...");
  const tx2 = await emitDepositEvent(
    "0x9E18dc5A9a86256A21954f2c6b107b2eBB8d9a86",
    10, 10,
  );
  console.log("   Result:", tx2 ? `OK (${tx2})` : "FAILED");

  // 3. Heartbeat
  console.log("\n3. Emitting HeartbeatEmitted...");
  const tx3 = await emitHeartbeatEvent(1);
  console.log("   Result:", tx3 ? `OK (${tx3})` : "FAILED");

  // 4. CrossChainCorrelation
  console.log("\n4. Emitting CrossChainCorrelation...");
  const tx4 = await emitCrossChainEvent(
    "0g-chain",
    "MetadataUpdated",
    "0xd6b7f0f3369050a9f86b212d4a169142ea853fafd570e4694b47ecbe52bbeed7",
  );
  console.log("   Result:", tx4 ? `OK (${tx4})` : "FAILED");

  const passed = [tx1, tx2, tx3, tx4].filter(Boolean).length;
  console.log(`\n═══ ${passed}/4 events emitted successfully ═══`);
  console.log(`\nView on Hashscan: https://hashscan.io/testnet/contract/0x66D2b95e6228E7639f9326C5573466579dd7e139`);
}

main().catch((err) => { console.error("Test failed:", err); process.exit(1); });
