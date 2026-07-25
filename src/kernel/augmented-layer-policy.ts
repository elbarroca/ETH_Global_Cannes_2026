import { getDb } from "../config/database";
import { domainHash } from "./canonical";
import { KernelError } from "./errors";
import type { DatabaseClient } from "./service";
import type { AugmentedLayerPolicySnapshot, GoalPolicyV2 } from "./types";

const CADENCES = new Set([5, 15, 30, 60]);
const MAX_ATOMIC = 9_223_372_036_854_775_807n;

interface PolicyRow {
  policy: unknown;
  policy_hash: string;
  updated_at: Date;
}

interface MutationRow {
  payload_hash: string;
  result_snapshot: unknown;
  result_hash: string;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "A JSON object is required", 400);
  }
  return value as Record<string, unknown>;
}

function positiveAtomic(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,18}$/.test(value)) {
    throw new KernelError("KERNEL_INVALID_REQUEST", `${field} must be a positive decimal string`, 400);
  }
  if (BigInt(value) > MAX_ATOMIC) {
    throw new KernelError("KERNEL_INVALID_REQUEST", `${field} exceeds BIGINT`, 400);
  }
  return value;
}

export function parseGoalPolicyV2(value: unknown): GoalPolicyV2 {
  const policy = objectRecord(value);
  const expected = [
    "schemaVersion", "orchestrationMode", "cadenceMinutes", "runMode",
    "executionMode", "runLimit", "maxAgents", "perRunCapAtomic", "dailyCapAtomic",
  ];
  if (Object.keys(policy).length !== expected.length || Object.keys(policy).some((key) => !expected.includes(key))) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "GoalPolicyV2 fields must be exact", 400);
  }
  if (policy.schemaVersion !== 2 || policy.orchestrationMode !== "TRI_RISK_V1" || policy.maxAgents !== 3) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "TRI_RISK_V1 requires schemaVersion 2 and maxAgents 3", 400);
  }
  if (!CADENCES.has(Number(policy.cadenceMinutes))) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "cadenceMinutes must be 5, 15, 30, or 60", 400);
  }
  if (policy.runMode !== "BOUNDED" && policy.runMode !== "CONTINUOUS") {
    throw new KernelError("KERNEL_INVALID_REQUEST", "runMode must be BOUNDED or CONTINUOUS", 400);
  }
  if (policy.executionMode !== "RESEARCH_ONLY" && policy.executionMode !== "PROPOSE_SWAP") {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Unsupported executionMode", 400);
  }
  const perRunCapAtomic = positiveAtomic(policy.perRunCapAtomic, "perRunCapAtomic");
  if (policy.runMode === "BOUNDED") {
    if (!Number.isInteger(policy.runLimit) || Number(policy.runLimit) < 1 || Number(policy.runLimit) > 100) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "Bounded runLimit must be 1-100", 400);
    }
    if (policy.dailyCapAtomic !== null) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "Bounded dailyCapAtomic must be null", 400);
    }
  } else {
    if (policy.runLimit !== null) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "Continuous runLimit must be null", 400);
    }
    positiveAtomic(policy.dailyCapAtomic, "dailyCapAtomic");
  }
  return {
    schemaVersion: 2,
    orchestrationMode: "TRI_RISK_V1",
    cadenceMinutes: Number(policy.cadenceMinutes) as GoalPolicyV2["cadenceMinutes"],
    runMode: policy.runMode,
    executionMode: policy.executionMode,
    runLimit: policy.runMode === "BOUNDED" ? Number(policy.runLimit) : null,
    maxAgents: 3,
    perRunCapAtomic,
    dailyCapAtomic: policy.runMode === "CONTINUOUS" ? String(policy.dailyCapAtomic) : null,
  };
}

