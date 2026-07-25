import { canonicalJson, type CanonicalValue } from "../kernel/canonical";
import type { DatabaseClient } from "../kernel/service";
import { currentClaimHeld, type ClaimedJob } from "../worker/store";
import { createHash } from "node:crypto";
import { namehash, normalize, packetToBytes } from "viem/ens";

const ADDRESS = /^0x[0-9a-f]{40}$/;
const HASH = /^[0-9a-f]{64}$/;
const NODE = /^0x[0-9a-f]{64}$/;
const TX_HASH = /^0x[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ATOMIC_AMOUNT = /^(0|[1-9][0-9]{0,77})$/;
const ASCII_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DNS_NAME = /^0x(?:[0-9a-f]{2})+$/;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const RESERVED_AGENT_LABELS = new Set(["admin", "resolver", "root", "www"]);
const DEFAULT_RESOLUTION_TIMEOUT_MS = 5_000;
const MAX_RECORD_BYTES = 131_072;

export const CANONICAL_UNIVERSAL_RESOLVER = "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe";
export const UNIVERSAL_RESOLVER_READINESS_VECTOR = {
  name: "ur.integration-tests.eth",
  address: "0x2222222222222222222222222222222222222222",
} as const;

export interface EnsV2RolePolicy {
  scope: "CONTRACT" | "NAME";
  role: `0x${string}`;
  adminRole: `0x${string}`;
  account: "OWNER" | "DELEGATE";
  expiresAt: string;
}

export interface EnsV2RuntimePolicy {
  creatorCanonicalRegistry: string;
  agentCanonicalRegistry: string | null;
  resolverMode: "EXPLICIT" | "INHERITED";
  ccipGateway: string;
  parentExpiry: string;
  agentExpiry: string;
  roles: EnsV2RolePolicy[];
}

interface EnsV2BoundRole {
  scope: "CONTRACT" | "NAME";
  name: string | null;
  role: `0x${string}`;
  adminRole: `0x${string}`;
  account: string;
  expiresAt: string;
}

interface EnsV2Binding {
  creatorCanonicalRegistry: string;
  agentParentRegistry: string;
  agentCanonicalRegistry: string | null;
  resolverMode: "EXPLICIT" | "INHERITED";
  resolverSuffix: string;
  ccipGateway: string;
  parentExpiry: string;
  agentExpiry: string;
  roles: EnsV2BoundRole[];
}

export type EnsAuthorityOperation =
  | "COMPUTE_SERVICE"
  | "COMPUTE_HEADERS"
  | "COMPUTE_REQUEST"
  | "COMPUTE_SIGNATURE"
  | "STORAGE_WRITE"
  | "STORAGE_READBACK"
  | "ACCEPT_DELIVERY";

export type EnsAuthorityPhase = "PRE_EXECUTION" | "PRE_DELIVERY";

interface EnsAuthorityBindingBase {
  effectId: string;
  jobId: string;
  agentVersionId: string;
  agentVersion: number;
  manifestHash: string;
  capabilities: string[];
  service: string;
  payout: string;
  chainId: number;
  creatorName: string;
  creatorNode: `0x${string}`;
  agentName: string;
  agentNode: `0x${string}`;
  registry: string;
  creatorResolver: string;
  agentResolver: string;
  creatorOwner: string;
  creatorDelegate: string;
  agentOwner: string;
  agentDelegate: string;
  maxAgeSeconds: number;
  policyVersion: string;
}

interface LegacyEnsAuthorityBinding extends EnsAuthorityBindingBase {
  schemaVersion: 1;
}

interface EnsV2AuthorityBinding extends EnsAuthorityBindingBase {
  schemaVersion: 2;
  priceAtomic: string;
  creatorDnsName: `0x${string}`;
  agentLabel: string;
  agentDnsName: `0x${string}`;
  rootRegistry: string;
  universalResolver: string;
  ensv2: EnsV2Binding;
}

export type EnsAuthorityBinding = LegacyEnsAuthorityBinding | EnsV2AuthorityBinding;

export interface EnsAuthorityResolutionRequest {
  binding: EnsAuthorityBinding;
  operation: EnsAuthorityOperation;
  phase: EnsAuthorityPhase;
}

export interface EnsAuthorityResolver {
  resolve(request: EnsAuthorityResolutionRequest, signal: AbortSignal): Promise<unknown>;
}

export interface EnsAuthorityRuntime {
  resolver: EnsAuthorityResolver;
  creatorName: string;
  agentLabel?: string;
  agentName: string;
  chainId: number;
  registry: string;
  creatorResolver: string;
  agentResolver: string;
  maxAgeSeconds: number;
  policyVersion: string;
  ensv2?: EnsV2RuntimePolicy;
  disposableTestClock?: boolean;
  resolutionTimeoutMs?: number;
}

export interface EnsAuthorityCheckResult {
  allowed: boolean;
  checkId: string | null;
  errorCode: string | null;
}

interface AuthorityLineageRow {
  agent_version: number;
  manifest_hash: string;
  capabilities: string[];
  endpoint: string | null;
  adapter_key: string;
  price_atomic: string;
  owner_wallet: string;
  payout_address: string | null;
}

interface ValidatedResolution {
  recordBytes: string;
  recordHash: string;
  chainId: number;
  blockNumber: string;
  blockTimestamp: Date;
  freshUntil: Date;
  transactionHash: string | null;
}

interface ParsedResolution extends ValidatedResolution {
  schemaVersion: 1 | 2;
  authorityRecord: Record<string, unknown>;
  observation: Record<string, unknown>;
}

interface ValidatedRuntimePolicy {
  creatorName: string;
  creatorDnsName: `0x${string}`;
  agentLabel: string;
  agentName: string;
  agentDnsName: `0x${string}`;
  chainId: number;
  registry: string;
  rootRegistry: string;
  universalResolver: string;
  creatorResolver: string;
  agentResolver: string;
  maxAgeSeconds: number;
  policyVersion: string;
  ensv2: EnsV2RuntimePolicy | null;
  disposableTestClock: boolean;
  resolutionTimeoutMs: number;
}

export class EnsAuthorityResolverError extends Error {
  readonly code: "ENS_AUTHORITY_RESOLVER_OUTAGE" | "ENS_AUTHORITY_TIMEOUT";

  constructor(code: "ENS_AUTHORITY_RESOLVER_OUTAGE" | "ENS_AUTHORITY_TIMEOUT") {
    super(code);
    this.name = "EnsAuthorityResolverError";
    this.code = code;
  }
}

class EnsAuthorityValidationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "EnsAuthorityValidationError";
    this.code = code;
  }
}

