import { getDb } from "../config/database";
import { domainHash, type CanonicalValue } from "./canonical";
import { KernelError } from "./errors";
import { validateA4PublicationReadback } from "./policy";
import type { DatabaseClient } from "./service";
import type {
  A4PublicationAuthority,
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
  published_at: Date | null;
}

interface LockedLifecycleRow extends LifecycleRow {
  write_plan: AgentEnsWritePlan | null;
}

const PUBLICATION_AUTHORITY_TIMEOUT_MS = 5_000;

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
    hireable: row.lifecycle_state === "PUBLISHED" && row.canonical_state === "CANONICAL",
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
    publishedAt: row.published_at?.toISOString() ?? null,
  };
}

function asPublished(value: AgentLifecycleVersion): ProtectedPublishedAgent {
  if (
    value.lifecycleState !== "PUBLISHED" || !value.hireable ||
    value.canonicalState !== "CANONICAL" || !value.creatorParent || !value.agentLabel ||
    !value.fullSubname || !value.writePlanHash || !value.authorityOwner ||
    !value.authorityPolicyVersion || !value.authorityReleaseSha || !value.publishedAt
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
      v.authority_release_sha, v.published_at
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
  options: { agentId?: string | null; now?: Date; sql?: DatabaseClient } = {},
): Promise<AgentLifecycleVersion> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const hashes = manifestHashes(manifest);
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
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
        authority_refusal, authority_release_sha, published_at
    `;
    const created = versions[0];
    if (!created) throw new Error("KERNEL_AGENT_VERSION_CREATE_FAILED");
    await appendLifecycleEvent(tx, created.version_id, "CREATE_DRAFT", {
      manifestHash: created.manifest_hash,
      version: created.version,
    }, now);
    return mapLifecycle(created, owner.userId);
  });
}

export async function bindAgentName(
  ownerUserId: string,
  versionId: string,
  binding: AgentEnsBinding,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<AgentLifecycleVersion> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    const current = await loadLifecycle(tx, versionId, ownerUserId, true);
    if (current.lifecycle_state !== "DRAFT" && current.lifecycle_state !== "NAME_BOUND") {
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
        authority_refusal, authority_release_sha, published_at
    `;
    const updated = rows[0];
    if (!updated) throw new Error("KERNEL_AGENT_BIND_FAILED");
    await appendLifecycleEvent(tx, versionId, "BIND_NAME", {
      creatorParent: binding.creatorParent,
      agentLabel: binding.agentLabel,
      fullSubname: binding.fullSubname,
      manifestHash: hashes.manifestHash,
    }, now);
    return mapLifecycle(updated, ownerUserId);
  });
}

