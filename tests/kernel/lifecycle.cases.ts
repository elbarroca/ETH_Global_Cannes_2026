import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { TestContext } from "node:test";
import postgres from "postgres";
import {
  createEnsPublicationAuthority,
  createEnsPublicationPolicyDocument,
  type EnsPublicationAuthority,
} from "../../src/ens/authority";
import { KernelError } from "../../src/kernel/errors";
import { readBoundedKernelJson } from "../../src/kernel/http";
import { domainHash, type CanonicalValue } from "../../src/kernel/canonical";
import {
  bindAgentName,
  createAgentDraft,
  listAgentLifecycle,
  prepareAgentEnsWrite,
  publishAgentVersion,
} from "../../src/kernel/lifecycle";
import { parseAgentAction, parseAgentInput, parseEnsBinding } from "../../src/kernel/policy";
import { createProductionEnsPublicationAuthority } from "../../src/kernel/publication-authority";
import { verifyEnsPublicationDatabaseClient } from "../../src/config/database";
import { cancelBuyerJob, submitJob } from "../../src/kernel/service";
import type { DisposableDatabase } from "../helpers/postgres";
import {
  createEnsPublicationAuthorityFixture,
  type EnsPublicationFixtureMutator,
} from "../helpers/ens";
import { POST as postAgentAction } from "../../app/api/kernel/agents/route";

const CREATOR_ID = "lifecycle-creator";
const BUYER_ID = "lifecycle-buyer";
const OTHER_ID = "lifecycle-other";
const CREATOR_WALLET = "0x6666666666666666666666666666666666666666";
const BUYER_WALLET = "0x4444444444444444444444444444444444444444";
const OTHER_WALLET = "0x5555555555555555555555555555555555555555";
const NOW = new Date("2026-07-25T02:00:00.000Z");
const RELEASE_SHA = "9c6e37d169ac6ddee2439602551deaca5347c41a";

interface PublicationAuthorityFixture {
  authority: EnsPublicationAuthority;
  resolverCalls: () => number;
  close: () => Promise<void>;
}

function testRolePassword(): string {
  return randomBytes(32).toString("base64url");
}

async function executeRoleCommand(
  database: DisposableDatabase,
  format: string,
  ...values: string[]
): Promise<void> {
  const rows = await database.sql<{ command: string }[]>`
    SELECT format(
      ${format}::text,
      ${values[0] ?? null}::text,
      ${values[1] ?? null}::text
    ) AS command
  `;
  const command = rows[0]?.command;
  if (!command) throw new Error("TEST_ROLE_COMMAND_INVALID");
  await database.sql.unsafe(command);
}

async function publicationAuthority(
  database: DisposableDatabase,
  versionId: string,
  options: { mutator?: EnsPublicationFixtureMutator } = {},
): Promise<PublicationAuthorityFixture> {
  const suffix = Math.random().toString(36).slice(2, 10);
  const role = `kernel_pub_${process.pid}_${suffix}`;
  const password = testRolePassword();
  await executeRoleCommand(
    database,
    "CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT",
    role,
    password,
  );
  await executeRoleCommand(database, "GRANT alphadawg_runtime TO %I", role);
  const runtimeUrl = new URL(database.url);
  runtimeUrl.username = role;
  runtimeUrl.password = password;
  const runtimeSql = postgres(runtimeUrl.toString(), { max: 1, prepare: false });
  await verifyEnsPublicationDatabaseClient(runtimeSql, role);
  const now = new Date();
  await database.sql`
    INSERT INTO ens_publication_authority_releases (release_sha, not_before, expires_at)
    VALUES (
      ${RELEASE_SHA},
      ${new Date(now.getTime() - 60_000)},
      ${new Date(now.getTime() + 3_600_000)}
    ) ON CONFLICT (release_sha) DO NOTHING
  `;
  const fixture = createEnsPublicationAuthorityFixture({ now, mutator: options.mutator });
  const authority = createEnsPublicationAuthority({
    sql: runtimeSql,
    runtime: fixture.runtime,
    now,
  });
  const missingPolicy = await authority({ agentVersionId: versionId });
  assert.equal(missingPolicy.errorCode, "ENS_PUBLICATION_PERSIST_FAILED");
  const binding = fixture.resolver.calls.at(-1)?.binding;
  assert.ok(binding);
  const policy = createEnsPublicationPolicyDocument(binding);
  await database.sql`
    INSERT INTO ens_publication_authority_policies (
      release_sha, agent_version_id, binding, binding_hash
    ) VALUES (
      ${RELEASE_SHA}, ${versionId}::uuid,
      ${database.sql.json(JSON.parse(JSON.stringify(policy)))}, ${"0".repeat(64)}
    )
    ON CONFLICT (release_sha, agent_version_id) DO NOTHING
  `;
  fixture.resolver.calls.length = 0;
  return {
    authority,
    resolverCalls: () => fixture.resolver.calls.length,
    close: async () => {
      await runtimeSql.end({ timeout: 1 });
      await executeRoleCommand(database, "DROP ROLE %I", role);
    },
  };
}

async function seedUsers(database: DisposableDatabase): Promise<void> {
  await database.sql`
    INSERT INTO users (id, wallet_address) VALUES
      (${CREATOR_ID}, ${CREATOR_WALLET}),
      (${BUYER_ID}, ${BUYER_WALLET}),
      (${OTHER_ID}, ${OTHER_WALLET})
  `;
}

