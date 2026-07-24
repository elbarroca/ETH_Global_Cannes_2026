import { randomUUID } from "node:crypto";
import { domainHash } from "../kernel/canonical";
import type { KernelAdapter } from "./adapter";
import { ProtectedA3Adapter } from "./adapter";
import {
  acquireWorkerLease,
  claimJobs,
  finalizePersistedEffect,
  heartbeatClaimedJobs,
  heartbeatWorkerLease,
  MAX_WORKER_CONCURRENCY,
  persistFailedEffect,
  persistSuccessfulEffect,
  reconcileExpiredJobs,
  requeueAfterTransientFailure,
  type ClaimedJob,
} from "./store";
import type { DatabaseClient } from "../kernel/service";

export interface WorkerRunOptions {
  ownerId: string;
  concurrency: number;
  leaseSeconds: number;
  adapter?: KernelAdapter;
  sql?: DatabaseClient;
  now?: Date;
  afterTerminalEffectPersisted?: (job: ClaimedJob) => Promise<void>;
}

async function processClaimedJob(job: ClaimedJob, options: WorkerRunOptions): Promise<void> {
  const adapter = options.adapter ?? new ProtectedA3Adapter();
  if (adapter.key !== job.adapterKey) throw new Error("WORKER_ADAPTER_POLICY_MISMATCH");
  let result;
  try {
    result = await adapter.execute({
      effectId: job.effectId,
      jobId: job.jobId,
      agentVersionId: job.agentVersionId,
      input: job.input,
    });
  } catch {
    await requeueAfterTransientFailure(job, { now: options.now, sql: options.sql });
    return;
  }
  if (result.ok) {
    const proofHash = /^[0-9a-f]{64}$/.test(result.proofHash)
      ? result.proofHash
      : domainHash("adapter-proof", result.proofHash);
    await persistSuccessfulEffect(job, result.result, proofHash, {
      now: options.now,
      sql: options.sql,
    });
  } else if (result.retryable) {
    await requeueAfterTransientFailure(job, { now: options.now, sql: options.sql });
    return;
  } else {
    await persistFailedEffect(job, result.errorCode, { now: options.now, sql: options.sql });
  }
  await options.afterTerminalEffectPersisted?.(job);
  await finalizePersistedEffect(job.jobId, { now: options.now, sql: options.sql });
}

export async function runWorkerOnce(options: WorkerRunOptions): Promise<{
  leaseAcquired: boolean;
  claimed: number;
}> {
  if (
    !Number.isInteger(options.concurrency) ||
    options.concurrency < 1 ||
    options.concurrency > MAX_WORKER_CONCURRENCY
  ) {
    throw new Error("WORKER_INVALID_CONCURRENCY");
  }
  const lease = await acquireWorkerLease(options.ownerId, options.leaseSeconds, {
    now: options.now,
    sql: options.sql,
  });
  if (!lease.acquired) return { leaseAcquired: false, claimed: 0 };
  await reconcileExpiredJobs({ now: options.now, sql: options.sql });
  const jobs = await claimJobs(
    options.ownerId,
    options.concurrency,
    options.leaseSeconds,
    { now: options.now, sql: options.sql },
  );
  const heartbeatMs = Math.max(1_000, Math.floor(options.leaseSeconds * 1_000 / 3));
  const heartbeat = options.now || jobs.length === 0
    ? null
    : setInterval(() => {
        void heartbeatClaimedJobs(
          options.ownerId,
          jobs.map((job) => job.jobId),
          options.leaseSeconds,
          { sql: options.sql },
        ).catch(() => {
          console.error(JSON.stringify({
            level: "error",
            context: "kernel.worker.heartbeat",
            code: "WORKER_HEARTBEAT_FAILED",
          }));
        });
      }, heartbeatMs);
  try {
    await Promise.all(jobs.map((job) => processClaimedJob(job, options)));
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
  return { leaseAcquired: true, claimed: jobs.length };
}

export function startKernelWorker(options: {
  concurrency: number;
  leaseSeconds: number;
  pollIntervalMs?: number;
}): { ownerId: string; stop: () => void } {
  const ownerId = randomUUID();
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  let stopped = false;
  let running = false;
  const tick = async (): Promise<void> => {
    if (stopped || running) return;
    running = true;
    try {
      await runWorkerOnce({
        ownerId,
        concurrency: options.concurrency,
        leaseSeconds: options.leaseSeconds,
      });
      await heartbeatWorkerLease(ownerId, options.leaseSeconds);
    } catch (error) {
      const code = error instanceof Error && /^[A-Z][A-Z0-9_]{2,64}$/.test(error.message)
        ? error.message
        : "WORKER_TICK_FAILED";
      console.error(JSON.stringify({ level: "error", context: "kernel.worker", code }));
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), pollIntervalMs);
  void tick();
  return {
    ownerId,
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}