function transactionClient(transaction: unknown): DatabaseClient {
  return transaction as DatabaseClient;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function clock(supplied?: Date | (() => Date), fixed = false): () => Date {
  if (typeof supplied === "function") return supplied;
  if (!supplied) return () => new Date();
  if (fixed) return () => new Date(supplied.getTime());
  const startedAt = Date.now();
  return () => new Date(supplied.getTime() + Date.now() - startedAt);
}

async function resolveWithTimeout(
  resolver: EnsAuthorityResolver,
  request: EnsAuthorityResolutionRequest,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<unknown> {
  if (signal.aborted) throw signal.reason ?? new Error("ENS_AUTHORITY_ABORTED");
  const controller = new AbortController();
  const abort = (): void => controller.abort(signal.reason ?? new Error("ENS_AUTHORITY_ABORTED"));
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    controller.abort(new EnsAuthorityResolverError("ENS_AUTHORITY_TIMEOUT"));
  }, timeoutMs);
  try {
    return await Promise.race([
      resolver.resolve(request, controller.signal),
      new Promise<never>((_resolve, reject) => {
        if (controller.signal.aborted) {
          reject(controller.signal.reason ?? new Error("ENS_AUTHORITY_ABORTED"));
          return;
        }
        controller.signal.addEventListener("abort", () => {
          reject(controller.signal.reason ?? new Error("ENS_AUTHORITY_ABORTED"));
        }, { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function canonicalValue(value: unknown): CanonicalValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  const object = record(value);
  if (!object) throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  return Object.fromEntries(Object.entries(object).map(([key, entry]) => [key, canonicalValue(entry)]));
}

function address(value: string, code = "ENS_AUTHORITY_POLICY_INVALID"): string {
  const normalized = value.toLowerCase();
  if (!ADDRESS.test(normalized)) throw new EnsAuthorityValidationError(code);
  return normalized;
}

function nonzeroAddress(value: string, code: string): string {
  const normalized = address(value, code);
  if (normalized === ZERO_ADDRESS) throw new EnsAuthorityValidationError(code);
  return normalized;
}

function normalizedName(value: string): string {
  try {
    const normalized = normalize(value);
    if (!normalized || normalized.length > 255) throw new Error("invalid");
    return normalized;
  } catch {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_NAME_INVALID");
  }
}

function dnsEncodeName(value: string): `0x${string}` {
  try {
    const bytes = packetToBytes(value);
    if (bytes.byteLength < 2 || bytes.byteLength > 255) throw new Error("invalid DNS name");
    return `0x${Buffer.from(bytes).toString("hex")}`;
  } catch {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_NAME_INVALID");
  }
}

function supportedAsciiLabel(value: string): boolean {
  return ASCII_LABEL.test(value) && !value.startsWith("xn--") && !value.includes("--[");
}

function prepareNames(runtime: EnsAuthorityRuntime): {
  creatorName: string;
  creatorDnsName: `0x${string}`;
  agentLabel: string;
  agentName: string;
  agentDnsName: `0x${string}`;
} {
  const creatorName = normalizedName(runtime.creatorName);
  if (creatorName.endsWith(".reverse")) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_REVERSE_UNSUPPORTED");
  }
  if (!creatorName.endsWith(".eth")) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_NAMESPACE_UNSUPPORTED");
  }
  const creatorLabels = creatorName.split(".");
  if (creatorLabels.some((label) => !supportedAsciiLabel(label))) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_NAME_UNSUPPORTED");
  }

  const normalizedAgentName = normalizedName(runtime.agentName);
  const suffix = `.${creatorName}`;
  if (!normalizedAgentName.endsWith(suffix)) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_PARENT_MISMATCH");
  }
  const inferredLabel = normalizedAgentName.slice(0, -suffix.length);
  const agentLabel = normalizedName(runtime.agentLabel ?? inferredLabel);
  if (agentLabel.includes(".") || !supportedAsciiLabel(agentLabel)) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_LABEL_UNSUPPORTED");
  }
  if (RESERVED_AGENT_LABELS.has(agentLabel)) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_LABEL_RESERVED");
  }
  const agentName = `${agentLabel}.${creatorName}`;
  if (agentName !== normalizedAgentName) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_NAME_COLLISION");
  }
  return {
    creatorName,
    creatorDnsName: dnsEncodeName(creatorName),
    agentLabel,
    agentName,
    agentDnsName: dnsEncodeName(agentName),
  };
}

function parseDate(value: unknown): Date {
  if (typeof value !== "string") throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  return parsed;
}

function validateRolePolicy(role: EnsV2RolePolicy): EnsV2RolePolicy {
  if (
    !role ||
    (role.scope !== "CONTRACT" && role.scope !== "NAME") ||
    (role.account !== "OWNER" && role.account !== "DELEGATE") ||
    !NODE.test(role.role?.toLowerCase()) ||
    !NODE.test(role.adminRole?.toLowerCase())
  ) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_POLICY_INVALID");
  }
  return {
    scope: role.scope,
    role: role.role.toLowerCase() as `0x${string}`,
    adminRole: role.adminRole.toLowerCase() as `0x${string}`,
    account: role.account,
    expiresAt: parseDate(role.expiresAt).toISOString(),
  };
}

