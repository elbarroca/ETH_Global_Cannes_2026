import { getDb } from "../config/database";
import type { EnsPublicationAuthority } from "../ens/authority";
import { randomUUID } from "node:crypto";
import { domainHash, type CanonicalValue } from "./canonical";
import { KernelError } from "./errors";
import type { DatabaseClient } from "./service";
import type {
  AgentEnsBinding,
  AgentEnsWritePlan,
  AgentLifecycleState,
  AgentLifecycleVersion,
  AgentManifest,
  ProtectedPublishedAgent,
} from "./types";

interface LifecycleRow {
  agent_id: string;
  version_id: string;
  version: number;
  name: string;
  description: string;
  owner_user_id: string;
  owner_wallet: string;
  capabilities: string[];
  manifest: AgentManifest;
  manifest_hash: string;
  prompt_hash: string;
  config_hash: string;
  adapter_key: "protected-a3";
  price_atomic: string;
  asset: "USDC_ATOMIC";
  proof_policy: "verified-receipt-required";
  lifecycle_state: AgentLifecycleState;
  creator_parent: string | null;
  agent_label: string | null;
  full_subname: string | null;
  write_plan_hash: string | null;
  canonical_state: "UNVERIFIED" | "CANONICAL" | "REFUSED";
  authority_owner: string | null;
  authority_delegate: string | null;
  authority_policy_version: string | null;
  authority_refusal: string | null;
  authority_release_sha: string | null;
  publication_decision_id: string | null;
  published_at: Date | null;
}

interface LockedLifecycleRow extends LifecycleRow {
  write_plan: AgentEnsWritePlan | null;
}

const PUBLICATION_AUTHORITY_TIMEOUT_MS = 5_000;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;

type LifecycleAction = "CREATE_DRAFT" | "BIND_NAME" | "PREPARE_ENS_WRITE" | "PUBLISH_VERSION";

interface LifecycleActionRow {
  payload_hash: string;
  agent_version_id: string | null;
  completed_at: Date | null;
}

interface LifecycleMutationOptions {
  idempotencyKey?: string;
  now?: Date;
  sql?: DatabaseClient;
}

function lifecycleIdempotencyKey(options: LifecycleMutationOptions): string {
  if (options.idempotencyKey && IDEMPOTENCY_KEY.test(options.idempotencyKey)) {
    return options.idempotencyKey;
  }
  if (!options.idempotencyKey && options.sql && process.env.NODE_ENV === "test") {
    return `test-${randomUUID()}`;
  }
  throw new KernelError(
    "KERNEL_INVALID_REQUEST",
    "Idempotency-Key must be 8-128 URL-safe characters",
    400,
  );
}

function lifecyclePayloadHash(
  ownerUserId: string,
  action: LifecycleAction,
  payload: CanonicalValue,
): string {
  return domainHash("agent-lifecycle-action", { action, ownerUserId, payload });
}

