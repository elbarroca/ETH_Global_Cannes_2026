import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  EnvironmentValidationError,
  requireEnsPublicationDatabaseUrl,
  validateEnvironment,
  withPrismaPoolParameters,
} from "../../src/config/env";

test("offline environment validates without sponsor or database secrets", () => {
  const environment = validateEnvironment({ NODE_ENV: "test" });
  assert.equal(environment.databaseUrl, undefined);
  assert.equal(environment.enableBackgroundWorkers, false);
  assert.equal(environment.enableKernelWorker, false);
  assert.equal(environment.kernelWorkerConcurrency, 4);
  assert.equal(environment.runtimeMode, "protected");
  assert.equal(environment.siweChainId, 5_042_002);
  assert.equal(environment.serverPort, 3001);
});

test("protected runtime rejects legacy workers and unsafe worker concurrency", () => {
  assert.throws(
    () => validateEnvironment({
      NODE_ENV: "test",
      ALPHADAWG_RUNTIME_MODE: "protected",
      ENABLE_BACKGROUND_WORKERS: "true",
      KERNEL_WORKER_CONCURRENCY: "5",
    }),
    (error: unknown) => {
      assert.ok(error instanceof EnvironmentValidationError);
      assert.match(error.message, /ENABLE_BACKGROUND_WORKERS/);
      assert.match(error.message, /KERNEL_WORKER_CONCURRENCY/);
      return true;
    },
  );
});

test("production requires explicit canonical SIWE authority", () => {
  assert.throws(
    () => validateEnvironment({ NODE_ENV: "production" }),
    (error: unknown) => {
      assert.ok(error instanceof EnvironmentValidationError);
      assert.match(error.message, /SIWE_DOMAIN: required in production/);
      assert.match(error.message, /SIWE_URI: required in production/);
      assert.match(error.message, /SIWE_AUDIENCE: required in production/);
      return true;
    },
  );
});

test("environment boundaries reject malformed values without echoing them", () => {
  const secretValue = "postgresql://user:do-not-print@[/db";
  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: "test",
        DATABASE_URL: secretValue,
        ENABLE_BACKGROUND_WORKERS: "sometimes",
        SERVER_PORT: "70000",
      }),
    (error: unknown) => {
      assert.ok(error instanceof EnvironmentValidationError);
      assert.match(error.message, /DATABASE_URL: invalid URL/);
      assert.match(error.message, /ENABLE_BACKGROUND_WORKERS/);
      assert.match(error.message, /SERVER_PORT/);
      assert.doesNotMatch(error.message, /do-not-print/);
      return true;
    },
  );
});

test("database URLs require an explicit database name", () => {
  assert.throws(
    () => validateEnvironment({ NODE_ENV: "test", DATABASE_URL: "postgresql://localhost" }),
    (error: unknown) => {
      assert.ok(error instanceof EnvironmentValidationError);
      assert.deepEqual(error.issues, ["DATABASE_URL: URL must include hostname and database name"]);
      return true;
    },
  );
});