function validateRuntime(runtime: EnsAuthorityRuntime): ValidatedRuntimePolicy {
  const names = prepareNames(runtime);
  if (!Number.isSafeInteger(runtime.chainId) || runtime.chainId < 1) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_POLICY_INVALID");
  }
  if (!Number.isSafeInteger(runtime.maxAgeSeconds) || runtime.maxAgeSeconds < 1 || runtime.maxAgeSeconds > 3600) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_POLICY_INVALID");
  }
  if (!/^[a-z][a-z0-9-]{2,63}$/.test(runtime.policyVersion)) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_POLICY_INVALID");
  }
  const resolutionTimeoutMs = runtime.resolutionTimeoutMs ?? DEFAULT_RESOLUTION_TIMEOUT_MS;
  if (!Number.isSafeInteger(resolutionTimeoutMs) || resolutionTimeoutMs < 10 || resolutionTimeoutMs > 60_000) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_POLICY_INVALID");
  }
  if (runtime.disposableTestClock !== undefined && typeof runtime.disposableTestClock !== "boolean") {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_POLICY_INVALID");
  }
  const registry = nonzeroAddress(runtime.registry, "ENS_AUTHORITY_POLICY_INVALID");
  let ensv2: EnsV2RuntimePolicy | null = null;
  if (runtime.ensv2) {
    if (
      runtime.ensv2.resolverMode !== "EXPLICIT" &&
      runtime.ensv2.resolverMode !== "INHERITED"
    ) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_POLICY_INVALID");
    }
    if (
      typeof runtime.ensv2.ccipGateway !== "string" ||
      runtime.ensv2.ccipGateway.length < 1 ||
      runtime.ensv2.ccipGateway.length > 2_048
    ) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_POLICY_INVALID");
    }
    if (!Array.isArray(runtime.ensv2.roles) || runtime.ensv2.roles.length < 2 || runtime.ensv2.roles.length > 32) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_POLICY_INVALID");
    }
    const roles = runtime.ensv2.roles.map(validateRolePolicy).sort((left, right) => (
      canonicalJson(canonicalValue(left)).localeCompare(canonicalJson(canonicalValue(right)))
    ));
    if (new Set(roles.map((role) => canonicalJson(canonicalValue(role)))).size !== roles.length) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_POLICY_INVALID");
    }
    if (
      !roles.some((role) => role.scope === "CONTRACT") ||
      !roles.some((role) => role.scope === "NAME")
    ) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_POLICY_INVALID");
    }
    ensv2 = {
      creatorCanonicalRegistry: nonzeroAddress(
        runtime.ensv2.creatorCanonicalRegistry,
        "ENS_AUTHORITY_POLICY_INVALID",
      ),
      agentCanonicalRegistry: runtime.ensv2.agentCanonicalRegistry === null
        ? null
        : nonzeroAddress(runtime.ensv2.agentCanonicalRegistry, "ENS_AUTHORITY_POLICY_INVALID"),
      resolverMode: runtime.ensv2.resolverMode,
      ccipGateway: runtime.ensv2.ccipGateway,
      parentExpiry: parseDate(runtime.ensv2.parentExpiry).toISOString(),
      agentExpiry: parseDate(runtime.ensv2.agentExpiry).toISOString(),
      roles,
    };
  }
  return {
    ...names,
    chainId: runtime.chainId,
    registry,
    rootRegistry: registry,
    universalResolver: address(CANONICAL_UNIVERSAL_RESOLVER),
    creatorResolver: address(runtime.creatorResolver),
    agentResolver: address(runtime.agentResolver),
    maxAgeSeconds: runtime.maxAgeSeconds,
    policyVersion: runtime.policyVersion,
    ensv2,
    disposableTestClock: runtime.disposableTestClock ?? false,
    resolutionTimeoutMs,
  };
}

