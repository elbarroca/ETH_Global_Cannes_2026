import assert from "node:assert/strict";
import test from "node:test";
import { domainHash } from "../../src/kernel/canonical";
import { KernelError } from "../../src/kernel/errors";
import { createGoal, createGoalRun, parseGoalCreate } from "../../src/kernel/goals";
import { createHireRequest } from "../../src/kernel/hire-requests";
import {
  attachAgentWallet,
  createAgentDraft,
  listAgentLifecycle,
  publishWalletAgentVersion,
} from "../../src/kernel/lifecycle";
import { parseAgentAction, parseAgentInput } from "../../src/kernel/policy";
import { submitJob } from "../../src/kernel/service";
import type { AgentWalletIdentity, AgentWalletProvider } from "../../src/kernel/types";
import { configureDatabaseEnvironment, startDisposableDatabase } from "../helpers/postgres";

const CREATOR_ID = "wallet-authority-creator";
const BUYER_ID = "wallet-authority-buyer";
const OTHER_ID = "wallet-authority-other";
const CREATOR_WALLET = "0x1111111111111111111111111111111111111111";
const BUYER_WALLET = "0x2222222222222222222222222222222222222222";
const OTHER_WALLET = "0x3333333333333333333333333333333333333333";
const WALLET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WALLET_ADDRESS = "0x4444444444444444444444444444444444444444";

class FakeWalletProvider implements AgentWalletProvider {
  calls = 0;

  constructor(private readonly mutate: (identity: AgentWalletIdentity) => unknown = (identity) => identity) {}

  async provisionAgentWallet(): Promise<AgentWalletIdentity> {
    this.calls += 1;
    const observedAt = new Date().toISOString();
    return this.mutate({
      provider: "circle",
      walletId: WALLET_ID,
      address: WALLET_ADDRESS,
      network: "UNI-SEPOLIA",
      accountType: "SCA",
      state: "LIVE",
      evidenceHash: domainHash("agent-wallet-provider-evidence", { observedAt, walletId: WALLET_ID }),
      observedAt,
    }) as AgentWalletIdentity;
  }
}

