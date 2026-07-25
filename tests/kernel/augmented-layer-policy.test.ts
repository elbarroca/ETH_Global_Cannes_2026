import assert from "node:assert/strict";
import test from "node:test";
import {
  getAugmentedLayerPolicy,
  parseGoalPolicyV2,
  patchAugmentedLayerPolicy,
} from "../../src/kernel/augmented-layer-policy";
import { KernelError } from "../../src/kernel/errors";
import { createGoal, parseGoalCreate, parseGoalPatch, patchGoal } from "../../src/kernel/goals";
import {
  configureDatabaseEnvironment,
  startDisposableDatabase,
} from "../helpers/postgres";

const OWNER_ID = "tri-policy-owner";
const OTHER_ID = "tri-policy-other";
const NOW = new Date("2026-07-25T20:00:00.000Z");

function policy(overrides: Partial<ReturnType<typeof parseGoalPolicyV2>> = {}) {
  return parseGoalPolicyV2({
    schemaVersion: 2,
    orchestrationMode: "TRI_RISK_V1",
    cadenceMinutes: 5,
    runMode: "BOUNDED",
    executionMode: "RESEARCH_ONLY",
    runLimit: 3,
    maxAgents: 3,
    perRunCapAtomic: "3000",
    dailyCapAtomic: null,
    ...overrides,
  });
}

test("TRI_RISK_V1 policy is strict, tenant-scoped, and durably idempotent", async () => {
  assert.throws(() => policy({ maxAgents: 2 as 3 }), /maxAgents 3/);
  assert.throws(() => parseGoalPolicyV2({ ...policy(), endpoint: "https://example.invalid" }), /fields must be exact/);

  const database = await startDisposableDatabase("tri-policy");
  configureDatabaseEnvironment(database.url);
  try {
    await database.sql`
      INSERT INTO users (id, wallet_address) VALUES
        (${OWNER_ID}, '0x1111111111111111111111111111111111111111'),
        (${OTHER_ID}, '0x2222222222222222222222222222222222222222')
    `;
    assert.equal(await getAugmentedLayerPolicy(OWNER_ID, { sql: database.sql }), null);
    const first = await patchAugmentedLayerPolicy(
      OWNER_ID, policy(), "tri-policy-patch-01", { now: NOW, sql: database.sql },
    );
    assert.equal(first.replayed, false);
    assert.equal(first.policy.policy.maxAgents, 3);
    assert.equal(await getAugmentedLayerPolicy(OTHER_ID, { sql: database.sql }), null);

    const replay = await patchAugmentedLayerPolicy(
      OWNER_ID, policy(), "tri-policy-patch-01", {
        now: new Date(NOW.getTime() + 1_000), sql: database.sql,
      },
    );
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.policy, first.policy);
    await assert.rejects(
      patchAugmentedLayerPolicy(
        OWNER_ID,
        policy({ cadenceMinutes: 15 }),
        "tri-policy-patch-01",
        { now: NOW, sql: database.sql },
      ),
      (error: unknown) => error instanceof KernelError && error.code === "KERNEL_IDEMPOTENCY_MISMATCH",
    );

    const second = await patchAugmentedLayerPolicy(
      OWNER_ID,
      policy({ cadenceMinutes: 15 }),
      "tri-policy-patch-02",
      { now: new Date(NOW.getTime() + 2_000), sql: database.sql },
    );
    assert.equal(second.policy.policy.cadenceMinutes, 15);
    const delayedReplay = await patchAugmentedLayerPolicy(
      OWNER_ID, policy(), "tri-policy-patch-01", {
        now: new Date(NOW.getTime() + 3_000), sql: database.sql,
      },
    );
    assert.deepEqual(delayedReplay.policy, first.policy);
    assert.equal((await getAugmentedLayerPolicy(OWNER_ID, { sql: database.sql }))?.policy.cadenceMinutes, 15);

    const defaulted = await createGoal(OWNER_ID, parseGoalCreate({
      objective: "Use stored tri-risk defaults for one protected recurring analysis.",
      requiredCapabilities: ["market-analysis"],
      state: "DRAFT",
    }), "tri-policy-goal-01", { now: NOW, sql: database.sql });
    assert.equal(defaulted.goal.policy.schemaVersion, 2);
    assert.equal(defaulted.goal.policy.cadenceMinutes, 15);

    const override = policy({ cadenceMinutes: 30, perRunCapAtomic: "5000" });
    const explicit = await createGoal(OWNER_ID, parseGoalCreate({
      objective: "Snapshot an explicit tri-risk override without changing stored defaults.",
      requiredCapabilities: ["market-analysis"],
      policy: override,
      state: "DRAFT",
    }), "tri-policy-goal-02", { now: NOW, sql: database.sql });
    assert.deepEqual(explicit.goal.policy, override);
    assert.equal((await getAugmentedLayerPolicy(OWNER_ID, { sql: database.sql }))?.policy.cadenceMinutes, 15);

    await assert.rejects(createGoal(OTHER_ID, parseGoalCreate({
      objective: "Refuse a tri-risk goal when no per-user policy exists.",
      requiredCapabilities: ["research"],
      state: "DRAFT",
    }), "tri-policy-other-goal-01", { now: NOW, sql: database.sql }), (error: unknown) =>
      error instanceof KernelError && error.code === "KERNEL_CONFLICT");

    await database.sql`DELETE FROM augmented_layer_policies WHERE owner_user_id = ${OWNER_ID}`;
    await assert.rejects(
      patchGoal(
        OWNER_ID,
        defaulted.goal.goalId,
        parseGoalPatch({ action: "ACTIVATE" }),
        "tri-policy-activate-01",
        { now: NOW, sql: database.sql },
      ),
      (error: unknown) => error instanceof KernelError && error.code === "KERNEL_CONFLICT",
    );

    await assert.rejects(database.sql`
      UPDATE augmented_layer_policy_mutations SET payload_hash = ${"0".repeat(64)}
      WHERE owner_user_id = ${OWNER_ID}
    `, /append-only/);
  } finally {
    await database.close();
  }
});
