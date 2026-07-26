import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import {
  createEnsPublicationAuthority,
  createEnsPublicationPolicyDocument,
  type EnsPublicationAuthority,
} from "../../src/ens/authority";
import { domainHash, type CanonicalValue } from "../../src/kernel/canonical";
import { buildManifestV3, buildManifestV4, buildManifestV5 } from "../../src/kernel/agent-catalog";
import { patchAugmentedLayerPolicy } from "../../src/kernel/augmented-layer-policy";
import { KernelError } from "../../src/kernel/errors";
import {
  createGoal,
  createGoalRun,
  getGoal,
  getGoalRun,
  listGoalRuns,
  parseGoalCreate,
  parseGoalPatch,
  patchGoal,
  processGoalRun,
  runGoalLoopOnce,
} from "../../src/kernel/goals";
import {
  bindAgentName,
  createAgentDraft,
  listAgentLifecycle,
  prepareAgentEnsWrite,
  publishAgentVersion,
} from "../../src/kernel/lifecycle";
import { parseAgentInput, parseEnsBinding } from "../../src/kernel/policy";
import { cancelBuyerJob } from "../../src/kernel/service";
import type {
  AdapterExecutionRequest,
  AdapterExecutionResult,
  KernelAdapter,
} from "../../src/worker/adapter";
import type { GoalRunReportV1, GoalRunState, RiskLane } from "../../src/kernel/types";
import type { McpContextProvider } from "../../src/kernel/mcp-context";
import { runWorkerOnce } from "../../src/worker/runner";
import {
  configureDatabaseEnvironment,
  startDisposableDatabase,
  type DisposableDatabase,
} from "../helpers/postgres";
import {
  createEnsAuthorityFixture,
  createEnsPublicationAuthorityFixture,
} from "../helpers/ens";

const BUYER_ID = "goal-buyer";
const CREATOR_A_ID = "goal-creator-a";
const CREATOR_B_ID = "goal-creator-b";
const OTHER_ID = "goal-other";
const BUYER_WALLET = "0x1111111111111111111111111111111111111111";
const CREATOR_A_WALLET = "0x2222222222222222222222222222222222222222";
const CREATOR_B_WALLET = "0x3333333333333333333333333333333333333333";
const OTHER_WALLET = "0x4444444444444444444444444444444444444444";
const NOW = new Date("2026-07-25T15:00:00.000Z");
const RELEASE_SHA = "8".repeat(40);

class GoalResultAdapter implements KernelAdapter {
  readonly key = "protected-a3" as const;
  constructor(private readonly result: CanonicalValue) {}

  async execute(request: AdapterExecutionRequest): Promise<AdapterExecutionResult> {
    return {
      ok: true,
      result: this.result,
      proofHash: domainHash("goal-test-proof", request.effectId),
      verified: true,
    };
  }
}

class FixedGoalMcpProvider implements McpContextProvider {
  async invoke(binding: Parameters<McpContextProvider["invoke"]>[0]): Promise<unknown> {
    return { bindingId: binding.id, observed: true, value: 42 };
  }
}

function at(milliseconds: number): Date {
  return new Date(NOW.getTime() + milliseconds);
}

async function publicationAuthority(
  database: DisposableDatabase,
  versionId: string,
  now: Date,
): Promise<{ authority: EnsPublicationAuthority; close: () => Promise<void> }> {
  const role = `goal_pub_${process.pid}_${randomUUID().replaceAll("-", "").slice(0, 8)}`;
  const password = randomBytes(32).toString("base64url");
  const commands = await database.sql<{ create_role: string; grant_role: string }[]>`
    SELECT
      format(
        'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT',
        ${role}::text, ${password}::text
      ) AS create_role,
      format('GRANT alphadawg_runtime TO %I', ${role}::text) AS grant_role
  `;
  if (!commands[0]) throw new Error("TEST_ROLE_COMMAND_INVALID");
  await database.sql.unsafe(commands[0].create_role);
  await database.sql.unsafe(commands[0].grant_role);
  const runtimeUrl = new URL(database.url);
  runtimeUrl.username = role;
  runtimeUrl.password = password;
  const runtimeSql = postgres(runtimeUrl.toString(), { max: 1, prepare: false });
  await database.sql`
    INSERT INTO ens_publication_authority_releases (release_sha, not_before, expires_at)
    VALUES (${RELEASE_SHA}, ${new Date(now.getTime() - 60_000)}, ${new Date(now.getTime() + 3_600_000)})
    ON CONFLICT (release_sha) DO NOTHING
  `;
  const fixture = createEnsPublicationAuthorityFixture({ now });
  const authority = createEnsPublicationAuthority({ sql: runtimeSql, runtime: fixture.runtime, now });
  const missingPolicy = await authority({ agentVersionId: versionId });
  assert.equal(missingPolicy.allowed, false);
  const binding = fixture.resolver.calls.at(-1)?.binding;
  assert.ok(binding);
  await database.sql`
    INSERT INTO ens_publication_authority_policies (
      release_sha, agent_version_id, binding, binding_hash
    ) VALUES (
      ${RELEASE_SHA}, ${versionId}::uuid,
      ${database.sql.json(JSON.parse(JSON.stringify(createEnsPublicationPolicyDocument(binding))))},
      ${"0".repeat(64)}
    )
  `;
  fixture.resolver.calls.length = 0;
  return {
    authority,
    close: async () => {
      await runtimeSql.end({ timeout: 1 });
      const drops = await database.sql<{ command: string }[]>`
        SELECT format('DROP ROLE %I', ${role}::text) AS command
      `;
      if (!drops[0]) throw new Error("TEST_ROLE_COMMAND_INVALID");
      await database.sql.unsafe(drops[0].command);
    },
  };
}

