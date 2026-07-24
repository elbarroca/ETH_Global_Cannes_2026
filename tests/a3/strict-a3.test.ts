import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { verifyMessage, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { canonicalJson } from "../../src/kernel/canonical";
import { parseAgentInput } from "../../src/kernel/policy";
import { publishAgent, submitJob } from "../../src/kernel/service";
import {
  A3SimulatedCrashError,
  StrictA3Adapter,
  type StrictA3Hooks,
  type StrictComputeResponse,
  type StrictComputeService,
  type StrictComputeTransport,
  type StrictStorageTransport,
} from "../../src/og/strict-a3";
import {
  runStorageProofVerifier,
  type StorageVerificationRequest,
  type StorageVerificationResult,
} from "../../src/og/storage-verifier";
import type { AdapterExecutionRequest } from "../../src/worker/adapter";
import { runWorkerOnce } from "../../src/worker/runner";
import {
  acquireWorkerLease,
  claimJobs,
  KERNEL_WORKER_LEASE_KEY,
  reconcileExpiredJobs,
  type ClaimedJob,
} from "../../src/worker/store";
import {
  configureDatabaseEnvironment,
  startDisposableDatabase,
  type DisposableDatabase,
} from "../helpers/postgres";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const GO_TOOL = resolve(ROOT, "tools/0g-storage-verifier");
const BASE_TIME = new Date("2026-07-24T05:00:00.000Z");
const BUYER_ID = "a3-buyer";
const CREATOR_ID = "a3-creator";
const BUYER_WALLET = "0x1111111111111111111111111111111111111111";
const CREATOR_WALLET = "0x2222222222222222222222222222222222222222";
const PROVIDER = "0x3333333333333333333333333333333333333333";
const MODEL = "fixture-tee-model-v1";
const INDEXER = "https://fixture-indexer.invalid";
const SIGNER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const WRONG_SIGNER_KEY = "0x59c6995e998f97a5a0044976f0945389dc9e86dae88c7a8412f4603b6b78690d";
const signer = privateKeyToAccount(SIGNER_KEY);
const wrongSigner = privateKeyToAccount(WRONG_SIGNER_KEY);

let tempDirectory = "";
let fixtureBinary = "";

before(async () => {
  tempDirectory = await mkdtemp(join(tmpdir(), "alphadawg-a3-test-"));
  fixtureBinary = join(tempDirectory, "0g-storage-fixture");
  const result = spawnSync(process.env.GO_BINARY ?? "go", [
    "build",
    "-o",
    fixtureBinary,
    "./cmd/fixture",
  ], { cwd: GO_TOOL, encoding: "utf8", timeout: 120_000 });
  if (result.status !== 0) {
    throw new Error(`Go fixture build failed: ${result.stderr || result.stdout}`);
  }
});

after(async () => {
  if (tempDirectory) await rm(tempDirectory, { force: true, recursive: true });
});

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

type ComputeFailure =
  | "none"
  | "signature-false"
  | "signature-missing"
  | "signature-malformed"
  | "wrong-signer"
  | "compute-tamper"
  | "crash-after-request-sent";

class FixtureCompute implements StrictComputeTransport {
  readonly calls = { resolve: 0, headers: 0, send: 0, signature: 0, verify: 0 };
  private requestCrashRaised = false;

  constructor(
    readonly content: string,
    private readonly failure: ComputeFailure = "none",
    private readonly onResolve?: () => Promise<void>,
  ) {}

  async resolveService(): Promise<StrictComputeService> {
    this.calls.resolve += 1;
    await this.onResolve?.();
    return {
      provider: PROVIDER,
      model: MODEL,
      baseUrl: "https://fixture-provider.invalid",
      endpoint: "https://fixture-provider.invalid/v1/proxy",
      verifiability: "TeeML",
      teeSignerAddress: signer.address.toLowerCase(),
      teeSignerAcknowledged: true,
      additionalInfo: {
        TargetSeparated: true,
        TargetTeeAddress: signer.address.toLowerCase(),
      },
    };
  }

  async getRequestHeaders(): Promise<Record<string, string>> {
    this.calls.headers += 1;
    if (this.failure === "crash-after-request-sent" && !this.requestCrashRaised) {
      this.requestCrashRaised = true;
      throw new A3SimulatedCrashError();
    }
    return { Authorization: "Bearer fixture-only" };
  }

  async sendRequest(): Promise<StrictComputeResponse> {
    this.calls.send += 1;
    const content = this.failure === "compute-tamper" ? `${this.content}!` : this.content;
    return {
      status: 200,
      provider: PROVIDER,
      model: MODEL,
      requestId: "fixture-request-1",
      body: { model: MODEL, choices: [{ message: { role: "assistant", content } }] },
    };
  }

  async fetchSignature(): Promise<unknown> {
    this.calls.signature += 1;
    if (this.failure === "signature-missing") return {};
    if (this.failure === "signature-malformed") return { text: this.content, signature: "bad" };
    const account = this.failure === "wrong-signer" ? wrongSigner : signer;
    return {
      text: this.content,
      signature: await account.signMessage({ message: this.content }),
    };
  }

  async verifySignature(
    signedText: string,
    signature: string,
    expectedSigner: string,
  ): Promise<boolean> {
    this.calls.verify += 1;
    if (this.failure === "signature-false") return false;
    return verifyMessage({
      address: expectedSigner as Address,
      message: signedText,
      signature: signature as Hex,
    });
  }
}

class FixtureStorage implements StrictStorageTransport {
  calls = 0;
  private crashRaised = false;

  constructor(
    private readonly wrongRoot = false,
    private readonly crashAfterRequest = false,
  ) {}

  async store(request: { bytes: Uint8Array }): Promise<unknown> {
    this.calls += 1;
    if (this.crashAfterRequest && !this.crashRaised) {
      this.crashRaised = true;
      throw new A3SimulatedCrashError();
    }
    return { root: this.wrongRoot ? `0x${"0".repeat(64)}` : `0x${sha256(request.bytes)}` };
  }
}

type VerifierFailure =
  | "none"
  | "storage-tamper"
  | "wrong-digest"
  | "wrong-size"
  | "wrong-schema"
  | "receipt-missing"
  | "receipt-unknown"
  | "missing-output"
  | "unknown-output";

function fixtureVerifier(
  content: string,
  failure: VerifierFailure,
  counter: { calls: number },
): (request: StorageVerificationRequest, signal: AbortSignal) => Promise<StorageVerificationResult> {
  return async (request, signal) => {
    counter.calls += 1;
    if (failure === "missing-output") {
      return { verified: true } as unknown as StorageVerificationResult;
    }
    if (failure === "unknown-output") {
      return {
        schemaVersion: 1,
        effectId: request.effectId,
        root: request.root,
        digest: request.expectedDigest,
        size: request.expectedSize,
        verified: true,
        unknown: true,
      } as unknown as StorageVerificationResult;
    }
    let candidate: StorageVerificationRequest = { ...request };
    if (failure === "wrong-digest") candidate = { ...candidate, expectedDigest: "0".repeat(64) };
    if (failure === "wrong-size") candidate = { ...candidate, expectedSize: candidate.expectedSize + 1 };
    if (failure === "wrong-schema") {
      candidate = { ...candidate, schemaVersion: 2 as 1 };
    }
    if (failure === "receipt-missing" || failure === "receipt-unknown") {
      const receipt = JSON.parse(candidate.receiptBytes) as Record<string, unknown>;
      if (failure === "receipt-missing") delete receipt.size;
      else receipt.unknown = true;
      const receiptBytes = canonicalJson(receipt as never);
      candidate = { ...candidate, receiptBytes, receiptDigest: sha256(receiptBytes) };
    }
    const fixtureContent = failure === "storage-tamper" ? `${content}!` : content;
    return runStorageProofVerifier(candidate, {
      executablePath: fixtureBinary,
      env: {
        ...process.env,
        ALPHADAWG_A3_FIXTURE_CONTENT_BASE64: Buffer.from(fixtureContent).toString("base64"),
      },
      signal,
      timeoutMs: 10_000,
    });
  };
}

async function setupKernel(database: DisposableDatabase): Promise<string> {
  configureDatabaseEnvironment(database.url);
  await database.sql`
    INSERT INTO users (id, wallet_address) VALUES
      (${BUYER_ID}, ${BUYER_WALLET}),
      (${CREATOR_ID}, ${CREATOR_WALLET})
  `;
  const parsed = parseAgentInput({
    name: "Strict A3 Fixture Agent",
    description: "A deterministic agent used only by the strict offline A3 integration tests.",
    instructions: "Return exactly one deterministic fixture analysis response for verification.",
    capabilities: ["research"],
  }, CREATOR_WALLET);
  const agent = await publishAgent(
    { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
    parsed.manifest,
    { now: BASE_TIME, sql: database.sql },
  );
  return agent.versionId;
}

async function submit(
  database: DisposableDatabase,
  agentVersionId: string,
  idempotencyKey: string,
  now = BASE_TIME,
) {
  return submitJob(BUYER_ID, {
    agentVersionId,
    idempotencyKey,
    task: { prompt: `strict fixture task ${idempotencyKey}` },
  }, { now, sql: database.sql });
}

function fixtureAdapter(
  database: DisposableDatabase,
  options: {
    content?: string;
    computeFailure?: ComputeFailure;
    verifierFailure?: VerifierFailure;
    wrongRoot?: boolean;
    storageCrash?: boolean;
    hooks?: StrictA3Hooks;
    now?: Date;
    onResolve?: () => Promise<void>;
  } = {},
): {
  adapter: StrictA3Adapter;
  compute: FixtureCompute;
  storage: FixtureStorage;
  verifier: { calls: number };
} {
  const content = options.content ?? "deterministic verified fixture output";
  const compute = new FixtureCompute(content, options.computeFailure, options.onResolve);
  const storage = new FixtureStorage(options.wrongRoot, options.storageCrash);
  const verifier = { calls: 0 };
  return {
    compute,
    storage,
    verifier,
    adapter: new StrictA3Adapter({
      sql: database.sql,
      now: options.now ?? BASE_TIME,
      hooks: options.hooks,
      fixture: {
        provider: PROVIDER,
        model: MODEL,
        storageIndexerUrl: INDEXER,
        compute,
        storage,
        verifier: fixtureVerifier(content, options.verifierFailure ?? "none", verifier),
      },
    }),
  };
}

async function terminalSnapshot(database: DisposableDatabase, jobId: string) {
  const rows = await database.sql<{
    job_state: string;
    effect_state: string;
    effects: number;
    receipts: number;
    settlements: number;
    commissions: number;
    refunds: number;
    ratings: number;
    trade_actions: number;
    journal_stage: string | null;
    proof_hash: string | null;
  }[]>`
    SELECT
      j.state AS job_state,
      e.state AS effect_state,
      (SELECT count(*)::int FROM effects WHERE job_id = j.id) AS effects,
      (SELECT count(*)::int FROM receipts WHERE job_id = j.id) AS receipts,
      (SELECT count(*)::int FROM settlements WHERE job_id = j.id) AS settlements,
      (SELECT count(*)::int FROM commissions WHERE job_id = j.id) AS commissions,
      (SELECT count(*)::int FROM refunds WHERE job_id = j.id) AS refunds,
      (SELECT count(*)::int FROM agent_ratings) AS ratings,
      (SELECT count(*)::int FROM agent_actions WHERE action_type = 'trade') AS trade_actions,
      journal.stage AS journal_stage,
      journal.proof_hash
    FROM jobs j
    JOIN effects e ON e.job_id = j.id
    LEFT JOIN a3_execution_journals journal ON journal.effect_id = e.id
    WHERE j.id = ${jobId}::uuid
  `;
  const row = rows[0];
  if (!row) throw new Error("A3_TEST_SNAPSHOT_MISSING");
  return row;
}

test("strict fixture binds signed Compute bytes to proved Storage readback and one settlement", async () => {
  const database = await startDisposableDatabase("a3-success");
  try {
    const agentVersionId = await setupKernel(database);
    const submissions = await Promise.all(Array.from({ length: 20 }, () => submit(
      database,
      agentVersionId,
      "a3-twenty-identical",
    )));
    assert.equal(new Set(submissions.map((entry) => entry.effectId)).size, 1);
    const submitted = submissions[0];
    assert.ok(submitted);
    const fixture = fixtureAdapter(database);
    assert.deepEqual(await runWorkerOnce({
      ownerId: "a3-success-worker",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: fixture.adapter,
      sql: database.sql,
      now: BASE_TIME,
    }), { leaseAcquired: true, claimed: 1 });

    assert.deepEqual(fixture.compute.calls, {
      resolve: 1,
      headers: 1,
      send: 1,
      signature: 1,
      verify: 1,
    });
    assert.equal(fixture.storage.calls, 1);
    assert.equal(fixture.verifier.calls, 1);
    const successSnapshot = await terminalSnapshot(database, submitted.jobId);
    assert.match(successSnapshot.proof_hash ?? "", /^[0-9a-f]{64}$/);
    assert.deepEqual({ ...successSnapshot, proof_hash: "<verified>" }, {
      job_state: "SUCCEEDED",
      effect_state: "SUCCEEDED",
      effects: 1,
      receipts: 1,
      settlements: 1,
      commissions: 1,
      refunds: 0,
      ratings: 0,
      trade_actions: 0,
      journal_stage: "READBACK_VERIFIED",
      proof_hash: "<verified>",
    });
    const proofRows = await database.sql<{ proof_hash: string; receipt_proof: string; version: number }[]>`
      SELECT journal.proof_hash, receipt.proof_hash AS receipt_proof, journal.version
      FROM a3_execution_journals journal
      JOIN receipts receipt ON receipt.effect_id = journal.effect_id
      WHERE journal.effect_id = ${submitted.effectId}
    `;
    assert.match(proofRows[0]?.proof_hash ?? "", /^[0-9a-f]{64}$/);
    assert.equal(proofRows[0]?.receipt_proof, proofRows[0]?.proof_hash);
    assert.equal(proofRows[0]?.version, 5);
    await assert.rejects(database.sql`
      UPDATE a3_execution_journals SET response_content = 'tampered', version = version + 1
      WHERE effect_id = ${submitted.effectId}
    `, /terminal A3 journal is immutable/);
  } finally {
    await database.close();
  }
});

test("all Compute, Storage, receipt, and verifier failures produce no delivery or side effect", async () => {
  const database = await startDisposableDatabase("a3-failures");
  try {
    const agentVersionId = await setupKernel(database);
    const cases: Array<{
      name: string;
      computeFailure?: ComputeFailure;
      verifierFailure?: VerifierFailure;
      wrongRoot?: boolean;
    }> = [
      { name: "signature-false", computeFailure: "signature-false" },
      { name: "signature-missing", computeFailure: "signature-missing" },
      { name: "signature-malformed", computeFailure: "signature-malformed" },
      { name: "wrong-signer", computeFailure: "wrong-signer" },
      { name: "compute-tamper", computeFailure: "compute-tamper" },
      { name: "storage-tamper", verifierFailure: "storage-tamper" },
      { name: "wrong-root", wrongRoot: true },
      { name: "wrong-digest", verifierFailure: "wrong-digest" },
      { name: "wrong-size", verifierFailure: "wrong-size" },
      { name: "wrong-schema", verifierFailure: "wrong-schema" },
      { name: "receipt-missing", verifierFailure: "receipt-missing" },
      { name: "receipt-unknown", verifierFailure: "receipt-unknown" },
      { name: "output-missing", verifierFailure: "missing-output" },
      { name: "output-unknown", verifierFailure: "unknown-output" },
    ];
    for (let index = 0; index < cases.length; index += 1) {
      const item = cases[index];
      const now = new Date(BASE_TIME.getTime() + index * 1_000);
      const submitted = await submit(database, agentVersionId, `a3-failure-${item.name}`, now);
      const fixture = fixtureAdapter(database, { ...item, now });
      await runWorkerOnce({
        ownerId: "a3-failure-worker",
        concurrency: 1,
        leaseSeconds: 30,
        adapter: fixture.adapter,
        sql: database.sql,
        now,
      });
      const snapshot = await terminalSnapshot(database, submitted.jobId);
      assert.equal(snapshot.job_state, "FAILED", item.name);
      assert.equal(snapshot.effect_state, "FAILED", item.name);
      assert.equal(snapshot.effects, 1, item.name);
      assert.equal(snapshot.receipts, 0, item.name);
      assert.equal(snapshot.settlements, 0, item.name);
      assert.equal(snapshot.commissions, 0, item.name);
      assert.equal(snapshot.refunds, 1, item.name);
      assert.equal(snapshot.ratings, 0, item.name);
      assert.equal(snapshot.trade_actions, 0, item.name);
      assert.equal(snapshot.journal_stage, "FAILED", item.name);
      assert.equal(snapshot.proof_hash, null, item.name);
    }

    const directRequest: AdapterExecutionRequest = {
      effectId: "0".repeat(64),
      jobId: "00000000-0000-4000-8000-000000000001",
      intentId: "00000000-0000-4000-8000-000000000002",
      buyerUserId: BUYER_ID,
      agentVersionId,
      ownerUserId: CREATOR_ID,
      leaseOwner: "none",
      workerEpoch: "0",
      claimVersion: 0,
      leaseExpiresAt: BASE_TIME,
      attempt: 0,
      maxAttempts: 3,
      input: { prompt: "disabled" },
      signal: new AbortController().signal,
    };
    const disabled = new StrictA3Adapter({
      sql: database.sql,
      environment: { NODE_ENV: "test" },
    });
    assert.deepEqual(await disabled.execute(directRequest), {
      ok: false,
      errorCode: "A3_LIVE_BLOCKED",
      retryable: false,
    });
  } finally {
    await database.close();
  }
});

test("crash recovery skips every completed remote stage and retains one effect", async () => {
  const database = await startDisposableDatabase("a3-recovery");
  try {
    const agentVersionId = await setupKernel(database);
    const phases: Array<{
      name: keyof StrictA3Hooks;
      stage: string;
      firstCounts: [number, number, number];
    }> = [
      { name: "afterPrepared", stage: "PREPARED", firstCounts: [0, 0, 0] },
      { name: "afterResponseVerified", stage: "RESPONSE_VERIFIED", firstCounts: [1, 0, 0] },
      { name: "afterStorageCommitted", stage: "STORAGE_COMMITTED", firstCounts: [1, 1, 0] },
      { name: "afterReadbackVerified", stage: "READBACK_VERIFIED", firstCounts: [1, 1, 1] },
    ];
    for (let index = 0; index < phases.length; index += 1) {
      const phase = phases[index];
      const now = new Date(BASE_TIME.getTime() + index * 1_000);
      const submitted = await submit(database, agentVersionId, `a3-crash-${phase.name}`, now);
      let crashed = false;
      const fixture = fixtureAdapter(database, {
        now,
        hooks: {
          [phase.name]: async () => {
            if (crashed) return;
            crashed = true;
            throw new A3SimulatedCrashError();
          },
        },
      });
      await runWorkerOnce({
        ownerId: "a3-recovery-worker",
        concurrency: 1,
        leaseSeconds: 30,
        adapter: fixture.adapter,
        sql: database.sql,
        now,
      });
      const afterCrash = await terminalSnapshot(database, submitted.jobId);
      assert.equal(afterCrash.job_state, "QUEUED", phase.name);
      assert.equal(afterCrash.journal_stage, phase.stage, phase.name);
      assert.deepEqual([
        fixture.compute.calls.send,
        fixture.storage.calls,
        fixture.verifier.calls,
      ], phase.firstCounts, phase.name);
      const callsAfterCrash = {
        compute: { ...fixture.compute.calls },
        storage: fixture.storage.calls,
        verifier: fixture.verifier.calls,
      };
      await runWorkerOnce({
        ownerId: "a3-recovery-worker",
        concurrency: 1,
        leaseSeconds: 30,
        adapter: fixture.adapter,
        sql: database.sql,
        now: new Date(now.getTime() + 100),
      });
      const completed = await terminalSnapshot(database, submitted.jobId);
      assert.equal(completed.job_state, "SUCCEEDED", phase.name);
      assert.equal(completed.effects, 1, phase.name);
      assert.equal(completed.receipts, 1, phase.name);
      assert.equal(completed.settlements, 1, phase.name);
      assert.equal(completed.commissions, 1, phase.name);
      if (phase.stage !== "PREPARED") {
        assert.equal(fixture.compute.calls.send, callsAfterCrash.compute.send, phase.name);
        assert.equal(fixture.compute.calls.signature, callsAfterCrash.compute.signature, phase.name);
      }
      if (phase.stage === "STORAGE_COMMITTED" || phase.stage === "READBACK_VERIFIED") {
        assert.equal(fixture.storage.calls, callsAfterCrash.storage, phase.name);
      }
      if (phase.stage === "READBACK_VERIFIED") {
        assert.equal(fixture.verifier.calls, callsAfterCrash.verifier, phase.name);
      }
    }
  } finally {
    await database.close();
  }
});

test("ambiguous Compute and Storage dispatch markers terminalize without blind retry", async () => {
  const database = await startDisposableDatabase("a3-ambiguous");
  try {
    const agentVersionId = await setupKernel(database);
    const computeJob = await submit(database, agentVersionId, "a3-ambiguous-compute");
    const computeFixture = fixtureAdapter(database, {
      computeFailure: "crash-after-request-sent",
    });
    await runWorkerOnce({
      ownerId: "a3-ambiguous-worker",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: computeFixture.adapter,
      sql: database.sql,
      now: BASE_TIME,
    });
    assert.equal((await terminalSnapshot(database, computeJob.jobId)).journal_stage, "REQUEST_SENT");
    await runWorkerOnce({
      ownerId: "a3-ambiguous-worker",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: computeFixture.adapter,
      sql: database.sql,
      now: new Date(BASE_TIME.getTime() + 100),
    });
    const computeFailed = await terminalSnapshot(database, computeJob.jobId);
    assert.equal(computeFailed.job_state, "FAILED");
    assert.equal(computeFailed.journal_stage, "FAILED");
    assert.equal(computeFixture.compute.calls.headers, 1);
    assert.equal(computeFixture.compute.calls.send, 0);
    assert.equal(computeFixture.storage.calls, 0);

    const storageTime = new Date(BASE_TIME.getTime() + 1_000);
    const storageJob = await submit(
      database,
      agentVersionId,
      "a3-ambiguous-storage",
      storageTime,
    );
    const storageFixture = fixtureAdapter(database, { now: storageTime, storageCrash: true });
    await runWorkerOnce({
      ownerId: "a3-ambiguous-worker",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: storageFixture.adapter,
      sql: database.sql,
      now: storageTime,
    });
    assert.equal((await terminalSnapshot(database, storageJob.jobId)).journal_stage, "STORAGE_REQUESTED");
    await runWorkerOnce({
      ownerId: "a3-ambiguous-worker",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: storageFixture.adapter,
      sql: database.sql,
      now: new Date(storageTime.getTime() + 100),
    });
    const storageFailed = await terminalSnapshot(database, storageJob.jobId);
    assert.equal(storageFailed.job_state, "FAILED");
    assert.equal(storageFailed.journal_stage, "FAILED");
    assert.equal(storageFixture.compute.calls.send, 1);
    assert.equal(storageFixture.storage.calls, 1);
    assert.equal(storageFixture.verifier.calls, 0);
  } finally {
    await database.close();
  }
});

function requestFromClaim(claim: ClaimedJob, signal: AbortSignal): AdapterExecutionRequest {
  return { ...claim, signal };
}

test("replaced ownership fences every post-replacement journal and adapter mutation", async () => {
  const database = await startDisposableDatabase("a3-stale");
  try {
    const agentVersionId = await setupKernel(database);
    const submitted = await submit(database, agentVersionId, "a3-stale-owner");
    assert.equal((await acquireWorkerLease("a3-owner-a", 30, {
      now: BASE_TIME,
      sql: database.sql,
    })).acquired, true);
    const claimA = (await claimJobs("a3-owner-a", 1, 30, {
      now: BASE_TIME,
      sql: database.sql,
    }))[0];
    if (!claimA) throw new Error("A3_TEST_CLAIM_MISSING");

    let claimB: ClaimedJob | undefined;
    let takeoverError: unknown;
    const takeover = async (): Promise<void> => {
      try {
        const heartbeat = new Date(BASE_TIME.getTime() - 2_000);
        const expired = new Date(BASE_TIME.getTime() - 1_000);
        await database.sql`
          UPDATE worker_leases SET expires_at = ${expired}, heartbeat_at = ${heartbeat}
          WHERE key = ${KERNEL_WORKER_LEASE_KEY}
        `;
        await database.sql`
          UPDATE jobs SET lease_expires_at = ${expired}
          WHERE id = ${submitted.jobId}::uuid
        `;
        assert.equal((await acquireWorkerLease("a3-owner-b", 30, {
          now: BASE_TIME,
          sql: database.sql,
        })).acquired, true);
        await reconcileExpiredJobs({ now: BASE_TIME, sql: database.sql });
        claimB = (await claimJobs("a3-owner-b", 1, 30, {
          now: BASE_TIME,
          sql: database.sql,
        }))[0];
      } catch (error) {
        takeoverError = error;
        throw error;
      }
    };
    const fixture = fixtureAdapter(database, { onResolve: takeover });
    const staleOutcome = await fixture.adapter
      .execute(requestFromClaim(claimA, new AbortController().signal))
      .catch((error: unknown) => error);
    if (staleOutcome instanceof Error) {
      assert.match(staleOutcome.message, /A3_CLAIM_LOST/);
    } else {
      assert.ok(staleOutcome && typeof staleOutcome === "object" && "ok" in staleOutcome);
      assert.equal(staleOutcome.ok, false);
    }
    assert.equal(takeoverError, undefined);
    assert.equal(claimB?.jobId, submitted.jobId, JSON.stringify(staleOutcome));
    assert.deepEqual(fixture.compute.calls, {
      resolve: 1,
      headers: 0,
      send: 0,
      signature: 0,
      verify: 0,
    });
    assert.equal(fixture.storage.calls, 0);
    assert.equal(fixture.verifier.calls, 0);
    const rows = await database.sql<{
      stage: string;
      version: number;
      receipts: number;
      settlements: number;
      commissions: number;
    }[]>`
      SELECT journal.stage, journal.version,
        (SELECT count(*)::int FROM receipts WHERE job_id = ${submitted.jobId}::uuid) AS receipts,
        (SELECT count(*)::int FROM settlements WHERE job_id = ${submitted.jobId}::uuid) AS settlements,
        (SELECT count(*)::int FROM commissions WHERE job_id = ${submitted.jobId}::uuid) AS commissions
      FROM a3_execution_journals journal
      WHERE journal.effect_id = ${submitted.effectId}
    `;
    assert.deepEqual(rows[0], {
      stage: "PREPARED",
      version: 0,
      receipts: 0,
      settlements: 0,
      commissions: 0,
    });
    await assert.rejects(database.sql`
      UPDATE a3_execution_journals
      SET stage = 'STORAGE_REQUESTED', version = version + 1
      WHERE effect_id = ${submitted.effectId}
    `, /illegal A3 journal transition/);
  } finally {
    await database.close();
  }
});
