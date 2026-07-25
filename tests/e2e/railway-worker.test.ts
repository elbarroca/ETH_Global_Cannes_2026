import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

test("Railway packages only the protected worker and its real health endpoint", async () => {
  const [dockerfile, entrypoint, railway, environment] = await Promise.all([
    readFile(`${ROOT}/Dockerfile`, "utf8"),
    readFile(`${ROOT}/docker-entrypoint.sh`, "utf8"),
    readFile(`${ROOT}/railway.toml`, "utf8"),
    readFile(`${ROOT}/.env.example`, "utf8"),
  ]);

  assert.match(dockerfile, /FROM node:22-slim/);
  assert.match(dockerfile, /RUN npx prisma generate/);
  assert.match(dockerfile, /EXPOSE 3000/);
  assert.match(dockerfile, /localhost:\$\{PORT\}\/health/);
  assert.doesNotMatch(dockerfile, /COPY openclaw|4001|4010|npm install -g tsx/);
  assert.match(entrypoint, /exec \.\/node_modules\/\.bin\/tsx src\/index\.ts/);

  assert.match(railway, /builder = "DOCKERFILE"/);
  assert.match(railway, /numReplicas = 1/);
  assert.match(railway, /healthcheckPath = "\/health"/);
  assert.match(railway, /healthcheckTimeout = 30/);
  assert.match(railway, /restartPolicyType = "ALWAYS"/);
  assert.match(railway, /sleepApplication = false/);
  assert.doesNotMatch(railway, /cronSchedule|preDeployCommand/);

  assert.match(environment, /^ALPHADAWG_RUNTIME_MODE=protected$/m);
  assert.match(environment, /^ENABLE_BACKGROUND_WORKERS=false$/m);
  assert.match(environment, /^ENABLE_KERNEL_WORKER=true$/m);
  assert.match(environment, /^KERNEL_WORKER_CONCURRENCY=1$/m);
  assert.match(environment, /^KERNEL_WORKER_LEASE_SECONDS=30$/m);
  assert.match(environment, /^DATABASE_URL=.*-pooler/m);
  assert.match(environment, /^DIRECT_URL=/m);
  assert.match(environment, /Railway injects RAILWAY_GIT_COMMIT_SHA/);
  assert.doesNotMatch(environment, /^A3_0G_(?:LIVE_ENABLED|FUNDING_AUTHORIZED|MAX_SPEND_ATOMIC|SPEND_AUTHORIZATION)=/m);
});
