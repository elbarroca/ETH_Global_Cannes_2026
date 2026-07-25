import assert from "node:assert/strict";
import test from "node:test";
import {
  startGoalRunner,
  type GoalRunnerOptions,
} from "../../src/agents/goal-runner";
import {
  bootRuntime,
  shutdownRuntime,
  type RuntimeDependencies,
  type RuntimeHandle,
} from "../../src/index";
import { startWorkerHealth } from "../../src/agents/worker-health";

const MAX_NODE_TIMEOUT_MS = 2_147_483_647;

function smokeEnvironment(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    ALPHADAWG_RUNTIME_MODE: "protected",
    ENABLE_BACKGROUND_WORKERS: "false",
    ENABLE_KERNEL_WORKER: "true",
    KERNEL_WORKER_CONCURRENCY: "1",
    KERNEL_WORKER_LEASE_SECONDS: "30",
    PROTECTED_BOOT_SMOKE: "true",
  };
  return Object.assign(environment, overrides);
}

async function healthRequest(port: number): Promise<{ status: number; text: string }> {
  const response = await fetch(`http://127.0.0.1:${port}/health`);
  return { status: response.status, text: await response.text() };
}

test("worker health requires both current leases and a valid Railway release", async () => {
  const releaseSha = "a".repeat(40);
  const owners = {
    "goal-loop": "private-goal-owner",
    "kernel-worker": "private-kernel-owner",
  } as const;
  const ready = new Set<keyof typeof owners>(["goal-loop", "kernel-worker"]);
  const health = await startWorkerHealth({
    goalRunnerOwnerId: owners["goal-loop"],
    kernelWorkerOwnerId: owners["kernel-worker"],
    leaseSeconds: 30,
    port: 0,
    host: "127.0.0.1",
    environment: {
      NODE_ENV: "test",
      RAILWAY_PROJECT_ID: "project-valid",
      RAILWAY_SERVICE_ID: "service-valid",
      RAILWAY_ENVIRONMENT_ID: "environment-valid",
      RAILWAY_GIT_COMMIT_SHA: releaseSha,
      DATABASE_URL: "postgresql://private-user:private-password@private-host/private-db",
    },
    now: () => new Date("2026-07-25T12:00:00.000Z"),
    leaseReady: async (key, ownerId) => ready.has(key) && ownerId === owners[key],
  });
  try {
    const healthy = await healthRequest(health.port);
    assert.equal(healthy.status, 200);
    assert.ok(Buffer.byteLength(healthy.text) < 512);
    assert.deepEqual(JSON.parse(healthy.text), {
      mode: "protected",
      goalRunnerReady: true,
      kernelWorkerReady: true,
      releaseSha,
      serviceId: "service-valid",
      environmentId: "environment-valid",
    });
    assert.doesNotMatch(healthy.text, /private|password|owner|postgres/i);

    ready.delete("kernel-worker");
    const stale = await healthRequest(health.port);
    assert.equal(stale.status, 503);
    assert.equal(JSON.parse(stale.text).kernelWorkerReady, false);
  } finally {
    await health.stop();
  }
  await assert.rejects(fetch(`http://127.0.0.1:${health.port}/health`));

  const invalidRelease = await startWorkerHealth({
    goalRunnerOwnerId: "goal-owner",
    kernelWorkerOwnerId: "kernel-owner",
    leaseSeconds: 30,
    port: 0,
    host: "127.0.0.1",
    environment: {
      NODE_ENV: "test",
      RAILWAY_SERVICE_ID: "service-valid",
      RAILWAY_GIT_COMMIT_SHA: "NOT-A-RELEASE-secret-value-that-must-not-escape",
    },
    leaseReady: async () => true,
  });
  try {
    const response = await healthRequest(invalidRelease.port);
    assert.equal(response.status, 503);
    assert.equal(JSON.parse(response.text).releaseSha, null);
    assert.doesNotMatch(response.text, /NOT-A-RELEASE|secret-value/);
  } finally {
    await invalidRelease.stop();
  }
});

