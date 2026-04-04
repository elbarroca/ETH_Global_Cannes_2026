import dotenv from "dotenv";
dotenv.config();

import { loadStore } from "./store/user-store";
import { loadRegistry } from "./marketplace/registry";
import { startBot } from "./telegram/bot";
import { startHeartbeatLoop } from "./agents/heartbeat";
import { startTimeoutChecker } from "./agents/timeout-checker";
import { listProviders } from "./og/inference";

const REQUIRED_ENV = [
  "OPERATOR_ID",
  "OPERATOR_KEY",
  "HCS_AUDIT_TOPIC_ID",
  "OG_PRIVATE_KEY",
  "OG_PROVIDER_ADDRESS",
  "OG_STORAGE_INDEXER",
  "SERVER_ENCRYPTION_KEY",
  "DATABASE_URL",
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

  // Load marketplace registry from Prisma (auto-registers built-in specialists)
  await loadRegistry();
  console.log("Marketplace registry loaded.");

  // Verify 0G Compute Network provider
  try {
    const providers = await listProviders();
    if (providers.length > 0) {
      console.log(`0G Compute ready: ${providers.length} providers (model: ${providers[0].model})`);
    } else {
      console.warn("0G Compute: no providers found — inference calls will fail");
    }
  } catch (err) {
    console.warn("0G Compute verification failed:", err instanceof Error ? err.message : String(err));
  }

  // Start Telegram bot
  startBot();

  // API is served by Next.js API routes — no Express server needed

  // Start heartbeat cycle loop
  startHeartbeatLoop();
  console.log("Heartbeat started. Running hunts every 5 minutes.");

  // Start timeout checker for expired pending cycles
  startTimeoutChecker();
  console.log("Timeout checker started. Checking every 60 seconds.");
  console.log("=== AlphaDawg running ===");
}

main().catch((err: unknown) => {
  console.error("Fatal:", err);
  process.exit(1);
});
