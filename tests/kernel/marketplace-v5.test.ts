import assert from "node:assert/strict";
import test from "node:test";
import { buildManifestV5, deriveManifestHashes } from "../../src/kernel/agent-catalog";
import { domainHash } from "../../src/kernel/canonical";
import {
  claimHireRequestContext,
  completeHireRequestContext,
  createHireRequest,
  listHireRequests,
} from "../../src/kernel/hire-requests";
import { listAgentLifecycle } from "../../src/kernel/lifecycle";
import { collectMcpContext, type McpContextProvider } from "../../src/kernel/mcp-context";
import { parseAgentListFilters, parseHireRequestInput } from "../../src/kernel/policy";
import { createOgSpendBudget, reserveOgSpend } from "../../src/kernel/service";
import { configureDatabaseEnvironment, startDisposableDatabase } from "../helpers/postgres";

const CREATOR_ID = "v5-creator";
const BUYER_ID = "v5-buyer";
const OTHER_ID = "v5-other";
const CREATOR_WALLET = "0x1111111111111111111111111111111111111111";
const BUYER_WALLET = "0x2222222222222222222222222222222222222222";
const OTHER_WALLET = "0x3333333333333333333333333333333333333333";

class FixedProvider implements McpContextProvider {
  async invoke(binding: Parameters<McpContextProvider["invoke"]>[0]): Promise<unknown> {
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
    const hashes = deriveManifestHashes(manifest);
    const agents = await database.sql<{ id: string }[]>`
      INSERT INTO kernel_agents (owner_user_id, name) VALUES (${CREATOR_ID}, ${manifest.name})
      RETURNING id::text
    `;
    const agentId = agents[0]?.id;
    assert.ok(agentId);
    await database.sql`SET session_replication_role = replica`;
    const versions = await database.sql<{ id: string }[]>`
      INSERT INTO agent_versions (
        agent_id, version, manifest, manifest_hash, prompt_hash, config_hash,
        capabilities, adapter_key, endpoint, connector_key, owner_wallet,
        payout_address, price_atomic, asset, proof_policy, lifecycle_state,
        creator_parent, agent_label, full_subname, write_plan, write_plan_hash,
        canonical_state, authority_owner, authority_policy_version,
        authority_record_hash, authority_observed_at, authority_fresh_until,
        authority_release_sha, publication_decision_id, publication_action_id,
        published, published_at
      ) VALUES (
        ${agentId}::uuid, 1, ${database.sql.json(JSON.parse(JSON.stringify(manifest)))},
        ${hashes.manifestHash}, ${hashes.promptHash}, ${hashes.configHash},
        ${manifest.capabilities}, 'protected-a3', NULL, NULL, ${CREATOR_WALLET},
        ${CREATOR_WALLET}, 1000, 'USDC_ATOMIC', 'verified-receipt-required', 'PUBLISHED',
        'creator.eth', 'v5-market', 'v5-market.creator.eth', ${database.sql.json({ local: true })},
        ${"a".repeat(64)}, 'CANONICAL', ${CREATOR_WALLET}, 'ens-publication-v1',
        ${"b".repeat(64)}, clock_timestamp(), clock_timestamp() + interval '1 hour',
        ${"c".repeat(40)}, '10000000-0000-4000-8000-000000000001'::uuid,
        '10000000-0000-4000-8000-000000000002'::uuid, true, clock_timestamp()
      ) RETURNING id::text
    `;
    await database.sql`SET session_replication_role = origin`;
    const versionId = versions[0]?.id;
    assert.ok(versionId);

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

    const expiresAt = new Date(Date.now() + 60_000);
    const claimed = await claimHireRequestContext({
      hireRequestId: created.hireRequestId,
      workerId: "v5-worker",
      workerEpoch: 1n,
      leaseExpiresAt: expiresAt,
      sql: database.sql,
    });
    assert.equal(claimed?.state, "CONTEXT_RUNNING");
    const context = await collectMcpContext({
      sql: database.sql,
      hireRequestId: created.hireRequestId,
      hireFence: {
        workerId: "v5-worker",
        workerEpoch: 1n,
        claimVersion: 1,
        claimExpiresAt: expiresAt,
      },
      agentVersionId: versionId,
      manifestHash: hashes.manifestHash,
      bindings: manifest.mcp,
      objective: "Analyze this market.",
      requiredCapabilities: manifest.capabilities,
      releaseSha: "d".repeat(40),
      provider: new FixedProvider(),
    });
    assert.equal(context.evidence.length, manifest.mcp.length);
    await assert.rejects(database.sql`
      UPDATE mcp_invocations SET hire_request_id = NULL
      WHERE hire_request_id = ${created.hireRequestId}::uuid
    `);
    assert.equal(await completeHireRequestContext({
      hireRequestId: created.hireRequestId,
      workerId: "wrong-worker",
      workerEpoch: 1n,
      claimVersion: claimed?.version ?? 0,
      contextHash: context.contextHash,
      sql: database.sql,
    }), null);
    const completed = await completeHireRequestContext({
      hireRequestId: created.hireRequestId,
      workerId: "v5-worker",
      workerEpoch: 1n,
      claimVersion: 1,
      contextHash: context.contextHash,
      sql: database.sql,
    });
    assert.equal(completed?.state, "JOB_QUEUED");

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
    await database.sql`SET session_replication_role = origin`.catch(() => undefined);
    await database.close();
  }
});