test("ENS publication database requires a distinct restricted login without secret echo", () => {
  const main = "postgresql://kernel:main-secret@localhost:5432/app";
  assert.throws(
    () => requireEnsPublicationDatabaseUrl({ DATABASE_URL: main }),
    (error: unknown) => {
      assert.ok(error instanceof EnvironmentValidationError);
      assert.deepEqual(error.issues, ["ENS_PUBLICATION_DATABASE_URL: required"]);
      return true;
    },
  );
  assert.throws(
    () => requireEnsPublicationDatabaseUrl({
      DATABASE_URL: main,
      ENS_PUBLICATION_DATABASE_URL: "postgresql://kernel:do-not-print@localhost:5432/app",
    }),
    (error: unknown) => {
      assert.ok(error instanceof EnvironmentValidationError);
      assert.match(error.message, /distinct restricted database login/);
      assert.doesNotMatch(error.message, /do-not-print|main-secret/);
      return true;
    },
  );
  assert.throws(
    () => requireEnsPublicationDatabaseUrl({
      DATABASE_URL: main,
      ENS_PUBLICATION_DATABASE_URL: "postgresql://%6bernel:encoded@localhost:5432/app",
    }),
    (error: unknown) => {
      assert.ok(error instanceof EnvironmentValidationError);
      assert.match(error.message, /distinct restricted database login/);
      assert.doesNotMatch(error.message, /encoded|main-secret/);
      return true;
    },
  );
  assert.throws(
    () => requireEnsPublicationDatabaseUrl({
      DATABASE_URL: main,
      DIRECT_URL: "postgresql://migration_owner:direct-secret@localhost:5432/app",
      ENS_PUBLICATION_DATABASE_URL:
        "postgresql://migration_owner:restricted-secret@localhost:5432/app",
    }),
    (error: unknown) => {
      assert.ok(error instanceof EnvironmentValidationError);
      assert.match(error.message, /distinct restricted database login/);
      assert.doesNotMatch(error.message, /direct-secret|restricted-secret|main-secret/);
      return true;
    },
  );
  assert.throws(
    () => requireEnsPublicationDatabaseUrl({
      DATABASE_URL: main,
      ENS_PUBLICATION_DATABASE_URL: "postgresql://%ZZ:never-print@localhost:5432/app",
    }),
    (error: unknown) => {
      assert.ok(error instanceof EnvironmentValidationError);
      assert.deepEqual(error.issues, [
        "ENS_PUBLICATION_DATABASE_URL: invalid database login encoding",
      ]);
      assert.doesNotMatch(error.message, /never-print|main-secret|%ZZ/);
      return true;
    },
  );
  assert.throws(
    () => requireEnsPublicationDatabaseUrl({
      DATABASE_URL: main,
      ENS_PUBLICATION_DATABASE_URL: "postgresql://ens_runtime:never-print@[/app",
    }),
    (error: unknown) => {
      assert.ok(error instanceof EnvironmentValidationError);
      assert.deepEqual(error.issues, ["ENS_PUBLICATION_DATABASE_URL: invalid URL"]);
      assert.doesNotMatch(error.message, /never-print|main-secret/);
      return true;
    },
  );
  assert.equal(
    requireEnsPublicationDatabaseUrl({
      DATABASE_URL: main,
      ENS_PUBLICATION_DATABASE_URL: "postgresql://ens_runtime:restricted@localhost:5432/app",
    }),
    "postgresql://ens_runtime:restricted@localhost:5432/app",
  );
});

test("Prisma pool parameters preserve and replace URL query values", () => {
  const pooled = new URL(
    withPrismaPoolParameters("postgresql://user:pass@localhost:5432/app?schema=public&pool_timeout=2"),
  );
  assert.equal(pooled.searchParams.get("schema"), "public");
  assert.equal(pooled.searchParams.get("connection_limit"), "1");
  assert.equal(pooled.searchParams.get("pool_timeout"), "20");
  assert.equal(pooled.searchParams.get("pgbouncer"), null);
  assert.equal([...pooled.searchParams.keys()].filter((key) => key === "pool_timeout").length, 1);
});

test("required package scripts execute implemented files", async () => {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const packageJson = JSON.parse(await readFile(`${root}/package.json`, "utf8")) as {
    scripts?: Record<string, string>;
  };
  const required = [
    "typecheck",
    "test",
    "test:integration",
    "test:e2e",
    "test:resilience",
    "test:redaction",
    "clean:generated",
    "scan:secrets",
  ];

  for (const name of required) {
    const command = packageJson.scripts?.[name];
    assert.ok(command, `missing package script ${name}`);
    assert.doesNotMatch(command, /(?:^|\s)(?:echo|true)(?:\s|$)/, `${name} is a placeholder`);
  }
});
