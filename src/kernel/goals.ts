import { getDb } from "../config/database";
import { isAllowlistedToken } from "../config/unichain-sepolia";
import { isSupportedAgentSkill, type SupportedAgentSkill } from "./agent-catalog";
import { canonicalJson, domainHash, type CanonicalValue } from "./canonical";
import { KernelError } from "./errors";
import { isKernelUuid } from "./policy";
import { submitJob, type DatabaseClient } from "./service";
import type {
  GoalPolicy,
  GoalRunEvidenceV1,
  GoalRunJobSnapshot,
  GoalRunReportV1,
  GoalRunSnapshot,
  GoalRunState,
  GoalSnapshot,
  GoalState,
  SwapProposalV1,
} from "./types";

const GOAL_LOOP_LEASE_KEY = "goal-loop";
const MAX_ATOMIC = 9_223_372_036_854_775_807n;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;
const ERROR_CODE = /^[A-Z][A-Z0-9_]{2,64}$/;
const WALLET = /^0x[0-9a-f]{40}$/;
const CADENCES = new Set([5, 15, 30, 60]);
const TERMINAL_RUN_STATES = new Set<GoalRunState>([
  "READY", "PARTIAL", "BLOCKED", "FAILED", "CANCELED",
]);

interface GoalRow {
  goal_id: string;
  owner_user_id: string;
  definition_hash: string;
  last_mutation_key?: string | null;
  last_mutation_hash?: string | null;
  objective: string;
  required_capabilities: string[];
  cadence_minutes: number;
  run_mode: "BOUNDED" | "CONTINUOUS";
  execution_mode: "RESEARCH_ONLY" | "PROPOSE_SWAP";
  run_limit: number | null;
  max_agents: number;
  per_run_cap_atomic: string;
  daily_cap_atomic: string | null;
  state: GoalState;
  next_run_at: Date | null;
  completed_runs: number;
  created_at: Date;
  updated_at: Date;
}

interface GoalRunRow {
  run_id: string;
  goal_id: string;
  owner_user_id: string;
  idempotency_key: string;
  scheduled_for: Date;
  state: GoalRunState;
  objective_snapshot: string;
  capabilities_snapshot: string[];
  policy_snapshot: unknown;
  policy_hash: string;
  effect_identity: string;
  total_price_atomic: string;
  report: unknown;
  report_hash: string | null;
  error_code: string | null;
  claim_owner: string | null;
  claim_epoch: string | null;
  claim_version: number;
  claim_expires_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface GoalRunJobRow {
  id: string;
  goal_run_id: string;
  agent_version_id: string;
  job_id: string | null;
  role: "ANALYSIS" | "SYNTHESIS";
  selection_rank: number;
  covered_capabilities: string[];
  price_atomic_snapshot: string;
  manifest_hash_snapshot: string;
  full_subname_snapshot: string;
}

interface CandidateRow {
  version_id: string;
  capabilities: string[];
  price_atomic: string;
  manifest_hash: string;
  full_subname: string;
  verified_external_hires: string;
}

interface JobResultRow extends GoalRunJobRow {
  job_state: string | null;
  effect_state: string | null;
  effect_result: unknown;
  effect_result_hash: string | null;
  receipt_id: string | null;
  receipt_verified: boolean | null;
  receipt_result_hash: string | null;
}

export interface GoalRunClaim {
  runId: string;
  ownerUserId: string;
  ownerId: string;
  epoch: string;
  claimVersion: number;
  effectIdentity: string;
  expiresAt: Date;
  disposableTestClock: boolean;
}

export type ParsedGoalPatch =
  | { action: "ACTIVATE" | "PAUSE" | "RESUME" }
  | {
      action: "UPDATE";
      objective?: string;
      requiredCapabilities?: readonly SupportedAgentSkill[];
      policy?: GoalPolicy;
    };

function transactionClient(transaction: unknown): DatabaseClient {
  return transaction as DatabaseClient;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "A JSON object is required", 400);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key))) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Unexpected or server-owned field", 400);
  }
}

function boundedString(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") {
    throw new KernelError("KERNEL_INVALID_REQUEST", `${field} must be a string`, 400);
  }
  const result = value.trim();
  if (result.length < min || result.length > max || result.includes("\0")) {
    throw new KernelError("KERNEL_INVALID_REQUEST", `${field} must be ${min}-${max} characters`, 400);
  }
  return result;
}

function positiveAtomic(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,18}$/.test(value)) {
    throw new KernelError("KERNEL_INVALID_REQUEST", `${field} must be a positive decimal string`, 400);
  }
  const parsed = BigInt(value);
  if (parsed > MAX_ATOMIC) {
    throw new KernelError("KERNEL_INVALID_REQUEST", `${field} exceeds BIGINT`, 400);
  }
  return value;
}

function capabilities(value: unknown): readonly SupportedAgentSkill[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "requiredCapabilities must contain 1-4 entries", 400);
  }
  const parsed = value.map((entry): SupportedAgentSkill => {
    if (typeof entry !== "string" || !isSupportedAgentSkill(entry)) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "Unsupported required capability", 400);
    }
    return entry;
  });
  const unique = [...new Set(parsed)].sort();
  if (unique.length !== parsed.length) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "requiredCapabilities must be unique", 400);
  }
  return unique;
}

export function parseGoalPolicy(value: unknown): GoalPolicy {
  const policy = objectRecord(value);
  exactKeys(policy, [
    "cadenceMinutes", "runMode", "executionMode", "runLimit", "maxAgents",
    "perRunCapAtomic", "dailyCapAtomic",
  ]);
  if (!CADENCES.has(Number(policy.cadenceMinutes))) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "cadenceMinutes must be 5, 15, 30, or 60", 400);
  }
  if (policy.runMode !== "BOUNDED" && policy.runMode !== "CONTINUOUS") {
    throw new KernelError("KERNEL_INVALID_REQUEST", "runMode must be BOUNDED or CONTINUOUS", 400);
  }
  if (policy.executionMode !== "RESEARCH_ONLY" && policy.executionMode !== "PROPOSE_SWAP") {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Unsupported executionMode", 400);
  }
  if (!Number.isInteger(policy.maxAgents) || Number(policy.maxAgents) < 1 || Number(policy.maxAgents) > 4) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "maxAgents must be 1-4", 400);
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
    cadenceMinutes: Number(policy.cadenceMinutes) as GoalPolicy["cadenceMinutes"],
    runMode: policy.runMode,
    executionMode: policy.executionMode,
    runLimit: policy.runMode === "BOUNDED" ? Number(policy.runLimit) : null,
    maxAgents: Number(policy.maxAgents),
    perRunCapAtomic,
    dailyCapAtomic: policy.runMode === "CONTINUOUS" ? String(policy.dailyCapAtomic) : null,
  };
}

export function parseGoalCreate(value: unknown): {
  objective: string;
  requiredCapabilities: readonly SupportedAgentSkill[];
  policy: GoalPolicy;
  state: "DRAFT" | "ACTIVE";
} {
  const body = objectRecord(value);
  exactKeys(body, ["objective", "requiredCapabilities", "policy", "state"]);
  if (body.state !== "DRAFT" && body.state !== "ACTIVE") {
    throw new KernelError("KERNEL_INVALID_REQUEST", "state must be DRAFT or ACTIVE", 400);
  }
  return {
    objective: boundedString(body.objective, "objective", 10, 2_000),
    requiredCapabilities: capabilities(body.requiredCapabilities),
    policy: parseGoalPolicy(body.policy),
    state: body.state,
  };
}