function storedSnapshot(value: unknown, expectedHash: string): AugmentedLayerPolicySnapshot {
  try {
    const result = objectRecord(value);
    if (
      Object.keys(result).length !== 3 ||
      !Object.hasOwn(result, "policy") || !Object.hasOwn(result, "policyHash") ||
      !Object.hasOwn(result, "updatedAt") || typeof result.policyHash !== "string" ||
      typeof result.updatedAt !== "string"
    ) {
      throw new Error("invalid");
    }
    const updatedAt = new Date(result.updatedAt);
    const policy = parseGoalPolicyV2(result.policy);
    const snapshot: AugmentedLayerPolicySnapshot = {
      policy,
      policyHash: result.policyHash,
      updatedAt: updatedAt.toISOString(),
    };
    if (
      updatedAt.toISOString() !== result.updatedAt ||
      domainHash("goal-policy", policy) !== snapshot.policyHash ||
      domainHash("augmented-layer-policy-result", snapshot) !== expectedHash
    ) {
      throw new Error("invalid");
    }
    return snapshot;
  } catch {
    throw new Error("AUGMENTED_LAYER_POLICY_RESULT_INVALID");
  }
}

function mapPolicy(row: PolicyRow): AugmentedLayerPolicySnapshot {
  const policy = parseGoalPolicyV2(row.policy);
  if (domainHash("goal-policy", policy) !== row.policy_hash) {
    throw new Error("AUGMENTED_LAYER_POLICY_HASH_INVALID");
  }
  return { policy, policyHash: row.policy_hash, updatedAt: row.updated_at.toISOString() };
}

export async function getAugmentedLayerPolicy(
  ownerUserId: string,
  options: { sql?: DatabaseClient } = {},
): Promise<AugmentedLayerPolicySnapshot | null> {
  const rows = await (options.sql ?? getDb())<PolicyRow[]>`
    SELECT policy, policy_hash, updated_at
    FROM augmented_layer_policies
    WHERE owner_user_id = ${ownerUserId}
  `;
  return rows[0] ? mapPolicy(rows[0]) : null;
}

export async function patchAugmentedLayerPolicy(
  ownerUserId: string,
  policy: GoalPolicyV2,
  idempotencyKey: string,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<{ policy: AugmentedLayerPolicySnapshot; replayed: boolean }> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const parsed = parseGoalPolicyV2(policy);
  const payloadHash = domainHash("augmented-layer-policy-mutation", { ownerUserId, policy: parsed });
  const lockKey = domainHash("augmented-layer-policy-lock", { ownerUserId });
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as DatabaseClient;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const mutations = await tx<MutationRow[]>`
      SELECT payload_hash, result_snapshot, result_hash
      FROM augmented_layer_policy_mutations
      WHERE owner_user_id = ${ownerUserId} AND idempotency_key = ${idempotencyKey}
    `;
    if (mutations[0]) {
      if (mutations[0].payload_hash !== payloadHash) {
        throw new KernelError(
          "KERNEL_IDEMPOTENCY_MISMATCH",
          "Idempotency key was used for another augmented-layer policy",
          409,
        );
      }
      return { policy: storedSnapshot(mutations[0].result_snapshot, mutations[0].result_hash), replayed: true };
    }
    const policyHash = domainHash("goal-policy", parsed);
    const rows = await tx<PolicyRow[]>`
      INSERT INTO augmented_layer_policies (
        owner_user_id, policy, policy_hash, created_at, updated_at
      ) VALUES (
        ${ownerUserId}, ${tx.json(parsed)}, ${policyHash}, ${now}, ${now}
      )
      ON CONFLICT (owner_user_id) DO UPDATE SET
        policy = EXCLUDED.policy, policy_hash = EXCLUDED.policy_hash, updated_at = EXCLUDED.updated_at
      RETURNING policy, policy_hash, updated_at
    `;
    if (!rows[0]) throw new Error("AUGMENTED_LAYER_POLICY_WRITE_FAILED");
    const snapshot = mapPolicy(rows[0]);
    const resultHash = domainHash("augmented-layer-policy-result", snapshot);
    await tx`
      INSERT INTO augmented_layer_policy_mutations (
        owner_user_id, idempotency_key, payload_hash, result_snapshot, result_hash, created_at
      ) VALUES (
        ${ownerUserId}, ${idempotencyKey}, ${payloadHash}, ${tx.json(snapshot)}, ${resultHash}, ${now}
      )
    `;
    return { policy: snapshot, replayed: false };
  });
}
