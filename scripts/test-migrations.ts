import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { resolvePipelineDisplayTimes } from "../components/hunt/hunt-pipeline-arrows";
import { isLoopbackDatabaseUrl } from "../src/config/env";
import {
  createEnsPublicationAuthority,
  createEnsPublicationPolicyDocument,
} from "../src/ens/authority";
import { bindManifestEns } from "../src/kernel/agent-catalog";
import { domainHash } from "../src/kernel/canonical";
import { KernelError } from "../src/kernel/errors";
import { parseGoalPatch, patchGoal } from "../src/kernel/goals";
import { parseAgentInput, parseEnsBinding } from "../src/kernel/policy";
import { createEnsPublicationAuthorityFixture } from "../tests/helpers/ens";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PRISMA = resolve(ROOT, "node_modules/.bin/prisma");
const SCHEMA = resolve(ROOT, "prisma/schema.prisma");
const BASELINE_MIGRATION = "20260724011500_baseline";
const A2_MIGRATION = "20260724024500_authenticated_kernel";
const A3_MIGRATION = "20260724041000_strict_0g";
const A4_MIGRATION = "20260724130000_ens_authority";
const A5_MIGRATION = "20260725020000_a5_protected_lifecycle";
const A4_PUBLICATION_MIGRATION = "20260725042000_a4_publication_decision";
const A4_PUBLICATION_AUTHORITY_MIGRATION = "20260725045500_a4_publication_decision_authority";
const A4_PUBLICATION_HARDENING_MIGRATION = "20260725053000_a4_publication_authority_hardening";
const A4_PUBLICATION_BLOCK_NORMALIZATION_MIGRATION = "20260725062500_a4_publication_block_normalization";
const A4_PUBLICATION_UPGRADE_PREFLIGHT_MIGRATION = "20260725064000_a4_publication_upgrade_preflight";
const A4_KERNEL_PUBLICATION_INTEGRITY_MIGRATION = "20260725072000_a4_kernel_publication_integrity";
const A4_KERNEL_ACTION_INTEGRITY_MIGRATION = "20260725082000_a4_kernel_action_integrity";
const A6_UNISWAP_TOOL_RECEIPT_MIGRATION = "20260725100000_a6_uniswap_tool_receipt";
const A5_A6_KERNEL_FOUNDATION_MIGRATION = "20260725113000_a5_a6_kernel_foundation";
const PROTECTED_GOAL_LOOP_MIGRATION = "20260725163000_protected_goal_loop";
const GOAL_LOOP_HARDENING_MIGRATION = "20260725173000_goal_loop_hardening";
const AGENT_MANIFEST_V3_MCP_EVIDENCE_MIGRATION = "20260725190000_agent_manifest_v3_mcp_evidence";
const TRI_RISK_AUGMENTED_LAYER_MIGRATION = "20260725203000_tri_risk_augmented_layer";
const X402_LANE_PAYMENTS_MIGRATION = "20260725210000_x402_lane_payments";
const GOAL_LOOP_PREDECESSOR_MIGRATIONS = [
  BASELINE_MIGRATION,
  A2_MIGRATION,
  A3_MIGRATION,
  A4_MIGRATION,
  A5_MIGRATION,
  A4_PUBLICATION_MIGRATION,
  A4_PUBLICATION_AUTHORITY_MIGRATION,
  A4_PUBLICATION_HARDENING_MIGRATION,
  A4_PUBLICATION_BLOCK_NORMALIZATION_MIGRATION,
  A4_PUBLICATION_UPGRADE_PREFLIGHT_MIGRATION,
  A4_KERNEL_PUBLICATION_INTEGRITY_MIGRATION,
  A4_KERNEL_ACTION_INTEGRITY_MIGRATION,
  A6_UNISWAP_TOOL_RECEIPT_MIGRATION,
  A5_A6_KERNEL_FOUNDATION_MIGRATION,
  PROTECTED_GOAL_LOOP_MIGRATION,
] as const;
const PRE_HARDENING_MIGRATIONS = [
  BASELINE_MIGRATION,
  A2_MIGRATION,
  A3_MIGRATION,
  A4_MIGRATION,
  A5_MIGRATION,
  A4_PUBLICATION_MIGRATION,
  A4_PUBLICATION_AUTHORITY_MIGRATION,
] as const;
const PRE_W7_MIGRATIONS = [
  ...PRE_HARDENING_MIGRATIONS,
  A4_PUBLICATION_HARDENING_MIGRATION,
] as const;
const X402_PREDECESSOR_MIGRATIONS = [
  ...GOAL_LOOP_PREDECESSOR_MIGRATIONS,
  GOAL_LOOP_HARDENING_MIGRATION,
  AGENT_MANIFEST_V3_MCP_EVIDENCE_MIGRATION,
  TRI_RISK_AUGMENTED_LAYER_MIGRATION,
] as const;
const BASELINE_SQL = resolve(ROOT, "prisma/migrations", BASELINE_MIGRATION, "migration.sql");
const SENTINEL_ID = "a1-cannes-sentinel";
const SENTINEL_WALLET = "0xa1cannessentinel";
const SENTINEL_TIMESTAMP = "2026-07-24T00:00:00.000Z";
const UPGRADE_CREATOR_WALLET = "0x6666666666666666666666666666666666666666";
const UPGRADE_RELEASE_SHA = "7".repeat(40);

type DatabaseClient = ReturnType<typeof postgres>;

interface LocalPostgres {
  adminUrl: string;
  close: () => Promise<void>;
}

interface SentinelRow {
  id: string;
  wallet_address: string;
  proxy_wallet: unknown;
  telegram: unknown;
  agent: unknown;
  fund: unknown;
  inft_token_id: number | null;
  created_at: string;
  updated_at: string;
  hot_wallet_index: number | null;
  hot_wallet_address: string | null;
}