export function parseGoalPatch(value: unknown): ParsedGoalPatch {
  const body = objectRecord(value);
  if (body.action === "ACTIVATE" || body.action === "PAUSE" || body.action === "RESUME") {
    exactKeys(body, ["action"]);
    return { action: body.action };
  }
  if (body.action !== "UPDATE") {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Unsupported goal action", 400);
  }
  exactKeys(body, ["action", "objective", "requiredCapabilities", "policy"]);
  if (body.objective === undefined && body.requiredCapabilities === undefined && body.policy === undefined) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "UPDATE requires at least one field", 400);
  }
  return {
    action: "UPDATE",
    ...(body.objective === undefined
      ? {}
      : { objective: boundedString(body.objective, "objective", 10, 2_000) }),
    ...(body.requiredCapabilities === undefined
      ? {}
      : { requiredCapabilities: capabilities(body.requiredCapabilities) }),
    ...(body.policy === undefined ? {} : { policy: parseGoalPolicy(body.policy) }),
  };
}

export function parseRunCreate(value: unknown): void {
  const body = objectRecord(value);
  exactKeys(body, []);
}

export function parseGoalIdempotencyKey(value: string | null): string {
  if (!value || !IDEMPOTENCY_KEY.test(value)) {
    throw new KernelError(
      "KERNEL_INVALID_REQUEST",
      "Idempotency-Key must be 8-128 URL-safe characters",
      400,
    );
  }
  return value;
}

function policyFromGoal(row: GoalRow): GoalPolicy {
  return {
    cadenceMinutes: row.cadence_minutes as GoalPolicy["cadenceMinutes"],
    runMode: row.run_mode,
    executionMode: row.execution_mode,
    runLimit: row.run_limit,
    maxAgents: row.max_agents,
    perRunCapAtomic: row.per_run_cap_atomic,
    dailyCapAtomic: row.daily_cap_atomic,
  };
}

function mapGoal(row: GoalRow): GoalSnapshot {
  return {
    goalId: row.goal_id,
    objective: row.objective,
    requiredCapabilities: row.required_capabilities,
    policy: policyFromGoal(row),
    state: row.state,
    nextRunAt: row.next_run_at?.toISOString() ?? null,
    completedRuns: row.completed_runs,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapGoalRunJob(row: GoalRunJobRow): GoalRunJobSnapshot {
  return {
    agentVersionId: row.agent_version_id,
    jobId: row.job_id,
    role: row.role,
    selectionRank: row.selection_rank,
    coveredCapabilities: row.covered_capabilities,
    priceAtomic: row.price_atomic_snapshot,
    manifestHash: row.manifest_hash_snapshot,
    fullSubname: row.full_subname_snapshot,
  };
}

function parseReport(value: unknown): GoalRunReportV1 | null {
  if (value === null) return null;
  const report = objectRecord(value);
  exactKeys(report, [
    "schemaVersion", "goalId", "runId", "status", "objective", "summary",
    "conclusion", "evidence", "swapProposal",
  ]);
  if (
    report.schemaVersion !== 1 || !isKernelUuid(report.goalId) || !isKernelUuid(report.runId) ||
    (report.status !== "READY" && report.status !== "PARTIAL") ||
    typeof report.objective !== "string" || report.objective.length < 10 || report.objective.length > 2_000 ||
    typeof report.summary !== "string" || report.summary.length < 1 || report.summary.length > 2_000 ||
    typeof report.conclusion !== "string" || report.conclusion.length < 1 || report.conclusion.length > 2_000 ||
    !Array.isArray(report.evidence) || report.evidence.length < 1 || report.evidence.length > 5
  ) {
    throw new Error("GOAL_REPORT_INVALID");
  }
  const parsedEvidence = report.evidence.map((value): GoalRunEvidenceV1 => {
    const item = objectRecord(value);
    exactKeys(item, ["jobId", "agentVersionId", "resultHash", "receiptId"]);
    if (
      !isKernelUuid(item.jobId) || !isKernelUuid(item.agentVersionId) ||
      typeof item.resultHash !== "string" || !/^[0-9a-f]{64}$/.test(item.resultHash) ||
      !isKernelUuid(item.receiptId)
    ) {
      throw new Error("GOAL_REPORT_EVIDENCE_INVALID");
    }
    return {
      jobId: item.jobId,
      agentVersionId: item.agentVersionId,
      resultHash: item.resultHash,
      receiptId: item.receiptId,
    };
  });
  if (report.status === "PARTIAL" && report.swapProposal !== null) {
    throw new Error("GOAL_PARTIAL_SWAP_PROPOSAL_FORBIDDEN");
  }
  return {
    schemaVersion: 1,
    goalId: report.goalId,
    runId: report.runId,
    status: report.status,
    objective: report.objective,
    summary: report.summary,
    conclusion: report.conclusion,
    evidence: parsedEvidence,
    swapProposal: report.swapProposal === null ? null : parseSwapProposal(report.swapProposal),
  };
}

async function mapGoalRun(sql: DatabaseClient, row: GoalRunRow): Promise<GoalRunSnapshot> {
  const jobs = await sql<GoalRunJobRow[]>`
    SELECT id, goal_run_id, agent_version_id, job_id, role, selection_rank,
      covered_capabilities, price_atomic_snapshot::text,
      manifest_hash_snapshot, full_subname_snapshot
    FROM goal_run_jobs WHERE goal_run_id = ${row.run_id}::uuid
    ORDER BY selection_rank ASC, role ASC, id ASC
  `;
  return {
    runId: row.run_id,
    goalId: row.goal_id,
    scheduledFor: row.scheduled_for.toISOString(),
    state: row.state,
    objective: row.objective_snapshot,
    requiredCapabilities: row.capabilities_snapshot,
    policy: parseGoalPolicy(row.policy_snapshot),
    policyHash: row.policy_hash,
    effectIdentity: row.effect_identity,
    totalPriceAtomic: row.total_price_atomic,
    report: parseReport(row.report),
    reportHash: row.report_hash,
    errorCode: row.error_code,
    startedAt: row.started_at?.toISOString() ?? null,
    completedAt: row.completed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    jobs: jobs.map(mapGoalRunJob),
  };
}

function goalSelect(sql: DatabaseClient, ownerUserId: string, goalId: string): Promise<GoalRow[]> {
  return sql<GoalRow[]>`
    SELECT id AS goal_id, owner_user_id, definition_hash, objective, required_capabilities,
      cadence_minutes, run_mode, execution_mode, run_limit, max_agents,
      per_run_cap_atomic::text, daily_cap_atomic::text, state, next_run_at,
      completed_runs, created_at, updated_at
    FROM goals WHERE id = ${goalId}::uuid AND owner_user_id = ${ownerUserId}
  `;
}

function runSelect(sql: DatabaseClient, ownerUserId: string, runId: string): Promise<GoalRunRow[]> {
  return sql<GoalRunRow[]>`
    SELECT id AS run_id, goal_id, owner_user_id, idempotency_key, scheduled_for,
      state, objective_snapshot, capabilities_snapshot, policy_snapshot,
      policy_hash, effect_identity, total_price_atomic::text, report, report_hash,
      error_code, claim_owner, claim_epoch::text, claim_version, claim_expires_at,
      started_at, completed_at, created_at, updated_at
    FROM goal_runs WHERE id = ${runId}::uuid AND owner_user_id = ${ownerUserId}
  `;
}

export async function listGoals(
  ownerUserId: string,
  options: { limit?: number; sql?: DatabaseClient } = {},
): Promise<GoalSnapshot[]> {
  const sql = options.sql ?? getDb();
  const limit = options.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "limit must be 1-50", 400);
  }
  const rows = await sql<GoalRow[]>`
    SELECT id AS goal_id, owner_user_id, definition_hash, objective, required_capabilities,
      cadence_minutes, run_mode, execution_mode, run_limit, max_agents,
      per_run_cap_atomic::text, daily_cap_atomic::text, state, next_run_at,
      completed_runs, created_at, updated_at
    FROM goals WHERE owner_user_id = ${ownerUserId}
    ORDER BY created_at DESC, id DESC LIMIT ${limit}
  `;
  return rows.map(mapGoal);
}

