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
import { processPendingHireRequests } from "../kernel/hire-requests";
import type { McpContextProvider } from "../kernel/mcp-context";
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
  signal?: AbortSignal;
  afterTerminalEffectPersisted?: (job: ClaimedJob) => Promise<void>;
  mcpProvider?: McpContextProvider;
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
): Promise<{
  allowed: boolean;
  checkId: string | null;
  walletPublicationDecisionId: string | null;
  errorCode: string | null;
}> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const versions = await sql<{
    publication_mode: "ENS" | "WALLET" | null;
    wallet_publication_decision_id: string | null;
    wallet_authorized: boolean;
  }[]>`
    SELECT version.publication_mode,
      version.wallet_publication_decision_id::text,
      public.agent_version_is_hireable(version.id) AS wallet_authorized
    FROM jobs job
    JOIN effects effect ON effect.job_id = job.id
    JOIN agent_versions version ON version.id = job.agent_version_id
    JOIN kernel_agents agent ON agent.id = version.agent_id
    JOIN worker_leases lease ON lease.key = 'kernel-worker'
    WHERE job.id = ${job.jobId}::uuid AND effect.id = ${job.effectId}
      AND job.agent_version_id = ${job.agentVersionId}::uuid
      AND agent.owner_user_id = ${job.ownerUserId}
      AND job.state = 'RUNNING' AND job.version = ${job.claimVersion}
      AND job.lease_owner = ${job.leaseOwner}
      AND job.lease_expires_at = ${job.leaseExpiresAt}
      AND job.lease_expires_at > ${now}
      AND lease.owner_id = ${job.leaseOwner}
      AND lease.epoch = ${job.workerEpoch}::bigint AND lease.expires_at > ${now}
  `;
  const version = versions[0];
  if (!version) {
    return {
      allowed: false,
      checkId: null,
      walletPublicationDecisionId: null,
      errorCode: "WORKER_CLAIM_LOST",
    };
  }
  if (version.publication_mode === "WALLET") {
    const decisionId = version.wallet_publication_decision_id;
    return version.wallet_authorized && decisionId
      ? { allowed: true, checkId: null, walletPublicationDecisionId: decisionId, errorCode: null }
      : {
          allowed: false,
          checkId: null,
          walletPublicationDecisionId: null,
          errorCode: "WALLET_PUBLICATION_AUTHORITY_DENIED",
        };
  }
  const allowLegacyFixture = version.publication_mode === null &&
    options.sql !== undefined && process.env.NODE_ENV === "test";
  if (version.publication_mode !== "ENS" && !allowLegacyFixture) {
    return {
      allowed: false,
      checkId: null,
      walletPublicationDecisionId: null,
      errorCode: "PUBLICATION_AUTHORITY_MODE_INVALID",
    };
  }
  if (!options.authority) {
    return {
      allowed: false,
      checkId: null,
      walletPublicationDecisionId: null,
      errorCode: "ENS_AUTHORITY_NOT_CONFIGURED",
    };
  }
  const decision = await checkFreshEnsAuthority(
    job,
    options.authority,
    "PRE_DELIVERY",
    "ACCEPT_DELIVERY",
    { now: options.now, signal, sql: options.sql ?? getDb() },
  );
  return { ...decision, walletPublicationDecisionId: null };
}

function receiptAuthority(decision: Awaited<ReturnType<typeof deliveryAuthority>>): {
  authorityCheckId?: string;
  walletPublicationDecisionId?: string;
} {
  return decision.checkId
    ? { authorityCheckId: decision.checkId }
    : decision.walletPublicationDecisionId
      ? { walletPublicationDecisionId: decision.walletPublicationDecisionId }
      : {};
}

