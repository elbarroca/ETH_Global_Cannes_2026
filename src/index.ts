import dotenv from "dotenv";
dotenv.config();

import { loadStore } from "./store/user-store.js";
import { startHeartbeatLoop } from "./agents/heartbeat.js";

async function main(): Promise<void> {
  console.log("=== VaultMind booting... ===");
  console.log(`Node ${process.version}`);
  console.log(`Operator: ${process.env.OPERATOR_ID ?? "NOT SET"}`);
  console.log(`HCS Topic: ${process.env.HCS_AUDIT_TOPIC_ID ?? "NOT SET"}`);
  console.log(`0G Provider: ${process.env.OG_PROVIDER_ADDRESS ?? "NOT SET"}`);

  // Load user store from disk
  loadStore();
  console.log("User store loaded.");

  // Start heartbeat cycle loop
  startHeartbeatLoop();
  console.log("Heartbeat started. Running cycles every 5 minutes.");
  console.log("=== VaultMind running ===");
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