test("creator draft persists server-expanded MCP bindings and rejects arbitrary IDs", async () => {
  const database = await startDisposableDatabase("creator-mcp-trigger");
  configureDatabaseEnvironment(database.url);
  try {
    await database.sql`
      INSERT INTO users (id, wallet_address) VALUES (${CREATOR_ID}, ${CREATOR_WALLET})
    `;
    const manifest = parseAgentInput({
      name: "Creator MCP Research Agent",
      description: "A bounded custom agent with server-expanded MCP bindings.",
      instructions: "## Task\n\nReturn concise evidence from the selected MCP sources.",
      capabilities: ["research", "market-analysis"],
      mcp: [
        { provider: "the-graph", capability: "pinned-deployment-lookup" },
        { provider: "coingecko", capability: "spot-price" },
      ],
    }, CREATOR_WALLET).manifest;
    const draft = await createAgentDraft(
      { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
      manifest,
      { idempotencyKey: "creator-mcp-draft-01", sql: database.sql },
    );
    const expectedMcp = [
      {
        schemaVersion: 1,
        id: "mcp.coingecko.spot-price",
        provider: "coingecko",
        capability: "spot-price",
        access: "read-only",
        timeoutMs: 8000,
        maxResponseBytes: 32768,
      },
      {
        schemaVersion: 1,
        id: "mcp.the-graph.pinned-deployment-lookup",
        provider: "the-graph",
        capability: "pinned-deployment-lookup",
        access: "read-only",
        timeoutMs: 8000,
        maxResponseBytes: 32768,
      },
    ];
    assert.deepEqual(manifest.mcp, expectedMcp);
    const draftRows = await database.sql<{ manifest: { mcp: unknown } }[]>`
      SELECT manifest FROM agent_versions WHERE id = ${draft.versionId}::uuid
    `;
    assert.deepEqual(draftRows[0]?.manifest.mcp, expectedMcp);
    await assert.rejects(database.sql`
      UPDATE agent_versions
      SET manifest = jsonb_set(manifest, '{mcp,0,id}', '"mcp.arbitrary.shell"'::jsonb)
      WHERE id = ${draft.versionId}::uuid
    `, /creator manifest contains an unallowlisted MCP binding/);
    const unchangedDraftRows = await database.sql<{ manifest: { mcp: unknown } }[]>`
      SELECT manifest FROM agent_versions WHERE id = ${draft.versionId}::uuid
    `;
    assert.deepEqual(unchangedDraftRows[0]?.manifest.mcp, expectedMcp);
  } finally {
    await database.close();
  }
});

test("wallet authority publishes without ENS and admits external hire and goal selection", async () => {
  const database = await startDisposableDatabase("wallet-authority");
  configureDatabaseEnvironment(database.url);
  try {
    await database.sql`
      INSERT INTO users (id, wallet_address) VALUES
        (${CREATOR_ID}, ${CREATOR_WALLET}),
        (${BUYER_ID}, ${BUYER_WALLET}),
        (${OTHER_ID}, ${OTHER_WALLET})
    `;
    const manifest = parseAgentInput({
      name: "Wallet Authority Research Agent",
      description: "A bounded wallet-authorized research agent for deterministic tests.",
      instructions: "## Task\n\nReturn a concise evidence-backed market analysis result.",
      capabilities: ["research", "market-analysis"],
    }, CREATOR_WALLET).manifest;
    const draft = await createAgentDraft(
      { userId: CREATOR_ID, walletAddress: CREATOR_WALLET },
      manifest,
      { idempotencyKey: "wallet-draft-01", sql: database.sql },
    );

    assert.throws(() => parseAgentAction({
      action: "ATTACH_AGENT_WALLET",
      versionId: draft.versionId,
      walletId: WALLET_ID,
    }, CREATOR_WALLET), /Unexpected or server-owned field/);
    assert.throws(() => parseAgentAction({
      action: "BIND_NAME",
      versionId: draft.versionId,
      creatorParent: "creator.eth",
      agentLabel: "wallet-agent",
    }, CREATOR_WALLET), /Unsupported agent lifecycle action/);

    const neverCalled = new FakeWalletProvider();
    await assert.rejects(
      attachAgentWallet(OTHER_ID, draft.versionId, {
        idempotencyKey: "wallet-wrong-owner-01",
        provider: neverCalled,
        sql: database.sql,
      }),
      (error: unknown) => error instanceof KernelError && error.code === "KERNEL_NOT_FOUND",
    );
    assert.equal(neverCalled.calls, 0);
    await assert.rejects(
      attachAgentWallet(CREATOR_ID, draft.versionId, {
        idempotencyKey: "wallet-provider-missing-01",
        sql: database.sql,
      }),
      (error: unknown) => error instanceof KernelError && error.status === 503,
    );

    for (const [key, mutate] of [
      ["wallet-bad-id-01", (identity: AgentWalletIdentity) => ({ ...identity, walletId: "not-a-uuid" })],
      ["wallet-zero-address-01", (identity: AgentWalletIdentity) => ({ ...identity, address: `0x${"0".repeat(40)}` })],
      ["wallet-wrong-network-01", (identity: AgentWalletIdentity) => ({ ...identity, network: "ETH-SEPOLIA" })],
      ["wallet-wrong-state-01", (identity: AgentWalletIdentity) => ({ ...identity, state: "FROZEN" })],
    ] as const) {
      await assert.rejects(
        attachAgentWallet(CREATOR_ID, draft.versionId, {
          idempotencyKey: key,
          provider: new FakeWalletProvider(mutate),
          sql: database.sql,
        }),
        (error: unknown) => error instanceof KernelError && error.status === 503,
      );
    }
    const before = await database.sql<{ wallets: number; decisions: number; ens: number }[]>`
      SELECT
        (SELECT count(*)::int FROM agent_wallet_identities) AS wallets,
        (SELECT count(*)::int FROM wallet_publication_decisions) AS decisions,
        (SELECT count(*)::int FROM ens_publication_decisions) AS ens
    `;
    assert.deepEqual(before[0], { decisions: 0, ens: 0, wallets: 0 });

    const provider = new FakeWalletProvider();
    const attached = await attachAgentWallet(CREATOR_ID, draft.versionId, {
      idempotencyKey: "wallet-attach-live-01",
      provider,
      sql: database.sql,
    });
    assert.equal(attached.lifecycleState, "WALLET_ATTACHED");
    assert.equal(attached.agentWallet?.address, WALLET_ADDRESS);
    const attachReplay = await attachAgentWallet(CREATOR_ID, draft.versionId, {
      idempotencyKey: "wallet-attach-live-01",
      provider,
      sql: database.sql,
    });
    assert.deepEqual(attachReplay, attached);
    assert.equal(provider.calls, 1);
    await assert.rejects(attachAgentWallet(CREATOR_ID, draft.versionId, {
      idempotencyKey: "wallet-attach-different-01",
      provider,
      sql: database.sql,
    }));
    assert.equal(provider.calls, 1);

    const published = await publishWalletAgentVersion(CREATOR_ID, draft.versionId, {
      idempotencyKey: "wallet-publish-01",
      sql: database.sql,
    });
    assert.equal(published.publicationMode, "WALLET");
    assert.equal(published.authorityState, "WALLET_AUTHORIZED");
    assert.equal(published.canonicalState, "WALLET_AUTHORIZED");
    assert.equal(published.fullSubname, "");
    assert.equal(published.agentWallet.address, WALLET_ADDRESS);
    assert.match(published.walletPublicationDecisionId, /^[0-9a-f-]{36}$/);
    assert.match(published.walletReceiptHash, /^[0-9a-f]{64}$/);
    const replay = await publishWalletAgentVersion(CREATOR_ID, draft.versionId, {
      idempotencyKey: "wallet-publish-01",
      sql: database.sql,
    });
    assert.deepEqual(replay, published);

    const persisted = await database.sql<{
      creator_parent: string | null;
      full_subname: string | null;
      publication_decision_id: string | null;
      ens: number;
      decisions: number;
      wallets: number;
    }[]>`
      SELECT version.creator_parent, version.full_subname,
        version.publication_decision_id::text,
        (SELECT count(*)::int FROM ens_publication_decisions) AS ens,
        (SELECT count(*)::int FROM wallet_publication_decisions) AS decisions,
        (SELECT count(*)::int FROM agent_wallet_identities) AS wallets
      FROM agent_versions version WHERE version.id = ${draft.versionId}::uuid
    `;
    assert.deepEqual(persisted[0], {
      creator_parent: null,
      decisions: 1,
      ens: 0,
      full_subname: null,
      publication_decision_id: null,
      wallets: 1,
    });

    const listing = await listAgentLifecycle(BUYER_ID, { sql: database.sql });
    assert.equal(listing.agents[0]?.versionId, published.versionId);
    await assert.rejects(submitJob(CREATOR_ID, {
      agentVersionId: published.versionId,
      idempotencyKey: "wallet-self-hire-01",
      task: { prompt: "Self hire must fail." },
    }, { sql: database.sql }));
    const job = await submitJob(BUYER_ID, {
      agentVersionId: published.versionId,
      idempotencyKey: "wallet-external-hire-01",
      task: { prompt: "Analyze the market with bounded evidence." },
    }, { sql: database.sql });
    assert.equal(job.state, "QUEUED");
    const hire = await createHireRequest(OTHER_ID, {
      agentVersionId: published.versionId,
      idempotencyKey: "wallet-marketplace-hire-01",
      prompt: "Collect protected market evidence.",
    }, { sql: database.sql });
    assert.equal(hire.state, "PENDING_CONTEXT");

    const goal = await createGoal(BUYER_ID, parseGoalCreate({
      objective: "Select one external wallet-authorized research agent.",
      requiredCapabilities: ["research"],
      state: "ACTIVE",
      policy: {
        cadenceMinutes: 5,
        runMode: "BOUNDED",
        executionMode: "RESEARCH_ONLY",
        runLimit: 1,
        maxAgents: 1,
        perRunCapAtomic: "1000",
        dailyCapAtomic: null,
      },
    }), "wallet-goal-create-01", { sql: database.sql });
    const run = await createGoalRun(BUYER_ID, goal.goal.goalId, "wallet-goal-run-01", {
      sql: database.sql,
    });
    assert.equal(run.run.state, "RUNNING");
    assert.equal(run.run.jobs[0]?.agentVersionId, published.versionId);
    assert.equal(run.run.jobs[0]?.fullSubname, null);
  } finally {
    await database.close();
  }
});
