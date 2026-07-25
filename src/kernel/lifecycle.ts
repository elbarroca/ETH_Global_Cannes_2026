import { getDb } from "../config/database";
import type { EnsPublicationAuthority } from "../ens/authority";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { domainHash, type CanonicalValue } from "./canonical";
import { bindManifestEns, deriveManifestHashes } from "./agent-catalog";
import { KernelError } from "./errors";
import type { DatabaseClient } from "./service";
import type { AgentListFilters } from "./policy";
import type {
  AgentEnsBinding,
  AgentEnsWritePlan,
  AgentLifecycleState,
  AgentLifecycleVersion,
  AgentManifest,
  AgentVersionProvenance,
  ProtectedPublishedAgent,
  ProtectedPublishedAgentRead,
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

interface LifecycleReadRow extends LifecycleRow {
  verified_external_hires: string;
  provenance_protocol: string | null;
  provenance_chain_id: number | null;
  provenance_contract_address: string | null;
  provenance_token_id: string | null;
  provenance_metadata_uri: string | null;
  provenance_evidence_hash: string | null;
  provenance_observed_at: Date | null;
}

const PUBLICATION_AUTHORITY_TIMEOUT_MS = 5_000;
const LIFECYCLE_ACTION_LEASE_SECONDS = 10;
const LIFECYCLE_ACTION_RETRY_DELAY_MS = 100;
const PUBLICATION_ACTION_WAIT_MS = 6_000;
const PUBLICATION_ACTION_POLL_MS = 20;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const WALLET = /^0x[0-9a-f]{40}$/;
const ATOMIC = /^(0|[1-9][0-9]{0,77})$/;

type LifecycleAction = "CREATE_DRAFT" | "BIND_NAME" | "PREPARE_ENS_WRITE" | "PUBLISH_VERSION";

type LifecycleActionStatus = "PENDING" | "SUCCEEDED" | "DENIED" | "RETRYABLE";

interface LifecycleActionRow {
  id: string;
  payload_hash: string;
  target_agent_version_id: string | null;
  agent_version_id: string | null;
  status: LifecycleActionStatus;
  attempt: number;
  lease_token: string | null;
  lease_expires_at: Date | null;
  result_snapshot: unknown;
  result_hash: string | null;
  error_code: string | null;
  completed_at: Date | null;
  claimable: boolean;
}

type LifecycleActionClaim =
  | { kind: "EXECUTE"; actionId: string; attempt: number; leaseToken: string }
  | { kind: "WAIT" }
  | { kind: "RETRYABLE"; errorCode: string }
  | { kind: "TERMINAL"; row: LifecycleActionRow };

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

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

const LIFECYCLE_VERSION_KEYS = [
  "agentId", "versionId", "version", "name", "description", "capabilities",
  "manifestHash", "promptHash", "configHash", "adapterKey", "ownerWallet",
  "priceAtomic", "asset", "proofPolicy", "lifecycleState", "hireable",
  "ownedByViewer", "creatorParent", "agentLabel", "fullSubname", "writePlanHash",
  "canonicalState", "authorityOwner", "authorityDelegate", "authorityPolicyVersion",
  "refusalReason", "authorityReleaseSha", "publicationDecisionId", "publishedAt",
] as const;

const LIFECYCLE_VERSION_V3_KEYS = [
  ...LIFECYCLE_VERSION_KEYS,
  "manifestSchemaVersion", "reviewedSources", "skillSummary", "mcpSummary", "mcpAvailability",
] as const;

const LIFECYCLE_VERSION_CURRENT_KEYS = [
  ...LIFECYCLE_VERSION_V3_KEYS,
  "riskTiers",
] as const;

function parseLifecycleVersionSnapshot(value: unknown): AgentLifecycleVersion {
  const row = object(value);
  const legacySnapshot = !!row && exactKeys(row, LIFECYCLE_VERSION_KEYS);
  const v3Snapshot = !!row && exactKeys(row, LIFECYCLE_VERSION_V3_KEYS);
  const currentSnapshot = !!row && exactKeys(row, LIFECYCLE_VERSION_CURRENT_KEYS);
  if (
    !row || (!legacySnapshot && !v3Snapshot && !currentSnapshot) ||
    typeof row.agentId !== "string" || !UUID.test(row.agentId) ||
    typeof row.versionId !== "string" || !UUID.test(row.versionId) ||
    !Number.isInteger(row.version) || (row.version as number) < 1 ||
    typeof row.name !== "string" || typeof row.description !== "string" ||
    !Array.isArray(row.capabilities) || !row.capabilities.every((entry) => typeof entry === "string") ||
    typeof row.manifestHash !== "string" || !HASH.test(row.manifestHash) ||
    typeof row.promptHash !== "string" || !HASH.test(row.promptHash) ||
    typeof row.configHash !== "string" || !HASH.test(row.configHash) ||
    row.adapterKey !== "protected-a3" ||
    typeof row.ownerWallet !== "string" || !WALLET.test(row.ownerWallet) ||
    typeof row.priceAtomic !== "string" || !ATOMIC.test(row.priceAtomic) ||
    row.asset !== "USDC_ATOMIC" || row.proofPolicy !== "verified-receipt-required" ||
    !["DRAFT", "NAME_BOUND", "WRITE_PREPARED", "PUBLISHED"].includes(String(row.lifecycleState)) ||
    typeof row.hireable !== "boolean" || row.ownedByViewer !== true ||
    !nullableString(row.creatorParent) || !nullableString(row.agentLabel) ||
    !nullableString(row.fullSubname) || !nullableString(row.writePlanHash) ||
    !["UNVERIFIED", "CANONICAL", "REFUSED"].includes(String(row.canonicalState)) ||
    !nullableString(row.authorityOwner) || !nullableString(row.authorityDelegate) ||
    !nullableString(row.authorityPolicyVersion) || !nullableString(row.refusalReason) ||
    !nullableString(row.authorityReleaseSha) || !nullableString(row.publicationDecisionId) ||
    !nullableString(row.publishedAt)
  ) {
    throw new Error("KERNEL_LIFECYCLE_RESULT_INVALID");
  }
  if (legacySnapshot) {
    return {
      ...(row as unknown as Omit<AgentLifecycleVersion,
        "manifestSchemaVersion" | "reviewedSources" | "skillSummary" | "mcpSummary" | "mcpAvailability">),
      manifestSchemaVersion: 2,
      riskTiers: null,
      reviewedSources: null,
      skillSummary: null,
      mcpSummary: null,
      mcpAvailability: "NOT_REQUIRED",
    };
  }
  if (v3Snapshot) {
    return {
      ...(row as unknown as Omit<AgentLifecycleVersion, "riskTiers">),
      riskTiers: null,
    };
  }
  if (
    ![1, 2, 3, 4, 5].includes(Number(row.manifestSchemaVersion)) ||
    (row.riskTiers !== null && (
      !Array.isArray(row.riskTiers) || row.riskTiers.length < 1 || row.riskTiers.length > 3 ||
      row.riskTiers.some((tier) => !["LOW", "MID", "HIGH"].includes(String(tier))) ||
      new Set(row.riskTiers).size !== row.riskTiers.length
    )) ||
    ((row.manifestSchemaVersion === 4 || row.manifestSchemaVersion === 5) !== (row.riskTiers !== null)) ||
    (row.reviewedSources !== null && !Array.isArray(row.reviewedSources)) ||
    (row.skillSummary !== null && !Array.isArray(row.skillSummary)) ||
    (row.mcpSummary !== null && !Array.isArray(row.mcpSummary)) ||
    !["AVAILABLE", "UNAVAILABLE", "NOT_REQUIRED"].includes(String(row.mcpAvailability))
  ) {
    throw new Error("KERNEL_LIFECYCLE_RESULT_INVALID");
  }
  return row as unknown as AgentLifecycleVersion;
}

function parseWritePlanSnapshot(value: unknown): AgentEnsWritePlan {
  const row = object(value);
  if (
    !row || !exactKeys(row, [
      "schemaVersion", "kind", "agentVersionId", "manifestHash", "creatorParent",
      "agentLabel", "fullSubname", "creatorDnsName", "agentDnsName", "operations",
      "requiresAuthorization", "requiresWalletSignature",
    ]) || row.schemaVersion !== 1 || row.kind !== "LOCAL_ONLY_UNAUTHORIZED" ||
    typeof row.agentVersionId !== "string" || !UUID.test(row.agentVersionId) ||
    typeof row.manifestHash !== "string" || !HASH.test(row.manifestHash) ||
    typeof row.creatorParent !== "string" || typeof row.agentLabel !== "string" ||
    typeof row.fullSubname !== "string" || typeof row.creatorDnsName !== "string" ||
    typeof row.agentDnsName !== "string" || !Array.isArray(row.operations) ||
    row.operations.length !== 2 || row.operations[0] !== "CREATE_OR_UPDATE_SUBNAME" ||
    row.operations[1] !== "SET_IMMUTABLE_MANIFEST_BINDING" ||
    row.requiresAuthorization !== true || row.requiresWalletSignature !== true
  ) {
    throw new Error("KERNEL_LIFECYCLE_RESULT_INVALID");
  }
  return row as unknown as AgentEnsWritePlan;
}

function successSnapshot(action: LifecycleAction, value: CanonicalValue): CanonicalValue {
  return { schemaVersion: 1, action, outcome: "SUCCESS", value };
}

function denialSnapshot(
  reasonCode: string,
  code: "KERNEL_ENS_AUTHORITY_REQUIRED" | "KERNEL_ENS_AUTHORITY_DENIED",
  message: string,
): CanonicalValue {
  return {
    schemaVersion: 1,
    action: "PUBLISH_VERSION",
    outcome: "DENIED",
    error: { code, message, reasonCode, status: 409 },
  };
}

function storedResult(row: LifecycleActionRow, action: LifecycleAction): unknown {
  const snapshot = object(row.result_snapshot);
  if (
    !snapshot || row.result_hash === null || !HASH.test(row.result_hash) ||
    domainHash("agent-lifecycle-result", snapshot as CanonicalValue) !== row.result_hash ||
    snapshot.schemaVersion !== 1 || snapshot.action !== action ||
    (row.status !== "SUCCEEDED" && row.status !== "DENIED")
  ) {
    throw new Error("KERNEL_LIFECYCLE_RESULT_INVALID");
  }
  if (
    row.status === "SUCCEEDED" && snapshot.outcome === "SUCCESS" &&
    exactKeys(snapshot, ["action", "outcome", "schemaVersion", "value"])
  ) {
    return snapshot.value;
  }
  if (
    row.status === "DENIED" && snapshot.outcome === "DENIED" &&
    exactKeys(snapshot, ["action", "error", "outcome", "schemaVersion"])
  ) {
    const error = object(snapshot.error);
    if (
      !error || !exactKeys(error, ["code", "message", "reasonCode", "status"]) ||
      (error.code !== "KERNEL_ENS_AUTHORITY_REQUIRED" &&
        error.code !== "KERNEL_ENS_AUTHORITY_DENIED") ||
      typeof error.message !== "string" || error.message.length > 160 ||
      error.status !== 409 || typeof error.reasonCode !== "string" ||
      !/^[A-Z][A-Z0-9_]{2,64}$/.test(error.reasonCode) ||
      error.reasonCode !== row.error_code
    ) {
      throw new Error("KERNEL_LIFECYCLE_RESULT_INVALID");
    }
    throw new KernelError(
      error.code as "KERNEL_ENS_AUTHORITY_REQUIRED" | "KERNEL_ENS_AUTHORITY_DENIED",
      error.message,
      error.status,
    );
  }
  throw new Error("KERNEL_LIFECYCLE_RESULT_INVALID");
}

async function claimLifecycleAction(
  tx: DatabaseClient,
  ownerUserId: string,
  action: LifecycleAction,
  idempotencyKey: string,
  payloadHash: string,
  targetVersionId: string | null,
): Promise<LifecycleActionClaim> {
  const leaseToken = randomUUID();
  const inserted = await tx<{ id: string; attempt: number }[]>`
    INSERT INTO agent_lifecycle_actions (
      owner_user_id, action, idempotency_key, payload_hash, target_agent_version_id,
      status, attempt, lease_token, lease_expires_at, created_at, updated_at
    ) VALUES (
      ${ownerUserId}, ${action}, ${idempotencyKey}, ${payloadHash},
      ${targetVersionId}::uuid, 'PENDING', 1, ${leaseToken}::uuid,
      clock_timestamp() + make_interval(secs => ${LIFECYCLE_ACTION_LEASE_SECONDS}),
      clock_timestamp(), clock_timestamp()
    )
    ON CONFLICT (owner_user_id, action, idempotency_key) DO NOTHING
    RETURNING id::text, attempt
  `;
  if (inserted[0]) {
    return { kind: "EXECUTE", actionId: inserted[0].id, attempt: inserted[0].attempt, leaseToken };
  }
  const rows = await tx<LifecycleActionRow[]>`
    SELECT id::text, payload_hash, target_agent_version_id::text,
      agent_version_id::text, status, attempt, lease_token::text, lease_expires_at,
      result_snapshot, result_hash, error_code, completed_at,
      lease_expires_at <= clock_timestamp() AS claimable
    FROM agent_lifecycle_actions
    WHERE owner_user_id = ${ownerUserId} AND action = ${action}
      AND idempotency_key = ${idempotencyKey}
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) throw new Error("KERNEL_LIFECYCLE_ACTION_CLAIM_FAILED");
  if (row.payload_hash !== payloadHash || row.target_agent_version_id !== targetVersionId) {
    throw new KernelError(
      "KERNEL_IDEMPOTENCY_MISMATCH",
      "Idempotency key was already used for different input",
      409,
    );
  }
  if (row.status === "SUCCEEDED" || row.status === "DENIED") {
    return { kind: "TERMINAL", row };
  }
  if (row.claimable) {
    const claimed = await tx<{ id: string; attempt: number }[]>`
      UPDATE agent_lifecycle_actions
      SET status = 'PENDING', attempt = attempt + 1,
          lease_token = ${leaseToken}::uuid,
          lease_expires_at = clock_timestamp() + make_interval(
            secs => ${LIFECYCLE_ACTION_LEASE_SECONDS}
          ),
          error_code = NULL, updated_at = clock_timestamp()
      WHERE id = ${row.id}::uuid AND status IN ('PENDING', 'RETRYABLE')
        AND lease_expires_at <= clock_timestamp()
      RETURNING id::text, attempt
    `;
    if (claimed[0]) {
      return { kind: "EXECUTE", actionId: claimed[0].id, attempt: claimed[0].attempt, leaseToken };
    }
  }
  if (row.status === "RETRYABLE") {
    return { kind: "RETRYABLE", errorCode: row.error_code ?? "ENS_AUTHORITY_RESOLVER_OUTAGE" };
  }
  return { kind: "WAIT" };
}

async function completeLifecycleAction(
  tx: DatabaseClient,
  claim: Extract<LifecycleActionClaim, { kind: "EXECUTE" }>,
  versionId: string,
  snapshot: CanonicalValue,
  outcome: "SUCCEEDED" | "DENIED" = "SUCCEEDED",
  errorCode: string | null = null,
): Promise<string> {
  const resultHash = domainHash("agent-lifecycle-result", snapshot);
  const rows = await tx<{ id: string }[]>`
    UPDATE agent_lifecycle_actions
    SET status = ${outcome}, agent_version_id = ${versionId}::uuid,
        lease_token = NULL, lease_expires_at = NULL,
        result_snapshot = ${tx.json(snapshot)}, result_hash = ${resultHash},
        error_code = ${errorCode}, completed_at = clock_timestamp(),
        updated_at = clock_timestamp()
    WHERE id = ${claim.actionId}::uuid AND status = 'PENDING'
      AND attempt = ${claim.attempt} AND lease_token = ${claim.leaseToken}::uuid
      AND lease_expires_at > clock_timestamp()
    RETURNING id::text
  `;
  if (!rows[0]) throw new Error("KERNEL_LIFECYCLE_ACTION_COMPLETE_FAILED");
  return resultHash;
}

async function markLifecycleActionRetryable(
  sql: DatabaseClient,
  claim: Extract<LifecycleActionClaim, { kind: "EXECUTE" }>,
  errorCode: string,
): Promise<void> {
  await sql`
    UPDATE agent_lifecycle_actions
    SET status = 'RETRYABLE', lease_token = NULL,
        lease_expires_at = clock_timestamp() + make_interval(
          secs => ${LIFECYCLE_ACTION_RETRY_DELAY_MS / 1_000}
        ),
        error_code = ${errorCode}, updated_at = clock_timestamp()
    WHERE id = ${claim.actionId}::uuid AND status = 'PENDING'
      AND attempt = ${claim.attempt} AND lease_token = ${claim.leaseToken}::uuid
  `;
}

async function publicationActionClaim(
  sql: DatabaseClient,
  ownerUserId: string,
  versionId: string,
  idempotencyKey: string,
  payloadHash: string,
): Promise<LifecycleActionClaim> {
  const deadline = Date.now() + PUBLICATION_ACTION_WAIT_MS;
  while (true) {
    const claim = await sql.begin(async (transaction) => claimLifecycleAction(
      transaction as unknown as DatabaseClient,
      ownerUserId,
      "PUBLISH_VERSION",
      idempotencyKey,
      payloadHash,
      versionId,
    )) as LifecycleActionClaim;
    if (claim.kind !== "WAIT") return claim;
    if (Date.now() >= deadline) {
      throw new KernelError("KERNEL_CONFLICT", "Publication attempt is already in progress", 409);
    }
    await delay(PUBLICATION_ACTION_POLL_MS);
  }
}

function mapLifecycle(row: LifecycleRow, viewerUserId: string): AgentLifecycleVersion {
  const catalogManifest = row.manifest.schemaVersion === 3 ||
    row.manifest.schemaVersion === 4 || row.manifest.schemaVersion === 5
    ? row.manifest
    : null;
  const reviewedSources = catalogManifest
    ? catalogManifest.reviewedSources.map((source) => ({
        repository: source.repository,
        revision: source.revision,
        use: source.use,
      }))
    : null;
  const skillSummary = catalogManifest
    ? catalogManifest.skills.map((skill) => ({ id: skill.id, category: skill.category }))
    : null;
  const mcpSummary = catalogManifest
    ? catalogManifest.mcp.map((binding) => ({
        bindingId: binding.id,
        provider: binding.provider,
        capability: binding.capability,
      }))
    : null;
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
    manifestSchemaVersion: row.manifest.schemaVersion,
    riskTiers: row.manifest.schemaVersion === 4 || row.manifest.schemaVersion === 5
      ? row.manifest.riskTiers
      : null,
    reviewedSources,
    skillSummary,
    mcpSummary,
    mcpAvailability: mcpSummary && mcpSummary.length > 0 ? "UNAVAILABLE" : "NOT_REQUIRED",
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

function mapProvenance(row: LifecycleReadRow): AgentVersionProvenance | null {
  const chainId = row.provenance_chain_id;
  const fields = [
    row.provenance_protocol,
    row.provenance_chain_id,
    row.provenance_contract_address,
    row.provenance_token_id,
    row.provenance_evidence_hash,
    row.provenance_observed_at,
  ];
  if (fields.every((field) => field === null)) return null;
  if (
    row.provenance_protocol !== "INFT" ||
    typeof chainId !== "number" || !Number.isInteger(chainId) || chainId < 1 ||
    !row.provenance_contract_address || !/^0x[0-9a-f]{40}$/.test(row.provenance_contract_address) ||
    !row.provenance_token_id || !/^(0|[1-9][0-9]{0,77})$/.test(row.provenance_token_id) ||
    !row.provenance_evidence_hash || !/^[0-9a-f]{64}$/.test(row.provenance_evidence_hash) ||
    !row.provenance_observed_at
  ) {
    throw new Error("KERNEL_AGENT_PROVENANCE_INVALID");
  }
  return {
    protocol: "INFT",
    chainId,
    contractAddress: row.provenance_contract_address,
    tokenId: row.provenance_token_id,
    metadataUri: row.provenance_metadata_uri,
    evidenceHash: row.provenance_evidence_hash,
    observedAt: row.provenance_observed_at.toISOString(),
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

async function assertLifecycleOwner(
  sql: DatabaseClient,
  versionId: string,
  ownerUserId: string,
): Promise<void> {
  const rows = await sql<{ present: number }[]>`
    SELECT 1::int AS present
    FROM agent_versions version
    JOIN kernel_agents agent ON agent.id = version.agent_id
    WHERE version.id = ${versionId}::uuid
      AND agent.owner_user_id = ${ownerUserId}
      AND version.lifecycle_state IS NOT NULL
  `;
  if (!rows[0]) throw new KernelError("KERNEL_NOT_FOUND", "Agent version not found", 404);
}

async function appendLifecycleEvent(
  tx: DatabaseClient,
  versionId: string,
  action: string,
  payload: CanonicalValue,
  now: Date,
  lifecycleActionId: string,
): Promise<void> {
  await tx`
    INSERT INTO agent_version_events (
      agent_version_id, sequence, action, payload, lifecycle_action_id, created_at
    )
    SELECT ${versionId}::uuid, COALESCE(max(sequence), -1) + 1, ${action},
      ${tx.json(payload)}, ${lifecycleActionId}::uuid, ${now}
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
  const hashes = deriveManifestHashes(manifest);
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    const claim = await claimLifecycleAction(
      tx,
      owner.userId,
      "CREATE_DRAFT",
      idempotencyKey,
      payloadHash,
      null,
    );
    if (claim.kind === "TERMINAL") {
      return parseLifecycleVersionSnapshot(storedResult(claim.row, "CREATE_DRAFT"));
    }
    if (claim.kind !== "EXECUTE") {
      throw new KernelError("KERNEL_CONFLICT", "Lifecycle action is already in progress", 409);
    }
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
        ${manifest.adapterKey}, NULL, NULL, ${owner.walletAddress}, ${manifest.payoutAddress},
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
    const result = mapLifecycle(created, owner.userId);
    const snapshot = successSnapshot("CREATE_DRAFT", result as unknown as CanonicalValue);
    const resultHash = domainHash("agent-lifecycle-result", snapshot);
    await appendLifecycleEvent(tx, created.version_id, "CREATE_DRAFT", {
      lifecycleActionId: claim.actionId,
      manifestHash: created.manifest_hash,
      resultHash,
      version: created.version,
    }, now, claim.actionId);
    await completeLifecycleAction(
      tx,
      claim,
      created.version_id,
      snapshot,
    );
    return result;
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
  await assertLifecycleOwner(sql, versionId, ownerUserId);
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    const claim = await claimLifecycleAction(
      tx,
      ownerUserId,
      "BIND_NAME",
      idempotencyKey,
      payloadHash,
      versionId,
    );
    if (claim.kind === "TERMINAL") {
      return parseLifecycleVersionSnapshot(storedResult(claim.row, "BIND_NAME"));
    }
    if (claim.kind !== "EXECUTE") {
      throw new KernelError("KERNEL_CONFLICT", "Lifecycle action is already in progress", 409);
    }
    const current = await loadLifecycle(tx, versionId, ownerUserId, true);
    if (current.lifecycle_state !== "DRAFT") {
      throw new KernelError("KERNEL_IMMUTABLE_VERSION", "Create a new draft version to change this binding", 409);
    }
    const manifest = bindManifestEns(current.manifest, binding);
    const hashes = deriveManifestHashes(manifest);
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
    const result = mapLifecycle(updated, ownerUserId);
    const snapshot = successSnapshot("BIND_NAME", result as unknown as CanonicalValue);
    const resultHash = domainHash("agent-lifecycle-result", snapshot);
    await appendLifecycleEvent(tx, versionId, "BIND_NAME", {
      creatorParent: binding.creatorParent,
      agentLabel: binding.agentLabel,
      fullSubname: binding.fullSubname,
      lifecycleActionId: claim.actionId,
      manifestHash: hashes.manifestHash,
      resultHash,
    }, now, claim.actionId);
    await completeLifecycleAction(
      tx,
      claim,
      versionId,
      snapshot,
    );
    return result;
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
  await assertLifecycleOwner(sql, versionId, ownerUserId);
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    const claim = await claimLifecycleAction(
      tx,
      ownerUserId,
      "PREPARE_ENS_WRITE",
      idempotencyKey,
      payloadHash,
      versionId,
    );
    if (claim.kind === "TERMINAL") {
      const replay = object(storedResult(claim.row, "PREPARE_ENS_WRITE"));
      if (!replay || !exactKeys(replay, ["plan", "planHash", "version"])) {
        throw new Error("KERNEL_LIFECYCLE_RESULT_INVALID");
      }
      const version = parseLifecycleVersionSnapshot(replay.version);
      const plan = parseWritePlanSnapshot(replay.plan);
      if (typeof replay.planHash !== "string" || !HASH.test(replay.planHash)) {
        throw new Error("KERNEL_LIFECYCLE_RESULT_INVALID");
      }
      return { version, plan, planHash: replay.planHash };
    }
    if (claim.kind !== "EXECUTE") {
      throw new KernelError("KERNEL_CONFLICT", "Lifecycle action is already in progress", 409);
    }
    const current = await loadLifecycle(tx, versionId, ownerUserId, true);
    if (current.lifecycle_state !== "NAME_BOUND") {
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
    const result = { version: mapLifecycle(updated, ownerUserId), plan, planHash };
    const snapshot = successSnapshot(
      "PREPARE_ENS_WRITE",
      result as unknown as CanonicalValue,
    );
    const resultHash = domainHash("agent-lifecycle-result", snapshot);
    await appendLifecycleEvent(tx, versionId, "PREPARE_ENS_WRITE", {
      lifecycleActionId: claim.actionId,
      planHash,
      resultHash,
    }, now, claim.actionId);
    await completeLifecycleAction(
      tx,
      claim,
      versionId,
      snapshot,
    );
    return result;
  });
}

