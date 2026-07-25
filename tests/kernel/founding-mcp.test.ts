import assert from "node:assert/strict";
import test from "node:test";
import { FOUNDING_PACK } from "../../src/agents/founding-pack";
import {
  buildManifestV3,
  deriveManifestHashes,
  foundingCatalogProjection,
} from "../../src/kernel/agent-catalog";
import { canonicalJson, domainHash } from "../../src/kernel/canonical";
import { KernelError } from "../../src/kernel/errors";
import {
  collectMcpContext,
  McpContextError,
  type McpContextProvider,
} from "../../src/kernel/mcp-context";
import { parseAgentAction, parseAgentInput } from "../../src/kernel/policy";
import { submitJob } from "../../src/kernel/service";
import {
  configureDatabaseEnvironment,
  startDisposableDatabase,
} from "../helpers/postgres";

const BUYER_ID = "mcp-buyer";
const CREATOR_ID = "mcp-creator";
const BUYER_WALLET = "0x1111111111111111111111111111111111111111";
const CREATOR_WALLET = "0x2222222222222222222222222222222222222222";
const RELEASE_SHA = "a".repeat(40);
const NOW = new Date("2026-07-25T17:00:00.000Z");

class FixedProvider implements McpContextProvider {
  calls = 0;

  async invoke(binding: Parameters<McpContextProvider["invoke"]>[0]): Promise<unknown> {
    this.calls += 1;
    return { bindingId: binding.id, observed: true, value: 42 };
  }
}

test("manifest v2 bytes remain stable and all founding templates derive deterministic v3", () => {
  const v2 = parseAgentInput({
    name: "Compatibility Agent",
    description: "A deterministic compatibility manifest for V2.",
    instructions: "## Task\n\nReturn a bounded compatibility result.",
    capabilities: ["research", "market-analysis"],
  }, BUYER_WALLET).manifest;
  assert.deepEqual(deriveManifestHashes(v2), {
    manifestHash: "bb9f4c55c6c2e3dd312680987eb3b005ac1fa5b12db17a2f041e52d9ace1f9ab",
    promptHash: "8e09b4c2fdf897d736728d80a2a3e6654c2f26076b7911950fb659a53a847b81",
    configHash: "a3a505be988ec387e0a952ca1884f779fa14d333fbcb0116524a7ba6c24cb1ed",
  });

  assert.equal(FOUNDING_PACK.templates.length, 8);
  for (const template of FOUNDING_PACK.templates) {
    const input = {
      templateId: template.id,
      name: `${template.name} Test`,
      description: `A deterministic ${template.name} catalog manifest.`,
      ownerWallet: CREATOR_WALLET,
    };
    const first = buildManifestV3(input);
    const second = buildManifestV3(input);
    assert.equal(canonicalJson(first), canonicalJson(second));
    assert.deepEqual(deriveManifestHashes(first), deriveManifestHashes(second));
    assert.equal(first.schemaVersion, 3);
    assert.ok(first.mcp.length >= 2 && first.mcp.length <= 4);
    assert.ok(first.skills.every((skill) => /^[0-9a-f]{64}$/.test(skill.snapshotHash)));
  }
});

