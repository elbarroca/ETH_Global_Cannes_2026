import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import { startGoalRunner } from "./agents/goal-runner";
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

export interface RuntimeHandle {
  stop: () => Promise<void>;
}

interface ProtectedRuntimeUnit {
  configuration: string;
  handle: RuntimeHandle;
  shutdownFailed: boolean;
  stopPromise: Promise<void> | null;
}

let protectedRuntime: ProtectedRuntimeUnit | null = null;

function runtimeErrorCode(error: unknown, fallback: string): string {
  return error instanceof Error && /^[A-Z][A-Z0-9_]{2,64}$/.test(error.message)
    ? error.message
    : fallback;
}

async function bootLegacyRuntime(source: NodeJS.ProcessEnv): Promise<RuntimeHandle> {
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
  return { stop: async () => undefined };
}

export async function bootRuntime(source: NodeJS.ProcessEnv = process.env): Promise<RuntimeHandle> {
  const smoke = source.PROTECTED_BOOT_SMOKE === "true";
  const environment = validateEnvironment(source, { requireDatabase: !smoke });
  if (environment.runtimeMode === "legacy") {
    return bootLegacyRuntime(source);
  }
  if (environment.enableBackgroundWorkers) throw new Error("PROTECTED_LEGACY_WORKERS_FORBIDDEN");
  const workersEnabled = environment.enableKernelWorker && !smoke;
  const configuration = [
    smoke ? "smoke" : "runtime",
    workersEnabled ? "workers" : "idle",
    environment.kernelWorkerConcurrency,
    environment.kernelWorkerLeaseSeconds,
  ].join(":");
  if (protectedRuntime) {
    if (protectedRuntime.stopPromise) throw new Error("PROTECTED_RUNTIME_STOPPING");
    if (protectedRuntime.shutdownFailed) throw new Error("PROTECTED_RUNTIME_SHUTDOWN_FAILED");
    if (protectedRuntime.configuration !== configuration) {
      throw new Error("PROTECTED_RUNTIME_CONFIGURATION_CONFLICT");
    }
    console.log(JSON.stringify({
      level: "info",
      context: "runtime.boot",
      mode: "protected",
      reused: true,
    }));
    return protectedRuntime.handle;
  }

  const goalRunner = workersEnabled
    ? startGoalRunner({ leaseSeconds: environment.kernelWorkerLeaseSeconds })
    : null;
  const kernelWorker = workersEnabled
    ? startKernelWorker({
        concurrency: environment.kernelWorkerConcurrency,
        leaseSeconds: environment.kernelWorkerLeaseSeconds,
      })
    : null;
  const unit: ProtectedRuntimeUnit = {
    configuration,
    shutdownFailed: false,
    stopPromise: null,
    handle: {
      stop: () => {
        if (unit.stopPromise) return unit.stopPromise;
        const drain = (async () => {
          await goalRunner?.stop();
          await kernelWorker?.stop();
        })();
        unit.stopPromise = drain.then(
          () => {
            if (protectedRuntime === unit) protectedRuntime = null;
          },
          (error: unknown) => {
            unit.shutdownFailed = true;
            unit.stopPromise = null;
            throw error;
          },
        );
        return unit.stopPromise;
      },
    },
  };
  protectedRuntime = unit;
  console.log(JSON.stringify({
    level: "info",
    context: "runtime.boot",
    mode: "protected",
    kernelWorker: workersEnabled,
    goalRunner: workersEnabled,
    reused: false,
    smoke,
  }));
  return unit.handle;
}

export async function shutdownRuntime(
  runtime: RuntimeHandle,
  signal: "SIGINT" | "SIGTERM",
): Promise<void> {
  console.log(JSON.stringify({ level: "info", context: "runtime.shutdown", signal }));
  try {
    await runtime.stop();
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      context: "runtime.shutdown",
      code: runtimeErrorCode(error, "RUNTIME_SHUTDOWN_FAILED"),
    }));
    process.exitCode = 1;
  }
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entrypoint) {
  bootRuntime()
    .then((runtime) => {
      let stopping = false;
      const shutdown = (signal: "SIGINT" | "SIGTERM"): void => {
        if (stopping) return;
        stopping = true;
        void shutdownRuntime(runtime, signal);
      };
      process.once("SIGINT", () => shutdown("SIGINT"));
      process.once("SIGTERM", () => shutdown("SIGTERM"));
    })
    .catch((error: unknown) => {
      const code = runtimeErrorCode(error, "RUNTIME_BOOT_FAILED");
      console.error(JSON.stringify({ level: "error", context: "runtime.boot", code }));
      process.exitCode = 1;
    });
}
