import { getDb } from "../config/database";
import { deriveManifestHashes } from "./agent-catalog";
import { canonicalJson, domainHash, type CanonicalValue } from "./canonical";
import { KernelError } from "./errors";
import {
  KERNEL_BPS_DENOMINATOR,
  KERNEL_COMMISSION_BPS,
  KERNEL_QUOTE_TTL_MS,
} from "./policy";
import type {
  AgentManifest,
  EvidenceState,
  KernelJobDetail,
  KernelJobEvidenceSummary,
  KernelJobListItem,
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
  description: string;
  owner_user_id: string;
  owner_wallet: string;
  capabilities: string[];
  manifest_hash: string;
  prompt_hash: string;
  config_hash: string;
  adapter_key: "protected-a3";
  price_atomic: string;
  asset: "USDC_ATOMIC";
  proof_policy: "verified-receipt-required";
  published_at: Date;
  lifecycle_state?: string | null;
  hireable?: boolean | null;
  creator_parent?: string | null;
  agent_label?: string | null;
  full_subname?: string | null;
  canonical_state?: "UNVERIFIED" | "CANONICAL" | "REFUSED" | null;
  authority_owner?: string | null;
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

interface JobListRow extends JobRow {
  agent_id: string;
  agent_name: string;
  agent_description: string;
  agent_version: number;
  owner_wallet: string;
  capabilities: string[];
  price_atomic: string;
  asset: "USDC_ATOMIC";
  proof_policy: "verified-receipt-required";
  creator_parent: string | null;
  full_subname: string | null;
  canonical_state: "UNVERIFIED" | "CANONICAL" | "REFUSED" | null;
  authority_owner: string | null;
  authority_delegate: string | null;
  authority_policy_version: string | null;
  authority_refusal: string | null;
  authority_release_sha: string | null;
  latest_ens_decision: "ALLOW" | "DENY" | null;
  a3_stage: string | null;
  response_hash: string | null;
  compute_receipt_digest: string | null;
  expected_root: string | null;
  expected_digest: string | null;
  expected_size: number | null;
  readback_root: string | null;
  readback_digest: string | null;
  readback_size: number | null;
  receipt_verified: boolean | null;
  receipt_result_hash: string | null;
  effect_state: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  effect_result_hash: string | null;
  effect_terminal_at: Date | null;
}

interface JobEventRow {
  version: number;
  event_type: string;
  from_state: JobState | null;
  to_state: JobState;
  created_at: Date;
}

interface EnsDecisionRow {
  check_id: string;
  phase: string;
  operation: string;
  decision: "ALLOW" | "DENY";
  error_code: string | null;
  record_hash: string | null;
  chain_id: number | null;
  block_number: string | null;
  block_timestamp: Date | null;
  observed_at: Date;
  fresh_until: Date | null;
  transaction_hash: string | null;
}

interface A3EvidenceRow {
  stage: string;
  request_hash: string;
  request_id: string | null;
  response_hash: string | null;
  compute_receipt_digest: string | null;
  storage_receipt_digest: string | null;
  expected_root: string | null;
  expected_digest: string | null;
  expected_size: number | null;
  readback_root: string | null;
  readback_digest: string | null;
  readback_size: number | null;
  proof_hash: string | null;
  error_code: string | null;
  updated_at: Date;
}

interface EffectEvidenceRow {
  state: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  result_hash: string | null;
  result: unknown;
  terminal_at: Date | null;
}

interface ReceiptFinancialRow {
  receipt_id: string | null;
  receipt_verified: boolean | null;
  adapter_key: string | null;
  proof_hash: string | null;
  result_hash: string | null;
  receipt_created_at: Date | null;
  settlement_amount_atomic: string | null;
  settlement_asset: string | null;
  settlement_created_at: Date | null;
  refund_amount_atomic: string | null;
  refund_asset: string | null;
  refund_reason_code: string | null;
  refund_created_at: Date | null;
}

function mapPublishedAgent(row: AgentVersionRow, viewerUserId: string): PublishedAgent {
  return {
    agentId: row.agent_id,
    versionId: row.version_id,
    version: row.version,
    name: row.name,
    description: row.description,
    capabilities: row.capabilities,
    manifestHash: row.manifest_hash,
    promptHash: row.prompt_hash,
    configHash: row.config_hash,
    adapterKey: row.adapter_key,
    ownerWallet: row.owner_wallet,
    priceAtomic: row.price_atomic,
    asset: row.asset,
    proofPolicy: row.proof_policy,
    lifecycleState: (row.lifecycle_state as PublishedAgent["lifecycleState"]) ?? "PUBLISHED",
    hireable: row.hireable ?? true,
    ownedByViewer: row.owner_user_id === viewerUserId,
    creatorParent: row.creator_parent ?? null,
    agentLabel: row.agent_label ?? null,
    fullSubname: row.full_subname ?? null,
    canonicalState: row.canonical_state ?? "UNVERIFIED",
    authorityOwner: row.authority_owner ?? null,
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

function missingEvidenceState(state: JobState): EvidenceState {
  if (state === "QUEUED" || state === "RUNNING") return "pending";
  return "unavailable";
}

function mapEvidenceSummary(row: JobListRow): KernelJobEvidenceSummary {
  const missing = missingEvidenceState(row.state);
  const a3Failed = row.state === "FAILED" && row.a3_stage === "FAILED";
  const computeVerified = row.response_hash !== null && row.compute_receipt_digest !== null;
  const storageVerified =
    row.a3_stage === "READBACK_VERIFIED" &&
    row.expected_root !== null &&
    row.expected_digest !== null &&
    row.expected_size !== null &&
    row.readback_root === row.expected_root &&
    row.readback_digest === row.expected_digest &&
    row.readback_size === row.expected_size;
  const receiptBound =
    row.receipt_verified === true &&
    row.receipt_result_hash !== null &&
    row.effect_state === "SUCCEEDED" &&
    row.effect_result_hash === row.receipt_result_hash &&
    row.effect_terminal_at !== null;
  return {
    owner: "verified",
    version: "verified",
    ens: row.latest_ens_decision === "ALLOW"
      ? "verified"
      : row.latest_ens_decision === "DENY"
        ? "failed"
        : missing,
    compute: computeVerified ? "verified" : a3Failed ? "failed" : missing,
    storage: storageVerified
      ? "verified"
      : a3Failed && computeVerified
        ? "failed"
        : missing,
    receipt: receiptBound
      ? "verified"
      : row.receipt_verified === false
        || (row.receipt_verified === true && !receiptBound)
        ? "failed"
        : missing,
  };
}

function mapJobListItem(row: JobListRow): KernelJobListItem {
  return {
    ...mapJob(row),
    agent: {
      agentId: row.agent_id,
      versionId: row.agent_version_id,
      version: row.agent_version,
      name: row.agent_name,
      description: row.agent_description,
      ownerWallet: row.owner_wallet,
      capabilities: row.capabilities,
      priceAtomic: row.price_atomic,
      asset: row.asset,
      proofPolicy: row.proof_policy,
      creatorParent: row.creator_parent,
      fullSubname: row.full_subname,
      canonicalState: row.canonical_state,
      authorityOwner: row.authority_owner,
      authorityDelegate: row.authority_delegate,
      authorityPolicyVersion: row.authority_policy_version,
      refusalReason: row.authority_refusal,
      authorityReleaseSha: row.authority_release_sha,
    },
    evidence: mapEvidenceSummary(row),
  };
}

function toCanonicalValue(value: unknown): CanonicalValue | null {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    const entries: CanonicalValue[] = [];
    for (const entry of value) {
      const canonical = toCanonicalValue(entry);
      if (canonical === null && entry !== null) return null;
      entries.push(canonical);
    }
    return entries;
  }
  if (typeof value !== "object") return null;
  const result: Record<string, CanonicalValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    const canonical = toCanonicalValue(entry);
    if (canonical === null && entry !== null) return null;
    result[key] = canonical;
  }
  return result;
}

async function loadBuyerJobRows(
  sql: DatabaseClient,
  buyerUserId: string,
  options: { jobId: string | null; limit: number },
): Promise<JobListRow[]> {
  return sql<JobListRow[]>`
    SELECT
      j.id AS job_id, e.id AS effect_id, j.buyer_user_id, j.agent_version_id,
      j.state, j.version, j.attempts, j.max_attempts, j.cancel_requested_at,
      j.last_error_code, j.financial_outcome, j.created_at, j.updated_at,
      a.id AS agent_id, a.name AS agent_name,
      COALESCE(v.manifest->>'description', '') AS agent_description,
      v.version AS agent_version, v.owner_wallet, v.capabilities,
      v.price_atomic::text, v.asset, v.proof_policy,
      v.creator_parent, v.full_subname, v.canonical_state,
      v.authority_owner, v.authority_delegate, v.authority_policy_version,
      v.authority_refusal, v.authority_release_sha,
      latest_ens.decision AS latest_ens_decision,
      journal.stage AS a3_stage, journal.response_hash, journal.compute_receipt_digest,
      journal.expected_root, journal.expected_digest, journal.expected_size,
      journal.readback_root, journal.readback_digest, journal.readback_size,
      receipt.verified AS receipt_verified,
      receipt.result_hash AS receipt_result_hash,
      e.state AS effect_state, e.result_hash AS effect_result_hash,
      e.terminal_at AS effect_terminal_at
    FROM jobs j
    JOIN effects e ON e.job_id = j.id
    JOIN agent_versions v ON v.id = j.agent_version_id
    JOIN kernel_agents a ON a.id = v.agent_id
    LEFT JOIN a3_execution_journals journal ON journal.job_id = j.id
    LEFT JOIN receipts receipt ON receipt.job_id = j.id
    LEFT JOIN LATERAL (
      SELECT authority.decision
      FROM ens_authority_checks authority
      WHERE authority.job_id = j.id
      ORDER BY authority.id DESC
      LIMIT 1
    ) latest_ens ON true
    WHERE j.buyer_user_id = ${buyerUserId}
      AND (${options.jobId}::uuid IS NULL OR j.id = ${options.jobId}::uuid)
    ORDER BY j.created_at DESC, j.id DESC
    LIMIT ${options.limit}
  `;
}

export async function publishAgent(
  owner: { userId: string; walletAddress: string },
  manifest: AgentManifest,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<PublishedAgent> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const hashes = deriveManifestHashes(manifest);
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
          ${agent.id}::uuid, 1, ${tx.json(manifest)}, ${hashes.manifestHash}, ${hashes.promptHash},
          ${hashes.configHash}, ${manifest.capabilities}, ${manifest.adapterKey}, NULL, NULL,
          ${owner.walletAddress}, ${manifest.payoutAddress}, ${manifest.priceAtomic}::bigint, ${manifest.asset},
          ${manifest.proofPolicy}, true, ${now}, ${now}
        )
        RETURNING
          agent_id, id AS version_id, version, ${manifest.name}::text AS name,
          ${manifest.description}::text AS description,
          ${owner.userId}::text AS owner_user_id, owner_wallet, capabilities,
          manifest_hash, prompt_hash, config_hash, adapter_key, price_atomic::text,
          asset, proof_policy, published_at
      `;
      const version = versions[0];
      if (!version) throw new Error("KERNEL_AGENT_VERSION_CREATE_FAILED");
      return mapPublishedAgent(version, owner.userId);
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new KernelError("KERNEL_CONFLICT", "An agent with this name already exists", 409);
    }
    throw error;
  }
}

export async function listPublishedAgents(
  options: { viewerUserId: string; sql?: DatabaseClient },
): Promise<PublishedAgent[]> {
  const sql = options.sql ?? getDb();
  const rows = await sql<AgentVersionRow[]>`
    SELECT
      a.id AS agent_id, v.id AS version_id, v.version, a.name,
      COALESCE(v.manifest->>'description', '') AS description, a.owner_user_id,
      v.owner_wallet, v.capabilities, v.manifest_hash, v.prompt_hash,
      v.config_hash, v.adapter_key, v.price_atomic::text, v.asset, v.published_at
      , v.proof_policy
    FROM agent_versions v
    JOIN kernel_agents a ON a.id = v.agent_id
    WHERE v.published = true
    ORDER BY v.created_at ASC, v.id ASC
  `;
  return rows.map((row) => mapPublishedAgent(row, options.viewerUserId));
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
  const allowLegacyFixture = options.sql !== undefined && process.env.NODE_ENV === "test";
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
      owner_user_id: string;
    }[]>`
      SELECT v.id, v.adapter_key, v.price_atomic::text, v.asset, a.owner_user_id
      FROM agent_versions v
      JOIN kernel_agents a ON a.id = v.agent_id
      WHERE v.id = ${input.agentVersionId}::uuid
        AND v.published = true
        AND (
          (
            v.lifecycle_state = 'PUBLISHED' AND v.canonical_state = 'CANONICAL'
            AND v.write_plan_hash IS NOT NULL AND v.authority_record_hash IS NOT NULL
            AND v.publication_decision_id IS NOT NULL AND v.publication_action_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM ens_publication_decisions decision
              JOIN agent_lifecycle_actions publication_action
                ON publication_action.id = v.publication_action_id
               AND publication_action.action = 'PUBLISH_VERSION'
               AND publication_action.status = 'SUCCEEDED'
               AND publication_action.owner_user_id = a.owner_user_id
               AND publication_action.target_agent_version_id = v.id
               AND publication_action.agent_version_id = v.id
               AND publication_action.result_hash IS NOT NULL
               AND publication_action.result_snapshot->>'action' = 'PUBLISH_VERSION'
               AND publication_action.result_snapshot->>'outcome' = 'SUCCESS'
              JOIN agent_version_events publication_event
                ON publication_event.agent_version_id = v.id
               AND publication_event.action = 'PUBLISH_VERSION'
               AND publication_event.lifecycle_action_id = publication_action.id
               AND publication_event.payload->>'lifecycleActionId' = publication_action.id::text
               AND publication_event.payload->>'resultHash' = publication_action.result_hash
               AND publication_event.payload->>'publicationDecisionId' = decision.id::text
              WHERE decision.id = v.publication_decision_id
                AND decision.agent_version_id = v.id
                AND decision.decision = 'ALLOW' AND decision.error_code IS NULL
            )
          )
          OR (${allowLegacyFixture} AND v.lifecycle_state IS NULL)
        )
      FOR SHARE OF v
    `;
    const agentVersion = versions[0];
    if (!agentVersion) {
      throw new KernelError("KERNEL_NOT_FOUND", "Published agent version not found", 404);
    }
    if (agentVersion.owner_user_id === buyerUserId) {
      throw new KernelError("KERNEL_FORBIDDEN", "Creators cannot hire their own agent version", 403);
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
): Promise<KernelJobListItem[]> {
  const sql = options.sql ?? getDb();
  const rows = await loadBuyerJobRows(sql, buyerUserId, { jobId: null, limit: 100 });
  return rows.map(mapJobListItem);
}

export async function getBuyerJobDetail(
  buyerUserId: string,
  jobId: string,
  options: { sql?: DatabaseClient } = {},
): Promise<KernelJobDetail | null> {
  const sql = options.sql ?? getDb();
  const baseRows = await loadBuyerJobRows(sql, buyerUserId, { jobId, limit: 1 });
  const baseRow = baseRows[0];
  if (!baseRow) return null;

  const [events, ensChecks, journals, effects, financialRows] = await Promise.all([
    sql<JobEventRow[]>`
      SELECT version, event_type, from_state, to_state, created_at
      FROM job_events
      WHERE job_id = ${jobId}::uuid
      ORDER BY version ASC
      LIMIT 100
    `,
    sql<EnsDecisionRow[]>`
      SELECT
        id::text AS check_id, phase, operation, decision, error_code, record_hash,
        chain_id, block_number::text, block_timestamp, observed_at, fresh_until,
        transaction_hash
      FROM ens_authority_checks
      WHERE job_id = ${jobId}::uuid
      ORDER BY id DESC
      LIMIT 1
    `,
    sql<A3EvidenceRow[]>`
      SELECT
        stage, request_hash, request_id, response_hash, compute_receipt_digest,
        storage_receipt_digest, expected_root, expected_digest, expected_size,
        readback_root, readback_digest, readback_size, proof_hash, error_code,
        updated_at
      FROM a3_execution_journals
      WHERE job_id = ${jobId}::uuid
      LIMIT 1
    `,
    sql<EffectEvidenceRow[]>`
      SELECT state, result_hash, result, terminal_at
      FROM effects
      WHERE job_id = ${jobId}::uuid
      LIMIT 1
    `,
    sql<ReceiptFinancialRow[]>`
      SELECT
        receipt.id AS receipt_id, receipt.verified AS receipt_verified,
        receipt.adapter_key, receipt.proof_hash, receipt.result_hash,
        receipt.created_at AS receipt_created_at,
        settlement.amount_atomic::text AS settlement_amount_atomic,
        settlement.asset AS settlement_asset,
        settlement.created_at AS settlement_created_at,
        refund.amount_atomic::text AS refund_amount_atomic,
        refund.asset AS refund_asset, refund.reason_code AS refund_reason_code,
        refund.created_at AS refund_created_at
      FROM jobs job
      LEFT JOIN receipts receipt ON receipt.job_id = job.id
      LEFT JOIN settlements settlement ON settlement.job_id = job.id
      LEFT JOIN refunds refund ON refund.job_id = job.id
      WHERE job.id = ${jobId}::uuid
      LIMIT 1
    `,
  ]);

  const base = mapJobListItem(baseRow);
  const ens = ensChecks[0] ?? null;
  const journal = journals[0] ?? null;
  const effect = effects[0] ?? null;
  const financial = financialRows[0] ?? null;
  const receiptRecord = financial?.receipt_id && financial.receipt_created_at &&
    financial.adapter_key && financial.proof_hash && financial.result_hash
    ? {
        receiptId: financial.receipt_id,
        verified: financial.receipt_verified === true,
        adapterKey: financial.adapter_key,
        proofHash: financial.proof_hash,
        resultHash: financial.result_hash,
        createdAt: financial.receipt_created_at.toISOString(),
      }
    : null;
  const receiptBound =
    receiptRecord?.verified === true &&
    effect?.state === "SUCCEEDED" &&
    effect.result_hash === receiptRecord.resultHash &&
    effect.terminal_at !== null;
  const receipt = receiptBound ? receiptRecord : null;
  const receiptBindingError = receiptRecord?.verified === true && !receiptBound;
  const storage = journal?.expected_root && journal.expected_digest &&
    journal.expected_size !== null
    ? {
        expectedRoot: journal.expected_root,
        expectedDigest: journal.expected_digest,
        expectedSize: journal.expected_size,
        storageReceiptDigest: journal.storage_receipt_digest,
        readbackRoot: journal.readback_root,
        readbackDigest: journal.readback_digest,
        readbackSize: journal.readback_size,
        verified:
          journal.stage === "READBACK_VERIFIED" &&
          journal.readback_root === journal.expected_root &&
          journal.readback_digest === journal.expected_digest &&
          journal.readback_size === journal.expected_size,
      }
    : null;

  return {
    ...base,
    evidence: receiptBindingError
      ? { ...base.evidence, receipt: "failed" }
      : base.evidence,
    evidenceDetail: {
      timeline: events.map((event) => ({
        version: event.version,
        eventType: event.event_type,
        fromState: event.from_state,
        toState: event.to_state,
        createdAt: event.created_at.toISOString(),
      })),
      latestEnsDecision: ens
        ? {
            checkId: ens.check_id,
            phase: ens.phase,
            operation: ens.operation,
            decision: ens.decision,
            errorCode: ens.error_code,
            recordHash: ens.record_hash,
            chainId: ens.chain_id,
            blockNumber: ens.block_number,
            blockTimestamp: ens.block_timestamp?.toISOString() ?? null,
            observedAt: ens.observed_at.toISOString(),
            freshUntil: ens.fresh_until?.toISOString() ?? null,
            transactionHash: ens.transaction_hash,
          }
        : null,
      execution: journal
        ? {
            stage: journal.stage,
            requestHash: journal.request_hash,
            requestId: journal.request_id,
            responseHash: journal.response_hash,
            computeReceiptDigest: journal.compute_receipt_digest,
            proofHash: journal.proof_hash,
            updatedAt: journal.updated_at.toISOString(),
          }
        : null,
      storage,
      receipt,
      delivery: base.state === "SUCCEEDED" && receipt && effect?.result_hash && effect.terminal_at
        ? {
            resultHash: effect.result_hash,
            result: toCanonicalValue(effect.result),
            terminalAt: effect.terminal_at.toISOString(),
          }
        : null,
      financial: {
        settlement: receipt && financial?.settlement_amount_atomic &&
          financial.settlement_asset && financial.settlement_created_at
          ? {
              amountAtomic: financial.settlement_amount_atomic,
              asset: financial.settlement_asset,
              createdAt: financial.settlement_created_at.toISOString(),
            }
          : null,
        refund: financial?.refund_amount_atomic && financial.refund_asset &&
          financial.refund_reason_code && financial.refund_created_at
          ? {
              amountAtomic: financial.refund_amount_atomic,
              asset: financial.refund_asset,
              reasonCode: financial.refund_reason_code,
              createdAt: financial.refund_created_at.toISOString(),
            }
          : null,
      },
      errorCode: receiptBindingError
        ? "RECEIPT_EFFECT_HASH_MISMATCH"
        : base.lastErrorCode ?? journal?.error_code ?? ens?.error_code ?? null,
    },
  };
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
      const canceledEffects = await tx<{ id: string }[]>`
        UPDATE effects
        SET state = 'CANCELED', terminal_at = ${now}, error_code = 'JOB_CANCELED', updated_at = ${now}
        WHERE job_id = ${jobId}::uuid AND state IN ('PENDING', 'RUNNING')
        RETURNING id
      `;
      if (canceledEffects.length !== 1) throw new Error("KERNEL_EFFECT_CANCEL_INVARIANT");
      const nonterminalEffects = await tx<{ count: string }[]>`
        SELECT count(*)::text AS count
        FROM effects
        WHERE job_id = ${jobId}::uuid AND state IN ('PENDING', 'RUNNING')
      `;
      if (nonterminalEffects[0]?.count !== "0") {
        throw new Error("KERNEL_EFFECT_TERMINALITY_INVARIANT");
      }
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