export async function getGoal(
  ownerUserId: string,
  goalId: string,
  options: { sql?: DatabaseClient } = {},
): Promise<GoalSnapshot | null> {
  if (!isKernelUuid(goalId)) return null;
  const rows = await goalSelect(options.sql ?? getDb(), ownerUserId, goalId);
  return rows[0] ? mapGoal(rows[0]) : null;
}

export async function createGoal(
  ownerUserId: string,
  input: ReturnType<typeof parseGoalCreate>,
  idempotencyKey: string,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<{ goal: GoalSnapshot; replayed: boolean }> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const definition = {
    objective: input.objective,
    policy: input.policy,
    requiredCapabilities: input.requiredCapabilities,
    state: input.state,
  };
  const definitionHash = domainHash("goal-definition", definition);
  const lockKey = domainHash("goal-create-lock", { idempotencyKey, ownerUserId });
  return sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const existing = await tx<GoalRow[]>`
      SELECT id AS goal_id, owner_user_id, definition_hash, objective, required_capabilities,
        cadence_minutes, run_mode, execution_mode, run_limit, max_agents,
        per_run_cap_atomic::text, daily_cap_atomic::text, state, next_run_at,
        completed_runs, created_at, updated_at
      FROM goals WHERE owner_user_id = ${ownerUserId} AND idempotency_key = ${idempotencyKey}
    `;
    if (existing[0]) {
      if (existing[0].definition_hash !== definitionHash) {
        throw new KernelError("KERNEL_IDEMPOTENCY_MISMATCH", "Idempotency key was used for another goal", 409);
      }
      return { goal: mapGoal(existing[0]), replayed: true };
    }
    const rows = await tx<GoalRow[]>`
      INSERT INTO goals (
        owner_user_id, idempotency_key, definition_hash, objective, required_capabilities,
        cadence_minutes, run_mode, execution_mode, run_limit, max_agents,
        per_run_cap_atomic, daily_cap_atomic, state, next_run_at,
        completed_runs, created_at, updated_at
      ) VALUES (
        ${ownerUserId}, ${idempotencyKey}, ${definitionHash}, ${input.objective},
        ${[...input.requiredCapabilities]}, ${input.policy.cadenceMinutes},
        ${input.policy.runMode}, ${input.policy.executionMode}, ${input.policy.runLimit},
        ${input.policy.maxAgents}, ${input.policy.perRunCapAtomic}::bigint,
        ${input.policy.dailyCapAtomic}::bigint, ${input.state},
        ${input.state === "ACTIVE" ? now : null}, 0, ${now}, ${now}
      ) RETURNING
        id AS goal_id, owner_user_id, definition_hash, objective, required_capabilities,
        cadence_minutes, run_mode, execution_mode, run_limit, max_agents,
        per_run_cap_atomic::text, daily_cap_atomic::text, state, next_run_at,
        completed_runs, created_at, updated_at
    `;
    if (!rows[0]) throw new Error("GOAL_CREATE_FAILED");
    return { goal: mapGoal(rows[0]), replayed: false };
  });
}

export async function patchGoal(
  ownerUserId: string,
  goalId: string,
  input: ParsedGoalPatch,
  idempotencyKey: string,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<GoalSnapshot> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const lockKey = domainHash("goal-patch-lock", { goalId, idempotencyKey, ownerUserId });
  const mutationHash = domainHash("goal-mutation", { goalId, input });
  return sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const rows = await tx<GoalRow[]>`
      SELECT id AS goal_id, owner_user_id, definition_hash, last_mutation_key,
        last_mutation_hash, objective, required_capabilities,
        cadence_minutes, run_mode, execution_mode, run_limit, max_agents,
        per_run_cap_atomic::text, daily_cap_atomic::text, state, next_run_at,
        completed_runs, created_at, updated_at
      FROM goals WHERE id = ${goalId}::uuid AND owner_user_id = ${ownerUserId}
      FOR UPDATE
    `;
    const goal = rows[0];
    if (!goal) throw new KernelError("KERNEL_NOT_FOUND", "Goal not found", 404);
    if (goal.last_mutation_key === idempotencyKey) {
      if (goal.last_mutation_hash !== mutationHash) {
        throw new KernelError(
          "KERNEL_IDEMPOTENCY_MISMATCH",
          "Idempotency key was used for another goal mutation",
          409,
        );
      }
      return mapGoal(goal);
    }
    if (goal.state === "COMPLETED") {
      throw new KernelError("KERNEL_ILLEGAL_TRANSITION", "Completed goals are immutable", 409);
    }
    if (input.action === "UPDATE") {
      if (goal.state === "ACTIVE") {
        throw new KernelError("KERNEL_ILLEGAL_TRANSITION", "Pause the goal before editing it", 409);
      }
      const policy = input.policy ?? policyFromGoal(goal);
      await tx`
        UPDATE goals SET
          objective = ${input.objective ?? goal.objective},
          required_capabilities = ${input.requiredCapabilities ? [...input.requiredCapabilities] : goal.required_capabilities},
          cadence_minutes = ${policy.cadenceMinutes}, run_mode = ${policy.runMode},
          execution_mode = ${policy.executionMode}, run_limit = ${policy.runLimit},
          max_agents = ${policy.maxAgents}, per_run_cap_atomic = ${policy.perRunCapAtomic}::bigint,
          daily_cap_atomic = ${policy.dailyCapAtomic}::bigint, updated_at = ${now}
        WHERE id = ${goalId}::uuid AND owner_user_id = ${ownerUserId}
      `;
    } else if (input.action === "PAUSE") {
      if (goal.state !== "PAUSED") {
        if (goal.state !== "ACTIVE") {
          throw new KernelError("KERNEL_ILLEGAL_TRANSITION", "Only active goals can be paused", 409);
        }
        await tx`UPDATE goals SET state = 'PAUSED', next_run_at = NULL, updated_at = ${now} WHERE id = ${goalId}::uuid`;
        await tx`
          UPDATE goal_runs SET state = 'CANCELED', error_code = 'GOAL_PAUSED', completed_at = ${now}, updated_at = ${now}
          WHERE goal_id = ${goalId}::uuid AND state = 'SCHEDULED'
        `;
      }
    } else {
      if (goal.state !== "ACTIVE") {
        const allowed = input.action === "ACTIVATE" ? goal.state === "DRAFT" : goal.state === "PAUSED";
        if (!allowed) {
          throw new KernelError("KERNEL_ILLEGAL_TRANSITION", `Cannot ${input.action.toLowerCase()} this goal`, 409);
        }
        await tx`
          UPDATE goals SET state = 'ACTIVE', next_run_at = ${now}, updated_at = ${now}
          WHERE id = ${goalId}::uuid
        `;
      }
    }
    await tx`
      UPDATE goals SET last_mutation_key = ${idempotencyKey},
        last_mutation_hash = ${mutationHash}, updated_at = ${now}
      WHERE id = ${goalId}::uuid AND owner_user_id = ${ownerUserId}
    `;
    const updated = await goalSelect(tx, ownerUserId, goalId);
    if (!updated[0]) throw new Error("GOAL_UPDATE_READBACK_FAILED");
    return mapGoal(updated[0]);
  });
}

function runDefinition(goal: GoalRow, scheduledFor: Date): {
  policy: GoalPolicy;
  policyHash: string;
  effectIdentity: string;
} {
  const policy = policyFromGoal(goal);
  const policyHash = domainHash("goal-policy", policy);
  const effectIdentity = domainHash("goal-run", {
    goalId: goal.goal_id,
    objective: goal.objective,
    policyHash,
    requiredCapabilities: goal.required_capabilities,
    scheduledFor: scheduledFor.toISOString(),
  });
  return { policy, policyHash, effectIdentity };
}

