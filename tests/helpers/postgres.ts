import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

export interface DisposableDatabase {
  url: string;
  sql: ReturnType<typeof postgres>;
  close: () => Promise<void>;
}

function quotedIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]+$/.test(value)) throw new Error("unsafe database test identifier");
  return `"${value}"`;
}

function databaseUrl(adminUrl: string, database: string): string {
  const url = new URL(adminUrl);
  url.pathname = `/${database}`;
  url.search = "";
  return url.toString();
}

function isLoopbackUrl(value: string): boolean {
  const hostname = new URL(value).hostname.replace(/^\[|\]$/g, "");
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function executable(name: string): string {
  const result = spawnSync("which", [name], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${name} is required for database tests`);
  return result.stdout.trim();
}

function run(command: string, args: readonly string[], env: NodeJS.ProcessEnv = process.env): void {
  const result = spawnSync(command, [...args], {
    cwd: ROOT,
    encoding: "utf8",
    env,
    timeout: 120_000,
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
      .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "[redacted-database-url]")
      .trim();
    throw new Error(`database test command failed${output ? `: ${output}` : ""}`);
  }
}

async function availablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("failed to allocate PostgreSQL test port"));
        return;
      }
      server.close((error) => (error ? reject(error) : resolvePort(address.port)));
    });
  });
}

export async function startDisposableDatabase(label: string): Promise<DisposableDatabase> {
  if (!/^[a-z0-9-]{2,32}$/.test(label)) throw new Error("invalid database test label");
  const suppliedAdminUrl = process.env.TEST_DATABASE_URL;
  if (suppliedAdminUrl) {
    if (!isLoopbackUrl(suppliedAdminUrl)) {
      throw new Error("TEST_DATABASE_URL must target loopback PostgreSQL");
    }
    const database = `alphadawg_${label.replaceAll("-", "_")}_${process.pid}_${Date.now().toString(36)}`;
    const admin = postgres(suppliedAdminUrl, { max: 1, prepare: false });
    try {
      await admin.unsafe(`CREATE DATABASE ${quotedIdentifier(database)}`);
    } finally {
      await admin.end({ timeout: 1 });
    }
    const url = databaseUrl(suppliedAdminUrl, database);
    try {
      run("node_modules/.bin/prisma", ["migrate", "deploy", "--schema", "prisma/schema.prisma"], {
        ...process.env,
        DATABASE_URL: url,
        DIRECT_URL: url,
      });
    } catch (error) {
      const cleanup = postgres(suppliedAdminUrl, { max: 1, prepare: false });
      try {
        await cleanup.unsafe(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`);
      } finally {
        await cleanup.end({ timeout: 1 });
      }
      throw error;
    }
    const sql = postgres(url, { max: 20, prepare: false });
    return {
      url,
      sql,
      close: async () => {
        await sql.end({ timeout: 1 });
        const cleanup = postgres(suppliedAdminUrl, { max: 1, prepare: false });
        try {
          await cleanup.unsafe(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`);
        } finally {
          await cleanup.end({ timeout: 1 });
        }
      },
    };
  }

  const root = await mkdtemp(join(tmpdir(), `alphadawg-${label}-`));
  const data = join(root, "data");
  const socket = join(root, "socket");
  const log = join(root, "postgres.log");
  const port = await availablePort();
  await mkdir(socket);
  const initdb = executable("initdb");
  const pgCtl = executable("pg_ctl");
  run(initdb, ["-D", data, "--auth=trust", "--encoding=UTF8", "--no-locale"]);
  run(pgCtl, ["-D", data, "-l", log, "-o", `-F -p ${port} -h 127.0.0.1 -k ${socket}`, "-w", "start"]);
  const user = encodeURIComponent(process.env.USER ?? "postgres");
  const url = `postgresql://${user}@127.0.0.1:${port}/postgres`;
  try {
    run("node_modules/.bin/prisma", ["migrate", "deploy", "--schema", "prisma/schema.prisma"], {
      ...process.env,
      DATABASE_URL: url,
      DIRECT_URL: url,
    });
  } catch (error) {
    run(pgCtl, ["-D", data, "-m", "fast", "-w", "stop"]);
    await rm(root, { force: true, recursive: true });
    throw error;
  }
  const sql = postgres(url, { max: 20, prepare: false });
  return {
    url,
    sql,
    close: async () => {
      await sql.end({ timeout: 1 });
      try {
        run(pgCtl, ["-D", data, "-m", "fast", "-w", "stop"]);
      } finally {
        await rm(root, { force: true, recursive: true });
      }
    },
  };
}

export function configureDatabaseEnvironment(url: string): void {
  Object.assign(process.env, {
    DATABASE_URL: url,
    DIRECT_URL: url,
    NODE_ENV: "test",
    ALPHADAWG_RUNTIME_MODE: "protected",
    ENABLE_BACKGROUND_WORKERS: "false",
    ENABLE_KERNEL_WORKER: "false",
    SIWE_DOMAIN: "localhost:3000",
    SIWE_URI: "http://localhost:3000",
    SIWE_AUDIENCE: "urn:alphadawg:kernel",
    SIWE_CHAIN_ID: "5042002",
  });
}