function manifest(name = "Protected Research Agent") {
  return parseAgentInput({
    name,
    description: "A private bounded research draft for the protected lifecycle.",
    instructions: "## Task\n\nAnalyze the prompt and return a concise evidence-backed result.",
    capabilities: ["research", "market-analysis"],
  }, CREATOR_WALLET).manifest;
}

async function preparedVersion(
  database: DisposableDatabase,
  name: string,
  agentLabel: string,
) {
  const draft = await createAgentDraft(
    { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
    manifest(name),
    { idempotencyKey: `draft-${agentLabel}-01`, now: NOW, sql: database.sql },
  );
  const binding = parseEnsBinding({ creatorParent: "creator.eth", agentLabel });
  const bound = await bindAgentName(CREATOR_ID, draft.versionId, binding, {
    idempotencyKey: `bind-${agentLabel}-01`,
    now: NOW,
    sql: database.sql,
  });
  const prepared = await prepareAgentEnsWrite(CREATOR_ID, draft.versionId, {
    idempotencyKey: `prepare-${agentLabel}-01`,
    now: NOW,
    sql: database.sql,
  });
  return { binding, bound, draft, prepared };
}

export async function runLifecycleCases(
  t: TestContext,
  database: DisposableDatabase,
): Promise<void> {
  await seedUsers(database);
  await t.test("ENS publication runtime role is direct-only and cannot mutate authority evidence", async () => {
    const suffix = `${process.pid}_${Math.random().toString(36).slice(2, 10)}`;
    const safeRole = `kernel_attest_${suffix}`;
    const extraParent = `kernel_parent_${suffix}`;
    const unsafeRole = `kernel_unsafe_${suffix}`;
    const safePassword = testRolePassword();
    const unsafePassword = testRolePassword();
    await executeRoleCommand(
      database,
      "CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT",
      safeRole,
      safePassword,
    );
    await executeRoleCommand(database, "GRANT alphadawg_runtime TO %I", safeRole);
    await executeRoleCommand(database, "CREATE ROLE %I NOLOGIN", extraParent);
    await executeRoleCommand(
      database,
      "CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT",
      unsafeRole,
      unsafePassword,
    );
    await executeRoleCommand(database, "GRANT alphadawg_runtime, %I TO %I", extraParent, unsafeRole);
    await executeRoleCommand(database, "GRANT SELECT ON ens_publication_decisions TO %I", unsafeRole);
    const connectRole = (role: string, password: string) => {
      const url = new URL(database.url);
      url.username = role;
      url.password = password;
      return postgres(url.toString(), { max: 1, prepare: false });
    };
    const safe = connectRole(safeRole, safePassword);
    const unsafe = connectRole(unsafeRole, unsafePassword);
    try {
      await verifyEnsPublicationDatabaseClient(safe, safeRole);
      await assert.rejects(
        verifyEnsPublicationDatabaseClient(safe, unsafeRole),
        /ENS_PUBLICATION_DATABASE_ROLE_INVALID/,
      );
      await assert.rejects(
        verifyEnsPublicationDatabaseClient(unsafe, unsafeRole),
        /ENS_PUBLICATION_DATABASE_ROLE_INVALID/,
      );
      await assert.rejects(
        safe`INSERT INTO ens_publication_decisions DEFAULT VALUES`,
        /permission denied/,
      );
    } finally {
      await Promise.all([
        safe.end({ timeout: 1 }),
        unsafe.end({ timeout: 1 }),
      ]);
      await executeRoleCommand(database, "REVOKE SELECT ON ens_publication_decisions FROM %I", unsafeRole);
      await executeRoleCommand(database, "DROP ROLE %I", safeRole);
      await executeRoleCommand(database, "DROP ROLE %I", unsafeRole);
      await executeRoleCommand(database, "DROP ROLE %I", extraParent);
    }
  });
  await t.test("agent lifecycle action parsing rejects authority fields and active Markdown", () => {
    assert.throws(
      () => parseAgentAction({ action: "UNKNOWN" }, CREATOR_WALLET),
      /Unsupported agent lifecycle action/,
    );
    assert.throws(
      () => parseAgentAction({
        action: "CREATE_DRAFT",
        name: "Unsafe agent",
        description: "This draft contains an active instruction payload.",
        instructions: "Open <script>alert(1)</script> and https://example.invalid now.",
        capabilities: ["research"],
        ownerWallet: OTHER_WALLET,
      }, CREATOR_WALLET),
      /Unexpected or server-owned field/,
    );
    assert.throws(
      () => parseAgentAction({
        action: "BIND_NAME",
        versionId: "55555555-5555-4555-8555-555555555555",
        creatorParent: "creator.eth",
        agentLabel: "nested.research",
      }, CREATOR_WALLET),
      /Invalid ENS creator parent or agent label/,
    );
  });

  await t.test("private draft binds an inert plan and publishes only exact fresh A4 authority", async () => {
    const { binding, draft, prepared } = await preparedVersion(
      database,
      "Protected Research Agent",
      "research",
    );
    assert.equal(draft.lifecycleState, "DRAFT");
    assert.equal(draft.hireable, false);
    assert.equal(prepared.version.lifecycleState, "WRITE_PREPARED");
    assert.equal(prepared.plan.kind, "LOCAL_ONLY_UNAUTHORIZED");
    assert.equal(prepared.plan.fullSubname, binding.fullSubname);
    assert.equal(prepared.plan.requiresAuthorization, true);
    assert.equal(prepared.plan.requiresWalletSignature, true);
    const persisted = await database.sql<{ manifest: { payoutAddress: string }; payout_address: string | null }[]>`
      SELECT manifest, payout_address FROM agent_versions WHERE id = ${draft.versionId}::uuid
    `;
    assert.equal(persisted[0]?.payout_address, persisted[0]?.manifest.payoutAddress);

    const ownerView = await listAgentLifecycle(CREATOR_ID, { sql: database.sql });
    const buyerView = await listAgentLifecycle(BUYER_ID, { sql: database.sql });
    assert.equal(ownerView.drafts.length, 1);
    assert.equal(buyerView.drafts.length, 0);
    assert.equal(buyerView.agents.length, 0);
    await assert.rejects(
      submitJob(BUYER_ID, {
        agentVersionId: draft.versionId,
        idempotencyKey: "draft-not-hireable",
        task: { prompt: "Must not create an effect." },
      }, { now: NOW, sql: database.sql }),
      (error: unknown) => error instanceof KernelError && error.code === "KERNEL_NOT_FOUND",
    );

    await assert.rejects(
      publishAgentVersion(CREATOR_ID, draft.versionId, {
        idempotencyKey: "publish-missing-01",
        now: NOW,
        sql: database.sql,
      }),
      (error: unknown) => error instanceof KernelError && error.code === "KERNEL_ENS_AUTHORITY_REQUIRED",
    );
    const refused = await listAgentLifecycle(CREATOR_ID, { sql: database.sql });
    assert.equal(refused.drafts[0]?.canonicalState, "REFUSED");
    assert.equal(refused.drafts[0]?.refusalReason, "ENS_PUBLICATION_NOT_CONFIGURED");

    const fixture = await publicationAuthority(database, draft.versionId);
    const published = await publishAgentVersion(CREATOR_ID, draft.versionId, {
      authority: fixture.authority,
      idempotencyKey: "publish-research-01",
      now: NOW,
      sql: database.sql,
    });
    await fixture.close();
    assert.equal(published.lifecycleState, "PUBLISHED");
    assert.equal(published.hireable, true);
    assert.equal(published.fullSubname, "research.creator.eth");
    assert.equal(published.authorityOwner, CREATOR_WALLET);
    assert.equal(published.authorityPolicyVersion, "ens-publication-v1");
    assert.equal(published.authorityReleaseSha, RELEASE_SHA);
    assert.match(published.publicationDecisionId, /^[0-9a-f-]{36}$/);

    const publicView = await listAgentLifecycle(BUYER_ID, { sql: database.sql });
    assert.equal(publicView.agents.length, 1);
    assert.equal(publicView.drafts.length, 0);
    assert.doesNotMatch(JSON.stringify(publicView), /recordBytes|roles|ccip|transactionHash/i);
    await assert.rejects(
      bindAgentName(CREATOR_ID, draft.versionId, binding, {
        idempotencyKey: "bind-published-01",
        now: NOW,
        sql: database.sql,
      }),
      (error: unknown) => error instanceof KernelError && error.code === "KERNEL_IMMUTABLE_VERSION",
    );
    await assert.rejects(
      database.sql`UPDATE agent_versions SET price_atomic = 2000 WHERE id = ${draft.versionId}::uuid`,
      /published agent versions are immutable/,
    );

    const nextDraft = await createAgentDraft(
      { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
      manifest(),
      {
        agentId: draft.agentId,
        idempotencyKey: "draft-research-v2",
        now: NOW,
        sql: database.sql,
      },
    );
    assert.equal(nextDraft.version, 2);
    assert.notEqual(nextDraft.versionId, draft.versionId);
    assert.equal((await listAgentLifecycle(BUYER_ID, { sql: database.sql })).agents[0]?.version, 1);
  });

  await t.test("A4 transfer role resolver staleness and version substitution refuse before effects", async () => {
    const { draft } = await preparedVersion(
      database,
      "Protected Refusal Agent",
      "refusal",
    );
    const deniedFixture = await publicationAuthority(database, draft.versionId, {
      mutator: () => ({ malformed: true }),
    });
    await assert.rejects(
      publishAgentVersion(CREATOR_ID, draft.versionId, {
        authority: deniedFixture.authority,
        idempotencyKey: "publish-refusal-01",
        now: NOW,
        sql: database.sql,
      }),
      (error: unknown) => error instanceof KernelError && error.code === "KERNEL_ENS_AUTHORITY_DENIED",
    );
    await deniedFixture.close();

    const { draft: otherDraft } = await preparedVersion(
      database,
      "Protected Substitute Agent",
      "substitute",
    );
    const otherFixture = await publicationAuthority(database, otherDraft.versionId);
    const otherDecision = await otherFixture.authority({ agentVersionId: otherDraft.versionId });
    assert.equal(otherDecision.allowed, true);
    await assert.rejects(
      publishAgentVersion(CREATOR_ID, draft.versionId, {
        authority: async () => otherDecision,
        idempotencyKey: "publish-substitute-01",
        now: NOW,
        sql: database.sql,
      }),
      (error: unknown) => error instanceof KernelError && error.code === "KERNEL_ENS_AUTHORITY_DENIED",
    );
    await otherFixture.close();
    await assert.rejects(
      prepareAgentEnsWrite(OTHER_ID, draft.versionId, {
        idempotencyKey: "prepare-cross-user-01",
        now: NOW,
        sql: database.sql,
      }),
      (error: unknown) => error instanceof KernelError && error.code === "KERNEL_NOT_FOUND",
    );
    const counts = await database.sql<{ jobs: string; effects: string }[]>`
      SELECT
        (SELECT count(*)::text FROM jobs WHERE agent_version_id = ${draft.versionId}::uuid) AS jobs,
        (SELECT count(*)::text FROM effects e JOIN jobs j ON j.id = e.job_id
          WHERE j.agent_version_id = ${draft.versionId}::uuid) AS effects
    `;
    assert.deepEqual(counts[0], { jobs: "0", effects: "0" });
  });

  await t.test("production composition removal fails closed with zero authority or effect", async () => {
    const { draft } = await preparedVersion(
      database,
      "Production Composition Removal Agent",
      "composition-removal",
    );
    const previousRestrictedUrl = process.env.ENS_PUBLICATION_DATABASE_URL;
    delete process.env.ENS_PUBLICATION_DATABASE_URL;
    try {
      const authority = createProductionEnsPublicationAuthority();
      const decision = await authority({ agentVersionId: draft.versionId });
      assert.deepEqual(decision, {
        allowed: false,
        decisionId: null,
        errorCode: "ENS_PUBLICATION_NOT_CONFIGURED",
      });
      await assert.rejects(
        publishAgentVersion(CREATOR_ID, draft.versionId, {
          authority,
          idempotencyKey: "publish-composition-removal-01",
          now: NOW,
          sql: database.sql,
        }),
        (error: unknown) => error instanceof KernelError && error.code === "KERNEL_ENS_AUTHORITY_REQUIRED",
      );
    } finally {
      if (previousRestrictedUrl === undefined) {
        delete process.env.ENS_PUBLICATION_DATABASE_URL;
      } else {
        process.env.ENS_PUBLICATION_DATABASE_URL = previousRestrictedUrl;
      }
    }
    const rows = await database.sql<{
      decisions: number;
      effects: number;
      jobs: number;
      publish_actions: number;
      publish_events: number;
      refusal_events: number;
      publication_decision_id: string | null;
      published: boolean;
    }[]>`
      SELECT
        v.published,
        v.publication_decision_id::text,
        (SELECT count(*)::int FROM ens_publication_decisions d
          WHERE d.agent_version_id = v.id) AS decisions,
        (SELECT count(*)::int FROM agent_version_events e
          WHERE e.agent_version_id = v.id AND e.action = 'PUBLISH_VERSION') AS publish_events,
        (SELECT count(*)::int FROM agent_version_events e
          WHERE e.agent_version_id = v.id AND e.action = 'PUBLISH_REFUSED') AS refusal_events,
        (SELECT count(*)::int FROM agent_lifecycle_actions a
          WHERE a.agent_version_id = v.id AND a.action = 'PUBLISH_VERSION') AS publish_actions,
        (SELECT count(*)::int FROM jobs j WHERE j.agent_version_id = v.id) AS jobs,
        (SELECT count(*)::int FROM effects e JOIN jobs j ON j.id = e.job_id
          WHERE j.agent_version_id = v.id) AS effects
      FROM agent_versions v WHERE v.id = ${draft.versionId}::uuid
    `;
    assert.deepEqual(rows[0], {
      decisions: 0,
      effects: 0,
      jobs: 0,
      publish_actions: 1,
      publish_events: 0,
      refusal_events: 1,
      publication_decision_id: null,
      published: false,
    });
  });

  await t.test("all lifecycle actions converge under twenty durable idempotent replays", async () => {
    const create = () => createAgentDraft(
      { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
      manifest("Concurrent Lifecycle Agent"),
      {
        idempotencyKey: "lifecycle-create-20",
        now: NOW,
        sql: database.sql,
      },
    );
    const drafts = await Promise.all(Array.from({ length: 20 }, create));
    assert.equal(new Set(drafts.map((entry) => entry.versionId)).size, 1);
    const draft = drafts[0];
    assert.ok(draft);
    await assert.rejects(
      createAgentDraft(
        { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
        manifest("Mismatched Lifecycle Agent"),
        {
          idempotencyKey: "lifecycle-create-20",
          now: NOW,
          sql: database.sql,
        },
      ),
      (error: unknown) => error instanceof KernelError && error.code === "KERNEL_IDEMPOTENCY_MISMATCH",
    );

    const binding = parseEnsBinding({ creatorParent: "creator.eth", agentLabel: "concurrent" });
    const binds = await Promise.all(Array.from({ length: 20 }, () => bindAgentName(
      CREATOR_ID,
      draft.versionId,
      binding,
      { idempotencyKey: "lifecycle-bind-20", now: NOW, sql: database.sql },
    )));
    assert.equal(new Set(binds.map((entry) => entry.versionId)).size, 1);
    const preparations = await Promise.all(Array.from({ length: 20 }, () => prepareAgentEnsWrite(
      CREATOR_ID,
      draft.versionId,
      { idempotencyKey: "lifecycle-prepare-20", now: NOW, sql: database.sql },
    )));
    assert.equal(new Set(preparations.map((entry) => entry.planHash)).size, 1);

    const createReplay = await create();
    assert.deepEqual(createReplay, draft);
    const bindReplay = await bindAgentName(CREATOR_ID, draft.versionId, binding, {
      idempotencyKey: "lifecycle-bind-20",
      now: NOW,
      sql: database.sql,
    });
    assert.deepEqual(bindReplay, binds[0]);
    const prepareReplay = await prepareAgentEnsWrite(CREATOR_ID, draft.versionId, {
      idempotencyKey: "lifecycle-prepare-20",
      now: NOW,
      sql: database.sql,
    });
    assert.deepEqual(prepareReplay, preparations[0]);

    const fixture = await publicationAuthority(database, draft.versionId);
    const publications = await Promise.all(Array.from({ length: 20 }, () => publishAgentVersion(
      CREATOR_ID,
      draft.versionId,
      {
        authority: fixture.authority,
        idempotencyKey: "lifecycle-publish-20",
        now: NOW,
        sql: database.sql,
      },
    )));
    assert.equal(new Set(publications.map((entry) => entry.publicationDecisionId)).size, 1);
    assert.equal(fixture.resolverCalls(), 1);
    const resolverCalls = fixture.resolverCalls();
    const replay = await publishAgentVersion(CREATOR_ID, draft.versionId, {
      authority: fixture.authority,
      idempotencyKey: "lifecycle-publish-20",
      now: NOW,
      sql: database.sql,
    });
    assert.equal(replay.publicationDecisionId, publications[0]?.publicationDecisionId);
    assert.equal(fixture.resolverCalls(), resolverCalls);
    await fixture.close();

    const rows = await database.sql<{
      actions: number;
      decisions: number;
      events: number;
      versions: number;
    }[]>`
      SELECT
        (SELECT count(*)::int FROM agent_lifecycle_actions
          WHERE agent_version_id = ${draft.versionId}::uuid) AS actions,
        (SELECT count(*)::int FROM ens_publication_decisions
          WHERE agent_version_id = ${draft.versionId}::uuid) AS decisions,
        (SELECT count(*)::int FROM agent_version_events
          WHERE agent_version_id = ${draft.versionId}::uuid) AS events,
        (SELECT count(*)::int FROM agent_versions
          WHERE id = ${draft.versionId}::uuid) AS versions
    `;
    assert.deepEqual(rows[0], { actions: 4, decisions: 1, events: 4, versions: 1 });
  });

  await t.test("publication denial retry and expired-claim recovery remain single-effect", async () => {
    const denied = await preparedVersion(database, "Concurrent Denial Agent", "denial-concurrent");
    let denialCalls = 0;
    const denialAuthority: EnsPublicationAuthority = async () => {
      denialCalls += 1;
      await delay(30);
      return {
        allowed: false,
        decisionId: null,
        errorCode: "ENS_PUBLICATION_RECORD_INVALID",
      };
    };
    const denials = await Promise.allSettled(Array.from({ length: 20 }, () => publishAgentVersion(
      CREATOR_ID,
      denied.draft.versionId,
      {
        authority: denialAuthority,
        idempotencyKey: "publish-denial-concurrent-20",
        now: NOW,
        sql: database.sql,
      },
    )));
    assert.equal(denialCalls, 1);
    assert.equal(denials.every((entry) =>
      entry.status === "rejected" && entry.reason instanceof KernelError &&
      entry.reason.code === "KERNEL_ENS_AUTHORITY_DENIED"), true);
    const deniedRows = await database.sql<{
      attempt: number;
      denial_events: number;
      effects: number;
      jobs: number;
      status: string;
    }[]>`
      SELECT a.status, a.attempt,
        (SELECT count(*)::int FROM agent_version_events e
          WHERE e.lifecycle_action_id = a.id AND e.action = 'PUBLISH_REFUSED') AS denial_events,
        (SELECT count(*)::int FROM jobs j
          WHERE j.agent_version_id = ${denied.draft.versionId}::uuid) AS jobs,
        (SELECT count(*)::int FROM effects e JOIN jobs j ON j.id = e.job_id
          WHERE j.agent_version_id = ${denied.draft.versionId}::uuid) AS effects
      FROM agent_lifecycle_actions a
      WHERE a.owner_user_id = ${CREATOR_ID} AND a.action = 'PUBLISH_VERSION'
        AND a.idempotency_key = 'publish-denial-concurrent-20'
    `;
    assert.deepEqual(deniedRows[0], {
      attempt: 1,
      denial_events: 1,
      effects: 0,
      jobs: 0,
      status: "DENIED",
    });

    const retry = await preparedVersion(database, "Retryable Publication Agent", "retryable");
    let failedCalls = 0;
    await assert.rejects(
      publishAgentVersion(CREATOR_ID, retry.draft.versionId, {
        authority: async () => {
          failedCalls += 1;
          throw new Error("resolver unavailable");
        },
        idempotencyKey: "publish-retryable-recovery-01",
        now: NOW,
        sql: database.sql,
      }),
      (error: unknown) => error instanceof KernelError && error.status === 503,
    );
    assert.equal(failedCalls, 1);
    await delay(150);
    const retryFixture = await publicationAuthority(database, retry.draft.versionId);
    const recovered = await publishAgentVersion(CREATOR_ID, retry.draft.versionId, {
      authority: retryFixture.authority,
      idempotencyKey: "publish-retryable-recovery-01",
      now: NOW,
      sql: database.sql,
    });
    assert.equal(recovered.lifecycleState, "PUBLISHED");
    assert.equal(retryFixture.resolverCalls(), 1);
    await retryFixture.close();
    const retryRows = await database.sql<{ attempt: number; events: number; status: string }[]>`
      SELECT a.status, a.attempt,
        (SELECT count(*)::int FROM agent_version_events e
          WHERE e.lifecycle_action_id = a.id) AS events
      FROM agent_lifecycle_actions a
      WHERE a.owner_user_id = ${CREATOR_ID} AND a.action = 'PUBLISH_VERSION'
        AND a.idempotency_key = 'publish-retryable-recovery-01'
    `;
    assert.deepEqual(retryRows[0], { attempt: 2, events: 1, status: "SUCCEEDED" });

    const crash = await preparedVersion(database, "Expired Claim Agent", "expired-claim");
    const crashActionId = randomUUID();
    await database.sql`
      INSERT INTO agent_lifecycle_actions (
        id, owner_user_id, action, idempotency_key, payload_hash,
        target_agent_version_id, status, attempt, lease_token, lease_expires_at,
        created_at, updated_at
      ) VALUES (
        ${crashActionId}::uuid, ${CREATOR_ID}, 'PUBLISH_VERSION',
        'publish-expired-claim-01',
        ${domainHash("agent-lifecycle-action", {
          action: "PUBLISH_VERSION",
          ownerUserId: CREATOR_ID,
          payload: { versionId: crash.draft.versionId },
        })}, ${crash.draft.versionId}::uuid, 'PENDING', 1, ${randomUUID()}::uuid,
        clock_timestamp() + interval '120 milliseconds', clock_timestamp(), clock_timestamp()
      )
    `;
    await delay(160);
    const crashFixture = await publicationAuthority(database, crash.draft.versionId);
    const crashRecovered = await publishAgentVersion(CREATOR_ID, crash.draft.versionId, {
      authority: crashFixture.authority,
      idempotencyKey: "publish-expired-claim-01",
      now: NOW,
      sql: database.sql,
    });
    assert.equal(crashRecovered.lifecycleState, "PUBLISHED");
    assert.equal(crashFixture.resolverCalls(), 1);
    await crashFixture.close();
    const crashRows = await database.sql<{ attempt: number; status: string }[]>`
      SELECT attempt, status FROM agent_lifecycle_actions WHERE id = ${crashActionId}::uuid
    `;
    assert.deepEqual(crashRows[0], { attempt: 2, status: "SUCCEEDED" });
  });

  await t.test("publication state-only event-only and other-version decision bypasses fail", async () => {
    const { draft } = await preparedVersion(database, "Direct SQL Agent", "direct-sql");
    const fixture = await publicationAuthority(database, draft.versionId);
    const allowed = await fixture.authority({ agentVersionId: draft.versionId });
    assert.equal(allowed.allowed, true);
    assert.ok(allowed.decisionId);
    const decision = await database.sql<{
      owner: string;
      delegate: string;
      policy_version: string;
      record_hash: string;
      observed_at: Date;
      fresh_until: Date;
      release_sha: string;
    }[]>`
      SELECT owner, delegate, policy_version, record_hash, observed_at, fresh_until, release_sha
      FROM ens_publication_decisions WHERE id = ${allowed.decisionId}::uuid
    `;
    const evidence = decision[0];
    assert.ok(evidence);
    await assert.rejects(
      database.sql.begin(async (tx) => {
        const sql = tx as unknown as DisposableDatabase["sql"];
        await sql`
          UPDATE agent_versions
          SET lifecycle_state = 'PUBLISHED', published = true, published_at = clock_timestamp(),
              canonical_state = 'CANONICAL', authority_owner = ${evidence.owner},
              authority_delegate = ${evidence.delegate},
              authority_policy_version = ${evidence.policy_version}, authority_refusal = NULL,
              authority_record_hash = ${evidence.record_hash},
              authority_observed_at = ${evidence.observed_at},
              authority_fresh_until = ${evidence.fresh_until},
              authority_release_sha = ${evidence.release_sha},
              publication_decision_id = ${allowed.decisionId}::uuid
          WHERE id = ${draft.versionId}::uuid
        `;
      }),
      /publication_action_state_check/,
    );
    await assert.rejects(
      database.sql.begin(async (tx) => {
        const sql = tx as unknown as DisposableDatabase["sql"];
        await sql`
          INSERT INTO agent_version_events (agent_version_id, sequence, action, payload, created_at)
          SELECT ${draft.versionId}::uuid, COALESCE(max(sequence), -1) + 1,
            'PUBLISH_VERSION', '{}'::jsonb, clock_timestamp()
          FROM agent_version_events WHERE agent_version_id = ${draft.versionId}::uuid
        `;
      }),
      /null value in column "lifecycle_action_id"/,
    );

    const actionId = randomUUID();
    const leaseToken = randomUUID();
    const actionSnapshot = {
      schemaVersion: 1,
      action: "PUBLISH_VERSION",
      outcome: "SUCCESS",
      value: {
        ...draft,
        lifecycleState: "PUBLISHED",
        hireable: true,
        canonicalState: "CANONICAL",
      },
    } as const;
    const actionHash = domainHash(
      "agent-lifecycle-result",
      actionSnapshot as unknown as CanonicalValue,
    );
    await assert.rejects(
      database.sql.begin(async (tx) => {
        const sql = tx as unknown as DisposableDatabase["sql"];
        await sql`
          INSERT INTO agent_lifecycle_actions (
            id, owner_user_id, action, idempotency_key, payload_hash,
            target_agent_version_id, status, attempt, lease_token, lease_expires_at,
            created_at, updated_at
          ) VALUES (
            ${actionId}::uuid, ${CREATOR_ID}, 'PUBLISH_VERSION', 'action-only-direct-01',
            ${domainHash("agent-lifecycle-action", {
              action: "PUBLISH_VERSION",
              ownerUserId: CREATOR_ID,
              payload: { versionId: draft.versionId },
            })}, ${draft.versionId}::uuid,
            'PENDING', 1, ${leaseToken}::uuid, clock_timestamp() + interval '30 seconds',
            clock_timestamp(), clock_timestamp()
          )
        `;
        await sql`
          UPDATE agent_lifecycle_actions
          SET status = 'SUCCEEDED', agent_version_id = ${draft.versionId}::uuid,
              lease_token = NULL, lease_expires_at = NULL,
              result_snapshot = ${sql.json(JSON.parse(JSON.stringify(actionSnapshot)))},
              result_hash = ${actionHash},
              completed_at = clock_timestamp(), updated_at = clock_timestamp()
          WHERE id = ${actionId}::uuid
        `;
      }),
      /completed lifecycle action requires one matching event/,
    );
    await fixture.close();
  });

  await t.test("deferred publication integrity rejects a decision that expires before commit", async () => {
    const { draft, prepared } = await preparedVersion(
      database,
      "Commit Freshness Agent",
      "commit-freshness",
    );
    const fixture = await publicationAuthority(database, draft.versionId, {
      mutator: (response) => {
        const observation = response.observation;
        const record = response.record;
        const observationRecord = observation && typeof observation === "object" && !Array.isArray(observation)
          ? observation as Record<string, unknown>
          : null;
        const authorityRecord = record && typeof record === "object" && !Array.isArray(record)
          ? record as Record<string, unknown>
          : null;
        if (
          !observationRecord || !authorityRecord ||
          typeof observationRecord.blockTimestamp !== "string"
        ) {
          return { malformed: true };
        }
        authorityRecord.freshUntil = new Date(
          new Date(observationRecord.blockTimestamp as string).getTime() + 2_000,
        ).toISOString();
        return response;
      },
    });
    const allowed = await fixture.authority({ agentVersionId: draft.versionId });
    assert.equal(allowed.allowed, true);
    assert.ok(allowed.decisionId);
    const evidenceRows = await database.sql<{
      delegate: string;
      observed_at: Date;
      owner: string;
      policy_version: string;
      record_hash: string;
      release_sha: string;
      fresh_until: Date;
    }[]>`
      SELECT delegate, observed_at, owner, policy_version, record_hash, release_sha, fresh_until
      FROM ens_publication_decisions WHERE id = ${allowed.decisionId}::uuid
    `;
    const evidence = evidenceRows[0];
    assert.ok(evidence);
    const actionId = randomUUID();
    const leaseToken = randomUUID();
    const publishedAt = new Date();
    const resultSnapshot = {
      schemaVersion: 1,
      action: "PUBLISH_VERSION",
      outcome: "SUCCESS",
      value: {
        ...prepared.version,
        lifecycleState: "PUBLISHED",
        hireable: true,
        canonicalState: "CANONICAL",
        authorityOwner: evidence.owner,
        authorityDelegate: evidence.delegate,
        authorityPolicyVersion: evidence.policy_version,
        refusalReason: null,
        authorityReleaseSha: evidence.release_sha,
        publicationDecisionId: allowed.decisionId,
        publishedAt: publishedAt.toISOString(),
      },
    } as const;
    const resultHash = domainHash(
      "agent-lifecycle-result",
      resultSnapshot as unknown as CanonicalValue,
    );
    await database.sql`
      INSERT INTO agent_lifecycle_actions (
        id, owner_user_id, action, idempotency_key, payload_hash,
        target_agent_version_id, status, attempt, lease_token, lease_expires_at,
        created_at, updated_at
      ) VALUES (
        ${actionId}::uuid, ${CREATOR_ID}, 'PUBLISH_VERSION', 'commit-freshness-action-01',
        ${domainHash("agent-lifecycle-action", {
          action: "PUBLISH_VERSION",
          ownerUserId: CREATOR_ID,
          payload: { versionId: draft.versionId },
        })}, ${draft.versionId}::uuid, 'PENDING', 1, ${leaseToken}::uuid,
        clock_timestamp() + interval '30 seconds', clock_timestamp(), clock_timestamp()
      )
    `;
    await assert.rejects(
      database.sql.begin(async (tx) => {
        const sql = tx as unknown as DisposableDatabase["sql"];
        await sql`
          UPDATE agent_versions v
          SET lifecycle_state = 'PUBLISHED', published = true,
              canonical_state = 'CANONICAL',
              authority_owner = d.owner, authority_delegate = d.delegate,
              authority_policy_version = d.policy_version, authority_refusal = NULL,
              authority_record_hash = d.record_hash,
              authority_observed_at = d.observed_at,
              authority_fresh_until = d.fresh_until,
              authority_release_sha = d.release_sha,
              publication_decision_id = d.id,
              publication_action_id = ${actionId}::uuid,
              published_at = ${publishedAt}
          FROM ens_publication_decisions d
          WHERE v.id = ${draft.versionId}::uuid AND d.id = ${allowed.decisionId}::uuid
        `;
        await sql`
          INSERT INTO agent_version_events (
            agent_version_id, sequence, action, payload, lifecycle_action_id, created_at
          )
          SELECT ${draft.versionId}::uuid, COALESCE(max(e.sequence), -1) + 1,
            'PUBLISH_VERSION', ${sql.json({
              lifecycleActionId: actionId,
              manifestHash: draft.manifestHash,
              policyVersion: evidence.policy_version,
              publicationDecisionId: allowed.decisionId,
              recordHash: evidence.record_hash,
              releaseSha: evidence.release_sha,
              resultHash,
            })}, ${actionId}::uuid, ${publishedAt}
          FROM agent_version_events e WHERE e.agent_version_id = ${draft.versionId}::uuid
        `;
        await sql`
          UPDATE agent_lifecycle_actions
          SET status = 'SUCCEEDED', agent_version_id = ${draft.versionId}::uuid,
              lease_token = NULL, lease_expires_at = NULL,
              result_snapshot = ${sql.json(JSON.parse(JSON.stringify(resultSnapshot)))},
              result_hash = ${resultHash},
              completed_at = clock_timestamp(), updated_at = clock_timestamp()
          WHERE id = ${actionId}::uuid
        `;
        await sql`SELECT pg_sleep(2.2)`;
      }),
      /fresh exact accepted A4 decision/,
    );
    await fixture.close();
    const rows = await database.sql<{
      effects: number;
      jobs: number;
      publish_events: number;
      publication_decision_id: string | null;
      published: boolean;
    }[]>`
      SELECT
        v.published,
        v.publication_decision_id::text,
        (SELECT count(*)::int FROM agent_version_events e
          WHERE e.agent_version_id = v.id AND e.action = 'PUBLISH_VERSION') AS publish_events,
        (SELECT count(*)::int FROM jobs j WHERE j.agent_version_id = v.id) AS jobs,
        (SELECT count(*)::int FROM effects e JOIN jobs j ON j.id = e.job_id
          WHERE j.agent_version_id = v.id) AS effects
      FROM agent_versions v WHERE v.id = ${draft.versionId}::uuid
    `;
    assert.deepEqual(rows[0], {
      effects: 0,
      jobs: 0,
      publish_events: 0,
      publication_decision_id: null,
      published: false,
    });
  });

  await t.test("agent route rejects content type malformed and oversized JSON before auth or mutation", async () => {
    const before = await database.sql<{ actions: number }[]>`
      SELECT count(*)::int AS actions FROM agent_lifecycle_actions
    `;
    const requests = [
      new Request("http://localhost/api/kernel/agents", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "{}",
      }),
      new Request("http://localhost/api/kernel/agents", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "9000",
          "idempotency-key": "route-boundary-01",
        },
        body: "{}",
      }),
      new Request("http://localhost/api/kernel/agents", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "route-boundary-02",
        },
        body: "x".repeat(9_000),
      }),
      new Request("http://localhost/api/kernel/agents", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "route-boundary-03",
        },
        body: "{",
      }),
    ];
    const responses = await Promise.all(requests.map((request) => postAgentAction(request)));
    assert.deepEqual(responses.map((response) => response.status), [415, 413, 413, 400]);
    for (const response of responses) {
      assert.ok((await response.text()).length < 256);
    }
    const after = await database.sql<{ actions: number }[]>`
      SELECT count(*)::int AS actions FROM agent_lifecycle_actions
    `;
    assert.deepEqual(after, before);
  });

  await t.test("bounded JSON reader preserves 413 and maps hostile streams to bounded 400", async () => {
    const encoder = new TextEncoder();
    const exactBody = JSON.stringify({ x: "a".repeat(8_184) });
    assert.equal(encoder.encode(exactBody).byteLength, 8_192);
    const exact = new Request("http://localhost", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: exactBody,
    });
    assert.deepEqual(await readBoundedKernelJson(exact), { x: "a".repeat(8_184) });

    const rejectingCancel = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(8_193));
      },
      cancel() {
        return Promise.reject(new Error("cancel rejected"));
      },
    });
    await assert.rejects(
      readBoundedKernelJson(new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: rejectingCancel,
        duplex: "half",
      } as RequestInit & { duplex: "half" })),
      (error: unknown) => error instanceof KernelError && error.status === 413,
    );

    for (const stream of [
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error("read failed"));
        },
      }),
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(Uint8Array.from([0xc3, 0x28]));
          controller.close();
        },
      }),
    ]) {
      await assert.rejects(
        readBoundedKernelJson(new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: stream,
          duplex: "half",
        } as RequestInit & { duplex: "half" })),
        (error: unknown) => error instanceof KernelError && error.status === 400,
      );
    }
  });

  await t.test("protected external hire rejects self and twenty submissions keep one effect", async () => {
    const { draft } = await preparedVersion(
      database,
      "Protected Hire Agent",
      "hire",
    );
    const fixture = await publicationAuthority(database, draft.versionId);
    const published = await publishAgentVersion(CREATOR_ID, draft.versionId, {
      authority: fixture.authority,
      idempotencyKey: "publish-hire-01",
      now: NOW,
      sql: database.sql,
    });
    await fixture.close();
    await assert.rejects(
      submitJob(CREATOR_ID, {
        agentVersionId: published.versionId,
        idempotencyKey: "self-hire-refused",
        task: { prompt: "Creator must not hire this version." },
      }, { now: NOW, sql: database.sql }),
      (error: unknown) => error instanceof KernelError && error.code === "KERNEL_FORBIDDEN",
    );
    const submissions = await Promise.all(Array.from({ length: 20 }, () => submitJob(BUYER_ID, {
      agentVersionId: published.versionId,
      idempotencyKey: "protected-twenty-submit",
      task: { prompt: "One immutable protected effect." },
    }, { now: NOW, sql: database.sql })));
    assert.equal(new Set(submissions.map((entry) => entry.effectId)).size, 1);
    assert.equal(submissions.filter((entry) => !entry.replayed).length, 1);
    const first = submissions[0];
    if (!first) throw new Error("TEST_SUBMISSION_MISSING");
    const counts = await database.sql<{ jobs: string; effects: string }[]>`
      SELECT
        (SELECT count(*)::text FROM jobs WHERE id = ${first.jobId}::uuid) AS jobs,
        (SELECT count(*)::text FROM effects WHERE id = ${first.effectId}) AS effects
    `;
    assert.deepEqual(counts[0], { jobs: "1", effects: "1" });
    const canceled = await cancelBuyerJob(BUYER_ID, first.jobId, { now: NOW, sql: database.sql });
    assert.equal(canceled.state, "CANCELED");
  });
}
