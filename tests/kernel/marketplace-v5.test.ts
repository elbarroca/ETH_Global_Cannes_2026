import assert from "node:assert/strict";
import test from "node:test";
import { buildManifestV5 } from "../../src/kernel/agent-catalog";
import { domainHash } from "../../src/kernel/canonical";
import {
  claimHireRequestContext,
  completeHireRequestContext,
  createHireRequest,
  listHireRequests,
  processHireRequest,
  processPendingHireRequests,
} from "../../src/kernel/hire-requests";
import {
  bindAgentName,
  createAgentDraft,
  listAgentLifecycle,
  prepareAgentEnsWrite,
  publishAgentVersion,
} from "../../src/kernel/lifecycle";
import {
  collectMcpContext,
  type McpContextProvider,
} from "../../src/kernel/mcp-context";
import {
  parseAgentInput,
  parseAgentListFilters,
  parseEnsBinding,
  parseHireRequestInput,
} from "../../src/kernel/policy";
import { createOgSpendBudget, reserveOgSpend } from "../../src/kernel/service";
import { configureDatabaseEnvironment, startDisposableDatabase } from "../helpers/postgres";
import { publicationAuthority } from "./lifecycle.cases";

const CREATOR_ID = "v5-creator";
const BUYER_ID = "v5-buyer";
const OTHER_ID = "v5-other";
const CREATOR_WALLET = "0x1111111111111111111111111111111111111111";
const BUYER_WALLET = "0x2222222222222222222222222222222222222222";
const OTHER_WALLET = "0x3333333333333333333333333333333333333333";

class FixedProvider implements McpContextProvider {
  calls = 0;

  async invoke(binding: Parameters<McpContextProvider["invoke"]>[0]): Promise<unknown> {
    this.calls += 1;
    return { bindingId: binding.id, observed: true };
  }
}

