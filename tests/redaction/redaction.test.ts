import assert from "node:assert/strict";
import test from "node:test";
import { EnvironmentValidationError, validateEnvironment } from "../../src/config/env";
import { findSecretFindings } from "../../scripts/scan-secrets";
import { authErrorResponse } from "../../src/auth/http";

test("secret findings expose location and kind without exposing the value", () => {
  const secret = `gh${"p_"}${"A".repeat(40)}`;
  const findings = findSecretFindings("fixture.txt", `first\n${secret}\nlast`);
  assert.deepEqual(findings, [{ file: "fixture.txt", line: 2, kind: "github-token" }]);
  assert.doesNotMatch(JSON.stringify(findings), new RegExp(secret));
});

test("environment errors contain field names but not rejected values", () => {
  const rejected = "https://user:highly-sensitive@example.com";
  assert.throws(
    () => validateEnvironment({ NODE_ENV: "test", DATABASE_URL: rejected }),
    (error: unknown) => {
      assert.ok(error instanceof EnvironmentValidationError);
      assert.match(error.message, /DATABASE_URL: unsupported URL protocol/);
      assert.doesNotMatch(error.message, /highly-sensitive/);
      return true;
    },
  );
});

test("structured auth failures never log raw session or signature material", () => {
  const secret = `0x${"ab".repeat(65)}`;
  const observed: string[] = [];
  const original = console.error;
  console.error = (...values: unknown[]) => {
    observed.push(values.map(String).join(" "));
  };
  try {
    const response = authErrorResponse(new Error(secret), "redaction.test");
    assert.equal(response.status, 500);
  } finally {
    console.error = original;
  }
  assert.doesNotMatch(observed.join("\n"), new RegExp(secret));
  assert.match(observed.join("\n"), /"code":"INTERNAL_ERROR"/);
});
