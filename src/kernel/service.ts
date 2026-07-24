import { getDb } from "../config/database";
import { canonicalJson, domainHash } from "./canonical";
import { KernelError } from "./errors";
import {
  KERNEL_BPS_DENOMINATOR,
  KERNEL_COMMISSION_BPS,
  KERNEL_QUOTE_TTL_MS,
} from "./policy";
import type {
  AgentManifest,
  JobSnapshot,
  JobState,
  KernelJobInput,
  PublishedAgent,
  SubmittedJob,
} from "./types";

export type DatabaseClient = ReturnType<typeof getDb>;

interface AgentVersionRow {
  agent_id: string;
  version_id: string;
  version: number;
  name: string;
  owner_user_id: string;
  owner_wallet: string;
  capabilities: string[];
  manifest_hash: string;
  prompt_hash: string;
  config_hash: string;
  adapter_key: "protected-a3";
  price_atomic: string;
  asset: "USDC_ATOMIC";
  published_at: Date;
}

interface SubmissionRow {
  quote_id: string;
  intent_id: string;
  order_id: string;
  job_id: string;
  effect_id: string;
  state: JobState;
  version: number;
  amount_atomic: string;
  asset: string;
  input_hash: string;
  agent_version_id: string;
}

interface JobRow {
  job_id: string;
  effect_id: string;
  buyer_user_id: string;
  agent_version_id: string;
  state: JobState;
  version: number;
  attempts: number;
  max_attempts: number;
  cancel_requested_at: Date | null;
  last_error_code: string | null;
  financial_outcome: "SETTLED" | "REFUNDED" | null;
  created_at: Date;
  updated_at: Date;
}

function mapPublishedAgent(row: AgentVersionRow): PublishedAgent {
  return {
    agentId: row.agent_id,
    versionId: row.version_id,
    version: row.version,
    name: row.name,
    capabilities: row.capabilities,
    manifestHash: row.manifest_hash,
    promptHash: row.prompt_hash,
    configHash: row.config_hash,
    adapterKey: row.adapter_key,
    priceAtomic: row.price_atomic,
    asset: row.asset,
    publishedAt: new Date(row.published_at).toISOString(),
  };
}

function mapSubmission(row: SubmissionRow, replayed: boolean): SubmittedJob {
  return {
    quoteId: row.quote_id,
    intentId: row.intent_id,
    orderId: row.order_id,
    jobId: row.job_id,
    effectId: row.effect_id,
    state: row.state,
    version: row.version,
    amountAtomic: row.amount_atomic,
    asset: row.asset,
    replayed,
  };
}

