import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { isLoopbackDatabaseUrl } from "../src/config/env";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PRISMA = resolve(ROOT, "node_modules/.bin/prisma");
const SCHEMA = resolve(ROOT, "prisma/schema.prisma");
const BASELINE_MIGRATION = "20260724011500_baseline";

interface LocalPostgres {
  adminUrl: string;
  close: () => Promise<void>;
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

async function prepareCannesShape(url: string): Promise<void> {
  run(PRISMA, ["db", "push", "--skip-generate", "--schema", SCHEMA], prismaEnv(url));
  const sql = postgres(url, { max: 1 });
  try {
    await sql.unsafe(`
      CREATE SEQUENCE "hot_wallet_index_seq"
        AS BIGINT INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807
        START WITH 1 CACHE 1 NO CYCLE OWNED BY NONE
    `);
    await sql`SELECT setval('hot_wallet_index_seq', 42, true)`;
    await sql`
      INSERT INTO users (id, wallet_address)
      VALUES ('a1-cannes-sentinel', '0xa1cannessentinel')
    `;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function verifyDatabase(url: string, expectedUsers: number, expectedNextSequenceValue: number): Promise<void> {
  run(PRISMA, ["migrate", "status", "--schema", SCHEMA], prismaEnv(url));
  const sql = postgres(url, { max: 1 });
  try {
    const relations = await sql<{
      users: string | null;
      sequence: string | null;
      user_count: string;
      migration_count: string;
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
        (SELECT count(*)::text FROM users) AS user_count,
        (
          SELECT count(*)::text
          FROM "_prisma_migrations"
          WHERE migration_name = ${BASELINE_MIGRATION} AND finished_at IS NOT NULL
        ) AS migration_count,
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
      Number(result.user_count) !== expectedUsers ||
      Number(result.migration_count) !== 1 ||
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
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function main(): Promise<void> {
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
    await verifyDatabase(emptyUrl, 0, 1);

    await prepareCannesShape(cannesUrl);
    run(
      PRISMA,
      ["migrate", "resolve", "--applied", BASELINE_MIGRATION, "--schema", SCHEMA],
      prismaEnv(cannesUrl),
    );
    run(PRISMA, ["migrate", "deploy", "--schema", SCHEMA], prismaEnv(cannesUrl));
    await verifyDatabase(cannesUrl, 1, 43);

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
