import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { NextRequest } from "next/server";
import { domainHash } from "../../src/kernel/canonical";
import { KernelError } from "../../src/kernel/errors";
import { parseAgentInput } from "../../src/kernel/policy";
import {
  cancelBuyerJob,
  publishAgent,
  submitJob,
} from "../../src/kernel/service";
import type {
  AdapterExecutionRequest,
  AdapterExecutionResult,
  KernelAdapter,
} from "../../src/worker/adapter";
import { ProtectedA3Adapter } from "../../src/worker/adapter";
import { runWorkerOnce } from "../../src/worker/runner";
import {
  acquireWorkerLease,
  claimJobs,
  finalizePersistedEffect,
  heartbeatClaimedJobs,
  persistSuccessfulEffect,
  reconcileExpiredJobs,
} from "../../src/worker/store";
import { sha256 } from "../../src/auth/service";
import {
  configureDatabaseEnvironment,
  startDisposableDatabase,
} from "../helpers/postgres";

const BUYER_ID = "a2-buyer";
const OTHER_ID = "a2-other";
const CREATOR_ID = "a2-creator";
const BUYER_WALLET = "0x1111111111111111111111111111111111111111";
const OTHER_WALLET = "0x2222222222222222222222222222222222222222";
const CREATOR_WALLET = "0x3333333333333333333333333333333333333333";
const BASE_TIME = new Date("2026-07-24T03:00:00.000Z");

class MemoizedCrashAdapter implements KernelAdapter {
  readonly key = "protected-a3" as const;
  calls = 0;
  externalEffects = 0;
  shouldCrash = true;
  private readonly completed = new Set<string>();

  async execute(request: AdapterExecutionRequest): Promise<AdapterExecutionResult> {
    this.calls += 1;
    if (!this.completed.has(request.effectId)) {
      this.completed.add(request.effectId);
      this.externalEffects += 1;
    }
    if (this.shouldCrash) throw new Error("SIMULATED_PRE_PERSIST_CRASH");
    return {
      ok: true,
      result: { status: "delivered", effectId: request.effectId },
      proofHash: domainHash("test-proof", request.effectId),
      verified: true,
    };
  }
}

class SuccessfulAdapter implements KernelAdapter {
  readonly key = "protected-a3" as const;
  calls = 0;

  async execute(request: AdapterExecutionRequest): Promise<AdapterExecutionResult> {
    this.calls += 1;
    return {
      ok: true,
      result: { status: "delivered", effectId: request.effectId },
      proofHash: domainHash("test-proof", request.effectId),
      verified: true,
    };
  }
}

async function counts(
  sql: Awaited<ReturnType<typeof startDisposableDatabase>>["sql"],
): Promise<Record<string, string>> {
  const rows = await sql<Record<string, string>[]>`
    SELECT
      (SELECT count(*)::text FROM quotes) AS quotes,
      (SELECT count(*)::text FROM job_intents) AS intents,
      (SELECT count(*)::text FROM kernel_orders) AS orders,
      (SELECT count(*)::text FROM jobs) AS jobs,
      (SELECT count(*)::text FROM effects) AS effects,
      (SELECT count(*)::text FROM receipts) AS receipts,
      (SELECT count(*)::text FROM settlements) AS settlements,
      (SELECT count(*)::text FROM commissions) AS commissions,
      (SELECT count(*)::text FROM refunds) AS refunds
  `;
  return rows[0] ?? {};
}

