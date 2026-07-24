import { getDb } from "../config/database";
import { domainHash, type CanonicalValue } from "../kernel/canonical";
import { commissionAmount, type DatabaseClient } from "../kernel/service";
import type { JobState } from "../kernel/types";

export const KERNEL_WORKER_LEASE_KEY = "kernel-worker";
export const MAX_WORKER_CONCURRENCY = 4;

type EffectState = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";

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
  leaseOwner: string;
  workerEpoch: string;
  claimVersion: number;
  leaseExpiresAt: Date;
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
  version: number;
  lease_owner: string;
  lease_expires_at: Date;
}

interface ReconcileCandidateRow {
  job_id: string;
  version: number;
}

interface TerminalContextRow {
  job_id: string;
  state: JobState;
  version: number;
  effect_id: string;
  effect_state: EffectState;
  error_code: string | null;
  receipt_id: string | null;
  amount_atomic: string;
  asset: string;
  owner_user_id: string;
  financial_outcome: "SETTLED" | "REFUNDED" | null;
}

interface ReconcileContextRow extends TerminalContextRow {
  attempts: number;
  max_attempts: number;
  cancel_requested_at: Date | null;
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
  jobs: readonly ClaimedJob[],
  leaseSeconds: number,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<boolean> {
  if (jobs.length === 0) return true;
  if (jobs.some((job) => job.leaseOwner !== ownerId)) return false;
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + leaseSeconds * 1_000);
  return sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    const leases = await tx<LeaseRow[]>`
      SELECT owner_id, epoch::text, expires_at
      FROM worker_leases
      WHERE key = ${KERNEL_WORKER_LEASE_KEY}
      FOR UPDATE
    `;
    const lease = leases[0];
    if (
      !lease ||
      lease.owner_id !== ownerId ||
      lease.expires_at <= now ||
      jobs.some((job) => job.workerEpoch !== lease.epoch)
    ) {
      return false;
    }
    const activeJobs: ClaimedJob[] = [];
    for (const job of jobs) {
      const rows = await tx<{
        effect_id: string;
        lease_expires_at: Date | null;
        lease_owner: string | null;
        state: JobState;
        version: number;
      }[]>`
        SELECT
          e.id AS effect_id, j.lease_expires_at, j.lease_owner, j.state, j.version
        FROM jobs j
        JOIN effects e ON e.job_id = j.id
        WHERE j.id = ${job.jobId}::uuid
        FOR UPDATE OF j
      `;
      const row = rows[0];
      if (!row || row.effect_id !== job.effectId) return false;
      const active = row.state === "RUNNING" &&
        row.version === job.claimVersion &&
        row.lease_owner === ownerId &&
        row.lease_expires_at !== null &&
        row.lease_expires_at > now;
      if (active) {
        activeJobs.push(job);
        continue;
      }
      const completed = row.state !== "RUNNING" &&
        row.version > job.claimVersion &&
        row.lease_owner === null;
      if (!completed) return false;
    }
    const renewed = await tx<{ key: string }[]>`
      UPDATE worker_leases
      SET heartbeat_at = ${now}, expires_at = ${expiresAt}, updated_at = ${now}
      WHERE key = ${KERNEL_WORKER_LEASE_KEY}
        AND owner_id = ${ownerId}
        AND epoch = ${lease.epoch}::bigint
        AND expires_at > ${now}
      RETURNING key
    `;
    if (renewed.length !== 1) return false;
    for (const job of activeJobs) {
      const renewedJobs = await tx<{ id: string }[]>`
        UPDATE jobs
        SET lease_expires_at = ${expiresAt}, updated_at = ${now}
        WHERE id = ${job.jobId}::uuid
          AND state = 'RUNNING'
          AND version = ${job.claimVersion}
          AND lease_owner = ${ownerId}
          AND lease_expires_at > ${now}
        RETURNING id
      `;
      if (renewedJobs.length !== 1) throw new Error("WORKER_CLAIM_HEARTBEAT_RACE");
    }
    return true;
  });
}

