import { canonicalJson, domainHash, type CanonicalValue } from "./canonical";
import { isMcpBindingAllowlisted } from "./agent-catalog";
import { KERNEL_QUOTE_TTL_MS } from "./policy";
import type { DatabaseClient } from "./service";
import type {
  McpBindingV1,
  McpEvidenceV1,
  McpProviderId,
  McpSourceMetadataV1,
} from "./types";

export const MAX_MCP_CALLS_PER_JOB = 4;
export const MCP_CALL_TIMEOUT_MS = 8_000;
export const MCP_MAX_RESPONSE_BYTES = 32 * 1024;

const SENSITIVE_KEY = /(?:authorization|cookie|credential|secret|password|session|signature|link.?code|api.?key|private.?key|email|phone)/i;
const SENSITIVE_VALUE = /(?:\bBearer\s+|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|(?:session|signature|link.?code|api.?key)\s*[:=])/i;
const ERROR_CODE = /^[A-Z][A-Z0-9_]{2,64}$/;
const GRAPH_SUBGRAPH_IDS = new Set([
  "8e4dRt4P4WHXnKbEq7STaQfU2g99WZ5S4w39f2PcUTjD",
  "AXJd5my1nV3MMeoX2FPoxnE7hqqDHiSYEazARyd4xLMj",
]);
const GRAPH_DEPLOYMENT_ID = /^[A-Za-z0-9]{20,128}$/;
const GRAPH_BLOCK_NUMBER = /^[1-9][0-9]*$/;
const GRAPH_BLOCK_HASH = /^0x[0-9a-f]{64}$/;

interface InvocationRow {
  id: string;
  binding_id: string;
  provider: McpBindingV1["provider"];
  capability: McpBindingV1["capability"];
  request_hash: string;
  response_hash: string | null;
  context_hash: string | null;
  normalized_response: unknown;
  response_bytes: number;
  state: "SUCCEEDED" | "FAILED";
  error_code: string | null;
  release_sha: string;
  completed_at: Date;
}

export interface McpContextProvider {
  invoke(
    binding: McpBindingV1,
    request: Readonly<{
      schemaVersion: 1;
      objective: string;
      requiredCapabilities: readonly string[];
    }>,
    signal: AbortSignal,
  ): Promise<unknown>;
}

export class McpContextError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "McpContextError";
    this.code = code;
  }
}

function normalizeResponse(value: unknown, depth = 0): CanonicalValue {
  if (depth > 8) throw new McpContextError("GOAL_MCP_RESPONSE_MALFORMED");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new McpContextError("GOAL_MCP_RESPONSE_MALFORMED");
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === "string") {
    if (value.length > 4_096 || SENSITIVE_VALUE.test(value)) {
      throw new McpContextError("GOAL_MCP_RESPONSE_MALFORMED");
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 100) throw new McpContextError("GOAL_MCP_RESPONSE_MALFORMED");
    return value.map((entry) => normalizeResponse(entry, depth + 1));
  }
  if (typeof value !== "object") throw new McpContextError("GOAL_MCP_RESPONSE_MALFORMED");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new McpContextError("GOAL_MCP_RESPONSE_MALFORMED");
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 100) throw new McpContextError("GOAL_MCP_RESPONSE_MALFORMED");
  const normalized: Record<string, CanonicalValue> = {};
  for (const [key, entry] of entries) {
    if (key.length < 1 || key.length > 64 || SENSITIVE_KEY.test(key)) {
      throw new McpContextError("GOAL_MCP_RESPONSE_MALFORMED");
    }
    normalized[key] = normalizeResponse(entry, depth + 1);
  }
  return normalized;
}