test("A2 authenticated kernel invariants hold end to end", async (t) => {
  const database = await startDisposableDatabase("kernel");
  configureDatabaseEnvironment(database.url);
  try {
    await database.sql`
      INSERT INTO users (id, wallet_address) VALUES
        (${BUYER_ID}, ${BUYER_WALLET}),
        (${OTHER_ID}, ${OTHER_WALLET}),
        (${CREATOR_ID}, ${CREATOR_WALLET})
    `;
    const agentInput = parseAgentInput({
      name: "A2 Research Sentinel",
      description: "A bounded research-only specialist for deterministic kernel tests.",
      instructions: "Analyze the supplied prompt and return a concise research result.",
      capabilities: ["research", "market-analysis"],
    }, CREATOR_WALLET);
    const agent = await publishAgent(
      { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
      agentInput.manifest,
      { now: BASE_TIME, sql: database.sql },
    );

    await t.test("published versions are immutable and transitions are DB-enforced", async () => {
      await assert.rejects(database.sql`
        UPDATE agent_versions SET price_atomic = 2000 WHERE id = ${agent.versionId}::uuid
      `, /published agent versions are immutable/);
      const queued = await submitJob(BUYER_ID, {
        agentVersionId: agent.versionId,
        idempotencyKey: "illegal-transition-01",
        task: { prompt: "illegal transition sentinel" },
      }, { now: BASE_TIME, sql: database.sql });
      await assert.rejects(database.sql`
        UPDATE jobs SET state = 'SUCCEEDED', version = version + 1
        WHERE id = ${queued.jobId}::uuid
      `, /illegal job state transition/);
      await cancelBuyerJob(BUYER_ID, queued.jobId, { now: BASE_TIME, sql: database.sql });
    });

    await t.test("20 concurrent identical submissions converge to one full identity", async () => {
      const submissions = await Promise.all(Array.from({ length: 20 }, () => submitJob(BUYER_ID, {
        agentVersionId: agent.versionId,
        idempotencyKey: "twenty-way-submit-01",
        task: { prompt: "concurrent deterministic submission" },
      }, { now: BASE_TIME, sql: database.sql })));
      const identities = new Set(submissions.map((row) => [
        row.quoteId,
        row.intentId,
        row.orderId,
        row.jobId,
        row.effectId,
      ].join(":")));
      assert.equal(identities.size, 1);
      assert.equal(submissions.filter((row) => !row.replayed).length, 1);
      const first = submissions[0];
      assert.ok(first);
      const rows = await database.sql<{ quotes: string; intents: string; orders: string; jobs: string; effects: string }[]>`
        SELECT
          (SELECT count(*)::text FROM quotes WHERE id = ${first.quoteId}::uuid) AS quotes,
          (SELECT count(*)::text FROM job_intents WHERE id = ${first.intentId}::uuid) AS intents,
          (SELECT count(*)::text FROM kernel_orders WHERE id = ${first.orderId}::uuid) AS orders,
          (SELECT count(*)::text FROM jobs WHERE id = ${first.jobId}::uuid) AS jobs,
          (SELECT count(*)::text FROM effects WHERE id = ${first.effectId}) AS effects
      `;
      assert.deepEqual(rows[0], { quotes: "1", intents: "1", orders: "1", jobs: "1", effects: "1" });
      await assert.rejects(
        submitJob(BUYER_ID, {
          agentVersionId: agent.versionId,
          idempotencyKey: "twenty-way-submit-01",
          task: { prompt: "different payload" },
        }, { now: BASE_TIME, sql: database.sql }),
        (error: unknown) => error instanceof KernelError && error.code === "KERNEL_IDEMPOTENCY_MISMATCH",
      );
    });

    await t.test("one PostgreSQL owner claims at most four jobs and expired leases requeue", async () => {
      for (let index = 0; index < 4; index += 1) {
        await submitJob(BUYER_ID, {
          agentVersionId: agent.versionId,
          idempotencyKey: `four-slot-job-${index}`,
          task: { prompt: `worker slot ${index}` },
        }, { now: BASE_TIME, sql: database.sql });
      }
      const owner = "worker-owner-a";
      const acquired = await acquireWorkerLease(owner, 30, { now: BASE_TIME, sql: database.sql });
      assert.equal(acquired.acquired, true);
      const rejected = await acquireWorkerLease("worker-owner-b", 30, { now: BASE_TIME, sql: database.sql });
      assert.equal(rejected.acquired, false);
      const claimed = await claimJobs(owner, 4, 30, { now: BASE_TIME, sql: database.sql });
      assert.equal(claimed.length, 4);
      assert.equal(new Set(claimed.map((job) => job.jobId)).size, 4);
      assert.equal(await heartbeatClaimedJobs(
        owner,
        claimed.map((job) => job.jobId),
        30,
        { now: new Date(BASE_TIME.getTime() + 20_000), sql: database.sql },
      ), true);
      const protectedByHeartbeat = await reconcileExpiredJobs({
        now: new Date(BASE_TIME.getTime() + 31_000),
        sql: database.sql,
      });
      assert.equal(protectedByHeartbeat.requeued, 0);
      const result = await reconcileExpiredJobs({
        now: new Date(BASE_TIME.getTime() + 51_000),
        sql: database.sql,
      });
      assert.equal(result.requeued, 4);
    });

    await t.test("protected adapter terminalizes without receipts or commissions", async () => {
      const owner = "worker-owner-a";
      const first = await runWorkerOnce({
        ownerId: owner,
        concurrency: 4,
        leaseSeconds: 30,
        adapter: new ProtectedA3Adapter(),
        sql: database.sql,
        now: new Date(BASE_TIME.getTime() + 52_000),
      });
      const second = await runWorkerOnce({
        ownerId: owner,
        concurrency: 4,
        leaseSeconds: 30,
        adapter: new ProtectedA3Adapter(),
        sql: database.sql,
        now: new Date(BASE_TIME.getTime() + 53_000),
      });
      assert.equal(first.claimed, 4);
      assert.equal(second.claimed, 1);
      const rows = await database.sql<{
        terminal: string;
        receipts: string;
        settlements: string;
        commissions: string;
        refunds: string;
      }[]>`
        SELECT
          (SELECT count(*)::text FROM jobs WHERE state = 'A3_NOT_CONFIGURED') AS terminal,
          (SELECT count(*)::text FROM receipts) AS receipts,
          (SELECT count(*)::text FROM settlements) AS settlements,
          (SELECT count(*)::text FROM commissions) AS commissions,
          (SELECT count(*)::text FROM refunds WHERE reason_code = 'A3_NOT_CONFIGURED') AS refunds
      `;
      assert.deepEqual(rows[0], {
        terminal: "5",
        receipts: "0",
        settlements: "0",
        commissions: "0",
        refunds: "5",
      });
    });

    await t.test("restart before terminal persistence reuses one effect identity", async () => {
      const now = new Date(BASE_TIME.getTime() + 54_000);
      const submitted = await submitJob(BUYER_ID, {
        agentVersionId: agent.versionId,
        idempotencyKey: "restart-before-terminal",
        task: { prompt: "memoized external execution" },
      }, { now, sql: database.sql });
      const adapter = new MemoizedCrashAdapter();
      await runWorkerOnce({
        ownerId: "worker-owner-a",
        concurrency: 1,
        leaseSeconds: 30,
        adapter,
        sql: database.sql,
        now,
      });
      adapter.shouldCrash = false;
      await runWorkerOnce({
        ownerId: "worker-owner-a",
        concurrency: 1,
        leaseSeconds: 30,
        adapter,
        sql: database.sql,
        now: new Date(now.getTime() + 1_000),
      });
      assert.equal(adapter.calls, 2);
      assert.equal(adapter.externalEffects, 1);
      const rows = await database.sql<{ effects: string; state: string; settlements: string }[]>`
        SELECT
          (SELECT count(*)::text FROM effects WHERE job_id = ${submitted.jobId}::uuid) AS effects,
          (SELECT state FROM jobs WHERE id = ${submitted.jobId}::uuid) AS state,
          (SELECT count(*)::text FROM settlements WHERE job_id = ${submitted.jobId}::uuid) AS settlements
      `;
      assert.deepEqual(rows[0], { effects: "1", state: "SUCCEEDED", settlements: "1" });
    });

    await t.test("restart after terminal effect persistence reconciles without adapter replay", async () => {
      const now = new Date(BASE_TIME.getTime() + 56_000);
      const submitted = await submitJob(BUYER_ID, {
        agentVersionId: agent.versionId,
        idempotencyKey: "restart-after-terminal",
        task: { prompt: "persist terminal before simulated kill" },
      }, { now, sql: database.sql });
      const initialAdapter = new SuccessfulAdapter();
      await assert.rejects(runWorkerOnce({
        ownerId: "worker-owner-a",
        concurrency: 1,
        leaseSeconds: 30,
        adapter: initialAdapter,
        sql: database.sql,
        now,
        afterTerminalEffectPersisted: async () => {
          throw new Error("SIMULATED_KILL_AFTER_TERMINAL_EFFECT");
        },
      }), /SIMULATED_KILL_AFTER_TERMINAL_EFFECT/);
      const persisted = await database.sql<{ job_state: string; effect_state: string }[]>`
        SELECT j.state AS job_state, e.state AS effect_state
        FROM jobs j JOIN effects e ON e.job_id = j.id
        WHERE j.id = ${submitted.jobId}::uuid
      `;
      assert.deepEqual(persisted[0], { job_state: "RUNNING", effect_state: "SUCCEEDED" });
      const restartAdapter = new SuccessfulAdapter();
      await runWorkerOnce({
        ownerId: "worker-owner-after-restart",
        concurrency: 1,
        leaseSeconds: 30,
        adapter: restartAdapter,
        sql: database.sql,
        now: new Date(now.getTime() + 31_000),
      });
      assert.equal(restartAdapter.calls, 0);
      const recovered = await database.sql<{ state: string; effects: string; settlements: string }[]>`
        SELECT
          (SELECT state FROM jobs WHERE id = ${submitted.jobId}::uuid) AS state,
          (SELECT count(*)::text FROM effects WHERE job_id = ${submitted.jobId}::uuid) AS effects,
          (SELECT count(*)::text FROM settlements WHERE job_id = ${submitted.jobId}::uuid) AS settlements
      `;
      assert.deepEqual(recovered[0], { state: "SUCCEEDED", effects: "1", settlements: "1" });
    });

    await t.test("settlement and refund remain exclusive under concurrent finalization", async () => {
      const now = new Date(BASE_TIME.getTime() + 88_000);
      const submitted = await submitJob(BUYER_ID, {
        agentVersionId: agent.versionId,
        idempotencyKey: "settle-refund-race",
        task: { prompt: "terminal financial race" },
      }, { now, sql: database.sql });
      await acquireWorkerLease("worker-owner-after-restart", 30, { now, sql: database.sql });
      const claimed = await claimJobs("worker-owner-after-restart", 1, 30, { now, sql: database.sql });
      const job = claimed[0];
      assert.equal(job?.jobId, submitted.jobId);
      if (!job) throw new Error("TEST_JOB_NOT_CLAIMED");
      await persistSuccessfulEffect(
        job,
        { status: "delivered" },
        domainHash("test-proof", job.effectId),
        { now, sql: database.sql },
      );
      const order = await database.sql<{ amount_atomic: string; asset: string }[]>`
        SELECT o.amount_atomic::text, o.asset
        FROM kernel_orders o JOIN jobs j ON j.order_id = o.id
        WHERE j.id = ${job.jobId}::uuid
      `;
      const amount = order[0];
      if (!amount) throw new Error("TEST_ORDER_NOT_FOUND");
      const race = await Promise.allSettled([
        finalizePersistedEffect(job.jobId, { now, sql: database.sql }),
        database.sql`
          INSERT INTO refunds (job_id, amount_atomic, asset, reason_code, created_at)
          VALUES (${job.jobId}::uuid, ${amount.amount_atomic}::bigint, ${amount.asset}, 'RACE_REFUND', ${now})
        `,
      ]);
      assert.equal(race.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(race.filter((result) => result.status === "rejected").length, 1);
      const outcome = await database.sql<{ settlement: string; refund: string; commission: string }[]>`
        SELECT
          (SELECT count(*)::text FROM settlements WHERE job_id = ${job.jobId}::uuid) AS settlement,
          (SELECT count(*)::text FROM refunds WHERE job_id = ${job.jobId}::uuid) AS refund,
          (SELECT count(*)::text FROM commissions WHERE job_id = ${job.jobId}::uuid) AS commission
      `;
      assert.deepEqual(outcome[0], { settlement: "1", refund: "0", commission: "1" });
    });

    await t.test("queued and running cancellation paths are durable", async () => {
      const queuedTime = new Date(BASE_TIME.getTime() + 89_000);
      const queued = await submitJob(BUYER_ID, {
        agentVersionId: agent.versionId,
        idempotencyKey: "cancel-queued-job",
        task: { prompt: "cancel before claim" },
      }, { now: queuedTime, sql: database.sql });
      const canceled = await cancelBuyerJob(BUYER_ID, queued.jobId, { now: queuedTime, sql: database.sql });
      assert.equal(canceled.state, "CANCELED");

      const runningTime = new Date(BASE_TIME.getTime() + 90_000);
      const running = await submitJob(BUYER_ID, {
        agentVersionId: agent.versionId,
        idempotencyKey: "cancel-running-job",
        task: { prompt: "cancel after claim" },
      }, { now: runningTime, sql: database.sql });
      await acquireWorkerLease("worker-owner-after-restart", 30, { now: runningTime, sql: database.sql });
      const claims = await claimJobs("worker-owner-after-restart", 1, 30, { now: runningTime, sql: database.sql });
      assert.equal(claims[0]?.jobId, running.jobId);
      const requested = await cancelBuyerJob(BUYER_ID, running.jobId, { now: runningTime, sql: database.sql });
      assert.ok(requested.cancelRequestedAt);
      await reconcileExpiredJobs({
        now: new Date(runningTime.getTime() + 31_000),
        sql: database.sql,
      });
      const rows = await database.sql<{ state: string; refunds: string }[]>`
        SELECT
          (SELECT state FROM jobs WHERE id = ${running.jobId}::uuid) AS state,
          (SELECT count(*)::text FROM refunds WHERE job_id = ${running.jobId}::uuid) AS refunds
      `;
      assert.deepEqual(rows[0], { state: "CANCELED", refunds: "1" });
    });

    await t.test("forged legacy mutations stop before effects or live imports", async () => {
      const token = Buffer.alloc(32, 7).toString("base64url");
      const issuedAt = new Date();
      const expiresAt = new Date(issuedAt.getTime() + 60_000);
      const challenges = await database.sql<{ id: string }[]>`
        INSERT INTO auth_challenges (
          message, message_hash, wallet_address, domain, chain_id, action, nonce,
          audience, uri, issued_at, expires_at
        ) VALUES (
          'route-test', ${"a".repeat(64)}, ${BUYER_WALLET}, 'localhost:3000',
          5042002, 'authenticate', ${"A".repeat(64)}, 'urn:alphadawg:kernel',
          'http://localhost:3000', ${issuedAt}, ${expiresAt}
        ) RETURNING id
      `;
      const challenge = challenges[0];
      if (!challenge) throw new Error("TEST_CHALLENGE_CREATE_FAILED");
      await database.sql`
        INSERT INTO auth_sessions (
          challenge_id, token_hash, wallet_address, user_id, action,
          expires_at, created_at
        ) VALUES (
          ${challenge.id}::uuid, ${sha256(token)}, ${BUYER_WALLET}, ${BUYER_ID},
          'authenticate', ${expiresAt}, ${issuedAt}
        )
      `;
      const authorization = `Bearer ${token}`;
      const before = await counts(database.sql);
      const [configureRoute, depositRoute, withdrawRoute, tradeRoute, runRoute, analyzeRoute, streamRoute, approveRoute, rejectRoute, createRoute, hireRoute] = await Promise.all([
        import("../../app/api/configure/route"),
        import("../../app/api/deposit/route"),
        import("../../app/api/withdraw/route"),
        import("../../app/api/trade/execute/route"),
        import("../../app/api/cycle/run/[userId]/route"),
        import("../../app/api/cycle/analyze/[userId]/route"),
        import("../../app/api/cycle/stream/[userId]/route"),
        import("../../app/api/cycle/approve/[pendingId]/route"),
        import("../../app/api/cycle/reject/[pendingId]/route"),
        import("../../app/api/marketplace/create/route"),
        import("../../app/api/marketplace/hire/route"),
      ]);
      const jsonRequest = (path: string, body: Record<string, unknown>): NextRequest => new NextRequest(
        `http://localhost:3000${path}`,
        {
          method: "POST",
          headers: { authorization, "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const responses = await Promise.all([
        configureRoute.POST(jsonRequest("/api/configure", { userId: OTHER_ID })),
        depositRoute.POST(jsonRequest("/api/deposit", { userId: OTHER_ID, amount: 1 })),
        withdrawRoute.POST(jsonRequest("/api/withdraw", { userId: OTHER_ID, amount: 1 })),
        tradeRoute.POST(jsonRequest("/api/trade/execute", { userId: OTHER_ID, action: "BUY", asset: "ETH", percentage: 1 })),
        runRoute.POST(jsonRequest(`/api/cycle/run/${OTHER_ID}`, {}), { params: Promise.resolve({ userId: OTHER_ID }) }),
        analyzeRoute.POST(jsonRequest(`/api/cycle/analyze/${OTHER_ID}`, {}), { params: Promise.resolve({ userId: OTHER_ID }) }),
        streamRoute.POST(jsonRequest(`/api/cycle/stream/${OTHER_ID}`, {}), { params: Promise.resolve({ userId: OTHER_ID }) }),
        approveRoute.POST(jsonRequest("/api/cycle/approve/not-used", { userId: OTHER_ID }), { params: Promise.resolve({ pendingId: "not-used" }) }),
        rejectRoute.POST(jsonRequest("/api/cycle/reject/not-used", { userId: OTHER_ID }), { params: Promise.resolve({ pendingId: "not-used" }) }),
        createRoute.POST(jsonRequest("/api/marketplace/create", { createdBy: OTHER_ID })),
        hireRoute.POST(jsonRequest("/api/marketplace/hire", { userId: OTHER_ID, agentName: "x" })),
      ]);
      assert.ok(responses.every((response) => response.status === 403));
      const after = await counts(database.sql);
      assert.deepEqual(after, before);

      const noAuth = await depositRoute.POST(new NextRequest("http://localhost:3000/api/deposit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: BUYER_ID, amount: 1 }),
      }));
      assert.equal(noAuth.status, 401);
    });

    await t.test("protected route sources authenticate before every capability import", async () => {
      const root = new URL("../..", import.meta.url);
      const paths = [
        "app/api/configure/route.ts",
        "app/api/deposit/route.ts",
        "app/api/withdraw/route.ts",
        "app/api/trade/execute/route.ts",
        "app/api/marketplace/create/route.ts",
        "app/api/marketplace/hire/route.ts",
        "app/api/cycle/run/[userId]/route.ts",
        "app/api/cycle/analyze/[userId]/route.ts",
        "app/api/cycle/stream/[userId]/route.ts",
        "app/api/cycle/approve/[pendingId]/route.ts",
        "app/api/cycle/reject/[pendingId]/route.ts",
      ];
      for (const path of paths) {
        const source = await readFile(new URL(path, root), "utf8");
        assert.doesNotMatch(source, /^import .*@\/src\/(?:agents|payments|hedera|og|naryo|marketplace|store|config\/prisma)/m, path);
        const authIndex = source.indexOf("authenticateRequest(");
        const capabilityIndex = source.indexOf("await import(");
        assert.ok(authIndex >= 0, `${path} has no request authentication`);
        assert.ok(capabilityIndex < 0 || authIndex < capabilityIndex, `${path} imports capability before auth`);
      }
    });
  } finally {
    await database.close();
  }
});