interface SentinelSnapshot {
  id: string;
  walletAddress: string;
  sha256: string;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("sentinel snapshot contains a non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  throw new Error("sentinel snapshot contains a non-JSON value");
}

function verifyPipelineTimestampFallback(): void {
  const unavailable = resolvePipelineDisplayTimes([null, null, null], "malformed-timestamp");
  if (unavailable.some((time) => time !== null)) {
    throw new Error("malformed pipeline without anchors must render timestamps unavailable");
  }

  const actionAnchored = resolvePipelineDisplayTimes([1_000, null, null], "malformed-timestamp");
  if (canonicalJson(actionAnchored) !== canonicalJson([1_000, 2_000, 3_000])) {
    throw new Error("pipeline action-anchor interpolation is not deterministic");
  }

  const cycleAnchored = resolvePipelineDisplayTimes(
    [null, null, null],
    "1970-01-01T00:02:00.000Z",
  );
  if (canonicalJson(cycleAnchored) !== canonicalJson([60_000, 90_000, 120_000])) {
    throw new Error("pipeline cycle-anchor interpolation is not deterministic");
  }
}

async function verifyUpgradePreflightSqlOrdering(): Promise<void> {
  const migrationSql = await readFile(
    resolve(ROOT, "prisma/migrations", A4_PUBLICATION_UPGRADE_PREFLIGHT_MIGRATION, "migration.sql"),
    "utf8",
  );
  const orderedTokens = [
    "DO $upgrade$",
    "EXECUTE 'LOCK TABLE public.ens_publication_decisions IN ACCESS EXCLUSIVE MODE'",
    "EXECUTE 'REVOKE EXECUTE ON FUNCTION public.admit_ens_publication_decision(",
    "expected_decision_key",
    "EXECUTE 'COMMENT ON FUNCTION public.admit_ens_publication_decision(",
    "EXECUTE 'GRANT EXECUTE ON FUNCTION public.admit_ens_publication_decision(",
    "$upgrade$;",
  ];
  let previous = -1;
  for (const token of orderedTokens) {
    const index = migrationSql.indexOf(token);
    if (index <= previous) {
      throw new Error("W8 preflight lock, refusal, marker, and authority ordering is not exact");
    }
    previous = index;
  }
  if (
    /(?:UPDATE|DELETE\s+FROM|TRUNCATE)\s+public\.ens_publication_decisions/i.test(migrationSql) ||
    !migrationSql.includes("d.decision_key IS DISTINCT FROM canonical.expected_decision_key")
  ) {
    throw new Error("W8 preflight rewrites evidence or omits canonical-key refusal");
  }
}

async function snapshotSentinel(sql: DatabaseClient): Promise<SentinelSnapshot> {
  const rows = await sql<SentinelRow[]>`
    SELECT
      id,
      wallet_address,
      proxy_wallet,
      telegram,
      agent,
      fund,
      inft_token_id,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at,
      to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at,
      hot_wallet_index,
      hot_wallet_address
    FROM users
    WHERE id = ${SENTINEL_ID}
  `;
  if (rows.length !== 1) throw new Error("synthetic Cannes sentinel identity is missing or duplicated");

  const row = rows[0];
  if (row.id !== SENTINEL_ID || row.wallet_address !== SENTINEL_WALLET) {
    throw new Error("synthetic Cannes sentinel identity does not match the expected fixture");
  }
  const sha256 = createHash("sha256").update(canonicalJson(row)).digest("hex");
  return { id: row.id, walletAddress: row.wallet_address, sha256 };
}

function redactUrls(value: string): string {
  return value.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[redacted-database-url]");
}

function run(command: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env): void {
  const result = spawnSync(command, [...args], {
    cwd: ROOT,
    encoding: "utf8",
    env,
    timeout: 120_000,
  });
  const output = redactUrls(`${result.stdout ?? ""}${result.stderr ?? ""}`).trim();
  if (result.status !== 0) {
    throw new Error(`${command.split("/").at(-1)} exited ${result.status ?? "without status"}${output ? `: ${output}` : ""}`);
  }
  if (output) console.log(output);
}

function runExpectedFailure(
  command: string,
  args: readonly string[],
  expected: RegExp,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const result = spawnSync(command, [...args], {
    cwd: ROOT,
    encoding: "utf8",
    env,
    timeout: 120_000,
  });
  const output = redactUrls(`${result.stdout ?? ""}${result.stderr ?? ""}`).trim();
  if (result.status === 0 || !expected.test(output)) {
    throw new Error(
      `${command.split("/").at(-1)} did not produce the expected bounded failure` +
      `${output ? `: ${output}` : ""}`,
    );
  }
}

function executable(name: string): string {
  const result = spawnSync("which", [name], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${name} is required for disposable migration tests`);
  return result.stdout.trim();
}

async function availablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("failed to allocate a local PostgreSQL port"));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

async function startLocalPostgres(): Promise<LocalPostgres> {
  const root = await mkdtemp(join(tmpdir(), "alphadawg-postgres-"));
  const data = join(root, "data");
  const log = join(root, "postgres.log");
  const socket = join(root, "socket");
  const port = await availablePort();
  await mkdir(socket);

  const initdb = executable("initdb");
  const pgCtl = executable("pg_ctl");
  run(initdb, ["-D", data, "--auth=trust", "--encoding=UTF8", "--no-locale"]);
  run(pgCtl, ["-D", data, "-l", log, "-o", `-F -p ${port} -h 127.0.0.1 -k ${socket}`, "-w", "start"]);

  const user = encodeURIComponent(process.env.USER ?? "postgres");
  return {
    adminUrl: `postgresql://${user}@127.0.0.1:${port}/postgres`,
    close: async () => {
      try {
        run(pgCtl, ["-D", data, "-m", "fast", "-w", "stop"]);
      } finally {
        await rm(root, { force: true, recursive: true });
      }
    },
  };
}

function databaseUrl(adminUrl: string, database: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${database}`;
  url.search = "";
  return url.toString();
}

function quotedIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]+$/.test(value)) throw new Error("unsafe generated database identifier");
  return `"${value}"`;
}

function prismaEnv(url: string): NodeJS.ProcessEnv {
  return { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
}

async function createDatabase(adminUrl: string, database: string): Promise<void> {
  const sql = postgres(adminUrl, { max: 1 });
  try {
    await sql.unsafe(`CREATE DATABASE ${quotedIdentifier(database)}`);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function dropDatabase(adminUrl: string, database: string): Promise<void> {
  const sql = postgres(adminUrl, { max: 1 });
  try {
    await sql.unsafe(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function prepareCannesShape(url: string): Promise<SentinelSnapshot> {
  const sql = postgres(url, { max: 1 });
  try {
    // Materialize only the inherited Cannes baseline. Using `db push` here
    // would pre-create current A2 objects and make the forward migration
    // collide, which is the opposite of an upgrade replay.
    await sql.unsafe(await readFile(BASELINE_SQL, "utf8"));
    await sql`SELECT setval('hot_wallet_index_seq', 42, true)`;
    await sql`
      INSERT INTO users (
        id,
        wallet_address,
        proxy_wallet,
        telegram,
        agent,
        fund,
        inft_token_id,
        created_at,
        updated_at,
        hot_wallet_index,
        hot_wallet_address
      )
      VALUES (
        ${SENTINEL_ID},
        ${SENTINEL_WALLET},
        ${sql.json({ walletId: "a1-wallet-id", address: "0xa1proxy" })},
        ${sql.json({
          chatId: "a1-chat",
          username: "a1-sentinel",
          verified: true,
          notifyPreference: "every_cycle",
        })},
        ${sql.json({
          active: false,
          goal: "synthetic-cannes-shape",
          cycleCount: 3,
          cyclesRemaining: 2,
          lastCycleAt: "2026-07-23T23:00:00.000Z",
          lastCycleId: 17,
          riskProfile: "balanced",
          maxTradePercent: 10,
        })},
        ${sql.json({ currentNav: 123.45, depositedUsdc: 100, htsShareBalance: 10 })},
        101,
        ${SENTINEL_TIMESTAMP},
        ${SENTINEL_TIMESTAMP},
        42,
        '0xa1hotwallet'
      )
    `;
    return await snapshotSentinel(sql);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

function jsonObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not a JSON object`);
  }
  return value as Record<string, unknown>;
}

async function applyMigrationSql(sql: DatabaseClient, migration: string): Promise<void> {
  const migrationSql = await readFile(
    resolve(ROOT, "prisma/migrations", migration, "migration.sql"),
    "utf8",
  );
  await sql.unsafe(migrationSql);
}

async function verifyPopulatedGoalLoopUpgradeLane(
  adminUrl: string,
  database: string,
): Promise<void> {
  await createDatabase(adminUrl, database);
  const url = databaseUrl(adminUrl, database);
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    for (const migration of GOAL_LOOP_PREDECESSOR_MIGRATIONS) {
      await applyMigrationSql(sql, migration);
      run(
        PRISMA,
        ["migrate", "resolve", "--applied", migration, "--schema", SCHEMA],
        prismaEnv(url),
      );
    }
    const ownerUserId = "goal-loop-upgrade-owner";
    const policy = {
      cadenceMinutes: 5,
      runMode: "CONTINUOUS",
      executionMode: "RESEARCH_ONLY",
      runLimit: null,
      maxAgents: 1,
      perRunCapAtomic: "1000",
      dailyCapAtomic: "1000",
    } as const;
    await sql`
      INSERT INTO users (id, wallet_address)
      VALUES (${ownerUserId}, '0x7777777777777777777777777777777777777777')
    `;
    const goalRows = await sql<{ id: string }[]>`
      INSERT INTO goals (
        owner_user_id, idempotency_key, definition_hash, objective,
        required_capabilities, cadence_minutes, run_mode, execution_mode,
        run_limit, max_agents, per_run_cap_atomic, daily_cap_atomic, state,
        next_run_at, completed_runs, created_at, updated_at
      ) VALUES (
        ${ownerUserId}, 'goal-upgrade-create-01', ${domainHash("goal-definition", {
          objective: "Preserve a populated migration 15 goal and its latest mutation.",
          policy,
          requiredCapabilities: ["research"],
          state: "PAUSED",
        })},
        'Preserve a populated migration 15 goal and its latest mutation.',
        ${["research"]}, 5, 'CONTINUOUS', 'RESEARCH_ONLY', NULL, 1,
        1000, 1000, 'PAUSED', NULL, 0,
        '2026-07-20T10:00:00.000Z', '2026-07-20T10:05:00.000Z'
      ) RETURNING id
    `;
    const goalId = goalRows[0]?.id;
    if (!goalId) throw new Error("populated goal-loop predecessor goal was not created");
    const legacyPatch = parseGoalPatch({ action: "PAUSE" });
    const legacyPayloadHash = domainHash("goal-mutation", { goalId, input: legacyPatch });
    await sql`
      UPDATE goals SET last_mutation_key = 'goal-upgrade-pause-01',
        last_mutation_hash = ${legacyPayloadHash}
      WHERE id = ${goalId}::uuid
    `;
    await sql`
      INSERT INTO goal_runs (
        goal_id, owner_user_id, idempotency_key, scheduled_for, state,
        objective_snapshot, capabilities_snapshot, policy_snapshot, policy_hash,
        effect_identity, total_price_atomic, started_at, created_at, updated_at
      ) VALUES (
        ${goalId}::uuid, ${ownerUserId}, 'goal-upgrade-run-01',
        '2026-07-19T10:00:00.000Z', 'RUNNING',
        'Preserve a populated migration 15 goal and its latest mutation.',
        ${["research"]}, ${sql.json(policy)}, ${domainHash("goal-policy", policy)},
        ${domainHash("goal-upgrade-run", { goalId })}, 1000,
        '2026-07-19T10:00:00.000Z', '2026-07-19T10:00:00.000Z',
        '2026-07-19T10:00:00.000Z'
      )
    `;
    const migrationStartedAt = new Date();
    run(PRISMA, ["migrate", "deploy", "--schema", SCHEMA], prismaEnv(url));
    const migrationFinishedAt = new Date();
    const upgraded = await sql<{
      cost_reserved_at: Date;
      scheduled_for: Date;
      payload_hash: string;
      result_hash: string;
      result_snapshot: unknown;
    }[]>`
      SELECT run.cost_reserved_at, run.scheduled_for, mutation.payload_hash,
        mutation.result_hash, mutation.result_snapshot
      FROM goal_runs run
      JOIN goal_mutations mutation ON mutation.goal_id = run.goal_id
      WHERE run.goal_id = ${goalId}::uuid
    `;
    const state = upgraded[0];
    const snapshot = jsonObject(state?.result_snapshot, "legacy goal mutation result");
    if (
      !state || state.payload_hash !== legacyPayloadHash || state.result_hash !== legacyPayloadHash ||
      snapshot.goalId !== goalId || snapshot.state !== "PAUSED" ||
      state.cost_reserved_at < migrationStartedAt || state.cost_reserved_at > migrationFinishedAt ||
      state.cost_reserved_at.getTime() === state.scheduled_for.getTime()
    ) {
      throw new Error("populated migration 15 goal state did not upgrade exactly");
    }
    const resumed = await patchGoal(
      ownerUserId,
      goalId,
      parseGoalPatch({ action: "RESUME" }),
      "goal-upgrade-resume-01",
      { now: new Date(), sql },
    );
    if (resumed.state !== "ACTIVE") throw new Error("post-upgrade goal did not resume");
    let legacyReplayRejected = false;
    try {
      await patchGoal(ownerUserId, goalId, legacyPatch, "goal-upgrade-pause-01", {
        now: new Date(), sql,
      });
    } catch (error) {
      legacyReplayRejected = error instanceof KernelError && error.code === "KERNEL_CONFLICT";
    }
    const finalState = await sql<{ state: string; mutations: number }[]>`
      SELECT goal.state,
        (SELECT count(*)::int FROM goal_mutations WHERE goal_id = goal.id) AS mutations
      FROM goals goal WHERE goal.id = ${goalId}::uuid
    `;
    if (!legacyReplayRejected || finalState[0]?.state !== "ACTIVE" || finalState[0]?.mutations !== 2) {
      throw new Error("legacy goal mutation replay changed post-migration state");
    }
    console.log("Populated migration 15 goal reservations and legacy PATCH key upgraded fail-closed");
  } finally {
    await sql.end({ timeout: 1 });
  }
}

