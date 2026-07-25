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
import { buildManifestV3 } from "../../src/kernel/agent-catalog";
import { canonicalJson, domainHash, type CanonicalValue } from "../../src/kernel/canonical";
import { parseAgentInput } from "../../src/kernel/policy";
import { publishAgent, submitJob } from "../../src/kernel/service";
import type { AgentManifest, AgentManifestV1, AgentManifestV3 } from "../../src/kernel/types";
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
import type { AdapterExecutionRequest, KernelAdapter } from "../../src/worker/adapter";
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
import { createEnsAuthorityFixture } from "../helpers/ens";

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
  | "signature-stall"
  | "wrong-signer"
  | "compute-tamper"
  | "send-stall"
  | "crash-after-request-sent";

class FixtureCompute implements StrictComputeTransport {
  readonly calls = { resolve: 0, headers: 0, send: 0, signature: 0, verify: 0 };
  readonly requestBytes: string[] = [];
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

  async getRequestHeaders(_service: StrictComputeService, requestBytes: string): Promise<Record<string, string>> {
    this.calls.headers += 1;
    this.requestBytes.push(requestBytes);
    if (this.failure === "crash-after-request-sent" && !this.requestCrashRaised) {
      this.requestCrashRaised = true;
      throw new A3SimulatedCrashError();
    }
    return { Authorization: "Bearer fixture-only" };
  }

