import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { validateEnvironment } from "./config/env";
import { startKernelWorker } from "./worker/runner";

dotenv.config();

const LEGACY_REQUIRED_ENV = [
  "OPERATOR_ID",
  "OPERATOR_KEY",
  "HCS_AUDIT_TOPIC_ID",
  "OG_PRIVATE_KEY",
  "OG_PROVIDER_ADDRESS",
  "OG_STORAGE_INDEXER",
  "SERVER_ENCRYPTION_KEY",
  "DATABASE_URL",
] as const;

function validateLegacyEnvironment(source: NodeJS.ProcessEnv): void {
  const missing = LEGACY_REQUIRED_ENV.filter((key) => !source[key]);
  if (missing.length > 0) throw new Error("LEGACY_ENVIRONMENT_INCOMPLETE");
  if (source.ENABLE_BACKGROUND_WORKERS !== "true") {
    throw new Error("LEGACY_BACKGROUND_WORKERS_NOT_ENABLED");
  }
}

async function bootLegacyRuntime(source: NodeJS.ProcessEnv): Promise<void> {
  validateLegacyEnvironment(source);
  const [registry, specialists, bot, heartbeat, timeoutChecker, inference] = await Promise.all([
    import("./marketplace/registry"),
    import("./agents/specialist-server"),
    import("./telegram/bot"),
    import("./agents/heartbeat"),
    import("./agents/timeout-checker"),
    import("./og/inference"),
  ]);
  await registry.loadRegistry();
  await specialists.startSpecialists();
  const providers = await inference.listProviders();
  if (providers.length === 0) throw new Error("LEGACY_OG_PROVIDER_UNAVAILABLE");
  bot.startBot();
  heartbeat.startHeartbeatLoop();
  timeoutChecker.startTimeoutChecker();
  console.log(JSON.stringify({ level: "info", context: "runtime.boot", mode: "legacy" }));
}

export async function bootRuntime(source: NodeJS.ProcessEnv = process.env): Promise<void> {
  const smoke = source.PROTECTED_BOOT_SMOKE === "true";
  const environment = validateEnvironment(source, { requireDatabase: !smoke });
  if (environment.runtimeMode === "legacy") {
    await bootLegacyRuntime(source);
    return;
  }
  if (environment.enableBackgroundWorkers) throw new Error("PROTECTED_LEGACY_WORKERS_FORBIDDEN");
  if (environment.enableKernelWorker && !smoke) {
    startKernelWorker({
      concurrency: environment.kernelWorkerConcurrency,
      leaseSeconds: environment.kernelWorkerLeaseSeconds,
    });
  }
  console.log(JSON.stringify({
    level: "info",
    context: "runtime.boot",
    mode: "protected",
    kernelWorker: environment.enableKernelWorker && !smoke,
    smoke,
  }));
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entrypoint) {
  bootRuntime().catch((error: unknown) => {
    const code = error instanceof Error && /^[A-Z][A-Z0-9_]{2,64}$/.test(error.message)
      ? error.message
      : "RUNTIME_BOOT_FAILED";
    console.error(JSON.stringify({ level: "error", context: "runtime.boot", code }));
    process.exitCode = 1;
  });
}