function mapJob(row: JobRow): JobSnapshot {
  return {
    jobId: row.job_id,
    effectId: row.effect_id,
    buyerUserId: row.buyer_user_id,
    agentVersionId: row.agent_version_id,
    state: row.state,
    version: row.version,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    cancelRequestedAt: row.cancel_requested_at?.toISOString() ?? null,
    lastErrorCode: row.last_error_code,
    financialOutcome: row.financial_outcome,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function publishAgent(
  owner: { userId: string; walletAddress: string },
  manifest: AgentManifest,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<PublishedAgent> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const manifestHash = domainHash("agent-manifest", manifest);
  const promptHash = domainHash("agent-prompt", manifest.instructions);
  const configHash = domainHash("agent-config", {
    adapterKey: manifest.adapterKey,
    capabilities: manifest.capabilities,
    connectorKey: manifest.connectorKey,
    endpoint: manifest.endpoint,
    priceAtomic: manifest.priceAtomic,
    proofPolicy: manifest.proofPolicy,
  });
  try {
    return await sql.begin(async (transaction) => {
      const tx = transaction as unknown as DatabaseClient;
      const agents = await tx<{ id: string }[]>`
        INSERT INTO kernel_agents (owner_user_id, name, created_at)
        VALUES (${owner.userId}, ${manifest.name}, ${now})
        RETURNING id
      `;
      const agent = agents[0];
      if (!agent) throw new Error("KERNEL_AGENT_CREATE_FAILED");
      const versions = await tx<AgentVersionRow[]>`
        INSERT INTO agent_versions (
          agent_id, version, manifest, manifest_hash, prompt_hash, config_hash,
          capabilities, adapter_key, endpoint, connector_key, owner_wallet,
          payout_address, price_atomic, asset, proof_policy, published,
          published_at, created_at
        ) VALUES (
          ${agent.id}::uuid, 1, ${tx.json(manifest)}, ${manifestHash}, ${promptHash},
          ${configHash}, ${manifest.capabilities}, ${manifest.adapterKey}, NULL, NULL,
          ${owner.walletAddress}, NULL, ${manifest.priceAtomic}::bigint, ${manifest.asset},
          ${manifest.proofPolicy}, true, ${now}, ${now}
        )
        RETURNING
          agent_id, id AS version_id, version, ${manifest.name}::text AS name,
          ${owner.userId}::text AS owner_user_id, owner_wallet, capabilities,
          manifest_hash, prompt_hash, config_hash, adapter_key, price_atomic::text,
          asset, published_at
      `;
      const version = versions[0];
      if (!version) throw new Error("KERNEL_AGENT_VERSION_CREATE_FAILED");
      return mapPublishedAgent(version);
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new KernelError("KERNEL_CONFLICT", "An agent with this name already exists", 409);
    }
    throw error;
  }
}

export async function listPublishedAgents(
  options: { sql?: DatabaseClient } = {},
): Promise<PublishedAgent[]> {
  const sql = options.sql ?? getDb();
  const rows = await sql<AgentVersionRow[]>`
    SELECT
      a.id AS agent_id, v.id AS version_id, v.version, a.name, a.owner_user_id,
      v.owner_wallet, v.capabilities, v.manifest_hash, v.prompt_hash,
      v.config_hash, v.adapter_key, v.price_atomic::text, v.asset, v.published_at
    FROM agent_versions v
    JOIN kernel_agents a ON a.id = v.agent_id
    WHERE v.published = true
    ORDER BY v.created_at ASC, v.id ASC
  `;
  return rows.map(mapPublishedAgent);
}

async function loadSubmission(
  sql: DatabaseClient,
  buyerUserId: string,
  idempotencyKey: string,
): Promise<SubmissionRow | null> {
  const rows = await sql<SubmissionRow[]>`
    SELECT
      q.id AS quote_id, i.id AS intent_id, o.id AS order_id, j.id AS job_id,
      e.id AS effect_id, j.state, j.version, q.amount_atomic::text, q.asset,
      i.input_hash, i.agent_version_id
    FROM job_intents i
    JOIN quotes q ON q.buyer_user_id = i.buyer_user_id
      AND q.idempotency_key = i.idempotency_key
    JOIN kernel_orders o ON o.intent_id = i.id AND o.quote_id = q.id
    JOIN jobs j ON j.intent_id = i.id AND j.order_id = o.id
    JOIN effects e ON e.intent_id = i.id AND e.job_id = j.id
    WHERE i.buyer_user_id = ${buyerUserId} AND i.idempotency_key = ${idempotencyKey}
  `;
  return rows[0] ?? null;
}

export async function submitJob(
  buyerUserId: string,
  input: { agentVersionId: string; idempotencyKey: string; task: KernelJobInput },
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<SubmittedJob> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const canonicalTask = { prompt: input.task.prompt };
  const inputHash = domainHash("job-input", canonicalTask);
  const lockKey = domainHash("submission-lock", {
    buyerUserId,
    idempotencyKey: input.idempotencyKey,
  });
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

    const existing = await loadSubmission(tx, buyerUserId, input.idempotencyKey);
    if (existing) {
      if (
        existing.input_hash !== inputHash ||
        existing.agent_version_id !== input.agentVersionId
      ) {
        throw new KernelError(
          "KERNEL_IDEMPOTENCY_MISMATCH",
          "Idempotency key was already used for different input",
          409,
        );
      }
      return mapSubmission(existing, true);
    }

    const versions = await tx<{
      id: string;
      adapter_key: "protected-a3";
      price_atomic: string;
      asset: string;
    }[]>`
      SELECT id, adapter_key, price_atomic::text, asset
      FROM agent_versions
      WHERE id = ${input.agentVersionId}::uuid AND published = true
      FOR SHARE
    `;
    const agentVersion = versions[0];
    if (!agentVersion) {
      throw new KernelError("KERNEL_NOT_FOUND", "Published agent version not found", 404);
    }

    const quoteExpiry = new Date(now.getTime() + KERNEL_QUOTE_TTL_MS);
    const quotes = await tx<{ id: string }[]>`
      INSERT INTO quotes (
        buyer_user_id, agent_version_id, idempotency_key, input_hash,
        amount_atomic, asset, expires_at, created_at
      ) VALUES (
        ${buyerUserId}, ${input.agentVersionId}::uuid, ${input.idempotencyKey},
        ${inputHash}, ${agentVersion.price_atomic}::bigint, ${agentVersion.asset},
        ${quoteExpiry}, ${now}
      ) RETURNING id
    `;
    const intents = await tx<{ id: string }[]>`
      INSERT INTO job_intents (
        buyer_user_id, agent_version_id, idempotency_key, input, input_hash, created_at
      ) VALUES (
        ${buyerUserId}, ${input.agentVersionId}::uuid, ${input.idempotencyKey},
        ${tx.json(canonicalTask)}, ${inputHash}, ${now}
      ) RETURNING id
    `;
    const quote = quotes[0];
    const intent = intents[0];
    if (!quote || !intent) throw new Error("KERNEL_SUBMISSION_CREATE_FAILED");
    const orders = await tx<{ id: string }[]>`
      INSERT INTO kernel_orders (
        buyer_user_id, agent_version_id, intent_id, quote_id, amount_atomic, asset, created_at
      ) VALUES (
        ${buyerUserId}, ${input.agentVersionId}::uuid, ${intent.id}::uuid,
        ${quote.id}::uuid, ${agentVersion.price_atomic}::bigint, ${agentVersion.asset}, ${now}
      ) RETURNING id
    `;
    const order = orders[0];
    if (!order) throw new Error("KERNEL_ORDER_CREATE_FAILED");
    const jobs = await tx<{ id: string }[]>`
      INSERT INTO jobs (
        order_id, intent_id, buyer_user_id, agent_version_id, state, version,
        attempts, max_attempts, available_at, created_at, updated_at
      ) VALUES (
        ${order.id}::uuid, ${intent.id}::uuid, ${buyerUserId},
        ${input.agentVersionId}::uuid, 'QUEUED', 0, 0, 3, ${now}, ${now}, ${now}
      ) RETURNING id
    `;
    const job = jobs[0];
    if (!job) throw new Error("KERNEL_JOB_CREATE_FAILED");
    const effectId = domainHash("effect", {
      intentId: intent.id,
      jobId: job.id,
      inputHash,
    });
    const effectIdempotency = domainHash("effect-idempotency", {
      buyerUserId,
      idempotencyKey: input.idempotencyKey,
    });
    await tx`
      INSERT INTO effects (
        id, job_id, intent_id, idempotency_key, adapter_key, request_hash,
        state, attempt, created_at, updated_at
      ) VALUES (
        ${effectId}, ${job.id}::uuid, ${intent.id}::uuid, ${effectIdempotency},
        ${agentVersion.adapter_key}, ${inputHash}, 'PENDING', 0, ${now}, ${now}
      )
    `;
    await tx`
      INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
      VALUES (${job.id}::uuid, 0, 'JOB_CREATED', NULL, 'QUEUED', ${tx.json({})}, ${now})
    `;
    const created = await loadSubmission(tx, buyerUserId, input.idempotencyKey);
    if (!created) throw new Error("KERNEL_SUBMISSION_READBACK_FAILED");
    return mapSubmission(created, false);
  });
}

export async function getBuyerJob(
  buyerUserId: string,
  jobId: string,
  options: { sql?: DatabaseClient } = {},
): Promise<JobSnapshot | null> {
  const sql = options.sql ?? getDb();
  const rows = await sql<JobRow[]>`
    SELECT
      j.id AS job_id, e.id AS effect_id, j.buyer_user_id, j.agent_version_id,
      j.state, j.version, j.attempts, j.max_attempts, j.cancel_requested_at,
      j.last_error_code, j.financial_outcome, j.created_at, j.updated_at
    FROM jobs j
    JOIN effects e ON e.job_id = j.id
    WHERE j.id = ${jobId}::uuid AND j.buyer_user_id = ${buyerUserId}
  `;
  return rows[0] ? mapJob(rows[0]) : null;
}

export async function listBuyerJobs(
  buyerUserId: string,
  options: { sql?: DatabaseClient } = {},
): Promise<JobSnapshot[]> {
  const sql = options.sql ?? getDb();
  const rows = await sql<JobRow[]>`
    SELECT
      j.id AS job_id, e.id AS effect_id, j.buyer_user_id, j.agent_version_id,
      j.state, j.version, j.attempts, j.max_attempts, j.cancel_requested_at,
      j.last_error_code, j.financial_outcome, j.created_at, j.updated_at
    FROM jobs j
    JOIN effects e ON e.job_id = j.id
    WHERE j.buyer_user_id = ${buyerUserId}
    ORDER BY j.created_at DESC, j.id DESC
    LIMIT 100
  `;
  return rows.map(mapJob);
}

export async function cancelBuyerJob(
  buyerUserId: string,
  jobId: string,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<JobSnapshot> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    const rows = await tx<JobRow[]>`
      SELECT
        j.id AS job_id, e.id AS effect_id, j.buyer_user_id, j.agent_version_id,
        j.state, j.version, j.attempts, j.max_attempts, j.cancel_requested_at,
        j.last_error_code, j.financial_outcome, j.created_at, j.updated_at
      FROM jobs j
      JOIN effects e ON e.job_id = j.id
      WHERE j.id = ${jobId}::uuid AND j.buyer_user_id = ${buyerUserId}
      FOR UPDATE OF j
    `;
    const job = rows[0];
    if (!job) throw new KernelError("KERNEL_NOT_FOUND", "Job not found", 404);
    if (job.state === "QUEUED") {
      const nextVersion = job.version + 1;
      await tx`
        UPDATE jobs
        SET state = 'CANCELED', version = ${nextVersion}, cancel_requested_at = ${now},
            lease_owner = NULL, lease_expires_at = NULL, updated_at = ${now}
        WHERE id = ${jobId}::uuid AND state = 'QUEUED' AND version = ${job.version}
      `;
      await tx`
        UPDATE effects
        SET state = 'CANCELED', terminal_at = ${now}, error_code = 'JOB_CANCELED', updated_at = ${now}
        WHERE job_id = ${jobId}::uuid AND state = 'PENDING'
      `;
      await tx`
        INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
        VALUES (${jobId}::uuid, ${nextVersion}, 'JOB_CANCELED', 'QUEUED', 'CANCELED', ${tx.json({})}, ${now})
      `;
      const orders = await tx<{ amount_atomic: string; asset: string }[]>`
        SELECT o.amount_atomic::text, o.asset
        FROM kernel_orders o JOIN jobs j ON j.order_id = o.id
        WHERE j.id = ${jobId}::uuid
      `;
      const order = orders[0];
      if (!order) throw new Error("KERNEL_ORDER_NOT_FOUND");
      await tx`
        INSERT INTO refunds (job_id, amount_atomic, asset, reason_code, created_at)
        VALUES (${jobId}::uuid, ${order.amount_atomic}::bigint, ${order.asset}, 'JOB_CANCELED', ${now})
      `;
    } else if (job.state === "RUNNING" && !job.cancel_requested_at) {
      const requests = await tx<{ version: number }[]>`
        UPDATE jobs
        SET cancel_requested_at = ${now}, version = version + 1, updated_at = ${now}
        WHERE id = ${jobId}::uuid AND state = 'RUNNING'
        RETURNING version
      `;
      const request = requests[0];
      if (request) {
        await tx`
          INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
          VALUES (
            ${jobId}::uuid, ${request.version}, 'JOB_CANCEL_REQUESTED',
            'RUNNING', 'RUNNING', ${tx.json({})}, ${now}
          )
        `;
      }
    }
    const refreshed = await getBuyerJob(buyerUserId, jobId, { sql: tx });
    if (!refreshed) throw new Error("KERNEL_JOB_READBACK_FAILED");
    return refreshed;
  });
}

export function commissionAmount(amountAtomic: bigint): bigint {
  if (amountAtomic < 0n) throw new Error("KERNEL_NEGATIVE_AMOUNT");
  return (amountAtomic * KERNEL_COMMISSION_BPS) / KERNEL_BPS_DENOMINATOR;
}

export function serializeManifest(manifest: AgentManifest): string {
  return canonicalJson(manifest);
}