async function publishAgent(
  database: DisposableDatabase,
  owner: { id: string; wallet: string },
  input: {
    name: string;
    parent: string;
    label: string;
    capabilities: string[];
    templateId?: string;
    riskTiers?: readonly RiskLane[];
    manifestVersion?: 4 | 5;
  },
): Promise<string> {
  const publishedAt = new Date();
  const manifest = input.templateId && input.riskTiers
    ? (input.manifestVersion === 5 ? buildManifestV5 : buildManifestV4)({
        templateId: input.templateId,
        name: input.name,
        description: "A bounded protected goal-loop specialist for deterministic tests.",
        ownerWallet: owner.wallet,
        riskTiers: input.riskTiers,
      })
    : input.templateId
      ? buildManifestV3({
        templateId: input.templateId,
        name: input.name,
        description: "A bounded protected goal-loop specialist for deterministic tests.",
        ownerWallet: owner.wallet,
      })
      : parseAgentInput({
        name: input.name,
        description: "A bounded protected goal-loop specialist for deterministic tests.",
        instructions: "## Task\n\nReturn a concise evidence-backed goal analysis result.",
        capabilities: input.capabilities,
      }, owner.wallet).manifest;
  const draft = await createAgentDraft(
    { userId: owner.id, walletAddress: owner.wallet },
    manifest,
    { idempotencyKey: `draft-${input.label}-01`, now: publishedAt, sql: database.sql },
  );
  await bindAgentName(owner.id, draft.versionId, parseEnsBinding({
    creatorParent: input.parent,
    agentLabel: input.label,
  }), { idempotencyKey: `bind-${input.label}-01`, now: publishedAt, sql: database.sql });
  await prepareAgentEnsWrite(owner.id, draft.versionId, {
    idempotencyKey: `prepare-${input.label}-01`, now: publishedAt, sql: database.sql,
  });
  const publication = await publicationAuthority(database, draft.versionId, publishedAt);
  try {
    const published = await publishAgentVersion(owner.id, draft.versionId, {
      authority: publication.authority,
      idempotencyKey: `publish-${input.label}-01`,
      now: publishedAt,
      sql: database.sql,
    });
    return published.versionId;
  } finally {
    await publication.close();
  }
}

function activeGoal(input: {
  objective: string;
  capabilities: string[];
  runMode?: "BOUNDED" | "CONTINUOUS";
  runLimit?: number | null;
  maxAgents?: number;
  perRunCapAtomic?: string;
  dailyCapAtomic?: string | null;
}) {
  const runMode = input.runMode ?? "BOUNDED";
  return parseGoalCreate({
    objective: input.objective,
    requiredCapabilities: input.capabilities,
    state: "ACTIVE",
    policy: {
      cadenceMinutes: 5,
      runMode,
      executionMode: "RESEARCH_ONLY",
      runLimit: runMode === "BOUNDED" ? input.runLimit ?? 10 : null,
      maxAgents: input.maxAgents ?? 2,
      perRunCapAtomic: input.perRunCapAtomic ?? "3000",
      dailyCapAtomic: runMode === "CONTINUOUS" ? input.dailyCapAtomic ?? "3000" : null,
    },
  });
}

function authorityFor(fullSubname: string, now: Date) {
  const [label, ...parent] = fullSubname.split(".");
  return createEnsAuthorityFixture({
    now,
    ensv2: true,
    runtime: {
      creatorName: parent.join("."),
      agentLabel: label,
      agentName: fullSubname,
    },
  }).runtime;
}

async function deliverNext(
  database: DisposableDatabase,
  fullSubname: string,
  now: Date,
  result: CanonicalValue,
): Promise<void> {
  const worker = await runWorkerOnce({
    ownerId: "goal-worker-01",
    concurrency: 1,
    leaseSeconds: 30,
    adapter: new GoalResultAdapter(result),
    authority: authorityFor(fullSubname, now),
    sql: database.sql,
    now,
  });
  assert.equal(worker.claimed, 1);
}

test("goal policy validation is strict and atomic-unit bounded", () => {
  assert.throws(() => parseGoalCreate({
    objective: "Reject unsupported cadence values.",
    requiredCapabilities: ["research"],
    state: "ACTIVE",
    policy: {
      cadenceMinutes: 7,
      runMode: "BOUNDED",
      executionMode: "RESEARCH_ONLY",
      runLimit: 1,
      maxAgents: 1,
      perRunCapAtomic: "1000",
      dailyCapAtomic: null,
    },
  }), /cadenceMinutes/);
  assert.throws(() => parseGoalCreate({
    objective: "Continuous execution must have a daily cap.",
    requiredCapabilities: ["research"],
    state: "ACTIVE",
    policy: {
      cadenceMinutes: 5,
      runMode: "CONTINUOUS",
      executionMode: "RESEARCH_ONLY",
      runLimit: null,
      maxAgents: 1,
      perRunCapAtomic: "1000",
      dailyCapAtomic: null,
    },
  }), /dailyCapAtomic/);
  assert.throws(() => parseGoalCreate({
    objective: "Bounded execution requires an exact run limit.",
    requiredCapabilities: ["research"],
    state: "ACTIVE",
    policy: {
      cadenceMinutes: 15,
      runMode: "BOUNDED",
      executionMode: "PROPOSE_SWAP",
      runLimit: 101,
      maxAgents: 4,
      perRunCapAtomic: "01",
      dailyCapAtomic: null,
    },
  }), /runLimit|positive decimal/);
});

test("goal runner claims one scheduled slot under concurrent leases", async () => {
  const database = await startDisposableDatabase("goal-runner");
  configureDatabaseEnvironment(database.url);
  try {
    await database.sql`
      INSERT INTO users (id, wallet_address) VALUES (${BUYER_ID}, ${BUYER_WALLET})
    `;
    const goal = await createGoal(BUYER_ID, activeGoal({
      objective: "Claim this due slot once and fail closed when no external agent exists.",
      capabilities: ["research"],
      runLimit: 2,
      maxAgents: 1,
      perRunCapAtomic: "1000",
    }), "goal-runner-create-01", { now: NOW, sql: database.sql });
    const attempts = await Promise.all([
      runGoalLoopOnce({
        ownerId: "goal-runner-a", leaseSeconds: 30, now: NOW, sql: database.sql,
      }),
      runGoalLoopOnce({
        ownerId: "goal-runner-b", leaseSeconds: 30, now: NOW, sql: database.sql,
      }),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.leaseAcquired).length, 1);
    assert.equal(attempts.reduce((sum, attempt) => sum + attempt.claimed, 0), 1);
    const runs = await listGoalRuns(BUYER_ID, goal.goal.goalId, { sql: database.sql });
    assert.equal(runs.length, 1);
    assert.equal(runs[0]?.state, "BLOCKED");
    assert.equal(runs[0]?.jobs.length, 0);
    const winner = attempts.find((attempt) => attempt.leaseAcquired);
    assert.ok(winner);
    const replay = await runGoalLoopOnce({
      ownerId: attempts[0]?.leaseAcquired ? "goal-runner-a" : "goal-runner-b",
      leaseSeconds: 30,
      now: at(1_000),
      sql: database.sql,
    });
    assert.equal(replay.claimed, 0);
    assert.equal((await listGoalRuns(BUYER_ID, goal.goal.goalId, { sql: database.sql })).length, 1);
  } finally {
    await database.close();
  }
});

