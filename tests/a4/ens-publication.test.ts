import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import {
  CANONICAL_UNIVERSAL_RESOLVER,
  createEnsPublicationAuthority,
  createEnsPublicationPolicyDocument,
  type EnsPublicationAuthority,
} from "../../src/ens/authority";
import {
  bindAgentName,
  createAgentDraft,
  prepareAgentEnsWrite,
} from "../../src/kernel/lifecycle";
import { parseAgentInput, parseEnsBinding } from "../../src/kernel/policy";
import {
  configureDatabaseEnvironment,
  startDisposableDatabase,
  type DisposableDatabase,
} from "../helpers/postgres";
import {
  createEnsPublicationAuthorityFixture,
  type EnsPublicationFixtureMutator,
  type FixtureEnsPublicationResolver,
} from "../helpers/ens";

const NOW = new Date("2026-07-25T03:00:00.000Z");
const CREATOR_ID = "a4-publication-creator";
const CREATOR_WALLET = "0x6666666666666666666666666666666666666666";
const RELEASE_SHA = "70307d045d1b1af327ef7a2f4c55fec4b2ff5bc9";
const WRONG_ADDRESS = "0x9999999999999999999999999999999999999999";
const WRONG_NODE = `0x${"9".repeat(64)}`;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("A4_PUBLICATION_TEST_OBJECT_MISSING");
  }
  return value as Record<string, unknown>;
}

function change(
  response: Record<string, unknown>,
  target: "observation" | "record" | "creator" | "agent" | "ensv2" | "parentLink" | "resolver" | "ccip",
  key: string,
  value: unknown,
): unknown {
  const copy = structuredClone(response);
  const authorityRecord = object(copy.record);
  const selected = target === "observation"
    ? object(copy.observation)
    : target === "record"
      ? authorityRecord
      : target === "creator" || target === "agent"
        ? object(authorityRecord[target])
        : target === "ensv2"
          ? object(authorityRecord.ensv2)
          : object(object(authorityRecord.ensv2)[target]);
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
  if (!Array.isArray(roles) || !roles[index]) throw new Error("A4_PUBLICATION_TEST_ROLE_MISSING");
  object(roles[index])[key] = value;
  return copy;
}

function addExternalGrant(response: Record<string, unknown>): unknown {
  const copy = structuredClone(response);
  const hierarchy = object(object(copy.record).ensv2);
  const roles = hierarchy.roles;
  if (!Array.isArray(roles) || !roles[0]) throw new Error("A4_PUBLICATION_TEST_ROLE_MISSING");
  const grant = structuredClone(roles[0]);
  object(grant).account = WRONG_ADDRESS;
  hierarchy.externalGrants = [grant];
  return copy;
}

async function admitPublicationRelease(database: DisposableDatabase): Promise<void> {
  const now = new Date();
  await database.sql`
    INSERT INTO ens_publication_authority_releases (release_sha, not_before, expires_at)
    VALUES (
      ${RELEASE_SHA},
      ${new Date(now.getTime() - 60 * 1_000)},
      ${new Date(now.getTime() + 8 * 60 * 60 * 1_000)}
    )
    ON CONFLICT (release_sha) DO NOTHING
  `;
}

interface PublicationRuntimeConnection {
  role: string;
  sql: ReturnType<typeof postgres>;
  close: () => Promise<void>;
}

async function startPublicationRuntime(
  database: DisposableDatabase,
  suffix = "runtime",
): Promise<PublicationRuntimeConnection> {
  const role = `a4_pub_${suffix}_${process.pid}_${Date.now().toString(36)}`;
  assert.match(role, /^[a-z][a-z0-9_]{1,62}$/);
  await database.sql.unsafe(
    `CREATE ROLE "${role}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT; ` +
    `GRANT alphadawg_runtime TO "${role}"`,
  );
  const runtimeUrl = new URL(database.url);
  runtimeUrl.username = role;
  runtimeUrl.password = "";
  const sql = postgres(runtimeUrl.toString(), { max: 1, prepare: false });
  return {
    role,
    sql,
    close: async (): Promise<void> => {
      await sql.end({ timeout: 1 });
      await database.sql.unsafe(`DROP ROLE "${role}"`);
    },
  };
}

async function admitFixturePolicy(
  database: DisposableDatabase,
  versionId: string,
  authority: EnsPublicationAuthority,
  resolver: FixtureEnsPublicationResolver,
): Promise<void> {
  const missing = await authority({ agentVersionId: versionId });
  assert.deepEqual(missing, {
    allowed: false,
    decisionId: null,
    errorCode: "ENS_PUBLICATION_PERSIST_FAILED",
  });
  const binding = resolver.calls.at(-1)?.binding;
  assert.ok(binding);
  const policy = createEnsPublicationPolicyDocument(binding);
  await database.sql`
    INSERT INTO ens_publication_authority_policies (
      release_sha, agent_version_id, binding, binding_hash
    ) VALUES (
      ${RELEASE_SHA}, ${versionId}::uuid,
      ${database.sql.json(JSON.parse(JSON.stringify(policy)))}, ${"0".repeat(64)}
    )
  `;
  resolver.calls.length = 0;
}

