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
      user_count: string;
      migration_count: string;
      baseline_count: string;
      a2_count: string;
      invariant_trigger_count: string;
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
          SELECT count(*)::text FROM pg_trigger
          WHERE NOT tgisinternal AND tgname IN (
            'agent_versions_immutable_published',
            'job_events_append_only',
            'jobs_legal_transitions',
            'effects_legal_transitions',
            'settlements_exclusive_verified',
            'refunds_exclusive_terminal',
            'commissions_verified_settlement_only'
          )
        ) AS invariant_trigger_count,
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
      Number(result.user_count) !== expectedUsers ||
      Number(result.migration_count) !== 2 ||
      Number(result.baseline_count) !== 1 ||
      Number(result.a2_count) !== 1 ||
      Number(result.invariant_trigger_count) !== 7 ||
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

    console.log("Migration replay passed: empty deploy and Cannes-shaped baseline resolution");
  } finally {
    await dropDatabase(adminUrl, emptyDatabase).catch(() => undefined);
    await dropDatabase(adminUrl, cannesDatabase).catch(() => undefined);
    await local?.close();
  }
}

main().catch((error: unknown) => {
  console.error(`Migration replay failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
