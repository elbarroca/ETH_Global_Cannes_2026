import assert from "node:assert/strict";
import test from "node:test";
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
import type { StorageVerificationRequest, StorageVerificationResult } from "../../src/og/storage-verifier";
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
import {
  createEnsAuthorityFixture,
  type EnsFixtureMutator,
  type FixtureEnsAuthorityResolver,
} from "../helpers/ens";
import {
  CANONICAL_UNIVERSAL_RESOLVER,
  checkFreshEnsAuthority,
  EnsAuthorityResolverError,
  type EnsAuthorityRuntime,
  UNIVERSAL_RESOLVER_READINESS_VECTOR,
} from "../../src/ens/authority";

const NOW = new Date("2026-07-24T13:00:00.000Z");
const BUYER_ID = "a4-buyer";
const CREATOR_ID = "a4-creator";
const BUYER_WALLET = "0x1000000000000000000000000000000000000001";
const CREATOR_WALLET = "0x2000000000000000000000000000000000000002";
const PROVIDER = "0x4000000000000000000000000000000000000004";
const MODEL = "a4-fixture-model";
const ROOT = `0x${"5".repeat(64)}`;
const SIGNATURE = `0x${"ab".repeat(65)}`;

class FixtureCompute implements StrictComputeTransport {
  readonly calls = { headers: 0, request: 0, resolve: 0, signature: 0, verify: 0 };
  readonly content = "A4 ENS-authorized verified result";

  async resolveService(): Promise<StrictComputeService> {
    this.calls.resolve += 1;
    return {
      provider: PROVIDER,
      model: MODEL,
      baseUrl: "https://fixture.invalid",
      endpoint: "https://fixture.invalid/v1/proxy",
      verifiability: "TeeML",
      teeSignerAddress: CREATOR_WALLET,
      teeSignerAcknowledged: true,
      additionalInfo: { TargetSeparated: true, TargetTeeAddress: CREATOR_WALLET },
    };
  }

  async getRequestHeaders(): Promise<Record<string, string>> {
    this.calls.headers += 1;
    return { Authorization: "fixture" };
  }

  async sendRequest(): Promise<StrictComputeResponse> {
    this.calls.request += 1;
    return {
      status: 200,
      provider: PROVIDER,
      model: MODEL,
      requestId: `a4-request-${this.calls.request}`,
      body: { model: MODEL, choices: [{ message: { content: this.content } }] },
    };
  }

  async fetchSignature(): Promise<unknown> {
    this.calls.signature += 1;
    return { signature: SIGNATURE, text: this.content };
  }

  async verifySignature(): Promise<boolean> {
    this.calls.verify += 1;
    return true;
  }
}

class FixtureStorage implements StrictStorageTransport {
  calls = 0;

  async store(): Promise<unknown> {
    this.calls += 1;
    return { root: ROOT };
  }
}

interface A4Fixture {
  adapter: StrictA3Adapter;
  authority: EnsAuthorityRuntime;
  compute: FixtureCompute;
  ens: FixtureEnsAuthorityResolver;
  storage: FixtureStorage;
  verifier: { calls: number };
}

function fixture(
  database: DisposableDatabase,
  options: {
    hooks?: StrictA3Hooks;
    mutator?: EnsFixtureMutator;
    now?: Date | (() => Date);
    beforeResolve?: (request: Parameters<FixtureEnsAuthorityResolver["resolve"]>[0], call: number) => Promise<void>;
    disposableTestClock?: boolean;
    resolutionTimeoutMs?: number;
    ensv2?: boolean;
    runtime?: Partial<Omit<EnsAuthorityRuntime, "resolver">>;
  } = {},
): A4Fixture {
  const now = options.now ?? NOW;
  const compute = new FixtureCompute();
  const storage = new FixtureStorage();
  const verifier = { calls: 0 };
  const ens = createEnsAuthorityFixture({
    now,
    mutator: options.mutator,
    beforeResolve: options.beforeResolve,
    disposableTestClock: options.disposableTestClock,
    resolutionTimeoutMs: options.resolutionTimeoutMs,
    ensv2: options.ensv2,
    runtime: options.runtime,
  });
  const adapter = new StrictA3Adapter({
    authority: ens.runtime,
    hooks: options.hooks,
    now,
    sql: database.sql,
    fixture: {
      provider: PROVIDER,
      model: MODEL,
      storageIndexerUrl: "https://indexer.fixture.invalid",
      compute,
      storage,
      verifier: async (request: StorageVerificationRequest): Promise<StorageVerificationResult> => {
        verifier.calls += 1;
        return {
          schemaVersion: 1,
          effectId: request.effectId,
          root: request.root,
          digest: request.expectedDigest,
          size: request.expectedSize,
          verified: true,
        };
      },
    },
  });
  return { adapter, authority: ens.runtime, compute, ens: ens.resolver, storage, verifier };
}