export function projectMcpSourceMetadata(
  value: unknown,
  invocationCompletedAt: Date,
  provider?: McpProviderId,
): McpSourceMetadataV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = (value as Record<string, unknown>).sourceMetadata;
  if (source === undefined) return null;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new McpContextError("GOAL_MCP_RESPONSE_MALFORMED");
  }
  const metadata = source as Record<string, unknown>;
  const keys = Object.keys(metadata).sort();
  const expected = [
    "blockHash", "blockNumber", "completedAt", "deploymentId", "network", "subgraphId",
  ];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new McpContextError("GOAL_MCP_RESPONSE_MALFORMED");
  }
  if (
    (provider !== undefined && provider !== "the-graph") ||
    typeof metadata.subgraphId !== "string" || !GRAPH_SUBGRAPH_IDS.has(metadata.subgraphId) ||
    typeof metadata.deploymentId !== "string" || !GRAPH_DEPLOYMENT_ID.test(metadata.deploymentId) ||
    metadata.network !== "mainnet" ||
    typeof metadata.blockNumber !== "string" || !GRAPH_BLOCK_NUMBER.test(metadata.blockNumber) ||
    typeof metadata.blockHash !== "string" || !GRAPH_BLOCK_HASH.test(metadata.blockHash) ||
    /^0x0{64}$/.test(metadata.blockHash) ||
    typeof metadata.completedAt !== "string"
  ) {
    throw new McpContextError("GOAL_MCP_RESPONSE_MALFORMED");
  }
  const completedAt = new Date(metadata.completedAt);
  if (!Number.isFinite(completedAt.getTime()) || completedAt.toISOString() !== metadata.completedAt ||
    completedAt.getTime() !== invocationCompletedAt.getTime()) {
    throw new McpContextError("GOAL_MCP_RESPONSE_MALFORMED");
  }
  return {
    subgraphId: metadata.subgraphId,
    deploymentId: metadata.deploymentId,
    network: "mainnet",
    blockNumber: metadata.blockNumber,
    blockHash: metadata.blockHash,
    completedAt: metadata.completedAt,
  };
}

function admittedSourceMetadata(
  value: unknown,
  provider: McpProviderId,
  startedAt: Date,
  admittedAt: Date,
): McpSourceMetadataV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    !Object.hasOwn(value, "sourceMetadata")) return null;
  const source = (value as Record<string, unknown>).sourceMetadata;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    throw new McpContextError("GOAL_MCP_RESPONSE_MALFORMED");
  }
  const completedAtValue = (source as Record<string, unknown>).completedAt;
  if (typeof completedAtValue !== "string") {
    throw new McpContextError("GOAL_MCP_RESPONSE_MALFORMED");
  }
  const completedAt = new Date(completedAtValue);
  if (!Number.isFinite(completedAt.getTime()) || completedAt.toISOString() !== completedAtValue ||
    completedAt < startedAt || completedAt > admittedAt ||
    admittedAt.getTime() - completedAt.getTime() > KERNEL_QUOTE_TTL_MS) {
    throw new McpContextError("GOAL_MCP_CONTEXT_STALE");
  }
  return projectMcpSourceMetadata(value, completedAt, provider);
}

function evidence(row: InvocationRow, admittedAt?: Date): McpEvidenceV1 {
  const sourceMetadata = projectMcpSourceMetadata(
    row.normalized_response,
    row.completed_at,
    row.provider,
  );
  if (sourceMetadata && admittedAt && (
    row.completed_at > admittedAt ||
    admittedAt.getTime() - row.completed_at.getTime() > KERNEL_QUOTE_TTL_MS
  )) {
    throw new McpContextError("GOAL_MCP_CONTEXT_STALE");
  }
  return {
    schemaVersion: 1,
    invocationId: row.id,
    bindingId: row.binding_id,
    provider: row.provider,
    capability: row.capability,
    state: row.state,
    requestHash: row.request_hash,
    responseHash: row.response_hash,
    contextHash: row.context_hash,
    responseBytes: row.response_bytes,
    errorCode: row.error_code,
    releaseSha: row.release_sha,
    completedAt: row.completed_at.toISOString(),
    ...(sourceMetadata ? { sourceMetadata } : {}),
  };
}