function markPreW7MigrationsApplied(url: string): void {
  for (const migration of PRE_W7_MIGRATIONS) {
    run(
      PRISMA,
      ["migrate", "resolve", "--applied", migration, "--schema", SCHEMA],
      prismaEnv(url),
    );
  }
}

interface W6PublicationFixture {
  decisionId: string;
  versionId: string;
  record: Record<string, unknown>;
  blockTimestamp: string;
  transactionHash: string;
  runtimeSql: DatabaseClient;
  close: () => Promise<void>;
}

async function seedW6PublicationDecision(
  sql: DatabaseClient,
  url: string,
  lane: string,
  blockNumber: string,
): Promise<W6PublicationFixture> {
  const now = new Date();
  const creatorId = `a4-w6-upgrade-${lane}`;
  const runtimeRole = `a4_up_${lane}_${process.pid}_${Date.now().toString(36)}`;
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(runtimeRole)) {
    throw new Error("unsafe W6 upgrade runtime role");
  }
  await sql`INSERT INTO users (id, wallet_address) VALUES (${creatorId}, ${UPGRADE_CREATOR_WALLET})`;
  const manifest = parseAgentInput({
    name: "A4 Upgrade Agent",
    description: "A deterministic pre-W7 durable publication decision.",
    instructions: "## Task\n\nReturn a bounded upgrade fixture result.",
    capabilities: ["research", "market-analysis"],
  }, UPGRADE_CREATOR_WALLET).manifest;
  const nameBinding = parseEnsBinding({ creatorParent: "creator.eth", agentLabel: "research" });
  const boundManifest = bindManifestEns(manifest, nameBinding);
  const manifestHash = domainHash("agent-manifest", boundManifest);
  const promptHash = domainHash("agent-prompt", boundManifest.instructions);
  const configHash = domainHash("agent-config", {
    adapterKey: boundManifest.adapterKey,
    capabilities: boundManifest.capabilities,
    connectorKey: boundManifest.connectorKey,
    endpoint: boundManifest.endpoint,
    ensBinding: boundManifest.ensBinding,
    priceAtomic: boundManifest.priceAtomic,
    proofPolicy: boundManifest.proofPolicy,
  });
  const agents = await sql<{ id: string }[]>`
    INSERT INTO kernel_agents (owner_user_id, name, created_at)
    VALUES (${creatorId}, ${boundManifest.name}, ${now}) RETURNING id
  `;
  const agent = agents[0];
  if (!agent) throw new Error("pre-W7 fixture agent missing");
  const plan = {
    schemaVersion: 1,
    kind: "LOCAL_ONLY_UNAUTHORIZED",
    agentVersionId: "pending",
    manifestHash,
    creatorParent: nameBinding.creatorParent,
    agentLabel: nameBinding.agentLabel,
    fullSubname: nameBinding.fullSubname,
    creatorDnsName: nameBinding.creatorDnsName,
    agentDnsName: nameBinding.agentDnsName,
    operations: ["CREATE_OR_UPDATE_SUBNAME", "SET_IMMUTABLE_MANIFEST_BINDING"],
    requiresAuthorization: true,
    requiresWalletSignature: true,
  };
  const versions = await sql<{ id: string }[]>`
    INSERT INTO agent_versions (
      agent_id, version, manifest, manifest_hash, prompt_hash, config_hash,
      capabilities, adapter_key, endpoint, connector_key, owner_wallet,
      payout_address, price_atomic, asset, proof_policy, lifecycle_state,
      creator_parent, agent_label, full_subname, write_plan, write_plan_hash,
      published, published_at, created_at
    ) VALUES (
      ${agent.id}::uuid, 1, ${sql.json(boundManifest)}, ${manifestHash}, ${promptHash},
      ${configHash}, ${boundManifest.capabilities}, ${boundManifest.adapterKey}, NULL, NULL,
      ${UPGRADE_CREATOR_WALLET}, ${UPGRADE_CREATOR_WALLET}, ${boundManifest.priceAtomic}::bigint,
      ${boundManifest.asset}, ${boundManifest.proofPolicy}, 'WRITE_PREPARED',
      ${nameBinding.creatorParent}, ${nameBinding.agentLabel}, ${nameBinding.fullSubname},
      ${sql.json(plan)}, ${domainHash("ens-write-plan", plan)}, false, NULL, ${now}
    ) RETURNING id
  `;
  const versionId = versions[0]?.id;
  if (!versionId) throw new Error("pre-W7 fixture version missing");
  const exactPlan = { ...plan, agentVersionId: versionId };
  await sql`
    UPDATE agent_versions
    SET write_plan = ${sql.json(exactPlan)}, write_plan_hash = ${domainHash("ens-write-plan", exactPlan)}
    WHERE id = ${versionId}::uuid
  `;
  await sql`
    INSERT INTO ens_publication_authority_releases (release_sha, not_before, expires_at)
    VALUES (
      ${UPGRADE_RELEASE_SHA},
      ${new Date(now.getTime() - 60_000)},
      ${new Date(now.getTime() + 8 * 60 * 60 * 1_000)}
    )
  `;

  await sql.unsafe(
    `CREATE ROLE "${runtimeRole}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE ` +
    `NOREPLICATION NOBYPASSRLS INHERIT; GRANT alphadawg_runtime TO "${runtimeRole}"`,
  );
  const runtimeUrl = new URL(url);
  runtimeUrl.username = runtimeRole;
  runtimeUrl.password = "";
  const runtimeSql = postgres(runtimeUrl.toString(), { max: 1, prepare: false });
  const close = async (): Promise<void> => {
    await runtimeSql.end({ timeout: 1 });
    await sql.unsafe(`DROP ROLE IF EXISTS "${runtimeRole}"`);
  };

  try {
    const fixture = createEnsPublicationAuthorityFixture({ now });
    const authority = createEnsPublicationAuthority({ sql: runtimeSql, runtime: fixture.runtime, now });
    const missingPolicy = await authority({ agentVersionId: versionId });
    if (
      missingPolicy.allowed || missingPolicy.decisionId !== null ||
      missingPolicy.errorCode !== "ENS_PUBLICATION_PERSIST_FAILED"
    ) {
      throw new Error("pre-W7 fixture admitted without an owner policy");
    }
    const request = fixture.resolver.calls.at(-1);
    if (!request) throw new Error("pre-W7 fixture did not expose its derived binding");
    const policy = createEnsPublicationPolicyDocument(request.binding);
    await sql`
      INSERT INTO ens_publication_authority_policies (
        release_sha, agent_version_id, binding, binding_hash
      ) VALUES (
        ${UPGRADE_RELEASE_SHA}, ${versionId}::uuid,
        ${sql.json(JSON.parse(JSON.stringify(policy)))}, ${"0".repeat(64)}
      )
    `;

    const response = jsonObject(
      await fixture.resolver.resolvePublication(request, new AbortController().signal),
      "pre-W7 resolver response",
    );
    const observation = jsonObject(response.observation, "pre-W7 resolver observation");
    const record = jsonObject(response.record, "pre-W7 resolver record");
    const blockTimestamp = observation.blockTimestamp;
    const transactionHash = observation.transactionHash;
    if (typeof blockTimestamp !== "string" || typeof transactionHash !== "string") {
      throw new Error("pre-W7 resolver observation is incomplete");
    }
    const admitted = await runtimeSql<{ decision_id: string }[]>`
      SELECT decision_id::text FROM public.admit_ens_publication_decision(
        ${versionId}::uuid,
        ${runtimeSql.json(JSON.parse(JSON.stringify(record)))},
        ${blockNumber}::numeric,
        ${blockTimestamp}::timestamptz,
        ${transactionHash},
        NULL
      )
    `;
    const decisionId = admitted[0]?.decision_id;
    if (!decisionId) throw new Error("pre-W7 fixture did not admit one durable decision");
    return {
      decisionId,
      versionId,
      record,
      blockTimestamp,
      transactionHash,
      runtimeSql,
      close,
    };
  } catch (error) {
    await close().catch(() => undefined);
    throw error;
  }
}