async function deriveBinding(
  tx: DatabaseClient,
  job: ClaimedJob,
  runtime: EnsAuthorityRuntime,
): Promise<EnsAuthorityBinding> {
  const policy = validateRuntime(runtime);
  const rows = await tx<AuthorityLineageRow[]>`
    SELECT
      v.version AS agent_version, v.manifest_hash, v.capabilities,
      v.endpoint, v.adapter_key, v.price_atomic::text, v.owner_wallet, v.payout_address
    FROM jobs j
    JOIN effects e ON e.job_id = j.id AND e.intent_id = j.intent_id
    JOIN agent_versions v ON v.id = j.agent_version_id
    JOIN kernel_agents a ON a.id = v.agent_id
    WHERE j.id = ${job.jobId}::uuid
      AND j.agent_version_id = ${job.agentVersionId}::uuid
      AND j.intent_id = ${job.intentId}::uuid
      AND e.id = ${job.effectId}
      AND a.owner_user_id = ${job.ownerUserId}
      AND v.published = true
      AND v.adapter_key = 'protected-a3'
  `;
  const lineage = rows[0];
  if (!lineage || !HASH.test(lineage.manifest_hash)) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_LINEAGE_MISSING");
  }
  const owner = address(lineage.owner_wallet, "ENS_AUTHORITY_LINEAGE_INVALID");
  const delegate = address(
    lineage.payout_address ?? lineage.owner_wallet,
    "ENS_AUTHORITY_LINEAGE_INVALID",
  );
  const capabilities = [...new Set(lineage.capabilities)].sort();
  if (
    capabilities.length < 1 ||
    capabilities.length > 32 ||
    capabilities.some((capability) => !/^[a-z][a-z0-9-]{0,63}$/.test(capability))
  ) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_LINEAGE_INVALID");
  }
  const service = lineage.endpoint ?? lineage.adapter_key;
  if (service.length < 1 || service.length > 2048) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_LINEAGE_INVALID");
  }
  if (!ATOMIC_AMOUNT.test(lineage.price_atomic) || BigInt(lineage.price_atomic) < 1n) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_LINEAGE_INVALID");
  }
  const legacyBinding: LegacyEnsAuthorityBinding = {
    schemaVersion: 1,
    effectId: job.effectId,
    jobId: job.jobId,
    agentVersionId: job.agentVersionId,
    agentVersion: lineage.agent_version,
    manifestHash: lineage.manifest_hash,
    capabilities,
    service,
    payout: delegate,
    chainId: policy.chainId,
    creatorName: policy.creatorName,
    creatorNode: namehash(policy.creatorName),
    agentName: policy.agentName,
    agentNode: namehash(policy.agentName),
    registry: policy.registry,
    creatorResolver: policy.creatorResolver,
    agentResolver: policy.agentResolver,
    creatorOwner: owner,
    creatorDelegate: delegate,
    agentOwner: owner,
    agentDelegate: delegate,
    maxAgeSeconds: policy.maxAgeSeconds,
    policyVersion: policy.policyVersion,
  };
  if (policy.ensv2 === null) return legacyBinding;
  return {
    ...legacyBinding,
    schemaVersion: 2,
    priceAtomic: lineage.price_atomic,
    creatorDnsName: policy.creatorDnsName,
    agentLabel: policy.agentLabel,
    agentDnsName: policy.agentDnsName,
    rootRegistry: policy.rootRegistry,
    universalResolver: policy.universalResolver,
    ensv2: {
      creatorCanonicalRegistry: policy.ensv2.creatorCanonicalRegistry,
      agentParentRegistry: policy.ensv2.creatorCanonicalRegistry,
      agentCanonicalRegistry: policy.ensv2.agentCanonicalRegistry,
      resolverMode: policy.ensv2.resolverMode,
      resolverSuffix: policy.ensv2.resolverMode === "EXPLICIT" ? policy.agentName : policy.creatorName,
      ccipGateway: policy.ensv2.ccipGateway,
      parentExpiry: policy.ensv2.parentExpiry,
      agentExpiry: policy.ensv2.agentExpiry,
      roles: policy.ensv2.roles.map((role) => ({
        scope: role.scope,
        name: role.scope === "NAME" ? policy.agentName : null,
        role: role.role,
        adminRole: role.adminRole,
        account: role.account === "OWNER" ? owner : delegate,
        expiresAt: role.expiresAt,
      })),
    },
  };
}

async function ensureBinding(
  tx: DatabaseClient,
  job: ClaimedJob,
  runtime: EnsAuthorityRuntime,
  now: Date,
): Promise<{ binding: EnsAuthorityBinding; bindingBytes: string; bindingHash: string }> {
  if (!(await currentClaimHeld(tx, job, now))) throw new Error("ENS_AUTHORITY_CLAIM_LOST");
  const binding = await deriveBinding(tx, job, runtime);
  const bindingBytes = canonicalJson(canonicalValue(binding));
  const bindingHash = sha256(bindingBytes);
  await tx`
    INSERT INTO ens_authority_bindings (
      effect_id, job_id, agent_version_id, binding_bytes, binding_hash,
      creator_name, creator_node, agent_name, agent_node, chain_id,
      registry, creator_resolver, agent_resolver,
      creator_owner, creator_delegate, agent_owner, agent_delegate,
      manifest_hash, capabilities, service, payout, max_age_seconds,
      policy_version, created_at
    ) VALUES (
      ${job.effectId}, ${job.jobId}::uuid, ${job.agentVersionId}::uuid,
      ${bindingBytes}, ${bindingHash}, ${binding.creatorName}, ${binding.creatorNode},
      ${binding.agentName}, ${binding.agentNode}, ${binding.chainId}, ${binding.registry},
      ${binding.creatorResolver}, ${binding.agentResolver}, ${binding.creatorOwner},
      ${binding.creatorDelegate}, ${binding.agentOwner}, ${binding.agentDelegate},
      ${binding.manifestHash}, ${binding.capabilities}, ${binding.service}, ${binding.payout},
      ${binding.maxAgeSeconds}, ${binding.policyVersion}, ${now}
    ) ON CONFLICT (effect_id) DO NOTHING
  `;
  const existing = await tx<{ binding_bytes: string; binding_hash: string }[]>`
    SELECT binding_bytes, binding_hash FROM ens_authority_bindings
    WHERE effect_id = ${job.effectId} AND job_id = ${job.jobId}::uuid
    FOR UPDATE
  `;
  if (existing[0]?.binding_bytes !== bindingBytes || existing[0]?.binding_hash !== bindingHash) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_BINDING_MISMATCH");
  }
  return { binding, bindingBytes, bindingHash };
}

function validateParty(
  value: unknown,
  expected: {
    name: string;
    node: string;
    owner: string;
    delegate: string;
    registry: string;
    resolver: string;
  },
): void {
  const party = record(value);
  if (!party || !exactKeys(party, ["delegate", "name", "node", "owner", "registry", "resolver"])) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  if (party.name !== expected.name) throw new EnsAuthorityValidationError("ENS_AUTHORITY_NAME_MISMATCH");
  if (party.node !== expected.node || typeof party.node !== "string" || !NODE.test(party.node)) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_NODE_MISMATCH");
  }
  if (
    typeof party.registry !== "string" ||
    address(party.registry, "ENS_AUTHORITY_REGISTRY_MISMATCH") !== expected.registry
  ) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_REGISTRY_MISMATCH");
  }
  if (
    typeof party.resolver !== "string" ||
    address(party.resolver, "ENS_AUTHORITY_RESOLVER_MISMATCH") !== expected.resolver
  ) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_RESOLVER_MISMATCH");
  }
  if (
    typeof party.owner !== "string" ||
    address(party.owner, "ENS_AUTHORITY_OWNER_MISMATCH") !== expected.owner
  ) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_OWNER_MISMATCH");
  }
  if (
    typeof party.delegate !== "string" ||
    address(party.delegate, "ENS_AUTHORITY_DELEGATE_MISMATCH") !== expected.delegate
  ) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_DELEGATE_MISMATCH");
  }
}

