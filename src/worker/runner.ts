import { randomUUID } from "node:crypto";
import type { KernelAdapter } from "./adapter";
import { StrictA3Adapter } from "../og/strict-a3";
import {
  acquireWorkerLease,
  claimJobs,
  finalizePersistedEffect,
  heartbeatClaimedJobs,
  heartbeatWorkerLease,
  inspectVerifiedA3Effect,
  MAX_WORKER_CONCURRENCY,
  persistFailedEffect,
  persistSuccessfulEffect,
  recoverVerifiedA3Effect,
  reconcileExpiredJobs,
  requeueAfterTransientFailure,
  type ClaimedJob,
} from "./store";
import type { DatabaseClient } from "../kernel/service";
import { getDb } from "../config/database";
import {
  checkFreshEnsAuthority,
  type EnsAuthorityRuntime,
} from "../ens/authority";

export interface WorkerRunOptions {
  ownerId: string;
  concurrency: number;
  leaseSeconds: number;
  adapter?: KernelAdapter;
  sql?: DatabaseClient;
  now?: Date;
  authority?: EnsAuthorityRuntime;
  afterTerminalEffectPersisted?: (job: ClaimedJob) => Promise<void>;
}

function adapterAuthority(adapter: KernelAdapter): EnsAuthorityRuntime | null {
  if (!("authorityRuntime" in adapter)) return null;
  const value = (adapter as KernelAdapter & { authorityRuntime?: unknown }).authorityRuntime;
  return value && typeof value === "object" ? value as EnsAuthorityRuntime : null;
}

async function deliveryAuthority(
  job: ClaimedJob,
  options: WorkerRunOptions,
  signal: AbortSignal,
): Promise<{ allowed: boolean; checkId: string | null; errorCode: string | null }> {
  if (!options.authority) {
    return { allowed: false, checkId: null, errorCode: "ENS_AUTHORITY_NOT_CONFIGURED" };
  }
  return checkFreshEnsAuthority(
    job,
    options.authority,
    "PRE_DELIVERY",
    "ACCEPT_DELIVERY",
    { now: options.now, signal, sql: options.sql ?? getDb() },
  );
}

async function finalizeRecoveredJournal(
  job: ClaimedJob,
  options: WorkerRunOptions,
  leaseLost: () => boolean,
  signal: AbortSignal,
): Promise<boolean> {
  const inspection = await inspectVerifiedA3Effect(job, { now: options.now, sql: options.sql });
  if (inspection.status === "none") return false;
  let authorityCheckId: string | null = null;
  if (inspection.status === "verified") {
    const decision = await deliveryAuthority(job, options, signal);
    if (!decision.allowed || !decision.checkId) {
      const persisted = await persistFailedEffect(
        job,
        decision.errorCode ?? "ENS_AUTHORITY_DENIED",
        { now: options.now, sql: options.sql },
      );
      if (!persisted || leaseLost()) return true;
      await options.afterTerminalEffectPersisted?.(job);
      if (!leaseLost()) await finalizePersistedEffect(job, { now: options.now, sql: options.sql });
      return true;
    }
    authorityCheckId = decision.checkId;
  }
  const recovery = await recoverVerifiedA3Effect(job, {
    authorityCheckId,
    now: options.now,
    sql: options.sql,
  });
  if (recovery.status === "none") return false;
  if (!recovery.persisted || leaseLost()) return true;
  await options.afterTerminalEffectPersisted?.(job);
  if (!leaseLost()) {
    await finalizePersistedEffect(job, { now: options.now, sql: options.sql });
  }
  return true;
}