async function insertGoalRun(
  tx: DatabaseClient,
  goal: GoalRow,
  idempotencyKey: string,
  scheduledFor: Date,
  now: Date,
): Promise<GoalRunRow> {
  const { policy, policyHash, effectIdentity } = runDefinition(goal, scheduledFor);
  const rows = await tx<GoalRunRow[]>`
    INSERT INTO goal_runs (
      goal_id, owner_user_id, idempotency_key, scheduled_for, state,
      objective_snapshot, capabilities_snapshot, policy_snapshot, policy_hash,
      effect_identity, total_price_atomic, claim_version, created_at, updated_at
    ) VALUES (
      ${goal.goal_id}::uuid, ${goal.owner_user_id}, ${idempotencyKey}, ${scheduledFor}, 'SCHEDULED',
      ${goal.objective}, ${goal.required_capabilities}, ${tx.json(policy)}, ${policyHash},
      ${effectIdentity}, 0, 0, ${now}, ${now}
    ) RETURNING
      id AS run_id, goal_id, owner_user_id, idempotency_key, scheduled_for,
      state, objective_snapshot, capabilities_snapshot, policy_snapshot,
      policy_hash, effect_identity, total_price_atomic::text, report, report_hash,
      error_code, claim_owner, claim_epoch::text, claim_version, claim_expires_at,
      started_at, completed_at, created_at, updated_at
  `;
  if (!rows[0]) throw new Error("GOAL_RUN_CREATE_FAILED");
  return rows[0];
}

async function boundedRunAvailable(tx: DatabaseClient, goal: GoalRow): Promise<boolean> {
  if (goal.run_mode !== "BOUNDED" || goal.run_limit === null) return true;
  const counts = await tx<{ count: string }[]>`
    SELECT count(*)::text AS count FROM goal_runs
    WHERE goal_id = ${goal.goal_id}::uuid AND state NOT IN ('BLOCKED', 'CANCELED')
  `;
  return BigInt(counts[0]?.count ?? "0") < BigInt(goal.run_limit);
}

export async function createGoalRun(
  ownerUserId: string,
  goalId: string,
  idempotencyKey: string,
  options: { now?: Date; sql?: DatabaseClient } = {},
): Promise<{ run: GoalRunSnapshot; replayed: boolean }> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const lockKey = domainHash("goal-run-create-lock", { idempotencyKey, ownerUserId });
  const created = await sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    const existing = await tx<GoalRunRow[]>`
      SELECT id AS run_id, goal_id, owner_user_id, idempotency_key, scheduled_for,
        state, objective_snapshot, capabilities_snapshot, policy_snapshot,
        policy_hash, effect_identity, total_price_atomic::text, report, report_hash,
        error_code, claim_owner, claim_epoch::text, claim_version, claim_expires_at,
        started_at, completed_at, created_at, updated_at
      FROM goal_runs WHERE owner_user_id = ${ownerUserId} AND idempotency_key = ${idempotencyKey}
    `;
    if (existing[0]) {
      if (existing[0].goal_id !== goalId) {
        throw new KernelError("KERNEL_IDEMPOTENCY_MISMATCH", "Idempotency key was used for another run", 409);
      }
      return { row: existing[0], replayed: true };
    }
    const goals = await tx<GoalRow[]>`
      SELECT id AS goal_id, owner_user_id, definition_hash, objective, required_capabilities,
        cadence_minutes, run_mode, execution_mode, run_limit, max_agents,
        per_run_cap_atomic::text, daily_cap_atomic::text, state, next_run_at,
        completed_runs, created_at, updated_at
      FROM goals WHERE id = ${goalId}::uuid AND owner_user_id = ${ownerUserId} FOR UPDATE
    `;
    const goal = goals[0];
    if (!goal) throw new KernelError("KERNEL_NOT_FOUND", "Goal not found", 404);
    if (goal.state !== "ACTIVE") {
      throw new KernelError("KERNEL_ILLEGAL_TRANSITION", "Goal must be active before running", 409);
    }
    if (!(await boundedRunAvailable(tx, goal))) {
      await tx`UPDATE goals SET state = 'COMPLETED', next_run_at = NULL, updated_at = ${now} WHERE id = ${goalId}::uuid`;
      throw new KernelError("KERNEL_ILLEGAL_TRANSITION", "Bounded goal run limit reached", 409);
    }
    return { row: await insertGoalRun(tx, goal, idempotencyKey, now, now), replayed: false };
  });
  const processed = await processGoalRun(ownerUserId, created.row.run_id, { now, sql });
  return { run: processed, replayed: created.replayed };
}

export async function listGoalRuns(
  ownerUserId: string,
  goalId: string,
  options: { limit?: number; sql?: DatabaseClient } = {},
): Promise<GoalRunSnapshot[]> {
  const sql = options.sql ?? getDb();
  const limit = options.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "limit must be 1-50", 400);
  }
  const owner = await goalSelect(sql, ownerUserId, goalId);
  if (!owner[0]) throw new KernelError("KERNEL_NOT_FOUND", "Goal not found", 404);
  const rows = await sql<GoalRunRow[]>`
    SELECT id AS run_id, goal_id, owner_user_id, idempotency_key, scheduled_for,
      state, objective_snapshot, capabilities_snapshot, policy_snapshot,
      policy_hash, effect_identity, total_price_atomic::text, report, report_hash,
      error_code, claim_owner, claim_epoch::text, claim_version, claim_expires_at,
      started_at, completed_at, created_at, updated_at
    FROM goal_runs WHERE goal_id = ${goalId}::uuid AND owner_user_id = ${ownerUserId}
    ORDER BY scheduled_for DESC, id DESC LIMIT ${limit}
  `;
  return Promise.all(rows.map((row) => mapGoalRun(sql, row)));
}

export async function getGoalRun(
  ownerUserId: string,
  runId: string,
  options: { sql?: DatabaseClient } = {},
): Promise<GoalRunSnapshot | null> {
  if (!isKernelUuid(runId)) return null;
  const sql = options.sql ?? getDb();
  const rows = await runSelect(sql, ownerUserId, runId);
  return rows[0] ? mapGoalRun(sql, rows[0]) : null;
}

function candidateCoverage(candidate: CandidateRow, required: ReadonlySet<string>): string[] {
  return candidate.capabilities.filter((capability) => required.has(capability)).sort();
}

function selectCandidates(
  candidates: readonly CandidateRow[],
  requiredCapabilities: readonly string[],
  maxAgents: number,
): { selected: { candidate: CandidateRow; covered: string[] }[]; missing: string[] } {
  const remaining = new Set(requiredCapabilities);
  const available = [...candidates];
  const selected: { candidate: CandidateRow; covered: string[] }[] = [];
  while (remaining.size > 0 && selected.length < maxAgents) {
    available.sort((left, right) => {
      const coverage = candidateCoverage(right, remaining).length - candidateCoverage(left, remaining).length;
      if (coverage !== 0) return coverage;
      const hires = BigInt(right.verified_external_hires) - BigInt(left.verified_external_hires);
      if (hires !== 0n) return hires > 0n ? 1 : -1;
      const price = BigInt(left.price_atomic) - BigInt(right.price_atomic);
      if (price !== 0n) return price > 0n ? 1 : -1;
      return left.version_id.localeCompare(right.version_id);
    });
    const candidate = available.shift();
    if (!candidate) break;
    const covered = candidateCoverage(candidate, remaining);
    if (covered.length === 0) break;
    selected.push({ candidate, covered });
    for (const capability of covered) remaining.delete(capability);
  }
  if (remaining.size === 0 && selected.length > 1 && !selected.some(({ candidate }) => candidate.capabilities.includes("research"))) {
    const research = available
      .filter((candidate) => candidate.capabilities.includes("research"))
      .sort((left, right) => {
        const hires = BigInt(right.verified_external_hires) - BigInt(left.verified_external_hires);
        if (hires !== 0n) return hires > 0n ? 1 : -1;
        const price = BigInt(left.price_atomic) - BigInt(right.price_atomic);
        return price === 0n ? left.version_id.localeCompare(right.version_id) : price > 0n ? 1 : -1;
      })[0];
    if (research && selected.length < maxAgents) selected.push({ candidate: research, covered: ["research"] });
    else remaining.add("research");
  }
  return { selected, missing: [...remaining].sort() };
}