interface PublicationUpgradeState {
  decisions: number;
  decisionId: string | null;
  decisionHash: string | null;
  jobs: number;
  effects: number;
  receipts: number;
  functionHash: string;
  marker: string | null;
  runtimeExecute: boolean;
}

async function publicationUpgradeState(sql: DatabaseClient): Promise<PublicationUpgradeState> {
  const rows = await sql<PublicationUpgradeState[]>`
    SELECT
      (SELECT count(*)::int FROM ens_publication_decisions) AS decisions,
      (SELECT id::text FROM ens_publication_decisions ORDER BY id LIMIT 1) AS "decisionId",
      (
        SELECT encode(sha256(convert_to(to_jsonb(d)::text, 'UTF8')), 'hex')
        FROM ens_publication_decisions d ORDER BY d.id LIMIT 1
      ) AS "decisionHash",
      (SELECT count(*)::int FROM jobs) AS jobs,
      (SELECT count(*)::int FROM effects) AS effects,
      (SELECT count(*)::int FROM receipts) AS receipts,
      encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex') AS "functionHash",
      obj_description(p.oid, 'pg_proc') AS marker,
      has_function_privilege('alphadawg_runtime', p.oid, 'EXECUTE') AS "runtimeExecute"
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admit_ens_publication_decision'
      AND p.pronargs = 6
  `;
  const state = rows[0];
  if (!state) throw new Error("publication admission function is missing from upgrade lane");
  return state;
}

async function verifyPreW7UpgradeLane(
  adminUrl: string,
  database: string,
  kind: "canonical" | "scale_alias",
): Promise<void> {
  await createDatabase(adminUrl, database);
  const url = databaseUrl(adminUrl, database);
  const sql = postgres(url, { max: 1, prepare: false });
  let fixture: W6PublicationFixture | null = null;
  try {
    for (const migration of PRE_W7_MIGRATIONS) await applyMigrationSql(sql, migration);
    markPreW7MigrationsApplied(url);
    fixture = await seedW6PublicationDecision(
      sql,
      url,
      kind === "canonical" ? "canon" : "alias",
      kind === "canonical" ? "12345" : "12345.0",
    );
    const before = await publicationUpgradeState(sql);
    if (
      before.decisions !== 1 || before.decisionId !== fixture.decisionId ||
      !before.decisionHash || before.jobs !== 0 || before.effects !== 0 ||
      before.receipts !== 0 || before.marker !== null || !before.runtimeExecute
    ) {
      throw new Error("pre-W7 upgrade fixture state is not exact");
    }

    if (kind === "canonical") {
      for (const migration of [
        A4_PUBLICATION_BLOCK_NORMALIZATION_MIGRATION,
        A4_PUBLICATION_UPGRADE_PREFLIGHT_MIGRATION,
      ]) {
        await applyMigrationSql(sql, migration);
        run(
          PRISMA,
          ["migrate", "resolve", "--applied", migration, "--schema", SCHEMA],
          prismaEnv(url),
        );
      }
      const replay = await fixture.runtimeSql<{ decision_id: string }[]>`
        SELECT decision_id::text FROM public.admit_ens_publication_decision(
          ${fixture.versionId}::uuid,
          ${fixture.runtimeSql.json(JSON.parse(JSON.stringify(fixture.record)))},
          ${"12345.0"}::numeric,
          ${fixture.blockTimestamp}::timestamptz,
          ${fixture.transactionHash},
          NULL
        )
      `;
      // The remaining W9/W5 migrations must not guess action history for this
      // synthetic W6-only fixture. After the exact W8 replay, return it to the
      // inherited lane before testing both fail-closed action-integrity migrations.
      await sql.unsafe("ALTER TABLE agent_versions DISABLE TRIGGER agent_versions_legal_lifecycle");
      try {
        await sql`UPDATE agent_versions SET lifecycle_state = NULL WHERE id = ${fixture.versionId}::uuid`;
      } finally {
        await sql.unsafe("ALTER TABLE agent_versions ENABLE TRIGGER agent_versions_legal_lifecycle");
      }
      run(PRISMA, ["migrate", "deploy", "--schema", SCHEMA], prismaEnv(url));
      const after = await publicationUpgradeState(sql);
      if (
        replay[0]?.decision_id !== fixture.decisionId || after.decisions !== 1 ||
        after.decisionId !== before.decisionId || after.decisionHash !== before.decisionHash ||
        after.jobs !== 0 || after.effects !== 0 || after.receipts !== 0 ||
        after.marker !== "alphadawg:a4-publication-upgrade-preflight:v1" ||
        !after.runtimeExecute || after.functionHash === before.functionHash
      ) {
        throw new Error("canonical W6 decision did not upgrade and replay exactly");
      }
      console.log("Canonical W6 publication decision upgraded through W7/W8 and replayed exactly");
      return;
    }

    runExpectedFailure(
      PRISMA,
      ["migrate", "deploy", "--schema", SCHEMA],
      /noncanonical durable decision evidence/,
      prismaEnv(url),
    );
    const after = await publicationUpgradeState(sql);
    const migrationRows = await sql<{
      w7_finished: number;
      w8_finished: number;
      w8_failed: number;
    }[]>`
      SELECT
        count(*) FILTER (
          WHERE migration_name = ${A4_PUBLICATION_BLOCK_NORMALIZATION_MIGRATION}
            AND finished_at IS NOT NULL
        )::int AS w7_finished,
        count(*) FILTER (
          WHERE migration_name = ${A4_PUBLICATION_UPGRADE_PREFLIGHT_MIGRATION}
            AND finished_at IS NOT NULL
        )::int AS w8_finished,
        count(*) FILTER (
          WHERE migration_name = ${A4_PUBLICATION_UPGRADE_PREFLIGHT_MIGRATION}
            AND finished_at IS NULL AND logs IS NOT NULL
        )::int AS w8_failed
      FROM "_prisma_migrations"
    `;
    if (
      after.decisions !== 1 || after.decisionId !== before.decisionId ||
      after.decisionHash !== before.decisionHash || after.jobs !== 0 ||
      after.effects !== 0 || after.receipts !== 0 || after.marker !== null ||
      !after.runtimeExecute || after.functionHash === before.functionHash ||
      migrationRows[0]?.w7_finished !== 1 || migrationRows[0]?.w8_finished !== 0 ||
      migrationRows[0]?.w8_failed !== 1
    ) {
      throw new Error("noncanonical W6 decision did not fail closed before W8 readiness");
    }
    console.log("Noncanonical W6 scale-alias decision blocked W8 with immutable evidence unchanged");
  } finally {
    await fixture?.close().catch(() => undefined);
    await sql.end({ timeout: 1 });
  }
}

