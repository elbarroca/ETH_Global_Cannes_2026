import assert from "node:assert/strict";
import test from "node:test";
import { domainHash } from "../../src/kernel/canonical";
import { isKernelUuid, parseAgentInput, parseJobSubmission } from "../../src/kernel/policy";
import {
  cancelBuyerJob,
  getBuyerJobDetail,
  listBuyerJobs,
  listPublishedAgents,
  publishAgent,
  submitJob,
} from "../../src/kernel/service";
import type {
  AdapterExecutionRequest,
  AdapterExecutionResult,
  KernelAdapter,
} from "../../src/worker/adapter";
import { runWorkerOnce } from "../../src/worker/runner";
import { createEnsAuthorityFixture } from "../helpers/ens";
import {
  configureDatabaseEnvironment,
  startDisposableDatabase,
} from "../helpers/postgres";

const CREATOR_ID = "a5-creator";
const BUYER_ID = "a5-buyer";
const OTHER_ID = "a5-other";
const CREATOR_WALLET = "0x3333333333333333333333333333333333333333";
const BUYER_WALLET = "0x1111111111111111111111111111111111111111";
const OTHER_WALLET = "0x2222222222222222222222222222222222222222";
const BASE_TIME = new Date("2026-07-24T14:00:00.000Z");

class SuccessfulAdapter implements KernelAdapter {
  readonly key = "protected-a3" as const;

  async execute(request: AdapterExecutionRequest): Promise<AdapterExecutionResult> {
    return {
      ok: true,
      result: { status: "delivered", effectId: request.effectId },
      proofHash: domainHash("a5-test-proof", request.effectId),
      verified: true,
    };
  }
}

test("kernel UUID validation rejects malformed UUID-shaped input before SQL casts", () => {
  assert.equal(isKernelUuid("55555555-5555-4555-8555-555555555555"), true);
  assert.equal(isKernelUuid("aaaaaaaa---------------------------"), false);
  assert.throws(
    () => parseJobSubmission({
      agentVersionId: "aaaaaaaa---------------------------",
      input: { prompt: "Do not reach PostgreSQL." },
    }),
    /agentVersionId must be a UUID/,
  );
});