async function claimLifecycleAction(
  tx: DatabaseClient,
  ownerUserId: string,
  action: LifecycleAction,
  idempotencyKey: string,
  payloadHash: string,
  now: Date,
): Promise<string | null> {
  await tx`
    INSERT INTO agent_lifecycle_actions (
      owner_user_id, action, idempotency_key, payload_hash, created_at
    ) VALUES (${ownerUserId}, ${action}, ${idempotencyKey}, ${payloadHash}, ${now})
    ON CONFLICT (owner_user_id, action, idempotency_key) DO NOTHING
  `;
  const rows = await tx<LifecycleActionRow[]>`
    SELECT payload_hash, agent_version_id, completed_at
    FROM agent_lifecycle_actions
    WHERE owner_user_id = ${ownerUserId} AND action = ${action}
      AND idempotency_key = ${idempotencyKey}
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) throw new Error("KERNEL_LIFECYCLE_ACTION_CLAIM_FAILED");
  if (row.payload_hash !== payloadHash) {
    throw new KernelError(
      "KERNEL_IDEMPOTENCY_MISMATCH",
      "Idempotency key was already used for different input",
      409,
    );
  }
  if ((row.agent_version_id === null) !== (row.completed_at === null)) {
    throw new Error("KERNEL_LIFECYCLE_ACTION_INVARIANT");
  }
  return row.agent_version_id;
}

async function completedLifecycleAction(
  sql: DatabaseClient,
  ownerUserId: string,
  action: LifecycleAction,
  idempotencyKey: string,
  payloadHash: string,
): Promise<string | null> {
  const rows = await sql<LifecycleActionRow[]>`
    SELECT payload_hash, agent_version_id, completed_at
    FROM agent_lifecycle_actions
    WHERE owner_user_id = ${ownerUserId} AND action = ${action}
      AND idempotency_key = ${idempotencyKey}
  `;
  const row = rows[0];
  if (!row) return null;
  if (row.payload_hash !== payloadHash) {
    throw new KernelError(
      "KERNEL_IDEMPOTENCY_MISMATCH",
      "Idempotency key was already used for different input",
      409,
    );
  }
  return row.completed_at ? row.agent_version_id : null;
}

async function completeLifecycleAction(
  tx: DatabaseClient,
  ownerUserId: string,
  action: LifecycleAction,
  idempotencyKey: string,
  versionId: string,
): Promise<void> {
  const rows = await tx<{ id: string }[]>`
    UPDATE agent_lifecycle_actions
    SET agent_version_id = ${versionId}::uuid, completed_at = clock_timestamp()
    WHERE owner_user_id = ${ownerUserId} AND action = ${action}
      AND idempotency_key = ${idempotencyKey}
      AND agent_version_id IS NULL AND completed_at IS NULL
    RETURNING id::text
  `;
  if (!rows[0]) throw new Error("KERNEL_LIFECYCLE_ACTION_COMPLETE_FAILED");
}

function manifestHashes(manifest: AgentManifest): {
  manifestHash: string;
  promptHash: string;
  configHash: string;
} {
  return {
    manifestHash: domainHash("agent-manifest", manifest),
    promptHash: domainHash("agent-prompt", manifest.instructions),
    configHash: domainHash("agent-config", {
      adapterKey: manifest.adapterKey,
      capabilities: manifest.capabilities,
      connectorKey: manifest.connectorKey,
      endpoint: manifest.endpoint,
      ensBinding: manifest.ensBinding,
      priceAtomic: manifest.priceAtomic,
      proofPolicy: manifest.proofPolicy,
    }),
  };
}

function mapLifecycle(row: LifecycleRow, viewerUserId: string): AgentLifecycleVersion {
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
    lifecycleState: row.lifecycle_state,
    hireable: row.lifecycle_state === "PUBLISHED" && row.canonical_state === "CANONICAL" &&
      row.publication_decision_id !== null,
    ownedByViewer: row.owner_user_id === viewerUserId,
    creatorParent: row.creator_parent,
    agentLabel: row.agent_label,
    fullSubname: row.full_subname,
    writePlanHash: row.write_plan_hash,
    canonicalState: row.canonical_state,
    authorityOwner: row.authority_owner,
    authorityDelegate: row.authority_delegate,
    authorityPolicyVersion: row.authority_policy_version,
    refusalReason: row.authority_refusal,
    authorityReleaseSha: row.authority_release_sha,
    publicationDecisionId: row.publication_decision_id,
    publishedAt: row.published_at?.toISOString() ?? null,
  };
}

function asPublished(value: AgentLifecycleVersion): ProtectedPublishedAgent {
  if (
    value.lifecycleState !== "PUBLISHED" || !value.hireable ||
    value.canonicalState !== "CANONICAL" || !value.creatorParent || !value.agentLabel ||
    !value.fullSubname || !value.writePlanHash || !value.authorityOwner ||
    !value.authorityPolicyVersion || !value.authorityReleaseSha ||
    !value.publicationDecisionId || !value.publishedAt
  ) {
    throw new Error("KERNEL_PUBLISHED_READ_MODEL_INVARIANT");
  }
  return {
    ...value,
    lifecycleState: "PUBLISHED",
    hireable: true,
    canonicalState: "CANONICAL",
    creatorParent: value.creatorParent,
    agentLabel: value.agentLabel,
    fullSubname: value.fullSubname,
    writePlanHash: value.writePlanHash,
    authorityOwner: value.authorityOwner,
    authorityPolicyVersion: value.authorityPolicyVersion,
    authorityReleaseSha: value.authorityReleaseSha,
    publicationDecisionId: value.publicationDecisionId,
    publishedAt: value.publishedAt,
  };
}

async function loadLifecycle(
  sql: DatabaseClient,
  versionId: string,
  ownerUserId: string,
  lock = false,
): Promise<LockedLifecycleRow> {
  const rows = await sql<LockedLifecycleRow[]>`
    SELECT
      a.id AS agent_id, v.id AS version_id, v.version, a.name,
      COALESCE(v.manifest->>'description', '') AS description,
      a.owner_user_id, v.owner_wallet, v.capabilities, v.manifest,
      v.manifest_hash, v.prompt_hash, v.config_hash, v.adapter_key,
      v.price_atomic::text, v.asset, v.proof_policy, v.lifecycle_state,
      v.creator_parent, v.agent_label, v.full_subname, v.write_plan,
      v.write_plan_hash, v.canonical_state, v.authority_owner,
      v.authority_delegate, v.authority_policy_version, v.authority_refusal,
      v.authority_release_sha, v.publication_decision_id, v.published_at
    FROM agent_versions v
    JOIN kernel_agents a ON a.id = v.agent_id
    WHERE v.id = ${versionId}::uuid AND a.owner_user_id = ${ownerUserId}
      AND v.lifecycle_state IS NOT NULL
    ${lock ? sql`FOR UPDATE OF v` : sql``}
  `;
  const row = rows[0];
  if (!row) throw new KernelError("KERNEL_NOT_FOUND", "Agent version not found", 404);
  return row;
}

async function appendLifecycleEvent(
  tx: DatabaseClient,
  versionId: string,
  action: string,
  payload: CanonicalValue,
  now: Date,
): Promise<void> {
  await tx`
    INSERT INTO agent_version_events (agent_version_id, sequence, action, payload, created_at)
    SELECT ${versionId}::uuid, COALESCE(max(sequence), -1) + 1, ${action}, ${tx.json(payload)}, ${now}
    FROM agent_version_events
    WHERE agent_version_id = ${versionId}::uuid
  `;
}

export async function createAgentDraft(
  owner: { userId: string; walletAddress: string },
  manifest: AgentManifest,
  options: LifecycleMutationOptions & { agentId?: string | null } = {},
): Promise<AgentLifecycleVersion> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const idempotencyKey = lifecycleIdempotencyKey(options);
  const payloadHash = lifecyclePayloadHash(owner.userId, "CREATE_DRAFT", {
    agentId: options.agentId ?? null,
    manifest,
  });
  const hashes = manifestHashes(manifest);
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    const replayVersionId = await claimLifecycleAction(
      tx,
      owner.userId,
      "CREATE_DRAFT",
      idempotencyKey,
      payloadHash,
      now,
    );
    if (replayVersionId) return mapLifecycle(
      await loadLifecycle(tx, replayVersionId, owner.userId),
      owner.userId,
    );
    let agentId = options.agentId ?? null;
    let version = 1;
    if (agentId) {
      const agents = await tx<{ id: string; name: string }[]>`
        SELECT a.id, a.name
        FROM kernel_agents a
        WHERE a.id = ${agentId}::uuid AND a.owner_user_id = ${owner.userId}
        FOR UPDATE OF a
      `;
      const agent = agents[0];
      if (!agent) throw new KernelError("KERNEL_NOT_FOUND", "Agent not found", 404);
      if (agent.name !== manifest.name) {
        throw new KernelError("KERNEL_INVALID_REQUEST", "A new version must retain the agent name", 400);
      }
      const versions = await tx<{ version: number }[]>`
        SELECT COALESCE(max(version), 0)::int AS version
        FROM agent_versions
        WHERE agent_id = ${agentId}::uuid
      `;
      version = (versions[0]?.version ?? 0) + 1;
    } else {
      const agents = await tx<{ id: string }[]>`
        INSERT INTO kernel_agents (owner_user_id, name, created_at)
        VALUES (${owner.userId}, ${manifest.name}, ${now})
        RETURNING id
      `;
      agentId = agents[0]?.id ?? null;
      if (!agentId) throw new Error("KERNEL_AGENT_CREATE_FAILED");
    }
    const versions = await tx<LifecycleRow[]>`
      INSERT INTO agent_versions (
        agent_id, version, manifest, manifest_hash, prompt_hash, config_hash,
        capabilities, adapter_key, endpoint, connector_key, owner_wallet,
        payout_address, price_atomic, asset, proof_policy, lifecycle_state,
        published, published_at, created_at
      ) VALUES (
        ${agentId}::uuid, ${version}, ${tx.json(manifest)}, ${hashes.manifestHash},
        ${hashes.promptHash}, ${hashes.configHash}, ${manifest.capabilities},
        ${manifest.adapterKey}, NULL, NULL, ${owner.walletAddress}, NULL,
        ${manifest.priceAtomic}::bigint, ${manifest.asset}, ${manifest.proofPolicy},
        'DRAFT', false, NULL, ${now}
      )
      RETURNING
        agent_id, id AS version_id, version, ${manifest.name}::text AS name,
        ${manifest.description}::text AS description, ${owner.userId}::text AS owner_user_id,
        owner_wallet, capabilities, manifest, manifest_hash, prompt_hash, config_hash,
        adapter_key, price_atomic::text, asset, proof_policy, lifecycle_state,
        creator_parent, agent_label, full_subname, write_plan_hash, canonical_state,
        authority_owner, authority_delegate, authority_policy_version,
        authority_refusal, authority_release_sha, publication_decision_id, published_at
    `;
    const created = versions[0];
    if (!created) throw new Error("KERNEL_AGENT_VERSION_CREATE_FAILED");
    await appendLifecycleEvent(tx, created.version_id, "CREATE_DRAFT", {
      manifestHash: created.manifest_hash,
      version: created.version,
    }, now);
    await completeLifecycleAction(
      tx,
      owner.userId,
      "CREATE_DRAFT",
      idempotencyKey,
      created.version_id,
    );
    return mapLifecycle(created, owner.userId);
  });
}

export async function bindAgentName(
  ownerUserId: string,
  versionId: string,
  binding: AgentEnsBinding,
  options: LifecycleMutationOptions = {},
): Promise<AgentLifecycleVersion> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const idempotencyKey = lifecycleIdempotencyKey(options);
  const payloadHash = lifecyclePayloadHash(ownerUserId, "BIND_NAME", { binding, versionId });
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    const replayVersionId = await claimLifecycleAction(
      tx,
      ownerUserId,
      "BIND_NAME",
      idempotencyKey,
      payloadHash,
      now,
    );
    if (replayVersionId) return mapLifecycle(
      await loadLifecycle(tx, replayVersionId, ownerUserId),
      ownerUserId,
    );
    const current = await loadLifecycle(tx, versionId, ownerUserId, true);
    if (current.lifecycle_state !== "DRAFT") {
      throw new KernelError("KERNEL_IMMUTABLE_VERSION", "Create a new draft version to change this binding", 409);
    }
    const manifest: AgentManifest = { ...current.manifest, ensBinding: binding };
    const hashes = manifestHashes(manifest);
    const rows = await tx<LifecycleRow[]>`
      UPDATE agent_versions
      SET manifest = ${tx.json(manifest)}, manifest_hash = ${hashes.manifestHash},
          config_hash = ${hashes.configHash}, lifecycle_state = 'NAME_BOUND',
          creator_parent = ${binding.creatorParent}, agent_label = ${binding.agentLabel},
          full_subname = ${binding.fullSubname}, write_plan = NULL,
          write_plan_hash = NULL, canonical_state = 'UNVERIFIED',
          authority_owner = NULL, authority_delegate = NULL,
          authority_policy_version = NULL, authority_refusal = NULL,
          authority_record_hash = NULL, authority_observed_at = NULL,
          authority_fresh_until = NULL, authority_release_sha = NULL
      WHERE id = ${versionId}::uuid AND published = false
      RETURNING
        agent_id, id AS version_id, version, ${current.name}::text AS name,
        ${manifest.description}::text AS description, ${ownerUserId}::text AS owner_user_id,
        owner_wallet, capabilities, manifest, manifest_hash, prompt_hash, config_hash,
        adapter_key, price_atomic::text, asset, proof_policy, lifecycle_state,
        creator_parent, agent_label, full_subname, write_plan_hash, canonical_state,
        authority_owner, authority_delegate, authority_policy_version,
        authority_refusal, authority_release_sha, publication_decision_id, published_at
    `;
    const updated = rows[0];
    if (!updated) throw new Error("KERNEL_AGENT_BIND_FAILED");
    await appendLifecycleEvent(tx, versionId, "BIND_NAME", {
      creatorParent: binding.creatorParent,
      agentLabel: binding.agentLabel,
      fullSubname: binding.fullSubname,
      manifestHash: hashes.manifestHash,
    }, now);
    await completeLifecycleAction(
      tx,
      ownerUserId,
      "BIND_NAME",
      idempotencyKey,
      versionId,
    );
    return mapLifecycle(updated, ownerUserId);
  });
}

export async function prepareAgentEnsWrite(
  ownerUserId: string,
  versionId: string,
  options: LifecycleMutationOptions = {},
): Promise<{ version: AgentLifecycleVersion; plan: AgentEnsWritePlan; planHash: string }> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const idempotencyKey = lifecycleIdempotencyKey(options);
  const payloadHash = lifecyclePayloadHash(ownerUserId, "PREPARE_ENS_WRITE", { versionId });
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    const replayVersionId = await claimLifecycleAction(
      tx,
      ownerUserId,
      "PREPARE_ENS_WRITE",
      idempotencyKey,
      payloadHash,
      now,
    );
    if (replayVersionId && replayVersionId !== versionId) {
      throw new Error("KERNEL_LIFECYCLE_ACTION_VERSION_MISMATCH");
    }
    const current = await loadLifecycle(tx, replayVersionId ?? versionId, ownerUserId, true);
    if (
      replayVersionId
        ? current.lifecycle_state !== "WRITE_PREPARED"
        : current.lifecycle_state !== "NAME_BOUND"
    ) {
      throw new KernelError("KERNEL_CONFLICT", "Bind the ENS name before preparing a write", 409);
    }
    const binding = current.manifest.ensBinding;
    if (!binding || !current.creator_parent || !current.agent_label || !current.full_subname) {
      throw new Error("KERNEL_AGENT_BINDING_INVARIANT");
    }
    const plan: AgentEnsWritePlan = {
      schemaVersion: 1,
      kind: "LOCAL_ONLY_UNAUTHORIZED",
      agentVersionId: current.version_id,
      manifestHash: current.manifest_hash,
      creatorParent: binding.creatorParent,
      agentLabel: binding.agentLabel,
      fullSubname: binding.fullSubname,
      creatorDnsName: binding.creatorDnsName,
      agentDnsName: binding.agentDnsName,
      operations: ["CREATE_OR_UPDATE_SUBNAME", "SET_IMMUTABLE_MANIFEST_BINDING"],
      requiresAuthorization: true,
      requiresWalletSignature: true,
    };
    const planHash = domainHash("ens-write-plan", plan);
    if (replayVersionId) {
      if (current.write_plan_hash !== planHash) {
        throw new Error("KERNEL_ENS_WRITE_PLAN_REPLAY_MISMATCH");
      }
      return { version: mapLifecycle(current, ownerUserId), plan, planHash };
    }
    const rows = await tx<LifecycleRow[]>`
      UPDATE agent_versions
      SET lifecycle_state = 'WRITE_PREPARED', write_plan = ${tx.json(plan)},
          write_plan_hash = ${planHash}, canonical_state = 'UNVERIFIED', authority_refusal = NULL
      WHERE id = ${versionId}::uuid AND lifecycle_state = 'NAME_BOUND' AND published = false
      RETURNING
        agent_id, id AS version_id, version, ${current.name}::text AS name,
        ${current.description}::text AS description, ${ownerUserId}::text AS owner_user_id,
        owner_wallet, capabilities, manifest, manifest_hash, prompt_hash, config_hash,
        adapter_key, price_atomic::text, asset, proof_policy, lifecycle_state,
        creator_parent, agent_label, full_subname, write_plan_hash, canonical_state,
        authority_owner, authority_delegate, authority_policy_version,
        authority_refusal, authority_release_sha, publication_decision_id, published_at
    `;
    const updated = rows[0];
    if (!updated) throw new Error("KERNEL_ENS_WRITE_PLAN_CREATE_FAILED");
    await appendLifecycleEvent(tx, versionId, "PREPARE_ENS_WRITE", { planHash }, now);
    await completeLifecycleAction(
      tx,
      ownerUserId,
      "PREPARE_ENS_WRITE",
      idempotencyKey,
      versionId,
    );
    return { version: mapLifecycle(updated, ownerUserId), plan, planHash };
  });
}

async function recordPublicationRefusal(
  sql: DatabaseClient,
  ownerUserId: string,
  versionId: string,
  errorCode: string,
  now: Date,
): Promise<void> {
  await sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    const current = await loadLifecycle(tx, versionId, ownerUserId, true);
    if (current.lifecycle_state === "PUBLISHED") return;
    await tx`
      UPDATE agent_versions
      SET canonical_state = 'REFUSED', authority_refusal = ${errorCode}
      WHERE id = ${versionId}::uuid AND published = false
    `;
    await appendLifecycleEvent(tx, versionId, "PUBLISH_REFUSED", { errorCode }, now);
  });
}

export async function publishAgentVersion(
  ownerUserId: string,
  versionId: string,
  options: LifecycleMutationOptions & {
    authority?: EnsPublicationAuthority;
    now?: Date;
    signal?: AbortSignal;
  } = {},
): Promise<ProtectedPublishedAgent> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const idempotencyKey = lifecycleIdempotencyKey(options);
  const payloadHash = lifecyclePayloadHash(ownerUserId, "PUBLISH_VERSION", { versionId });
  const completedVersionId = await completedLifecycleAction(
    sql,
    ownerUserId,
    "PUBLISH_VERSION",
    idempotencyKey,
    payloadHash,
  );
  if (completedVersionId) {
    return asPublished(mapLifecycle(
      await loadLifecycle(sql, completedVersionId, ownerUserId),
      ownerUserId,
    ));
  }
  const current = await loadLifecycle(sql, versionId, ownerUserId);
  if (current.lifecycle_state !== "WRITE_PREPARED" || !current.write_plan_hash) {
    throw new KernelError("KERNEL_CONFLICT", "Prepare the ENS write before publication", 409);
  }
  if (!options.authority) {
    await recordPublicationRefusal(sql, ownerUserId, versionId, "ENS_PUBLICATION_NOT_CONFIGURED", now);
    throw new KernelError(
      "KERNEL_ENS_AUTHORITY_REQUIRED",
      "Fresh durable A4 publication authority is required",
      409,
    );
  }
  let decisionId: string;
  try {
    const controller = new AbortController();
    const abort = (): void => controller.abort(options.signal?.reason ?? new Error("ENS_AUTHORITY_ABORTED"));
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error("ENS_AUTHORITY_TIMEOUT")), PUBLICATION_AUTHORITY_TIMEOUT_MS);
    let decision;
    try {
      decision = await options.authority({ agentVersionId: versionId }, controller.signal);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
    if (!decision.allowed || !decision.decisionId) {
      const concurrentReplayId = await completedLifecycleAction(
        sql,
        ownerUserId,
        "PUBLISH_VERSION",
        idempotencyKey,
        payloadHash,
      );
      if (concurrentReplayId) {
        return asPublished(mapLifecycle(
          await loadLifecycle(sql, concurrentReplayId, ownerUserId),
          ownerUserId,
        ));
      }
      const errorCode = decision.errorCode && /^[A-Z][A-Z0-9_]{2,64}$/.test(decision.errorCode)
        ? decision.errorCode
        : "ENS_PUBLICATION_DENIED";
      await recordPublicationRefusal(sql, ownerUserId, versionId, errorCode, now);
      throw new KernelError(
        errorCode === "ENS_PUBLICATION_NOT_CONFIGURED"
          ? "KERNEL_ENS_AUTHORITY_REQUIRED"
          : "KERNEL_ENS_AUTHORITY_DENIED",
        "A4 publication authority refused",
        409,
      );
    }
    decisionId = decision.decisionId;
  } catch (error) {
    if (error instanceof KernelError) throw error;
    const errorCode = error instanceof Error && error.message === "ENS_AUTHORITY_TIMEOUT"
      ? "ENS_AUTHORITY_TIMEOUT"
      : "ENS_AUTHORITY_RESOLVER_OUTAGE";
    await recordPublicationRefusal(sql, ownerUserId, versionId, errorCode, now);
    throw new KernelError("KERNEL_ENS_AUTHORITY_DENIED", "A4 authority readback failed", 409);
  }
  try {
    return await sql.begin(async (transaction) => {
      const tx = transaction as unknown as DatabaseClient;
      const replayVersionId = await claimLifecycleAction(
        tx,
        ownerUserId,
        "PUBLISH_VERSION",
        idempotencyKey,
        payloadHash,
        now,
      );
      if (replayVersionId) return asPublished(mapLifecycle(
        await loadLifecycle(tx, replayVersionId, ownerUserId),
        ownerUserId,
      ));
      const locked = await loadLifecycle(tx, versionId, ownerUserId, true);
      if (locked.lifecycle_state !== "WRITE_PREPARED" || !locked.write_plan_hash) {
        throw new KernelError("KERNEL_CONFLICT", "Agent version changed during authority readback", 409);
      }
      const decisions = await tx<{
        decision_id: string;
        owner: string;
        delegate: string;
        policy_version: string;
        record_hash: string;
        observed_at: Date;
        fresh_until: Date;
        release_sha: string;
        database_now: Date;
      }[]>`
        SELECT
          d.id::text AS decision_id, d.owner, d.delegate, d.policy_version,
          d.record_hash, d.observed_at, d.fresh_until, d.release_sha,
          clock_timestamp() AS database_now
        FROM ens_publication_decisions d
        JOIN ens_publication_authority_policies p
          ON p.release_sha = d.release_sha
         AND p.agent_version_id = d.agent_version_id
         AND p.binding_hash = d.binding_hash
         AND p.binding = d.binding_bytes::jsonb
        JOIN ens_publication_authority_releases r ON r.release_sha = d.release_sha
        JOIN agent_versions v ON v.id = d.agent_version_id
        WHERE d.id = ${decisionId}::uuid
          AND d.agent_version_id = ${versionId}::uuid
          AND d.decision = 'ALLOW' AND d.error_code IS NULL
          AND d.record_hash IS NOT NULL AND d.record_bytes IS NOT NULL
          AND d.agent_version = v.version AND d.manifest_hash = v.manifest_hash
          AND d.capabilities = v.capabilities
          AND d.service = COALESCE(v.endpoint, v.adapter_key)
          AND d.price_atomic = v.price_atomic
          AND d.payout = lower(COALESCE(v.payout_address, v.owner_wallet))
          AND d.creator_name = v.creator_parent AND d.agent_label = v.agent_label
          AND d.agent_name = v.full_subname
          AND d.creator_dns_name = v.manifest->'ensBinding'->>'creatorDnsName'
          AND d.agent_dns_name = v.manifest->'ensBinding'->>'agentDnsName'
          AND d.owner = lower(v.owner_wallet)
          AND d.delegate = lower(COALESCE(v.payout_address, v.owner_wallet))
          AND d.chain_id = (p.binding->>'chainId')::int
          AND d.root_registry = lower(p.binding->>'rootRegistry')
          AND d.universal_resolver = lower(p.binding->>'universalResolver')
          AND d.creator_canonical_registry = lower(p.binding->>'creatorCanonicalRegistry')
          AND d.agent_parent_registry = lower(p.binding->>'agentParentRegistry')
          AND d.agent_canonical_registry IS NOT DISTINCT FROM lower(p.binding->>'agentCanonicalRegistry')
          AND d.roles = p.binding->'roles'
          AND d.external_grants = p.binding->'externalGrants'
          AND d.parent_link = p.binding->'parentLink'
          AND d.alias = false
          AND d.creator_resolver_address = lower(p.binding->>'creatorResolverAddress')
          AND d.resolver_address = lower(p.binding->>'resolverAddress')
          AND d.resolver_suffix = p.binding->>'resolverSuffix'
          AND d.resolver_mode = p.binding->>'resolverMode'
          AND d.ccip_gateway = p.binding->>'ccipGateway'
          AND d.policy_version = p.binding->>'policyVersion'
          AND r.not_before <= clock_timestamp() AND r.expires_at > clock_timestamp()
          AND d.observed_at <= clock_timestamp() AND d.fresh_until > clock_timestamp()
          AND clock_timestamp() - d.observed_at <= make_interval(secs => d.max_age_seconds)
          AND d.parent_expiry > clock_timestamp() AND d.agent_expiry > clock_timestamp()
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(d.roles) role
            WHERE (role->>'expiresAt')::timestamptz <= clock_timestamp()
          )
          AND obj_description(
            to_regprocedure('public.admit_ens_publication_decision(uuid,jsonb,numeric,timestamptz,text,text)'),
            'pg_proc'
          ) = 'alphadawg:a4-publication-upgrade-preflight:v1'
        FOR SHARE OF d, p, r
      `;
      const decision = decisions[0];
      if (!decision) {
        throw new KernelError(
          "KERNEL_ENS_AUTHORITY_DENIED",
          "Durable A4 publication decision is stale or mismatched",
          409,
        );
      }
      const eventPayload = {
        manifestHash: locked.manifest_hash,
        policyVersion: decision.policy_version,
        publicationDecisionId: decision.decision_id,
        recordHash: decision.record_hash,
        releaseSha: decision.release_sha,
      } as const;
      await appendLifecycleEvent(tx, versionId, "PUBLISH_VERSION", eventPayload, decision.database_now);
      const rows = await tx<LifecycleRow[]>`
        UPDATE agent_versions v
        SET lifecycle_state = 'PUBLISHED', published = true,
            published_at = clock_timestamp(), canonical_state = 'CANONICAL',
            authority_owner = d.owner, authority_delegate = d.delegate,
            authority_policy_version = d.policy_version, authority_refusal = NULL,
            authority_record_hash = d.record_hash,
            authority_observed_at = d.observed_at,
            authority_fresh_until = d.fresh_until,
            authority_release_sha = d.release_sha,
            publication_decision_id = d.id
        FROM ens_publication_decisions d
        WHERE v.id = ${versionId}::uuid AND v.lifecycle_state = 'WRITE_PREPARED'
          AND v.published = false AND d.id = ${decision.decision_id}::uuid
        RETURNING
          v.agent_id, v.id AS version_id, v.version, ${locked.name}::text AS name,
          ${locked.description}::text AS description, ${ownerUserId}::text AS owner_user_id,
          v.owner_wallet, v.capabilities, v.manifest, v.manifest_hash, v.prompt_hash, v.config_hash,
          v.adapter_key, v.price_atomic::text, v.asset, v.proof_policy, v.lifecycle_state,
          v.creator_parent, v.agent_label, v.full_subname, v.write_plan_hash, v.canonical_state,
          v.authority_owner, v.authority_delegate, v.authority_policy_version,
          v.authority_refusal, v.authority_release_sha, v.publication_decision_id, v.published_at
      `;
      const published = rows[0];
      if (!published) throw new Error("KERNEL_AGENT_PUBLICATION_FAILED");
      await completeLifecycleAction(
        tx,
        ownerUserId,
        "PUBLISH_VERSION",
        idempotencyKey,
        versionId,
      );
      return asPublished(mapLifecycle(published, ownerUserId));
    });
  } catch (error) {
    if (error instanceof KernelError) {
      if (error.code === "KERNEL_ENS_AUTHORITY_DENIED") {
        await recordPublicationRefusal(
          sql,
          ownerUserId,
          versionId,
          "ENS_PUBLICATION_DECISION_INVALID",
          now,
        );
      }
      throw error;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "23514") {
      await recordPublicationRefusal(
        sql,
        ownerUserId,
        versionId,
        "ENS_PUBLICATION_COMMIT_STALE",
        now,
      );
      throw new KernelError(
        "KERNEL_ENS_AUTHORITY_DENIED",
        "Durable A4 publication decision expired before commit",
        409,
      );
    }
    throw error;
  }
}

export async function listAgentLifecycle(
  viewerUserId: string,
  options: { sql?: DatabaseClient } = {},
): Promise<{ agents: ProtectedPublishedAgent[]; drafts: AgentLifecycleVersion[] }> {
  const sql = options.sql ?? getDb();
  const rows = await sql<LifecycleRow[]>`
    SELECT
      a.id AS agent_id, v.id AS version_id, v.version, a.name,
      COALESCE(v.manifest->>'description', '') AS description,
      a.owner_user_id, v.owner_wallet, v.capabilities, v.manifest,
      v.manifest_hash, v.prompt_hash, v.config_hash, v.adapter_key,
      v.price_atomic::text, v.asset, v.proof_policy, v.lifecycle_state,
      v.creator_parent, v.agent_label, v.full_subname, v.write_plan_hash,
      v.canonical_state, v.authority_owner, v.authority_delegate,
      v.authority_policy_version, v.authority_refusal, v.authority_release_sha,
      v.publication_decision_id,
      v.published_at
    FROM agent_versions v
    JOIN kernel_agents a ON a.id = v.agent_id
    WHERE v.lifecycle_state = 'PUBLISHED'
       OR (a.owner_user_id = ${viewerUserId} AND v.lifecycle_state IN ('DRAFT', 'NAME_BOUND', 'WRITE_PREPARED'))
    ORDER BY v.created_at ASC, v.id ASC
  `;
  const visible = rows.map((row) => mapLifecycle(row, viewerUserId));
  return {
    agents: visible.filter((entry) => entry.lifecycleState === "PUBLISHED").map(asPublished),
    drafts: visible.filter((entry) => entry.lifecycleState !== "PUBLISHED"),
  };
}