async function assertLease(
  tx: DatabaseClient,
  ownerId: string,
  now: Date,
): Promise<LeaseRow> {
  const rows = await tx<LeaseRow[]>`
    SELECT owner_id, epoch::text, expires_at
    FROM worker_leases
    WHERE key = ${KERNEL_WORKER_LEASE_KEY}
      AND owner_id = ${ownerId}
      AND expires_at > ${now}
    FOR UPDATE
  `;
  const lease = rows[0];
  if (!lease) throw new Error("WORKER_LEASE_NOT_HELD");
  return lease;
}

export async function currentClaimHeld(
  tx: DatabaseClient,
  job: ClaimedJob,
  now: Date,
): Promise<boolean> {
  const leases = await tx<LeaseRow[]>`
    SELECT owner_id, epoch::text, expires_at
    FROM worker_leases
    WHERE key = ${KERNEL_WORKER_LEASE_KEY}
    FOR UPDATE
  `;
  const lease = leases[0];
  if (
    !lease ||
    lease.owner_id !== job.leaseOwner ||
    lease.epoch !== job.workerEpoch ||
    lease.expires_at <= now
  ) {
    return false;
  }
  const jobs = await tx<{ id: string }[]>`
    SELECT j.id
    FROM jobs j
    JOIN effects e ON e.job_id = j.id
    WHERE j.id = ${job.jobId}::uuid
      AND e.id = ${job.effectId}
      AND j.state = 'RUNNING'
      AND j.version = ${job.claimVersion}
      AND j.lease_owner = ${job.leaseOwner}
      AND j.lease_expires_at > ${now}
    FOR UPDATE OF j
  `;
  return jobs.length === 1;
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
    const lease = await assertLease(tx, ownerId, now);
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
      const effects = await tx<{ id: string }[]>`
        UPDATE effects
        SET state = 'RUNNING', attempt = ${job.attempts}, updated_at = ${now}
        WHERE job_id = ${job.id}::uuid AND state IN ('PENDING', 'RUNNING')
        RETURNING id
      `;
      if (effects.length !== 1) throw new Error("WORKER_EFFECT_CLAIM_INVARIANT");
      await tx`
        INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
        VALUES (
          ${job.id}::uuid, ${job.version}, 'JOB_CLAIMED', 'QUEUED', 'RUNNING',
          ${tx.json({
            leaseOwner: ownerId,
            workerEpoch: lease.epoch,
            claimVersion: job.version,
          })}, ${now}
        )
      `;
      const contexts = await tx<ClaimRow[]>`
        SELECT
          j.id AS job_id, e.id AS effect_id, j.intent_id, j.buyer_user_id,
          j.agent_version_id, a.owner_user_id, v.adapter_key, i.input,
          j.attempts, j.max_attempts, j.version, j.lease_owner, j.lease_expires_at
        FROM jobs j
        JOIN effects e ON e.job_id = j.id
        JOIN job_intents i ON i.id = j.intent_id
        JOIN agent_versions v ON v.id = j.agent_version_id
        JOIN kernel_agents a ON a.id = v.agent_id
        WHERE j.id = ${job.id}::uuid
      `;
      const context = contexts[0];
      if (!context) throw new Error("WORKER_CLAIM_CONTEXT_MISSING");
      claimed.push(context);
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
      leaseOwner: row.lease_owner,
      workerEpoch: lease.epoch,
      claimVersion: row.version,
      leaseExpiresAt: new Date(row.lease_expires_at),
    }));
  });
}