function publicationDenial(reasonCode: string): {
  code: "KERNEL_ENS_AUTHORITY_REQUIRED" | "KERNEL_ENS_AUTHORITY_DENIED";
  message: string;
  reasonCode: string;
} {
  const boundedReason = /^[A-Z][A-Z0-9_]{2,64}$/.test(reasonCode)
    ? reasonCode
    : "ENS_PUBLICATION_DENIED";
  return boundedReason === "ENS_PUBLICATION_NOT_CONFIGURED"
    ? {
        code: "KERNEL_ENS_AUTHORITY_REQUIRED",
        message: "Fresh durable A4 publication authority is required",
        reasonCode: boundedReason,
      }
    : {
        code: "KERNEL_ENS_AUTHORITY_DENIED",
        message: "A4 publication authority refused",
        reasonCode: boundedReason,
      };
}

async function completePublicationDenial(
  sql: DatabaseClient,
  claim: Extract<LifecycleActionClaim, { kind: "EXECUTE" }>,
  ownerUserId: string,
  versionId: string,
  reasonCode: string,
  now: Date,
): Promise<KernelError> {
  const denial = publicationDenial(reasonCode);
  const snapshot = denialSnapshot(denial.reasonCode, denial.code, denial.message);
  const resultHash = domainHash("agent-lifecycle-result", snapshot);
  await sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    const current = await loadLifecycle(tx, versionId, ownerUserId, true);
    if (current.lifecycle_state === "PUBLISHED") {
      throw new KernelError("KERNEL_CONFLICT", "Agent version was already published", 409);
    }
    await tx`
      UPDATE agent_versions
      SET canonical_state = 'REFUSED', authority_refusal = ${denial.reasonCode}
      WHERE id = ${versionId}::uuid AND published = false
    `;
    await appendLifecycleEvent(tx, versionId, "PUBLISH_REFUSED", {
      errorCode: denial.reasonCode,
      lifecycleActionId: claim.actionId,
      resultHash,
    }, now, claim.actionId);
    await completeLifecycleAction(
      tx,
      claim,
      versionId,
      snapshot,
      "DENIED",
      denial.reasonCode,
    );
  });
  return new KernelError(denial.code, denial.message, 409);
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
  await assertLifecycleOwner(sql, versionId, ownerUserId);
  const claim = await publicationActionClaim(
    sql,
    ownerUserId,
    versionId,
    idempotencyKey,
    payloadHash,
  );
  if (claim.kind === "TERMINAL") {
    return asPublished(parseLifecycleVersionSnapshot(
      storedResult(claim.row, "PUBLISH_VERSION"),
    ));
  }
  if (claim.kind === "RETRYABLE") {
    throw new KernelError(
      "KERNEL_ENS_AUTHORITY_DENIED",
      "Publication attempt is retryable",
      503,
    );
  }
  if (claim.kind !== "EXECUTE") {
    throw new KernelError("KERNEL_CONFLICT", "Publication attempt is already in progress", 409);
  }
  try {
    const current = await loadLifecycle(sql, versionId, ownerUserId);
    if (current.lifecycle_state !== "WRITE_PREPARED" || !current.write_plan_hash) {
      await markLifecycleActionRetryable(sql, claim, "KERNEL_CONFLICT");
      throw new KernelError("KERNEL_CONFLICT", "Prepare the ENS write before publication", 409);
    }
    if (
      current.manifest.schemaVersion !== 2 && current.manifest.schemaVersion !== 3 &&
      current.manifest.schemaVersion !== 4
    ) {
      throw await completePublicationDenial(
        sql,
        claim,
        ownerUserId,
        versionId,
        "MANIFEST_SCHEMA_V2_OR_V3_REQUIRED",
        now,
      );
    }
  } catch (error) {
    if (error instanceof KernelError) throw error;
    await markLifecycleActionRetryable(sql, claim, "KERNEL_NOT_FOUND");
    throw error;
  }
  if (!options.authority) {
    throw await completePublicationDenial(
      sql,
      claim,
      ownerUserId,
      versionId,
      "ENS_PUBLICATION_NOT_CONFIGURED",
      now,
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
      throw await completePublicationDenial(
        sql,
        claim,
        ownerUserId,
        versionId,
        decision.errorCode ?? "ENS_PUBLICATION_DENIED",
        now,
      );
    }
    decisionId = decision.decisionId;
  } catch (error) {
    if (error instanceof KernelError) throw error;
    const errorCode = error instanceof Error && error.message === "ENS_AUTHORITY_TIMEOUT"
      ? "ENS_AUTHORITY_TIMEOUT"
      : "ENS_AUTHORITY_RESOLVER_OUTAGE";
    await markLifecycleActionRetryable(sql, claim, errorCode);
    throw new KernelError("KERNEL_ENS_AUTHORITY_DENIED", "A4 authority readback failed", 503);
  }
  try {
    return await sql.begin(async (transaction) => {
      const tx = transaction as unknown as DatabaseClient;
      const held = await tx<{ id: string }[]>`
        SELECT id::text
        FROM agent_lifecycle_actions
        WHERE id = ${claim.actionId}::uuid AND status = 'PENDING'
          AND attempt = ${claim.attempt} AND lease_token = ${claim.leaseToken}::uuid
          AND lease_expires_at > clock_timestamp()
        FOR UPDATE
      `;
      if (!held[0]) throw new Error("KERNEL_LIFECYCLE_ACTION_CLAIM_LOST");
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
        lifecycleActionId: claim.actionId,
        manifestHash: locked.manifest_hash,
        policyVersion: decision.policy_version,
        publicationDecisionId: decision.decision_id,
        recordHash: decision.record_hash,
        releaseSha: decision.release_sha,
      };
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
            publication_decision_id = d.id,
            publication_action_id = ${claim.actionId}::uuid
        FROM ens_publication_decisions d
        WHERE v.id = ${versionId}::uuid AND v.lifecycle_state = 'WRITE_PREPARED'
          AND v.manifest->>'schemaVersion' IN ('2', '3', '4')
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
      const result = asPublished(mapLifecycle(published, ownerUserId));
      const snapshot = successSnapshot(
        "PUBLISH_VERSION",
        result as unknown as CanonicalValue,
      );
      const resultHash = domainHash("agent-lifecycle-result", snapshot);
      await appendLifecycleEvent(tx, versionId, "PUBLISH_VERSION", {
        ...eventPayload,
        resultHash,
      }, decision.database_now, claim.actionId);
      await completeLifecycleAction(
        tx,
        claim,
        versionId,
        snapshot,
      );
      return result;
    });
  } catch (error) {
    if (error instanceof KernelError) {
      if (error.code === "KERNEL_ENS_AUTHORITY_DENIED") {
        throw await completePublicationDenial(
          sql,
          claim,
          ownerUserId,
          versionId,
          "ENS_PUBLICATION_DECISION_INVALID",
          now,
        );
      }
      await markLifecycleActionRetryable(sql, claim, error.code);
      throw error;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "23514") {
      throw await completePublicationDenial(
        sql,
        claim,
        ownerUserId,
        versionId,
        "ENS_PUBLICATION_COMMIT_STALE",
        now,
      );
    }
    await markLifecycleActionRetryable(
      sql,
      claim,
      error instanceof Error && /^[A-Z][A-Z0-9_]{2,64}$/.test(error.message)
        ? error.message
        : "KERNEL_PUBLICATION_RETRYABLE",
    );
    throw error;
  }
}

