import { getDb } from "../config/database";
import { domainHash } from "./canonical";
import { KernelError } from "./errors";
import type { DatabaseClient } from "./service";
import type { HireRequestSnapshot, HireRequestState } from "./types";

interface HireRequestRow {
  id: string;
  agent_version_id: string;
  prompt_hash: string;
  state: HireRequestState;
  version: number;
  job_id: string | null;
  context_hash: string | null;
  error_code: string | null;
  created_at: Date;
  updated_at: Date;
}

function snapshot(row: HireRequestRow, replayed: boolean): HireRequestSnapshot {
  return {
    hireRequestId: row.id,
    agentVersionId: row.agent_version_id,
    promptHash: row.prompt_hash,
    state: row.state,
    version: row.version,
    jobId: row.job_id,
    contextHash: row.context_hash,
    errorCode: row.error_code,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    replayed,
  };
}

async function findByKey(
  sql: DatabaseClient,
  buyerUserId: string,
  idempotencyKey: string,
): Promise<HireRequestRow | null> {
  const rows = await sql<HireRequestRow[]>`
    SELECT id::text, agent_version_id::text, prompt_hash, state, version, job_id::text,
      context_hash, error_code, created_at, updated_at
    FROM hire_requests
    WHERE buyer_user_id = ${buyerUserId} AND idempotency_key = ${idempotencyKey}
  `;
  return rows[0] ?? null;
}

export async function createHireRequest(
  buyerUserId: string,
  input: { agentVersionId: string; idempotencyKey: string; prompt: string },
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<HireRequestSnapshot> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const promptHash = domainHash("hire-request-prompt", input.prompt);
  const lockKey = domainHash("hire-request-lock", {
    buyerUserId,
    idempotencyKey: input.idempotencyKey,
  });
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const existing = await findByKey(tx, buyerUserId, input.idempotencyKey);
    if (existing) {
      if (existing.agent_version_id !== input.agentVersionId || existing.prompt_hash !== promptHash) {
        throw new KernelError(
          "KERNEL_IDEMPOTENCY_MISMATCH",
          "Idempotency key was already used for different input",
          409,
        );
      }
      return snapshot(existing, true);
    }
    const versions = await tx<{ manifest_hash: string; owner_user_id: string; has_mcp: boolean }[]>`
      SELECT version.manifest_hash, agent.owner_user_id,
        COALESCE(jsonb_array_length(version.manifest->'mcp'), 0) > 0 AS has_mcp
      FROM agent_versions version
      JOIN kernel_agents agent ON agent.id = version.agent_id
      WHERE version.id = ${input.agentVersionId}::uuid
        AND version.published = true
        AND version.lifecycle_state = 'PUBLISHED'
        AND version.canonical_state = 'CANONICAL'
      FOR SHARE OF version
    `;
    const version = versions[0];
    if (!version) throw new KernelError("KERNEL_NOT_FOUND", "Published agent version not found", 404);
    if (version.owner_user_id === buyerUserId) {
      throw new KernelError("KERNEL_FORBIDDEN", "Creators cannot hire their own agent version", 403);
    }
    const rows = await tx<HireRequestRow[]>`
      INSERT INTO hire_requests (
        buyer_user_id, agent_version_id, idempotency_key, prompt, prompt_hash,
        manifest_hash, state, version, claim_version, created_at, updated_at
      ) VALUES (
        ${buyerUserId}, ${input.agentVersionId}::uuid, ${input.idempotencyKey},
        ${input.prompt}, ${promptHash}, ${version.manifest_hash},
        ${version.has_mcp ? "PENDING_CONTEXT" : "JOB_QUEUED"}, 0, 0, ${now}, ${now}
      )
      RETURNING id::text, agent_version_id::text, prompt_hash, state, version,
        job_id::text, context_hash, error_code, created_at, updated_at
    `;
    const created = rows[0];
    if (!created) throw new Error("KERNEL_HIRE_REQUEST_CREATE_FAILED");
    return snapshot(created, false);
  });
}

export async function listHireRequests(
  buyerUserId: string,
  options: { hireRequestId?: string; limit?: number; sql?: DatabaseClient } = {},
): Promise<HireRequestSnapshot[]> {
  const sql = options.sql ?? getDb();
  const limit = options.limit ?? 50;
  const rows = await sql<HireRequestRow[]>`
    SELECT id::text, agent_version_id::text, prompt_hash, state, version, job_id::text,
      context_hash, error_code, created_at, updated_at
    FROM hire_requests
    WHERE buyer_user_id = ${buyerUserId}
      AND (${options.hireRequestId ?? null}::uuid IS NULL OR id = ${options.hireRequestId ?? null}::uuid)
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => snapshot(row, false));
}

export async function claimHireRequestContext(input: {
  hireRequestId: string;
  workerId: string;
  workerEpoch: bigint;
  leaseExpiresAt: Date;
  now?: Date;
  sql?: DatabaseClient;
}): Promise<HireRequestSnapshot | null> {
  const sql = input.sql ?? getDb();
  const now = input.now ?? new Date();
  const rows = await sql<HireRequestRow[]>`
    UPDATE hire_requests
    SET state = 'CONTEXT_RUNNING', version = version + 1,
      claim_owner = ${input.workerId}, claim_epoch = ${input.workerEpoch.toString()}::bigint,
      claim_version = claim_version + 1, claim_expires_at = ${input.leaseExpiresAt},
      updated_at = ${now}
    WHERE id = ${input.hireRequestId}::uuid AND state = 'PENDING_CONTEXT'
      AND ${input.leaseExpiresAt} > clock_timestamp()
    RETURNING id::text, agent_version_id::text, prompt_hash, state, version,
      job_id::text, context_hash, error_code, created_at, updated_at
  `;
  return rows[0] ? snapshot(rows[0], false) : null;
}

export async function completeHireRequestContext(input: {
  hireRequestId: string;
  workerId: string;
  workerEpoch: bigint;
  claimVersion: number;
  contextHash: string;
  now?: Date;
  sql?: DatabaseClient;
}): Promise<HireRequestSnapshot | null> {
  const sql = input.sql ?? getDb();
  const now = input.now ?? new Date();
  const rows = await sql<HireRequestRow[]>`
    UPDATE hire_requests
    SET state = 'JOB_QUEUED', version = version + 1, context_hash = ${input.contextHash},
      updated_at = ${now}
    WHERE id = ${input.hireRequestId}::uuid AND state = 'CONTEXT_RUNNING'
      AND claim_owner = ${input.workerId} AND claim_epoch = ${input.workerEpoch.toString()}::bigint
      AND claim_version = ${input.claimVersion} AND claim_expires_at > clock_timestamp()
    RETURNING id::text, agent_version_id::text, prompt_hash, state, version,
      job_id::text, context_hash, error_code, created_at, updated_at
  `;
  return rows[0] ? snapshot(rows[0], false) : null;
}