export async function persistSuccessfulEffect(
  job: ClaimedJob,
  result: CanonicalValue,
  proofHash: string,
  options: { now?: Date; sql?: DatabaseClient; requireA3Readback?: boolean } = {},
): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(proofHash)) throw new Error("WORKER_INVALID_PROOF_HASH");
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const resultHash = domainHash("effect-result", result);
  return sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    if (!(await currentClaimHeld(tx, job, now))) return false;
    if (options.requireA3Readback) {
      const journals = await tx<{ effect_id: string }[]>`
        SELECT effect_id
        FROM a3_execution_journals
        WHERE effect_id = ${job.effectId}
          AND job_id = ${job.jobId}::uuid
          AND stage = 'READBACK_VERIFIED'
          AND proof_hash = ${proofHash}
          AND result = ${tx.json(result)}
          AND readback_root = expected_root
          AND readback_digest = expected_digest
          AND readback_size = expected_size
        FOR UPDATE
      `;
      if (journals.length !== 1) return false;
    }
    const effects = await tx<{ id: string }[]>`
      UPDATE effects
      SET state = 'SUCCEEDED', result_hash = ${resultHash}, result = ${tx.json(result)},
          terminal_at = ${now}, updated_at = ${now}
      WHERE id = ${job.effectId} AND job_id = ${job.jobId}::uuid AND state = 'RUNNING'
      RETURNING id
    `;
    if (effects.length === 0) {
      const existing = await tx<{
        state: EffectState;
        result_hash: string | null;
        proof_hash: string | null;
        receipt_result_hash: string | null;
      }[]>`
        SELECT e.state, e.result_hash, r.proof_hash, r.result_hash AS receipt_result_hash
        FROM effects e
        LEFT JOIN receipts r ON r.effect_id = e.id AND r.job_id = e.job_id
        WHERE e.id = ${job.effectId} AND e.job_id = ${job.jobId}::uuid
      `;
      const persisted = existing[0];
      return persisted?.state === "SUCCEEDED" &&
        persisted.result_hash === resultHash &&
        persisted.proof_hash === proofHash &&
        persisted.receipt_result_hash === resultHash;
    }
    const receipts = await tx<{ id: string }[]>`
      INSERT INTO receipts (
        job_id, effect_id, verified, adapter_key, proof_hash, result_hash, created_at
      ) VALUES (
        ${job.jobId}::uuid, ${job.effectId}, true, ${job.adapterKey},
        ${proofHash}, ${resultHash}, ${now}
      )
      ON CONFLICT (job_id) DO NOTHING
      RETURNING id
    `;
    if (receipts.length !== 1) throw new Error("WORKER_RECEIPT_CONFLICT");
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
  return sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    if (!(await currentClaimHeld(tx, job, now))) return false;
    const rows = await tx<{ id: string }[]>`
      UPDATE effects
      SET state = 'FAILED', error_code = ${errorCode}, terminal_at = ${now}, updated_at = ${now}
      WHERE id = ${job.effectId} AND job_id = ${job.jobId}::uuid AND state = 'RUNNING'
      RETURNING id
    `;
    if (rows.length === 1) return true;
    const existing = await tx<{ state: EffectState; error_code: string | null }[]>`
      SELECT state, error_code
      FROM effects
      WHERE id = ${job.effectId} AND job_id = ${job.jobId}::uuid
    `;
    return existing[0]?.state === "FAILED" && existing[0]?.error_code === errorCode;
  });
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
    FOR UPDATE OF j, e
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