async function claimHeld(tx: DatabaseClient, claim: GoalRunClaim, now: Date): Promise<boolean> {
  const rows = await tx<{ run_id: string }[]>`
    SELECT run.id AS run_id
    FROM goal_runs run
    JOIN worker_leases lease ON lease.key = ${GOAL_LOOP_LEASE_KEY}
    WHERE run.id = ${claim.runId}::uuid
      AND run.claim_owner = ${claim.ownerId}
      AND run.claim_epoch = ${claim.epoch}::bigint
      AND run.claim_version = ${claim.claimVersion}
      AND run.effect_identity = ${claim.effectIdentity}
      AND run.claim_expires_at = ${claim.expiresAt}
      AND run.claim_expires_at > ${now}
      AND lease.owner_id = ${claim.ownerId}
      AND lease.epoch = ${claim.epoch}::bigint
      AND lease.expires_at > ${now}
    FOR UPDATE OF run, lease
  `;
  return rows.length === 1;
}

async function guardClaim(tx: DatabaseClient, claim: GoalRunClaim | undefined, now: Date): Promise<void> {
  const guardedAt = claim && !claim.disposableTestClock ? new Date() : now;
  if (claim && !(await claimHeld(tx, claim, guardedAt))) {
    throw new KernelError("KERNEL_CONFLICT", "Goal run claim is no longer current", 409);
  }
}

async function terminalizeRun(
  tx: DatabaseClient,
  run: GoalRunRow,
  state: "READY" | "PARTIAL" | "BLOCKED" | "FAILED" | "CANCELED",
  now: Date,
  input: { report?: GoalRunReportV1 | null; errorCode?: string | null } = {},
): Promise<void> {
  if (TERMINAL_RUN_STATES.has(run.state)) return;
  const report = input.report ?? null;
  const reportHash = report ? domainHash("goal-run-report-v1", report) : null;
  const errorCode = input.errorCode ?? null;
  if (errorCode && !ERROR_CODE.test(errorCode)) throw new Error("GOAL_ERROR_CODE_INVALID");
  const changed = await tx<{ id: string }[]>`
    UPDATE goal_runs SET state = ${state}, report = ${report ? tx.json(report) : null},
      report_hash = ${reportHash}, error_code = ${errorCode}, completed_at = ${now},
      claim_owner = NULL, claim_epoch = NULL, claim_expires_at = NULL, updated_at = ${now}
    WHERE id = ${run.run_id}::uuid AND state = ${run.state}
    RETURNING id
  `;
  if (!changed[0]) return;
  if (state === "BLOCKED" || state === "CANCELED") return;
  const goals = await tx<GoalRow[]>`
    UPDATE goals SET completed_runs = completed_runs + 1, updated_at = ${now}
    WHERE id = ${run.goal_id}::uuid
    RETURNING id AS goal_id, owner_user_id, definition_hash, objective, required_capabilities,
      cadence_minutes, run_mode, execution_mode, run_limit, max_agents,
      per_run_cap_atomic::text, daily_cap_atomic::text, state, next_run_at,
      completed_runs, created_at, updated_at
  `;
  const goal = goals[0];
  if (goal?.run_mode === "BOUNDED" && goal.run_limit !== null && goal.completed_runs >= goal.run_limit) {
    await tx`
      UPDATE goals SET state = 'COMPLETED', next_run_at = NULL, updated_at = ${now}
      WHERE id = ${run.goal_id}::uuid AND state IN ('ACTIVE', 'PAUSED')
    `;
  }
}

async function selectRunAgents(
  ownerUserId: string,
  runId: string,
  now: Date,
  sql: DatabaseClient,
  claim?: GoalRunClaim,
): Promise<void> {
  await sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    await guardClaim(tx, claim, now);
    const runs = await tx<GoalRunRow[]>`
      SELECT id AS run_id, goal_id, owner_user_id, idempotency_key, scheduled_for,
        state, objective_snapshot, capabilities_snapshot, policy_snapshot,
        policy_hash, effect_identity, total_price_atomic::text, report, report_hash,
        error_code, claim_owner, claim_epoch::text, claim_version, claim_expires_at,
        started_at, completed_at, created_at, updated_at
      FROM goal_runs WHERE id = ${runId}::uuid AND owner_user_id = ${ownerUserId} FOR UPDATE
    `;
    const run = runs[0];
    if (!run) throw new KernelError("KERNEL_NOT_FOUND", "Goal run not found", 404);
    if (run.state !== "SCHEDULED") return;
    await tx`
      UPDATE goal_runs SET state = 'SELECTING', started_at = ${now}, updated_at = ${now}
      WHERE id = ${runId}::uuid AND state = 'SCHEDULED'
    `;
    run.state = "SELECTING";
    const policy = parseGoalPolicy(run.policy_snapshot);
    const candidates = await tx<CandidateRow[]>`
      SELECT v.id AS version_id, v.capabilities, v.price_atomic::text,
        v.manifest_hash, v.full_subname,
        COALESCE(hires.verified_external_hires, '0') AS verified_external_hires
      FROM agent_versions v
      JOIN kernel_agents agent ON agent.id = v.agent_id
      LEFT JOIN LATERAL (
        SELECT count(*)::text AS verified_external_hires
        FROM jobs job
        JOIN effects effect ON effect.job_id = job.id
        JOIN receipts receipt ON receipt.job_id = job.id AND receipt.effect_id = effect.id
        WHERE job.agent_version_id = v.id
          AND job.buyer_user_id <> agent.owner_user_id
          AND job.state = 'SUCCEEDED' AND effect.state = 'SUCCEEDED'
          AND receipt.verified = true AND receipt.result_hash = effect.result_hash
      ) hires ON true
      WHERE agent.owner_user_id <> ${ownerUserId}
        AND v.published = true AND v.lifecycle_state = 'PUBLISHED'
        AND v.canonical_state = 'CANONICAL' AND v.price_atomic > 0
        AND v.full_subname IS NOT NULL AND v.publication_decision_id IS NOT NULL
        AND v.publication_action_id IS NOT NULL
        AND (v.capabilities && ${run.capabilities_snapshot} OR 'research' = ANY(v.capabilities))
        AND EXISTS (
          SELECT 1 FROM ens_publication_decisions decision
          JOIN agent_lifecycle_actions action ON action.id = v.publication_action_id
          JOIN agent_version_events event ON event.lifecycle_action_id = action.id
          WHERE decision.id = v.publication_decision_id
            AND decision.agent_version_id = v.id AND decision.decision = 'ALLOW'
            AND decision.error_code IS NULL AND action.action = 'PUBLISH_VERSION'
            AND action.status = 'SUCCEEDED' AND action.owner_user_id = agent.owner_user_id
            AND action.target_agent_version_id = v.id AND action.agent_version_id = v.id
            AND action.result_snapshot->>'outcome' = 'SUCCESS'
            AND event.agent_version_id = v.id AND event.action = 'PUBLISH_VERSION'
            AND event.payload->>'publicationDecisionId' = decision.id::text
        )
      ORDER BY v.id ASC
      FOR SHARE OF v
    `;
    const selection = selectCandidates(candidates, run.capabilities_snapshot, policy.maxAgents);
    if (selection.missing.length > 0) {
      await terminalizeRun(tx, run, "BLOCKED", now, { errorCode: "GOAL_CAPABILITY_UNAVAILABLE" });
      return;
    }
    const synthesizer = selection.selected.length > 1
      ? selection.selected.find(({ candidate }) => candidate.capabilities.includes("research"))
      : null;
    let total = selection.selected.reduce((sum, item) => sum + BigInt(item.candidate.price_atomic), 0n);
    if (synthesizer) total += BigInt(synthesizer.candidate.price_atomic);
    if (total > BigInt(policy.perRunCapAtomic)) {
      await terminalizeRun(tx, run, "BLOCKED", now, { errorCode: "GOAL_PER_RUN_CAP_EXCEEDED" });
      return;
    }
    if (policy.runMode === "CONTINUOUS" && policy.dailyCapAtomic) {
      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const dayEnd = new Date(dayStart.getTime() + 86_400_000);
      const spent = await tx<{ total: string }[]>`
        SELECT COALESCE(sum(total_price_atomic), 0)::text AS total FROM goal_runs
        WHERE goal_id = ${run.goal_id}::uuid AND id <> ${run.run_id}::uuid
          AND scheduled_for >= ${dayStart} AND scheduled_for < ${dayEnd}
          AND state NOT IN ('BLOCKED', 'CANCELED')
      `;
      if (BigInt(spent[0]?.total ?? "0") + total > BigInt(policy.dailyCapAtomic)) {
        await terminalizeRun(tx, run, "BLOCKED", now, { errorCode: "GOAL_DAILY_CAP_EXCEEDED" });
        return;
      }
    }
    let rank = 1;
    for (const item of selection.selected) {
      await tx`
        INSERT INTO goal_run_jobs (
          goal_run_id, agent_version_id, role, selection_rank, covered_capabilities,
          price_atomic_snapshot, manifest_hash_snapshot, full_subname_snapshot, created_at
        ) VALUES (
          ${run.run_id}::uuid, ${item.candidate.version_id}::uuid, 'ANALYSIS', ${rank},
          ${item.covered}, ${item.candidate.price_atomic}::bigint,
          ${item.candidate.manifest_hash}, ${item.candidate.full_subname}, ${now}
        )
      `;
      rank += 1;
    }
    if (synthesizer) {
      await tx`
        INSERT INTO goal_run_jobs (
          goal_run_id, agent_version_id, role, selection_rank, covered_capabilities,
          price_atomic_snapshot, manifest_hash_snapshot, full_subname_snapshot, created_at
        ) VALUES (
          ${run.run_id}::uuid, ${synthesizer.candidate.version_id}::uuid, 'SYNTHESIS', ${rank},
          ${["research"]}, ${synthesizer.candidate.price_atomic}::bigint,
          ${synthesizer.candidate.manifest_hash}, ${synthesizer.candidate.full_subname}, ${now}
        )
      `;
    }
    await tx`
      UPDATE goal_runs SET state = 'RUNNING', total_price_atomic = ${total.toString()}::bigint,
        updated_at = ${now} WHERE id = ${run.run_id}::uuid AND state = 'SELECTING'
    `;
  });
}

