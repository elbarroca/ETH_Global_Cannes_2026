import { getDb } from "../config/database";
import { domainHash, type CanonicalValue } from "../kernel/canonical";
import { commissionAmount, type DatabaseClient } from "../kernel/service";
import type { JobState } from "../kernel/types";

export const KERNEL_WORKER_LEASE_KEY = "kernel-worker";
export const MAX_WORKER_CONCURRENCY = 4;

export interface ClaimedJob {
  jobId: string;
  effectId: string;
  intentId: string;
  buyerUserId: string;
  agentVersionId: string;
  ownerUserId: string;
  adapterKey: "protected-a3";
  input: { prompt: string };
  attempt: number;
  maxAttempts: number;
}

interface LeaseRow {
  owner_id: string;
  epoch: string;
  expires_at: Date;
}

interface ClaimRow {
  job_id: string;
  effect_id: string;
  intent_id: string;
  buyer_user_id: string;
  agent_version_id: string;
  owner_user_id: string;
  adapter_key: "protected-a3";
  input: { prompt: string };
  attempts: number;
  max_attempts: number;
}

interface ReconcileRow {
  job_id: string;
  buyer_user_id: string;
  state: "RUNNING";
  version: number;
  attempts: number;
  max_attempts: number;
  cancel_requested_at: Date | null;
  effect_id: string;
  effect_state: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  error_code: string | null;
}

interface TerminalContextRow {
  job_id: string;
  state: JobState;
  version: number;
  effect_id: string;
  effect_state: "SUCCEEDED" | "FAILED" | "CANCELED";
  error_code: string | null;
  receipt_id: string | null;
  amount_atomic: string;
  asset: string;
  owner_user_id: string;
  financial_outcome: "SETTLED" | "REFUNDED" | null;
}

function transactionClient(transaction: unknown): DatabaseClient {
  return transaction as DatabaseClient;
}

export async function acquireWorkerLease(
  ownerId: string,
  leaseSeconds: number,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<{ acquired: boolean; epoch: string | null; expiresAt: Date | null }> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + leaseSeconds * 1_000);
  const rows = await sql<LeaseRow[]>`
    INSERT INTO worker_leases (
      key, owner_id, epoch, heartbeat_at, expires_at, created_at, updated_at
    ) VALUES (
      ${KERNEL_WORKER_LEASE_KEY}, ${ownerId}, 1, ${now}, ${expiresAt}, ${now}, ${now}
    )
    ON CONFLICT (key) DO UPDATE
    SET owner_id = EXCLUDED.owner_id,
        epoch = CASE
          WHEN worker_leases.owner_id = EXCLUDED.owner_id THEN worker_leases.epoch
          ELSE worker_leases.epoch + 1
        END,
        heartbeat_at = EXCLUDED.heartbeat_at,
        expires_at = EXCLUDED.expires_at,
        updated_at = EXCLUDED.updated_at
    WHERE worker_leases.owner_id = EXCLUDED.owner_id
       OR worker_leases.expires_at <= ${now}
    RETURNING owner_id, epoch::text, expires_at
  `;
  const lease = rows[0];
  return {
    acquired: lease?.owner_id === ownerId,
    epoch: lease?.epoch ?? null,
    expiresAt: lease ? new Date(lease.expires_at) : null,
  };
}

export async function heartbeatWorkerLease(
  ownerId: string,
  leaseSeconds: number,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<boolean> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + leaseSeconds * 1_000);
  const rows = await sql<{ key: string }[]>`
    UPDATE worker_leases
    SET heartbeat_at = ${now}, expires_at = ${expiresAt}, updated_at = ${now}
    WHERE key = ${KERNEL_WORKER_LEASE_KEY}
      AND owner_id = ${ownerId}
      AND expires_at > ${now}
    RETURNING key
  `;
  return rows.length === 1;
}

export async function heartbeatClaimedJobs(
  ownerId: string,
  jobIds: readonly string[],
  leaseSeconds: number,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<boolean> {
  if (jobIds.length === 0) return true;
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + leaseSeconds * 1_000);
  return sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    const lease = await tx<{ key: string }[]>`
      UPDATE worker_leases
      SET heartbeat_at = ${now}, expires_at = ${expiresAt}, updated_at = ${now}
      WHERE key = ${KERNEL_WORKER_LEASE_KEY}
        AND owner_id = ${ownerId}
        AND expires_at > ${now}
      RETURNING key
    `;
    if (lease.length !== 1) return false;
    await tx`
      UPDATE jobs
      SET lease_expires_at = ${expiresAt}, updated_at = ${now}
      WHERE lease_owner = ${ownerId}
        AND state = 'RUNNING'
        AND id = ANY(${tx.array([...jobIds])}::uuid[])
    `;
    return true;
  });
}

