import assert from "node:assert/strict";
import test from "node:test";
import { EnvironmentValidationError, validateEnvironment } from "../../src/config/env";
import { findSecretFindings } from "../../scripts/scan-secrets";

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