export async function listAgentLifecycle(
  viewerUserId: string,
  options: { filters?: AgentListFilters; sql?: DatabaseClient } = {},
): Promise<{ agents: ProtectedPublishedAgentRead[]; drafts: AgentLifecycleVersion[] }> {
  const sql = options.sql ?? getDb();
  const filters = options.filters ?? {
    capability: null,
    skill: null,
    mcpProvider: null,
    riskTier: null,
    cursor: null,
    limit: 100,
    active: false,
  };
  const rows = await sql<LifecycleReadRow[]>`
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
      v.published_at,
      COALESCE(hires.verified_external_hires, '0') AS verified_external_hires,
      provenance.protocol AS provenance_protocol,
      provenance.chain_id AS provenance_chain_id,
      provenance.contract_address AS provenance_contract_address,
      provenance.token_id AS provenance_token_id,
      provenance.metadata_uri AS provenance_metadata_uri,
      provenance.evidence_hash AS provenance_evidence_hash,
      provenance.observed_at AS provenance_observed_at
    FROM agent_versions v
    JOIN kernel_agents a ON a.id = v.agent_id
    LEFT JOIN agent_version_provenance provenance ON provenance.agent_version_id = v.id
    LEFT JOIN LATERAL (
      SELECT count(*)::text AS verified_external_hires
      FROM jobs job
      JOIN effects effect ON effect.job_id = job.id
      JOIN receipts receipt ON receipt.job_id = job.id AND receipt.effect_id = effect.id
      WHERE job.agent_version_id = v.id
        AND job.buyer_user_id <> a.owner_user_id
        AND job.state = 'SUCCEEDED'
        AND effect.state = 'SUCCEEDED'
        AND effect.result_hash = receipt.result_hash
        AND receipt.verified = true
    ) hires ON true
    WHERE (
      v.lifecycle_state = 'PUBLISHED' AND v.canonical_state = 'CANONICAL'
      AND (${filters.capability}::text IS NULL OR v.capabilities @> ARRAY[${filters.capability}]::text[])
      AND (${filters.skill}::text IS NULL OR v.manifest->'skills' @> jsonb_build_array(jsonb_build_object('id', ${filters.skill}::text)))
      AND (${filters.mcpProvider}::text IS NULL OR v.manifest->'mcp' @> jsonb_build_array(jsonb_build_object('provider', ${filters.mcpProvider}::text)))
      AND (${filters.riskTier}::text IS NULL OR v.manifest->'riskTiers' @> to_jsonb(ARRAY[${filters.riskTier}]::text[]))
      AND (${filters.cursor?.publishedAt ?? null}::timestamptz IS NULL OR
        (v.published_at, v.id) < (${filters.cursor?.publishedAt ?? null}::timestamptz, ${filters.cursor?.versionId ?? null}::uuid))
    ) OR (
      ${filters.active} = false AND a.owner_user_id = ${viewerUserId}
      AND v.lifecycle_state IN ('DRAFT', 'NAME_BOUND', 'WRITE_PREPARED')
    )
    ORDER BY
      CASE WHEN ${filters.active} THEN v.published_at END DESC,
      CASE WHEN ${filters.active} THEN v.id END DESC,
      v.created_at ASC, v.id ASC
    LIMIT ${filters.active ? filters.limit : null}
  `;
  const visible = rows.map((row) => ({ row, value: mapLifecycle(row, viewerUserId) }));
  return {
    agents: visible.filter(({ value }) => value.lifecycleState === "PUBLISHED").map(({ row, value }) => {
      const verifiedExternalHires = Number(row.verified_external_hires);
      if (!Number.isSafeInteger(verifiedExternalHires) || verifiedExternalHires < 0) {
        throw new Error("KERNEL_AGENT_HIRE_COUNT_INVALID");
      }
      return { ...asPublished(value), verifiedExternalHires, provenance: mapProvenance(row) };
    }),
    drafts: visible.filter(({ value }) => value.lifecycleState !== "PUBLISHED").map(({ value }) => value),
  };
}