async function jobRows(sql: DatabaseClient, runId: string): Promise<JobResultRow[]> {
  return sql<JobResultRow[]>`
    SELECT link.id, link.goal_run_id, link.agent_version_id, link.job_id,
      link.role, link.selection_rank, link.covered_capabilities,
      link.price_atomic_snapshot::text, link.manifest_hash_snapshot,
      link.full_subname_snapshot, job.state AS job_state, effect.state AS effect_state,
      effect.result AS effect_result, effect.result_hash AS effect_result_hash,
      receipt.id AS receipt_id, receipt.verified AS receipt_verified,
      receipt.result_hash AS receipt_result_hash
    FROM goal_run_jobs link
    LEFT JOIN jobs job ON job.id = link.job_id
    LEFT JOIN effects effect ON effect.job_id = job.id
    LEFT JOIN receipts receipt ON receipt.job_id = job.id AND receipt.effect_id = effect.id
    WHERE link.goal_run_id = ${runId}::uuid
    ORDER BY link.selection_rank ASC, link.role ASC, link.id ASC
  `;
}

function admitted(row: JobResultRow): boolean {
  return (row.job_state === "DELIVERY_READY" || row.job_state === "SUCCEEDED") &&
    row.effect_state === "SUCCEEDED" && row.receipt_verified === true &&
    !!row.effect_result_hash && row.effect_result_hash === row.receipt_result_hash &&
    !!row.receipt_id;
}

function pending(row: JobResultRow): boolean {
  return !row.job_id || row.job_state === "QUEUED" || row.job_state === "RUNNING";
}

function evidence(rows: readonly JobResultRow[]): GoalRunEvidenceV1[] {
  return rows.filter(admitted).map((row) => ({
    jobId: row.job_id as string,
    agentVersionId: row.agent_version_id,
    resultHash: row.effect_result_hash as string,
    receiptId: row.receipt_id as string,
  }));
}

function resultText(value: unknown): { summary: string; conclusion: string } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.summary === "string" && typeof record.conclusion === "string") {
      return {
        summary: record.summary.trim().slice(0, 2_000),
        conclusion: record.conclusion.trim().slice(0, 2_000),
      };
    }
  }
  const serialized = canonicalJson(value as CanonicalValue);
  return { summary: serialized.slice(0, 2_000), conclusion: "Verified agent output received." };
}

function parseSwapProposal(value: unknown): SwapProposalV1 | null {
  if (value === null) return null;
  const proposal = objectRecord(value);
  exactKeys(proposal, [
    "schemaVersion", "chainId", "tokenIn", "tokenOut", "amountInAtomic",
    "slippageBps", "rationale", "requiresWalletApproval",
  ]);
  if (
    proposal.schemaVersion !== 1 || proposal.chainId !== 1301 ||
    typeof proposal.tokenIn !== "string" || !WALLET.test(proposal.tokenIn) ||
    typeof proposal.tokenOut !== "string" || !WALLET.test(proposal.tokenOut) ||
    proposal.tokenIn === proposal.tokenOut || !isAllowlistedToken(proposal.tokenIn) ||
    !isAllowlistedToken(proposal.tokenOut) ||
    !Number.isInteger(proposal.slippageBps) || Number(proposal.slippageBps) < 0 ||
    Number(proposal.slippageBps) > 1_000 || proposal.requiresWalletApproval !== true
  ) {
    throw new Error("GOAL_SWAP_PROPOSAL_INVALID");
  }
  return {
    schemaVersion: 1,
    chainId: 1301,
    tokenIn: proposal.tokenIn,
    tokenOut: proposal.tokenOut,
    amountInAtomic: positiveAtomic(proposal.amountInAtomic, "amountInAtomic"),
    slippageBps: Number(proposal.slippageBps),
    rationale: boundedString(proposal.rationale, "rationale", 1, 1_000),
    requiresWalletApproval: true,
  };
}

function synthesisResult(value: unknown, policy: GoalPolicy): {
  summary: string;
  conclusion: string;
  swapProposal: SwapProposalV1 | null;
} {
  const result = objectRecord(value);
  exactKeys(result, ["schemaVersion", "summary", "conclusion", "swapProposal"]);
  if (result.schemaVersion !== 1) throw new Error("GOAL_SYNTHESIS_INVALID");
  const summary = boundedString(result.summary, "summary", 1, 2_000);
  const conclusion = boundedString(result.conclusion, "conclusion", 1, 2_000);
  if (policy.executionMode === "RESEARCH_ONLY" && result.swapProposal !== null) {
    throw new Error("GOAL_SYNTHESIS_POLICY_MISMATCH");
  }
  return {
    summary,
    conclusion,
    swapProposal: policy.executionMode === "PROPOSE_SWAP" ? parseSwapProposal(result.swapProposal) : null,
  };
}

function reportFor(
  run: GoalRunRow,
  status: "READY" | "PARTIAL",
  rows: readonly JobResultRow[],
  content: { summary: string; conclusion: string; swapProposal?: SwapProposalV1 | null },
): GoalRunReportV1 {
  return {
    schemaVersion: 1,
    goalId: run.goal_id,
    runId: run.run_id,
    status,
    objective: run.objective_snapshot,
    summary: content.summary,
    conclusion: content.conclusion,
    evidence: evidence(rows),
    swapProposal: status === "READY" ? content.swapProposal ?? null : null,
  };
}

