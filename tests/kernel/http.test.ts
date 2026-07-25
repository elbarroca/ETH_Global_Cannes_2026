import assert from "node:assert/strict";
import test from "node:test";
import { KernelError } from "../../src/kernel/errors";
import { kernelErrorResponse } from "../../src/kernel/http";

const SENSITIVE_MESSAGE = ["sensitive", "message", "dsn", "sql", "user"].join("-");

function captureErrorLog(run: () => void): string[] {
  const observed: string[] = [];
  const original = console.error;
  console.error = (...values: unknown[]): void => {
    observed.push(values.map(String).join(" "));
  };
  try {
    run();
  } finally {
    console.error = original;
  }
  return observed;
}

test("undefined PostgreSQL schema objects return a redacted readiness response", async () => {
  for (const sqlState of ["42P01", "42703"]) {
    let response: ReturnType<typeof kernelErrorResponse> | undefined;
    const observed = captureErrorLog(() => {
      response = kernelErrorResponse(Object.assign(new Error(SENSITIVE_MESSAGE), {
        code: sqlState,
        detail: "private-detail",
        query: "private-query",
        user: "private-user",
      }), "kernel.goals.list");
    });

    assert.equal(response?.status, 503);
    assert.deepEqual(await response?.json(), {
      error: "Service temporarily unavailable",
      code: "KERNEL_SCHEMA_NOT_READY",
    });
    assert.deepEqual(observed, [
      JSON.stringify({
        level: "error",
        context: "kernel.goals.list",
        code: "KERNEL_SCHEMA_NOT_READY",
      }),
    ]);
    assert.doesNotMatch(observed.join("\n"), /sensitive|private/i);
  }
});

test("unknown exceptions remain generic internal errors with bounded logging", async () => {
  let response: ReturnType<typeof kernelErrorResponse> | undefined;
  const observed = captureErrorLog(() => {
    response = kernelErrorResponse(
      Object.assign(new Error(SENSITIVE_MESSAGE), { code: "08006" }),
      `kernel:${SENSITIVE_MESSAGE}`,
    );
  });

  assert.equal(response?.status, 500);
  assert.deepEqual(await response?.json(), { error: "Request failed", code: "INTERNAL_ERROR" });
  assert.deepEqual(observed, [
    JSON.stringify({ level: "error", context: "kernel.request", code: "INTERNAL_ERROR" }),
  ]);
  assert.doesNotMatch(observed.join("\n"), /sensitive|08006/i);
});

test("KernelError responses remain unchanged and unlogged", async () => {
  let response: ReturnType<typeof kernelErrorResponse> | undefined;
  const observed = captureErrorLog(() => {
    response = kernelErrorResponse(
      new KernelError("KERNEL_FORBIDDEN", "Authenticated owner required", 403),
      "kernel.agents.list",
    );
  });

  assert.equal(response?.status, 403);
  assert.deepEqual(await response?.json(), {
    error: "Authenticated owner required",
    code: "KERNEL_FORBIDDEN",
  });
  assert.deepEqual(observed, []);
});
