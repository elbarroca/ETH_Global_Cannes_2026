import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson } from "../kernel/canonical";

const ROOT_PATTERN = /^0x[0-9a-f]{64}$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const EFFECT_PATTERN = /^[0-9a-f]{64}$/;
const MAX_PROCESS_OUTPUT_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_TERMINATION_GRACE_MS = 100;

export interface StorageVerificationRequest {
  schemaVersion: 1;
  effectId: string;
  expectedDigest: string;
  expectedSize: number;
  indexerUrl: string;
  receiptBytes: string;
  receiptDigest: string;
  root: string;
}

export interface StorageVerificationResult {
  schemaVersion: 1;
  effectId: string;
  root: string;
  digest: string;
  size: number;
  verified: true;
}

export interface StorageVerifierOptions {
  executablePath: string;
  args?: readonly string[];
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  tempRoot?: string;
  terminationGraceMs?: number;
  timeoutMs?: number;
}

export class StorageVerifierError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "StorageVerifierError";
    this.code = code;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function validateRequest(request: StorageVerificationRequest): void {
  if (
    request.schemaVersion !== 1 ||
    !EFFECT_PATTERN.test(request.effectId) ||
    !ROOT_PATTERN.test(request.root) ||
    !DIGEST_PATTERN.test(request.expectedDigest) ||
    !DIGEST_PATTERN.test(request.receiptDigest) ||
    !Number.isSafeInteger(request.expectedSize) ||
    request.expectedSize < 1 ||
    request.expectedSize > 1024 * 1024 ||
    Buffer.byteLength(request.receiptBytes, "utf8") < 1 ||
    Buffer.byteLength(request.receiptBytes, "utf8") > 128 * 1024
  ) {
    throw new StorageVerifierError("A3_STORAGE_VERIFIER_INVALID_REQUEST");
  }
  try {
    const parsed = new URL(request.indexerUrl);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) {
      throw new Error("invalid");
    }
  } catch {
    throw new StorageVerifierError("A3_STORAGE_VERIFIER_INVALID_INDEXER");
  }
}

function parseResult(raw: string, request: StorageVerificationRequest): StorageVerificationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new StorageVerifierError("A3_STORAGE_VERIFIER_MALFORMED_OUTPUT");
  }
  const output = record(parsed);
  if (!output || !exactKeys(output, [
    "digest",
    "effectId",
    "root",
    "schemaVersion",
    "size",
    "verified",
  ])) {
    throw new StorageVerifierError("A3_STORAGE_VERIFIER_INVALID_SCHEMA");
  }
  if (
    output.schemaVersion !== 1 ||
    output.verified !== true ||
    typeof output.effectId !== "string" ||
    typeof output.root !== "string" ||
    typeof output.digest !== "string" ||
    typeof output.size !== "number" ||
    !Number.isSafeInteger(output.size) ||
    !EFFECT_PATTERN.test(output.effectId) ||
    !ROOT_PATTERN.test(output.root) ||
    !DIGEST_PATTERN.test(output.digest)
  ) {
    throw new StorageVerifierError("A3_STORAGE_VERIFIER_INVALID_SCHEMA");
  }
  if (
    output.effectId !== request.effectId ||
    output.root !== request.root ||
    output.digest !== request.expectedDigest ||
    output.size !== request.expectedSize
  ) {
    throw new StorageVerifierError("A3_STORAGE_VERIFIER_BINDING_MISMATCH");
  }
  return {
    schemaVersion: 1,
    effectId: output.effectId,
    root: output.root,
    digest: output.digest,
    size: output.size,
    verified: true,
  };
}