function analysisPrompt(run: GoalRunRow, row: GoalRunJobRow): string {
  return [
    "Protected goal analysis.",
    `Objective: ${run.objective_snapshot}`,
    `Assigned capabilities: ${row.covered_capabilities.join(", ")}`,
    "Return a concise evidence-backed result. Never sign or broadcast a transaction.",
  ].join("\n").slice(0, 2_000);
}

function synthesisPrompt(run: GoalRunRow, rows: readonly JobResultRow[]): string {
  const payload = rows.filter((row) => row.role === "ANALYSIS" && admitted(row)).map((row) => ({
    agentVersionId: row.agent_version_id,
    resultHash: row.effect_result_hash,
    resultExcerpt: canonicalJson(row.effect_result as CanonicalValue).slice(0, 120),
  }));
  return [
    "Condense the verified protected goal outputs below.",
    "Return exactly JSON: {schemaVersion:1,summary:string,conclusion:string,swapProposal:null|SwapProposalV1}.",
    "Never sign or broadcast a transaction.",
    canonicalJson(payload),
  ].join("\n");
}

async function ensureJob(
  run: GoalRunRow,
  row: GoalRunJobRow,
  prompt: string,
  now: Date,
  sql: DatabaseClient,
  claim?: GoalRunClaim,
): Promise<void> {
  if (row.job_id) return;
  const idempotencyKey = `goal:${run.run_id}:${row.agent_version_id}:${row.role.toLowerCase()}`;
  const submitted = await submitJob(run.owner_user_id, {
    agentVersionId: row.agent_version_id,
    idempotencyKey,
    task: { prompt },
  }, {
    now,
    sql,
    ...(claim ? {
      mutationGuard: (tx, guardedAt) => claimHeld(
        tx,
        claim,
        claim.disposableTestClock ? guardedAt : new Date(),
      ),
    } : {}),
  });
  await sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    await guardClaim(tx, claim, now);
    await tx`
      UPDATE goal_run_jobs SET job_id = ${submitted.jobId}::uuid
      WHERE id = ${row.id}::uuid AND job_id IS NULL
    `;
    const bound = await tx<{ job_id: string }[]>`
      SELECT job_id FROM goal_run_jobs WHERE id = ${row.id}::uuid
    `;
    if (bound[0]?.job_id !== submitted.jobId) throw new Error("GOAL_RUN_JOB_BINDING_CONFLICT");
  });
}

async function reconcileGoalRun(
  ownerUserId: string,
  runId: string,
  now: Date,
  sql: DatabaseClient,
  claim?: GoalRunClaim,
): Promise<void> {
  let runs = await runSelect(sql, ownerUserId, runId);
  let run = runs[0];
  if (!run || TERMINAL_RUN_STATES.has(run.state)) return;
  let rows = await jobRows(sql, runId);
  for (const row of rows.filter((item) => item.role === "ANALYSIS" && !item.job_id)) {
    await ensureJob(run, row, analysisPrompt(run, row), now, sql, claim);
  }
  rows = await jobRows(sql, runId);
  const analysis = rows.filter((row) => row.role === "ANALYSIS");
  if (analysis.some(pending)) return;
  const accepted = analysis.filter(admitted);
  if (accepted.length === 0) {
    await sql.begin(async (transaction) => {
      const tx = transactionClient(transaction);
      await guardClaim(tx, claim, now);
      runs = await runSelect(tx, ownerUserId, runId);
      if (runs[0]) await terminalizeRun(tx, runs[0], "FAILED", now, { errorCode: "GOAL_NO_VERIFIED_OUTPUT" });
    });
    return;
  }
  if (accepted.length < analysis.length) {
    const content = resultText(accepted[0]?.effect_result);
    await sql.begin(async (transaction) => {
      const tx = transactionClient(transaction);
      await guardClaim(tx, claim, now);
      runs = await runSelect(tx, ownerUserId, runId);
      if (runs[0]) {
        await terminalizeRun(tx, runs[0], "PARTIAL", now, {
          report: reportFor(runs[0], "PARTIAL", accepted, content),
          errorCode: "GOAL_REQUIRED_OUTPUT_MISSING",
        });
      }
    });
    return;
  }
  if (analysis.length === 1) {
    const content = resultText(accepted[0]?.effect_result);
    await sql.begin(async (transaction) => {
      const tx = transactionClient(transaction);
      await guardClaim(tx, claim, now);
      runs = await runSelect(tx, ownerUserId, runId);
      if (runs[0]) await terminalizeRun(tx, runs[0], "READY", now, {
        report: reportFor(runs[0], "READY", accepted, content),
      });
    });
    return;
  }
  const synthesis = rows.find((row) => row.role === "SYNTHESIS");
  if (!synthesis) throw new Error("GOAL_SYNTHESIS_SELECTION_MISSING");
  if (!synthesis.job_id) {
    await sql.begin(async (transaction) => {
      const tx = transactionClient(transaction);
      await guardClaim(tx, claim, now);
      await tx`
        UPDATE goal_runs SET state = 'SYNTHESIZING', updated_at = ${now}
        WHERE id = ${runId}::uuid AND state = 'RUNNING'
      `;
    });
    run = (await runSelect(sql, ownerUserId, runId))[0] ?? run;
    await ensureJob(run, synthesis, synthesisPrompt(run, rows), now, sql, claim);
    return;
  }
  if (pending(synthesis)) return;
  if (!admitted(synthesis)) {
    await sql.begin(async (transaction) => {
      const tx = transactionClient(transaction);
      await guardClaim(tx, claim, now);
      runs = await runSelect(tx, ownerUserId, runId);
      if (runs[0]) await terminalizeRun(tx, runs[0], "PARTIAL", now, { errorCode: "GOAL_SYNTHESIS_UNAVAILABLE" });
    });
    return;
  }
  const policy = parseGoalPolicy(run.policy_snapshot);
  let content: ReturnType<typeof synthesisResult>;
  try {
    content = synthesisResult(synthesis.effect_result, policy);
  } catch {
    await sql.begin(async (transaction) => {
      const tx = transactionClient(transaction);
      await guardClaim(tx, claim, now);
      runs = await runSelect(tx, ownerUserId, runId);
      if (runs[0]) await terminalizeRun(tx, runs[0], "PARTIAL", now, { errorCode: "GOAL_SYNTHESIS_MALFORMED" });
    });
    return;
  }
  await sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    await guardClaim(tx, claim, now);
    runs = await runSelect(tx, ownerUserId, runId);
    if (runs[0]) await terminalizeRun(tx, runs[0], "READY", now, {
      report: reportFor(runs[0], "READY", [...accepted, synthesis], content),
    });
  });
}

export async function processGoalRun(
  ownerUserId: string,
  runId: string,
  options: { now?: Date; sql?: DatabaseClient; claim?: GoalRunClaim } = {},
): Promise<GoalRunSnapshot> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const existing = await runSelect(sql, ownerUserId, runId);
  if (!existing[0]) throw new KernelError("KERNEL_NOT_FOUND", "Goal run not found", 404);
  if (existing[0].state === "SCHEDULED") {
    await selectRunAgents(ownerUserId, runId, now, sql, options.claim);
  }
  await reconcileGoalRun(ownerUserId, runId, now, sql, options.claim);
  const rows = await runSelect(sql, ownerUserId, runId);
  if (!rows[0]) throw new Error("GOAL_RUN_READBACK_FAILED");
  return mapGoalRun(sql, rows[0]);
}

