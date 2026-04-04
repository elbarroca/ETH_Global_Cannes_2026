import dotenv from "dotenv";
dotenv.config();

import { loadStore } from "./store/user-store.js";
import { startBot } from "./telegram/bot.js";
import { startApiServer } from "./api/server.js";
import { startHeartbeatLoop } from "./agents/heartbeat.js";

const REQUIRED_ENV = [
  "OPERATOR_ID",
  "OPERATOR_KEY",
  "HCS_AUDIT_TOPIC_ID",
  "OG_PRIVATE_KEY",
  "OG_PROVIDER_ADDRESS",
  "SERVER_ENCRYPTION_KEY",
] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

async function main(): Promise<void> {
  console.log("=== AlphaDawg booting... ===");
  console.log(`Node ${process.version}`);
  validateEnv();
  console.log(`Operator: ${process.env.OPERATOR_ID}`);
  console.log(`HCS Topic: ${process.env.HCS_AUDIT_TOPIC_ID}`);
  console.log(`0G Provider: ${process.env.OG_PROVIDER_ADDRESS}`);

  // User store backed by Supabase — connection is lazy, no explicit load needed
  loadStore();
  console.log("User store ready (Supabase).");

  // Start Telegram bot
  startBot();

  // Start Express API server
  startApiServer();

  // Start heartbeat cycle loop
  startHeartbeatLoop();
  console.log("Heartbeat started. Running hunts every 5 minutes.");
  console.log("=== AlphaDawg running ===");
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