function parseObservedParty(value: unknown): void {
  const party = record(value);
  if (!party || !exactKeys(party, ["delegate", "name", "node", "owner", "registry", "resolver"])) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  if (typeof party.name !== "string" || party.name.length > 255) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  try {
    if (normalize(party.name) !== party.name) throw new Error("non-canonical name");
  } catch {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  if (typeof party.node !== "string" || !NODE.test(party.node)) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  for (const key of ["delegate", "owner", "registry", "resolver"] as const) {
    if (typeof party[key] !== "string" || !ADDRESS.test(party[key].toLowerCase())) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
    }
  }
}

function parseRoleEvidence(value: unknown): EnsV2BoundRole {
  const role = record(value);
  if (!role || !exactKeys(role, ["account", "adminRole", "expiresAt", "name", "role", "scope"])) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  if (
    role.scope !== "CONTRACT" && role.scope !== "NAME" ||
    role.scope === "CONTRACT" && role.name !== null ||
    role.scope === "NAME" && typeof role.name !== "string" ||
    typeof role.role !== "string" || !NODE.test(role.role.toLowerCase()) ||
    typeof role.adminRole !== "string" || !NODE.test(role.adminRole.toLowerCase()) ||
    typeof role.account !== "string" || !ADDRESS.test(role.account.toLowerCase())
  ) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  const name = role.name === null ? null : normalizedName(role.name as string);
  return {
    scope: role.scope as "CONTRACT" | "NAME",
    name,
    role: role.role.toLowerCase() as `0x${string}`,
    adminRole: role.adminRole.toLowerCase() as `0x${string}`,
    account: role.account.toLowerCase(),
    expiresAt: parseDate(role.expiresAt).toISOString(),
  };
}

function parseEnsV2Evidence(value: unknown): {
  creatorCanonicalRegistry: string;
  agentParentRegistry: string;
  agentCanonicalRegistry: string | null;
  owner: string;
  delegate: string;
  roles: EnsV2BoundRole[];
  externalGrants: EnsV2BoundRole[];
  parentExpiry: string;
  agentExpiry: string;
  parentLink: { parentName: string; childName: string; forward: boolean; back: boolean };
  alias: boolean;
  resolver: { address: string; suffix: string; mode: "EXPLICIT" | "INHERITED" };
  ccip: {
    universalResolver: string;
    gateway: string;
    status: "VERIFIED" | "FAILED";
    responseHash: string;
  };
} {
  const hierarchy = record(value);
  if (!hierarchy || !exactKeys(hierarchy, [
    "agentCanonicalRegistry",
    "agentExpiry",
    "agentParentRegistry",
    "alias",
    "ccip",
    "creatorCanonicalRegistry",
    "delegate",
    "externalGrants",
    "owner",
    "parentExpiry",
    "parentLink",
    "resolver",
    "roles",
  ])) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  if (
    typeof hierarchy.creatorCanonicalRegistry !== "string" ||
    typeof hierarchy.agentParentRegistry !== "string" ||
    hierarchy.agentCanonicalRegistry !== null && typeof hierarchy.agentCanonicalRegistry !== "string" ||
    typeof hierarchy.owner !== "string" ||
    typeof hierarchy.delegate !== "string" ||
    typeof hierarchy.alias !== "boolean" ||
    !Array.isArray(hierarchy.roles) ||
    !Array.isArray(hierarchy.externalGrants)
  ) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  const parentLink = record(hierarchy.parentLink);
  const resolver = record(hierarchy.resolver);
  const ccip = record(hierarchy.ccip);
  if (
    !parentLink || !exactKeys(parentLink, ["back", "childName", "forward", "parentName"]) ||
    typeof parentLink.parentName !== "string" || typeof parentLink.childName !== "string" ||
    typeof parentLink.forward !== "boolean" || typeof parentLink.back !== "boolean" ||
    !resolver || !exactKeys(resolver, ["address", "mode", "suffix"]) ||
    typeof resolver.address !== "string" || typeof resolver.suffix !== "string" ||
    resolver.mode !== "EXPLICIT" && resolver.mode !== "INHERITED" ||
    !ccip || !exactKeys(ccip, ["gateway", "responseHash", "status", "universalResolver"]) ||
    typeof ccip.universalResolver !== "string" || typeof ccip.gateway !== "string" ||
    ccip.gateway.length < 1 || ccip.gateway.length > 2_048 ||
    ccip.status !== "VERIFIED" && ccip.status !== "FAILED" ||
    typeof ccip.responseHash !== "string" || !HASH.test(ccip.responseHash)
  ) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  return {
    creatorCanonicalRegistry: address(hierarchy.creatorCanonicalRegistry, "ENS_AUTHORITY_MALFORMED"),
    agentParentRegistry: address(hierarchy.agentParentRegistry, "ENS_AUTHORITY_MALFORMED"),
    agentCanonicalRegistry: hierarchy.agentCanonicalRegistry === null
      ? null
      : address(hierarchy.agentCanonicalRegistry, "ENS_AUTHORITY_MALFORMED"),
    owner: address(hierarchy.owner, "ENS_AUTHORITY_MALFORMED"),
    delegate: address(hierarchy.delegate, "ENS_AUTHORITY_MALFORMED"),
    roles: hierarchy.roles.map(parseRoleEvidence),
    externalGrants: hierarchy.externalGrants.map(parseRoleEvidence),
    parentExpiry: parseDate(hierarchy.parentExpiry).toISOString(),
    agentExpiry: parseDate(hierarchy.agentExpiry).toISOString(),
    parentLink: {
      parentName: normalizedName(parentLink.parentName),
      childName: normalizedName(parentLink.childName),
      forward: parentLink.forward,
      back: parentLink.back,
    },
    alias: hierarchy.alias,
    resolver: {
      address: address(resolver.address, "ENS_AUTHORITY_MALFORMED"),
      suffix: normalizedName(resolver.suffix),
      mode: resolver.mode,
    },
    ccip: {
      universalResolver: address(ccip.universalResolver, "ENS_AUTHORITY_MALFORMED"),
      gateway: ccip.gateway,
      status: ccip.status,
      responseHash: ccip.responseHash,
    },
  };
}