test("A5 read models remain owner-scoped, redacted, and evidence-driven", async () => {
  const database = await startDisposableDatabase("a5-read-model");
  configureDatabaseEnvironment(database.url);
  try {
    await database.sql`
      INSERT INTO users (id, wallet_address) VALUES
        (${CREATOR_ID}, ${CREATOR_WALLET}),
        (${BUYER_ID}, ${BUYER_WALLET}),
        (${OTHER_ID}, ${OTHER_WALLET})
    `;
    const input = parseAgentInput({
      name: "A5 Evidence Researcher",
      description: "A published immutable research specialist for A5 UI verification.",
      instructions: "Return a concise evidence-backed response to the supplied task.",
      capabilities: ["research", "market-analysis"],
    }, CREATOR_WALLET);
    const published = await publishAgent(
      { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
      input.manifest,
      { now: BASE_TIME, sql: database.sql },
    );

    const creatorAgents = await listPublishedAgents({
      viewerUserId: CREATOR_ID,
      sql: database.sql,
    });
    const buyerAgents = await listPublishedAgents({
      viewerUserId: BUYER_ID,
      sql: database.sql,
    });
    assert.equal(creatorAgents[0]?.ownedByViewer, true);
    assert.equal(buyerAgents[0]?.ownedByViewer, false);
    assert.equal(creatorAgents[0]?.description, input.manifest.description);
    assert.equal(creatorAgents[0]?.ownerWallet, CREATOR_WALLET);
    assert.equal(creatorAgents[0]?.proofPolicy, "verified-receipt-required");

    const queued = await submitJob(BUYER_ID, {
      agentVersionId: published.versionId,
      idempotencyKey: "a5-read-model-submit",
      task: { prompt: "Assess the protected evidence path." },
    }, { now: BASE_TIME, sql: database.sql });
    const replay = await submitJob(BUYER_ID, {
      agentVersionId: published.versionId,
      idempotencyKey: "a5-read-model-submit",
      task: { prompt: "Assess the protected evidence path." },
    }, { now: BASE_TIME, sql: database.sql });
    assert.equal(replay.jobId, queued.jobId);
    assert.equal(replay.replayed, true);

    const queuedList = await listBuyerJobs(BUYER_ID, { sql: database.sql });
    assert.equal(queuedList.length, 1);
    assert.equal(queuedList[0]?.agent.name, input.manifest.name);
    assert.deepEqual(queuedList[0]?.evidence, {
      owner: "verified",
      version: "verified",
      ens: "pending",
      compute: "pending",
      storage: "pending",
      receipt: "pending",
    });
    const queuedDetail = await getBuyerJobDetail(BUYER_ID, queued.jobId, {
      sql: database.sql,
    });
    assert.equal(queuedDetail?.evidenceDetail.receipt, null);
    assert.equal(queuedDetail?.evidence.receipt, "pending");
    assert.equal(await getBuyerJobDetail(OTHER_ID, queued.jobId, { sql: database.sql }), null);

    const ens = createEnsAuthorityFixture({ now: BASE_TIME });
    const worker = await runWorkerOnce({
      ownerId: "a5-read-model-worker",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: new SuccessfulAdapter(),
      authority: ens.runtime,
      now: BASE_TIME,
      sql: database.sql,
    });
    assert.equal(worker.claimed, 1);

    const deliveryReady = await getBuyerJobDetail(BUYER_ID, queued.jobId, {
      sql: database.sql,
    });
    assert.equal(deliveryReady?.state, "DELIVERY_READY");
    assert.equal(deliveryReady?.evidence.ens, "verified");
    assert.equal(deliveryReady?.evidence.compute, "unavailable");
    assert.equal(deliveryReady?.evidence.storage, "unavailable");
    assert.equal(deliveryReady?.evidenceDetail.receipt?.verified, true);
    assert.equal(deliveryReady?.evidenceDetail.financial.settlement, null);
    assert.equal(deliveryReady?.evidenceDetail.financial.refund, null);
    assert.equal(deliveryReady?.evidenceDetail.delivery, null);
    const serialized = JSON.stringify(deliveryReady);
    assert.doesNotMatch(serialized, /request_bytes|requestBytes|receipt_bytes|record_bytes/i);

    await database.sql`ALTER TABLE receipts DISABLE TRIGGER USER`;
    try {
      await database.sql`
        UPDATE receipts
        SET result_hash = ${domainHash("a5-mismatched-receipt", queued.jobId)}
        WHERE job_id = ${queued.jobId}::uuid
      `;
    } finally {
      await database.sql`ALTER TABLE receipts ENABLE TRIGGER USER`;
    }
    const mismatched = await getBuyerJobDetail(BUYER_ID, queued.jobId, {
      sql: database.sql,
    });
    assert.equal(mismatched?.evidence.receipt, "failed");
    assert.equal(mismatched?.evidenceDetail.receipt, null);
    assert.equal(mismatched?.evidenceDetail.delivery, null);
    assert.equal(mismatched?.evidenceDetail.financial.settlement, null);
    assert.equal(mismatched?.evidenceDetail.errorCode, "RECEIPT_EFFECT_HASH_MISMATCH");
    const mismatchedList = await listBuyerJobs(BUYER_ID, { sql: database.sql });
    assert.equal(mismatchedList[0]?.evidence.receipt, "failed");

    const cancelable = await submitJob(BUYER_ID, {
      agentVersionId: published.versionId,
      idempotencyKey: "a5-cancel-submit",
      task: { prompt: "Cancel this task before execution." },
    }, { now: new Date(BASE_TIME.getTime() + 1_000), sql: database.sql });
    await cancelBuyerJob(BUYER_ID, cancelable.jobId, {
      now: new Date(BASE_TIME.getTime() + 1_000),
      sql: database.sql,
    });
    const canceled = await getBuyerJobDetail(BUYER_ID, cancelable.jobId, {
      sql: database.sql,
    });
    assert.equal(canceled?.state, "CANCELED");
    assert.equal(canceled?.evidence.receipt, "unavailable");
    assert.equal(canceled?.evidenceDetail.receipt, null);
    assert.equal(canceled?.evidenceDetail.financial.settlement, null);
    assert.equal(canceled?.evidenceDetail.financial.refund?.reasonCode, "JOB_CANCELED");
  } finally {
    await database.close();
  }
});