test("V5 marketplace hires are idempotent, fenced, exclusive, and release-budgeted", async () => {
  const database = await startDisposableDatabase("marketplace-v5");
  configureDatabaseEnvironment(database.url);
  try {
    await database.sql`
      INSERT INTO users (id, wallet_address) VALUES
        (${CREATOR_ID}, ${CREATOR_WALLET}),
        (${BUYER_ID}, ${BUYER_WALLET}),
        (${OTHER_ID}, ${OTHER_WALLET})
    `;
    const manifest = buildManifestV5({
      templateId: "market-pulse",
      name: "V5 Market Pulse",
      description: "A deterministic protected V5 marketplace fixture.",
      ownerWallet: CREATOR_WALLET,
      riskTiers: ["LOW", "MID"],
    });
    const draft = await createAgentDraft(
      { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
      manifest,
      { idempotencyKey: "v5-real-draft-01", sql: database.sql },
    );
    const binding = parseEnsBinding({ creatorParent: "creator.eth", agentLabel: "v5-market" });
    await bindAgentName(CREATOR_ID, draft.versionId, binding, {
      idempotencyKey: "v5-real-bind-01",
      sql: database.sql,
    });
    await prepareAgentEnsWrite(CREATOR_ID, draft.versionId, {
      idempotencyKey: "v5-real-prepare-01",
      sql: database.sql,
    });
    const authority = await publicationAuthority(database, draft.versionId);
    const published = await publishAgentVersion(CREATOR_ID, draft.versionId, {
      authority: authority.authority,
      idempotencyKey: "v5-real-publish-01",
      sql: database.sql,
    });
    await authority.close();
    const versionId = published.versionId;

    const filters = parseAgentListFilters(new URL(
      "http://localhost/api/kernel/agents?capability=market-analysis&skill=persona.market-analyst&mcpProvider=coingecko&riskTier=LOW&limit=1",
    ));
    const listing = await listAgentLifecycle(BUYER_ID, { filters, sql: database.sql });
    assert.equal(listing.agents[0]?.versionId, versionId);
    assert.deepEqual(listing.drafts, []);
    assert.throws(() => parseAgentListFilters(new URL("http://localhost/api/kernel/agents?limit=0")));
    assert.throws(() => parseHireRequestInput({ agentVersionId: versionId, prompt: "x", buyerUserId: OTHER_ID }));

    await assert.rejects(createHireRequest(CREATOR_ID, {
      agentVersionId: versionId,
      idempotencyKey: "self-hire-v5-01",
      prompt: "Analyze this market.",
    }, { sql: database.sql }));
    const created = await createHireRequest(BUYER_ID, {
      agentVersionId: versionId,
      idempotencyKey: "buyer-hire-v5-01",
      prompt: "Analyze this market.",
    }, { sql: database.sql });
    assert.equal(created.state, "PENDING_CONTEXT");
    const replay = await createHireRequest(BUYER_ID, {
      agentVersionId: versionId,
      idempotencyKey: "buyer-hire-v5-01",
      prompt: "Analyze this market.",
    }, { sql: database.sql });
    assert.equal(replay.hireRequestId, created.hireRequestId);
    assert.equal(replay.replayed, true);
    await assert.rejects(createHireRequest(BUYER_ID, {
      agentVersionId: versionId,
      idempotencyKey: "buyer-hire-v5-01",
      prompt: "Different prompt.",
    }, { sql: database.sql }));
    assert.deepEqual(await listHireRequests(OTHER_ID, {
      hireRequestId: created.hireRequestId,
      sql: database.sql,
    }), []);

    await assert.rejects(database.sql`
      UPDATE hire_requests SET state = 'JOB_QUEUED', version = version + 1
      WHERE id = ${created.hireRequestId}::uuid
    `, /job_id|transition|queued hire request/);
    const provider = new FixedProvider();
    const expiresAt = new Date(Date.now() + 60_000);
    const completed = await processHireRequest({
      hireRequestId: created.hireRequestId,
      workerId: "v5-worker",
      workerEpoch: 1n,
      leaseExpiresAt: expiresAt,
      mcpProvider: provider,
      sql: database.sql,
    });
    assert.equal(completed?.state, "JOB_QUEUED");
    assert.ok(completed?.jobId);
    assert.equal(provider.calls, manifest.mcp.length);
    const retries = await Promise.all(Array.from({ length: 10 }, () => processHireRequest({
      hireRequestId: created.hireRequestId,
      workerId: "retry-worker",
      workerEpoch: 2n,
      leaseExpiresAt: new Date(Date.now() + 60_000),
      mcpProvider: provider,
      sql: database.sql,
    })));
    assert.ok(retries.every((entry) => entry?.jobId === completed.jobId));
    assert.equal(provider.calls, manifest.mcp.length);
    const jobCount = await database.sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM jobs WHERE id = ${completed.jobId}::uuid
    `;
    assert.equal(jobCount[0]?.count, 1);
    await assert.rejects(database.sql`
      UPDATE mcp_invocations SET hire_request_id = NULL
      WHERE hire_request_id = ${created.hireRequestId}::uuid
    `);

    const reclaimable = await createHireRequest(BUYER_ID, {
      agentVersionId: versionId,
      idempotencyKey: "buyer-hire-v5-reclaim-01",
      prompt: "Analyze a second market snapshot.",
    }, { sql: database.sql });
    const firstExpiry = new Date(Date.now() + 100);
    const firstClaim = await claimHireRequestContext({
      hireRequestId: reclaimable.hireRequestId,
      workerId: "stale-worker",
      workerEpoch: 1n,
      leaseExpiresAt: firstExpiry,
      sql: database.sql,
    });
    assert.equal(firstClaim?.claimVersion, 1);
    const callsBeforeStaleEvidence = provider.calls;
    await collectMcpContext({
      sql: database.sql,
      hireRequestId: reclaimable.hireRequestId,
      hireFence: {
        workerId: "stale-worker",
        workerEpoch: 1n,
        claimVersion: 1,
        claimExpiresAt: firstExpiry,
      },
      agentVersionId: versionId,
      manifestHash: published.manifestHash,
      bindings: manifest.mcp,
      objective: "Analyze a second market snapshot.",
      requiredCapabilities: manifest.capabilities,
      releaseSha: published.authorityReleaseSha ?? "",
      provider,
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    const reclaimed = await processHireRequest({
      hireRequestId: reclaimable.hireRequestId,
      workerId: "stale-worker",
      workerEpoch: 1n,
      leaseExpiresAt: new Date(Date.now() + 60_000),
      mcpProvider: provider,
      sql: database.sql,
    });
    assert.equal(reclaimed?.claimVersion, 2);
    assert.equal(reclaimed?.state, "JOB_QUEUED");
    assert.ok(reclaimed.jobId);
    assert.equal(provider.calls, callsBeforeStaleEvidence + manifest.mcp.length * 2);
    const invocationClaims = await database.sql<{ claim_version: number }[]>`
      SELECT hire_claim_version AS claim_version FROM mcp_invocations
      WHERE hire_request_id = ${reclaimable.hireRequestId}::uuid
      ORDER BY hire_claim_version, binding_id
    `;
    assert.deepEqual(
      invocationClaims.map((entry) => entry.claim_version),
      [...manifest.mcp.map(() => 1), ...manifest.mcp.map(() => 2)],
    );
    assert.equal(await completeHireRequestContext({
      hireRequestId: reclaimable.hireRequestId,
      workerId: "stale-worker",
      workerEpoch: 1n,
      claimVersion: 1,
      contextHash: null,
      jobId: reclaimed.jobId,
      sql: database.sql,
    }), null);

    const nonMcpManifest = parseAgentInput({
      name: "Non MCP Hire Agent",
      description: "A real lifecycle fixture without MCP bindings.",
      instructions: "## Task\n\nReturn one bounded evidence-backed answer.",
      capabilities: ["research"],
    }, CREATOR_WALLET).manifest;
    const nonMcpDraft = await createAgentDraft(
      { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
      nonMcpManifest,
      { idempotencyKey: "non-mcp-real-draft-01", sql: database.sql },
    );
    await bindAgentName(CREATOR_ID, nonMcpDraft.versionId, parseEnsBinding({
      creatorParent: "creator.eth",
      agentLabel: "non-mcp-hire",
    }), { idempotencyKey: "non-mcp-real-bind-01", sql: database.sql });
    await prepareAgentEnsWrite(CREATOR_ID, nonMcpDraft.versionId, {
      idempotencyKey: "non-mcp-real-prepare-01",
      sql: database.sql,
    });
    const nonMcpAuthority = await publicationAuthority(database, nonMcpDraft.versionId);
    const nonMcpPublished = await publishAgentVersion(CREATOR_ID, nonMcpDraft.versionId, {
      authority: nonMcpAuthority.authority,
      idempotencyKey: "non-mcp-real-publish-01",
      sql: database.sql,
    });
    await nonMcpAuthority.close();
    const nonMcpHire = await createHireRequest(BUYER_ID, {
      agentVersionId: nonMcpPublished.versionId,
      idempotencyKey: "non-mcp-hire-request-01",
      prompt: "Produce a bounded research answer.",
    }, { sql: database.sql });
    assert.equal(nonMcpHire.state, "PENDING_CONTEXT");
    assert.equal(nonMcpHire.jobId, null);
    assert.equal(await processPendingHireRequests({
      workerId: "non-mcp-worker",
      workerEpoch: 1n,
      leaseExpiresAt: new Date(Date.now() + 60_000),
      limit: 1,
      sql: database.sql,
    }), 1);
    const [nonMcpProcessed] = await listHireRequests(BUYER_ID, {
      hireRequestId: nonMcpHire.hireRequestId,
      sql: database.sql,
    });
    assert.equal(nonMcpProcessed?.state, "JOB_QUEUED");
    assert.ok(nonMcpProcessed?.jobId);

    const blockedHire = await createHireRequest(BUYER_ID, {
      agentVersionId: versionId,
      idempotencyKey: "buyer-hire-v5-blocked-01",
      prompt: "Record an explicit missing-provider state.",
    }, { sql: database.sql });
    await processPendingHireRequests({
      workerId: "missing-provider-worker",
      workerEpoch: 2n,
      leaseExpiresAt: new Date(Date.now() + 60_000),
      limit: 1,
      sql: database.sql,
    });
    const [blocked] = await listHireRequests(BUYER_ID, {
      hireRequestId: blockedHire.hireRequestId,
      sql: database.sql,
    });
    assert.equal(blocked?.state, "BLOCKED");
    assert.equal(blocked?.errorCode, "GOAL_MCP_CONTEXT_UNAVAILABLE");

    const failedHire = await createHireRequest(BUYER_ID, {
      agentVersionId: versionId,
      idempotencyKey: "buyer-hire-v5-failed-01",
      prompt: "Record an explicit provider failure.",
    }, { sql: database.sql });
    await processPendingHireRequests({
      workerId: "failed-provider-worker",
      workerEpoch: 3n,
      leaseExpiresAt: new Date(Date.now() + 60_000),
      limit: 1,
      mcpProvider: { invoke: async () => { throw new Error("provider unavailable"); } },
      sql: database.sql,
    });
    const [failed] = await listHireRequests(BUYER_ID, {
      hireRequestId: failedHire.hireRequestId,
      sql: database.sql,
    });
    assert.equal(failed?.state, "FAILED");
    assert.equal(failed?.errorCode, "GOAL_MCP_PROVIDER_FAILED");

    const abortedHire = await createHireRequest(BUYER_ID, {
      agentVersionId: versionId,
      idempotencyKey: "buyer-hire-v5-aborted-01",
      prompt: "Remain pending when the worker is already stopping.",
    }, { sql: database.sql });
    const aborted = new AbortController();
    aborted.abort();
    assert.equal(await processPendingHireRequests({
      workerId: "aborted-worker",
      workerEpoch: 4n,
      leaseExpiresAt: new Date(Date.now() + 60_000),
      limit: 1,
      mcpProvider: provider,
      signal: aborted.signal,
      sql: database.sql,
    }), 0);
    assert.equal((await listHireRequests(BUYER_ID, {
      hireRequestId: abortedHire.hireRequestId,
      sql: database.sql,
    }))[0]?.state, "PENDING_CONTEXT");

    const staleFailureHire = await createHireRequest(BUYER_ID, {
      agentVersionId: versionId,
      idempotencyKey: "buyer-hire-v5-stale-failure-01",
      prompt: "A stale failure must not terminalize a newer claim.",
    }, { sql: database.sql });
    const staleExpiry = new Date(Date.now() + 100);
    const staleProcessing = processHireRequest({
      hireRequestId: staleFailureHire.hireRequestId,
      workerId: "same-worker",
      workerEpoch: 5n,
      leaseExpiresAt: staleExpiry,
      mcpProvider: {
        invoke: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          throw new Error("stale provider failure");
        },
      },
      sql: database.sql,
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    const newerClaim = await claimHireRequestContext({
      hireRequestId: staleFailureHire.hireRequestId,
      workerId: "same-worker",
      workerEpoch: 5n,
      leaseExpiresAt: new Date(Date.now() + 60_000),
      sql: database.sql,
    });
    assert.equal(newerClaim?.claimVersion, 2);
    assert.equal(await staleProcessing, null);
    const [stillRunning] = await listHireRequests(BUYER_ID, {
      hireRequestId: staleFailureHire.hireRequestId,
      sql: database.sql,
    });
    assert.equal(stillRunning?.state, "CONTEXT_RUNNING");
    assert.equal(stillRunning?.claimVersion, 2);

    const releaseSha = "e".repeat(40);
    await createOgSpendBudget(releaseSha, 10n, { sql: database.sql });
    const attempts = await Promise.allSettled([
      reserveOgSpend({
        releaseSha,
        effectIdentity: domainHash("v5-spend", "one"),
        amountAtomic: 6n,
      }, { sql: database.sql }),
      reserveOgSpend({
        releaseSha,
        effectIdentity: domainHash("v5-spend", "two"),
        amountAtomic: 6n,
      }, { sql: database.sql }),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    const reservation = attempts.find((attempt) => attempt.status === "fulfilled");
    assert.ok(reservation && reservation.status === "fulfilled");
    await database.sql`
      UPDATE og_spend_reservations
      SET state = 'AMBIGUOUS', request_id = 'provider-request-1', error_code = 'RESULT_UNKNOWN'
      WHERE id = ${reservation.value.reservationId}::uuid
    `;
    await assert.rejects(database.sql`
      UPDATE og_spend_reservations
      SET state = 'RELEASED', error_code = 'RELEASED_AFTER_AMBIGUITY'
      WHERE id = ${reservation.value.reservationId}::uuid
    `);
  } finally {
    await database.close();
  }
});
