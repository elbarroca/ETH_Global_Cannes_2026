import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { EnvironmentValidationError, validateEnvironment } from "../../src/config/env";
import { canonicalJson } from "../../src/kernel/canonical";
import {
  runStorageProofVerifier,
  StorageVerifierError,
  type StorageVerificationRequest,
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

test("strict live mode requires exact server-only funding and spend authority", () => {
  assert.deepEqual(validateEnvironment({ NODE_ENV: "test" }).strictA3, { mode: "disabled" });
  assert.throws(() => validateEnvironment({
    NODE_ENV: "test",
    A3_0G_LIVE_ENABLED: "true",
    A3_0G_FUNDING_AUTHORIZED: "false",
  }), (error: unknown) => {
    assert.ok(error instanceof EnvironmentValidationError);
    assert.match(error.message, /exact live funding authorization/);
    assert.match(error.message, /must bind the exact provider, model, and cap/);
    return true;
  });

  const provider = "0x3333333333333333333333333333333333333333";
  const model = "fixture-tee-model-v1";
  const strict = validateEnvironment({
    NODE_ENV: "test",
    A3_0G_LIVE_ENABLED: "true",
    A3_0G_FUNDING_AUTHORIZED: "true",
    A3_0G_MAX_SPEND_ATOMIC: "1000",
    A3_0G_SPEND_AUTHORIZATION: `0g-live-v1:${provider}:${model}:1000`,
    OG_PROVIDER_ADDRESS: provider,
    OG_COMPUTE_MODEL: model,
    OG_RPC_URL: "https://rpc.invalid",
    OG_STORAGE_INDEXER: "https://indexer.invalid",
    OG_STORAGE_VERIFIER_PATH: "/opt/alphadawg/0g-storage-verifier",
    OG_PRIVATE_KEY: `0x${"1".repeat(64)}`,
  }).strictA3;
  assert.deepEqual(strict, {
    mode: "live",
    provider,
    model,
    rpcUrl: "https://rpc.invalid",
    storageIndexerUrl: "https://indexer.invalid",
    storageVerifierPath: "/opt/alphadawg/0g-storage-verifier",
    maxSpendAtomic: 1000,
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

test("Node verifier boundary kills oversize, nonzero, signal, timeout, and aborted subprocesses", async () => {
  const request = requestFixture();
  await expectVerifierError(runStorageProofVerifier(request, {
    executablePath: process.execPath,
    args: ["-e", "process.stdout.write('x'.repeat(70000))"],
    timeoutMs: 2_000,
  }), "A3_STORAGE_VERIFIER_OUTPUT_LIMIT");

  await expectVerifierError(runStorageProofVerifier(request, {
    executablePath: process.execPath,
    args: ["-e", "process.exit(7)"],
    timeoutMs: 2_000,
  }), "A3_STORAGE_VERIFIER_NONZERO_EXIT");

  await expectVerifierError(runStorageProofVerifier(request, {
    executablePath: process.execPath,
    args: ["-e", "process.kill(process.pid, 'SIGTERM')"],
    timeoutMs: 2_000,
  }), "A3_STORAGE_VERIFIER_NONZERO_EXIT");

  await expectVerifierError(runStorageProofVerifier(request, {
    executablePath: process.execPath,
    args: ["-e", "setInterval(() => undefined, 1000)"],
    timeoutMs: 20,
  }), "A3_STORAGE_VERIFIER_TIMEOUT");

  const controller = new AbortController();
  setTimeout(() => controller.abort(), 20);
  await expectVerifierError(runStorageProofVerifier(request, {
    executablePath: process.execPath,
    args: ["-e", "setInterval(() => undefined, 1000)"],
    timeoutMs: 2_000,
    signal: controller.signal,
  }), "A3_STORAGE_VERIFIER_ABORTED");
});
