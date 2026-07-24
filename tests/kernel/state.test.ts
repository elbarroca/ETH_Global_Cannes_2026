import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, domainHash } from "../../src/kernel/canonical";
import { KernelError } from "../../src/kernel/errors";
import { assertLegalJobTransition, isLegalJobTransition } from "../../src/kernel/state";
import { JOB_STATES, type JobState } from "../../src/kernel/types";

test("canonical hashes are order-independent and domain-separated", () => {
  const left = { nested: { z: 3, a: 1 }, values: [true, null, "x"] };
  const right = { values: [true, null, "x"], nested: { a: 1, z: 3 } };
  assert.equal(canonicalJson(left), canonicalJson(right));
  assert.equal(domainHash("job-input", left), domainHash("job-input", right));
  assert.notEqual(domainHash("job-input", left), domainHash("effect-result", left));
  assert.throws(() => canonicalJson(Number.NaN), /KERNEL_NON_CANONICAL_NUMBER/);
});

test("job state graph accepts only the explicit optimistic lifecycle", () => {
  const legal = new Set([
    "QUEUED->RUNNING",
    "QUEUED->CANCELED",
    "QUEUED->FAILED",
    "RUNNING->QUEUED",
    "RUNNING->SUCCEEDED",
    "RUNNING->FAILED",
    "RUNNING->CANCELED",
    "RUNNING->A3_NOT_CONFIGURED",
  ]);
  for (const from of JOB_STATES) {
    for (const to of JOB_STATES) {
      const expected = legal.has(`${from}->${to}`);
      assert.equal(isLegalJobTransition(from, to), expected, `${from}->${to}`);
      if (expected) {
        assert.doesNotThrow(() => assertLegalJobTransition(from, to));
      } else {
        assert.throws(
          () => assertLegalJobTransition(from as JobState, to as JobState),
          (error: unknown) => error instanceof KernelError && error.code === "KERNEL_ILLEGAL_TRANSITION",
        );
      }
    }
  }
});