async function verifyPopulatedLegacyX402UpgradeLane(
  adminUrl: string,
  database: string,
): Promise<void> {
  await createDatabase(adminUrl, database);
  const url = databaseUrl(adminUrl, database);
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    for (const migration of X402_PREDECESSOR_MIGRATIONS) {
      await applyMigrationSql(sql, migration);
      run(
        PRISMA,
        ["migrate", "resolve", "--applied", migration, "--schema", SCHEMA],
        prismaEnv(url),
      );
    }
    await sql`SET session_replication_role = replica`;
    await sql`
      INSERT INTO x402_payment_receipts (
        id, job_id, delivery_receipt_id, agent_version_id, payer_address,
        creator_recipient, network, chain_id, asset_address, amount_atomic,
        facilitator_payload, facilitator_payload_hash, transaction_hash,
        finality_block, finality_block_hash, finalized_at,
        payer_balance_delta_atomic, creator_balance_delta_atomic,
        request_hash, release_hash, release_sha, created_at
      ) VALUES (
        '10000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002',
        '10000000-0000-4000-8000-000000000003',
        '10000000-0000-4000-8000-000000000004',
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
        'base-sepolia', 84532,
        '0x036cbd53842c5426634e7929541ec2318f3dcf7e', 1000,
        ${sql.json({ legacy: true })}, ${"a".repeat(64)}, ${`0x${"b".repeat(64)}`},
        1, ${`0x${"c".repeat(64)}`}, '2026-07-25T19:59:59.000Z',
        -1000, 1000, ${"d".repeat(64)}, ${"e".repeat(64)}, ${"f".repeat(40)},
        '2026-07-25T20:00:00.000Z'
      )
    `;
    await sql`SET session_replication_role = origin`;
    run(PRISMA, ["migrate", "deploy", "--schema", SCHEMA], prismaEnv(url));
    const rows = await sql<{
      settlement_kind: string;
      transaction_hash: string | null;
      payment_attempt_id: string | null;
      gateway_transaction_id: string | null;
      migration_count: number;
    }[]>`
      SELECT settlement_kind, transaction_hash, payment_attempt_id::TEXT,
        gateway_transaction_id::TEXT,
        (SELECT count(*)::INTEGER FROM _prisma_migrations
          WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migration_count
      FROM x402_payment_receipts
      WHERE id = '10000000-0000-4000-8000-000000000001'::uuid
    `;
    const row = rows[0];
    if (
      row?.settlement_kind !== "LEGACY_EVM" ||
      row.transaction_hash !== `0x${"b".repeat(64)}` ||
      row.payment_attempt_id !== null ||
      row.gateway_transaction_id !== null ||
      row.migration_count !== 19
    ) {
      throw new Error("populated legacy x402 receipt did not upgrade exactly");
    }
    console.log("Populated legacy x402 receipt preserved through Gateway schema upgrade");
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function verifyDatabase(
  url: string,
  expectedUsers: number,
  expectedNextSequenceValue: number,
  expectedSentinel: SentinelSnapshot | null,
): Promise<void> {
  run(PRISMA, ["migrate", "status", "--schema", SCHEMA], prismaEnv(url));
  const sql = postgres(url, { max: 1 });
  try {
    const relations = await sql<{
      users: string | null;
      sequence: string | null;
      auth_challenges: string | null;
      agent_versions: string | null;
      jobs: string | null;
      effects: string | null;
      worker_leases: string | null;
      a3_execution_journals: string | null;
      ens_authority_bindings: string | null;
      ens_authority_checks: string | null;
      ens_publication_decisions: string | null;
      ens_publication_authority_releases: string | null;
      ens_publication_authority_policies: string | null;
      agent_version_events: string | null;
      agent_lifecycle_actions: string | null;
      goals: string | null;
      goal_runs: string | null;
      goal_run_jobs: string | null;
      agent_version_provenance: string | null;
      goal_mutations: string | null;
      mcp_invocations: string | null;
      augmented_layer_policies: string | null;
      augmented_layer_policy_mutations: string | null;
      cost_reserved_at: string | null;
      user_count: string;
      migration_count: string;
      baseline_count: string;
      a2_count: string;
      a3_count: string;
      a4_count: string;
      a5_count: string;
      a4_publication_count: string;
      a4_publication_authority_count: string;
      a4_publication_hardening_count: string;
      a4_publication_block_normalization_count: string;
      a4_publication_upgrade_preflight_count: string;
      a4_kernel_publication_integrity_count: string;
      a4_kernel_action_integrity_count: string;
      invariant_trigger_count: string;
      a4_constraint_count: string;
      a4_publication_constraint_count: string;
      a4_publication_authority_constraint_count: string;
      a4_publication_authority_function_count: string;
      a4_publication_trigger_hardening_count: string;
      a4_publication_runtime_role_count: string;
      a4_publication_runtime_direct_privilege_count: string;
      a4_publication_hardening_constraint_count: string;
      a4_publication_block_function_count: string;
      a4_publication_upgrade_marker_count: string;
      a4_publication_old_function_count: string;
      a5_constraint_count: string;
      a4_kernel_publication_constraint_count: string;
      a4_kernel_publication_function_count: string;
      a4_kernel_action_index_count: string;
      receipt_authority_nullable: string;
      lifecycle_action_nullable: string;
      uniswap_tool_receipts: string | null;
      x402_payment_receipts: string | null;
      x402_payment_attempts: string | null;
      a6_uniswap_tool_receipt_count: string;
      a5_a6_kernel_foundation_count: string;
      a5_a6_kernel_constraint_count: string;
      protected_goal_loop_count: string;
      protected_goal_loop_constraint_count: string;
      protected_goal_loop_trigger_count: string;
      goal_loop_hardening_count: string;
      goal_loop_hardening_constraint_count: string;
      goal_loop_hardening_trigger_count: string;
      agent_manifest_v3_mcp_evidence_count: string;
      agent_manifest_v3_mcp_constraint_count: string;
      agent_manifest_v3_mcp_trigger_count: string;
      tri_risk_augmented_layer_count: string;
      tri_risk_constraint_count: string;
      tri_risk_trigger_count: string;
      tri_risk_index_count: string;
      x402_lane_payments_count: string;
      x402_lane_constraint_count: string;
      x402_lane_trigger_count: string;
      manifest_v4_function_count: string;
      mcp_v4_function_count: string;
      sequence_type: string;
      sequence_start: string;
      sequence_min: string;
      sequence_max: string;
      sequence_increment: string;
      sequence_cache: string;
      sequence_cycle: boolean;
    }[]>`
      SELECT
        to_regclass('public.users')::text AS users,
        to_regclass('public.hot_wallet_index_seq')::text AS sequence,
        to_regclass('public.auth_challenges')::text AS auth_challenges,
        to_regclass('public.agent_versions')::text AS agent_versions,
        to_regclass('public.jobs')::text AS jobs,
        to_regclass('public.effects')::text AS effects,
        to_regclass('public.worker_leases')::text AS worker_leases,
        to_regclass('public.a3_execution_journals')::text AS a3_execution_journals,
        to_regclass('public.ens_authority_bindings')::text AS ens_authority_bindings,
        to_regclass('public.ens_authority_checks')::text AS ens_authority_checks,
        to_regclass('public.ens_publication_decisions')::text AS ens_publication_decisions,
        to_regclass('public.ens_publication_authority_releases')::text AS ens_publication_authority_releases,
        to_regclass('public.ens_publication_authority_policies')::text AS ens_publication_authority_policies,
        to_regclass('public.agent_version_events')::text AS agent_version_events,
        to_regclass('public.agent_lifecycle_actions')::text AS agent_lifecycle_actions,
        to_regclass('public.goals')::text AS goals,
        to_regclass('public.goal_runs')::text AS goal_runs,
        to_regclass('public.goal_run_jobs')::text AS goal_run_jobs,
        to_regclass('public.agent_version_provenance')::text AS agent_version_provenance,
        to_regclass('public.goal_mutations')::text AS goal_mutations,
        to_regclass('public.mcp_invocations')::text AS mcp_invocations,
        to_regclass('public.augmented_layer_policies')::text AS augmented_layer_policies,
        to_regclass('public.augmented_layer_policy_mutations')::text AS augmented_layer_policy_mutations,
        (
          SELECT is_nullable FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'goal_runs'
            AND column_name = 'cost_reserved_at'
        ) AS cost_reserved_at,
        (SELECT count(*)::text FROM users) AS user_count,
        (
          SELECT count(*)::text
          FROM "_prisma_migrations"
          WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
        ) AS migration_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${BASELINE_MIGRATION} AND finished_at IS NOT NULL
        ) AS baseline_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${A2_MIGRATION} AND finished_at IS NOT NULL
        ) AS a2_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${A3_MIGRATION} AND finished_at IS NOT NULL
        ) AS a3_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${A4_MIGRATION} AND finished_at IS NOT NULL
        ) AS a4_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${A5_MIGRATION} AND finished_at IS NOT NULL
        ) AS a5_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${A4_PUBLICATION_MIGRATION} AND finished_at IS NOT NULL
        ) AS a4_publication_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${A4_PUBLICATION_AUTHORITY_MIGRATION} AND finished_at IS NOT NULL
        ) AS a4_publication_authority_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${A4_PUBLICATION_HARDENING_MIGRATION} AND finished_at IS NOT NULL
        ) AS a4_publication_hardening_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${A4_PUBLICATION_BLOCK_NORMALIZATION_MIGRATION}
            AND finished_at IS NOT NULL
        ) AS a4_publication_block_normalization_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${A4_PUBLICATION_UPGRADE_PREFLIGHT_MIGRATION}
            AND finished_at IS NOT NULL
        ) AS a4_publication_upgrade_preflight_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${A4_KERNEL_PUBLICATION_INTEGRITY_MIGRATION}
            AND finished_at IS NOT NULL
        ) AS a4_kernel_publication_integrity_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${A4_KERNEL_ACTION_INTEGRITY_MIGRATION}
            AND finished_at IS NOT NULL
        ) AS a4_kernel_action_integrity_count,
        (
          SELECT count(*)::text FROM pg_trigger
          WHERE NOT tgisinternal AND tgname IN (
            'agent_versions_immutable_published',
            'job_events_append_only',
            'jobs_legal_transitions',
            'effects_legal_transitions',
            'settlements_exclusive_verified',
            'refunds_exclusive_terminal',
            'commissions_verified_settlement_only',
            'a3_journals_legal_transitions',
            'ens_authority_bindings_immutable',
            'ens_authority_checks_append_only',
            'receipts_require_ens_authority',
            'agent_versions_legal_lifecycle',
            'agent_version_events_append_only',
            'ens_publication_decisions_append_only',
            'ens_publication_authority_releases_append_only',
            'ens_publication_authority_releases_no_truncate',
            'ens_publication_authority_policies_append_only',
            'ens_publication_authority_policies_no_truncate',
            'agent_lifecycle_actions_integrity',
            'agent_lifecycle_actions_no_truncate',
            'agent_versions_publication_integrity',
            'agent_version_events_publication_integrity',
            'agent_lifecycle_actions_event_integrity',
            'agent_version_events_action_integrity',
            'agent_versions_action_integrity',
            'agent_versions_manifest_v2_publication',
            'x402_payment_receipts_lineage',
            'x402_payment_receipts_immutable',
            'x402_payment_receipts_no_truncate',
            'uniswap_tool_receipts_legal_transitions',
            'uniswap_tool_receipts_append_only',
            'uniswap_tool_receipts_no_truncate'
          )
        ) AS invariant_trigger_count,
        (
          SELECT count(*)::text FROM pg_constraint
          WHERE conname IN (
            'ens_bindings_effect_fk', 'ens_bindings_job_fk', 'ens_bindings_version_fk',
            'ens_checks_binding_fk', 'ens_checks_job_fk', 'ens_checks_version_fk',
            'receipts_authority_check_fk', 'ens_bindings_hash_check',
            'ens_bindings_address_check', 'ens_bindings_bounds_check',
            'ens_checks_binding_hash_check', 'ens_checks_phase_check',
            'ens_checks_decision_check', 'ens_checks_observation_check'
          )
        ) AS a4_constraint_count,
        (
          SELECT count(*)::text FROM pg_constraint
          WHERE conname IN (
            'ens_publication_version_fkey',
            'ens_publication_hash_shape_check',
            'ens_publication_name_shape_check',
            'ens_publication_address_shape_check',
            'ens_publication_bounds_check',
            'ens_publication_hierarchy_shape_check',
            'ens_publication_decision_shape_check'
          )
        ) AS a4_publication_constraint_count,
        (
          SELECT count(*)::text FROM pg_constraint
          WHERE conname IN (
            'ens_publication_authority_releases_pkey',
            'ens_publication_authority_release_sha_check',
            'ens_publication_authority_release_window_check'
          )
        ) AS a4_publication_authority_constraint_count,
        (
          SELECT count(*)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'admit_ens_publication_decision'
            AND p.prosecdef
            AND p.pronargs = 6
            AND p.proconfig @> ARRAY['search_path=pg_catalog, pg_temp', 'TimeZone=UTC']
            AND NOT has_function_privilege('public', p.oid, 'EXECUTE')
            AND has_function_privilege('alphadawg_runtime', p.oid, 'EXECUTE')
            AND pg_get_userbyid(p.proowner) <> 'alphadawg_runtime'
        ) AS a4_publication_authority_function_count,
        (
          SELECT count(*)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'enforce_ens_publication_decision'
            AND p.proconfig = ARRAY['search_path=pg_catalog, public, pg_temp']
            AND NOT has_schema_privilege('alphadawg_runtime', 'public', 'CREATE')
            AND NOT has_schema_privilege('public', 'public', 'CREATE')
        ) AS a4_publication_trigger_hardening_count,
        (
          SELECT count(*)::text FROM pg_roles
          WHERE rolname = 'alphadawg_runtime' AND NOT rolcanlogin AND NOT rolsuper
            AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication
            AND NOT rolbypassrls AND rolinherit
        ) AS a4_publication_runtime_role_count,
        (
          SELECT (
            CASE WHEN has_table_privilege('alphadawg_runtime', 'public.ens_publication_decisions', 'INSERT')
              OR has_table_privilege('alphadawg_runtime', 'public.ens_publication_decisions', 'UPDATE')
              OR has_table_privilege('alphadawg_runtime', 'public.ens_publication_decisions', 'DELETE')
              OR has_table_privilege('alphadawg_runtime', 'public.ens_publication_decisions', 'TRUNCATE')
              OR has_table_privilege('alphadawg_runtime', 'public.ens_publication_authority_releases', 'INSERT')
              OR has_table_privilege('alphadawg_runtime', 'public.ens_publication_authority_releases', 'UPDATE')
              OR has_table_privilege('alphadawg_runtime', 'public.ens_publication_authority_releases', 'DELETE')
              OR has_table_privilege('alphadawg_runtime', 'public.ens_publication_authority_releases', 'TRUNCATE')
              OR has_table_privilege('alphadawg_runtime', 'public.ens_publication_authority_policies', 'SELECT')
              OR has_table_privilege('alphadawg_runtime', 'public.ens_publication_authority_policies', 'INSERT')
              OR has_table_privilege('alphadawg_runtime', 'public.ens_publication_authority_policies', 'UPDATE')
              OR has_table_privilege('alphadawg_runtime', 'public.ens_publication_authority_policies', 'DELETE')
              OR has_table_privilege('alphadawg_runtime', 'public.ens_publication_authority_policies', 'TRUNCATE')
            THEN 1 ELSE 0 END
          )::text
        ) AS a4_publication_runtime_direct_privilege_count,
        (
          SELECT count(*)::text FROM pg_constraint
          WHERE conname IN (
            'ens_publication_authority_release_finite_check',
            'ens_publication_authority_release_max_24h_check',
            'ens_publication_authority_release_no_overlap',
            'ens_publication_authority_policies_pkey',
            'ens_publication_authority_policy_release_fkey',
            'ens_publication_authority_policy_version_fkey',
            'ens_publication_authority_policy_hash_check',
            'ens_publication_authority_policy_size_check',
            'ens_publication_authority_policy_release_version_key',
            'ens_publication_authority_policy_release_binding_key'
          )
        ) AS a4_publication_hardening_constraint_count,
        (
          SELECT count(*)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'admit_ens_publication_decision'
            AND position('normalized_block_number NUMERIC(20,0)' in p.prosrc) > 0
            AND position('p_block_number <> pg_catalog.trunc(p_block_number)' in p.prosrc) > 0
            AND position('''blockNumber'', normalized_block_number_text' in p.prosrc) > 0
            AND position(
              'record_bytes, record_hash, normalized_block_number, p_block_timestamp' in p.prosrc
            ) > 0
            AND position(
              '''blockNumber'', CASE WHEN p_block_number IS NULL THEN NULL ELSE p_block_number::text END'
              in p.prosrc
            ) = 0
            AND position(
              'record_bytes, record_hash, p_block_number, p_block_timestamp' in p.prosrc
            ) = 0
        ) AS a4_publication_block_function_count,
        (
          SELECT count(*)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'admit_ens_publication_decision'
            AND p.pronargs = 6
            AND obj_description(p.oid, 'pg_proc') =
              'alphadawg:a4-publication-upgrade-preflight:v1'
        ) AS a4_publication_upgrade_marker_count,
        (
          SELECT count(*)::text
          FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'admit_ens_publication_decision'
            AND p.pronargs = 8
        ) AS a4_publication_old_function_count,
        (
          SELECT count(*)::text FROM pg_constraint
          WHERE conname IN (
            'agent_versions_lifecycle_state_check',
            'agent_versions_canonical_state_check',
            'agent_versions_name_binding_check',
            'agent_versions_write_plan_check',
            'agent_versions_hash_shape_check',
            'agent_versions_authority_address_check',
            'agent_versions_authority_time_check',
            'agent_versions_protected_publish_check',
            'agent_version_events_version_fkey',
            'agent_version_events_sequence_check',
            'agent_version_events_action_check'
          )
        ) AS a5_constraint_count,
        (
          SELECT count(*)::text FROM pg_constraint
          WHERE conname IN (
            'agent_versions_publication_decision_fkey',
            'agent_versions_publication_decision_state_check',
            'agent_lifecycle_actions_pkey',
            'agent_lifecycle_actions_owner_fkey',
            'agent_lifecycle_actions_version_fkey',
            'agent_lifecycle_actions_action_check',
            'agent_lifecycle_actions_key_check',
            'agent_lifecycle_actions_hash_check',
            'agent_lifecycle_actions_owner_action_key',
            'agent_lifecycle_actions_target_version_fkey',
            'agent_lifecycle_actions_status_check',
            'agent_lifecycle_actions_attempt_check',
            'agent_lifecycle_actions_result_hash_check',
            'agent_lifecycle_actions_error_code_check',
            'agent_lifecycle_actions_target_check',
            'agent_lifecycle_actions_state_check',
            'agent_versions_publication_action_fkey',
            'agent_versions_publication_action_state_check',
            'agent_version_events_lifecycle_action_fkey'
          )
        ) AS a4_kernel_publication_constraint_count,
        (
          SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname IN (
            'enforce_agent_lifecycle_action',
            'enforce_agent_action_event_integrity',
            'canonical_kernel_json',
            'kernel_lifecycle_hash',
            'enforce_agent_publication_integrity'
          )
        ) AS a4_kernel_publication_function_count,
        (
          SELECT count(*)::text FROM pg_indexes
          WHERE schemaname = 'public' AND indexname IN (
            'agent_versions_publication_action_key',
            'agent_lifecycle_actions_success_version_key',
            'agent_version_events_lifecycle_action_key'
          ) AND indexdef LIKE 'CREATE UNIQUE INDEX%'
        ) AS a4_kernel_action_index_count,
        (
          SELECT is_nullable FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'receipts'
            AND column_name = 'authority_check_id'
        ) AS receipt_authority_nullable,
        (
          SELECT is_nullable FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'agent_version_events'
            AND column_name = 'lifecycle_action_id'
        ) AS lifecycle_action_nullable,
        to_regclass('public.uniswap_tool_receipts')::text AS uniswap_tool_receipts,
        to_regclass('public.x402_payment_receipts')::text AS x402_payment_receipts,
        to_regclass('public.x402_payment_attempts')::text AS x402_payment_attempts,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${A6_UNISWAP_TOOL_RECEIPT_MIGRATION} AND finished_at IS NOT NULL
        ) AS a6_uniswap_tool_receipt_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${A5_A6_KERNEL_FOUNDATION_MIGRATION} AND finished_at IS NOT NULL
        ) AS a5_a6_kernel_foundation_count,
        (
          SELECT count(*)::text FROM pg_constraint
          WHERE conname IN (
            'agent_versions_manifest_schema_check',
            'agent_versions_manifest_v2_shape_check',
            'x402_receipts_exact_payment_check',
            'x402_receipts_address_check',
            'x402_receipts_hash_check',
            'x402_receipts_finality_check',
            'uniswap_receipts_job_fk',
            'uniswap_receipts_version_fk',
            'uniswap_receipts_amount_check',
            'uniswap_receipts_slippage_check',
            'uniswap_receipts_status_check',
            'uniswap_receipts_hash_check',
            'uniswap_receipts_terminal_shape_check',
            'uniswap_receipts_chain_is_unichain_sepolia'
          )
        ) AS a5_a6_kernel_constraint_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${PROTECTED_GOAL_LOOP_MIGRATION} AND finished_at IS NOT NULL
        ) AS protected_goal_loop_count,
        (
          SELECT count(*)::text FROM pg_constraint
          WHERE conname IN (
            'goals_limits_check',
            'goals_schedule_check',
            'goal_runs_snapshot_check',
            'goal_runs_report_check',
            'goal_runs_terminal_check',
            'goal_runs_claim_check',
            'goal_run_jobs_role_check',
            'goal_run_jobs_price_check',
            'agent_version_provenance_protocol_check',
            'agent_version_provenance_address_check',
            'agent_version_provenance_uri_check',
            'agent_version_provenance_hash_check'
          )
        ) AS protected_goal_loop_constraint_count,
        (
          SELECT count(*)::text FROM pg_trigger
          WHERE NOT tgisinternal AND tgname IN (
            'goals_legal_transition',
            'goal_runs_legal_transition',
            'goal_runs_snapshot_immutable',
            'goal_run_jobs_immutable',
            'agent_version_provenance_append_only'
          )
        ) AS protected_goal_loop_trigger_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${GOAL_LOOP_HARDENING_MIGRATION} AND finished_at IS NOT NULL
        ) AS goal_loop_hardening_count,
        (
          SELECT count(*)::text FROM pg_constraint
          WHERE conname IN (
            'goal_runs_reservation_check',
            'goal_runs_report_binding_check',
            'goals_id_owner_key',
            'goal_mutations_goal_owner_fkey',
            'goal_mutations_result_check'
          )
        ) AS goal_loop_hardening_constraint_count,
        (
          SELECT count(*)::text FROM pg_trigger
          WHERE NOT tgisinternal AND tgname IN (
            'goal_runs_reservation_immutable',
            'goal_runs_terminal_immutable',
            'goal_mutations_append_only',
            'goal_mutations_no_truncate',
            'goal_run_jobs_terminal_mutation_guard'
          )
        ) AS goal_loop_hardening_trigger_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${AGENT_MANIFEST_V3_MCP_EVIDENCE_MIGRATION}
            AND finished_at IS NOT NULL
        ) AS agent_manifest_v3_mcp_evidence_count,
        (
          SELECT count(*)::text FROM pg_constraint
          WHERE conname IN (
            'agent_versions_manifest_v3_shape_check',
            'mcp_invocations_goal_run_job_id_fkey',
            'mcp_invocations_agent_version_id_fkey',
            'mcp_invocations_hash_check',
            'mcp_invocations_binding_check',
            'mcp_invocations_terminal_check',
            'mcp_invocations_state_check'
          )
        ) AS agent_manifest_v3_mcp_constraint_count,
        (
          SELECT count(*)::text FROM pg_trigger
          WHERE NOT tgisinternal AND tgname IN (
            'mcp_invocations_lineage',
            'mcp_invocations_append_only',
            'mcp_invocations_no_truncate'
          )
        ) AS agent_manifest_v3_mcp_trigger_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${TRI_RISK_AUGMENTED_LAYER_MIGRATION}
            AND finished_at IS NOT NULL
        ) AS tri_risk_augmented_layer_count,
        (
          SELECT count(*)::text FROM pg_constraint
          WHERE conname IN (
            'agent_versions_manifest_v4_shape_check',
            'goals_policy_version_check',
            'goal_runs_policy_shape_check',
            'augmented_layer_policies_hash_check',
            'augmented_layer_policies_policy_check',
            'augmented_layer_policy_mutations_key_check',
            'augmented_layer_policy_mutations_hash_check',
            'augmented_layer_policy_mutations_result_check',
            'goal_run_jobs_risk_lane_check',
            'goal_runs_tri_risk_report_check'
          )
        ) AS tri_risk_constraint_count,
        (
          SELECT count(*)::text FROM pg_trigger
          WHERE NOT tgisinternal AND tgname IN (
            'augmented_layer_policies_integrity',
            'augmented_layer_policy_mutations_append_only',
            'augmented_layer_policy_mutations_no_truncate'
          )
        ) AS tri_risk_trigger_count,
        (
          SELECT count(*)::text FROM pg_indexes
          WHERE schemaname = 'public' AND indexname IN (
            'uniq_goal_run_jobs_risk_lane',
            'uniq_augmented_layer_policy_mutations_owner_key',
            'idx_augmented_layer_policy_mutations_owner_created'
          )
        ) AS tri_risk_index_count,
        (
          SELECT count(*)::text FROM "_prisma_migrations"
          WHERE migration_name = ${X402_LANE_PAYMENTS_MIGRATION}
            AND finished_at IS NOT NULL
        ) AS x402_lane_payments_count,
        (
          SELECT count(*)::text FROM pg_constraint
          WHERE conname IN (
            'x402_attempts_state_check',
            'x402_attempts_identity_check',
            'x402_attempts_state_shape_check',
            'x402_receipts_settlement_kind_check'
          )
        ) AS x402_lane_constraint_count,
        (
          SELECT count(*)::text FROM pg_trigger
          WHERE NOT tgisinternal AND tgname IN (
            'x402_payment_attempts_integrity',
            'x402_payment_attempts_no_delete',
            'x402_payment_attempts_no_truncate'
          )
        ) AS x402_lane_trigger_count,
        (
          SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'enforce_manifest_v2_publication'
            AND position($needle$NEW.manifest->>'schemaVersion' IN ('3', '4')$needle$ in p.prosrc) > 0
            AND position($needle$jsonb_build_object('riskTiers', NEW.manifest->'riskTiers')$needle$ in p.prosrc) > 0
            AND position($needle$NOT IN ('2', '3', '4')$needle$ in p.prosrc) > 0
        ) AS manifest_v4_function_count,
        (
          SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = 'enforce_mcp_invocation_lineage'
            AND position($needle$NOT IN ('3', '4')$needle$ in p.prosrc) > 0
        ) AS mcp_v4_function_count,
        seq.data_type AS sequence_type,
        seq.start_value::text AS sequence_start,
        seq.min_value::text AS sequence_min,
        seq.max_value::text AS sequence_max,
        seq.increment_by::text AS sequence_increment,
        seq.cache_size::text AS sequence_cache,
        seq.cycle AS sequence_cycle
      FROM pg_sequences AS seq
      WHERE seq.schemaname = 'public' AND seq.sequencename = 'hot_wallet_index_seq'
    `;
    const result = relations[0];
    if (
      result?.users !== "users" ||
      result.sequence !== "hot_wallet_index_seq" ||
      result.auth_challenges !== "auth_challenges" ||
      result.agent_versions !== "agent_versions" ||
      result.jobs !== "jobs" ||
      result.effects !== "effects" ||
      result.worker_leases !== "worker_leases" ||
      result.a3_execution_journals !== "a3_execution_journals" ||
      result.ens_authority_bindings !== "ens_authority_bindings" ||
      result.ens_authority_checks !== "ens_authority_checks" ||
      result.ens_publication_decisions !== "ens_publication_decisions" ||
      result.ens_publication_authority_releases !== "ens_publication_authority_releases" ||
      result.ens_publication_authority_policies !== "ens_publication_authority_policies" ||
      result.agent_version_events !== "agent_version_events" ||
      result.agent_lifecycle_actions !== "agent_lifecycle_actions" ||
      result.goals !== "goals" ||
      result.goal_runs !== "goal_runs" ||
      result.goal_run_jobs !== "goal_run_jobs" ||
      result.agent_version_provenance !== "agent_version_provenance" ||
      result.goal_mutations !== "goal_mutations" ||
      result.mcp_invocations !== "mcp_invocations" ||
      result.augmented_layer_policies !== "augmented_layer_policies" ||
      result.augmented_layer_policy_mutations !== "augmented_layer_policy_mutations" ||
      result.x402_payment_attempts !== "x402_payment_attempts" ||
      result.cost_reserved_at !== "YES" ||
      Number(result.user_count) !== expectedUsers ||
      Number(result.migration_count) !== 19 ||
      Number(result.baseline_count) !== 1 ||
      Number(result.a2_count) !== 1 ||
      Number(result.a3_count) !== 1 ||
      Number(result.a4_count) !== 1 ||
      Number(result.a5_count) !== 1 ||
      Number(result.a4_publication_count) !== 1 ||
      Number(result.a4_publication_authority_count) !== 1 ||
      Number(result.a4_publication_hardening_count) !== 1 ||
      Number(result.a4_publication_block_normalization_count) !== 1 ||
      Number(result.a4_publication_upgrade_preflight_count) !== 1 ||
      Number(result.a4_kernel_publication_integrity_count) !== 1 ||
      Number(result.a4_kernel_action_integrity_count) !== 1 ||
      Number(result.invariant_trigger_count) !== 32 ||
      Number(result.a4_constraint_count) !== 14 ||
      Number(result.a4_publication_constraint_count) !== 7 ||
      Number(result.a4_publication_authority_constraint_count) !== 3 ||
      Number(result.a4_publication_authority_function_count) !== 1 ||
      Number(result.a4_publication_trigger_hardening_count) !== 1 ||
      Number(result.a4_publication_runtime_role_count) !== 1 ||
      Number(result.a4_publication_runtime_direct_privilege_count) !== 0 ||
      Number(result.a4_publication_hardening_constraint_count) !== 10 ||
      Number(result.a4_publication_block_function_count) !== 1 ||
      Number(result.a4_publication_upgrade_marker_count) !== 1 ||
      Number(result.a4_publication_old_function_count) !== 0 ||
      Number(result.a5_constraint_count) !== 11 ||
      Number(result.a4_kernel_publication_constraint_count) !== 19 ||
      Number(result.a4_kernel_publication_function_count) !== 5 ||
      Number(result.a4_kernel_action_index_count) !== 3 ||
      result.uniswap_tool_receipts !== "uniswap_tool_receipts" ||
      result.x402_payment_receipts !== "x402_payment_receipts" ||
      Number(result.a6_uniswap_tool_receipt_count) !== 1 ||
      Number(result.a5_a6_kernel_foundation_count) !== 1 ||
      Number(result.a5_a6_kernel_constraint_count) !== 14 ||
      Number(result.protected_goal_loop_count) !== 1 ||
      Number(result.protected_goal_loop_constraint_count) !== 12 ||
      Number(result.protected_goal_loop_trigger_count) !== 5 ||
      Number(result.goal_loop_hardening_count) !== 1 ||
      Number(result.goal_loop_hardening_constraint_count) !== 5 ||
      Number(result.goal_loop_hardening_trigger_count) !== 5 ||
      Number(result.agent_manifest_v3_mcp_evidence_count) !== 1 ||
      Number(result.agent_manifest_v3_mcp_constraint_count) !== 7 ||
      Number(result.agent_manifest_v3_mcp_trigger_count) !== 3 ||
      Number(result.tri_risk_augmented_layer_count) !== 1 ||
      Number(result.tri_risk_constraint_count) !== 10 ||
      Number(result.tri_risk_trigger_count) !== 3 ||
      Number(result.tri_risk_index_count) !== 3 ||
      Number(result.x402_lane_payments_count) !== 1 ||
      Number(result.x402_lane_constraint_count) !== 4 ||
      Number(result.x402_lane_trigger_count) !== 3 ||
      Number(result.manifest_v4_function_count) !== 1 ||
      Number(result.mcp_v4_function_count) !== 1 ||
      result.receipt_authority_nullable !== "NO" ||
      result.lifecycle_action_nullable !== "NO" ||
      result.sequence_type !== "bigint" ||
      result.sequence_start !== "1" ||
      result.sequence_min !== "1" ||
      result.sequence_max !== "9223372036854775807" ||
      result.sequence_increment !== "1" ||
      result.sequence_cache !== "1" ||
      result.sequence_cycle !== false
    ) {
      throw new Error("disposable database failed baseline relation, sequence, data, or migration-history checks");
    }
    const nextRows = await sql<{ next_value: string }[]>`
      SELECT nextval('hot_wallet_index_seq')::text AS next_value
    `;
    if (Number(nextRows[0]?.next_value) !== expectedNextSequenceValue) {
      throw new Error("disposable database failed sequence-state preservation check");
    }
    if (expectedSentinel) {
      const observedSentinel = await snapshotSentinel(sql);
      if (
        observedSentinel.id !== expectedSentinel.id ||
        observedSentinel.walletAddress !== expectedSentinel.walletAddress ||
        observedSentinel.sha256 !== expectedSentinel.sha256
      ) {
        throw new Error("synthetic Cannes sentinel identity or value hash changed across baseline resolution");
      }
      console.log(`Synthetic Cannes sentinel preserved: sha256=${observedSentinel.sha256}`);
    }
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function verifyInheritedRuntimeRoleBlocksHardening(
  adminUrl: string,
  database: string,
): Promise<void> {
  const url = databaseUrl(adminUrl, database);
  await createDatabase(adminUrl, database);
  const sql = postgres(url, { max: 1, prepare: false });
  const parent = `a4_migration_parent_${process.pid}`;
  const nested = `a4_migration_nested_${process.pid}`;
  try {
    for (const migration of PRE_HARDENING_MIGRATIONS) {
      const migrationSql = await readFile(
        resolve(ROOT, "prisma/migrations", migration, "migration.sql"),
        "utf8",
      );
      await sql.unsafe(migrationSql);
    }
    await sql.unsafe(
      `CREATE ROLE "${parent}" NOLOGIN; CREATE ROLE "${nested}" NOLOGIN; ` +
      `GRANT "${parent}" TO alphadawg_runtime; GRANT "${nested}" TO "${parent}"`,
    );
    const hardeningSql = await readFile(
      resolve(ROOT, "prisma/migrations", A4_PUBLICATION_HARDENING_MIGRATION, "migration.sql"),
      "utf8",
    );
    let rejected = false;
    try {
      await sql.unsafe(hardeningSql);
    } catch (error) {
      rejected = error instanceof Error && /must not inherit any parent role/.test(error.message);
    }
    if (!rejected) throw new Error("W6 migration accepted inherited alphadawg_runtime authority");
    console.log("W6 migration rejected direct and nested alphadawg_runtime parent membership");
  } finally {
    await sql.unsafe(
      `REVOKE "${nested}" FROM "${parent}"; ` +
      `REVOKE "${parent}" FROM alphadawg_runtime; ` +
      `DROP ROLE IF EXISTS "${nested}"; DROP ROLE IF EXISTS "${parent}"`,
    ).catch(() => undefined);
    await sql.end({ timeout: 1 });
  }
}

async function main(): Promise<void> {
  verifyPipelineTimestampFallback();
  await verifyUpgradePreflightSqlOrdering();
  const suppliedUrl = process.env.TEST_DATABASE_URL;
  const local = suppliedUrl ? null : await startLocalPostgres();
  const adminUrl = suppliedUrl ?? local?.adminUrl;
  if (!adminUrl || !isLoopbackDatabaseUrl(adminUrl)) {
    await local?.close();
    throw new Error("TEST_DATABASE_URL must target a loopback PostgreSQL server");
  }

  const suffix = `${process.pid}_${Date.now().toString(36)}`;
  const emptyDatabase = `alphadawg_a1_empty_${suffix}`;
  const cannesDatabase = `alphadawg_a1_cannes_${suffix}`;
  const unsafeRoleDatabase = `alphadawg_a4_unsafe_role_${suffix}`;
  const canonicalUpgradeDatabase = `alphadawg_a4_w6_canonical_${suffix}`;
  const noncanonicalUpgradeDatabase = `alphadawg_a4_w6_noncanonical_${suffix}`;
  const populatedGoalLoopDatabase = `alphadawg_goal_loop_populated_${suffix}`;
  const populatedLegacyX402Database = `alphadawg_x402_legacy_${suffix}`;
  const emptyUrl = databaseUrl(adminUrl, emptyDatabase);
  const cannesUrl = databaseUrl(adminUrl, cannesDatabase);

  try {
    await createDatabase(adminUrl, emptyDatabase);
    await createDatabase(adminUrl, cannesDatabase);

    run(PRISMA, ["migrate", "deploy", "--schema", SCHEMA], prismaEnv(emptyUrl));
    await verifyDatabase(emptyUrl, 0, 1, null);

    const sentinelBeforeResolution = await prepareCannesShape(cannesUrl);
    run(
      PRISMA,
      ["migrate", "resolve", "--applied", BASELINE_MIGRATION, "--schema", SCHEMA],
      prismaEnv(cannesUrl),
    );
    run(PRISMA, ["migrate", "deploy", "--schema", SCHEMA], prismaEnv(cannesUrl));
    await verifyDatabase(cannesUrl, 1, 43, sentinelBeforeResolution);
    await verifyInheritedRuntimeRoleBlocksHardening(adminUrl, unsafeRoleDatabase);
    await verifyPopulatedGoalLoopUpgradeLane(adminUrl, populatedGoalLoopDatabase);
    await verifyPopulatedLegacyX402UpgradeLane(adminUrl, populatedLegacyX402Database);
    await verifyPreW7UpgradeLane(adminUrl, canonicalUpgradeDatabase, "canonical");
    await verifyPreW7UpgradeLane(adminUrl, noncanonicalUpgradeDatabase, "scale_alias");

    console.log(
      "Migration replay passed: fresh/Cannes, populated goal-loop, and canonical/noncanonical W6 upgrade lanes",
    );
  } finally {
    await dropDatabase(adminUrl, emptyDatabase).catch(() => undefined);
    await dropDatabase(adminUrl, cannesDatabase).catch(() => undefined);
    await dropDatabase(adminUrl, unsafeRoleDatabase).catch(() => undefined);
    await dropDatabase(adminUrl, canonicalUpgradeDatabase).catch(() => undefined);
    await dropDatabase(adminUrl, noncanonicalUpgradeDatabase).catch(() => undefined);
    await dropDatabase(adminUrl, populatedGoalLoopDatabase).catch(() => undefined);
    await dropDatabase(adminUrl, populatedLegacyX402Database).catch(() => undefined);
    await local?.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Migration replay failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