function parseResolution(value: unknown): ParsedResolution {
  const response = record(value);
  if (
    !response ||
    !exactKeys(response, ["observation", "record", "schemaVersion"]) ||
    response.schemaVersion !== 1 && response.schemaVersion !== 2
  ) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  const observation = record(response.observation);
  const authorityRecord = record(response.record);
  if (
    !observation ||
    !authorityRecord ||
    authorityRecord.schemaVersion !== response.schemaVersion ||
    !exactKeys(observation, ["blockNumber", "blockTimestamp", "chainId", "transactionHash"]) ||
    !(authorityRecord.schemaVersion === 1
      ? exactKeys(authorityRecord, [
      "agent",
      "agentVersion",
      "agentVersionId",
      "capabilities",
      "chainId",
      "creator",
      "effectId",
      "freshUntil",
      "jobId",
      "manifestHash",
      "payout",
      "policyVersion",
      "schemaVersion",
      "service",
      ])
      : authorityRecord.schemaVersion === 2 && exactKeys(authorityRecord, [
        "agent",
        "agentDnsName",
        "agentLabel",
        "agentVersion",
        "agentVersionId",
        "capabilities",
        "chainId",
        "creator",
        "creatorDnsName",
        "effectId",
        "ensv2",
        "freshUntil",
        "jobId",
        "manifestHash",
        "payout",
        "policyVersion",
        "priceAtomic",
        "rootRegistry",
        "schemaVersion",
        "service",
        "universalResolver",
      ]))
  ) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  parseObservedParty(authorityRecord.creator);
  parseObservedParty(authorityRecord.agent);
  if (
    typeof authorityRecord.agentVersionId !== "string" || !UUID.test(authorityRecord.agentVersionId) ||
    !Number.isSafeInteger(authorityRecord.agentVersion) || (authorityRecord.agentVersion as number) < 1 ||
    typeof authorityRecord.manifestHash !== "string" || !HASH.test(authorityRecord.manifestHash) ||
    !Array.isArray(authorityRecord.capabilities) || authorityRecord.capabilities.length < 1 ||
    authorityRecord.capabilities.length > 32 || authorityRecord.capabilities.some(
      (capability) => typeof capability !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(capability),
    ) ||
    typeof authorityRecord.service !== "string" || authorityRecord.service.length < 1 ||
    Buffer.byteLength(authorityRecord.service, "utf8") > 2_048 ||
    !Number.isSafeInteger(authorityRecord.chainId) || (authorityRecord.chainId as number) < 1 ||
    typeof authorityRecord.payout !== "string" || !ADDRESS.test(authorityRecord.payout.toLowerCase()) ||
    typeof authorityRecord.policyVersion !== "string" ||
    !/^[a-z][a-z0-9-]{2,63}$/.test(authorityRecord.policyVersion) ||
    typeof authorityRecord.jobId !== "string" || !UUID.test(authorityRecord.jobId) ||
    typeof authorityRecord.effectId !== "string" || !HASH.test(authorityRecord.effectId)
  ) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  if (authorityRecord.schemaVersion === 2) {
    if (
      typeof authorityRecord.creatorDnsName !== "string" || !DNS_NAME.test(authorityRecord.creatorDnsName) ||
      typeof authorityRecord.agentDnsName !== "string" || !DNS_NAME.test(authorityRecord.agentDnsName) ||
      typeof authorityRecord.agentLabel !== "string" || !supportedAsciiLabel(authorityRecord.agentLabel) ||
      typeof authorityRecord.priceAtomic !== "string" || !ATOMIC_AMOUNT.test(authorityRecord.priceAtomic) ||
      typeof authorityRecord.rootRegistry !== "string" || !ADDRESS.test(authorityRecord.rootRegistry.toLowerCase()) ||
      typeof authorityRecord.universalResolver !== "string" ||
      !ADDRESS.test(authorityRecord.universalResolver.toLowerCase())
    ) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
    }
    parseEnsV2Evidence(authorityRecord.ensv2);
  }
  if (
    !Number.isSafeInteger(observation.chainId) || (observation.chainId as number) < 1 ||
    typeof observation.blockNumber !== "string" || !/^[1-9][0-9]{0,19}$/.test(observation.blockNumber) ||
    observation.transactionHash !== null && (
      typeof observation.transactionHash !== "string" || !TX_HASH.test(observation.transactionHash)
    )
  ) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  const blockTimestamp = parseDate(observation.blockTimestamp);
  const freshUntil = parseDate(authorityRecord.freshUntil);
  const recordBytes = canonicalJson(canonicalValue(authorityRecord));
  if (Buffer.byteLength(recordBytes, "utf8") > MAX_RECORD_BYTES) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MALFORMED");
  }
  return {
    schemaVersion: authorityRecord.schemaVersion as 1 | 2,
    authorityRecord,
    observation,
    recordBytes,
    recordHash: sha256(recordBytes),
    chainId: observation.chainId as number,
    blockNumber: observation.blockNumber,
    blockTimestamp,
    freshUntil,
    transactionHash: observation.transactionHash as string | null,
  };
}