async function finalizeRecoveredJournal(
  job: ClaimedJob,
  options: WorkerRunOptions,
  mutationFenced: () => boolean,
  signal: AbortSignal,
): Promise<boolean> {
  const inspection = await inspectVerifiedA3Effect(job, { now: options.now, sql: options.sql });
  if (mutationFenced()) return true;
  if (inspection.status === "none") return false;
  let authorityCheckId: string | null = null;
  if (inspection.status === "verified") {
    const decision = await deliveryAuthority(job, options, signal);
    if (mutationFenced()) return true;
    if (!decision.allowed) {
      const persisted = await persistFailedEffect(
        job,
        decision.errorCode ?? "ENS_AUTHORITY_DENIED",
        { now: options.now, sql: options.sql },
      );
      if (!persisted || mutationFenced()) return true;
      await options.afterTerminalEffectPersisted?.(job);
      if (!mutationFenced()) {
        await finalizePersistedEffect(job, { now: options.now, sql: options.sql });
      }
      return true;
    }
    authorityCheckId = decision.checkId;
    const recovery = await recoverVerifiedA3Effect(job, {
      ...receiptAuthority(decision),
      now: options.now,
      sql: options.sql,
    });
    if (recovery.status === "none") return false;
    if (!recovery.persisted || mutationFenced()) return true;
    await options.afterTerminalEffectPersisted?.(job);
    if (!mutationFenced()) {
      await finalizePersistedEffect(job, { now: options.now, sql: options.sql });
    }
    return true;
  }
  const recovery = await recoverVerifiedA3Effect(job, {
    authorityCheckId,
    now: options.now,
    sql: options.sql,
  });
  if (recovery.status === "none") return false;
  if (!recovery.persisted || mutationFenced()) return true;
  await options.afterTerminalEffectPersisted?.(job);
  if (!mutationFenced()) {
    await finalizePersistedEffect(job, { now: options.now, sql: options.sql });
  }
  return true;
}