test("protected goals match, hire, synthesize, cap, isolate, and expose optional provenance", async (t) => {
  const database = await startDisposableDatabase("goal-loop");
  configureDatabaseEnvironment(database.url);
  try {
    await database.sql`
      INSERT INTO users (id, wallet_address) VALUES
        (${BUYER_ID}, ${BUYER_WALLET}),
        (${CREATOR_A_ID}, ${CREATOR_A_WALLET}),
        (${CREATOR_B_ID}, ${CREATOR_B_WALLET}),
        (${OTHER_ID}, ${OTHER_WALLET})
    `;
    const marketVersion = await publishAgent(database, {
      id: CREATOR_A_ID, wallet: CREATOR_A_WALLET,
    }, {
      name: "Market Goal Agent", parent: "alice.eth", label: "market",
      capabilities: ["market-analysis"],
    });
    const riskVersion = await publishAgent(database, {
      id: CREATOR_B_ID, wallet: CREATOR_B_WALLET,
    }, {
      name: "Risk Research Agent", parent: "bob.eth", label: "risk",
      capabilities: ["risk-analysis", "research"],
    });
    const selfVersion = await publishAgent(database, {
      id: BUYER_ID, wallet: BUYER_WALLET,
    }, {
      name: "Self Owned Agent", parent: "buyer.eth", label: "self",
      capabilities: ["market-analysis", "risk-analysis", "research"],
    });
    const terminalRunIds = new Map<GoalRunState, string>();
    let canonicalReady: { runId: string; report: GoalRunReportV1; reportHash: string } | null = null;

    await t.test("matching is deterministic, excludes self, freezes versions, and synthesizes verified outputs", async () => {
      const created = await createGoal(BUYER_ID, activeGoal({
        objective: "Compare market direction with downside risk and condense the evidence.",
        capabilities: ["market-analysis", "risk-analysis"],
        runLimit: 2,
      }), "goal-multi-create-01", { now: NOW, sql: database.sql });
      const first = await createGoalRun(BUYER_ID, created.goal.goalId, "goal-multi-run-01", {
        now: at(1_000), sql: database.sql,
      });
      assert.equal(first.run.state, "RUNNING");
      const analysis = first.run.jobs.filter((job) => job.role === "ANALYSIS");
      assert.equal(analysis.length, 2);
      assert.equal(first.run.jobs.filter((job) => job.role === "SYNTHESIS").length, 1);
      assert.deepEqual(
        analysis.map((job) => job.agentVersionId),
        [marketVersion, riskVersion],
      );
      assert.ok(analysis.every((job) => job.agentVersionId !== selfVersion && job.jobId));
      assert.equal(first.run.totalPriceAtomic, "3000");

      const replay = await createGoalRun(BUYER_ID, created.goal.goalId, "goal-multi-run-01", {
        now: at(1_000), sql: database.sql,
      });
      assert.equal(replay.replayed, true);
      assert.equal(replay.run.runId, first.run.runId);
      assert.deepEqual(replay.run.jobs, first.run.jobs);

      await deliverNext(database, analysis[0]?.fullSubname ?? "", at(2_000), {
        summary: "Market evidence is constructive.", conclusion: "Bias remains conditional.",
      });
      await deliverNext(database, analysis[1]?.fullSubname ?? "", at(3_000), {
        summary: "Risk evidence is bounded.", conclusion: "Downside controls are required.",
      });
      const synthesizing = await processGoalRun(BUYER_ID, first.run.runId, {
        now: at(4_000), sql: database.sql,
      });
      assert.equal(synthesizing.state, "SYNTHESIZING");
      const synthesis = synthesizing.jobs.find((job) => job.role === "SYNTHESIS");
      assert.ok(synthesis?.jobId);
      await deliverNext(database, synthesis.fullSubname ?? "", at(5_000), {
        schemaVersion: 1,
        summary: "Verified market and risk outputs agree on a cautious bias.",
        conclusion: "Research only; no transaction is authorized.",
        swapProposal: null,
      });
      const ready = await processGoalRun(BUYER_ID, first.run.runId, {
        now: at(6_000), sql: database.sql,
      });
      assert.equal(ready.state, "READY");
      assert.equal(ready.report?.status, "READY");
      assert.equal(ready.report?.swapProposal, null);
      assert.equal(ready.report?.evidence.length, 3);
      assert.match(ready.reportHash ?? "", /^[0-9a-f]{64}$/);
      assert.ok(ready.report && ready.reportHash);
      terminalRunIds.set("READY", ready.runId);
      canonicalReady = { runId: ready.runId, report: ready.report, reportHash: ready.reportHash };

      const second = await createGoalRun(BUYER_ID, created.goal.goalId, "goal-multi-run-02", {
        now: at(10_000), sql: database.sql,
      });
      const queued = await database.sql<{ job_id: string; full_subname: string }[]>`
        SELECT link.job_id, link.full_subname_snapshot AS full_subname
        FROM goal_run_jobs link JOIN jobs job ON job.id = link.job_id
        WHERE link.goal_run_id = ${second.run.runId}::uuid AND link.role = 'ANALYSIS'
        ORDER BY job.created_at ASC, job.id ASC
      `;
      assert.equal(queued.length, 2);
      await deliverNext(database, queued[0]?.full_subname ?? "", at(11_000), {
        summary: "One verified output exists.", conclusion: "A required output is absent.",
      });
      await cancelBuyerJob(BUYER_ID, queued[1]?.job_id ?? "", {
        now: at(12_000), sql: database.sql,
      });
      const partial = await processGoalRun(BUYER_ID, second.run.runId, {
        now: at(13_000), sql: database.sql,
      });
      assert.equal(partial.state, "PARTIAL");
      assert.equal(partial.report?.status, "PARTIAL");
      assert.equal(partial.report?.swapProposal, null);
      assert.equal(partial.report?.evidence.length, 1);
      terminalRunIds.set("PARTIAL", partial.runId);
      assert.equal((await getGoal(BUYER_ID, created.goal.goalId))?.state, "COMPLETED");
      await assert.rejects(
        createGoalRun(BUYER_ID, created.goal.goalId, "goal-multi-run-03", { sql: database.sql }),
        (error: unknown) => error instanceof KernelError && error.code === "KERNEL_ILLEGAL_TRANSITION",
      );
    });

    await t.test("missing coverage and insufficient budgets block before jobs", async () => {
      const missing = await createGoal(BUYER_ID, activeGoal({
        objective: "Require a capability that no external published agent provides.",
        capabilities: ["uniswap-swap"],
        maxAgents: 1,
        perRunCapAtomic: "1000",
      }), "goal-missing-create-01", { now: at(20_000), sql: database.sql });
      const missingRun = await createGoalRun(BUYER_ID, missing.goal.goalId, "goal-missing-run-01", {
        now: at(21_000), sql: database.sql,
      });
      assert.equal(missingRun.run.state, "BLOCKED");
      assert.equal(missingRun.run.errorCode, "GOAL_CAPABILITY_UNAVAILABLE");
      assert.equal(missingRun.run.jobs.length, 0);
      terminalRunIds.set("BLOCKED", missingRun.run.runId);

      const budget = await createGoal(BUYER_ID, activeGoal({
        objective: "Refuse before hiring when the exact selected price exceeds the cap.",
        capabilities: ["research"],
        maxAgents: 1,
        perRunCapAtomic: "999",
      }), "goal-budget-create-01", { now: at(22_000), sql: database.sql });
      const budgetRun = await createGoalRun(BUYER_ID, budget.goal.goalId, "goal-budget-run-01", {
        now: at(23_000), sql: database.sql,
      });
      assert.equal(budgetRun.run.state, "BLOCKED");
      assert.equal(budgetRun.run.errorCode, "GOAL_PER_RUN_CAP_EXCEEDED");
      assert.equal(budgetRun.run.jobs.length, 0);
    });

    await t.test("continuous reservations serialize concurrent runs and charge delayed slots on the actual day", async () => {
      const concurrent = await createGoal(BUYER_ID, activeGoal({
        objective: "Serialize concurrent continuous runs before any extra hire can be created.",
        capabilities: ["research"], runMode: "CONTINUOUS", maxAgents: 1,
        perRunCapAtomic: "1000", dailyCapAtomic: "1000",
      }), "goal-concurrent-create-01", { now: at(24_000), sql: database.sql });
      const concurrentRuns = await Promise.all([
        createGoalRun(BUYER_ID, concurrent.goal.goalId, "goal-concurrent-run-01", {
          now: at(24_001), sql: database.sql,
        }),
        createGoalRun(BUYER_ID, concurrent.goal.goalId, "goal-concurrent-run-02", {
          now: at(24_002), sql: database.sql,
        }),
      ]);
      assert.equal(concurrentRuns.filter(({ run }) => run.state === "RUNNING").length, 1);
      assert.equal(concurrentRuns.filter(({ run }) => run.state === "BLOCKED").length, 1);
      const concurrentTotals = await database.sql<{ reserved: string; jobs: string }[]>`
        SELECT COALESCE(sum(total_price_atomic), 0)::text AS reserved,
          (SELECT count(*)::text FROM jobs WHERE buyer_user_id = ${BUYER_ID}
            AND id IN (SELECT job_id FROM goal_run_jobs WHERE goal_run_id IN (
              SELECT id FROM goal_runs WHERE goal_id = ${concurrent.goal.goalId}::uuid
            ))) AS jobs
        FROM goal_runs WHERE goal_id = ${concurrent.goal.goalId}::uuid
      `;
      assert.deepEqual(concurrentTotals[0], { reserved: "1000", jobs: "1" });

      const delayed = await createGoal(BUYER_ID, activeGoal({
        objective: "Charge delayed scheduled work against the day its cost is actually reserved.",
        capabilities: ["research"], runMode: "CONTINUOUS", maxAgents: 1,
        perRunCapAtomic: "1000", dailyCapAtomic: "1000",
      }), "goal-delayed-create-01", { now: at(25_000), sql: database.sql });
      const beforeReservation = new Date();
      const currentRun = await createGoalRun(BUYER_ID, delayed.goal.goalId, "goal-delayed-current-01", {
        now: at(25_001), sql: database.sql,
      });
      const afterReservation = new Date();
      assert.equal(currentRun.run.state, "RUNNING");
      assert.ok(currentRun.run.costReservedAt);
      const reservedAt = new Date(currentRun.run.costReservedAt);
      assert.ok(reservedAt >= beforeReservation && reservedAt <= afterReservation);
      const historicalSlot = new Date("2026-07-20T10:00:00.000Z");
      const delayedRows = await database.sql<{ id: string }[]>`
        INSERT INTO goal_runs (
          goal_id, owner_user_id, idempotency_key, scheduled_for, state,
          objective_snapshot, capabilities_snapshot, policy_snapshot, policy_hash,
          effect_identity, created_at, updated_at
        ) VALUES (
          ${delayed.goal.goalId}::uuid, ${BUYER_ID}, 'goal-delayed-slot-01', ${historicalSlot}, 'SCHEDULED',
          ${delayed.goal.objective}, ${[...delayed.goal.requiredCapabilities]},
          ${database.sql.json(delayed.goal.policy)}, ${domainHash("goal-policy", delayed.goal.policy)},
          ${domainHash("goal-delayed-slot", { goalId: delayed.goal.goalId, scheduledFor: historicalSlot.toISOString() })},
          ${at(25_002)}, ${at(25_002)}
        ) RETURNING id
      `;
      assert.ok(delayedRows[0]);
      const delayedRun = await processGoalRun(BUYER_ID, delayedRows[0].id, {
        now: at(25_003), sql: database.sql,
      });
      assert.equal(delayedRun.state, "BLOCKED");
      assert.equal(delayedRun.errorCode, "GOAL_DAILY_CAP_EXCEEDED");
      assert.equal(delayedRun.costReservedAt, null);
      assert.equal(delayedRun.jobs.length, 0);
    });

    await t.test("continuous daily cap, failed results, pause/resume, canceled slots, and tenant isolation are explicit", async () => {
      const continuous = await createGoal(BUYER_ID, activeGoal({
        objective: "Run bounded research continuously without exceeding the daily cap.",
        capabilities: ["research"],
        runMode: "CONTINUOUS",
        maxAgents: 1,
        perRunCapAtomic: "1000",
        dailyCapAtomic: "1000",
      }), "goal-daily-create-01", { now: at(30_000), sql: database.sql });
      const paidSlot = await createGoalRun(BUYER_ID, continuous.goal.goalId, "goal-daily-run-01", {
        now: at(31_000), sql: database.sql,
      });
      assert.equal(paidSlot.run.state, "RUNNING");
      const capped = await createGoalRun(BUYER_ID, continuous.goal.goalId, "goal-daily-run-02", {
        now: at(32_000), sql: database.sql,
      });
      assert.equal(capped.run.state, "BLOCKED");
      assert.equal(capped.run.errorCode, "GOAL_DAILY_CAP_EXCEEDED");
      assert.equal(capped.run.jobs.length, 0);

      const failedGoal = await createGoal(BUYER_ID, activeGoal({
        objective: "Expose a failed run when no selected output is receipt-bound and verified.",
        capabilities: ["research"], maxAgents: 1, perRunCapAtomic: "1000",
      }), "goal-failed-create-01", { now: at(33_000), sql: database.sql });
      const failedRun = await createGoalRun(BUYER_ID, failedGoal.goal.goalId, "goal-failed-run-01", {
        now: at(34_000), sql: database.sql,
      });
      await cancelBuyerJob(BUYER_ID, failedRun.run.jobs[0]?.jobId ?? "", {
        now: at(35_000), sql: database.sql,
      });
      const failed = await processGoalRun(BUYER_ID, failedRun.run.runId, {
        now: at(36_000), sql: database.sql,
      });
      assert.equal(failed.state, "FAILED");
      assert.equal(failed.errorCode, "GOAL_NO_VERIFIED_OUTPUT");
      terminalRunIds.set("FAILED", failed.runId);

      const draft = await createGoal(BUYER_ID, parseGoalCreate({
        objective: "Pause, edit, and resume this goal without changing historical runs.",
        requiredCapabilities: ["research"],
        state: "DRAFT",
        policy: {
          cadenceMinutes: 15, runMode: "BOUNDED", executionMode: "RESEARCH_ONLY",
          runLimit: 3, maxAgents: 1, perRunCapAtomic: "1000", dailyCapAtomic: null,
        },
      }), "goal-state-create-01", { now: at(37_000), sql: database.sql });
      const active = await patchGoal(BUYER_ID, draft.goal.goalId, parseGoalPatch({ action: "ACTIVATE" }),
        "goal-state-activate-01", { now: at(38_000), sql: database.sql });
      assert.equal(active.state, "ACTIVE");
      assert.equal((await patchGoal(
        BUYER_ID,
        draft.goal.goalId,
        parseGoalPatch({ action: "ACTIVATE" }),
        "goal-state-activate-01",
        { now: at(38_000), sql: database.sql },
      )).state, "ACTIVE");
      await assert.rejects(
        patchGoal(
          BUYER_ID,
          draft.goal.goalId,
          parseGoalPatch({ action: "PAUSE" }),
          "goal-state-activate-01",
          { now: at(38_000), sql: database.sql },
        ),
        (error: unknown) => error instanceof KernelError && error.code === "KERNEL_IDEMPOTENCY_MISMATCH",
      );
      const policy = active.policy;
      const scheduledFor = at(39_000);
      await database.sql`
        INSERT INTO goal_runs (
          goal_id, owner_user_id, idempotency_key, scheduled_for, state,
          objective_snapshot, capabilities_snapshot, policy_snapshot, policy_hash,
          effect_identity, created_at, updated_at
        ) VALUES (
          ${active.goalId}::uuid, ${BUYER_ID}, 'goal-raw-slot-01', ${scheduledFor}, 'SCHEDULED',
          ${active.objective}, ${[...active.requiredCapabilities]}, ${database.sql.json(policy)},
          ${domainHash("goal-policy", policy)},
          ${domainHash("goal-test-slot", { goalId: active.goalId, scheduledFor: scheduledFor.toISOString() })},
          ${scheduledFor}, ${scheduledFor}
        )
      `;
      const paused = await patchGoal(BUYER_ID, active.goalId, parseGoalPatch({ action: "PAUSE" }),
        "goal-state-pause-01", { now: at(40_000), sql: database.sql });
      assert.equal(paused.state, "PAUSED");
      const canceled = await database.sql<{ id: string; state: string }[]>`
        SELECT id, state FROM goal_runs WHERE goal_id = ${active.goalId}::uuid AND scheduled_for = ${scheduledFor}
      `;
      assert.equal(canceled[0]?.state, "CANCELED");
      assert.ok(canceled[0]?.id);
      terminalRunIds.set("CANCELED", canceled[0].id);
      const resumed = await patchGoal(BUYER_ID, active.goalId, parseGoalPatch({ action: "RESUME" }),
        "goal-state-resume-01", { now: at(41_000), sql: database.sql });
      assert.equal(resumed.state, "ACTIVE");
      const delayedPauseReplay = await patchGoal(
        BUYER_ID,
        active.goalId,
        parseGoalPatch({ action: "PAUSE" }),
        "goal-state-pause-01",
        { now: at(42_000), sql: database.sql },
      );
      assert.equal(delayedPauseReplay.state, "PAUSED");
      assert.equal((await getGoal(BUYER_ID, active.goalId, { sql: database.sql }))?.state, "ACTIVE");
      await assert.rejects(
        patchGoal(
          BUYER_ID,
          active.goalId,
          parseGoalPatch({ action: "RESUME" }),
          "goal-state-pause-01",
          { now: at(43_000), sql: database.sql },
        ),
        (error: unknown) => error instanceof KernelError && error.code === "KERNEL_IDEMPOTENCY_MISMATCH",
      );
      await assert.rejects(database.sql`
        UPDATE goal_mutations SET payload_hash = ${"0".repeat(64)}
        WHERE owner_user_id = ${BUYER_ID} AND idempotency_key = 'goal-state-pause-01'
      `, /append-only/);
      assert.equal((await listGoalRuns(BUYER_ID, active.goalId, { sql: database.sql })).length, 1);
      await assert.rejects(
        listGoalRuns(OTHER_ID, active.goalId, { sql: database.sql }),
        (error: unknown) => error instanceof KernelError && error.code === "KERNEL_NOT_FOUND",
      );
      assert.equal(await getGoalRun(OTHER_ID, failed.runId, { sql: database.sql }), null);
    });

    await t.test("per-version iNFT provenance is optional, immutable, and never changes hireability", async () => {
      await database.sql`
        INSERT INTO agent_version_provenance (
          agent_version_id, protocol, chain_id, contract_address, token_id,
          metadata_uri, evidence_hash, observed_at
        ) VALUES (
          ${riskVersion}::uuid, 'INFT', 11155111,
          '0x5555555555555555555555555555555555555555', '42',
          'ipfs://bafybeigoalprovenance', ${"a".repeat(64)}, ${at(50_000)}
        )
      `;
      const catalog = await listAgentLifecycle(BUYER_ID, { sql: database.sql });
      const withProvenance = catalog.agents.find((agent) => agent.versionId === riskVersion);
      const withoutProvenance = catalog.agents.find((agent) => agent.versionId === marketVersion);
      assert.equal(withProvenance?.provenance?.tokenId, "42");
      assert.equal(withProvenance?.hireable, true);
      assert.equal(withProvenance?.verifiedExternalHires, 0);
      assert.equal(withoutProvenance?.provenance, null);
      await assert.rejects(database.sql`
        UPDATE agent_version_provenance SET token_id = '43'
        WHERE agent_version_id = ${riskVersion}::uuid
      `, /append-only/);
      await assert.rejects(database.sql`
        INSERT INTO agent_version_provenance (
          agent_version_id, protocol, chain_id, contract_address, token_id,
          evidence_hash, observed_at
        ) VALUES (
          ${marketVersion}::uuid, 'INFT', 11155111,
          '0xNOTANADDRESS', '007', ${"b".repeat(64)}, ${at(51_000)}
        )
      `, /agent_version_provenance_address_check|agent_version_provenance_token_check/);
    });

    await t.test("equal coverage prefers the least-privileged agent before hires and price", async () => {
      const liquidityVersion = await publishAgent(database, {
        id: CREATOR_A_ID, wallet: CREATOR_A_WALLET,
      }, {
        name: "Least Privilege Liquidity", parent: "alice.eth", label: "least-liquidity",
        capabilities: ["research", "market-analysis"], templateId: "liquidity-scout",
      });
      await publishAgent(database, {
        id: CREATOR_B_ID, wallet: CREATOR_B_WALLET,
      }, {
        name: "Excess Thesis", parent: "bob.eth", label: "excess-thesis",
        capabilities: ["research", "market-analysis", "risk-analysis"],
        templateId: "thesis-synthesizer",
      });
      const goal = await createGoal(BUYER_ID, activeGoal({
        objective: "Research the bounded liquidity snapshot with minimum authority.",
        capabilities: ["research", "market-analysis"],
        runLimit: 1,
        maxAgents: 1,
        perRunCapAtomic: "1000",
      }), "goal-least-privilege-create-01", { now: at(41_000), sql: database.sql });
      const run = await createGoalRun(BUYER_ID, goal.goal.goalId, "goal-least-privilege-run-01", {
        now: at(42_000),
        sql: database.sql,
        mcpProvider: new FixedGoalMcpProvider(),
      });
      assert.equal(run.run.state, "RUNNING");
      assert.equal(run.run.jobs.length, 1);
      assert.equal(run.run.jobs[0]?.agentVersionId, liquidityVersion);

      const failureGoal = await createGoal(BUYER_ID, activeGoal({
        objective: "Fail closed before job creation when Graph evidence is unavailable.",
        capabilities: ["research", "market-analysis"],
        runLimit: 1,
        maxAgents: 1,
        perRunCapAtomic: "1000",
      }), "goal-graph-failure-create-01", { now: at(43_000), sql: database.sql });
      const failed = await createGoalRun(
        BUYER_ID,
        failureGoal.goal.goalId,
        "goal-graph-failure-run-01",
        {
          now: at(44_000),
          sql: database.sql,
          mcpProvider: { invoke: async () => { throw new Error("private provider detail"); } },
        },
      );
      assert.equal(failed.run.state, "BLOCKED");
      assert.equal(failed.run.errorCode, "GOAL_MCP_PROVIDER_FAILED");
      assert.equal(failed.run.jobs.length, 1);
      assert.equal(failed.run.jobs[0]?.jobId, null);
      const jobCount = await database.sql<{ count: number }[]>`
        SELECT count(*)::int AS count FROM jobs job
        JOIN goal_run_jobs link ON link.job_id = job.id
        WHERE link.goal_run_id = ${failed.run.runId}::uuid
      `;
      assert.equal(jobCount[0]?.count, 0);
    });

    await t.test("catalog v3 publishes through the same lifecycle and blocks without MCP context", async () => {
      const swapVersion = await publishAgent(database, {
        id: CREATOR_B_ID, wallet: CREATOR_B_WALLET,
      }, {
        name: "Catalog Swap Strategist", parent: "bob.eth", label: "catalog-swap",
        capabilities: ["market-analysis", "risk-analysis", "uniswap-swap"],
        templateId: "swap-strategist",
      });
      const catalog = await listAgentLifecycle(BUYER_ID, { sql: database.sql });
      const published = catalog.agents.find((agent) => agent.versionId === swapVersion);
      assert.equal(published?.manifestSchemaVersion, 3);
      assert.equal(published?.mcpAvailability, "UNAVAILABLE");
      assert.equal(published?.mcpSummary?.length, 4);
      assert.equal(published?.reviewedSources?.length, 4);

      const created = await createGoal(BUYER_ID, activeGoal({
        objective: "Propose a bounded swap analysis only when MCP evidence is available.",
        capabilities: ["uniswap-swap"],
        runLimit: 1,
        maxAgents: 1,
        perRunCapAtomic: "1000",
      }), "goal-v3-mcp-create-01", { now: NOW, sql: database.sql });
      const run = await createGoalRun(
        BUYER_ID,
        created.goal.goalId,
        "goal-v3-mcp-run-01",
        { now: at(45_000), sql: database.sql },
      );
      assert.equal(run.run.state, "BLOCKED");
      assert.equal(run.run.errorCode, "GOAL_MCP_CONTEXT_UNAVAILABLE");
      assert.equal(run.run.jobs.length, 1);
      assert.equal(run.run.jobs[0]?.jobId, null);
      const counts = await database.sql<{ invocations: number; jobs: number }[]>`
        SELECT
          (SELECT count(*)::int FROM mcp_invocations invocation
            JOIN goal_run_jobs link ON link.id = invocation.goal_run_job_id
            WHERE link.goal_run_id = ${run.run.runId}::uuid) AS invocations,
          (SELECT count(*)::int FROM jobs job
            JOIN goal_run_jobs link ON link.job_id = job.id
            WHERE link.goal_run_id = ${run.run.runId}::uuid) AS jobs
      `;
      assert.deepEqual(counts[0], { invocations: 1, jobs: 0 });
    });

    await t.test("TRI_RISK_V1 selects V4 and V5 lanes and executes V5 MCP context", async () => {
      const lowVersion = await publishAgent(database, {
        id: CREATOR_A_ID, wallet: CREATOR_A_WALLET,
      }, {
        name: "Tri Low Market", parent: "alice.eth", label: "tri-low",
        capabilities: ["market-analysis"], templateId: "market-pulse", riskTiers: ["LOW"],
      });
      const midVersion = await publishAgent(database, {
        id: CREATOR_B_ID, wallet: CREATOR_B_WALLET,
      }, {
        name: "Tri Mid Volume", parent: "bob.eth", label: "tri-mid",
        capabilities: ["market-analysis", "risk-analysis"], templateId: "volume-anomaly", riskTiers: ["MID"],
      });
      const highVersion = await publishAgent(database, {
        id: CREATOR_A_ID, wallet: CREATOR_A_WALLET,
      }, {
        name: "Tri High Swap", parent: "alice.eth", label: "tri-high",
        capabilities: ["market-analysis", "risk-analysis", "uniswap-swap"],
        templateId: "swap-strategist", riskTiers: ["HIGH"], manifestVersion: 5,
      });
      const selfVersion = await publishAgent(database, {
        id: BUYER_ID, wallet: BUYER_WALLET,
      }, {
        name: "Tri Self All Lanes", parent: "buyer.eth", label: "tri-self",
        capabilities: ["research", "market-analysis", "risk-analysis"],
        templateId: "thesis-synthesizer", riskTiers: ["LOW", "MID", "HIGH"],
      });
      const triPolicy = {
        schemaVersion: 2,
        orchestrationMode: "TRI_RISK_V1",
        cadenceMinutes: 5,
        runMode: "BOUNDED",
        executionMode: "PROPOSE_SWAP",
        runLimit: 3,
        maxAgents: 3,
        perRunCapAtomic: "3000",
        dailyCapAtomic: null,
      } as const;
      await patchAugmentedLayerPolicy(BUYER_ID, triPolicy, "tri-goal-policy-01", {
        now: at(52_000), sql: database.sql,
      });
      const created = await createGoal(BUYER_ID, parseGoalCreate({
        objective: "Compare low mid and high risk lanes before proposing a bounded swap.",
        requiredCapabilities: ["market-analysis", "risk-analysis"],
        policy: triPolicy,
        state: "ACTIVE",
      }), "tri-goal-create-01", { now: at(53_000), sql: database.sql });
      const first = await createGoalRun(BUYER_ID, created.goal.goalId, "tri-goal-run-01", {
        now: at(54_000), sql: database.sql,
      });
      assert.equal(first.run.state, "RUNNING");
      assert.equal(first.run.jobs.length, 3);
      assert.equal(first.run.jobs.filter((job) => job.role === "SYNTHESIS").length, 0);
      assert.deepEqual(first.run.jobs.map((job) => job.riskLane), ["LOW", "MID", "HIGH"]);
      assert.deepEqual(first.run.jobs.map((job) => job.selectionRank), [1, 2, 3]);
      assert.equal(new Set(first.run.jobs.map((job) => job.agentVersionId)).size, 3);
      assert.ok(first.run.jobs.every((job) => job.agentVersionId !== selfVersion));
      assert.deepEqual(
        new Set(first.run.jobs.map((job) => job.agentVersionId)),
        new Set([lowVersion, midVersion, highVersion]),
      );
      assert.ok(first.run.jobs.every((job) => job.jobId === null));

      const submitted = await processGoalRun(BUYER_ID, first.run.runId, {
        now: at(55_000), sql: database.sql, mcpProvider: new FixedGoalMcpProvider(),
      });
      assert.ok(submitted.jobs.every((job) => job.jobId));
      const keys = await database.sql<{ idempotency_key: string }[]>`
        SELECT intent.idempotency_key
        FROM goal_run_jobs link JOIN job_intents intent ON intent.id = (
          SELECT job.intent_id FROM jobs job WHERE job.id = link.job_id
        )
        WHERE link.goal_run_id = ${submitted.runId}::uuid
        ORDER BY link.selection_rank
      `;
      assert.deepEqual(keys.map((row) => row.idempotency_key), submitted.jobs.map((job, index) =>
        `goal:${submitted.runId}:${["LOW", "MID", "HIGH"][index]}:${job.agentVersionId}`));

      const second = await createGoalRun(BUYER_ID, created.goal.goalId, "tri-goal-run-02", {
        now: at(56_000), sql: database.sql,
      });
      assert.deepEqual(
        second.run.jobs.map((job) => job.agentVersionId),
        first.run.jobs.map((job) => job.agentVersionId),
      );

      const budget = await createGoal(BUYER_ID, parseGoalCreate({
        objective: "Block all tri-risk inserts when the three-lane budget is insufficient.",
        requiredCapabilities: ["market-analysis", "risk-analysis"],
        policy: { ...triPolicy, runLimit: 1, perRunCapAtomic: "2000" },
        state: "ACTIVE",
      }), "tri-budget-create-01", { now: at(57_000), sql: database.sql });
      const blockedBudget = await createGoalRun(BUYER_ID, budget.goal.goalId, "tri-budget-run-01", {
        now: at(58_000), sql: database.sql,
      });
      assert.equal(blockedBudget.run.state, "BLOCKED");
      assert.equal(blockedBudget.run.errorCode, "GOAL_PER_RUN_CAP_EXCEEDED");
      assert.equal(blockedBudget.run.jobs.length, 0);

      const missing = await createGoal(BUYER_ID, parseGoalCreate({
        objective: "Block tri-risk selection when external V4 union coverage is missing.",
        requiredCapabilities: ["research"],
        policy: { ...triPolicy, runLimit: 1 },
        state: "ACTIVE",
      }), "tri-missing-create-01", { now: at(59_000), sql: database.sql });
      const blockedMissing = await createGoalRun(BUYER_ID, missing.goal.goalId, "tri-missing-run-01", {
        now: at(60_000), sql: database.sql,
      });
      assert.equal(blockedMissing.run.state, "BLOCKED");
      assert.equal(blockedMissing.run.errorCode, "GOAL_CAPABILITY_UNAVAILABLE");
      assert.equal(blockedMissing.run.jobs.length, 0);
    });

    await t.test("terminal runs are immutable and every persisted report is revalidated on read", async () => {
      for (const state of ["READY", "PARTIAL", "BLOCKED", "FAILED", "CANCELED"] as const) {
        const runId = terminalRunIds.get(state);
        assert.ok(runId, `missing ${state} fixture`);
        await assert.rejects(database.sql`
          UPDATE goal_runs SET updated_at = clock_timestamp() WHERE id = ${runId}::uuid
        `, /terminal goal run is immutable/);
      }
      assert.ok(canonicalReady);
      const canonical = canonicalReady;
      const childRuns = await database.sql<{ id: string }[]>`
        INSERT INTO goal_runs (
          goal_id, owner_user_id, idempotency_key, scheduled_for, state,
          objective_snapshot, capabilities_snapshot, policy_snapshot, policy_hash,
          effect_identity, total_price_atomic, cost_reserved_at, started_at,
          created_at, updated_at
        )
        SELECT goal_id, owner_user_id, 'goal-terminal-child-01',
          '2026-07-25T16:00:00.000Z', 'RUNNING', objective_snapshot,
          capabilities_snapshot, policy_snapshot, policy_hash,
          ${domainHash("goal-terminal-child", { runId: canonical.runId })},
          1000, clock_timestamp(), clock_timestamp(), clock_timestamp(), clock_timestamp()
        FROM goal_runs WHERE id = ${canonical.runId}::uuid
        RETURNING id
      `;
      const childRunId = childRuns[0]?.id;
      assert.ok(childRunId);
      const childLinks = await database.sql<{ id: string }[]>`
        INSERT INTO goal_run_jobs (
          goal_run_id, agent_version_id, role, selection_rank, covered_capabilities,
          price_atomic_snapshot, manifest_hash_snapshot, full_subname_snapshot, created_at
        )
        SELECT ${childRunId}::uuid, agent_version_id, 'ANALYSIS', 1,
          covered_capabilities, price_atomic_snapshot, manifest_hash_snapshot,
          full_subname_snapshot, clock_timestamp()
        FROM goal_run_jobs WHERE goal_run_id = ${canonical.runId}::uuid
        ORDER BY selection_rank, id LIMIT 1
        RETURNING id
      `;
      const childLinkId = childLinks[0]?.id;
      assert.ok(childLinkId);
      await database.sql`
        UPDATE goal_runs SET state = 'CANCELED', error_code = 'GOAL_CHILD_TEST_CANCELED',
          completed_at = clock_timestamp(), updated_at = clock_timestamp()
        WHERE id = ${childRunId}::uuid
      `;
      const existingJobs = await database.sql<{ job_id: string }[]>`
        SELECT job_id FROM goal_run_jobs
        WHERE goal_run_id = ${canonical.runId}::uuid AND job_id IS NOT NULL
        ORDER BY selection_rank, id LIMIT 1
      `;
      assert.ok(existingJobs[0]?.job_id);
      await assert.rejects(database.sql`
        UPDATE goal_run_jobs SET job_id = ${existingJobs[0].job_id}::uuid
        WHERE id = ${childLinkId}::uuid
      `, /terminal goal run jobs are immutable/);
      await assert.rejects(database.sql`
        DELETE FROM goal_run_jobs WHERE id = ${childLinkId}::uuid
      `, /terminal goal run jobs are immutable/);
      await assert.rejects(database.sql`
        INSERT INTO goal_run_jobs (
          goal_run_id, agent_version_id, role, selection_rank, covered_capabilities,
          price_atomic_snapshot, manifest_hash_snapshot, full_subname_snapshot, created_at
        )
        SELECT ${childRunId}::uuid, agent_version_id, 'SYNTHESIS', 2,
          covered_capabilities, price_atomic_snapshot, manifest_hash_snapshot,
          full_subname_snapshot, clock_timestamp()
        FROM goal_run_jobs WHERE goal_run_id = ${canonical.runId}::uuid
        ORDER BY selection_rank, id LIMIT 1
      `, /terminal goal run jobs are immutable/);
      await assert.rejects(
        database.sql`TRUNCATE goal_mutations`,
        /goal mutation record is append-only/,
      );
      await database.sql`ALTER TABLE goal_runs DISABLE TRIGGER USER`;
      await database.sql`ALTER TABLE goal_runs DROP CONSTRAINT goal_runs_report_binding_check`;

      const persist = async (report: GoalRunReportV1, reportHash: string): Promise<void> => {
        await database.sql`
          UPDATE goal_runs SET report = ${database.sql.json(report)}, report_hash = ${reportHash}
          WHERE id = ${canonical.runId}::uuid
        `;
      };
      const rejectsRead = async (): Promise<void> => {
        await assert.rejects(
          getGoalRun(BUYER_ID, canonical.runId, { sql: database.sql }),
          /GOAL_RUN_REPORT_INVALID/,
        );
      };

      const changedSummary = structuredClone(canonical.report);
      changedSummary.summary = "Tampered persisted summary.";
      await persist(changedSummary, canonical.reportHash);
      await rejectsRead();

      const changedEvidence = structuredClone(canonical.report);
      changedEvidence.evidence = changedEvidence.evidence.map((item, index) => index === 0
        ? { ...item, resultHash: "0".repeat(64) }
        : item);
      await persist(changedEvidence, domainHash("goal-run-report-v1", changedEvidence));
      await rejectsRead();

      const changedRun = { ...structuredClone(canonical.report), runId: randomUUID() };
      await persist(changedRun, domainHash("goal-run-report-v1", changedRun));
      await rejectsRead();

      const changedStatus = { ...structuredClone(canonical.report), status: "PARTIAL" as const };
      await persist(changedStatus, domainHash("goal-run-report-v1", changedStatus));
      await rejectsRead();

      await persist(canonical.report, "f".repeat(64));
      await rejectsRead();
    });
  } finally {
    await database.close();
  }
});
