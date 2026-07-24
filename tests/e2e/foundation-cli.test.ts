import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const TSX = resolve(ROOT, "node_modules/.bin/tsx");
const SCRIPT = resolve(ROOT, "scripts/validate-env.ts");

function run(extraEnv: Record<string, string> = {}) {
  return spawnSync(TSX, [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      HOME: process.env.HOME,
      PATH: process.env.PATH,
      NODE_ENV: "test",
      ...extraEnv,
    },
  });
}

test("offline environment CLI succeeds without live credentials", () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Environment valid: mode=offline database=unset/);
});

test("environment CLI fails closed and redacts malformed input", () => {
  const invalidValue = "private-invalid-port";
  const result = run({ SERVER_PORT: invalidValue });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SERVER_PORT: expected an integer/);
  assert.doesNotMatch(result.stderr, new RegExp(invalidValue));
});
