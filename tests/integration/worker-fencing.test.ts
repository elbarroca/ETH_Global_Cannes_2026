import assert from "node:assert/strict";
import test from "node:test";
import { domainHash } from "../../src/kernel/canonical";
import { checkFreshEnsAuthority } from "../../src/ens/authority";
import { parseAgentInput } from "../../src/kernel/policy";
import {
  cancelBuyerJob,
  publishAgent,
  submitJob,
  type DatabaseClient,
} from "../../src/kernel/service";
import type {
  AdapterExecutionRequest,
  AdapterExecutionResult,
  KernelAdapter,
} from "../../src/worker/adapter";
import { runWorkerOnce } from "../../src/worker/runner";
import {
  acquireWorkerLease,
  claimJobs,
  finalizePersistedEffect,
  heartbeatClaimedJobs,
  KERNEL_WORKER_LEASE_KEY,
  persistFailedEffect,
  persistSuccessfulEffect,
  reconcileExpiredJobs,
  requeueAfterTransientFailure,
} from "../../src/worker/store";
import {
  configureDatabaseEnvironment,
  startDisposableDatabase,
  type DisposableDatabase,
} from "../helpers/postgres";
import { createEnsAuthorityFixture } from "../helpers/ens";

const BUYER_ID = "fencing-buyer";
const CREATOR_ID = "fencing-creator";
const BUYER_WALLET = "0x4444444444444444444444444444444444444444";
const CREATOR_WALLET = "0x5555555555555555555555555555555555555555";
const BASE_TIME = new Date("2026-07-24T04:00:00.000Z");