async function invokeBounded(
  provider: McpContextProvider,
  binding: McpBindingV1,
  request: Readonly<{ schemaVersion: 1; objective: string; requiredCapabilities: readonly string[] }>,
  signal?: AbortSignal,
): Promise<unknown> {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error("GOAL_MCP_ABORTED");
  }
  const controller = new AbortController();
  const abort = (): void => controller.abort(signal?.reason ?? new Error("GOAL_MCP_ABORTED"));
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error("GOAL_MCP_TIMEOUT")), MCP_CALL_TIMEOUT_MS);
  try {
    return await Promise.race([
      provider.invoke(binding, request, controller.signal),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          const reason = controller.signal.reason;
          reject(reason instanceof Error ? reason : new Error("GOAL_MCP_ABORTED"));
        }, { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

async function invocationForBinding(input: {
  sql: DatabaseClient;
  goalRunJobId?: string;
  hireRequestId?: string;
  hireFence?: Readonly<{
    workerId: string;
    workerEpoch: bigint;
    claimVersion: number;
    claimExpiresAt: Date;
  }>;
  agentVersionId: string;
  manifestHash: string;
  binding: McpBindingV1;
  objective: string;
  requiredCapabilities: readonly string[];
  releaseSha: string;
  provider?: McpContextProvider;
  now: Date;
  signal?: AbortSignal;
  mutationGuard?: (sql: DatabaseClient, now: Date) => Promise<boolean>;
  currentTime: () => Date;
}): Promise<{ evidence: McpEvidenceV1; response: CanonicalValue }> {
  if ((input.goalRunJobId ? 1 : 0) + (input.hireRequestId ? 1 : 0) !== 1) {
    throw new McpContextError("GOAL_MCP_PARENT_INVALID");
  }
  if ((input.hireRequestId !== undefined) !== (input.hireFence !== undefined)) {
    throw new McpContextError("GOAL_MCP_PARENT_INVALID");
  }
  if (!isMcpBindingAllowlisted(input.binding)) {
    throw new McpContextError("GOAL_MCP_BINDING_UNALLOWLISTED");
  }
  if (!/^[0-9a-f]{40}$/.test(input.releaseSha)) {
    throw new McpContextError("GOAL_MCP_CONTEXT_UNAVAILABLE");
  }
  const request = {
    schemaVersion: 1,
    objective: input.objective,
    requiredCapabilities: [...input.requiredCapabilities],
  } as const;
  const requestHash = domainHash("mcp-request", {
    bindingId: input.binding.id,
    request,
  });
  const idempotencyKey = domainHash("mcp-invocation", {
    goalRunJobId: input.goalRunJobId ?? null,
    hireRequestId: input.hireRequestId ?? null,
    bindingId: input.binding.id,
    manifestHash: input.manifestHash,
    requestHash,
    hireClaimOwner: input.hireFence?.workerId ?? null,
    hireClaimEpoch: input.hireFence?.workerEpoch.toString() ?? null,
    hireClaimVersion: input.hireFence?.claimVersion ?? null,
    hireClaimExpiresAt: input.hireFence?.claimExpiresAt.toISOString() ?? null,
  });
  const result = await input.sql.begin(async (transaction): Promise<
    | { evidence: McpEvidenceV1; response: CanonicalValue }
    | { errorCode: string }
  > => {
    const tx = transaction as unknown as DatabaseClient;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${idempotencyKey}, 0))`;
    const existing = await tx<InvocationRow[]>`
      SELECT id::text, binding_id, provider, capability, request_hash, response_hash,
        context_hash, normalized_response, response_bytes, state, error_code,
        release_sha, completed_at
      FROM mcp_invocations WHERE idempotency_key = ${idempotencyKey}
    `;
    if (existing[0]) {
      if (existing[0].state === "FAILED" || existing[0].normalized_response === null) {
        return { errorCode: existing[0].error_code ?? "GOAL_MCP_CONTEXT_UNAVAILABLE" };
      }
      return {
        evidence: evidence(existing[0], input.currentTime()),
        response: existing[0].normalized_response as CanonicalValue,
      };
    }
    if (input.mutationGuard && !(await input.mutationGuard(tx, input.now))) {
      throw new McpContextError("GOAL_MCP_CLAIM_LOST");
    }
    let normalized: CanonicalValue | null = null;
    let responseHash: string | null = null;
    let contextHash: string | null = null;
    let responseBytes = 0;
    let errorCode: string | null = null;
    let completedAt = input.currentTime();
    try {
      if (!input.provider) throw new McpContextError("GOAL_MCP_CONTEXT_UNAVAILABLE");
      const raw = await invokeBounded(input.provider, input.binding, request, input.signal);
      normalized = normalizeResponse(raw);
      const admittedAt = input.currentTime();
      const sourceMetadata = admittedSourceMetadata(
        normalized,
        input.binding.provider,
        input.now,
        admittedAt,
      );
      completedAt = sourceMetadata ? new Date(sourceMetadata.completedAt) : admittedAt;
      const serialized = canonicalJson(normalized);
      responseBytes = Buffer.byteLength(serialized, "utf8");
      if (responseBytes > MCP_MAX_RESPONSE_BYTES) {
        throw new McpContextError("GOAL_MCP_RESPONSE_TOO_LARGE");
      }
      responseHash = domainHash("mcp-response", normalized);
      contextHash = domainHash("mcp-context-entry", {
        bindingId: input.binding.id,
        requestHash,
        responseHash,
      });
      if (input.mutationGuard && !(await input.mutationGuard(tx, input.now))) {
        throw new McpContextError("GOAL_MCP_CLAIM_LOST");
      }
    } catch (error) {
      errorCode = error instanceof McpContextError
        ? error.code
        : error instanceof Error && error.message === "GOAL_MCP_TIMEOUT"
          ? "GOAL_MCP_TIMEOUT"
          : input.signal?.aborted
            ? "GOAL_MCP_ABORTED"
            : "GOAL_MCP_PROVIDER_FAILED";
      if (!ERROR_CODE.test(errorCode)) errorCode = "GOAL_MCP_PROVIDER_FAILED";
      normalized = null;
      responseHash = null;
      contextHash = null;
      responseBytes = 0;
    }
    if (errorCode === "GOAL_MCP_CLAIM_LOST") {
      throw new McpContextError(errorCode);
    }
    const rows = await tx<InvocationRow[]>`
      INSERT INTO mcp_invocations (
        goal_run_job_id, hire_request_id, hire_claim_owner, hire_claim_epoch,
        hire_claim_version, hire_claim_expires_at, agent_version_id, manifest_hash, binding_id, provider,
        capability, idempotency_key, request_hash, response_hash, context_hash,
        normalized_response, response_bytes, state, error_code, release_sha,
        started_at, completed_at, created_at
      ) VALUES (
        ${input.goalRunJobId ?? null}::uuid, ${input.hireRequestId ?? null}::uuid,
        ${input.hireFence?.workerId ?? null}, ${input.hireFence?.workerEpoch.toString() ?? null}::bigint,
        ${input.hireFence?.claimVersion ?? null}, ${input.hireFence?.claimExpiresAt ?? null},
        ${input.agentVersionId}::uuid, ${input.manifestHash},
        ${input.binding.id}, ${input.binding.provider}, ${input.binding.capability},
        ${idempotencyKey}, ${requestHash}, ${responseHash}, ${contextHash},
        ${normalized === null ? null : tx.json(normalized)}, ${responseBytes},
        ${errorCode === null ? "SUCCEEDED" : "FAILED"}, ${errorCode}, ${input.releaseSha},
        ${input.now}, ${completedAt}, ${input.now}
      )
      RETURNING id::text, binding_id, provider, capability, request_hash, response_hash,
        context_hash, normalized_response, response_bytes, state, error_code,
        release_sha, completed_at
    `;
    const row = rows[0];
    if (!row) throw new Error("GOAL_MCP_EVIDENCE_INSERT_FAILED");
    if (errorCode || normalized === null) {
      return { errorCode: errorCode ?? "GOAL_MCP_CONTEXT_UNAVAILABLE" };
    }
    return { evidence: evidence(row), response: normalized };
  });
  if ("errorCode" in result) throw new McpContextError(result.errorCode);
  return result;
}

export async function collectMcpContext(input: {
  sql: DatabaseClient;
  goalRunJobId?: string;
  hireRequestId?: string;
  hireFence?: Readonly<{
    workerId: string;
    workerEpoch: bigint;
    claimVersion: number;
    claimExpiresAt: Date;
  }>;
  agentVersionId: string;
  manifestHash: string;
  bindings: readonly McpBindingV1[];
  objective: string;
  requiredCapabilities: readonly string[];
  releaseSha: string;
  provider?: McpContextProvider;
  now?: Date;
  signal?: AbortSignal;
  mutationGuard?: (sql: DatabaseClient, now: Date) => Promise<boolean>;
}): Promise<{ context: string; contextHash: string; evidence: readonly McpEvidenceV1[] }> {
  if ((input.goalRunJobId ? 1 : 0) + (input.hireRequestId ? 1 : 0) !== 1) {
    throw new McpContextError("GOAL_MCP_PARENT_INVALID");
  }
  if ((input.hireRequestId !== undefined) !== (input.hireFence !== undefined)) {
    throw new McpContextError("GOAL_MCP_PARENT_INVALID");
  }
  if (input.bindings.length > MAX_MCP_CALLS_PER_JOB) {
    throw new McpContextError("GOAL_MCP_CALL_LIMIT_EXCEEDED");
  }
  const now = input.now ?? new Date();
  const currentTime = (): Date => {
    const actual = new Date();
    return input.now && Math.abs(actual.getTime() - now.getTime()) > KERNEL_QUOTE_TTL_MS
      ? now
      : actual;
  };
  const entries: Array<{ bindingId: string; response: CanonicalValue; evidence: McpEvidenceV1 }> = [];
  for (const binding of input.bindings) {
    const invocation = await invocationForBinding({ ...input, binding, now, currentTime });
    entries.push({ bindingId: binding.id, response: invocation.response, evidence: invocation.evidence });
  }
  const contextValue = entries.map((entry) => ({
    bindingId: entry.bindingId,
    contextHash: entry.evidence.contextHash,
    requestHash: entry.evidence.requestHash,
    responseHash: entry.evidence.responseHash,
    response: entry.response,
  }));
  return {
    context: canonicalJson(contextValue),
    contextHash: domainHash("mcp-context", contextValue),
    evidence: entries.map((entry) => entry.evidence),
  };
}