async function processClaimedJob(
  job: ClaimedJob,
  options: WorkerRunOptions,
  leaseLost: () => boolean,
  signal: AbortSignal,
): Promise<void> {
  if (leaseLost()) return;
  const adapter = options.adapter ?? new StrictA3Adapter({
    authority: options.authority,
    sql: options.sql,
    now: options.now,
  });
  const authority = options.authority ?? adapterAuthority(adapter) ?? undefined;
  const runtimeOptions = authority ? { ...options, authority } : options;
  if (await finalizeRecoveredJournal(job, runtimeOptions, leaseLost, signal)) return;
  if (adapter.key !== job.adapterKey) throw new Error("WORKER_ADAPTER_POLICY_MISMATCH");
  let result;
  try {
    result = await adapter.execute({
      effectId: job.effectId,
      jobId: job.jobId,
      intentId: job.intentId,
      buyerUserId: job.buyerUserId,
      agentVersionId: job.agentVersionId,
      ownerUserId: job.ownerUserId,
      leaseOwner: job.leaseOwner,
      workerEpoch: job.workerEpoch,
      claimVersion: job.claimVersion,
      leaseExpiresAt: job.leaseExpiresAt,
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
      input: job.input,
      signal,
    });
  } catch {
    if (leaseLost()) return;
    if (await finalizeRecoveredJournal(job, runtimeOptions, leaseLost, signal)) return;
    await requeueAfterTransientFailure(job, { now: options.now, sql: options.sql });
    return;
  }
  if (leaseLost()) return;
  let persisted = false;
  if (result.ok) {
    if (result.verified !== true) {
      persisted = await persistFailedEffect(job, "A3_VERIFICATION_REQUIRED", {
        now: options.now,
        sql: options.sql,
      });
    } else if (!/^[0-9a-f]{64}$/.test(result.proofHash)) {
      persisted = await persistFailedEffect(job, "A3_INVALID_PROOF_HASH", {
        now: options.now,
        sql: options.sql,
      });
    } else {
      const decision = await deliveryAuthority(job, runtimeOptions, signal);
      if (!decision.allowed || !decision.checkId) {
        persisted = await persistFailedEffect(
          job,
          decision.errorCode ?? "ENS_AUTHORITY_DENIED",
          { now: options.now, sql: options.sql },
        );
      } else {
        persisted = await persistSuccessfulEffect(job, result.result, result.proofHash, {
          authorityCheckId: decision.checkId,
          now: options.now,
          sql: options.sql,
          requireA3Readback: adapter.requiresVerifiedJournal === true,
        });
      }
    }
  } else if (result.retryable) {
    await requeueAfterTransientFailure(job, { now: options.now, sql: options.sql });
    return;
  } else {
    persisted = await persistFailedEffect(job, result.errorCode, {
      now: options.now,
      sql: options.sql,
    });
  }
  if (!persisted || leaseLost()) return;
  await options.afterTerminalEffectPersisted?.(job);
  if (leaseLost()) return;
  await finalizePersistedEffect(job, { now: options.now, sql: options.sql });
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
  let leaseLost = false;
  const activeJobs = new Map(jobs.map((job) => [job.jobId, job]));
  const controllers = new Map(jobs.map((job) => [job.jobId, new AbortController()]));
  const markLeaseLost = (code: string): void => {
    if (leaseLost) return;
    leaseLost = true;
    for (const controller of controllers.values()) controller.abort();
    console.error(JSON.stringify({
      level: "error",
      context: "kernel.worker.heartbeat",
      code,
    }));
  };
  const heartbeatMs = Math.max(1_000, Math.floor(options.leaseSeconds * 1_000 / 3));
  const heartbeat = options.now || jobs.length === 0
    ? null
    : setInterval(() => {
        const heartbeatJobs = [...activeJobs.values()];
        if (heartbeatJobs.length === 0) return;
        void heartbeatClaimedJobs(
          options.ownerId,
          heartbeatJobs,
          options.leaseSeconds,
          { sql: options.sql },
        ).then((renewed) => {
          if (!renewed) markLeaseLost("WORKER_CLAIM_LOST");
        }).catch(() => markLeaseLost("WORKER_HEARTBEAT_FAILED"));
      }, heartbeatMs);
  try {
    await Promise.all(jobs.map(async (job) => {
      try {
        const controller = controllers.get(job.jobId);
        if (!controller) throw new Error("WORKER_ABORT_CONTROLLER_MISSING");
        await processClaimedJob(job, options, () => leaseLost, controller.signal);
      } finally {
        activeJobs.delete(job.jobId);
        controllers.delete(job.jobId);
      }
    }));
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
      const renewed = await heartbeatWorkerLease(ownerId, options.leaseSeconds);
      if (!renewed) {
        console.error(JSON.stringify({
          level: "error",
          context: "kernel.worker",
          code: "WORKER_LEASE_LOST",
        }));
      }
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
