import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EnvironmentValidationError, validateEnvironment } from "../../src/config/env";
import { canonicalJson } from "../../src/kernel/canonical";
import {
  runStorageProofVerifier,
  StorageVerifierError,
  type StorageVerificationRequest,
  type StorageVerifierOptions,
} from "../../src/og/storage-verifier";

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function requestFixture(): StorageVerificationRequest {
  const payload = "verified storage output";
  const effectId = digest("effect");
  const root = `0x${digest(payload)}`;
  const receiptBytes = canonicalJson({
    digest: digest(payload),
    effectId,
    root,
    schemaVersion: 1,
    size: Buffer.byteLength(payload),
  });
  return {
    schemaVersion: 1,
    effectId,
    expectedDigest: digest(payload),
    expectedSize: Buffer.byteLength(payload),
    indexerUrl: "https://fixture.invalid",
    receiptBytes,
    receiptDigest: digest(receiptBytes),
    root,
  };
}

function verifierOutput(request: StorageVerificationRequest): Record<string, unknown> {
  return {
    schemaVersion: 1,
    effectId: request.effectId,
    root: request.root,
    digest: request.expectedDigest,
    size: request.expectedSize,
    verified: true,
  };
}

function nodeOutputScript(output: string): readonly string[] {
  return ["-e", `process.stdout.write(${JSON.stringify(output)})`];
}

test("retired A3 live settings are rejected and runtime remains disabled", () => {
  assert.deepEqual(validateEnvironment({ NODE_ENV: "test" }).strictA3, { mode: "disabled" });
  assert.throws(() => validateEnvironment({
    NODE_ENV: "test",
    A3_0G_LIVE_ENABLED: "true",
    A3_0G_FUNDING_AUTHORIZED: "true",
    A3_0G_MAX_SPEND_ATOMIC: "1000",
    A3_0G_SPEND_AUTHORIZATION: "0g-live-v1:any:any:1000",
  }), (error: unknown) => {
    assert.ok(error instanceof EnvironmentValidationError);
    assert.match(error.message, /A3_0G_LIVE_ENABLED: retired/);
    assert.match(error.message, /A3_0G_FUNDING_AUTHORIZED: retired/);
    assert.match(error.message, /A3_0G_MAX_SPEND_ATOMIC: retired/);
    assert.match(error.message, /A3_0G_SPEND_AUTHORIZATION: retired/);
    return true;
  });
});

async function expectVerifierError(
  promise: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof StorageVerifierError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test("Node verifier boundary requires exact typed output, not verified:true alone", async () => {
  const request = requestFixture();
  const expected = verifierOutput(request);
  assert.deepEqual(await runStorageProofVerifier(request, {
    executablePath: process.execPath,
    args: nodeOutputScript(JSON.stringify(expected)),
    timeoutMs: 2_000,
  }), expected);

  const mutations: Array<{ output: string; code: string }> = [
    { output: "{", code: "A3_STORAGE_VERIFIER_MALFORMED_OUTPUT" },
    { output: "[]", code: "A3_STORAGE_VERIFIER_INVALID_SCHEMA" },
    {
      output: JSON.stringify({ ...expected, size: String(request.expectedSize) }),
      code: "A3_STORAGE_VERIFIER_INVALID_SCHEMA",
    },
    {
      output: JSON.stringify({ ...expected, unknown: true }),
      code: "A3_STORAGE_VERIFIER_INVALID_SCHEMA",
    },
    {
      output: JSON.stringify({ verified: true }),
      code: "A3_STORAGE_VERIFIER_INVALID_SCHEMA",
    },
    {
      output: JSON.stringify({ ...expected, digest: "0".repeat(64) }),
      code: "A3_STORAGE_VERIFIER_BINDING_MISMATCH",
    },
    {
      output: `${JSON.stringify(expected)}${JSON.stringify(expected)}`,
      code: "A3_STORAGE_VERIFIER_MALFORMED_OUTPUT",
    },
  ];
  for (const mutation of mutations) {
    await expectVerifierError(runStorageProofVerifier(request, {
      executablePath: process.execPath,
      args: nodeOutputScript(mutation.output),
      timeoutMs: 2_000,
    }), mutation.code);
  }
});

test("Node verifier boundary terminates cooperatively, falls back, and removes every temp tree", async () => {
  const request = requestFixture();
  const tempRoot = await mkdtemp(join(tmpdir(), "alphadawg-verifier-parent-test-"));
  const marker = "require('node:fs').writeFileSync(" +
    "require('node:path').join(process.env.TMPDIR,'orphan'),'x');";
  const invoke = async (
    args: readonly string[],
    expectedCode: string,
    options: Partial<StorageVerifierOptions> = {},
  ): Promise<void> => {
    await expectVerifierError(runStorageProofVerifier(request, {
      executablePath: process.execPath,
      args,
      tempRoot,
      timeoutMs: 2_000,
      ...options,
    }), expectedCode);
    assert.deepEqual(await readdir(tempRoot), []);
  };
  try {
    await invoke(
      ["-e", `${marker}process.stdout.write('x'.repeat(70000))`],
      "A3_STORAGE_VERIFIER_OUTPUT_LIMIT",
    );
    await invoke(
      ["-e", `${marker}process.stderr.write('x'.repeat(70000))`],
      "A3_STORAGE_VERIFIER_OUTPUT_LIMIT",
    );
    await invoke(["-e", `${marker}process.exit(7)`], "A3_STORAGE_VERIFIER_NONZERO_EXIT");
    await invoke(["-e", `${marker}process.abort()`], "A3_STORAGE_VERIFIER_NONZERO_EXIT");
    await invoke(
      ["-e", `${marker}process.kill(process.pid, 'SIGTERM')`],
      "A3_STORAGE_VERIFIER_NONZERO_EXIT",
    );
    await invoke(
      ["-e", `${marker}setInterval(() => undefined, 1000)`],
      "A3_STORAGE_VERIFIER_TIMEOUT",
      { timeoutMs: 30 },
    );

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30);
    await invoke(
      ["-e", `${marker}setInterval(() => undefined, 1000)`],
      "A3_STORAGE_VERIFIER_ABORTED",
      { signal: controller.signal },
    );

    const preAborted = new AbortController();
    preAborted.abort();
    await invoke(
      ["-e", `${marker}setInterval(() => undefined, 1000)`],
      "A3_STORAGE_VERIFIER_ABORTED",
      { signal: preAborted.signal },
    );

    await invoke(
      [
        "-e",
        `${marker}process.on('SIGTERM',()=>{});setInterval(() => undefined, 1000)`,
      ],
      "A3_STORAGE_VERIFIER_TIMEOUT",
      { terminationGraceMs: 20, timeoutMs: 100 },
    );

    await invoke(
      [
        "-e",
        `${marker}require('node:fs').writeFileSync(` +
          "require('node:path').join(process.env.TMPDIR,'oversize'),Buffer.alloc(2*1024*1024));" +
          "process.exit(9)",
      ],
      "A3_STORAGE_VERIFIER_NONZERO_EXIT",
    );
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
});