async function preparedVersion(
  database: DisposableDatabase,
  label = "research",
  options: { admitRelease?: boolean } = {},
): Promise<string> {
  configureDatabaseEnvironment(database.url);
  if (options.admitRelease !== false) await admitPublicationRelease(database);
  await database.sql`
    INSERT INTO users (id, wallet_address) VALUES (${CREATOR_ID}, ${CREATOR_WALLET})
  `;
  const manifest = parseAgentInput({
    name: "A4 Publication Agent",
    description: "A private immutable version for durable A4 publication decisions.",
    instructions: "## Task\n\nReturn a bounded, evidence-backed local fixture result.",
    capabilities: ["research", "market-analysis"],
  }, CREATOR_WALLET).manifest;
  const draft = await createAgentDraft(
    { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
    manifest,
    { now: NOW, sql: database.sql },
  );
  const binding = parseEnsBinding({ creatorParent: "creator.eth", agentLabel: label });
  await bindAgentName(CREATOR_ID, draft.versionId, binding, { now: NOW, sql: database.sql });
  await prepareAgentEnsWrite(CREATOR_ID, draft.versionId, { now: NOW, sql: database.sql });
  return draft.versionId;
}

function fixtureAuthority(
  database: DisposableDatabase,
  options: {
    sql?: DisposableDatabase["sql"];
    now?: Date | (() => Date);
    mutator?: EnsPublicationFixtureMutator;
    beforeResolve?: Parameters<typeof createEnsPublicationAuthorityFixture>[0]["beforeResolve"];
    resolutionTimeoutMs?: number;
    disposableTestClock?: boolean;
  } = {},
): { authority: EnsPublicationAuthority; resolver: FixtureEnsPublicationResolver } {
  const suppliedNow = options.now ?? new Date();
  const fixture = createEnsPublicationAuthorityFixture({
    now: suppliedNow,
    mutator: options.mutator,
    beforeResolve: options.beforeResolve,
    resolutionTimeoutMs: options.resolutionTimeoutMs,
    disposableTestClock: options.disposableTestClock ?? false,
  });
  return {
    authority: createEnsPublicationAuthority({
      sql: options.sql ?? database.sql,
      runtime: fixture.runtime,
      now: suppliedNow,
    }),
    resolver: fixture.resolver,
  };
}

test("accepted version-only publication decision persists exact A4 evidence without commerce rows", async () => {
  const database = await startDisposableDatabase("a4-pub-a");
  let runtime: PublicationRuntimeConnection | null = null;
  try {
    const now = new Date();
    const versionId = await preparedVersion(database);
    runtime = await startPublicationRuntime(database, "accepted");
    const { authority, resolver } = fixtureAuthority(database, { sql: runtime.sql, now });
    await admitFixturePolicy(database, versionId, authority, resolver);
    const result = await authority({ agentVersionId: versionId });
    assert.equal(result.allowed, true);
    assert.equal(result.errorCode, null);
    assert.match(result.decisionId ?? "", /^[0-9a-f-]{36}$/);
    assert.equal(resolver.calls.length, 1);
    assert.deepEqual(Object.keys(resolver.calls[0]?.binding ?? {}).includes("jobId"), false);
    assert.deepEqual(Object.keys(resolver.calls[0]?.binding ?? {}).includes("effectId"), false);

    const rows = await database.sql<{
      id: string;
      binding_bytes: string;
      binding_hash: string;
      record_bytes: string;
      record_hash: string;
      decision: string;
      error_code: string | null;
      universal_resolver: string;
      creator_name: string;
      agent_name: string;
      jobs: number;
      effects: number;
      receipts: number;
    }[]>`
      SELECT d.id::text, d.binding_bytes, d.binding_hash, d.record_bytes,
        d.record_hash, d.decision, d.error_code, d.universal_resolver,
        d.creator_name, d.agent_name,
        (SELECT count(*)::int FROM jobs WHERE agent_version_id = d.agent_version_id) AS jobs,
        (SELECT count(*)::int FROM effects) AS effects,
        (SELECT count(*)::int FROM receipts) AS receipts
      FROM ens_publication_decisions d WHERE d.id = ${result.decisionId}::uuid
    `;
    const row = rows[0];
    assert.ok(row);
    assert.equal(row.decision, "ALLOW");
    assert.equal(row.error_code, null);
    assert.equal(row.creator_name, "creator.eth");
    assert.equal(row.agent_name, "research.creator.eth");
    assert.equal(row.universal_resolver, CANONICAL_UNIVERSAL_RESOLVER.toLowerCase());
    assert.equal(createHash("sha256").update(row.binding_bytes).digest("hex"), row.binding_hash);
    assert.equal(createHash("sha256").update(row.record_bytes).digest("hex"), row.record_hash);
    assert.equal(object(JSON.parse(row.binding_bytes)).jobId, undefined);
    assert.equal(object(JSON.parse(row.record_bytes)).effectId, undefined);
    assert.deepEqual([row.jobs, row.effects, row.receipts], [0, 0, 0]);
  } finally {
    await runtime?.close();
    await database.close();
  }
});

test("publication validation persists DENY for every immutable, hierarchy, role, expiry, link, resolver, and CCIP mismatch", async () => {
  const database = await startDisposableDatabase("a4-pub-d");
  let runtime: PublicationRuntimeConnection | null = null;
  try {
    const now = new Date();
    const versionId = await preparedVersion(database);
    runtime = await startPublicationRuntime(database, "denials");
    const base = fixtureAuthority(database, { sql: runtime.sql, now });
    await admitFixturePolicy(database, versionId, base.authority, base.resolver);
    const expired = new Date(now.getTime() - 1).toISOString();
    const stale = new Date(now.getTime() - 301_000).toISOString();
    const cases: Array<{ name: string; mutate: EnsPublicationFixtureMutator }> = [
      { name: "version-id", mutate: (r) => change(r, "record", "agentVersionId", "11111111-1111-4111-8111-111111111111") },
      { name: "version", mutate: (r) => change(r, "record", "agentVersion", 999) },
      { name: "manifest", mutate: (r) => change(r, "record", "manifestHash", "9".repeat(64)) },
      { name: "capabilities", mutate: (r) => change(r, "record", "capabilities", ["research"]) },
      { name: "service", mutate: (r) => change(r, "record", "service", "wrong-service") },
      { name: "price", mutate: (r) => change(r, "record", "priceAtomic", "999") },
      { name: "payout", mutate: (r) => change(r, "record", "payout", WRONG_ADDRESS) },
      { name: "chain-record", mutate: (r) => change(r, "record", "chainId", 1) },
      { name: "chain-observation", mutate: (r) => change(r, "observation", "chainId", 1) },
      { name: "creator-name", mutate: (r) => change(r, "creator", "name", "wrong.eth") },
      { name: "agent-node", mutate: (r) => change(r, "agent", "node", WRONG_NODE) },
      { name: "owner", mutate: (r) => change(r, "agent", "owner", WRONG_ADDRESS) },
      { name: "delegate", mutate: (r) => change(r, "agent", "delegate", WRONG_ADDRESS) },
      { name: "registry", mutate: (r) => change(r, "agent", "registry", WRONG_ADDRESS) },
      { name: "resolver-party", mutate: (r) => change(r, "agent", "resolver", WRONG_ADDRESS) },
      { name: "dns", mutate: (r) => change(r, "record", "agentDnsName", "0x0362616400") },
      { name: "label", mutate: (r) => change(r, "record", "agentLabel", "wrong") },
      { name: "root", mutate: (r) => change(r, "record", "rootRegistry", WRONG_ADDRESS) },
      { name: "universal", mutate: (r) => change(r, "record", "universalResolver", WRONG_ADDRESS) },
      { name: "creator-registry", mutate: (r) => change(r, "ensv2", "creatorCanonicalRegistry", WRONG_ADDRESS) },
      { name: "parent-registry", mutate: (r) => change(r, "ensv2", "agentParentRegistry", WRONG_ADDRESS) },
      { name: "agent-registry", mutate: (r) => change(r, "ensv2", "agentCanonicalRegistry", WRONG_ADDRESS) },
      { name: "hierarchy-owner", mutate: (r) => change(r, "ensv2", "owner", WRONG_ADDRESS) },
      { name: "hierarchy-delegate", mutate: (r) => change(r, "ensv2", "delegate", WRONG_ADDRESS) },
      { name: "role", mutate: (r) => changeRole(r, 0, "role", WRONG_NODE) },
      { name: "admin-role", mutate: (r) => changeRole(r, 0, "adminRole", WRONG_NODE) },
      { name: "role-account", mutate: (r) => changeRole(r, 0, "account", WRONG_ADDRESS) },
      { name: "grant", mutate: addExternalGrant },
      { name: "parent-expiry", mutate: (r) => change(r, "ensv2", "parentExpiry", expired) },
      { name: "agent-expiry", mutate: (r) => change(r, "ensv2", "agentExpiry", now.toISOString()) },
      { name: "role-expiry", mutate: (r) => changeRole(r, 0, "expiresAt", expired) },
      { name: "forward-link", mutate: (r) => change(r, "parentLink", "forward", false) },
      { name: "back-link", mutate: (r) => change(r, "parentLink", "back", false) },
      { name: "alias", mutate: (r) => change(r, "ensv2", "alias", true) },
      { name: "resolver-address", mutate: (r) => change(r, "resolver", "address", WRONG_ADDRESS) },
      { name: "resolver-suffix", mutate: (r) => change(r, "resolver", "suffix", "creator.eth") },
      { name: "resolver-mode", mutate: (r) => change(r, "resolver", "mode", "INHERITED") },
      { name: "ccip-universal", mutate: (r) => change(r, "ccip", "universalResolver", WRONG_ADDRESS) },
      { name: "ccip-gateway", mutate: (r) => change(r, "ccip", "gateway", "https://wrong.fixture.invalid") },
      { name: "ccip-status", mutate: (r) => change(r, "ccip", "status", "FAILED") },
      { name: "stale-block", mutate: (r) => change(r, "observation", "blockTimestamp", stale) },
      { name: "exact-fresh-expiry", mutate: (r) => change(r, "record", "freshUntil", now.toISOString()) },
      {
        name: "ccip-malformed",
        mutate: (r) => {
          const copy = structuredClone(r);
          delete object(object(object(copy.record).ensv2).ccip).responseHash;
          return copy;
        },
      },
    ];
    for (const item of cases) {
      const { authority } = fixtureAuthority(database, {
        sql: runtime.sql,
        now,
        mutator: item.mutate,
      });
      const result = await authority({ agentVersionId: versionId });
      assert.equal(result.allowed, false, item.name);
      assert.match(result.errorCode ?? "", /^ENS_AUTHORITY_/, item.name);
      assert.match(result.decisionId ?? "", /^[0-9a-f-]{36}$/, item.name);
    }
    const rows = await database.sql<{ allows: number; denies: number }[]>`
      SELECT
        count(*) FILTER (WHERE decision = 'ALLOW')::int AS allows,
        count(*) FILTER (WHERE decision = 'DENY')::int AS denies
      FROM ens_publication_decisions WHERE agent_version_id = ${versionId}::uuid
    `;
    assert.deepEqual(rows[0], { allows: 0, denies: cases.length });
  } finally {
    await runtime?.close();
    await database.close();
  }
});

test("twenty concurrent identical publication checks converge to one durable decision", async () => {
  const database = await startDisposableDatabase("a4-pub-r");
  const runtimes: PublicationRuntimeConnection[] = [];
  try {
    const now = new Date();
    const versionId = await preparedVersion(database);
    for (const suffix of ["utc", "honolulu", "tokyo"]) {
      runtimes.push(await startPublicationRuntime(database, suffix));
    }
    const [utcRuntime, honoluluRuntime, tokyoRuntime] = runtimes;
    assert.ok(utcRuntime && honoluluRuntime && tokyoRuntime);
    await utcRuntime.sql`SET TIME ZONE 'UTC'`;
    await honoluluRuntime.sql`SET TIME ZONE 'Pacific/Honolulu'`;
    await tokyoRuntime.sql`SET TIME ZONE 'Asia/Tokyo'`;
    const fixtures = runtimes.map((runtime) => fixtureAuthority(database, {
      sql: runtime.sql,
      now,
    }));
    const first = fixtures[0];
    assert.ok(first);
    await admitFixturePolicy(database, versionId, first.authority, first.resolver);
    const results = await Promise.all(Array.from({ length: 20 }, (_, index) => (
      fixtures[index % fixtures.length]!.authority({ agentVersionId: versionId })
    )));
    assert.equal(results.every((result) => result.allowed), true);
    assert.equal(new Set(results.map((result) => result.decisionId)).size, 1);
    assert.equal(fixtures.reduce((count, fixture) => count + fixture.resolver.calls.length, 0), 20);
    const rows = await database.sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM ens_publication_decisions
      WHERE agent_version_id = ${versionId}::uuid
    `;
    assert.equal(rows[0]?.count, 1);
  } finally {
    await Promise.all(runtimes.map((runtime) => runtime.close()));
    await database.close();
  }
});

test("missing runtime, caller-owned evidence, outage, timeout, and malformed response fail closed", async () => {
  const database = await startDisposableDatabase("a4-pub-f");
  let runtime: PublicationRuntimeConnection | null = null;
  try {
    const now = new Date();
    const versionId = await preparedVersion(database);
    const missing = createEnsPublicationAuthority({
      sql: database.sql,
      runtime: null,
      now,
    });
    assert.deepEqual(await missing({ agentVersionId: versionId }), {
      allowed: false,
      decisionId: null,
      errorCode: "ENS_PUBLICATION_NOT_CONFIGURED",
    });

    runtime = await startPublicationRuntime(database, "failures");
    const validFixture = fixtureAuthority(database, { sql: runtime.sql, now });
    await admitFixturePolicy(
      database,
      versionId,
      validFixture.authority,
      validFixture.resolver,
    );
    const fabricated = await validFixture.authority({
      agentVersionId: versionId,
      manifestHash: "9".repeat(64),
      owner: WRONG_ADDRESS,
      observedAt: now.toISOString(),
      releaseSha: "9".repeat(40),
    } as unknown as { agentVersionId: string });
    assert.deepEqual(fabricated, {
      allowed: false,
      decisionId: null,
      errorCode: "ENS_PUBLICATION_INVALID_REQUEST",
    });
    assert.equal(validFixture.resolver.calls.length, 0);

    const outage = fixtureAuthority(database, {
      sql: runtime.sql,
      now,
      beforeResolve: async () => { throw new Error("fixture outage"); },
    });
    const outageResult = await outage.authority({ agentVersionId: versionId });
    assert.equal(outageResult.allowed, false);
    assert.equal(outageResult.errorCode, "ENS_AUTHORITY_RESOLVER_OUTAGE");
    assert.ok(outageResult.decisionId);

    const timeout = fixtureAuthority(database, {
      sql: runtime.sql,
      now,
      beforeResolve: async () => new Promise<void>(() => undefined),
      resolutionTimeoutMs: 10,
    });
    const timeoutResult = await timeout.authority({ agentVersionId: versionId });
    assert.equal(timeoutResult.allowed, false);
    assert.equal(timeoutResult.errorCode, "ENS_AUTHORITY_TIMEOUT");
    assert.ok(timeoutResult.decisionId);

    const malformed = fixtureAuthority(database, {
      sql: runtime.sql,
      now,
      mutator: () => ({ malformed: true }),
    });
    const malformedResult = await malformed.authority({ agentVersionId: versionId });
    assert.equal(malformedResult.allowed, false);
    assert.equal(malformedResult.errorCode, "ENS_AUTHORITY_MALFORMED");
    assert.ok(malformedResult.decisionId);
  } finally {
    await runtime?.close();
    await database.close();
  }
});

test("drift creates a new DENY without overwriting ALLOW and decision rows are append-only", async () => {
  const database = await startDisposableDatabase("a4-pub-x");
  let runtime: PublicationRuntimeConnection | null = null;
  try {
    const now = new Date();
    const versionId = await preparedVersion(database);
    runtime = await startPublicationRuntime(database, "drift");
    const fixture = fixtureAuthority(database, { sql: runtime.sql, now });
    await admitFixturePolicy(database, versionId, fixture.authority, fixture.resolver);
    const authority = fixture.authority;
    const allowed = await authority({ agentVersionId: versionId });
    assert.equal(allowed.allowed, true);
    fixture.resolver.setMutator((response) => change(response, "agent", "owner", WRONG_ADDRESS));
    const denied = await authority({ agentVersionId: versionId });
    assert.equal(denied.allowed, false);
    assert.notEqual(denied.decisionId, allowed.decisionId);

    const rows = await database.sql<{ decision: string; error_code: string | null }[]>`
      SELECT decision, error_code FROM ens_publication_decisions
      WHERE agent_version_id = ${versionId}::uuid ORDER BY created_at, id
    `;
    assert.deepEqual(rows.map((row) => row.decision).sort(), ["ALLOW", "DENY"]);
    await assert.rejects(
      database.sql`UPDATE ens_publication_decisions SET decision = 'DENY' WHERE id = ${allowed.decisionId}::uuid`,
      /append-only/,
    );
    await assert.rejects(
      database.sql`DELETE FROM ens_publication_decisions WHERE id = ${allowed.decisionId}::uuid`,
      /append-only/,
    );
    await assert.rejects(
      database.sql`
        INSERT INTO ens_publication_decisions
        SELECT (jsonb_populate_record(
          NULL::ens_publication_decisions,
          to_jsonb(d) || jsonb_build_object(
            'id', gen_random_uuid(),
            'decision_key', repeat('f', 64)
          )
        )).* FROM ens_publication_decisions d WHERE d.id = ${allowed.decisionId}::uuid
      `,
      /uniq_ens_publication_decision_evidence|duplicate key/,
    );
    await assert.rejects(
      database.sql`
        INSERT INTO ens_publication_decisions
        SELECT (jsonb_populate_record(
          NULL::ens_publication_decisions,
          to_jsonb(d) || jsonb_build_object(
            'id', gen_random_uuid(),
            'decision_key', repeat('a', 64),
            'record_hash', repeat('a', 64),
            'record_bytes', (
              d.record_bytes::jsonb || jsonb_build_object(
                'agent', d.record_bytes::jsonb->'agent' || jsonb_build_object('owner', ${WRONG_ADDRESS}::text)
              )
            )::text
          )
        )).* FROM ens_publication_decisions d WHERE d.id = ${allowed.decisionId}::uuid
      `,
      /record hash does not match|ALLOW record is not exact/,
    );
    await assert.rejects(
      database.sql`
        INSERT INTO ens_publication_decisions
        SELECT (jsonb_populate_record(
          NULL::ens_publication_decisions,
          to_jsonb(d) || jsonb_build_object(
            'id', gen_random_uuid(),
            'decision_key', repeat('e', 64),
            'agent_version_id', '11111111-1111-4111-8111-111111111111'
          )
        )).* FROM ens_publication_decisions d WHERE d.id = ${allowed.decisionId}::uuid
      `,
      /immutable version lineage|foreign key/,
    );
    await assert.rejects(
      database.sql`
        INSERT INTO ens_publication_decisions
        SELECT (jsonb_populate_record(
          NULL::ens_publication_decisions,
          to_jsonb(d) || jsonb_build_object(
            'id', gen_random_uuid(),
            'decision_key', repeat('d', 64),
            'disposable_test_clock', false,
            'observed_at', '2020-01-01T00:00:00.000Z',
            'created_at', '2020-01-01T00:00:00.000Z'
          )
        )).* FROM ens_publication_decisions d WHERE d.id = ${allowed.decisionId}::uuid
      `,
      /stale, expired, or not current|uniq_ens_publication_decision_evidence/,
    );

  } finally {
    await runtime?.close();
    await database.close();
  }
});

test("restricted runtime admits only owner policy with bounded UTC observations and no inherited authority", async () => {
  const database = await startDisposableDatabase("a4-pub-role");
  let runtime: PublicationRuntimeConnection | null = null;
  try {
    const now = new Date();
    const versionId = await preparedVersion(database, "research", { admitRelease: false });
    runtime = await startPublicationRuntime(database, "authority");
    const fixture = fixtureAuthority(database, { sql: runtime.sql, now });

    assert.deepEqual(await fixture.authority({ agentVersionId: versionId }), {
      allowed: false,
      decisionId: null,
      errorCode: "ENS_PUBLICATION_PERSIST_FAILED",
    });
    const binding = fixture.resolver.calls.at(-1)?.binding;
    assert.ok(binding);
    fixture.resolver.calls.length = 0;
    const emptyState = await database.sql<{
      old_function: string | null;
      decisions: number;
      jobs: number;
      effects: number;
      receipts: number;
    }[]>`
      SELECT
        to_regprocedure('public.admit_ens_publication_decision(uuid,jsonb,jsonb,numeric,timestamptz,text,text,timestamptz)')::text AS old_function,
        (SELECT count(*)::int FROM ens_publication_decisions) AS decisions,
        (SELECT count(*)::int FROM jobs) AS jobs,
        (SELECT count(*)::int FROM effects) AS effects,
        (SELECT count(*)::int FROM receipts) AS receipts
    `;
    assert.deepEqual(emptyState[0], {
      old_function: null,
      decisions: 0,
      jobs: 0,
      effects: 0,
      receipts: 0,
    });

    await assert.rejects(
      database.sql`
        INSERT INTO ens_publication_authority_releases (release_sha, not_before, expires_at)
        VALUES (${'1'.repeat(40)}, '-infinity', ${now})
      `,
      /finite|release_finite/,
    );
    await assert.rejects(
      database.sql`
        INSERT INTO ens_publication_authority_releases (release_sha, not_before, expires_at)
        VALUES (${'2'.repeat(40)}, ${now}, 'infinity')
      `,
      /finite|release_finite/,
    );
    await assert.rejects(
      database.sql`
        INSERT INTO ens_publication_authority_releases (release_sha, not_before, expires_at)
        VALUES (${'3'.repeat(40)}, ${now}, ${now})
      `,
      /window|release_window/,
    );
    await assert.rejects(
      database.sql`
        INSERT INTO ens_publication_authority_releases (release_sha, not_before, expires_at)
        VALUES (${'4'.repeat(40)}, ${now}, ${new Date(now.getTime() + 24 * 60 * 60 * 1_000 + 1)})
      `,
      /24h|release_max/,
    );
    const releaseStart = new Date(now.getTime() - 60_000);
    const releaseEnd = new Date(releaseStart.getTime() + 24 * 60 * 60 * 1_000);
    await database.sql`
      INSERT INTO ens_publication_authority_releases (release_sha, not_before, expires_at)
      VALUES (${RELEASE_SHA}, ${releaseStart}, ${releaseEnd})
    `;
    const futureStart = releaseEnd;
    await database.sql`
      INSERT INTO ens_publication_authority_releases (release_sha, not_before, expires_at)
      VALUES (${'8'.repeat(40)}, ${futureStart}, ${new Date(futureStart.getTime() + 24 * 60 * 60 * 1_000 - 1)})
    `;
    await assert.rejects(
      database.sql`
        INSERT INTO ens_publication_authority_releases (release_sha, not_before, expires_at)
        VALUES (${'9'.repeat(40)}, ${new Date(now.getTime() + 60_000)}, ${new Date(now.getTime() + 120_000)})
      `,
      /overlap|conflicting key value|exclusion/,
    );

    assert.deepEqual(await fixture.authority({ agentVersionId: versionId }), {
      allowed: false,
      decisionId: null,
      errorCode: "ENS_PUBLICATION_PERSIST_FAILED",
    });
    const policyDocument = createEnsPublicationPolicyDocument(binding);
    await database.sql`
      INSERT INTO ens_publication_authority_policies (
        release_sha, agent_version_id, binding, binding_hash
      ) VALUES (
        ${RELEASE_SHA}, ${versionId}::uuid,
        ${database.sql.json(JSON.parse(JSON.stringify(policyDocument)))}, ${"0".repeat(64)}
      )
    `;
    fixture.resolver.calls.length = 0;

    const identities = await runtime.sql<{
      current_role: string;
      session_role: string;
      superuser: boolean;
      bypass_rls: boolean;
      can_create_public: boolean;
      decision_owner: string;
      release_owner: string;
      policy_owner: string;
    }[]>`
      SELECT current_user AS current_role, session_user AS session_role,
        r.rolsuper AS superuser, r.rolbypassrls AS bypass_rls,
        has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_public,
        (SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ens_publication_decisions') AS decision_owner,
        (SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ens_publication_authority_releases') AS release_owner,
        (SELECT tableowner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ens_publication_authority_policies') AS policy_owner
      FROM pg_roles r WHERE r.rolname = current_user
    `;
    assert.equal(identities[0]?.current_role, runtime.role);
    assert.equal(identities[0]?.session_role, runtime.role);
    assert.equal(identities[0]?.superuser, false);
    assert.equal(identities[0]?.bypass_rls, false);
    assert.equal(identities[0]?.can_create_public, false);
    assert.notEqual(identities[0]?.decision_owner, runtime.role);
    assert.notEqual(identities[0]?.release_owner, runtime.role);
    assert.notEqual(identities[0]?.policy_owner, runtime.role);

    for (const [table, update] of [
      ["ens_publication_decisions", "decision = decision"],
      ["ens_publication_authority_releases", "expires_at = expires_at"],
      ["ens_publication_authority_policies", "binding_hash = binding_hash"],
    ] as const) {
      await assert.rejects(runtime.sql.unsafe(`SELECT * FROM ${table}`), /permission denied/);
      await assert.rejects(runtime.sql.unsafe(`INSERT INTO ${table} DEFAULT VALUES`), /permission denied/);
      await assert.rejects(runtime.sql.unsafe(`UPDATE ${table} SET ${update}`), /permission denied/);
      await assert.rejects(runtime.sql.unsafe(`DELETE FROM ${table}`), /permission denied/);
      await assert.rejects(runtime.sql.unsafe(`TRUNCATE ${table}`), /permission denied/);
    }
    await assert.rejects(
      database.sql`UPDATE ens_publication_authority_policies SET binding_hash = ${"9".repeat(64)}`,
      /append-only/,
    );
    await assert.rejects(database.sql`DELETE FROM ens_publication_authority_policies`, /append-only/);
    await assert.rejects(database.sql`TRUNCATE ens_publication_authority_policies`, /append-only/);

    const allowed = await fixture.authority({ agentVersionId: versionId });
    assert.equal(allowed.allowed, true);
    assert.ok(allowed.decisionId);
    const evidenceRows = await database.sql<{
      binding_bytes: string;
      record_bytes: string;
      block_number: string;
      block_timestamp: Date;
      transaction_hash: string;
      decision_key: string;
      release_sha: string;
    }[]>`
      SELECT binding_bytes, record_bytes, block_number::text, block_timestamp,
        transaction_hash, decision_key, release_sha
      FROM ens_publication_decisions WHERE id = ${allowed.decisionId}::uuid
    `;
    const evidence = evidenceRows[0];
    assert.ok(evidence);
    assert.equal(evidence.release_sha, RELEASE_SHA);
    assert.match(evidence.decision_key, /^[0-9a-f]{64}$/);

    const exact = await runtime.sql<{ decision_id: string }[]>`
      SELECT decision_id::text FROM public.admit_ens_publication_decision(
        ${versionId}::uuid, ${runtime.sql.json(JSON.parse(evidence.record_bytes))},
        ${evidence.block_number}::numeric, ${evidence.block_timestamp}::timestamptz,
        ${evidence.transaction_hash}, NULL
      )
    `;
    assert.equal(exact[0]?.decision_id, allowed.decisionId);

    const alteredRecord = JSON.parse(evidence.record_bytes) as Record<string, unknown>;
    alteredRecord.chainId = 1;
    alteredRecord.rootRegistry = WRONG_ADDRESS;
    object(alteredRecord.ensv2).creatorCanonicalRegistry = WRONG_ADDRESS;
    await assert.rejects(
      runtime.sql`
        SELECT * FROM public.admit_ens_publication_decision(
          ${versionId}::uuid, ${runtime.sql.json(JSON.parse(JSON.stringify(alteredRecord)))},
          ${evidence.block_number}::numeric, ${evidence.block_timestamp}::timestamptz,
          ${evidence.transaction_hash}, NULL
        )
      `,
      /ALLOW record is not exact/,
    );
    await assert.rejects(
      runtime.sql`
        SELECT * FROM public.admit_ens_publication_decision(
          ${"11111111-1111-4111-8111-111111111111"}::uuid,
          ${runtime.sql.json(JSON.parse(evidence.record_bytes))},
          ${evidence.block_number}::numeric, ${evidence.block_timestamp}::timestamptz,
          ${evidence.transaction_hash}, NULL
        )
      `,
      /immutable version lineage/,
    );
    await assert.rejects(
      runtime.sql`
        SELECT * FROM public.admit_ens_publication_decision(
          ${versionId}::uuid, ${runtime.sql.json(JSON.parse(evidence.record_bytes))},
          ${evidence.block_number}::numeric, ${new Date("2020-01-01T00:00:00.000Z")}::timestamptz,
          ${evidence.transaction_hash}, NULL
        )
      `,
      /stale, expired, or not current/,
    );

    const sizes = await database.sql<{ payload: unknown; size: number }[]>`
      SELECT payload, pg_column_size(payload)::int AS size
      FROM (
        SELECT jsonb_build_object('padding', repeat('x', n)) AS payload
        FROM generate_series(130900, 131200) n
      ) candidates
      WHERE pg_column_size(payload) BETWEEN 131071 AND 131073
      ORDER BY pg_column_size(payload)
    `;
    assert.deepEqual(sizes.map((row) => row.size), [131071, 131072, 131073]);
    for (const bounded of sizes.slice(0, 2)) {
      await assert.rejects(
        runtime.sql`
          SELECT * FROM public.admit_ens_publication_decision(
            ${versionId}::uuid, ${runtime.sql.json(JSON.parse(JSON.stringify(bounded.payload)))},
            ${evidence.block_number}::numeric, ${evidence.block_timestamp}::timestamptz,
            ${evidence.transaction_hash}, NULL
          )
        `,
        /scalar or array bounds/,
      );
    }
    await assert.rejects(
      runtime.sql`
        SELECT * FROM public.admit_ens_publication_decision(
          ${versionId}::uuid, ${runtime.sql.json(JSON.parse(JSON.stringify(sizes[2]?.payload)))},
          ${evidence.block_number}::numeric, ${evidence.block_timestamp}::timestamptz,
          ${evidence.transaction_hash}, NULL
        )
      `,
      /early bounds/,
    );
    const nestedOversized = { nested: { padding: "x".repeat(131_100) } };
    await assert.rejects(
      runtime.sql`
        SELECT * FROM public.admit_ens_publication_decision(
          ${versionId}::uuid, ${runtime.sql.json(nestedOversized)},
          ${evidence.block_number}::numeric, ${evidence.block_timestamp}::timestamptz,
          ${evidence.transaction_hash}, NULL
        )
      `,
      /early bounds/,
    );
    await assert.rejects(
      runtime.sql`
        SELECT * FROM public.admit_ens_publication_decision(
          ${versionId}::uuid, ${runtime.sql.json(JSON.parse(evidence.record_bytes))},
          ${evidence.block_number}::numeric, ${evidence.block_timestamp}::timestamptz,
          ${evidence.transaction_hash}, ${"X".repeat(65)}
        )
      `,
      /early bounds/,
    );

    const oversizedPolicy = JSON.parse(JSON.stringify(policyDocument)) as Record<string, unknown>;
    oversizedPolicy.padding = "x".repeat(65_600);
    await assert.rejects(
      database.sql`
        INSERT INTO ens_publication_authority_policies (
          release_sha, agent_version_id, binding, binding_hash
        ) VALUES (
          ${RELEASE_SHA}, ${versionId}::uuid,
          ${database.sql.json(JSON.parse(JSON.stringify(oversizedPolicy)))}, ${"0".repeat(64)}
        )
      `,
      /exceeds 65536|policy_size/,
    );

    const directParent = `a4_parent_${process.pid}_${Date.now().toString(36)}`;
    const nestedParent = `${directParent}_nested`;
    await database.sql.unsafe(
      `CREATE ROLE "${directParent}" NOLOGIN; CREATE ROLE "${nestedParent}" NOLOGIN; ` +
      `GRANT "${directParent}" TO alphadawg_runtime; GRANT "${nestedParent}" TO "${directParent}"`,
    );
    await assert.rejects(
      runtime.sql`
        SELECT * FROM public.admit_ens_publication_decision(
          ${versionId}::uuid, ${runtime.sql.json(JSON.parse(evidence.record_bytes))},
          ${evidence.block_number}::numeric, ${evidence.block_timestamp}::timestamptz,
          ${evidence.transaction_hash}, NULL
        )
      `,
      /caller has unsafe inherited role membership|alphadawg_runtime has unsafe inherited role membership/,
    );
    await database.sql.unsafe(
      `REVOKE "${nestedParent}" FROM "${directParent}"; ` +
      `REVOKE "${directParent}" FROM alphadawg_runtime; ` +
      `DROP ROLE "${nestedParent}"; DROP ROLE "${directParent}"`,
    );

    const privilegeParent = `a4_priv_${process.pid}_${Date.now().toString(36)}`;
    await database.sql.unsafe(
      `CREATE ROLE "${privilegeParent}" NOLOGIN; ` +
      `GRANT SELECT ON ens_publication_decisions TO "${privilegeParent}"; ` +
      `GRANT "${privilegeParent}" TO "${runtime.role}"`,
    );
    const effective = await runtime.sql<{ allowed: boolean }[]>`
      SELECT has_table_privilege(current_user, 'ens_publication_decisions', 'SELECT') AS allowed
    `;
    assert.equal(effective[0]?.allowed, true);
    await assert.rejects(
      runtime.sql`
        SELECT * FROM public.admit_ens_publication_decision(
          ${versionId}::uuid, ${runtime.sql.json(JSON.parse(evidence.record_bytes))},
          ${evidence.block_number}::numeric, ${evidence.block_timestamp}::timestamptz,
          ${evidence.transaction_hash}, NULL
        )
      `,
      /unsafe inherited role membership|effective authority-table privilege/,
    );
    await database.sql.unsafe(
      `REVOKE "${privilegeParent}" FROM "${runtime.role}"; ` +
      `REVOKE SELECT ON ens_publication_decisions FROM "${privilegeParent}"; ` +
      `DROP ROLE "${privilegeParent}"`,
    );

    const signatures = await database.sql<{ arguments: string; count: number }[]>`
      SELECT min(pg_get_function_arguments(p.oid)) AS arguments, count(*)::int AS count
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'admit_ens_publication_decision'
    `;
    assert.equal(signatures[0]?.count, 1);
    assert.doesNotMatch(
      signatures[0]?.arguments ?? "",
      /policy|binding|release|decision_key|observed|clock|test_time|authority_time/i,
    );
  } finally {
    await runtime?.close();
    await database.close();
  }
});