test("goal runner rejects unsafe numeric bounds before starting", () => {
  const cases: readonly { code: string; options: GoalRunnerOptions }[] = [
    { code: "GOAL_RUNNER_LEASE_SECONDS_INVALID", options: { leaseSeconds: 4 } },
    { code: "GOAL_RUNNER_LEASE_SECONDS_INVALID", options: { leaseSeconds: 301 } },
    { code: "GOAL_RUNNER_LEASE_SECONDS_INVALID", options: { leaseSeconds: 5.5 } },
    { code: "GOAL_RUNNER_LEASE_SECONDS_INVALID", options: { leaseSeconds: 1e100 } },
    { code: "GOAL_RUNNER_LIMIT_INVALID", options: { leaseSeconds: 30, limit: 0 } },
    { code: "GOAL_RUNNER_LIMIT_INVALID", options: { leaseSeconds: 30, limit: 5 } },
    { code: "GOAL_RUNNER_LIMIT_INVALID", options: { leaseSeconds: 30, limit: 1.5 } },
    { code: "GOAL_RUNNER_LIMIT_INVALID", options: { leaseSeconds: 30, limit: 1e100 } },
    { code: "GOAL_RUNNER_POLL_INTERVAL_INVALID", options: { leaseSeconds: 30, pollIntervalMs: 0 } },
    {
      code: "GOAL_RUNNER_POLL_INTERVAL_INVALID",
      options: { leaseSeconds: 30, pollIntervalMs: MAX_NODE_TIMEOUT_MS + 1 },
    },
    {
      code: "GOAL_RUNNER_POLL_INTERVAL_INVALID",
      options: { leaseSeconds: 30, pollIntervalMs: 1.5 },
    },
    {
      code: "GOAL_RUNNER_POLL_INTERVAL_INVALID",
      options: { leaseSeconds: 30, pollIntervalMs: 1e100 },
    },
    {
      code: "GOAL_RUNNER_MAX_BACKOFF_INVALID",
      options: { leaseSeconds: 30, pollIntervalMs: 2, maxBackoffMs: 1 },
    },
    {
      code: "GOAL_RUNNER_MAX_BACKOFF_INVALID",
      options: { leaseSeconds: 30, pollIntervalMs: 1, maxBackoffMs: MAX_NODE_TIMEOUT_MS + 1 },
    },
    {
      code: "GOAL_RUNNER_MAX_BACKOFF_INVALID",
      options: { leaseSeconds: 30, pollIntervalMs: 1, maxBackoffMs: 1.5 },
    },
    {
      code: "GOAL_RUNNER_MAX_BACKOFF_INVALID",
      options: { leaseSeconds: 30, pollIntervalMs: 1, maxBackoffMs: 1e100 },
    },
  ];

  for (const entry of cases) {
    assert.throws(() => startGoalRunner(entry.options), new RegExp(entry.code));
  }
});

test("protected runtime owns one configuration, shares stop, and restarts cleanly", async () => {
  const environment = smokeEnvironment();
  let first: RuntimeHandle | null = null;
  let fresh: RuntimeHandle | null = null;
  try {
    const handles = await Promise.all([
      bootRuntime(environment),
      bootRuntime({ ...environment }),
    ]);
    first = handles[0] ?? null;
    assert.ok(first);
    assert.equal(handles[1], first);
    await assert.rejects(
      bootRuntime(smokeEnvironment({ KERNEL_WORKER_CONCURRENCY: "2" })),
      /PROTECTED_RUNTIME_CONFIGURATION_CONFLICT/,
    );

    const firstStop = first.stop();
    const repeatedStop = first.stop();
    assert.equal(repeatedStop, firstStop);
    await Promise.all([firstStop, repeatedStop]);

    fresh = await bootRuntime(environment);
    assert.notEqual(fresh, first);
  } finally {
    await fresh?.stop();
    await first?.stop();
  }
});

test("health boot failure drains already-started protected workers", async () => {
  let goalStops = 0;
  let kernelStops = 0;
  const dependencies: RuntimeDependencies = {
    startGoalRunner: (options) => {
      assert.ok(options.mcpProvider);
      return {
        ownerId: "goal-owner",
        stop: async () => { goalStops += 1; },
      };
    },
    startKernelWorker: (options) => {
      assert.ok(options.mcpProvider);
      return {
        ownerId: "kernel-owner",
        stop: async () => { kernelStops += 1; },
      };
    },
    startWorkerHealth: async () => {
      throw new Error("WORKER_HEALTH_LISTEN_FAILED");
    },
  };
  await assert.rejects(
    bootRuntime(smokeEnvironment({
      PROTECTED_BOOT_SMOKE: undefined,
      DATABASE_URL: "postgresql://user:password@localhost/runtime",
      DIRECT_URL: "postgresql://user:password@localhost/runtime",
    }), dependencies),
    /WORKER_HEALTH_LISTEN_FAILED/,
  );
  assert.equal(goalStops, 1);
  assert.equal(kernelStops, 1);
});

test("shutdown failure is awaited, redacted, and handled", async () => {
  const originalError = console.error;
  const originalLog = console.log;
  const originalExitCode = process.exitCode;
  const errors: string[] = [];
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown): void => {
    unhandled.push(reason);
  };
  console.error = (...values: unknown[]): void => {
    errors.push(values.map(String).join(" "));
  };
  console.log = (): void => undefined;
  process.on("unhandledRejection", onUnhandled);
  process.exitCode = undefined;
  try {
    await shutdownRuntime({
      stop: async () => {
        throw new Error("private-session-payload");
      },
    }, "SIGTERM");
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(process.exitCode, 1);
    assert.equal(errors.length, 1);
    assert.deepEqual(JSON.parse(errors[0] ?? "null"), {
      level: "error",
      context: "runtime.shutdown",
      code: "RUNTIME_SHUTDOWN_FAILED",
    });
    assert.doesNotMatch(errors.join("\n"), /private-session-payload/);
    assert.deepEqual(unhandled, []);
  } finally {
    process.removeListener("unhandledRejection", onUnhandled);
    console.error = originalError;
    console.log = originalLog;
    process.exitCode = originalExitCode;
  }
});