async function setup(database: DisposableDatabase): Promise<string> {
  configureDatabaseEnvironment(database.url);
  await database.sql`
    INSERT INTO users (id, wallet_address) VALUES
      (${BUYER_ID}, ${BUYER_WALLET}), (${CREATOR_ID}, ${CREATOR_WALLET})
  `;
  const input = parseAgentInput({
    name: "A4 ENS Authority Agent",
    description: "Stable ENS authority fixture for strict A3 integration.",
    instructions: "Return the deterministic A4 fixture result.",
    capabilities: ["research"],
  }, CREATOR_WALLET);
  return (await publishAgent(
    { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
    input.manifest,
    { now: NOW, sql: database.sql },
  )).versionId;
}

function submit(database: DisposableDatabase, agentVersionId: string, key: string, now = NOW) {
  return submitJob(BUYER_ID, {
    agentVersionId,
    idempotencyKey: key,
    task: { prompt: `A4 fixture task ${key}` },
  }, { now, sql: database.sql });
}

async function snapshot(database: DisposableDatabase, jobId: string) {
  const rows = await database.sql<{
    authority_allows: number;
    authority_denies: number;
    authority_checks: number;
    bindings: number;
    commissions: number;
    effect_state: string;
    effects: number;
    job_state: string;
    receipts: number;
    refunds: number;
    settlements: number;
  }[]>`
    SELECT j.state AS job_state, e.state AS effect_state,
      (SELECT count(*)::int FROM effects WHERE job_id = j.id) AS effects,
      (SELECT count(*)::int FROM receipts WHERE job_id = j.id) AS receipts,
      (SELECT count(*)::int FROM settlements WHERE job_id = j.id) AS settlements,
      (SELECT count(*)::int FROM commissions WHERE job_id = j.id) AS commissions,
      (SELECT count(*)::int FROM refunds WHERE job_id = j.id) AS refunds,
      (SELECT count(*)::int FROM ens_authority_bindings WHERE job_id = j.id) AS bindings,
      (SELECT count(*)::int FROM ens_authority_checks WHERE job_id = j.id) AS authority_checks,
      (SELECT count(*)::int FROM ens_authority_checks WHERE job_id = j.id AND decision = 'ALLOW') AS authority_allows,
      (SELECT count(*)::int FROM ens_authority_checks WHERE job_id = j.id AND decision = 'DENY') AS authority_denies
    FROM jobs j JOIN effects e ON e.job_id = j.id WHERE j.id = ${jobId}::uuid
  `;
  const row = rows[0];
  if (!row) throw new Error("A4_TEST_SNAPSHOT_MISSING");
  return row;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A4_TEST_OBJECT_MISSING");
  return value as Record<string, unknown>;
}

function change(
  response: Record<string, unknown>,
  target: "observation" | "record" | "creator" | "agent" | "ensv2" | "parentLink" | "resolver" | "ccip",
  key: string,
  value: unknown,
): unknown {
  const copy = structuredClone(response);
  const record = object(copy.record);
  const selected = target === "observation"
    ? object(copy.observation)
    : target === "record"
      ? record
      : target === "creator" || target === "agent"
        ? object(record[target])
        : target === "ensv2"
          ? object(record.ensv2)
          : object(object(record.ensv2)[target]);
  selected[key] = value;
  return copy;
}

function changeRole(
  response: Record<string, unknown>,
  index: number,
  key: string,
  value: unknown,
): unknown {
  const copy = structuredClone(response);
  const roles = object(object(copy.record).ensv2).roles;
  if (!Array.isArray(roles) || !roles[index]) throw new Error("A4_TEST_ROLE_MISSING");
  object(roles[index])[key] = value;
  return copy;
}

function addExternalGrant(response: Record<string, unknown>): unknown {
  const copy = structuredClone(response);
  const hierarchy = object(object(copy.record).ensv2);
  const roles = hierarchy.roles;
  if (!Array.isArray(roles) || !roles[0]) throw new Error("A4_TEST_ROLE_MISSING");
  const grant = structuredClone(roles[0]);
  object(grant).account = "0x9999999999999999999999999999999999999999";
  hierarchy.externalGrants = [grant];
  return copy;
}

function requestFromClaim(claim: ClaimedJob): AdapterExecutionRequest {
  return { ...claim, signal: new AbortController().signal };
}

test("canonical Universal Resolver readiness vector is pinned without a live read", () => {
  assert.equal(CANONICAL_UNIVERSAL_RESOLVER, "0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe");
  assert.deepEqual(UNIVERSAL_RESOLVER_READINESS_VECTOR, {
    name: "ur.integration-tests.eth",
    address: "0x2222222222222222222222222222222222222222",
  });
});

test("stable ENS authority gates the full A3 path twice and twenty duplicates settle once", async () => {
  const database = await startDisposableDatabase("a4-success");
  try {
    const version = await setup(database);
    const submissions = await Promise.all(Array.from({ length: 20 }, () => submit(
      database,
      version,
      "a4-twenty-duplicates",
    )));
    assert.equal(new Set(submissions.map(({ effectId }) => effectId)).size, 1);
    const job = submissions[0];
    if (!job) throw new Error("A4_TEST_JOB_MISSING");
    const run = fixture(database);
    assert.deepEqual(await runWorkerOnce({
      ownerId: "a4-success-worker",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: run.adapter,
      sql: database.sql,
      now: NOW,
    }), { leaseAcquired: true, claimed: 1 });
    assert.deepEqual(run.ens.calls.map(({ operation }) => operation), [
      "COMPUTE_SERVICE",
      "COMPUTE_HEADERS",
      "COMPUTE_REQUEST",
      "COMPUTE_SIGNATURE",
      "STORAGE_WRITE",
      "STORAGE_READBACK",
      "ACCEPT_DELIVERY",
    ]);
    assert.deepEqual(run.compute.calls, { headers: 1, request: 1, resolve: 1, signature: 1, verify: 1 });
    assert.equal(run.storage.calls, 1);
    assert.equal(run.verifier.calls, 1);
    assert.deepEqual(await snapshot(database, job.jobId), {
      authority_allows: 7,
      authority_denies: 0,
      authority_checks: 7,
      bindings: 1,
      commissions: 1,
      effect_state: "SUCCEEDED",
      effects: 1,
      job_state: "SUCCEEDED",
      receipts: 1,
      refunds: 0,
      settlements: 1,
    });

  } finally {
    await database.close();
  }
});

test("ENSv2 hierarchy fixture binds DNS names, permissions, CCIP provenance, and twenty duplicates once", async () => {
  const database = await startDisposableDatabase("a4-v2-ok");
  try {
    const version = await setup(database);
    const submissions = await Promise.all(Array.from({ length: 20 }, () => submit(
      database,
      version,
      "a4-ensv2-twenty-duplicates",
    )));
    assert.equal(new Set(submissions.map(({ effectId }) => effectId)).size, 1);
    const job = submissions[0];
    if (!job) throw new Error("A4_TEST_ENSV2_JOB_MISSING");
    const run = fixture(database, { ensv2: true });
    assert.deepEqual(await runWorkerOnce({
      ownerId: "a4-ensv2-success-worker",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: run.adapter,
      sql: database.sql,
      now: NOW,
    }), { leaseAcquired: true, claimed: 1 });
    const ensv2Errors = await database.sql<{ error_code: string | null }[]>`
      SELECT error_code FROM ens_authority_checks WHERE job_id = ${job.jobId}::uuid AND decision = 'DENY'
    `;
    assert.equal(ensv2Errors.length, 0);
    const binding = run.ens.calls[0]?.binding;
    assert.ok(binding?.ensv2);
    assert.equal(binding.agentLabel, "research");
    assert.equal(binding.agentName, "research.creator.alphadawg.eth");
    assert.match(binding.creatorDnsName, /^0x[0-9a-f]+$/);
    assert.match(binding.agentDnsName, /^0x[0-9a-f]+$/);
    assert.equal(binding.universalResolver, CANONICAL_UNIVERSAL_RESOLVER.toLowerCase());
    assert.equal(binding.priceAtomic, "1000");
    assert.equal(binding.ensv2.agentParentRegistry, binding.ensv2.creatorCanonicalRegistry);
    assert.deepEqual(run.ens.calls.map(({ operation }) => operation), [
      "COMPUTE_SERVICE",
      "COMPUTE_HEADERS",
      "COMPUTE_REQUEST",
      "COMPUTE_SIGNATURE",
      "STORAGE_WRITE",
      "STORAGE_READBACK",
      "ACCEPT_DELIVERY",
    ]);
    assert.deepEqual(await snapshot(database, job.jobId), {
      authority_allows: 7,
      authority_denies: 0,
      authority_checks: 7,
      bindings: 1,
      commissions: 1,
      effect_state: "SUCCEEDED",
      effects: 1,
      job_state: "SUCCEEDED",
      receipts: 1,
      refunds: 0,
      settlements: 1,
    });
    const inheritedJob = await submit(database, version, "a4-ensv2-inherited-resolver", new Date(NOW.getTime() + 1));
    const inherited = fixture(database, { ensv2: true, now: new Date(NOW.getTime() + 1) });
    if (!inherited.authority.ensv2) throw new Error("A4_TEST_ENSV2_POLICY_MISSING");
    inherited.authority.ensv2 = {
      ...inherited.authority.ensv2,
      agentCanonicalRegistry: null,
      resolverMode: "INHERITED",
    };
    assert.deepEqual(await runWorkerOnce({
      ownerId: "a4-ensv2-success-worker",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: inherited.adapter,
      sql: database.sql,
      now: new Date(NOW.getTime() + 1),
    }), { leaseAcquired: true, claimed: 1 });
    const inheritedBinding = inherited.ens.calls[0]?.binding.ensv2;
    assert.equal(inheritedBinding?.agentCanonicalRegistry, null);
    assert.equal(inheritedBinding?.resolverMode, "INHERITED");
    assert.equal(inheritedBinding?.resolverSuffix, "creator.alphadawg.eth");
    assert.equal((await snapshot(database, inheritedJob.jobId)).job_state, "SUCCEEDED");
  } finally {
    await database.close();
  }
});

test("ENSv2 name boundary rejects reverse, unsupported, reserved, confusable, collision, and suffix spoof inputs", async () => {
  const database = await startDisposableDatabase("a4-ensv2-names");
  try {
    const version = await setup(database);
    const cases: Array<{
      name: string;
      runtime: Partial<Omit<EnsAuthorityRuntime, "resolver">>;
    }> = [
      {
        name: "reverse",
        runtime: {
          creatorName: "1.0.0.127.in-addr.reverse",
          agentName: "research.1.0.0.127.in-addr.reverse",
        },
      },
      {
        name: "unsupported-namespace",
        runtime: { creatorName: "creator.example", agentName: "research.creator.example" },
      },
      {
        name: "reserved",
        runtime: { agentLabel: "admin", agentName: "admin.creator.alphadawg.eth" },
      },
      {
        name: "confusable",
        runtime: { agentLabel: "rеsearch", agentName: "rеsearch.creator.alphadawg.eth" },
      },
      {
        name: "collision",
        runtime: { agentLabel: "research", agentName: "research.other.creator.alphadawg.eth" },
      },
      {
        name: "suffix-spoof",
        runtime: { agentLabel: "research", agentName: "research.creator.alphadawg.eth.evil.eth" },
      },
      {
        name: "malformed",
        runtime: { creatorName: "creator..alphadawg.eth", agentName: "research.creator..alphadawg.eth" },
      },
    ];
    for (let index = 0; index < cases.length; index += 1) {
      const item = cases[index];
      const now = new Date(NOW.getTime() + index * 10);
      const submitted = await submit(database, version, `a4-ensv2-name-${item.name}`, now);
      const run = fixture(database, { ensv2: true, now, runtime: item.runtime });
      await runWorkerOnce({
        ownerId: "a4-ensv2-name-worker",
        concurrency: 1,
        leaseSeconds: 30,
        adapter: run.adapter,
        sql: database.sql,
        now,
      });
      assert.deepEqual(run.compute.calls, { headers: 0, request: 0, resolve: 0, signature: 0, verify: 0 }, item.name);
      assert.equal(run.storage.calls, 0, item.name);
      assert.equal(run.verifier.calls, 0, item.name);
      const state = await snapshot(database, submitted.jobId);
      assert.equal(state.job_state, "FAILED", item.name);
      assert.equal(state.receipts, 0, item.name);
      assert.equal(state.settlements, 0, item.name);
      assert.equal(state.commissions, 0, item.name);
      assert.equal(state.refunds, 1, item.name);
    }
  } finally {
    await database.close();
  }
});

test("never-settling normal and recovered PRE_DELIVERY resolution timeout and refund", async () => {
  const database = await startDisposableDatabase("a4-timeout");
  try {
    const version = await setup(database);
    const neverDelivery = async (request: Parameters<FixtureEnsAuthorityResolver["resolve"]>[0]): Promise<void> => {
      if (request.phase === "PRE_DELIVERY") await new Promise<never>(() => undefined);
    };
    const authority = createEnsAuthorityFixture({
      now: () => new Date(),
      beforeResolve: neverDelivery,
      disposableTestClock: false,
      resolutionTimeoutMs: 25,
    });
    const normal = await submit(database, version, "a4-timeout-normal", new Date());
    const adapter: KernelAdapter = {
      key: "protected-a3",
      execute: async () => ({
        ok: true,
        proofHash: "1".repeat(64),
        result: { status: "verified" },
        verified: true,
      }),
    };
    const started = Date.now();
    await runWorkerOnce({
      ownerId: "a4-timeout-normal-worker",
      concurrency: 1,
      leaseSeconds: 5,
      adapter,
      authority: authority.runtime,
      sql: database.sql,
    });
    assert.ok(Date.now() - started < 1_000);
    assert.deepEqual(await snapshot(database, normal.jobId), {
      authority_allows: 0,
      authority_denies: 1,
      authority_checks: 1,
      bindings: 1,
      commissions: 0,
      effect_state: "FAILED",
      effects: 1,
      job_state: "FAILED",
      receipts: 0,
      refunds: 1,
      settlements: 0,
    });

    const recovered = await submit(database, version, "a4-timeout-recovered", new Date());
    const run = fixture(database, {
      now: () => new Date(),
      hooks: { afterReadbackVerified: async () => { throw new A3SimulatedCrashError(); } },
      beforeResolve: neverDelivery,
      disposableTestClock: false,
      resolutionTimeoutMs: 25,
    });
    await runWorkerOnce({
      ownerId: "a4-timeout-normal-worker",
      concurrency: 1,
      leaseSeconds: 5,
      adapter: run.adapter,
      sql: database.sql,
    });
    const recoveredState = await snapshot(database, recovered.jobId);
    assert.equal(recoveredState.job_state, "FAILED");
    assert.equal(recoveredState.receipts, 0);
    assert.equal(recoveredState.refunds, 1);
    const errors = await database.sql<{ error_code: string }[]>`
      SELECT error_code FROM effects WHERE job_id IN (${normal.jobId}::uuid, ${recovered.jobId}::uuid)
      ORDER BY job_id
    `;
    assert.deepEqual(errors.map(({ error_code }) => error_code), [
      "ENS_AUTHORITY_TIMEOUT",
      "ENS_AUTHORITY_TIMEOUT",
    ]);
  } finally {
    await database.close();
  }
});

test("post-resolution time rejects expired records and claims while preserving semantic DENY evidence", async () => {
  const database = await startDisposableDatabase("a4-post-time");
  try {
    const version = await setup(database);
    const recordJob = await submit(database, version, "a4-record-expiry");
    const claimJob = await submit(database, version, "a4-claim-expiry");
    assert.equal((await acquireWorkerLease("a4-post-time-worker", 30, { now: NOW, sql: database.sql })).acquired, true);
    const claims = await claimJobs("a4-post-time-worker", 2, 30, { now: NOW, sql: database.sql });
    const recordClaim = claims.find(({ jobId }) => jobId === recordJob.jobId);
    const expiredClaim = claims.find(({ jobId }) => jobId === claimJob.jobId);
    if (!recordClaim || !expiredClaim) throw new Error("A4_TEST_POST_TIME_CLAIMS_MISSING");

    let recordTime = NOW;
    const staleRecord = createEnsAuthorityFixture({
      now: () => recordTime,
      disposableTestClock: true,
      beforeResolve: async () => { recordTime = new Date(NOW.getTime() + 100); },
      mutator: (response) => change(
        response,
        "record",
        "freshUntil",
        new Date(NOW.getTime() + 50).toISOString(),
      ),
    });
    const denied = await checkFreshEnsAuthority(
      recordClaim,
      staleRecord.runtime,
      "PRE_DELIVERY",
      "ACCEPT_DELIVERY",
      { now: () => recordTime, signal: new AbortController().signal, sql: database.sql },
    );
    assert.deepEqual(denied, {
      allowed: false,
      checkId: denied.checkId,
      errorCode: "ENS_AUTHORITY_STALE",
    });
    const evidence = await database.sql<{
      block_number: string | null;
      block_timestamp: Date | null;
      fresh_until: Date | null;
      record_bytes: string | null;
      record_hash: string | null;
    }[]>`
      SELECT block_number::text, block_timestamp, fresh_until, record_bytes, record_hash
      FROM ens_authority_checks WHERE id = ${denied.checkId}::bigint
    `;
    assert.ok(evidence[0]?.record_bytes?.includes(recordJob.effectId));
    assert.match(evidence[0]?.record_hash ?? "", /^[0-9a-f]{64}$/);
    assert.ok(evidence[0]?.block_number);
    assert.ok(evidence[0]?.block_timestamp);
    assert.ok(evidence[0]?.fresh_until);

    let claimTime = NOW;
    const staleClaim = createEnsAuthorityFixture({
      now: () => claimTime,
      disposableTestClock: true,
      beforeResolve: async () => { claimTime = new Date(NOW.getTime() + 31_000); },
    });
    await assert.rejects(checkFreshEnsAuthority(
      expiredClaim,
      staleClaim.runtime,
      "PRE_DELIVERY",
      "ACCEPT_DELIVERY",
      { now: () => claimTime, signal: new AbortController().signal, sql: database.sql },
    ), /ENS_AUTHORITY_CLAIM_LOST/);
    const allows = await database.sql<{ count: number }[]>`
      SELECT count(*)::int FROM ens_authority_checks
      WHERE job_id IN (${recordJob.jobId}::uuid, ${claimJob.jobId}::uuid) AND decision = 'ALLOW'
    `;
    assert.equal(allows[0]?.count, 0);
  } finally {
    await database.close();
  }
});

test("malformed, stale, forged, mismatched, replayed, outage, and timeout authority refuse before A3", async () => {
  const database = await startDisposableDatabase("a4-refusal");
  try {
    const version = await setup(database);
    const wrongAddress = "0x9999999999999999999999999999999999999999";
    const cases: Array<{ name: string; mutate: EnsFixtureMutator }> = [
      { name: "wrong-writer", mutate: (r) => change(r, "creator", "delegate", wrongAddress) },
      { name: "wrong-parent", mutate: (r) => change(r, "creator", "name", "wrong.eth") },
      { name: "wrong-agent", mutate: (r) => change(r, "agent", "name", "wrong.creator.alphadawg.eth") },
      { name: "wrong-chain", mutate: (r) => change(r, "observation", "chainId", 1) },
      { name: "wrong-version", mutate: (r) => change(r, "record", "agentVersion", 99) },
      { name: "wrong-registry", mutate: (r) => change(r, "agent", "registry", wrongAddress) },
      { name: "wrong-resolver", mutate: (r) => change(r, "agent", "resolver", wrongAddress) },
      { name: "wrong-owner", mutate: (r) => change(r, "agent", "owner", wrongAddress) },
      { name: "wrong-delegate", mutate: (r) => change(r, "agent", "delegate", wrongAddress) },
      { name: "wrong-manifest", mutate: (r) => change(r, "record", "manifestHash", "0".repeat(64)) },
      { name: "wrong-service", mutate: (r) => change(r, "record", "service", "wrong") },
      { name: "stale", mutate: (r) => change(r, "record", "freshUntil", new Date(NOW.getTime() - 1).toISOString()) },
      { name: "missing", mutate: (r) => { const copy = structuredClone(r); delete object(copy.record).manifestHash; return copy; } },
      { name: "malformed", mutate: () => [] },
      { name: "oversized", mutate: (r) => change(r, "record", "service", "x".repeat(131_073)) },
      { name: "unserializable", mutate: (r) => change(r, "record", "service", 1n) },
      { name: "replay", mutate: (r) => change(r, "record", "effectId", "0".repeat(64)) },
      { name: "outage", mutate: () => { throw new EnsAuthorityResolverError("ENS_AUTHORITY_RESOLVER_OUTAGE"); } },
      { name: "timeout", mutate: () => { throw new EnsAuthorityResolverError("ENS_AUTHORITY_TIMEOUT"); } },
    ];
    for (let index = 0; index < cases.length; index += 1) {
      const item = cases[index];
      const now = new Date(NOW.getTime() + index * 10);
      const submitted = await submit(database, version, `a4-refuse-${item.name}`, now);
      const run = fixture(database, { mutator: item.mutate, now });
      await runWorkerOnce({
        ownerId: "a4-refusal-worker",
        concurrency: 1,
        leaseSeconds: 30,
        adapter: run.adapter,
        sql: database.sql,
        now,
      });
      assert.deepEqual(run.compute.calls, { headers: 0, request: 0, resolve: 0, signature: 0, verify: 0 }, item.name);
      assert.equal(run.storage.calls, 0, item.name);
      assert.equal(run.verifier.calls, 0, item.name);
      const state = await snapshot(database, submitted.jobId);
      assert.equal(state.job_state, "FAILED", item.name);
      assert.equal(state.effect_state, "FAILED", item.name);
      assert.equal(state.receipts, 0, item.name);
      assert.equal(state.settlements, 0, item.name);
      assert.equal(state.commissions, 0, item.name);
      assert.equal(state.refunds, 1, item.name);
      assert.equal(state.authority_denies, 1, item.name);
    }
    const leakedMalformed = await database.sql<{ count: number }[]>`
      SELECT count(*)::int FROM ens_authority_checks
      WHERE error_code = 'ENS_AUTHORITY_MALFORMED'
        AND (record_bytes IS NOT NULL OR record_hash IS NOT NULL)
    `;
    assert.equal(leakedMalformed[0]?.count, 0);
  } finally {
    await database.close();
  }
});

test("ENSv2 hierarchy, roles, expiry, resolver policy, and CCIP failures refuse before A3", async () => {
  const database = await startDisposableDatabase("a4-v2-refuse");
  try {
    const version = await setup(database);
    const wrongAddress = "0x9999999999999999999999999999999999999999";
    const wrongNode = `0x${"9".repeat(64)}`;
    const expired = new Date(NOW.getTime() - 1).toISOString();
    const cases: Array<{ name: string; mutate: EnsFixtureMutator }> = [
      { name: "wrong-root", mutate: (r) => change(r, "record", "rootRegistry", wrongAddress) },
      { name: "wrong-universal-resolver", mutate: (r) => change(r, "record", "universalResolver", wrongAddress) },
      { name: "wrong-price", mutate: (r) => change(r, "record", "priceAtomic", "999") },
      { name: "wrong-creator-dns", mutate: (r) => change(r, "record", "creatorDnsName", "0x00") },
      { name: "wrong-agent-label", mutate: (r) => change(r, "record", "agentLabel", "wrong") },
      {
        name: "missing-creator-registry",
        mutate: (r) => change(r, "ensv2", "creatorCanonicalRegistry", "0x0000000000000000000000000000000000000000"),
      },
      { name: "wrong-creator-registry", mutate: (r) => change(r, "ensv2", "creatorCanonicalRegistry", wrongAddress) },
      { name: "broken-parent-registry", mutate: (r) => change(r, "ensv2", "agentParentRegistry", wrongAddress) },
      { name: "wrong-find-owner", mutate: (r) => change(r, "ensv2", "owner", wrongAddress) },
      { name: "subregistry-removed", mutate: (r) => change(r, "ensv2", "agentCanonicalRegistry", null) },
      { name: "subregistry-replaced", mutate: (r) => change(r, "ensv2", "agentCanonicalRegistry", wrongAddress) },
      { name: "wrong-role-admin", mutate: (r) => changeRole(r, 0, "adminRole", wrongNode) },
      { name: "wrong-role-account", mutate: (r) => changeRole(r, 0, "account", wrongAddress) },
      { name: "external-grant", mutate: addExternalGrant },
      { name: "parent-expired", mutate: (r) => change(r, "ensv2", "parentExpiry", expired) },
      { name: "agent-expired", mutate: (r) => change(r, "ensv2", "agentExpiry", expired) },
      { name: "role-expired", mutate: (r) => changeRole(r, 0, "expiresAt", expired) },
      { name: "broken-forward-link", mutate: (r) => change(r, "parentLink", "forward", false) },
      { name: "broken-back-link", mutate: (r) => change(r, "parentLink", "back", false) },
      { name: "registry-alias", mutate: (r) => change(r, "ensv2", "alias", true) },
      { name: "wrong-winning-resolver", mutate: (r) => change(r, "resolver", "address", wrongAddress) },
      { name: "wrong-winning-suffix", mutate: (r) => change(r, "resolver", "suffix", "creator.alphadawg.eth") },
      { name: "wrong-inherited-policy", mutate: (r) => change(r, "resolver", "mode", "INHERITED") },
      { name: "ccip-wrong-universal", mutate: (r) => change(r, "ccip", "universalResolver", wrongAddress) },
      { name: "ccip-wrong-gateway", mutate: (r) => change(r, "ccip", "gateway", "https://wrong.fixture.invalid") },
      { name: "ccip-outage", mutate: (r) => change(r, "ccip", "status", "FAILED") },
      {
        name: "ccip-malformed",
        mutate: (r) => {
          const copy = structuredClone(r);
          delete object(object(object(copy.record).ensv2).ccip).responseHash;
          return copy;
        },
      },
      {
        name: "hierarchy-missing",
        mutate: (r) => {
          const copy = structuredClone(r);
          delete object(copy.record).ensv2;
          return copy;
        },
      },
    ];
    for (let index = 0; index < cases.length; index += 1) {
      const item = cases[index];
      const now = new Date(NOW.getTime() + index * 10);
      const submitted = await submit(database, version, `a4-ensv2-refuse-${item.name}`, now);
      const run = fixture(database, { ensv2: true, mutator: item.mutate, now });
      await runWorkerOnce({
        ownerId: "a4-ensv2-refusal-worker",
        concurrency: 1,
        leaseSeconds: 30,
        adapter: run.adapter,
        sql: database.sql,
        now,
      });
      assert.deepEqual(run.compute.calls, { headers: 0, request: 0, resolve: 0, signature: 0, verify: 0 }, item.name);
      assert.equal(run.storage.calls, 0, item.name);
      assert.equal(run.verifier.calls, 0, item.name);
      const state = await snapshot(database, submitted.jobId);
      assert.equal(state.job_state, "FAILED", item.name);
      assert.equal(state.effect_state, "FAILED", item.name);
      assert.equal(state.receipts, 0, item.name);
      assert.equal(state.settlements, 0, item.name);
      assert.equal(state.commissions, 0, item.name);
      assert.equal(state.refunds, 1, item.name);
      assert.equal(state.authority_denies, 1, item.name);
    }
  } finally {
    await database.close();
  }
});

test("transfer during execution and resumed A3 stages recheck only remaining operations", async () => {
  const database = await startDisposableDatabase("a4-resume");
  try {
    const version = await setup(database);
    const transferJob = await submit(database, version, "a4-transfer-delivery");
    const transfer = fixture(database, {
      mutator: (response, request) => request.phase === "PRE_DELIVERY"
        ? change(response, "agent", "owner", "0x9999999999999999999999999999999999999999")
        : response,
    });
    await runWorkerOnce({
      ownerId: "a4-resume-worker",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: transfer.adapter,
      sql: database.sql,
      now: NOW,
    });
    assert.deepEqual([transfer.compute.calls.request, transfer.storage.calls, transfer.verifier.calls], [1, 1, 1]);
    const transferred = await snapshot(database, transferJob.jobId);
    assert.equal(transferred.receipts, 0);
    assert.equal(transferred.settlements, 0);
    assert.equal(transferred.commissions, 0);
    assert.equal(transferred.refunds, 1);
    assert.equal(transferred.authority_denies, 1);

    const phases: Array<{ hook: keyof StrictA3Hooks; skipped: "compute" | "compute-and-storage" }> = [
      { hook: "afterResponseVerified", skipped: "compute" },
      { hook: "afterStorageCommitted", skipped: "compute-and-storage" },
    ];
    for (let index = 0; index < phases.length; index += 1) {
      const phase = phases[index];
      const now = new Date(NOW.getTime() + 1_000 + index * 100);
      const submitted = await submit(database, version, `a4-resume-${phase.hook}`, now);
      let crashed = false;
      const run = fixture(database, {
        now,
        hooks: {
          [phase.hook]: async () => {
            if (crashed) return;
            crashed = true;
            throw new A3SimulatedCrashError();
          },
        },
      });
      await runWorkerOnce({ ownerId: "a4-resume-worker", concurrency: 1, leaseSeconds: 30, adapter: run.adapter, sql: database.sql, now });
      const counts = { compute: run.compute.calls.request, storage: run.storage.calls };
      await runWorkerOnce({
        ownerId: "a4-resume-worker",
        concurrency: 1,
        leaseSeconds: 30,
        adapter: run.adapter,
        sql: database.sql,
        now: new Date(now.getTime() + 1),
      });
      assert.equal(run.compute.calls.request, counts.compute, phase.hook);
      if (phase.skipped === "compute-and-storage") assert.equal(run.storage.calls, counts.storage, phase.hook);
      assert.equal((await snapshot(database, submitted.jobId)).job_state, "SUCCEEDED", phase.hook);
    }
  } finally {
    await database.close();
  }
});

test("ENSv2 transfer, expiry, subregistry, role, and resolver-policy drift during execution deny delivery", async () => {
  const database = await startDisposableDatabase("a4-v2-drift");
  try {
    const version = await setup(database);
    const wrongAddress = "0x9999999999999999999999999999999999999999";
    const wrongNode = `0x${"9".repeat(64)}`;
    const expired = new Date(NOW.getTime() - 1).toISOString();
    const cases: Array<{ name: string; mutate: EnsFixtureMutator }> = [
      { name: "transfer", mutate: (r) => change(r, "agent", "owner", wrongAddress) },
      { name: "expiry", mutate: (r) => change(r, "ensv2", "agentExpiry", expired) },
      { name: "subregistry", mutate: (r) => change(r, "ensv2", "agentCanonicalRegistry", null) },
      { name: "role", mutate: (r) => changeRole(r, 0, "adminRole", wrongNode) },
      { name: "resolver-policy", mutate: (r) => change(r, "resolver", "mode", "INHERITED") },
    ];
    for (let index = 0; index < cases.length; index += 1) {
      const item = cases[index];
      const now = new Date(NOW.getTime() + index * 10);
      const submitted = await submit(database, version, `a4-ensv2-delivery-${item.name}`, now);
      const run = fixture(database, {
        ensv2: true,
        now,
        mutator: (response, request, call) => request.phase === "PRE_DELIVERY"
          ? item.mutate(response, request, call)
          : response,
      });
      await runWorkerOnce({
        ownerId: "a4-ensv2-delivery-worker",
        concurrency: 1,
        leaseSeconds: 30,
        adapter: run.adapter,
        sql: database.sql,
        now,
      });
      assert.deepEqual([run.compute.calls.request, run.storage.calls, run.verifier.calls], [1, 1, 1], item.name);
      const state = await snapshot(database, submitted.jobId);
      assert.equal(state.job_state, "FAILED", item.name);
      assert.equal(state.receipts, 0, item.name);
      assert.equal(state.settlements, 0, item.name);
      assert.equal(state.commissions, 0, item.name);
      assert.equal(state.refunds, 1, item.name);
      assert.equal(state.authority_denies, 1, item.name);
    }
  } finally {
    await database.close();
  }
});

async function expireClaim(database: DisposableDatabase, jobId: string, at: Date): Promise<void> {
  const expired = new Date(at.getTime() - 1);
  const heartbeat = new Date(at.getTime() - 2);
  await database.sql`
    UPDATE worker_leases SET heartbeat_at = ${heartbeat}, expires_at = ${expired}
    WHERE key = ${KERNEL_WORKER_LEASE_KEY}
  `;
  await database.sql`UPDATE jobs SET lease_expires_at = ${expired} WHERE id = ${jobId}::uuid`;
}

test("READBACK restart and lease takeover re-resolve delivery authority without adapter replay", async () => {
  const database = await startDisposableDatabase("a4-readback");
  try {
    const version = await setup(database);
    for (const [index, transferred] of [false, true].entries()) {
      const caseTime = new Date(NOW.getTime() + index * 70_000);
      const submitted = await submit(database, version, `a4-readback-${transferred}`, caseTime);
      const ownerA = `a4-readback-a-${transferred}`;
      assert.equal((await acquireWorkerLease(ownerA, 30, { now: caseTime, sql: database.sql })).acquired, true);
      const claim = (await claimJobs(ownerA, 1, 30, { now: caseTime, sql: database.sql }))[0];
      if (!claim) throw new Error("A4_TEST_CLAIM_MISSING");
      const first = fixture(database, {
        ensv2: true,
        now: caseTime,
        hooks: { afterReadbackVerified: async () => { throw new A3SimulatedCrashError(); } },
      });
      await assert.rejects(first.adapter.execute(requestFromClaim(claim)), /A3_SIMULATED_CRASH/);
      const recoveryTime = new Date(caseTime.getTime() + 31_000);
      await expireClaim(database, submitted.jobId, recoveryTime);
      const recoveryAuthority = createEnsAuthorityFixture({
        ensv2: true,
        now: recoveryTime,
        runtime: { ensv2: first.authority.ensv2 },
        mutator: transferred
          ? (response) => change(response, "creator", "owner", "0x9999999999999999999999999999999999999999")
          : undefined,
      });
      let adapterCalls = 0;
      const recoveryAdapter: KernelAdapter = {
        key: "protected-a3",
        requiresVerifiedJournal: true,
        execute: async () => {
          adapterCalls += 1;
          throw new Error("A4_RECOVERY_ADAPTER_MUST_NOT_RUN");
        },
      };
      assert.deepEqual(await runWorkerOnce({
        ownerId: `a4-readback-b-${transferred}`,
        concurrency: 1,
        leaseSeconds: 30,
        adapter: recoveryAdapter,
        authority: recoveryAuthority.runtime,
        sql: database.sql,
        now: recoveryTime,
      }), { leaseAcquired: true, claimed: 1 });
      assert.equal(adapterCalls, 0);
      const state = await snapshot(database, submitted.jobId);
      const errors = await database.sql<{ error_code: string | null }[]>`
        SELECT error_code FROM effects WHERE job_id = ${submitted.jobId}::uuid
      `;
      assert.equal(state.job_state, transferred ? "FAILED" : "SUCCEEDED", errors[0]?.error_code ?? undefined);
      assert.equal(state.receipts, transferred ? 0 : 1);
      assert.equal(state.refunds, transferred ? 1 : 0);
    }
  } finally {
    await database.close();
  }
});

test("lease takeover during PRE_EXECUTION and PRE_DELIVERY cannot persist stale ALLOW", async () => {
  const database = await startDisposableDatabase("a4-takeover");
  try {
    const version = await setup(database);

    const preJob = await submit(database, version, "a4-takeover-pre");
    assert.equal((await acquireWorkerLease("a4-takeover-pre-a", 30, { now: NOW, sql: database.sql })).acquired, true);
    const preClaim = (await claimJobs("a4-takeover-pre-a", 1, 30, { now: NOW, sql: database.sql }))[0];
    if (!preClaim) throw new Error("A4_TEST_PRE_CLAIM_MISSING");
    const pre = fixture(database, { ensv2: true });
    pre.ens.setBeforeResolve(async (request) => {
      if (request.operation !== "COMPUTE_SERVICE") return;
      await expireClaim(database, preJob.jobId, NOW);
      assert.equal((await acquireWorkerLease("a4-takeover-pre-b", 30, { now: NOW, sql: database.sql })).acquired, true);
      assert.deepEqual(await reconcileExpiredJobs({ now: NOW, sql: database.sql }), { reconciled: 0, requeued: 1 });
    });
    await assert.rejects(pre.adapter.execute(requestFromClaim(preClaim)), /A3_CLAIM_LOST|ENS_AUTHORITY_CLAIM_LOST/);
    assert.equal(pre.compute.calls.resolve, 0);
    const preAllows = await database.sql<{ count: number }[]>`
      SELECT count(*)::int FROM ens_authority_checks
      WHERE job_id = ${preJob.jobId}::uuid AND decision = 'ALLOW'
    `;
    assert.equal(preAllows[0]?.count, 0);
    pre.ens.setBeforeResolve(null);
    await runWorkerOnce({
      ownerId: "a4-takeover-pre-b",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: pre.adapter,
      sql: database.sql,
      now: NOW,
    });
    assert.equal((await snapshot(database, preJob.jobId)).job_state, "SUCCEEDED");

    const deliveryTime = new Date(NOW.getTime() + 70_000);
    const deliveryJob = await submit(database, version, "a4-takeover-delivery", deliveryTime);
    const delivery = fixture(database, { ensv2: true, now: deliveryTime });
    delivery.ens.setBeforeResolve(async (request) => {
      if (request.phase !== "PRE_DELIVERY") return;
      await expireClaim(database, deliveryJob.jobId, deliveryTime);
      assert.equal((await acquireWorkerLease("a4-takeover-delivery-b", 30, {
        now: deliveryTime,
        sql: database.sql,
      })).acquired, true);
      assert.deepEqual(
        await reconcileExpiredJobs({ now: deliveryTime, sql: database.sql }),
        { reconciled: 0, requeued: 1 },
      );
    });
    await assert.rejects(runWorkerOnce({
      ownerId: "a4-takeover-delivery-a",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: delivery.adapter,
      sql: database.sql,
      now: deliveryTime,
    }), /ENS_AUTHORITY_CLAIM_LOST/);
    const staleDeliveryAllows = await database.sql<{ count: number }[]>`
      SELECT count(*)::int FROM ens_authority_checks
      WHERE job_id = ${deliveryJob.jobId}::uuid AND phase = 'PRE_DELIVERY' AND decision = 'ALLOW'
    `;
    assert.equal(staleDeliveryAllows[0]?.count, 0);
    delivery.ens.setBeforeResolve(null);
    let recoveryAdapterCalls = 0;
    const recoveryAdapter: KernelAdapter = {
      key: "protected-a3",
      requiresVerifiedJournal: true,
      execute: async () => {
        recoveryAdapterCalls += 1;
        throw new Error("A4_TAKEOVER_RECOVERY_ADAPTER_MUST_NOT_RUN");
      },
    };
    assert.deepEqual(await runWorkerOnce({
      ownerId: "a4-takeover-delivery-b",
      concurrency: 1,
      leaseSeconds: 30,
      adapter: recoveryAdapter,
      authority: delivery.authority,
      sql: database.sql,
      now: deliveryTime,
    }), { leaseAcquired: true, claimed: 1 });
    assert.equal(recoveryAdapterCalls, 0);
    assert.equal((await snapshot(database, deliveryJob.jobId)).job_state, "SUCCEEDED");
  } finally {
    await database.close();
  }
});

test("receipt bypass and authority mutation are rejected by database triggers", async () => {
  const database = await startDisposableDatabase("a4-db");
  try {
    const version = await setup(database);
    const submitted = await submit(database, version, "a4-db-authority");
    const run = fixture(database);
    await runWorkerOnce({ ownerId: "a4-db-worker", concurrency: 1, leaseSeconds: 30, adapter: run.adapter, sql: database.sql, now: NOW });
    const rows = await database.sql<{ check_id: string; effect_id: string }[]>`
      SELECT c.id::text AS check_id, c.effect_id FROM ens_authority_checks c
      WHERE c.job_id = ${submitted.jobId}::uuid AND c.phase = 'PRE_DELIVERY'
    `;
    const authority = rows[0];
    if (!authority) throw new Error("A4_TEST_AUTHORITY_MISSING");
    await assert.rejects(database.sql`
      UPDATE ens_authority_bindings SET service = 'tampered' WHERE effect_id = ${submitted.effectId}
    `, /ENS authority bindings are immutable/);
    await assert.rejects(database.sql`
      DELETE FROM ens_authority_checks WHERE id = ${authority.check_id}::bigint
    `, /ENS authority checks are append-only/);

    const second = await submit(database, version, "a4-db-bypass", new Date(NOW.getTime() + 1));
    await assert.rejects(database.sql`
      INSERT INTO ens_authority_bindings (
        effect_id, job_id, agent_version_id, binding_bytes, binding_hash,
        creator_name, creator_node, agent_name, agent_node, chain_id,
        registry, creator_resolver, agent_resolver, creator_owner, creator_delegate,
        agent_owner, agent_delegate, manifest_hash, capabilities, service, payout,
        max_age_seconds, policy_version, created_at
      ) SELECT
        ${second.effectId}, ${second.jobId}::uuid, ${version}::uuid, binding_bytes, binding_hash,
        creator_name, creator_node, agent_name, agent_node, chain_id,
        registry, creator_resolver, agent_resolver, creator_owner, creator_delegate,
        agent_owner, agent_delegate, manifest_hash, capabilities, service, payout,
        0, policy_version, ${new Date(NOW.getTime() + 1)}
      FROM ens_authority_bindings WHERE effect_id = ${submitted.effectId}
    `, /ens_bindings_bounds_check/);
    const bypassTime = new Date(NOW.getTime() + 1);
    assert.equal((await acquireWorkerLease("a4-db-worker", 30, {
      now: bypassTime,
      sql: database.sql,
    })).acquired, true);
    const bypassClaim = (await claimJobs("a4-db-worker", 1, 30, {
      now: bypassTime,
      sql: database.sql,
    }))[0];
    if (!bypassClaim || bypassClaim.jobId !== second.jobId) throw new Error("A4_TEST_BYPASS_CLAIM_MISSING");
    const bypassEns = createEnsAuthorityFixture({ now: bypassTime });
    const bypassCheck = await checkFreshEnsAuthority(
      bypassClaim,
      bypassEns.runtime,
      "PRE_EXECUTION",
      "COMPUTE_SERVICE",
      { now: bypassTime, signal: new AbortController().signal, sql: database.sql },
    );
    if (!bypassCheck.checkId) throw new Error("A4_TEST_BYPASS_CHECK_MISSING");
    await assert.rejects(database.sql`
      INSERT INTO ens_authority_checks (
        effect_id, job_id, agent_version_id, binding_hash, phase, operation,
        decision, error_code, record_bytes, record_hash, chain_id, block_number,
        block_timestamp, observed_at, fresh_until, transaction_hash,
        lease_owner, worker_epoch, claim_version, claim_expires_at,
        disposable_test_clock, created_at
      ) SELECT
        effect_id, job_id, agent_version_id, binding_hash, 'PRE_DELIVERY', 'COMPUTE_REQUEST',
        decision, error_code, record_bytes, record_hash, chain_id, block_number,
        block_timestamp, observed_at, fresh_until, transaction_hash,
        lease_owner, worker_epoch, claim_version, claim_expires_at,
        disposable_test_clock, created_at
      FROM ens_authority_checks WHERE id = ${bypassCheck.checkId}::bigint
    `, /ens_checks_phase_check/);
    await assert.rejects(database.sql`
      INSERT INTO receipts (
        job_id, effect_id, authority_check_id, verified, adapter_key, proof_hash, result_hash, created_at
      ) VALUES (
        ${second.jobId}::uuid, ${second.effectId}, ${authority.check_id}::bigint, true,
        'protected-a3', ${"1".repeat(64)}, ${"2".repeat(64)}, ${new Date(NOW.getTime() + 1)}
      )
    `, /receipt requires a fresh exact PRE_DELIVERY ENS authority ALLOW/);
    assert.equal(canonicalJson(await snapshot(database, submitted.jobId)).includes("SUCCEEDED"), true);
  } finally {
    await database.close();
  }
});

test("database time rejects receipt backdating and normal roles cannot enable the disposable clock", async () => {
  const database = await startDisposableDatabase("a4-db-clock");
  try {
    const version = await setup(database);
    const submitted = await submit(database, version, "a4-db-clock", new Date());
    assert.equal((await acquireWorkerLease("a4-db-clock-worker", 30, { sql: database.sql })).acquired, true);
    const claim = (await claimJobs("a4-db-clock-worker", 1, 30, { sql: database.sql }))[0];
    if (!claim) throw new Error("A4_TEST_DB_CLOCK_CLAIM_MISSING");
    const ens = createEnsAuthorityFixture({
      now: () => new Date(),
      disposableTestClock: false,
    });
    const authority = await checkFreshEnsAuthority(
      claim,
      ens.runtime,
      "PRE_DELIVERY",
      "ACCEPT_DELIVERY",
      { signal: new AbortController().signal, sql: database.sql },
    );
    if (!authority.checkId) throw new Error("A4_TEST_DB_CLOCK_CHECK_MISSING");
    await assert.rejects(database.sql`
      INSERT INTO receipts (
        job_id, effect_id, authority_check_id, verified, adapter_key,
        proof_hash, result_hash, created_at
      ) VALUES (
        ${submitted.jobId}::uuid, ${submitted.effectId}, ${authority.checkId}::bigint,
        true, 'protected-a3', ${"1".repeat(64)}, ${"2".repeat(64)},
        ${new Date(Date.now() - 60_000)}
      )
    `, /receipt requires a fresh exact PRE_DELIVERY ENS authority ALLOW/);

    const role = `a4_app_${process.pid}`;
    if (!/^[a-z][a-z0-9_]+$/.test(role)) throw new Error("A4_TEST_ROLE_INVALID");
    await database.sql.unsafe(`CREATE ROLE "${role}" NOLOGIN`);
    await database.sql.unsafe(`GRANT INSERT ON ens_authority_checks TO "${role}"`);
    await database.sql.unsafe(`GRANT USAGE ON SEQUENCE ens_authority_checks_id_seq TO "${role}"`);
    await assert.rejects(database.sql.begin(async (transaction) => {
      await transaction.unsafe(`SET LOCAL ROLE "${role}"`);
      await transaction.unsafe(`
        INSERT INTO ens_authority_checks (
          effect_id, job_id, agent_version_id, binding_hash, phase, operation,
          decision, error_code, observed_at, lease_owner, worker_epoch,
          claim_version, claim_expires_at, disposable_test_clock, created_at
        ) VALUES (
          '${"0".repeat(64)}', '00000000-0000-0000-0000-000000000000'::uuid,
          '00000000-0000-0000-0000-000000000000'::uuid, '${"0".repeat(64)}',
          'PRE_DELIVERY', 'ACCEPT_DELIVERY', 'DENY', 'ENS_AUTHORITY_TIMEOUT',
          CURRENT_TIMESTAMP, 'untrusted', 1, 1, CURRENT_TIMESTAMP + interval '1 minute',
          true, CURRENT_TIMESTAMP
        )
      `);
    }), /disposable ENS authority test clock requires database superuser/);
  } finally {
    await database.close();
  }
});