async function terminalizeLockedEffect(
  tx: DatabaseClient,
  context: TerminalContextRow,
  now: Date,
): Promise<JobState> {
  if (context.state !== "RUNNING") return context.state;
  const nextVersion = context.version + 1;
  if (context.effect_state === "SUCCEEDED") {
    if (!context.receipt_id) throw new Error("WORKER_VERIFIED_RECEIPT_MISSING");
    const jobs = await tx<{ id: string }[]>`
      UPDATE jobs
      SET state = 'SUCCEEDED', version = ${nextVersion}, lease_owner = NULL,
          lease_expires_at = NULL, updated_at = ${now}
      WHERE id = ${context.job_id}::uuid AND state = 'RUNNING' AND version = ${context.version}
      RETURNING id
    `;
    if (jobs.length !== 1) throw new Error("WORKER_TERMINALIZATION_RACE");
    await tx`
      INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
      VALUES (
        ${context.job_id}::uuid, ${nextVersion}, 'JOB_SUCCEEDED',
        'RUNNING', 'SUCCEEDED', ${tx.json({})}, ${now}
      )
    `;
    const settlements = await tx<{ id: string }[]>`
      INSERT INTO settlements (job_id, receipt_id, amount_atomic, asset, created_at)
      VALUES (
        ${context.job_id}::uuid, ${context.receipt_id}::uuid,
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
        ${context.job_id}::uuid, ${settlement.id}::uuid, ${context.owner_user_id},
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
    const jobs = await tx<{ id: string }[]>`
      UPDATE jobs
      SET state = ${terminalState}, version = ${nextVersion}, last_error_code = ${errorCode},
          lease_owner = NULL, lease_expires_at = NULL, updated_at = ${now}
      WHERE id = ${context.job_id}::uuid AND state = 'RUNNING' AND version = ${context.version}
      RETURNING id
    `;
    if (jobs.length !== 1) throw new Error("WORKER_TERMINALIZATION_RACE");
    await tx`
      INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
      VALUES (
        ${context.job_id}::uuid, ${nextVersion}, 'JOB_FAILED', 'RUNNING', ${terminalState},
        ${tx.json({ errorCode })}, ${now}
      )
    `;
    await createRefund(tx, { ...context, state: terminalState }, errorCode, now);
    return terminalState;
  }
  if (context.effect_state === "CANCELED") {
    const jobs = await tx<{ id: string }[]>`
      UPDATE jobs
      SET state = 'CANCELED', version = ${nextVersion}, lease_owner = NULL,
          lease_expires_at = NULL, updated_at = ${now}
      WHERE id = ${context.job_id}::uuid AND state = 'RUNNING' AND version = ${context.version}
      RETURNING id
    `;
    if (jobs.length !== 1) throw new Error("WORKER_TERMINALIZATION_RACE");
    await tx`
      INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
      VALUES (
        ${context.job_id}::uuid, ${nextVersion}, 'JOB_CANCELED',
        'RUNNING', 'CANCELED', ${tx.json({})}, ${now}
      )
    `;
    await createRefund(tx, { ...context, state: "CANCELED" }, "JOB_CANCELED", now);
    return "CANCELED";
  }
  throw new Error("WORKER_EFFECT_NOT_TERMINAL");
}

export async function finalizePersistedEffect(
  job: ClaimedJob,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<JobState | null> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  return sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    if (!(await currentClaimHeld(tx, job, now))) return null;
    const context = await terminalContext(tx, job.jobId);
    if (context.effect_id !== job.effectId) throw new Error("WORKER_EFFECT_IDENTITY_MISMATCH");
    return terminalizeLockedEffect(tx, context, now);
  });
}

export async function requeueAfterTransientFailure(
  job: ClaimedJob,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<boolean> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  if (job.attempt >= job.maxAttempts) {
    const persisted = await persistFailedEffect(job, "ATTEMPTS_EXHAUSTED", { now, sql });
    if (!persisted) return false;
    return (await finalizePersistedEffect(job, { now, sql })) !== null;
  }
  return sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    if (!(await currentClaimHeld(tx, job, now))) return false;
    const effects = await tx<{ id: string }[]>`
      SELECT id
      FROM effects
      WHERE id = ${job.effectId} AND job_id = ${job.jobId}::uuid AND state = 'RUNNING'
      FOR UPDATE
    `;
    if (effects.length !== 1) return false;
    const rows = await tx<{ version: number }[]>`
      UPDATE jobs
      SET state = 'QUEUED', version = version + 1, lease_owner = NULL,
          lease_expires_at = NULL, available_at = ${now}, updated_at = ${now}
      WHERE id = ${job.jobId}::uuid
        AND state = 'RUNNING'
        AND version = ${job.claimVersion}
        AND lease_owner = ${job.leaseOwner}
        AND lease_expires_at > ${now}
      RETURNING version
    `;
    const row = rows[0];
    if (!row) return false;
    await tx`
      INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
      VALUES (
        ${job.jobId}::uuid, ${row.version}, 'JOB_REQUEUED', 'RUNNING', 'QUEUED',
        ${tx.json({ reasonCode: "TRANSIENT_ADAPTER_FAILURE" })}, ${now}
      )
    `;
    return true;
  });
}

async function reconcileExpiredCandidate(
  candidate: ReconcileCandidateRow,
  now: Date,
  sql: DatabaseClient,
): Promise<"reconciled" | "requeued" | null> {
  return sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    const lockedJobs = await tx<{ id: string }[]>`
      SELECT id
      FROM jobs
      WHERE id = ${candidate.job_id}::uuid
        AND state = 'RUNNING'
        AND version = ${candidate.version}
        AND lease_expires_at <= ${now}
      FOR UPDATE
    `;
    if (lockedJobs.length !== 1) return null;
    const rows = await tx<ReconcileContextRow[]>`
      SELECT
        j.id AS job_id, j.state, j.version, j.attempts, j.max_attempts,
        j.cancel_requested_at, e.id AS effect_id, e.state AS effect_state,
        e.error_code, r.id AS receipt_id, o.amount_atomic::text, o.asset,
        a.owner_user_id, j.financial_outcome
      FROM jobs j
      JOIN effects e ON e.job_id = j.id
      JOIN kernel_orders o ON o.id = j.order_id
      JOIN agent_versions v ON v.id = j.agent_version_id
      JOIN kernel_agents a ON a.id = v.agent_id
      LEFT JOIN receipts r ON r.job_id = j.id
      WHERE j.id = ${candidate.job_id}::uuid
        AND j.state = 'RUNNING'
        AND j.version = ${candidate.version}
        AND j.lease_expires_at <= ${now}
      FOR UPDATE OF e
    `;
    const context = rows[0];
    if (!context) return null;
    if (["SUCCEEDED", "FAILED", "CANCELED"].includes(context.effect_state)) {
      await terminalizeLockedEffect(tx, context, now);
      return "reconciled";
    }
    if (context.cancel_requested_at) {
      const effects = await tx<{ id: string }[]>`
        UPDATE effects
        SET state = 'CANCELED', error_code = 'JOB_CANCELED',
            terminal_at = ${now}, updated_at = ${now}
        WHERE id = ${context.effect_id} AND state IN ('PENDING', 'RUNNING')
        RETURNING id
      `;
      if (effects.length !== 1) throw new Error("WORKER_CANCEL_EFFECT_INVARIANT");
      await terminalizeLockedEffect(
        tx,
        { ...context, effect_state: "CANCELED", error_code: "JOB_CANCELED" },
        now,
      );
      return "reconciled";
    }
    if (context.attempts >= context.max_attempts) {
      const effects = await tx<{ id: string }[]>`
        UPDATE effects
        SET state = 'FAILED', error_code = 'ATTEMPTS_EXHAUSTED',
            terminal_at = ${now}, updated_at = ${now}
        WHERE id = ${context.effect_id} AND state = 'RUNNING'
        RETURNING id
      `;
      if (effects.length !== 1) throw new Error("WORKER_FAILURE_EFFECT_INVARIANT");
      await terminalizeLockedEffect(
        tx,
        { ...context, effect_state: "FAILED", error_code: "ATTEMPTS_EXHAUSTED" },
        now,
      );
      return "reconciled";
    }
    const changed = await tx<{ version: number }[]>`
      UPDATE jobs
      SET state = 'QUEUED', version = version + 1, lease_owner = NULL,
          lease_expires_at = NULL, available_at = ${now}, updated_at = ${now}
      WHERE id = ${candidate.job_id}::uuid
        AND state = 'RUNNING'
        AND version = ${candidate.version}
        AND lease_expires_at <= ${now}
      RETURNING version
    `;
    const requeued = changed[0];
    if (!requeued) return null;
    await tx`
      INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
      VALUES (
        ${candidate.job_id}::uuid, ${requeued.version}, 'JOB_LEASE_EXPIRED',
        'RUNNING', 'QUEUED', ${tx.json({})}, ${now}
      )
    `;
    return "requeued";
  });
}

export async function reconcileExpiredJobs(
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<{ reconciled: number; requeued: number }> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const expired = await sql<ReconcileCandidateRow[]>`
    SELECT id AS job_id, version
    FROM jobs
    WHERE state = 'RUNNING' AND lease_expires_at <= ${now}
    ORDER BY created_at ASC, id ASC
  `;
  let reconciled = 0;
  let requeued = 0;
  for (const candidate of expired) {
    const result = await reconcileExpiredCandidate(candidate, now, sql);
    if (result === "reconciled") reconciled += 1;
    if (result === "requeued") requeued += 1;
  }
  return { reconciled, requeued };
}