function validateResolution(
  parsed: ParsedResolution,
  binding: EnsAuthorityBinding,
  now: Date,
): ValidatedResolution {
  const { authorityRecord, observation } = parsed;
  validateParty(authorityRecord.creator, {
    name: binding.creatorName,
    node: binding.creatorNode,
    owner: binding.creatorOwner,
    delegate: binding.creatorDelegate,
    registry: binding.registry,
    resolver: binding.creatorResolver,
  });
  validateParty(authorityRecord.agent, {
    name: binding.agentName,
    node: binding.agentNode,
    owner: binding.agentOwner,
    delegate: binding.agentDelegate,
    registry: binding.registry,
    resolver: binding.agentResolver,
  });
  if (authorityRecord.agentVersionId !== binding.agentVersionId || authorityRecord.agentVersion !== binding.agentVersion) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_VERSION_MISMATCH");
  }
  if (authorityRecord.manifestHash !== binding.manifestHash) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_MANIFEST_MISMATCH");
  }
  if (
    !Array.isArray(authorityRecord.capabilities) ||
    canonicalJson(canonicalValue(authorityRecord.capabilities)) !== canonicalJson(binding.capabilities)
  ) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_CAPABILITY_MISMATCH");
  }
  if (authorityRecord.service !== binding.service) throw new EnsAuthorityValidationError("ENS_AUTHORITY_SERVICE_MISMATCH");
  if (authorityRecord.payout !== binding.payout) throw new EnsAuthorityValidationError("ENS_AUTHORITY_PAYOUT_MISMATCH");
  if (authorityRecord.policyVersion !== binding.policyVersion) throw new EnsAuthorityValidationError("ENS_AUTHORITY_POLICY_MISMATCH");
  if (authorityRecord.jobId !== binding.jobId) throw new EnsAuthorityValidationError("ENS_AUTHORITY_JOB_MISMATCH");
  if (authorityRecord.effectId !== binding.effectId) throw new EnsAuthorityValidationError("ENS_AUTHORITY_EFFECT_MISMATCH");
  if (authorityRecord.chainId !== binding.chainId || observation.chainId !== binding.chainId) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_CHAIN_MISMATCH");
  }
  if (binding.schemaVersion === 1) {
    if (parsed.schemaVersion !== 1) throw new EnsAuthorityValidationError("ENS_AUTHORITY_POLICY_MISMATCH");
  } else {
    if (parsed.schemaVersion !== 2) throw new EnsAuthorityValidationError("ENS_AUTHORITY_HIERARCHY_MISSING");
    if (authorityRecord.priceAtomic !== binding.priceAtomic) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_PRICE_MISMATCH");
    }
    if (
      authorityRecord.creatorDnsName !== binding.creatorDnsName ||
      authorityRecord.agentDnsName !== binding.agentDnsName ||
      authorityRecord.agentLabel !== binding.agentLabel
    ) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_NAME_MISMATCH");
    }
    if (
      typeof authorityRecord.rootRegistry !== "string" ||
      address(authorityRecord.rootRegistry, "ENS_AUTHORITY_ROOT_MISMATCH") !== binding.rootRegistry
    ) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_ROOT_MISMATCH");
    }
    if (
      typeof authorityRecord.universalResolver !== "string" ||
      address(authorityRecord.universalResolver, "ENS_AUTHORITY_UNIVERSAL_RESOLVER_MISMATCH") !==
        binding.universalResolver
    ) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_UNIVERSAL_RESOLVER_MISMATCH");
    }
    const hierarchy = parseEnsV2Evidence(authorityRecord.ensv2);
    if (hierarchy.creatorCanonicalRegistry === ZERO_ADDRESS) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_CREATOR_REGISTRY_MISSING");
    }
    if (hierarchy.creatorCanonicalRegistry !== binding.ensv2.creatorCanonicalRegistry) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_CREATOR_REGISTRY_MISMATCH");
    }
    if (hierarchy.agentParentRegistry !== hierarchy.creatorCanonicalRegistry) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_PARENT_REGISTRY_MISMATCH");
    }
    if (hierarchy.agentParentRegistry !== binding.ensv2.agentParentRegistry) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_PARENT_REGISTRY_MISMATCH");
    }
    if (
      hierarchy.agentCanonicalRegistry === ZERO_ADDRESS ||
      hierarchy.agentCanonicalRegistry !== binding.ensv2.agentCanonicalRegistry
    ) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_AGENT_REGISTRY_MISMATCH");
    }
    if (hierarchy.owner !== binding.agentOwner && hierarchy.owner !== binding.agentDelegate) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_OWNER_MISMATCH");
    }
    if (hierarchy.delegate !== binding.agentDelegate) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_DELEGATE_MISMATCH");
    }
    const actualRoles = [...hierarchy.roles].sort((left, right) => (
      canonicalJson(canonicalValue(left)).localeCompare(canonicalJson(canonicalValue(right)))
    ));
    if (
      canonicalJson(canonicalValue(actualRoles)) !== canonicalJson(canonicalValue(binding.ensv2.roles))
    ) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_ROLE_MISMATCH");
    }
    if (hierarchy.externalGrants.length > 0) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_EXTERNAL_GRANT");
    }
    if (
      hierarchy.parentExpiry !== binding.ensv2.parentExpiry ||
      hierarchy.agentExpiry !== binding.ensv2.agentExpiry ||
      parseDate(hierarchy.parentExpiry) <= now ||
      parseDate(hierarchy.agentExpiry) <= now ||
      actualRoles.some((role) => parseDate(role.expiresAt) <= now)
    ) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_EXPIRED");
    }
    if (
      hierarchy.parentLink.parentName !== binding.creatorName ||
      hierarchy.parentLink.childName !== binding.agentName ||
      !hierarchy.parentLink.forward ||
      !hierarchy.parentLink.back
    ) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_PARENT_LINK_MISMATCH");
    }
    if (hierarchy.alias) throw new EnsAuthorityValidationError("ENS_AUTHORITY_ALIAS");
    if (
      hierarchy.resolver.address !== binding.agentResolver ||
      hierarchy.resolver.suffix !== binding.ensv2.resolverSuffix ||
      hierarchy.resolver.mode !== binding.ensv2.resolverMode
    ) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_RESOLVER_POLICY_MISMATCH");
    }
    if (
      hierarchy.ccip.universalResolver !== binding.universalResolver ||
      hierarchy.ccip.gateway !== binding.ensv2.ccipGateway ||
      hierarchy.ccip.status !== "VERIFIED"
    ) {
      throw new EnsAuthorityValidationError("ENS_AUTHORITY_CCIP_FAILURE");
    }
  }
  const maxAgeMs = binding.maxAgeSeconds * 1_000;
  if (
    parsed.blockTimestamp > now ||
    now.getTime() - parsed.blockTimestamp.getTime() > maxAgeMs ||
    parsed.freshUntil <= now ||
    parsed.freshUntil.getTime() - parsed.blockTimestamp.getTime() > maxAgeMs
  ) {
    throw new EnsAuthorityValidationError("ENS_AUTHORITY_STALE");
  }
  return parsed;
}

