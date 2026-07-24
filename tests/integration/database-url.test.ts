import assert from "node:assert/strict";
import test from "node:test";
import {
  EnvironmentValidationError,
  isLoopbackDatabaseUrl,
  validateEnvironment,
  withoutPrismaPoolParameters,
} from "../../src/config/env";

test("database mode requires both pooled and direct PostgreSQL URLs", () => {
  assert.throws(
    () =>
      validateEnvironment(
        { NODE_ENV: "test", DATABASE_URL: "postgresql://localhost:5432/app" },
        { requireDatabase: true },
      ),
    (error: unknown) => {
      assert.ok(error instanceof EnvironmentValidationError);
      assert.deepEqual(error.issues, ["DIRECT_URL: required"]);
      return true;
    },
  );
});

test("database mode accepts local Prisma URLs and detects loopback hosts", () => {
  const environment = validateEnvironment(
    {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://localhost:5432/app",
      DIRECT_URL: "postgres://127.0.0.1:5432/app",
    },
    { requireDatabase: true },
  );
  assert.equal(isLoopbackDatabaseUrl(environment.databaseUrl ?? ""), true);
  assert.equal(isLoopbackDatabaseUrl(environment.directUrl ?? ""), true);
  assert.equal(isLoopbackDatabaseUrl("postgresql://db.example.com/app"), false);
});

test("Postgres.js URL removes Prisma-only pooler query parameters", () => {
  const applicationUrl = new URL(
    withoutPrismaPoolParameters(
      "postgresql://localhost:5432/app?schema=public&connection_limit=1&pool_timeout=20&pgbouncer=true",
    ),
  );
  assert.equal(applicationUrl.searchParams.get("schema"), "public");
  assert.equal(applicationUrl.searchParams.has("connection_limit"), false);
  assert.equal(applicationUrl.searchParams.has("pool_timeout"), false);
  assert.equal(applicationUrl.searchParams.has("pgbouncer"), false);
});