async function assertLease(
  tx: DatabaseClient,
  ownerId: string,
  now: Date,
): Promise<void> {
  const rows = await tx<{ owner_id: string }[]>`
    SELECT owner_id FROM worker_leases
    WHERE key = ${KERNEL_WORKER_LEASE_KEY}
      AND owner_id = ${ownerId}
      AND expires_at > ${now}
    FOR UPDATE
  `;
  if (rows.length !== 1) throw new Error("WORKER_LEASE_NOT_HELD");
}

export async function claimJobs(
  ownerId: string,
  limit: number,
  leaseSeconds: number,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<ClaimedJob[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_WORKER_CONCURRENCY) {
    throw new Error("WORKER_INVALID_CONCURRENCY");
  }
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + leaseSeconds * 1_000);
  return sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    await assertLease(tx, ownerId, now);
    const candidates = await tx<{ id: string }[]>`
      SELECT id FROM jobs
      WHERE state = 'QUEUED'
        AND available_at <= ${now}
        AND attempts < max_attempts
        AND cancel_requested_at IS NULL
      ORDER BY created_at ASC, id ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;
    const claimed: ClaimRow[] = [];
    for (const candidate of candidates) {
      const jobs = await tx<{ id: string; version: number; attempts: number }[]>`
        UPDATE jobs
        SET state = 'RUNNING', version = version + 1, attempts = attempts + 1,
            lease_owner = ${ownerId}, lease_expires_at = ${expiresAt}, updated_at = ${now}
        WHERE id = ${candidate.id}::uuid AND state = 'QUEUED'
        RETURNING id, version, attempts
      `;
      const job = jobs[0];
      if (!job) continue;
      await tx`
        UPDATE effects
        SET state = 'RUNNING', attempt = ${job.attempts}, updated_at = ${now}
        WHERE job_id = ${job.id}::uuid AND state IN ('PENDING', 'RUNNING')
      `;
      await tx`
        INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
        VALUES (
          ${job.id}::uuid, ${job.version}, 'JOB_CLAIMED', 'QUEUED', 'RUNNING',
          ${tx.json({ leaseOwner: ownerId })}, ${now}
        )
      `;
      const contexts = await tx<ClaimRow[]>`
        SELECT
          j.id AS job_id, e.id AS effect_id, j.intent_id, j.buyer_user_id,
          j.agent_version_id, a.owner_user_id, v.adapter_key, i.input,
          j.attempts, j.max_attempts
        FROM jobs j
        JOIN effects e ON e.job_id = j.id
        JOIN job_intents i ON i.id = j.intent_id
        JOIN agent_versions v ON v.id = j.agent_version_id
        JOIN kernel_agents a ON a.id = v.agent_id
        WHERE j.id = ${job.id}::uuid
      `;
      const context = contexts[0];
      if (context) claimed.push(context);
    }
    return claimed.map((row) => ({
      jobId: row.job_id,
      effectId: row.effect_id,
      intentId: row.intent_id,
      buyerUserId: row.buyer_user_id,
      agentVersionId: row.agent_version_id,
      ownerUserId: row.owner_user_id,
      adapterKey: row.adapter_key,
      input: row.input,
      attempt: row.attempts,
      maxAttempts: row.max_attempts,
    }));
  });
}

export async function persistSuccessfulEffect(
  job: ClaimedJob,
  result: CanonicalValue,
  proofHash: string,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(proofHash)) throw new Error("WORKER_INVALID_PROOF_HASH");
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const resultHash = domainHash("effect-result", result);
  return sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    const effects = await tx<{ id: string }[]>`
      UPDATE effects
      SET state = 'SUCCEEDED', result_hash = ${resultHash}, result = ${tx.json(result)},
          terminal_at = ${now}, updated_at = ${now}
      WHERE id = ${job.effectId} AND job_id = ${job.jobId}::uuid AND state = 'RUNNING'
      RETURNING id
    `;
    if (effects.length === 0) {
      const existing = await tx<{ state: string }[]>`
        SELECT state FROM effects WHERE id = ${job.effectId}
      `;
      return existing[0]?.state === "SUCCEEDED";
    }
    await tx`
      INSERT INTO receipts (
        job_id, effect_id, verified, adapter_key, proof_hash, result_hash, created_at
      ) VALUES (
        ${job.jobId}::uuid, ${job.effectId}, true, ${job.adapterKey},
        ${proofHash}, ${resultHash}, ${now}
      )
      ON CONFLICT (job_id) DO NOTHING
    `;
    return true;
  });
}

export async function persistFailedEffect(
  job: ClaimedJob,
  errorCode: string,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<boolean> {
  if (!/^[A-Z][A-Z0-9_]{2,64}$/.test(errorCode)) throw new Error("WORKER_INVALID_ERROR_CODE");
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const rows = await sql<{ id: string }[]>`
    UPDATE effects
    SET state = 'FAILED', error_code = ${errorCode}, terminal_at = ${now}, updated_at = ${now}
    WHERE id = ${job.effectId} AND job_id = ${job.jobId}::uuid AND state = 'RUNNING'
    RETURNING id
  `;
  return rows.length === 1;
}

async function terminalContext(tx: DatabaseClient, jobId: string): Promise<TerminalContextRow> {
  const rows = await tx<TerminalContextRow[]>`
    SELECT
      j.id AS job_id, j.state, j.version, e.id AS effect_id,
      e.state AS effect_state, e.error_code, r.id AS receipt_id,
      o.amount_atomic::text, o.asset, a.owner_user_id, j.financial_outcome
    FROM jobs j
    JOIN effects e ON e.job_id = j.id
    JOIN kernel_orders o ON o.id = j.order_id
    JOIN agent_versions v ON v.id = j.agent_version_id
    JOIN kernel_agents a ON a.id = v.agent_id
    LEFT JOIN receipts r ON r.job_id = j.id
    WHERE j.id = ${jobId}::uuid
    FOR UPDATE OF j
  `;
  const row = rows[0];
  if (!row) throw new Error("WORKER_JOB_NOT_FOUND");
  return row;
}

async function createRefund(
  tx: DatabaseClient,
  context: TerminalContextRow,
  reasonCode: string,
  now: Date,
): Promise<void> {
  if (context.financial_outcome) return;
  await tx`
    INSERT INTO refunds (job_id, amount_atomic, asset, reason_code, created_at)
    VALUES (
      ${context.job_id}::uuid, ${context.amount_atomic}::bigint,
      ${context.asset}, ${reasonCode}, ${now}
    )
    ON CONFLICT (job_id) DO NOTHING
  `;
}

export async function finalizePersistedEffect(
  jobId: string,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<JobState> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  return sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    const context = await terminalContext(tx, jobId);
    if (context.state !== "RUNNING") return context.state;
    const nextVersion = context.version + 1;
    if (context.effect_state === "SUCCEEDED") {
      if (!context.receipt_id) throw new Error("WORKER_VERIFIED_RECEIPT_MISSING");
      await tx`
        UPDATE jobs
        SET state = 'SUCCEEDED', version = ${nextVersion}, lease_owner = NULL,
            lease_expires_at = NULL, updated_at = ${now}
        WHERE id = ${jobId}::uuid AND state = 'RUNNING' AND version = ${context.version}
      `;
      await tx`
        INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
        VALUES (${jobId}::uuid, ${nextVersion}, 'JOB_SUCCEEDED', 'RUNNING', 'SUCCEEDED', ${tx.json({})}, ${now})
      `;
      const settlements = await tx<{ id: string }[]>`
        INSERT INTO settlements (job_id, receipt_id, amount_atomic, asset, created_at)
        VALUES (
          ${jobId}::uuid, ${context.receipt_id}::uuid,
          ${context.amount_atomic}::bigint, ${context.asset}, ${now}
        )
        RETURNING id
      `;
      const settlement = settlements[0];
      if (!settlement) throw new Error("WORKER_SETTLEMENT_CREATE_FAILED");
      const commission = commissionAmount(BigInt(context.amount_atomic));
      await tx`
        INSERT INTO commissions (
          job_id, settlement_id, recipient_user_id, amount_atomic, asset, created_at
        ) VALUES (
          ${jobId}::uuid, ${settlement.id}::uuid, ${context.owner_user_id},
          ${commission.toString()}::bigint, ${context.asset}, ${now}
        )
      `;
      return "SUCCEEDED";
    }
    if (context.effect_state === "FAILED") {
      const terminalState: JobState = context.error_code === "A3_NOT_CONFIGURED"
        ? "A3_NOT_CONFIGURED"
        : "FAILED";
      const errorCode = context.error_code ?? "EFFECT_FAILED";
      await tx`
        UPDATE jobs
        SET state = ${terminalState}, version = ${nextVersion}, last_error_code = ${errorCode},
            lease_owner = NULL, lease_expires_at = NULL, updated_at = ${now}
        WHERE id = ${jobId}::uuid AND state = 'RUNNING' AND version = ${context.version}
      `;
      await tx`
        INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
        VALUES (
          ${jobId}::uuid, ${nextVersion}, 'JOB_FAILED', 'RUNNING', ${terminalState},
          ${tx.json({ errorCode })}, ${now}
        )
      `;
      await createRefund(tx, { ...context, state: terminalState }, errorCode, now);
      return terminalState;
    }
    if (context.effect_state === "CANCELED") {
      await tx`
        UPDATE jobs
        SET state = 'CANCELED', version = ${nextVersion}, lease_owner = NULL,
            lease_expires_at = NULL, updated_at = ${now}
        WHERE id = ${jobId}::uuid AND state = 'RUNNING' AND version = ${context.version}
      `;
      await tx`
        INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
        VALUES (${jobId}::uuid, ${nextVersion}, 'JOB_CANCELED', 'RUNNING', 'CANCELED', ${tx.json({})}, ${now})
      `;
      await createRefund(tx, { ...context, state: "CANCELED" }, "JOB_CANCELED", now);
      return "CANCELED";
    }
    throw new Error("WORKER_EFFECT_NOT_TERMINAL");
  });
}

export async function requeueAfterTransientFailure(
  job: ClaimedJob,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<void> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  if (job.attempt >= job.maxAttempts) {
    await persistFailedEffect(job, "ATTEMPTS_EXHAUSTED", { now, sql });
    await finalizePersistedEffect(job.jobId, { now, sql });
    return;
  }
  await sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    const rows = await tx<{ version: number }[]>`
      UPDATE jobs
      SET state = 'QUEUED', version = version + 1, lease_owner = NULL,
          lease_expires_at = NULL, available_at = ${now}, updated_at = ${now}
      WHERE id = ${job.jobId}::uuid AND state = 'RUNNING'
      RETURNING version
    `;
    const row = rows[0];
    if (!row) return;
    await tx`
      INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
      VALUES (
        ${job.jobId}::uuid, ${row.version}, 'JOB_REQUEUED', 'RUNNING', 'QUEUED',
        ${tx.json({ reasonCode: "TRANSIENT_ADAPTER_FAILURE" })}, ${now}
      )
    `;
  });
}

async function cancelExpiredJob(
  tx: DatabaseClient,
  row: ReconcileRow,
  now: Date,
): Promise<void> {
  await tx`
    UPDATE effects
    SET state = 'CANCELED', error_code = 'JOB_CANCELED', terminal_at = ${now}, updated_at = ${now}
    WHERE id = ${row.effect_id} AND state IN ('PENDING', 'RUNNING')
  `;
}

export async function reconcileExpiredJobs(
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<{ reconciled: number; requeued: number }> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const expired = await sql<ReconcileRow[]>`
    SELECT
      j.id AS job_id, j.buyer_user_id, j.state, j.version, j.attempts,
      j.max_attempts, j.cancel_requested_at, e.id AS effect_id,
      e.state AS effect_state, e.error_code
    FROM jobs j
    JOIN effects e ON e.job_id = j.id
    WHERE j.state = 'RUNNING' AND j.lease_expires_at <= ${now}
    ORDER BY j.created_at ASC, j.id ASC
  `;
  let reconciled = 0;
  let requeued = 0;
  for (const candidate of expired) {
    if (["SUCCEEDED", "FAILED", "CANCELED"].includes(candidate.effect_state)) {
      await finalizePersistedEffect(candidate.job_id, { now, sql });
      reconciled += 1;
      continue;
    }
    if (candidate.cancel_requested_at) {
      await sql.begin(async (transaction) => {
        await cancelExpiredJob(transactionClient(transaction), candidate, now);
      });
      await finalizePersistedEffect(candidate.job_id, { now, sql });
      reconciled += 1;
      continue;
    }
    if (candidate.attempts >= candidate.max_attempts) {
      const claimed: ClaimedJob = {
        jobId: candidate.job_id,
        effectId: candidate.effect_id,
        intentId: "",
        buyerUserId: candidate.buyer_user_id,
        agentVersionId: "",
        ownerUserId: "",
        adapterKey: "protected-a3",
        input: { prompt: "" },
        attempt: candidate.attempts,
        maxAttempts: candidate.max_attempts,
      };
      await persistFailedEffect(claimed, "ATTEMPTS_EXHAUSTED", { now, sql });
      await finalizePersistedEffect(candidate.job_id, { now, sql });
      reconciled += 1;
      continue;
    }
    const rows = await sql<{ version: number }[]>`
      UPDATE jobs
      SET state = 'QUEUED', version = version + 1, lease_owner = NULL,
          lease_expires_at = NULL, available_at = ${now}, updated_at = ${now}
      WHERE id = ${candidate.job_id}::uuid AND state = 'RUNNING'
        AND version = ${candidate.version} AND lease_expires_at <= ${now}
      RETURNING version
    `;
    const changed = rows[0];
    if (changed) {
      await sql`
        INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
        VALUES (
          ${candidate.job_id}::uuid, ${changed.version}, 'JOB_LEASE_EXPIRED',
          'RUNNING', 'QUEUED', ${sql.json({})}, ${now}
        )
      `;
      requeued += 1;
    }
  }
  return { reconciled, requeued };
}
