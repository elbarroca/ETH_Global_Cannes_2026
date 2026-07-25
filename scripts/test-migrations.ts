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
const PRE_HARDENING_MIGRATIONS = [
  BASELINE_MIGRATION,
  A2_MIGRATION,
  A3_MIGRATION,
  A4_MIGRATION,
  A5_MIGRATION,
  A4_PUBLICATION_MIGRATION,
  A4_PUBLICATION_AUTHORITY_MIGRATION,
] as const;
const BASELINE_SQL = resolve(ROOT, "prisma/migrations", BASELINE_MIGRATION, "migration.sql");
const SENTINEL_ID = "a1-cannes-sentinel";
const SENTINEL_WALLET = "0xa1cannessentinel";
const SENTINEL_TIMESTAMP = "2026-07-24T00:00:00.000Z";

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
      a4_publication_old_function_count: string;
      a5_constraint_count: string;
      receipt_authority_nullable: string;
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
            'ens_publication_authority_policies_no_truncate'
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
          SELECT is_nullable FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'receipts'
            AND column_name = 'authority_check_id'
        ) AS receipt_authority_nullable,
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
      Number(result.user_count) !== expectedUsers ||
      Number(result.migration_count) !== 9 ||
      Number(result.baseline_count) !== 1 ||
      Number(result.a2_count) !== 1 ||
      Number(result.a3_count) !== 1 ||
      Number(result.a4_count) !== 1 ||
      Number(result.a5_count) !== 1 ||
      Number(result.a4_publication_count) !== 1 ||
      Number(result.a4_publication_authority_count) !== 1 ||
      Number(result.a4_publication_hardening_count) !== 1 ||
      Number(result.a4_publication_block_normalization_count) !== 1 ||
      Number(result.invariant_trigger_count) !== 18 ||
      Number(result.a4_constraint_count) !== 14 ||
      Number(result.a4_publication_constraint_count) !== 7 ||
      Number(result.a4_publication_authority_constraint_count) !== 3 ||
      Number(result.a4_publication_authority_function_count) !== 1 ||
      Number(result.a4_publication_trigger_hardening_count) !== 1 ||
      Number(result.a4_publication_runtime_role_count) !== 1 ||
      Number(result.a4_publication_runtime_direct_privilege_count) !== 0 ||
      Number(result.a4_publication_hardening_constraint_count) !== 10 ||
      Number(result.a4_publication_block_function_count) !== 1 ||
      Number(result.a4_publication_old_function_count) !== 0 ||
      Number(result.a5_constraint_count) !== 11 ||
      result.receipt_authority_nullable !== "NO" ||
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

    console.log("Migration replay passed: empty deploy and Cannes-shaped baseline resolution");
  } finally {
    await dropDatabase(adminUrl, emptyDatabase).catch(() => undefined);
    await dropDatabase(adminUrl, cannesDatabase).catch(() => undefined);
    await dropDatabase(adminUrl, unsafeRoleDatabase).catch(() => undefined);
    await local?.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Migration replay failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