test("catalog draft admission rejects all client-owned manifest fields and catalog projection is sanitized", () => {
  const action = parseAgentAction({
    action: "CREATE_DRAFT",
    templateId: "market-pulse",
    name: "Market Pulse Private",
    description: "A bounded catalog-created market analysis agent.",
  }, CREATOR_WALLET);
  assert.equal(action.action, "CREATE_DRAFT");
  assert.equal(action.manifest.schemaVersion, 3);

  for (const extra of [
    "instructions", "capabilities", "url", "credentials", "code", "toolName",
    "endpoint", "reviewedPromptHash", "catalogSelectionHash", "reviewedSources", "mcp",
  ]) {
    assert.throws(() => parseAgentAction({
      action: "CREATE_DRAFT",
      templateId: "market-pulse",
      name: "Market Pulse Private",
      description: "A bounded catalog-created market analysis agent.",
      [extra]: "client-owned",
    }, CREATOR_WALLET), (error: unknown) =>
      error instanceof KernelError && error.code === "KERNEL_INVALID_REQUEST");
  }
  assert.throws(() => parseAgentAction({
    action: "CREATE_DRAFT",
    templateId: "unknown-template",
    name: "Unknown Agent",
    description: "A bounded but unknown catalog template.",
  }, CREATOR_WALLET), (error: unknown) =>
    error instanceof KernelError && error.code === "KERNEL_INVALID_REQUEST");

  const projection = canonicalJson(foundingCatalogProjection());
  assert.doesNotMatch(projection, /https?:\/\//i);
  assert.doesNotMatch(projection, /credential|apiKey|graphql|execute|toolName/i);
  assert.match(projection, /"availability":"UNAVAILABLE"/);
});

test("MCP evidence is immutable, replayed without duplicate calls, and required for v3 hire", async () => {
  const database = await startDisposableDatabase("founding-mcp");
  configureDatabaseEnvironment(database.url);
  try {
    await database.sql`
      INSERT INTO users (id, wallet_address) VALUES
        (${BUYER_ID}, ${BUYER_WALLET}), (${CREATOR_ID}, ${CREATOR_WALLET})
    `;
    const manifest = buildManifestV3({
      templateId: "market-pulse",
      name: "MCP Market Pulse",
      description: "A deterministic MCP evidence integration fixture.",
      ownerWallet: CREATOR_WALLET,
    });
    const hashes = deriveManifestHashes(manifest);
    const agents = await database.sql<{ id: string }[]>`
      INSERT INTO kernel_agents (owner_user_id, name, created_at)
      VALUES (${CREATOR_ID}, ${manifest.name}, ${NOW}) RETURNING id
    `;
    const agentId = agents[0]?.id;
    assert.ok(agentId);
    const versions = await database.sql<{ id: string }[]>`
      INSERT INTO agent_versions (
        agent_id, version, manifest, manifest_hash, prompt_hash, config_hash,
        capabilities, adapter_key, endpoint, connector_key, owner_wallet,
        payout_address, price_atomic, asset, proof_policy, lifecycle_state,
        published, published_at, created_at
      ) VALUES (
        ${agentId}::uuid, 1, ${database.sql.json(JSON.parse(JSON.stringify(manifest)))}, ${hashes.manifestHash},
        ${hashes.promptHash}, ${hashes.configHash}, ${manifest.capabilities},
        'protected-a3', NULL, NULL, ${CREATOR_WALLET}, ${CREATOR_WALLET},
        1000, 'USDC_ATOMIC', 'verified-receipt-required', NULL, true, ${NOW}, ${NOW}
      ) RETURNING id
    `;
    const versionId = versions[0]?.id;
    assert.ok(versionId);
    const tamperedManifest = {
      ...manifest,
      catalogSelectionHash: "0".repeat(64),
    };
    await assert.rejects(database.sql`
      INSERT INTO agent_versions (
        agent_id, version, manifest, manifest_hash, prompt_hash, config_hash,
        capabilities, adapter_key, endpoint, connector_key, owner_wallet,
        payout_address, price_atomic, asset, proof_policy, lifecycle_state,
        published, published_at, created_at
      ) VALUES (
        ${agentId}::uuid, 2,
        ${database.sql.json(JSON.parse(JSON.stringify(tamperedManifest)))},
        ${"0".repeat(64)}, ${hashes.promptHash}, ${hashes.configHash},
        ${manifest.capabilities}, 'protected-a3', NULL, NULL, ${CREATOR_WALLET},
        ${CREATOR_WALLET}, 1000, 'USDC_ATOMIC', 'verified-receipt-required',
        'DRAFT', false, NULL, ${NOW}
      )
    `, /catalog template/);
    const policy = {
      cadenceMinutes: 5,
      runMode: "BOUNDED",
      executionMode: "RESEARCH_ONLY",
      runLimit: 1,
      maxAgents: 1,
      perRunCapAtomic: "1000",
      dailyCapAtomic: null,
    } as const;
    const goals = await database.sql<{ id: string }[]>`
      INSERT INTO goals (
        owner_user_id, idempotency_key, definition_hash, objective,
        required_capabilities, cadence_minutes, run_mode, execution_mode,
        run_limit, max_agents, per_run_cap_atomic, daily_cap_atomic, state,
        next_run_at, created_at, updated_at
      ) VALUES (
        ${BUYER_ID}, 'mcp-goal-create-01', ${domainHash("goal-definition", {
          objective: "Analyze a bounded MCP market snapshot with evidence.",
          policy,
          requiredCapabilities: ["market-analysis"],
          state: "PAUSED",
        })}, 'Analyze a bounded MCP market snapshot with evidence.',
        ${["market-analysis"]}, 5, 'BOUNDED', 'RESEARCH_ONLY', 1, 1,
        1000, NULL, 'PAUSED', NULL, ${NOW}, ${NOW}
      ) RETURNING id
    `;
    const goalId = goals[0]?.id;
    assert.ok(goalId);
    const runs = await database.sql<{ id: string }[]>`
      INSERT INTO goal_runs (
        goal_id, owner_user_id, idempotency_key, scheduled_for, state,
        objective_snapshot, capabilities_snapshot, policy_snapshot, policy_hash,
        effect_identity, total_price_atomic, cost_reserved_at, started_at,
        created_at, updated_at
      ) VALUES (
        ${goalId}::uuid, ${BUYER_ID}, 'mcp-goal-run-01', ${NOW}, 'RUNNING',
        'Analyze a bounded MCP market snapshot with evidence.',
        ${["market-analysis"]}, ${database.sql.json(policy)},
        ${domainHash("goal-policy", policy)}, ${domainHash("mcp-test-effect", { goalId })},
        1000, ${NOW}, ${NOW}, ${NOW}, ${NOW}
      ) RETURNING id
    `;
    const runId = runs[0]?.id;
    assert.ok(runId);
    const links = await database.sql<{ id: string }[]>`
      INSERT INTO goal_run_jobs (
        goal_run_id, agent_version_id, role, selection_rank, covered_capabilities,
        price_atomic_snapshot, manifest_hash_snapshot, full_subname_snapshot, created_at
      ) VALUES (
        ${runId}::uuid, ${versionId}::uuid, 'ANALYSIS', 1, ${["market-analysis"]},
        1000, ${hashes.manifestHash}, 'mcp-market.creator.eth', ${NOW}
      ) RETURNING id
    `;
    const goalRunJobId = links[0]?.id;
    assert.ok(goalRunJobId);
    const createFailureLink = async (suffix: string, offsetMs: number): Promise<string> => {
      const scheduledFor = new Date(NOW.getTime() + offsetMs);
      const failureRuns = await database.sql<{ id: string }[]>`
        INSERT INTO goal_runs (
          goal_id, owner_user_id, idempotency_key, scheduled_for, state,
          objective_snapshot, capabilities_snapshot, policy_snapshot, policy_hash,
          effect_identity, total_price_atomic, cost_reserved_at, started_at,
          created_at, updated_at
        ) VALUES (
          ${goalId}::uuid, ${BUYER_ID}, ${`mcp-failure-run-${suffix}`}, ${scheduledFor}, 'RUNNING',
          'Analyze a bounded MCP market snapshot with evidence.',
          ${["market-analysis"]}, ${database.sql.json(policy)},
          ${domainHash("goal-policy", policy)},
          ${domainHash("mcp-test-effect", { goalId, suffix })},
          1000, ${scheduledFor}, ${scheduledFor}, ${scheduledFor}, ${scheduledFor}
        ) RETURNING id
      `;
      const failureRunId = failureRuns[0]?.id;
      assert.ok(failureRunId);
      const failureLinks = await database.sql<{ id: string }[]>`
        INSERT INTO goal_run_jobs (
          goal_run_id, agent_version_id, role, selection_rank, covered_capabilities,
          price_atomic_snapshot, manifest_hash_snapshot, full_subname_snapshot, created_at
        ) VALUES (
          ${failureRunId}::uuid, ${versionId}::uuid, 'ANALYSIS', 1,
          ${["market-analysis"]}, 1000, ${hashes.manifestHash},
          'mcp-market.creator.eth', ${scheduledFor}
        ) RETURNING id
      `;
      const failureLinkId = failureLinks[0]?.id;
      assert.ok(failureLinkId);
      return failureLinkId;
    };

    await assert.rejects(submitJob(BUYER_ID, {
      agentVersionId: versionId,
      idempotencyKey: "mcp-direct-hire-01",
      task: { prompt: "Direct public hire without internal evidence." },
    }, { now: NOW, sql: database.sql }), (error: unknown) =>
      error instanceof KernelError && error.code === "KERNEL_FORBIDDEN");

    const provider = new FixedProvider();
    const context = await collectMcpContext({
      sql: database.sql,
      goalRunJobId,
      agentVersionId: versionId,
      manifestHash: hashes.manifestHash,
      bindings: manifest.mcp,
      objective: "Analyze a bounded MCP market snapshot with evidence.",
      requiredCapabilities: ["market-analysis"],
      releaseSha: RELEASE_SHA,
      provider,
      now: NOW,
    });
    assert.equal(provider.calls, manifest.mcp.length);
    const replay = await collectMcpContext({
      sql: database.sql,
      goalRunJobId,
      agentVersionId: versionId,
      manifestHash: hashes.manifestHash,
      bindings: manifest.mcp,
      objective: "Analyze a bounded MCP market snapshot with evidence.",
      requiredCapabilities: ["market-analysis"],
      releaseSha: RELEASE_SHA,
      provider,
      now: NOW,
    });
    assert.equal(provider.calls, manifest.mcp.length);
    assert.deepEqual(replay.evidence, context.evidence);

    const evidenceHashes = context.evidence.map((entry) => ({
      bindingId: entry.bindingId,
      contextHash: entry.contextHash,
      requestHash: entry.requestHash,
      responseHash: entry.responseHash,
    }));
    const prompt = [
      "Protected goal analysis.",
      `MCP context hash: ${context.contextHash}`,
      `MCP evidence hashes: ${canonicalJson(evidenceHashes)}`,
      `MCP normalized context: ${context.context}`,
    ].join("\n");
    const submitted = await submitJob(BUYER_ID, {
      agentVersionId: versionId,
      idempotencyKey: "mcp-internal-hire-01",
      task: { prompt },
    }, {
      now: NOW,
      sql: database.sql,
      mcpContext: {
        goalRunJobId,
        contextHash: context.contextHash,
        invocationIds: context.evidence.map((entry) => entry.invocationId),
      },
    });
    assert.equal(submitted.replayed, false);
    const replayedJob = await submitJob(BUYER_ID, {
      agentVersionId: versionId,
      idempotencyKey: "mcp-internal-hire-01",
      task: { prompt },
    }, { now: NOW, sql: database.sql });
    assert.equal(replayedJob.jobId, submitted.jobId);
    assert.equal(replayedJob.replayed, true);

    const invocationId = context.evidence[0]?.invocationId;
    assert.ok(invocationId);
    await assert.rejects(database.sql`
      UPDATE mcp_invocations SET response_bytes = response_bytes WHERE id = ${invocationId}::uuid
    `, /append-only/);
    await assert.rejects(database.sql`
      DELETE FROM mcp_invocations WHERE id = ${invocationId}::uuid
    `, /append-only/);
    await assert.rejects(database.sql`TRUNCATE mcp_invocations`, /append-only/);

    const unavailableLink = await createFailureLink("unavailable", 60_000);
    await assert.rejects(collectMcpContext({
      sql: database.sql,
      goalRunJobId: unavailableLink,
      agentVersionId: versionId,
      manifestHash: hashes.manifestHash,
      bindings: manifest.mcp,
      objective: "Analyze a bounded MCP market snapshot with evidence.",
      requiredCapabilities: ["market-analysis"],
      releaseSha: RELEASE_SHA,
      now: NOW,
    }), (error: unknown) =>
      error instanceof McpContextError && error.code === "GOAL_MCP_CONTEXT_UNAVAILABLE");

    const malformedLink = await createFailureLink("malformed", 120_000);
    await assert.rejects(collectMcpContext({
      sql: database.sql,
      goalRunJobId: malformedLink,
      agentVersionId: versionId,
      manifestHash: hashes.manifestHash,
      bindings: manifest.mcp,
      objective: "Analyze a bounded MCP market snapshot with evidence.",
      requiredCapabilities: ["market-analysis"],
      releaseSha: RELEASE_SHA,
      provider: { invoke: async () => ({ apiKey: "must-not-persist" }) },
      now: NOW,
    }), (error: unknown) =>
      error instanceof McpContextError && error.code === "GOAL_MCP_RESPONSE_MALFORMED");

    const oversizedLink = await createFailureLink("oversized", 180_000);
    await assert.rejects(collectMcpContext({
      sql: database.sql,
      goalRunJobId: oversizedLink,
      agentVersionId: versionId,
      manifestHash: hashes.manifestHash,
      bindings: manifest.mcp,
      objective: "Analyze a bounded MCP market snapshot with evidence.",
      requiredCapabilities: ["market-analysis"],
      releaseSha: RELEASE_SHA,
      provider: {
        invoke: async () => Object.fromEntries(
          Array.from({ length: 10 }, (_, index) => [`field${index}`, "x".repeat(4_000)]),
        ),
      },
      now: NOW,
    }), (error: unknown) =>
      error instanceof McpContextError && error.code === "GOAL_MCP_RESPONSE_TOO_LARGE");

    const claimLossLink = await createFailureLink("claim-loss", 240_000);
    const claimLossProvider = new FixedProvider();
    await assert.rejects(collectMcpContext({
      sql: database.sql,
      goalRunJobId: claimLossLink,
      agentVersionId: versionId,
      manifestHash: hashes.manifestHash,
      bindings: manifest.mcp,
      objective: "Analyze a bounded MCP market snapshot with evidence.",
      requiredCapabilities: ["market-analysis"],
      releaseSha: RELEASE_SHA,
      provider: claimLossProvider,
      mutationGuard: async () => false,
      now: NOW,
    }), (error: unknown) =>
      error instanceof McpContextError && error.code === "GOAL_MCP_CLAIM_LOST");
    assert.equal(claimLossProvider.calls, 0);

    const postCallLossLink = await createFailureLink("post-call-loss", 300_000);
    const postCallLossProvider = new FixedProvider();
    let guardCalls = 0;
    await assert.rejects(collectMcpContext({
      sql: database.sql,
      goalRunJobId: postCallLossLink,
      agentVersionId: versionId,
      manifestHash: hashes.manifestHash,
      bindings: manifest.mcp,
      objective: "Analyze a bounded MCP market snapshot with evidence.",
      requiredCapabilities: ["market-analysis"],
      releaseSha: RELEASE_SHA,
      provider: postCallLossProvider,
      mutationGuard: async () => {
        guardCalls += 1;
        return guardCalls === 1;
      },
      now: NOW,
    }), (error: unknown) =>
      error instanceof McpContextError && error.code === "GOAL_MCP_CLAIM_LOST");
    assert.equal(postCallLossProvider.calls, 1);
    const postCallEvidence = await database.sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM mcp_invocations
      WHERE goal_run_job_id = ${postCallLossLink}::uuid
    `;
    assert.equal(postCallEvidence[0]?.count, 0);

    await assert.rejects(collectMcpContext({
      sql: database.sql,
      goalRunJobId,
      agentVersionId: versionId,
      manifestHash: hashes.manifestHash,
      bindings: [{ ...manifest.mcp[0]!, capability: "bounded-query" }],
      objective: "Analyze a bounded MCP market snapshot with evidence.",
      requiredCapabilities: ["market-analysis"],
      releaseSha: RELEASE_SHA,
      provider,
      now: NOW,
    }), (error: unknown) =>
      error instanceof McpContextError && error.code === "GOAL_MCP_BINDING_UNALLOWLISTED");

    const failures = await database.sql<{ code: string; normalized: unknown }[]>`
      SELECT error_code AS code, normalized_response AS normalized
      FROM mcp_invocations WHERE state = 'FAILED' ORDER BY error_code
    `;
    assert.deepEqual(failures.map((row) => row.code), [
      "GOAL_MCP_CONTEXT_UNAVAILABLE",
      "GOAL_MCP_RESPONSE_MALFORMED",
      "GOAL_MCP_RESPONSE_TOO_LARGE",
    ]);
    assert.ok(failures.every((row) => row.normalized === null));
  } finally {
    await database.close();
  }
});

test("tampered catalog manifests fail before persistence", () => {
  const manifest = buildManifestV3({
    templateId: "market-pulse",
    name: "MCP Refusal",
    description: "A deterministic MCP refusal manifest fixture.",
    ownerWallet: CREATOR_WALLET,
  });
  assert.throws(() => deriveManifestHashes({
    ...manifest,
    mcp: [{ ...manifest.mcp[0]!, capability: "bounded-query" }],
  }), (error: unknown) => error instanceof KernelError && error.code === "KERNEL_INVALID_REQUEST");
});