async function acquireGoalLoopLease(
  ownerId: string,
  leaseSeconds: number,
  now: Date,
  sql: DatabaseClient,
): Promise<{ epoch: string; expiresAt: Date } | null> {
  if (!IDEMPOTENCY_KEY.test(ownerId) || !Number.isInteger(leaseSeconds) || leaseSeconds < 5 || leaseSeconds > 300) {
    throw new Error("GOAL_LOOP_LEASE_INVALID");
  }
  const expiresAt = new Date(now.getTime() + leaseSeconds * 1_000);
  const rows = await sql<{ owner_id: string; epoch: string; expires_at: Date }[]>`
    INSERT INTO worker_leases (key, owner_id, epoch, heartbeat_at, expires_at, created_at, updated_at)
    VALUES (${GOAL_LOOP_LEASE_KEY}, ${ownerId}, 1, ${now}, ${expiresAt}, ${now}, ${now})
    ON CONFLICT (key) DO UPDATE SET
      owner_id = EXCLUDED.owner_id,
      epoch = CASE WHEN worker_leases.owner_id = EXCLUDED.owner_id THEN worker_leases.epoch ELSE worker_leases.epoch + 1 END,
      heartbeat_at = EXCLUDED.heartbeat_at, expires_at = EXCLUDED.expires_at, updated_at = EXCLUDED.updated_at
    WHERE worker_leases.owner_id = EXCLUDED.owner_id OR worker_leases.expires_at <= ${now}
    RETURNING owner_id, epoch::text, expires_at
  `;
  const lease = rows[0];
  return lease?.owner_id === ownerId ? { epoch: lease.epoch, expiresAt: lease.expires_at } : null;
}

export async function runGoalLoopOnce(options: {
  ownerId: string;
  leaseSeconds: number;
  limit?: number;
  now?: Date;
  sql?: DatabaseClient;
}): Promise<{ leaseAcquired: boolean; claimed: number; processed: number }> {
  const sql = options.sql ?? getDb();
  const now = options.now ?? new Date();
  const limit = options.limit ?? 4;
  if (!Number.isInteger(limit) || limit < 1 || limit > 4) throw new Error("GOAL_LOOP_LIMIT_INVALID");
  const lease = await acquireGoalLoopLease(options.ownerId, options.leaseSeconds, now, sql);
  if (!lease) return { leaseAcquired: false, claimed: 0, processed: 0 };
  const claims = await sql.begin(async (transaction) => {
    const tx = transactionClient(transaction);
    const current = await tx<{ epoch: string }[]>`
      SELECT epoch::text FROM worker_leases
      WHERE key = ${GOAL_LOOP_LEASE_KEY} AND owner_id = ${options.ownerId}
        AND epoch = ${lease.epoch}::bigint AND expires_at > ${now}
      FOR UPDATE
    `;
    if (!current[0]) return [];
    const claimed: GoalRunClaim[] = [];
    const unfinished = await tx<GoalRunRow[]>`
      SELECT id AS run_id, goal_id, owner_user_id, idempotency_key, scheduled_for,
        state, objective_snapshot, capabilities_snapshot, policy_snapshot,
        policy_hash, effect_identity, total_price_atomic::text, report, report_hash,
        error_code, claim_owner, claim_epoch::text, claim_version, claim_expires_at,
        started_at, completed_at, created_at, updated_at
      FROM goal_runs
      WHERE state IN ('SCHEDULED', 'SELECTING', 'RUNNING', 'SYNTHESIZING')
        AND (claim_expires_at IS NULL OR claim_expires_at <= ${now} OR claim_owner = ${options.ownerId})
      ORDER BY scheduled_for ASC, id ASC
      FOR UPDATE SKIP LOCKED LIMIT ${limit}
    `;
    for (const run of unfinished) {
      const claimVersion = run.claim_version + 1;
      const updated = await tx<{ id: string }[]>`
        UPDATE goal_runs SET claim_owner = ${options.ownerId}, claim_epoch = ${lease.epoch}::bigint,
          claim_version = ${claimVersion}, claim_expires_at = ${lease.expiresAt}, updated_at = ${now}
        WHERE id = ${run.run_id}::uuid
          AND effect_identity = ${run.effect_identity}
          AND (claim_expires_at IS NULL OR claim_expires_at <= ${now} OR claim_owner = ${options.ownerId})
        RETURNING id
      `;
      if (!updated[0]) continue;
      const policy = parseGoalPolicy(run.policy_snapshot);
      await tx`
        UPDATE goals SET next_run_at = ${new Date(run.scheduled_for.getTime() + policy.cadenceMinutes * 60_000)},
          updated_at = ${now}
        WHERE id = ${run.goal_id}::uuid AND state = 'ACTIVE' AND next_run_at = ${run.scheduled_for}
      `;
      claimed.push({
        runId: run.run_id,
        ownerUserId: run.owner_user_id,
        ownerId: options.ownerId,
        epoch: lease.epoch,
        claimVersion,
        effectIdentity: run.effect_identity,
        expiresAt: lease.expiresAt,
        disposableTestClock: options.now !== undefined,
      });
    }
    const remaining = limit - claimed.length;
    if (remaining === 0) return claimed;
    const due = await tx<GoalRow[]>`
      SELECT id AS goal_id, owner_user_id, definition_hash, objective, required_capabilities,
        cadence_minutes, run_mode, execution_mode, run_limit, max_agents,
        per_run_cap_atomic::text, daily_cap_atomic::text, state, next_run_at,
        completed_runs, created_at, updated_at
      FROM goals WHERE state = 'ACTIVE' AND next_run_at <= ${now}
      ORDER BY next_run_at ASC, id ASC FOR UPDATE SKIP LOCKED LIMIT ${remaining}
    `;
    for (const goal of due) {
      if (!(await boundedRunAvailable(tx, goal))) {
        await tx`UPDATE goals SET state = 'COMPLETED', next_run_at = NULL, updated_at = ${now} WHERE id = ${goal.goal_id}::uuid`;
        continue;
      }
      const scheduledFor = goal.next_run_at;
      if (!scheduledFor) continue;
      const idempotencyKey = `scheduled:${goal.goal_id}:${scheduledFor.getTime()}`;
      const existingRuns = await tx<GoalRunRow[]>`
        SELECT id AS run_id, goal_id, owner_user_id, idempotency_key, scheduled_for,
          state, objective_snapshot, capabilities_snapshot, policy_snapshot,
          policy_hash, effect_identity, total_price_atomic::text, report, report_hash,
          error_code, claim_owner, claim_epoch::text, claim_version, claim_expires_at,
          started_at, completed_at, created_at, updated_at
        FROM goal_runs WHERE goal_id = ${goal.goal_id}::uuid AND scheduled_for = ${scheduledFor}
      `;
      const run = existingRuns[0] ?? await insertGoalRun(tx, goal, idempotencyKey, scheduledFor, now);
      const nextRunAt = new Date(scheduledFor.getTime() + goal.cadence_minutes * 60_000);
      await tx`UPDATE goals SET next_run_at = ${nextRunAt}, updated_at = ${now} WHERE id = ${goal.goal_id}::uuid`;
      if (TERMINAL_RUN_STATES.has(run.state)) continue;
      const claimVersion = run.claim_version + 1;
      const updated = await tx<{ id: string }[]>`
        UPDATE goal_runs SET claim_owner = ${options.ownerId}, claim_epoch = ${lease.epoch}::bigint,
          claim_version = ${claimVersion}, claim_expires_at = ${lease.expiresAt}, updated_at = ${now}
        WHERE id = ${run.run_id}::uuid
          AND (claim_expires_at IS NULL OR claim_expires_at <= ${now} OR claim_owner = ${options.ownerId})
        RETURNING id
      `;
      if (updated[0]) claimed.push({
        runId: run.run_id,
        ownerUserId: run.owner_user_id,
        ownerId: options.ownerId,
        epoch: lease.epoch,
        claimVersion,
        effectIdentity: run.effect_identity,
        expiresAt: lease.expiresAt,
        disposableTestClock: options.now !== undefined,
      });
    }
    return claimed;
  });
  let processed = 0;
  for (const claim of claims) {
    await processGoalRun(claim.ownerUserId, claim.runId, { claim, now, sql });
    processed += 1;
  }
  return { leaseAcquired: true, claimed: claims.length, processed };
}