async function processClaimedJob(
  job: ClaimedJob,
  options: WorkerRunOptions,
  mutationFenced: () => boolean,
  signal: AbortSignal,
): Promise<void> {
  if (mutationFenced()) return;
  const adapter = options.adapter ?? new StrictA3Adapter({
    authority: options.authority,
    sql: options.sql,
    now: options.now,
  });
  const authority = options.authority ?? adapterAuthority(adapter) ?? undefined;
  const runtimeOptions = authority ? { ...options, authority } : options;
  if (await finalizeRecoveredJournal(job, runtimeOptions, mutationFenced, signal)) return;
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
    if (mutationFenced()) return;
    if (await finalizeRecoveredJournal(job, runtimeOptions, mutationFenced, signal)) return;
    await requeueAfterTransientFailure(job, { now: options.now, sql: options.sql });
    return;
  }
  if (mutationFenced()) return;
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
      if (mutationFenced()) return;
      if (!decision.allowed) {
        persisted = await persistFailedEffect(
          job,
          decision.errorCode ?? "ENS_AUTHORITY_DENIED",
          { now: options.now, sql: options.sql },
        );
      } else {
        persisted = await persistSuccessfulEffect(job, result.result, result.proofHash, {
          ...receiptAuthority(decision),
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
  if (!persisted || mutationFenced()) return;
  await options.afterTerminalEffectPersisted?.(job);
  if (mutationFenced()) return;
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
  if (options.signal?.aborted) return { leaseAcquired: false, claimed: 0 };
  const lease = await acquireWorkerLease(options.ownerId, options.leaseSeconds, {
    now: options.now,
    sql: options.sql,
  });
  if (!lease.acquired) return { leaseAcquired: false, claimed: 0 };
  if (!lease.epoch || !lease.expiresAt) throw new Error("WORKER_LEASE_INVALID");
  if (options.signal?.aborted) return { leaseAcquired: true, claimed: 0 };
  await processPendingHireRequests({
    workerId: options.ownerId,
    workerEpoch: BigInt(lease.epoch),
    leaseExpiresAt: lease.expiresAt,
    limit: options.concurrency,
    mcpProvider: options.mcpProvider,
    now: options.now,
    sql: options.sql,
    signal: options.signal,
  });
  if (options.signal?.aborted) return { leaseAcquired: true, claimed: 0 };
  await reconcileExpiredJobs({ now: options.now, sql: options.sql });
  if (options.signal?.aborted) return { leaseAcquired: true, claimed: 0 };
  const jobs = await claimJobs(
    options.ownerId,
    options.concurrency,
    options.leaseSeconds,
    { now: options.now, sql: options.sql },
  );
  let leaseLost = false;
  const activeJobs = new Map(jobs.map((job) => [job.jobId, job]));
  const controllers = new Map(jobs.map((job) => [job.jobId, new AbortController()]));
  const abortActiveJobs = (): void => {
    for (const controller of controllers.values()) controller.abort();
  };
  const mutationFenced = (): boolean => leaseLost || options.signal?.aborted === true;
  const markLeaseLost = (code: string): void => {
    if (leaseLost) return;
    leaseLost = true;
    abortActiveJobs();
    console.error(JSON.stringify({
      level: "error",
      context: "kernel.worker.heartbeat",
      code,
    }));
  };
  options.signal?.addEventListener("abort", abortActiveJobs, { once: true });
  if (options.signal?.aborted) abortActiveJobs();
  const heartbeatMs = Math.max(1_000, Math.floor(options.leaseSeconds * 1_000 / 3));
  let heartbeatInFlight: Promise<void> | null = null;
  const heartbeat = options.now || jobs.length === 0
    ? null
    : setInterval(() => {
        if (mutationFenced() || heartbeatInFlight) return;
        const heartbeatJobs = [...activeJobs.values()];
        if (heartbeatJobs.length === 0) return;
        heartbeatInFlight = heartbeatClaimedJobs(
          options.ownerId,
          heartbeatJobs,
          options.leaseSeconds,
          { sql: options.sql },
        ).then((renewed) => {
          if (!renewed) markLeaseLost("WORKER_CLAIM_LOST");
        }).catch(() => markLeaseLost("WORKER_HEARTBEAT_FAILED")).finally(() => {
          heartbeatInFlight = null;
        });
      }, heartbeatMs);
  try {
    await Promise.all(jobs.map(async (job) => {
      try {
        const controller = controllers.get(job.jobId);
        if (!controller) throw new Error("WORKER_ABORT_CONTROLLER_MISSING");
        await processClaimedJob(job, options, mutationFenced, controller.signal);
      } finally {
        activeJobs.delete(job.jobId);
        controllers.delete(job.jobId);
      }
    }));
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await heartbeatInFlight;
    options.signal?.removeEventListener("abort", abortActiveJobs);
  }
  return { leaseAcquired: true, claimed: jobs.length };
}

export function startKernelWorker(options: {
  concurrency: number;
  leaseSeconds: number;
  pollIntervalMs?: number;
  mcpProvider?: McpContextProvider;
}): { ownerId: string; stop: () => Promise<void> } {
  const ownerId = randomUUID();
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  let activeController: AbortController | null = null;
  const tick = (): void => {
    if (stopped || inFlight) return;
    const controller = new AbortController();
    activeController = controller;
    inFlight = (async () => {
      try {
        await runWorkerOnce({
          ownerId,
          concurrency: options.concurrency,
          leaseSeconds: options.leaseSeconds,
          mcpProvider: options.mcpProvider,
          signal: controller.signal,
        });
        if (stopped || controller.signal.aborted) return;
        const renewed = await heartbeatWorkerLease(ownerId, options.leaseSeconds);
        if (!renewed) {
          console.error(JSON.stringify({
            level: "error",
            context: "kernel.worker",
            code: "WORKER_LEASE_LOST",
          }));
        }
      } catch (error) {
        if (stopped && controller.signal.aborted) return;
        const code = error instanceof Error && /^[A-Z][A-Z0-9_]{2,64}$/.test(error.message)
          ? error.message
          : "WORKER_TICK_FAILED";
        console.error(JSON.stringify({ level: "error", context: "kernel.worker", code }));
      }
    })().finally(() => {
      if (activeController === controller) activeController = null;
      inFlight = null;
    });
  };
  const timer = setInterval(tick, pollIntervalMs);
  tick();
  return {
    ownerId,
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      activeController?.abort();
      await inFlight;
    },
  };
}
