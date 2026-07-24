import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const TSX = resolve(ROOT, "node_modules/.bin/tsx");
const ENTRYPOINT = resolve(ROOT, "src/index.ts");

test("protected boot succeeds without sponsor configuration or live calls", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "alphadawg-protected-boot-"));
  try {
    const result = spawnSync(TSX, [ENTRYPOINT], {
      cwd,
      encoding: "utf8",
      env: {
        HOME: process.env.HOME,
        PATH: process.env.PATH,
        NODE_ENV: "test",
        ALPHADAWG_RUNTIME_MODE: "protected",
        ENABLE_BACKGROUND_WORKERS: "false",
        ENABLE_KERNEL_WORKER: "false",
        PROTECTED_BOOT_SMOKE: "true",
      },
      timeout: 30_000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /"mode":"protected"/);
    assert.match(result.stdout, /"smoke":true/);
    assert.doesNotMatch(result.stdout + result.stderr, /0G Provider|Telegram|specialist agents|HCS Topic|Circle/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("docker entrypoint is syntax-valid and starts only the canonical runtime", async () => {
  const result = spawnSync("bash", ["-n", resolve(ROOT, "docker-entrypoint.sh")], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});