  async sendRequest(): Promise<StrictComputeResponse> {
    this.calls.send += 1;
    if (this.failure === "send-stall") {
      return new Promise<StrictComputeResponse>(() => undefined);
    }
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
    if (this.failure === "signature-stall") {
      return new Promise<unknown>(() => undefined);
    }
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

type ProcessVerifierFailure =
  | "abort"
  | "crash"
  | "malformed"
  | "nonzero"
  | "oversize"
  | "timeout";

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

function processFailureVerifier(
  failure: ProcessVerifierFailure,
  counter: { calls: number },
): (request: StorageVerificationRequest, signal: AbortSignal) => Promise<StorageVerificationResult> {
  return async (request, signal) => {
    counter.calls += 1;
    const controller = new AbortController();
    const onParentAbort = (): void => controller.abort(signal.reason);
    signal.addEventListener("abort", onParentAbort, { once: true });
    if (signal.aborted) onParentAbort();
    const abortTimer = failure === "abort"
      ? setTimeout(() => controller.abort(), 30)
      : null;
    const script = failure === "malformed"
      ? "process.stdout.write('{')"
      : failure === "crash"
        ? "process.abort()"
        : failure === "nonzero"
          ? "process.exit(17)"
          : failure === "oversize"
            ? "process.stdout.write('x'.repeat(70000))"
            : "setInterval(() => undefined, 1000)";
    try {
      return await runStorageProofVerifier(request, {
        executablePath: process.execPath,
        args: ["-e", script],
        signal: controller.signal,
        timeoutMs: failure === "timeout" ? 30 : 2_000,
      });
    } finally {
      if (abortTimer) clearTimeout(abortTimer);
      signal.removeEventListener("abort", onParentAbort);
    }
  };
}

type ManifestFixture =
  | "v1"
  | "v2"
  | "v3"
  | "malformed-v2"
  | "owner-tampered-v1"
  | "unknown";

function manifestFixture(
  manifest: AgentManifest,
  fixture: ManifestFixture,
): AgentManifest {
  if (fixture === "v2") return manifest;
  if (fixture === "v3") {
    return buildManifestV3({
      templateId: "market-pulse",
      name: manifest.name,
      description: manifest.description,
      ownerWallet: manifest.ownerWallet,
    });
  }
  if (fixture === "malformed-v2") {
    return { ...manifest, instructions: 7 } as unknown as AgentManifest;
  }
  if (fixture === "unknown") {
    return { ...manifest, schemaVersion: 4 } as unknown as AgentManifest;
  }
  const v1: AgentManifestV1 = {
    schemaVersion: 1,
    name: manifest.name,
    description: manifest.description,
    instructions: manifest.instructions,
    capabilities: manifest.capabilities,
    adapterKey: manifest.adapterKey,
    endpoint: manifest.endpoint,
    connectorKey: manifest.connectorKey,
    ownerWallet: fixture === "owner-tampered-v1" ? BUYER_WALLET : manifest.ownerWallet,
    payoutAddress: null,
    priceAtomic: manifest.priceAtomic,
    asset: manifest.asset,
    proofPolicy: manifest.proofPolicy,
    ensBinding: manifest.ensBinding,
  };
  return v1;
}

async function setupKernel(
  database: DisposableDatabase,
  fixture: ManifestFixture = "v2",
  suffix = "",
): Promise<string> {
  configureDatabaseEnvironment(database.url);
  await database.sql`
    INSERT INTO users (id, wallet_address) VALUES
      (${BUYER_ID}, ${BUYER_WALLET}),
      (${CREATOR_ID}, ${CREATOR_WALLET})
    ON CONFLICT (id) DO NOTHING
  `;
  const parsed = parseAgentInput({
    name: `Strict A3 Fixture Agent${suffix}`,
    description: "A deterministic agent used only by the strict offline A3 integration tests.",
    instructions: "Return exactly one deterministic fixture analysis response for verification.",
    capabilities: ["research"],
  }, CREATOR_WALLET);
  const manifest = manifestFixture(parsed.manifest, fixture);
  const requiresHistoricalPublication = fixture === "v1" ||
    fixture === "owner-tampered-v1" || fixture === "unknown";
  if (requiresHistoricalPublication) {
    await database.sql`
      ALTER TABLE agent_versions DISABLE TRIGGER agent_versions_manifest_v2_publication
    `;
  }
  let agent: Awaited<ReturnType<typeof publishAgent>> | undefined;
  try {
    agent = await publishAgent(
      { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
      manifest,
      { now: BASE_TIME, sql: database.sql },
    );
  } finally {
    if (requiresHistoricalPublication) {
      await database.sql`
        ALTER TABLE agent_versions ENABLE TRIGGER agent_versions_manifest_v2_publication
      `;
    }
  }
  if (!agent) throw new Error("A3_TEST_AGENT_CREATE_FAILED");
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

async function seedContextBearingJob(
  database: DisposableDatabase,
  agentVersionId: string,
  idempotencyKey: string,
  prompt: string,
  now: Date,
): Promise<{ effectId: string; inputHash: string; jobId: string }> {
  const input = { prompt };
  const inputHash = domainHash("job-input", input);
  const quotes = await database.sql<{ id: string }[]>`
    INSERT INTO quotes (
      buyer_user_id, agent_version_id, idempotency_key, input_hash,
      amount_atomic, asset, expires_at, created_at
    ) VALUES (
      ${BUYER_ID}, ${agentVersionId}::uuid, ${idempotencyKey}, ${inputHash},
      1000, 'USDC_ATOMIC', ${new Date(now.getTime() + 60_000)}, ${now}
    ) RETURNING id
  `;
  const intents = await database.sql<{ id: string }[]>`
    INSERT INTO job_intents (
      buyer_user_id, agent_version_id, idempotency_key, input, input_hash, created_at
    ) VALUES (
      ${BUYER_ID}, ${agentVersionId}::uuid, ${idempotencyKey},
      ${database.sql.json(input)}, ${inputHash}, ${now}
    ) RETURNING id
  `;
  const quoteId = quotes[0]?.id;
  const intentId = intents[0]?.id;
  if (!quoteId || !intentId) throw new Error("A3_TEST_CONTEXT_JOB_CREATE_FAILED");
  const orders = await database.sql<{ id: string }[]>`
    INSERT INTO kernel_orders (
      buyer_user_id, agent_version_id, intent_id, quote_id, amount_atomic, asset, created_at
    ) VALUES (
      ${BUYER_ID}, ${agentVersionId}::uuid, ${intentId}::uuid, ${quoteId}::uuid,
      1000, 'USDC_ATOMIC', ${now}
    ) RETURNING id
  `;
  const orderId = orders[0]?.id;
  if (!orderId) throw new Error("A3_TEST_CONTEXT_JOB_CREATE_FAILED");
  const jobs = await database.sql<{ id: string }[]>`
    INSERT INTO jobs (
      order_id, intent_id, buyer_user_id, agent_version_id, state, version,
      attempts, max_attempts, available_at, created_at, updated_at
    ) VALUES (
      ${orderId}::uuid, ${intentId}::uuid, ${BUYER_ID}, ${agentVersionId}::uuid,
      'QUEUED', 0, 0, 3, ${now}, ${now}, ${now}
    ) RETURNING id
  `;
  const jobId = jobs[0]?.id;
  if (!jobId) throw new Error("A3_TEST_CONTEXT_JOB_CREATE_FAILED");
  const effectId = domainHash("effect", { inputHash, intentId, jobId });
  await database.sql`
    INSERT INTO effects (
      id, job_id, intent_id, idempotency_key, adapter_key, request_hash,
      state, attempt, created_at, updated_at
    ) VALUES (
      ${effectId}, ${jobId}::uuid, ${intentId}::uuid,
      ${domainHash("effect-idempotency", { buyerUserId: BUYER_ID, idempotencyKey })},
      'protected-a3', ${inputHash}, 'PENDING', 0, ${now}, ${now}
    )
  `;
  await database.sql`
    INSERT INTO job_events (job_id, version, event_type, from_state, to_state, payload, created_at)
    VALUES (${jobId}::uuid, 0, 'JOB_CREATED', NULL, 'QUEUED', '{}'::jsonb, ${now})
  `;
  return { effectId, inputHash, jobId };
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
    deadlineMs?: number;
    now?: Date;
    onResolve?: () => Promise<void>;
    verifierOverride?: (
      request: StorageVerificationRequest,
      signal: AbortSignal,
    ) => Promise<StorageVerificationResult>;
  } = {},
): {
  adapter: StrictA3Adapter;
  compute: FixtureCompute;
  ens: ReturnType<typeof createEnsAuthorityFixture>;
  storage: FixtureStorage;
  verifier: { calls: number };
} {
  const content = options.content ?? "deterministic verified fixture output";
  const compute = new FixtureCompute(content, options.computeFailure, options.onResolve);
  const storage = new FixtureStorage(options.wrongRoot, options.storageCrash);
  const verifier = { calls: 0 };
  const ens = createEnsAuthorityFixture({ now: options.now ?? BASE_TIME });
  return {
    compute,
    ens,
    storage,
    verifier,
    adapter: new StrictA3Adapter({
      sql: database.sql,
      now: options.now ?? BASE_TIME,
      hooks: options.hooks,
      deadlineMs: options.deadlineMs,
      authority: ens.runtime,
      fixture: {
        provider: PROVIDER,
        model: MODEL,
        storageIndexerUrl: INDEXER,
        compute,
        storage,
        verifier: options.verifierOverride ??
          fixtureVerifier(content, options.verifierFailure ?? "none", verifier),
      },
    }),
  };
}

async function terminalSnapshot(database: DisposableDatabase, jobId: string) {
  const rows = await database.sql<{
    job_state: string;
    last_error_code: string | null;
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
      j.last_error_code,
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
    const manifestRows = await database.sql<{ schema_version: number }[]>`
      SELECT (manifest->>'schemaVersion')::int AS schema_version
      FROM agent_versions WHERE id = ${agentVersionId}::uuid
    `;
    assert.equal(manifestRows[0]?.schema_version, 2);
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
      last_error_code: null,
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

test("manifest compatibility preserves v1 and v2 and denies tampering before remote effects", async () => {
  const database = await startDisposableDatabase("a3-manifest");
  try {
    const v1VersionId = await setupKernel(database, "v1", " V1");
    const v1Job = await submit(database, v1VersionId, "a3-manifest-v1");
    const v1Fixture = fixtureAdapter(database);
    await runWorkerOnce({
      ownerId: "a3-manifest-worker",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: v1Fixture.adapter,
      sql: database.sql,
      now: BASE_TIME,
    });
    assert.deepEqual([
      v1Fixture.compute.calls.send,
      v1Fixture.storage.calls,
      v1Fixture.verifier.calls,
    ], [1, 1, 1]);
    const v1Snapshot = await terminalSnapshot(database, v1Job.jobId);
    assert.equal(v1Snapshot.job_state, "SUCCEEDED");
    assert.equal(v1Snapshot.receipts, 1);
    assert.equal(v1Snapshot.settlements, 1);
    assert.equal(v1Snapshot.commissions, 1);

    const cases: Array<{
      fixture: Exclude<ManifestFixture, "v1" | "v2" | "v3">;
      suffix: string;
      errorCode: string;
    }> = [
      { fixture: "malformed-v2", suffix: " Malformed", errorCode: "A3_MANIFEST_INVALID" },
      {
        fixture: "owner-tampered-v1",
        suffix: " Owner Tampered",
        errorCode: "A3_LINEAGE_HASH_MISMATCH",
      },
      { fixture: "unknown", suffix: " Unknown", errorCode: "A3_MANIFEST_INVALID" },
    ];
    await database.sql`
      ALTER TABLE agent_versions DROP CONSTRAINT agent_versions_manifest_schema_check
    `;
    for (let index = 0; index < cases.length; index += 1) {
      const item = cases[index];
      const now = new Date(BASE_TIME.getTime() + (index + 1) * 1_000);
      const versionId = await setupKernel(database, item.fixture, item.suffix);
      const submitted = await submit(database, versionId, `a3-manifest-${item.fixture}`, now);
      const fixture = fixtureAdapter(database, { now });
      await runWorkerOnce({
        ownerId: "a3-manifest-worker",
        concurrency: 1,
        leaseSeconds: 30,
        adapter: fixture.adapter,
        sql: database.sql,
        now,
      });
      assert.deepEqual(fixture.compute.calls, {
        resolve: 0,
        headers: 0,
        send: 0,
        signature: 0,
        verify: 0,
      }, item.fixture);
      assert.equal(fixture.storage.calls, 0, item.fixture);
      assert.equal(fixture.verifier.calls, 0, item.fixture);
      const snapshot = await terminalSnapshot(database, submitted.jobId);
      assert.equal(snapshot.job_state, "FAILED", item.fixture);
      assert.equal(snapshot.last_error_code, item.errorCode, item.fixture);
      assert.equal(snapshot.journal_stage, null, item.fixture);
      assert.equal(snapshot.receipts, 0, item.fixture);
      assert.equal(snapshot.settlements, 0, item.fixture);
      assert.equal(snapshot.commissions, 0, item.fixture);
      assert.equal(snapshot.refunds, 1, item.fixture);
    }

    const tamperedVersionId = await setupKernel(database, "v2", " Tampered");
    const tamperedJob = await submit(
      database,
      tamperedVersionId,
      "a3-manifest-tampered",
      new Date(BASE_TIME.getTime() + 3_000),
    );
    await database.sql`
      ALTER TABLE agent_versions DISABLE TRIGGER agent_versions_immutable_published
    `;
    try {
      await database.sql`
        UPDATE agent_versions
        SET manifest = jsonb_set(manifest, '{instructions}', '"tampered instructions"'::jsonb)
        WHERE id = ${tamperedVersionId}::uuid
      `;
    } finally {
      await database.sql`
        ALTER TABLE agent_versions ENABLE TRIGGER agent_versions_immutable_published
      `;
    }
    const tamperedFixture = fixtureAdapter(database, {
      now: new Date(BASE_TIME.getTime() + 3_000),
    });
    await runWorkerOnce({
      ownerId: "a3-manifest-worker",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: tamperedFixture.adapter,
      sql: database.sql,
      now: new Date(BASE_TIME.getTime() + 3_000),
    });
    assert.deepEqual(tamperedFixture.compute.calls, {
      resolve: 0,
      headers: 0,
      send: 0,
      signature: 0,
      verify: 0,
    });
    assert.equal(tamperedFixture.storage.calls, 0);
    assert.equal(tamperedFixture.verifier.calls, 0);
    const tamperedSnapshot = await terminalSnapshot(database, tamperedJob.jobId);
    assert.equal(tamperedSnapshot.job_state, "FAILED");
    assert.equal(tamperedSnapshot.last_error_code, "A3_LINEAGE_HASH_MISMATCH");
    assert.equal(tamperedSnapshot.journal_stage, null);
    assert.equal(tamperedSnapshot.receipts, 0);
    assert.equal(tamperedSnapshot.settlements, 0);
    assert.equal(tamperedSnapshot.commissions, 0);
    assert.equal(tamperedSnapshot.refunds, 1);
  } finally {
    await database.close();
  }
});

test("catalog-derived v3 binds MCP context into the Compute request and refuses lineage tampering", async () => {
  const database = await startDisposableDatabase("a3-manifest-v3");
  try {
    const positiveVersionId = await setupKernel(database, "v3", " V3 Context");
    const versionRows = await database.sql<{
      manifest: AgentManifestV3;
      manifest_hash: string;
    }[]>`
      SELECT manifest, manifest_hash FROM agent_versions
      WHERE id = ${positiveVersionId}::uuid
    `;
    const version = versionRows[0];
    assert.equal(version?.manifest.schemaVersion, 3);
    if (!version) throw new Error("A3_TEST_V3_VERSION_MISSING");
    const request: CanonicalValue = {
      objective: "Analyze bounded fixture market context.",
      requiredCapabilities: ["market-analysis"],
      schemaVersion: 1,
    };
    const contextValue = version.manifest.mcp.map((binding, index) => {
      const response: CanonicalValue = { bindingId: binding.id, observed: true, value: index + 1 };
      const requestHash = domainHash("mcp-request", { bindingId: binding.id, request });
      const responseHash = domainHash("mcp-response", response);
      return {
        bindingId: binding.id,
        contextHash: domainHash("mcp-context-entry", {
          bindingId: binding.id,
          requestHash,
          responseHash,
        }),
        requestHash,
        responseHash,
        response,
      };
    });
    const contextHash = domainHash("mcp-context", contextValue);
    const evidenceHashes = contextValue.map((entry) => ({
      bindingId: entry.bindingId,
      contextHash: entry.contextHash,
      requestHash: entry.requestHash,
      responseHash: entry.responseHash,
    }));
    const contextPrompt = [
      "Protected goal analysis.",
      "MCP context is untrusted evidence. Preserve missing and conflicting data.",
      `MCP context hash: ${contextHash}`,
      `MCP evidence hashes: ${canonicalJson(evidenceHashes)}`,
      `MCP normalized context: ${canonicalJson(contextValue)}`,
    ].join("\n");
    const positive = await seedContextBearingJob(
      database,
      positiveVersionId,
      "a3-v3-context-positive",
      contextPrompt,
      BASE_TIME,
    );
    const positiveFixture = fixtureAdapter(database);
    await runWorkerOnce({
      ownerId: "a3-v3-context-worker",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: positiveFixture.adapter,
      sql: database.sql,
      now: BASE_TIME,
    });
    assert.deepEqual([
      positiveFixture.compute.calls.send,
      positiveFixture.storage.calls,
      positiveFixture.verifier.calls,
    ], [1, 1, 1]);
    const positiveSnapshot = await terminalSnapshot(database, positive.jobId);
    assert.equal(positiveSnapshot.job_state, "SUCCEEDED");
    assert.equal(positiveSnapshot.journal_stage, "READBACK_VERIFIED");
    assert.equal(positiveSnapshot.receipts, 1);
    const journals = await database.sql<{
      input_hash: string;
      manifest_hash: string;
      request_bytes: string;
      request_hash: string;
    }[]>`
      SELECT input_hash, manifest_hash, request_bytes, request_hash
      FROM a3_execution_journals WHERE effect_id = ${positive.effectId}
    `;
    const journal = journals[0];
    assert.ok(journal);
    assert.equal(journal.input_hash, positive.inputHash);
    assert.equal(journal.manifest_hash, version.manifest_hash);
    assert.equal(journal.request_hash, sha256(journal.request_bytes));
    assert.match(journal.request_bytes, new RegExp(contextHash));
    for (const evidence of evidenceHashes) {
      assert.match(journal.request_bytes, new RegExp(evidence.requestHash));
      assert.match(journal.request_bytes, new RegExp(evidence.responseHash));
      assert.match(journal.request_bytes, new RegExp(evidence.contextHash));
    }

    for (const [index, tamper] of (["manifest", "prompt", "input-hash"] as const).entries()) {
      const now = new Date(BASE_TIME.getTime() + (index + 1) * 1_000);
      const versionId = await setupKernel(database, "v3", ` V3 ${tamper}`);
      const seeded = await seedContextBearingJob(
        database,
        versionId,
        `a3-v3-context-${tamper}`,
        contextPrompt,
        now,
      );
      if (tamper === "manifest") {
        await database.sql`
          ALTER TABLE agent_versions DISABLE TRIGGER agent_versions_immutable_published
        `;
        await database.sql`
          ALTER TABLE agent_versions DISABLE TRIGGER agent_versions_manifest_v2_publication
        `;
        try {
          await database.sql`
            UPDATE agent_versions
            SET manifest = jsonb_set(manifest, '{instructions}', to_jsonb('tampered'::text))
            WHERE id = ${versionId}::uuid
          `;
        } finally {
          await database.sql`
            ALTER TABLE agent_versions ENABLE TRIGGER agent_versions_manifest_v2_publication
          `;
          await database.sql`
            ALTER TABLE agent_versions ENABLE TRIGGER agent_versions_immutable_published
          `;
        }
      } else if (tamper === "prompt") {
        await database.sql`
          UPDATE job_intents
          SET input = ${database.sql.json({ prompt: `${contextPrompt}\ntampered` })}
          WHERE id = (SELECT intent_id FROM jobs WHERE id = ${seeded.jobId}::uuid)
        `;
      } else {
        await database.sql`
          UPDATE job_intents SET input_hash = ${"0".repeat(64)}
          WHERE id = (SELECT intent_id FROM jobs WHERE id = ${seeded.jobId}::uuid)
        `;
      }
      const fixture = fixtureAdapter(database, { now });
      await runWorkerOnce({
        ownerId: "a3-v3-context-worker",
        concurrency: 1,
        leaseSeconds: 30,
        adapter: fixture.adapter,
        sql: database.sql,
        now,
      });
      assert.deepEqual(fixture.compute.calls, {
        resolve: 0,
        headers: 0,
        send: 0,
        signature: 0,
        verify: 0,
      }, tamper);
      assert.equal(fixture.compute.requestBytes.length, 0, tamper);
      assert.equal(fixture.storage.calls, 0, tamper);
      assert.equal(fixture.verifier.calls, 0, tamper);
      const snapshot = await terminalSnapshot(database, seeded.jobId);
      assert.equal(snapshot.job_state, "FAILED", tamper);
      assert.equal(snapshot.last_error_code, "A3_LINEAGE_HASH_MISMATCH", tamper);
      assert.equal(snapshot.journal_stage, null, tamper);
      assert.equal(snapshot.receipts, 0, tamper);
      assert.equal(snapshot.settlements, 0, tamper);
      assert.equal(snapshot.commissions, 0, tamper);
      assert.equal(snapshot.refunds, 1, tamper);
    }
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
      environment: {
        NODE_ENV: "production",
        A3_0G_LIVE_ENABLED: "true",
        A3_0G_FUNDING_AUTHORIZED: "true",
        A3_0G_MAX_SPEND_ATOMIC: "999999999",
        A3_0G_SPEND_AUTHORIZATION: "0g-live-v1:any:any:999999999",
        OG_PROVIDER_ADDRESS: PROVIDER,
        OG_COMPUTE_MODEL: MODEL,
        OG_RPC_URL: "https://rpc.invalid",
        OG_STORAGE_INDEXER: INDEXER,
        OG_STORAGE_VERIFIER_PATH: "/tmp/live-verifier",
        OG_PRIVATE_KEY: `0x${"1".repeat(64)}`,
      },
    });
    assert.deepEqual(await disabled.execute(directRequest), {
      ok: false,
      errorCode: "A3_LIVE_BLOCKED",
      retryable: false,
    });

    const blockedNow = new Date(BASE_TIME.getTime() + 60_000);
    const blocked = await submit(
      database,
      agentVersionId,
      "a3-live-authority-blocked",
      blockedNow,
    );
    const retiredSettings = {
      A3_0G_LIVE_ENABLED: "true",
      A3_0G_FUNDING_AUTHORIZED: "true",
      A3_0G_MAX_SPEND_ATOMIC: "999999999",
      A3_0G_SPEND_AUTHORIZATION: "0g-live-v1:any:any:999999999",
      OG_PROVIDER_ADDRESS: PROVIDER,
      OG_COMPUTE_MODEL: MODEL,
      OG_RPC_URL: "https://rpc.invalid",
      OG_STORAGE_INDEXER: INDEXER,
      OG_STORAGE_VERIFIER_PATH: "/tmp/live-verifier",
      OG_PRIVATE_KEY: `0x${"1".repeat(64)}`,
    };
    const previousSettings = Object.fromEntries(
      Object.keys(retiredSettings).map((key) => [key, process.env[key]]),
    );
    const originalFetch = globalThis.fetch;
    let networkCalls = 0;
    Object.assign(process.env, retiredSettings);
    globalThis.fetch = (async () => {
      networkCalls += 1;
      throw new Error("unexpected A3 network call");
    }) as typeof fetch;
    try {
      await runWorkerOnce({
        ownerId: "a3-live-blocked-worker",
        concurrency: 1,
        leaseSeconds: 30,
        sql: database.sql,
        now: blockedNow,
      });
    } finally {
      globalThis.fetch = originalFetch;
      for (const [key, value] of Object.entries(previousSettings)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
    assert.equal(networkCalls, 0);
    assert.deepEqual(await terminalSnapshot(database, blocked.jobId), {
      job_state: "FAILED",
      last_error_code: "A3_LIVE_BLOCKED",
      effect_state: "FAILED",
      effects: 1,
      receipts: 0,
      settlements: 0,
      commissions: 0,
      refunds: 1,
      ratings: 0,
      trade_actions: 0,
      journal_stage: null,
      proof_hash: null,
    });
  } finally {
    await database.close();
  }
});

test("subprocess malformed, crash, nonzero, timeout, abort, and oversize failures stay fail-closed end-to-end", async () => {
  const database = await startDisposableDatabase("a3-procf");
  try {
    const agentVersionId = await setupKernel(database);
    const cases: Array<{ failure: ProcessVerifierFailure; errorCode: string }> = [
      { failure: "malformed", errorCode: "A3_STORAGE_VERIFIER_MALFORMED_OUTPUT" },
      { failure: "crash", errorCode: "A3_STORAGE_VERIFIER_NONZERO_EXIT" },
      { failure: "nonzero", errorCode: "A3_STORAGE_VERIFIER_NONZERO_EXIT" },
      { failure: "timeout", errorCode: "A3_STORAGE_VERIFIER_TIMEOUT" },
      { failure: "abort", errorCode: "A3_STORAGE_VERIFIER_ABORTED" },
      { failure: "oversize", errorCode: "A3_STORAGE_VERIFIER_OUTPUT_LIMIT" },
    ];
    for (let index = 0; index < cases.length; index += 1) {
      const item = cases[index];
      const now = new Date(BASE_TIME.getTime() + 30_000 + index * 1_000);
      const submitted = await submit(
        database,
        agentVersionId,
        `a3-process-${item.failure}`,
        now,
      );
      const processCalls = { calls: 0 };
      const fixture = fixtureAdapter(database, {
        now,
        verifierOverride: processFailureVerifier(item.failure, processCalls),
      });
      await runWorkerOnce({
        ownerId: "a3-process-worker",
        concurrency: 1,
        leaseSeconds: 30,
        adapter: fixture.adapter,
        sql: database.sql,
        now,
      });
      assert.equal(processCalls.calls, 1, item.failure);
      assert.deepEqual([
        fixture.compute.calls.send,
        fixture.storage.calls,
      ], [1, 1], item.failure);
      const snapshot = await terminalSnapshot(database, submitted.jobId);
      assert.equal(snapshot.job_state, "FAILED", item.failure);
      assert.equal(snapshot.last_error_code, item.errorCode, item.failure);
      assert.equal(snapshot.effect_state, "FAILED", item.failure);
      assert.equal(snapshot.journal_stage, "FAILED", item.failure);
      assert.equal(snapshot.receipts, 0, item.failure);
      assert.equal(snapshot.settlements, 0, item.failure);
      assert.equal(snapshot.commissions, 0, item.failure);
      assert.equal(snapshot.refunds, 1, item.failure);
      assert.equal(snapshot.ratings, 0, item.failure);
      assert.equal(snapshot.trade_actions, 0, item.failure);
      assert.deepEqual(await runWorkerOnce({
        ownerId: "a3-process-worker",
        concurrency: 1,
        leaseSeconds: 30,
        adapter: fixture.adapter,
        sql: database.sql,
        now: new Date(now.getTime() + 100),
      }), { leaseAcquired: true, claimed: 0 });
      assert.equal(processCalls.calls, 1, item.failure);
    }
  } finally {
    await database.close();
  }
});

test("canonical deadline aborts stalled Compute request and signature retrieval", async () => {
  const database = await startDisposableDatabase("a3-deadline");
  try {
    const agentVersionId = await setupKernel(database);
    const cases: Array<{ name: string; failure: ComputeFailure; signatureCalls: number }> = [
      { name: "send", failure: "send-stall", signatureCalls: 0 },
      { name: "signature", failure: "signature-stall", signatureCalls: 1 },
    ];
    for (let index = 0; index < cases.length; index += 1) {
      const item = cases[index];
      const now = new Date(BASE_TIME.getTime() + 45_000 + index * 1_000);
      const submitted = await submit(database, agentVersionId, `a3-deadline-${item.name}`, now);
      const fixture = fixtureAdapter(database, {
        computeFailure: item.failure,
        deadlineMs: 250,
        now,
      });
      const startedAt = Date.now();
      await runWorkerOnce({
        ownerId: "a3-deadline-worker",
        concurrency: 1,
        leaseSeconds: 30,
        adapter: fixture.adapter,
        sql: database.sql,
        now,
      });
      assert.ok(Date.now() - startedAt < 1_000, item.name);
      assert.equal(fixture.compute.calls.send, 1, item.name);
      assert.equal(fixture.compute.calls.signature, item.signatureCalls, item.name);
      assert.equal(fixture.storage.calls, 0, item.name);
      assert.equal(fixture.verifier.calls, 0, item.name);
      const snapshot = await terminalSnapshot(database, submitted.jobId);
      assert.equal(snapshot.job_state, "FAILED", item.name);
      assert.equal(snapshot.last_error_code, "A3_REQUEST_DEADLINE_EXPIRED", item.name);
      assert.equal(snapshot.effect_state, "FAILED", item.name);
      assert.equal(snapshot.journal_stage, "FAILED", item.name);
      assert.equal(snapshot.receipts, 0, item.name);
      assert.equal(snapshot.settlements, 0, item.name);
      assert.equal(snapshot.commissions, 0, item.name);
      assert.equal(snapshot.refunds, 1, item.name);
      assert.equal(snapshot.ratings, 0, item.name);
      assert.equal(snapshot.trade_actions, 0, item.name);
    }
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
      if (phase.stage === "STORAGE_COMMITTED") {
        assert.equal(fixture.storage.calls, callsAfterCrash.storage, phase.name);
      }
    }
  } finally {
    await database.close();
  }
});

test("READBACK_VERIFIED recovers in-process and finalizes without a second adapter call", async () => {
  const database = await startDisposableDatabase("a3-rbi");
  try {
    const agentVersionId = await setupKernel(database);
    const submitted = await submit(database, agentVersionId, "a3-readback-inline");
    await database.sql`
      UPDATE jobs SET max_attempts = 1 WHERE id = ${submitted.jobId}::uuid
    `;
    let crashed = false;
    const fixture = fixtureAdapter(database, {
      hooks: {
        afterReadbackVerified: async () => {
          if (crashed) return;
          crashed = true;
          throw new A3SimulatedCrashError();
        },
      },
    });
    let adapterCalls = 0;
    const adapter: KernelAdapter = {
      key: "protected-a3",
      requiresVerifiedJournal: true,
      execute: async (request) => {
        adapterCalls += 1;
        return fixture.adapter.execute(request);
      },
    };
    await runWorkerOnce({
      ownerId: "a3-readback-inline-worker",
      concurrency: 1,
      leaseSeconds: 30,
      adapter,
      authority: fixture.ens.runtime,
      sql: database.sql,
      now: BASE_TIME,
    });
    assert.equal(adapterCalls, 1);
    assert.deepEqual([
      fixture.compute.calls.send,
      fixture.storage.calls,
      fixture.verifier.calls,
    ], [1, 1, 1]);
    const snapshot = await terminalSnapshot(database, submitted.jobId);
    assert.equal(snapshot.job_state, "SUCCEEDED");
    assert.equal(snapshot.last_error_code, null);
    assert.equal(snapshot.receipts, 1);
    assert.equal(snapshot.settlements, 1);
    assert.equal(snapshot.commissions, 1);
    assert.equal(snapshot.refunds, 0);
  } finally {
    await database.close();
  }
});

test("expired attempt=max READBACK_VERIFIED finalizes before exhaustion with zero adapter calls", async () => {
  const database = await startDisposableDatabase("a3-rbe");
  try {
    const agentVersionId = await setupKernel(database);
    const submitted = await submit(database, agentVersionId, "a3-readback-expired");
    await database.sql`
      UPDATE jobs SET max_attempts = 1 WHERE id = ${submitted.jobId}::uuid
    `;
    assert.equal((await acquireWorkerLease("a3-readback-owner-a", 30, {
      now: BASE_TIME,
      sql: database.sql,
    })).acquired, true);
    const claim = (await claimJobs("a3-readback-owner-a", 1, 30, {
      now: BASE_TIME,
      sql: database.sql,
    }))[0];
    if (!claim) throw new Error("A3_TEST_CLAIM_MISSING");
    assert.equal(claim.attempt, claim.maxAttempts);

    const fixture = fixtureAdapter(database, {
      hooks: {
        afterReadbackVerified: async () => {
          throw new A3SimulatedCrashError();
        },
      },
    });
    await assert.rejects(
      fixture.adapter.execute(requestFromClaim(claim, new AbortController().signal)),
      /A3_SIMULATED_CRASH/,
    );
    const afterKill = await terminalSnapshot(database, submitted.jobId);
    assert.equal(afterKill.job_state, "RUNNING");
    assert.equal(afterKill.effect_state, "RUNNING");
    assert.equal(afterKill.journal_stage, "READBACK_VERIFIED");

    const recoveryTime = new Date(BASE_TIME.getTime() + 31_000);
    const expiredHeartbeat = new Date(BASE_TIME.getTime() - 2_000);
    const expiredLease = new Date(BASE_TIME.getTime() - 1_000);
    await database.sql`
      UPDATE worker_leases
      SET heartbeat_at = ${expiredHeartbeat}, expires_at = ${expiredLease}
      WHERE key = ${KERNEL_WORKER_LEASE_KEY}
    `;
    await database.sql`
      UPDATE jobs SET lease_expires_at = ${expiredLease}
      WHERE id = ${submitted.jobId}::uuid
    `;
    let recoveryAdapterCalls = 0;
    const recoveryAdapter: KernelAdapter = {
      key: "protected-a3",
      requiresVerifiedJournal: true,
      execute: async () => {
        recoveryAdapterCalls += 1;
        throw new Error("RECOVERY_ADAPTER_MUST_NOT_RUN");
      },
    };
    assert.deepEqual(await runWorkerOnce({
      ownerId: "a3-readback-owner-b",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: recoveryAdapter,
      authority: fixture.ens.runtime,
      sql: database.sql,
      now: recoveryTime,
    }), { leaseAcquired: true, claimed: 1 });
    assert.equal(recoveryAdapterCalls, 0);
    assert.deepEqual([
      fixture.compute.calls.send,
      fixture.storage.calls,
      fixture.verifier.calls,
    ], [1, 1, 1]);
    const recovered = await terminalSnapshot(database, submitted.jobId);
    assert.equal(recovered.job_state, "SUCCEEDED");
    assert.equal(recovered.last_error_code, null);
    assert.equal(recovered.receipts, 1);
    assert.equal(recovered.settlements, 1);
    assert.equal(recovered.commissions, 1);
    assert.equal(recovered.refunds, 0);
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
