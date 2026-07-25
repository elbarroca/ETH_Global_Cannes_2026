import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import { KernelError } from "../../src/kernel/errors";
import {
  bindAgentName,
  createAgentDraft,
  listAgentLifecycle,
  prepareAgentEnsWrite,
  publishAgentVersion,
} from "../../src/kernel/lifecycle";
import { parseAgentAction, parseAgentInput, parseEnsBinding } from "../../src/kernel/policy";
import { cancelBuyerJob, submitJob } from "../../src/kernel/service";
import type { A4PublicationAuthority, A4PublicationReadback } from "../../src/kernel/types";
import type { DisposableDatabase } from "../helpers/postgres";

const CREATOR_ID = "lifecycle-creator";
const BUYER_ID = "lifecycle-buyer";
const OTHER_ID = "lifecycle-other";
const CREATOR_WALLET = "0x6666666666666666666666666666666666666666";
const BUYER_WALLET = "0x4444444444444444444444444444444444444444";
const OTHER_WALLET = "0x5555555555555555555555555555555555555555";
const NOW = new Date("2026-07-25T02:00:00.000Z");
const RELEASE_SHA = "b41f3ed522670db020c4a2dba0402584dca803dc";

class FixtureA4Authority implements A4PublicationAuthority {
  readonly requests: Array<{
    agentVersionId: string;
    manifestHash: string;
    fullSubname: string;
  }> = [];
  denialCode: string | null = null;
  mutate: ((readback: A4PublicationReadback) => unknown) | null = null;

  async verify(
    request: Parameters<A4PublicationAuthority["verify"]>[0],
  ): Promise<unknown> {
    this.requests.push({
      agentVersionId: request.agentVersionId,
      manifestHash: request.manifestHash,
      fullSubname: request.binding.fullSubname,
    });
    const readback: A4PublicationReadback = {
      allowed: this.denialCode === null,
      errorCode: this.denialCode,
      agentVersionId: request.agentVersionId,
      manifestHash: request.manifestHash,
      creatorParent: request.binding.creatorParent,
      agentLabel: request.binding.agentLabel,
      fullSubname: request.binding.fullSubname,
      canonical: this.denialCode === null,
      owner: CREATOR_WALLET,
      delegate: null,
      policyVersion: "ensv2-local-v1",
      recordHash: "a".repeat(64),
      observedAt: NOW.toISOString(),
      freshUntil: new Date(NOW.getTime() + 60_000).toISOString(),
      releaseSha: RELEASE_SHA,
    };
    return this.mutate?.(readback) ?? readback;
  }
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
    { now: NOW, sql: database.sql },
  );
  const binding = parseEnsBinding({ creatorParent: "creator.eth", agentLabel });
  const bound = await bindAgentName(CREATOR_ID, draft.versionId, binding, {
    now: NOW,
    sql: database.sql,
  });
  const prepared = await prepareAgentEnsWrite(CREATOR_ID, draft.versionId, {
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
      publishAgentVersion(CREATOR_ID, draft.versionId, { now: NOW, sql: database.sql }),
      (error: unknown) => error instanceof KernelError && error.code === "KERNEL_ENS_AUTHORITY_REQUIRED",
    );
    const refused = await listAgentLifecycle(CREATOR_ID, { sql: database.sql });
    assert.equal(refused.drafts[0]?.canonicalState, "REFUSED");
    assert.equal(refused.drafts[0]?.refusalReason, "ENS_AUTHORITY_NOT_CONFIGURED");

    const authority = new FixtureA4Authority();
    const published = await publishAgentVersion(CREATOR_ID, draft.versionId, {
      authority,
      now: NOW,
      sql: database.sql,
    });
    assert.equal(published.lifecycleState, "PUBLISHED");
    assert.equal(published.hireable, true);
    assert.equal(published.fullSubname, "research.creator.eth");
    assert.equal(published.authorityOwner, CREATOR_WALLET);
    assert.equal(published.authorityPolicyVersion, "ensv2-local-v1");
    assert.equal(published.authorityReleaseSha, RELEASE_SHA);
    assert.deepEqual(authority.requests, [{
      agentVersionId: draft.versionId,
      manifestHash: prepared.version.manifestHash,
      fullSubname: "research.creator.eth",
    }]);

    const publicView = await listAgentLifecycle(BUYER_ID, { sql: database.sql });
    assert.equal(publicView.agents.length, 1);
    assert.equal(publicView.drafts.length, 0);
    assert.doesNotMatch(JSON.stringify(publicView), /recordBytes|roles|ccip|transactionHash/i);
    await assert.rejects(
      bindAgentName(CREATOR_ID, draft.versionId, binding, { now: NOW, sql: database.sql }),
      (error: unknown) => error instanceof KernelError && error.code === "KERNEL_IMMUTABLE_VERSION",
    );
    await assert.rejects(
      database.sql`UPDATE agent_versions SET price_atomic = 2000 WHERE id = ${draft.versionId}::uuid`,
      /published agent versions are immutable/,
    );

    const nextDraft = await createAgentDraft(
      { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
      manifest(),
      { agentId: draft.agentId, now: NOW, sql: database.sql },
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
    const authority = new FixtureA4Authority();
    for (const code of [
      "ENS_AUTHORITY_OWNER_MISMATCH",
      "ENS_AUTHORITY_ROLE_MISMATCH",
      "ENS_AUTHORITY_RESOLVER_POLICY_MISMATCH",
      "ENS_AUTHORITY_STALE",
    ]) {
      authority.denialCode = code;
      await assert.rejects(
        publishAgentVersion(CREATOR_ID, draft.versionId, {
          authority,
          now: NOW,
          sql: database.sql,
        }),
        (error: unknown) => error instanceof KernelError && error.code === "KERNEL_ENS_AUTHORITY_DENIED",
      );
    }
    authority.denialCode = null;
    authority.mutate = (readback) => ({ ...readback, agentVersionId: "55555555-5555-4555-8555-555555555555" });
    await assert.rejects(
      publishAgentVersion(CREATOR_ID, draft.versionId, {
        authority,
        now: NOW,
        sql: database.sql,
      }),
      (error: unknown) => error instanceof KernelError && error.code === "KERNEL_ENS_AUTHORITY_DENIED",
    );
    await assert.rejects(
      prepareAgentEnsWrite(OTHER_ID, draft.versionId, { now: NOW, sql: database.sql }),
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

  await t.test("protected external hire rejects self and twenty submissions keep one effect", async () => {
    const { draft } = await preparedVersion(
      database,
      "Protected Hire Agent",
      "hire",
    );
    const published = await publishAgentVersion(CREATOR_ID, draft.versionId, {
      authority: new FixtureA4Authority(),
      now: NOW,
      sql: database.sql,
    });
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