async function persistCheck(
  sql: DatabaseClient,
  job: ClaimedJob,
  bindingHash: string,
  phase: EnsAuthorityPhase,
  operation: EnsAuthorityOperation,
  now: Date,
  resolution: ValidatedResolution | null,
  errorCode: string | null,
  disposableTestClock: boolean,
): Promise<string> {
  return sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    if (!(await currentClaimHeld(tx, job, now))) throw new Error("ENS_AUTHORITY_CLAIM_LOST");
    const claims = await tx<{ lease_expires_at: Date }[]>`
      SELECT lease_expires_at FROM jobs
      WHERE id = ${job.jobId}::uuid AND state = 'RUNNING'
        AND version = ${job.claimVersion} AND lease_owner = ${job.leaseOwner}
      FOR UPDATE
    `;
    const claimExpiresAt = claims[0]?.lease_expires_at;
    if (!claimExpiresAt) throw new Error("ENS_AUTHORITY_CLAIM_LOST");
    const rows = await tx<{ id: string }[]>`
      INSERT INTO ens_authority_checks (
        effect_id, job_id, agent_version_id, binding_hash, phase, operation,
        decision, error_code, record_bytes, record_hash, chain_id, block_number,
        block_timestamp, observed_at, fresh_until, transaction_hash,
        lease_owner, worker_epoch, claim_version, claim_expires_at,
        disposable_test_clock, created_at
      ) VALUES (
        ${job.effectId}, ${job.jobId}::uuid, ${job.agentVersionId}::uuid, ${bindingHash},
        ${phase}, ${operation}, ${errorCode ? "DENY" : "ALLOW"}, ${errorCode},
        ${resolution?.recordBytes ?? null}, ${resolution?.recordHash ?? null},
        ${resolution?.chainId ?? null}, ${resolution?.blockNumber ?? null}::numeric,
        ${resolution?.blockTimestamp ?? null}, ${now}, ${resolution?.freshUntil ?? null},
        ${resolution?.transactionHash ?? null}, ${job.leaseOwner}, ${job.workerEpoch}::bigint,
        ${job.claimVersion}, ${claimExpiresAt}, ${disposableTestClock}, ${now}
      ) RETURNING id::text
    `;
    const id = rows[0]?.id;
    if (!id) throw new Error("ENS_AUTHORITY_CHECK_PERSIST_FAILED");
    return id;
  }) as Promise<string>;
}

export async function checkFreshEnsAuthority(
  job: ClaimedJob,
  runtime: EnsAuthorityRuntime,
  phase: EnsAuthorityPhase,
  operation: EnsAuthorityOperation,
  options: { now?: Date | (() => Date); sql: DatabaseClient; signal: AbortSignal },
): Promise<EnsAuthorityCheckResult> {
  const currentTime = clock(options.now, runtime.disposableTestClock === true);
  const preparedAt = currentTime();
  let prepared: { binding: EnsAuthorityBinding; bindingHash: string };
  let policy: ValidatedRuntimePolicy;
  try {
    policy = validateRuntime(runtime);
    prepared = await options.sql.begin(async (transaction) => {
      const tx = transactionClient(transaction);
      const ensured = await ensureBinding(tx, job, runtime, preparedAt);
      return { binding: ensured.binding, bindingHash: ensured.bindingHash };
    }) as { binding: EnsAuthorityBinding; bindingHash: string };
  } catch (error) {
    if (error instanceof EnsAuthorityValidationError) {
      return { allowed: false, checkId: null, errorCode: error.code };
    }
    throw error;
  }

  let resolution: ValidatedResolution | null = null;
  let errorCode: string | null = null;
  let observedAt = preparedAt;
  try {
    const raw = await resolveWithTimeout(
      runtime.resolver,
      { binding: prepared.binding, operation, phase },
      options.signal,
      policy.resolutionTimeoutMs ?? DEFAULT_RESOLUTION_TIMEOUT_MS,
    );
    observedAt = currentTime();
    if (options.signal.aborted) throw options.signal.reason ?? new Error("ENS_AUTHORITY_ABORTED");
    const parsed = parseResolution(raw);
    resolution = parsed;
    validateResolution(parsed, prepared.binding, observedAt);
  } catch (error) {
    observedAt = currentTime();
    if (options.signal.aborted) throw options.signal.reason ?? error;
    errorCode = error instanceof EnsAuthorityValidationError || error instanceof EnsAuthorityResolverError
      ? error.code
      : "ENS_AUTHORITY_RESOLVER_OUTAGE";
  }
  const checkId = await persistCheck(
    options.sql,
    job,
    prepared.bindingHash,
    phase,
    operation,
    observedAt,
    resolution,
    errorCode,
    policy.disposableTestClock === true,
  );
  return { allowed: errorCode === null, checkId, errorCode };
}