async function createAgent(database: DisposableDatabase): Promise<string> {
  await database.sql`
    INSERT INTO users (id, wallet_address) VALUES
      (${BUYER_ID}, ${BUYER_WALLET}),
      (${CREATOR_ID}, ${CREATOR_WALLET})
  `;
  const parsed = parseAgentInput({
    name: "Fenced Worker Sentinel",
    description: "Exercises stale-worker rejection and retry cancellation invariants.",
    instructions: "Return one deterministic local result without external effects.",
    capabilities: ["research"],
  }, CREATOR_WALLET);
  const agent = await publishAgent(
    { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
    parsed.manifest,
    { now: BASE_TIME, sql: database.sql },
  );
  return agent.versionId;
}

test("reclaimed jobs reject every stale worker mutation and preserve one effect", async () => {
  const database = await startDisposableDatabase("worker-fencing");
  configureDatabaseEnvironment(database.url);
  try {
    const agentVersionId = await createAgent(database);
    const ens = createEnsAuthorityFixture({ now: BASE_TIME });
    const submitted = await submitJob(BUYER_ID, {
      agentVersionId,
      idempotencyKey: "stale-claim-rejection",
      task: { prompt: "prove stale mutations are fenced" },
    }, { now: BASE_TIME, sql: database.sql });

    const ownerA = "worker-fencing-a";
    const ownerB = "worker-fencing-b";
    assert.equal((await acquireWorkerLease(ownerA, 30, {
      now: BASE_TIME,
      sql: database.sql,
    })).acquired, true);
    const claimsA = await claimJobs(ownerA, 1, 30, {
      now: BASE_TIME,
      sql: database.sql,
    });
    const claimA = claimsA[0];
    assert.equal(claimA?.jobId, submitted.jobId);
    if (!claimA) throw new Error("TEST_WORKER_A_CLAIM_MISSING");

    const takeoverTime = new Date(BASE_TIME.getTime() + 31_000);
    const takeover = await acquireWorkerLease(ownerB, 30, {
      now: takeoverTime,
      sql: database.sql,
    });
    assert.equal(takeover.acquired, true);
    assert.notEqual(takeover.epoch, claimA.workerEpoch);
    assert.deepEqual(
      await reconcileExpiredJobs({ now: takeoverTime, sql: database.sql }),
      { reconciled: 0, requeued: 1 },
    );
    const claimsB = await claimJobs(ownerB, 1, 30, {
      now: takeoverTime,
      sql: database.sql,
    });
    const claimB = claimsB[0];
    assert.equal(claimB?.jobId, submitted.jobId);
    if (!claimB) throw new Error("TEST_WORKER_B_CLAIM_MISSING");
    assert.ok(claimB.claimVersion > claimA.claimVersion);

    const snapshot = async (): Promise<Record<string, string | number | null>> => {
      const rows = await database.sql<Record<string, string | number | null>[]>`
        SELECT
          j.state AS job_state,
          j.version,
          j.attempts,
          j.lease_owner,
          e.state AS effect_state,
          e.attempt AS effect_attempt,
          (SELECT count(*)::int FROM effects WHERE job_id = j.id) AS effects,
          (SELECT count(*)::int FROM receipts WHERE job_id = j.id) AS receipts,
          (SELECT count(*)::int FROM settlements WHERE job_id = j.id) AS settlements,
          (SELECT count(*)::int FROM refunds WHERE job_id = j.id) AS refunds
        FROM jobs j
        JOIN effects e ON e.job_id = j.id
        WHERE j.id = ${submitted.jobId}::uuid
      `;
      const row = rows[0];
      if (!row) throw new Error("TEST_ACTIVE_CLAIM_SNAPSHOT_MISSING");
      return row;
    };
    const beforeLateA = await snapshot();
    const lateTime = new Date(takeoverTime.getTime() + 1_000);
    assert.equal(await heartbeatClaimedJobs(ownerA, [claimA], 30, {
      now: lateTime,
      sql: database.sql,
    }), false);
    assert.equal(await persistSuccessfulEffect(
      claimA,
      { stale: "success" },
      domainHash("test-proof", "late-a-success"),
      { now: lateTime, sql: database.sql },
    ), false);
    assert.equal(await persistFailedEffect(claimA, "LATE_A_FAILURE", {
      now: lateTime,
      sql: database.sql,
    }), false);
    assert.equal(await requeueAfterTransientFailure(claimA, {
      now: lateTime,
      sql: database.sql,
    }), false);
    assert.equal(await finalizePersistedEffect(claimA, {
      now: lateTime,
      sql: database.sql,
    }), null);
    assert.deepEqual(await snapshot(), beforeLateA);

    const completionTime = new Date(takeoverTime.getTime() + 2_000);
    const authority = await checkFreshEnsAuthority(
      claimB,
      ens.runtime,
      "PRE_DELIVERY",
      "ACCEPT_DELIVERY",
      { now: completionTime, signal: new AbortController().signal, sql: database.sql },
    );
    assert.equal(authority.allowed, true);
    if (!authority.checkId) throw new Error("TEST_AUTHORITY_CHECK_MISSING");
    assert.equal(await persistSuccessfulEffect(
      claimB,
      { worker: "b", status: "delivered" },
      domainHash("test-proof", "worker-b-success"),
      { authorityCheckId: authority.checkId, now: completionTime, sql: database.sql },
    ), true);
    assert.equal(await finalizePersistedEffect(claimB, {
      now: completionTime,
      sql: database.sql,
    }), "SUCCEEDED");
    const completed = await database.sql<{
      state: string;
      effect_state: string;
      effects: number;
      receipts: number;
      settlements: number;
      commissions: number;
      refunds: number;
    }[]>`
      SELECT
        j.state,
        e.state AS effect_state,
        (SELECT count(*)::int FROM effects WHERE job_id = j.id) AS effects,
        (SELECT count(*)::int FROM receipts WHERE job_id = j.id) AS receipts,
        (SELECT count(*)::int FROM settlements WHERE job_id = j.id) AS settlements,
        (SELECT count(*)::int FROM commissions WHERE job_id = j.id) AS commissions,
        (SELECT count(*)::int FROM refunds WHERE job_id = j.id) AS refunds
      FROM jobs j
      JOIN effects e ON e.job_id = j.id
      WHERE j.id = ${submitted.jobId}::uuid
    `;
    assert.deepEqual(completed[0], {
      state: "SUCCEEDED",
      effect_state: "SUCCEEDED",
      effects: 1,
      receipts: 1,
      settlements: 1,
      commissions: 1,
      refunds: 0,
    });

    const retryTime = new Date(takeoverTime.getTime() + 3_000);
    const retryJob = await submitJob(BUYER_ID, {
      agentVersionId,
      idempotencyKey: "retry-then-cancel",
      task: { prompt: "requeue before queued cancellation" },
    }, { now: retryTime, sql: database.sql });
    const retryClaims = await claimJobs(ownerB, 1, 30, {
      now: retryTime,
      sql: database.sql,
    });
    const retryClaim = retryClaims[0];
    assert.equal(retryClaim?.jobId, retryJob.jobId);
    if (!retryClaim) throw new Error("TEST_RETRY_CLAIM_MISSING");
    assert.equal(await requeueAfterTransientFailure(retryClaim, {
      now: retryTime,
      sql: database.sql,
    }), true);
    const requeued = await database.sql<{ job_state: string; effect_state: string }[]>`
      SELECT j.state AS job_state, e.state AS effect_state
      FROM jobs j JOIN effects e ON e.job_id = j.id
      WHERE j.id = ${retryJob.jobId}::uuid
    `;
    assert.deepEqual(requeued[0], { job_state: "QUEUED", effect_state: "RUNNING" });

    const canceled = await cancelBuyerJob(BUYER_ID, retryJob.jobId, {
      now: new Date(retryTime.getTime() + 1_000),
      sql: database.sql,
    });
    assert.equal(canceled.state, "CANCELED");
    const cancellation = await database.sql<{
      job_state: string;
      effect_state: string;
      refunds: number;
      terminal_with_nonterminal_effect: number;
    }[]>`
      SELECT
        j.state AS job_state,
        e.state AS effect_state,
        (SELECT count(*)::int FROM refunds WHERE job_id = j.id) AS refunds,
        (
          SELECT count(*)::int
          FROM jobs terminal_job
          JOIN effects terminal_effect ON terminal_effect.job_id = terminal_job.id
          WHERE terminal_job.state IN ('SUCCEEDED', 'FAILED', 'CANCELED', 'A3_NOT_CONFIGURED')
            AND terminal_effect.state NOT IN ('SUCCEEDED', 'FAILED', 'CANCELED')
        ) AS terminal_with_nonterminal_effect
      FROM jobs j
      JOIN effects e ON e.job_id = j.id
      WHERE j.id = ${retryJob.jobId}::uuid
    `;
    assert.deepEqual(cancellation[0], {
      job_state: "CANCELED",
      effect_state: "CANCELED",
      refunds: 1,
      terminal_with_nonterminal_effect: 0,
    });
  } finally {
    await database.close();
  }
});

class LeaseTakeoverAdapter implements KernelAdapter {
  readonly key = "protected-a3" as const;

  constructor(private readonly sql: DatabaseClient) {}

  async execute(request: AdapterExecutionRequest): Promise<AdapterExecutionResult> {
    const heartbeatAt = new Date(Date.now() - 2_000);
    const expiredAt = new Date(Date.now() - 1_000);
    await this.sql`
      UPDATE worker_leases
      SET heartbeat_at = ${heartbeatAt}, expires_at = ${expiredAt}, updated_at = ${expiredAt}
      WHERE key = ${KERNEL_WORKER_LEASE_KEY}
    `;
    const takeover = await acquireWorkerLease("heartbeat-takeover-b", 30, { sql: this.sql });
    assert.equal(takeover.acquired, true);
    await new Promise((resolve) => setTimeout(resolve, 1_250));
    return {
      ok: true,
      result: { status: "late", effectId: request.effectId },
      proofHash: domainHash("test-proof", request.effectId),
      verified: true,
    };
  }
}

test("heartbeat lease loss prevents terminal persistence and finalization", async () => {
  const database = await startDisposableDatabase("heartbeat-loss");
  configureDatabaseEnvironment(database.url);
  try {
    const agentVersionId = await createAgent(database);
    const submitted = await submitJob(BUYER_ID, {
      agentVersionId,
      idempotencyKey: "heartbeat-loss",
      task: { prompt: "lose the lease while the adapter is running" },
    }, { sql: database.sql });
    let terminalHookCalls = 0;
    const result = await runWorkerOnce({
      ownerId: "heartbeat-owner-a",
      concurrency: 1,
      leaseSeconds: 1,
      adapter: new LeaseTakeoverAdapter(database.sql),
      sql: database.sql,
      afterTerminalEffectPersisted: async () => {
        terminalHookCalls += 1;
      },
    });
    assert.deepEqual(result, { leaseAcquired: true, claimed: 1 });
    assert.equal(terminalHookCalls, 0);
    const rows = await database.sql<{
      job_state: string;
      effect_state: string;
      effects: number;
      receipts: number;
      settlements: number;
      refunds: number;
    }[]>`
      SELECT
        j.state AS job_state,
        e.state AS effect_state,
        (SELECT count(*)::int FROM effects WHERE job_id = j.id) AS effects,
        (SELECT count(*)::int FROM receipts WHERE job_id = j.id) AS receipts,
        (SELECT count(*)::int FROM settlements WHERE job_id = j.id) AS settlements,
        (SELECT count(*)::int FROM refunds WHERE job_id = j.id) AS refunds
      FROM jobs j
      JOIN effects e ON e.job_id = j.id
      WHERE j.id = ${submitted.jobId}::uuid
    `;
    assert.deepEqual(rows[0], {
      job_state: "RUNNING",
      effect_state: "RUNNING",
      effects: 1,
      receipts: 0,
      settlements: 0,
      refunds: 0,
    });
  } finally {
    await database.close();
  }
});