export async function runStorageProofVerifier(
  request: StorageVerificationRequest,
  options: StorageVerifierOptions,
): Promise<StorageVerificationResult> {
  validateRequest(request);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10 || timeoutMs > 120_000) {
    throw new StorageVerifierError("A3_STORAGE_VERIFIER_INVALID_TIMEOUT");
  }
  const terminationGraceMs = options.terminationGraceMs ?? DEFAULT_TERMINATION_GRACE_MS;
  if (
    !Number.isSafeInteger(terminationGraceMs) ||
    terminationGraceMs < 10 ||
    terminationGraceMs > 2_000
  ) {
    throw new StorageVerifierError("A3_STORAGE_VERIFIER_INVALID_TERMINATION_GRACE");
  }
  let invocationDirectory: string;
  try {
    invocationDirectory = await mkdtemp(join(options.tempRoot ?? tmpdir(), "alphadawg-a3-verifier-"));
  } catch {
    throw new StorageVerifierError("A3_STORAGE_VERIFIER_TEMP_SETUP_FAILED");
  }

  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(options.executablePath, [...(options.args ?? [])], {
        env: {
          ...(options.env ?? process.env),
          TEMP: invocationDirectory,
          TMP: invocationDirectory,
          TMPDIR: invocationDirectory,
        },
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = Buffer.alloc(0);
      let stderrSize = 0;
      let failureCode: string | null = null;
      let settled = false;
      let killTimer: ReturnType<typeof setTimeout> | null = null;

      const finish = (error?: StorageVerifierError, result?: StorageVerificationResult): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        if (killTimer) clearTimeout(killTimer);
        options.signal?.removeEventListener("abort", onAbort);
        if (error) reject(error);
        else if (result) resolve(result);
        else reject(new StorageVerifierError("A3_STORAGE_VERIFIER_FAILED"));
      };
      const terminate = (code: string): void => {
        if (failureCode) return;
        failureCode = code;
        child.kill("SIGTERM");
        killTimer = setTimeout(() => {
          if (!settled) child.kill("SIGKILL");
        }, terminationGraceMs);
      };
      const onAbort = (): void => terminate("A3_STORAGE_VERIFIER_ABORTED");
      options.signal?.addEventListener("abort", onAbort, { once: true });
      const timeoutTimer = setTimeout(
        () => terminate("A3_STORAGE_VERIFIER_TIMEOUT"),
        timeoutMs,
      );
      if (options.signal?.aborted) onAbort();

      child.stdout.on("data", (chunk: Buffer) => {
        if (failureCode) return;
        if (stdout.length + chunk.length > MAX_PROCESS_OUTPUT_BYTES) {
          terminate("A3_STORAGE_VERIFIER_OUTPUT_LIMIT");
          return;
        }
        stdout = Buffer.concat([stdout, chunk]);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        if (failureCode) return;
        stderrSize += chunk.length;
        if (stderrSize > MAX_PROCESS_OUTPUT_BYTES) {
          terminate("A3_STORAGE_VERIFIER_OUTPUT_LIMIT");
        }
      });
      child.stdin.on("error", () => terminate("A3_STORAGE_VERIFIER_STDIN_FAILED"));
      child.once("error", () => {
        finish(new StorageVerifierError("A3_STORAGE_VERIFIER_SPAWN_FAILED"));
      });
      child.once("close", (code, signal) => {
        if (failureCode) {
          finish(new StorageVerifierError(failureCode));
          return;
        }
        if (signal || code !== 0) {
          finish(new StorageVerifierError("A3_STORAGE_VERIFIER_NONZERO_EXIT"));
          return;
        }
        try {
          finish(undefined, parseResult(stdout.toString("utf8"), request));
        } catch (error) {
          finish(error instanceof StorageVerifierError
            ? error
            : new StorageVerifierError("A3_STORAGE_VERIFIER_MALFORMED_OUTPUT"));
        }
      });
      child.stdin.end(canonicalJson({
        schemaVersion: request.schemaVersion,
        effectId: request.effectId,
        expectedDigest: request.expectedDigest,
        expectedSize: request.expectedSize,
        indexerUrl: request.indexerUrl,
        receiptBytes: request.receiptBytes,
        receiptDigest: request.receiptDigest,
        root: request.root,
      }), "utf8");
    });
  } finally {
    try {
      await rm(invocationDirectory, { force: true, recursive: true });
    } catch {
      throw new StorageVerifierError("A3_STORAGE_VERIFIER_TEMP_CLEANUP_FAILED");
    }
  }
}
