import { randomUUID } from "node:crypto";
import { runGoalLoopOnce } from "../kernel/goals";
import type { McpContextProvider } from "../kernel/mcp-context";

const DEFAULT_POLL_INTERVAL_MS = 1_000;
const DEFAULT_MAX_BACKOFF_MS = 30_000;
const MAX_BACKOFF_EXPONENT = 5;
const MAX_NODE_TIMEOUT_MS = 2_147_483_647;
const MIN_LEASE_SECONDS = 5;
const MAX_LEASE_SECONDS = 300;
const MIN_LIMIT = 1;
const MAX_LIMIT = 4;

export interface GoalRunnerOptions {
  leaseSeconds: number;
  limit?: number;
  pollIntervalMs?: number;
  maxBackoffMs?: number;
  mcpProvider?: McpContextProvider;
}

export interface GoalRunner {
  readonly ownerId: string;
  stop: () => Promise<void>;
}

let activeRunner: GoalRunner | null = null;

function errorCode(error: unknown): string {
  return error instanceof Error && /^[A-Z][A-Z0-9_]{2,64}$/.test(error.message)
    ? error.message
    : "GOAL_RUNNER_TICK_FAILED";
}

export function startGoalRunner(options: GoalRunnerOptions): GoalRunner {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxBackoffMs = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
  if (
    !Number.isInteger(options.leaseSeconds) ||
    options.leaseSeconds < MIN_LEASE_SECONDS ||
    options.leaseSeconds > MAX_LEASE_SECONDS
  ) {
    throw new Error("GOAL_RUNNER_LEASE_SECONDS_INVALID");
  }
  if (
    options.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit < MIN_LIMIT || options.limit > MAX_LIMIT)
  ) {
    throw new Error("GOAL_RUNNER_LIMIT_INVALID");
  }
  if (
    !Number.isInteger(pollIntervalMs) ||
    pollIntervalMs < 1 ||
    pollIntervalMs > MAX_NODE_TIMEOUT_MS
  ) {
    throw new Error("GOAL_RUNNER_POLL_INTERVAL_INVALID");
  }
  if (
    !Number.isInteger(maxBackoffMs) ||
    maxBackoffMs < pollIntervalMs ||
    maxBackoffMs > MAX_NODE_TIMEOUT_MS
  ) {
    throw new Error("GOAL_RUNNER_MAX_BACKOFF_INVALID");
  }
  if (activeRunner) return activeRunner;

  const ownerId = randomUUID();
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;
  let inFlight: Promise<void> | null = null;
  let consecutiveFailures = 0;

  const tick = (): void => {
    if (stopped || inFlight) return;
    inFlight = (async () => {
      let nextDelayMs = pollIntervalMs;
      try {
        const result = await runGoalLoopOnce({
          ownerId,
          leaseSeconds: options.leaseSeconds,
          limit: options.limit,
          mcpProvider: options.mcpProvider,
        });
        consecutiveFailures = 0;
        if (result.claimed > 0) {
          console.log(JSON.stringify({
            level: "info",
            context: "kernel.goal-runner",
            claimed: result.claimed,
            processed: result.processed,
          }));
        }
      } catch (error) {
        consecutiveFailures += 1;
        nextDelayMs = Math.min(
          maxBackoffMs,
          pollIntervalMs * 2 ** Math.min(consecutiveFailures, MAX_BACKOFF_EXPONENT),
        );
        console.error(JSON.stringify({
          level: "error",
          context: "kernel.goal-runner",
          code: errorCode(error),
          retryMs: nextDelayMs,
        }));
      } finally {
        if (!stopped) timer = setTimeout(tick, nextDelayMs);
      }
    })().finally(() => {
      inFlight = null;
    });
  };

  const runner: GoalRunner = {
    ownerId,
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      await inFlight;
      if (activeRunner === runner) activeRunner = null;
    },
  };
  activeRunner = runner;
  tick();
  return runner;
}