export async function prepareAgentEnsWrite(
  ownerUserId: string,
  versionId: string,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<{ version: AgentLifecycleVersion; plan: AgentEnsWritePlan; planHash: string }> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    const current = await loadLifecycle(tx, versionId, ownerUserId, true);
    if (current.lifecycle_state !== "NAME_BOUND" && current.lifecycle_state !== "WRITE_PREPARED") {
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
    if (current.lifecycle_state === "WRITE_PREPARED" && current.write_plan_hash === planHash) {
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
        authority_refusal, authority_release_sha, published_at
    `;
    const updated = rows[0];
    if (!updated) throw new Error("KERNEL_ENS_WRITE_PLAN_CREATE_FAILED");
    await appendLifecycleEvent(tx, versionId, "PREPARE_ENS_WRITE", { planHash }, now);
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
  options: {
    authority?: A4PublicationAuthority;
    now?: Date;
    signal?: AbortSignal;
    sql?: DatabaseClient;
  } = {},
): Promise<ProtectedPublishedAgent> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const current = await loadLifecycle(sql, versionId, ownerUserId);
  if (current.lifecycle_state !== "WRITE_PREPARED" || !current.write_plan_hash) {
    throw new KernelError("KERNEL_CONFLICT", "Prepare the ENS write before publication", 409);
  }
  const binding = current.manifest.ensBinding;
  if (!binding) throw new Error("KERNEL_AGENT_BINDING_INVARIANT");
  if (!options.authority) {
    await recordPublicationRefusal(sql, ownerUserId, versionId, "ENS_AUTHORITY_NOT_CONFIGURED", now);
    throw new KernelError(
      "KERNEL_ENS_AUTHORITY_REQUIRED",
      "Fresh A4 authority readback is required",
      409,
    );
  }
  let readback;
  try {
    const controller = new AbortController();
    const abort = (): void => controller.abort(options.signal?.reason ?? new Error("ENS_AUTHORITY_ABORTED"));
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error("ENS_AUTHORITY_TIMEOUT")), PUBLICATION_AUTHORITY_TIMEOUT_MS);
    let raw: unknown;
    try {
      raw = await options.authority.verify({
        agentVersionId: versionId,
        manifestHash: current.manifest_hash,
        binding,
        ownerWallet: current.owner_wallet,
      }, controller.signal);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
    }
    readback = validateA4PublicationReadback(raw, {
      agentVersionId: versionId,
      manifestHash: current.manifest_hash,
      binding,
      ownerWallet: current.owner_wallet,
    }, now);
  } catch (error) {
    const errorCode = error instanceof KernelError
      ? /^[A-Z][A-Z0-9_]{2,64}$/.test(error.message) ? error.message : error.code
      : error instanceof Error && error.message === "ENS_AUTHORITY_TIMEOUT"
        ? "ENS_AUTHORITY_TIMEOUT"
        : "ENS_AUTHORITY_RESOLVER_OUTAGE";
    await recordPublicationRefusal(sql, ownerUserId, versionId, errorCode, now);
    if (error instanceof KernelError) throw error;
    throw new KernelError("KERNEL_ENS_AUTHORITY_DENIED", "A4 authority readback failed", 409);
  }
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    const locked = await loadLifecycle(tx, versionId, ownerUserId, true);
    if (
      locked.lifecycle_state !== "WRITE_PREPARED" ||
      locked.manifest_hash !== readback.manifestHash ||
      locked.creator_parent !== readback.creatorParent ||
      locked.agent_label !== readback.agentLabel ||
      locked.full_subname !== readback.fullSubname ||
      !locked.write_plan_hash
    ) {
      throw new KernelError("KERNEL_CONFLICT", "Agent version changed during authority readback", 409);
    }
    const rows = await tx<LifecycleRow[]>`
      UPDATE agent_versions
      SET lifecycle_state = 'PUBLISHED', published = true, published_at = ${now},
          canonical_state = 'CANONICAL', authority_owner = ${readback.owner},
          authority_delegate = ${readback.delegate},
          authority_policy_version = ${readback.policyVersion}, authority_refusal = NULL,
          authority_record_hash = ${readback.recordHash},
          authority_observed_at = ${readback.observedAt},
          authority_fresh_until = ${readback.freshUntil},
          authority_release_sha = ${readback.releaseSha}
      WHERE id = ${versionId}::uuid AND lifecycle_state = 'WRITE_PREPARED' AND published = false
      RETURNING
        agent_id, id AS version_id, version, ${locked.name}::text AS name,
        ${locked.description}::text AS description, ${ownerUserId}::text AS owner_user_id,
        owner_wallet, capabilities, manifest, manifest_hash, prompt_hash, config_hash,
        adapter_key, price_atomic::text, asset, proof_policy, lifecycle_state,
        creator_parent, agent_label, full_subname, write_plan_hash, canonical_state,
        authority_owner, authority_delegate, authority_policy_version,
        authority_refusal, authority_release_sha, published_at
    `;
    const published = rows[0];
    if (!published) throw new Error("KERNEL_AGENT_PUBLICATION_FAILED");
    await appendLifecycleEvent(tx, versionId, "PUBLISH_VERSION", {
      authorityRecordHash: readback.recordHash,
      authorityReleaseSha: readback.releaseSha,
      manifestHash: readback.manifestHash,
      policyVersion: readback.policyVersion,
    }, now);
    return asPublished(mapLifecycle(published, ownerUserId));
  });
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
