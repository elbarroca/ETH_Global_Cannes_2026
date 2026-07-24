import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  EnvironmentValidationError,
  validateEnvironment,
  withPrismaPoolParameters,
} from "../../src/config/env";

test("offline environment validates without sponsor or database secrets", () => {
  const environment = validateEnvironment({ NODE_ENV: "test" });
  assert.equal(environment.databaseUrl, undefined);
  assert.equal(environment.enableBackgroundWorkers, false);
  assert.equal(environment.serverPort, 3001);
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
