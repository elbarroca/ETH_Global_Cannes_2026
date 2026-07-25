import assert from "node:assert/strict";
import test from "node:test";
import { GET as getOwnerEarningsRoute } from "../../app/api/kernel/earnings/route";
import { getOwnerEarnings } from "../../src/kernel/earnings";
import type { DatabaseClient } from "../../src/kernel/service";

test("owner earnings route requires authentication", async () => {
  const response = await getOwnerEarningsRoute(
    new Request("http://localhost/api/kernel/earnings"),
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json() as { code: string }).code, "AUTH_REQUIRED");
});

test("owner earnings preserve large atomic values and expose a zero platform fee", async () => {
  let query = "";
  const sql = ((strings: TemplateStringsArray) => {
    query = strings.join("?");
    return [
      {
        agent_version_id: "00000000-0000-4000-8000-000000000001",
        name: "Large Agent",
        full_subname: "large.creator.eth",
        owner_earnings_atomic: "9007199254740993",
        settled_hire_count: "2",
        last_settled_at: new Date("2026-07-25T20:00:00.000Z"),
      },
      {
        agent_version_id: "00000000-0000-4000-8000-000000000002",
        name: "Small Agent",
        full_subname: "small.creator.eth",
        owner_earnings_atomic: "7",
        settled_hire_count: "1",
        last_settled_at: new Date("2026-07-25T19:00:00.000Z"),
      },
    ];
  }) as unknown as DatabaseClient;
  const result = await getOwnerEarnings("creator", { sql });
  assert.deepEqual(result, {
    asset: "USDC_ATOMIC",
    decimals: 6,
    grossSettledAtomic: "9007199254741000",
    ownerEarningsAtomic: "9007199254741000",
    platformFeeAtomic: "0",
    settledHireCount: 3,
    lastSettledAt: "2026-07-25T20:00:00.000Z",
    agents: [
      {
        agentVersionId: "00000000-0000-4000-8000-000000000001",
        name: "Large Agent",
        fullSubname: "large.creator.eth",
        ownerEarningsAtomic: "9007199254740993",
        settledHireCount: 2,
        lastSettledAt: "2026-07-25T20:00:00.000Z",
      },
      {
        agentVersionId: "00000000-0000-4000-8000-000000000002",
        name: "Small Agent",
        fullSubname: "small.creator.eth",
        ownerEarningsAtomic: "7",
        settledHireCount: 1,
        lastSettledAt: "2026-07-25T19:00:00.000Z",
      },
    ],
  });
  assert.match(query, /commission\.recipient_user_id = /);
  assert.match(query, /job\.buyer_user_id <> agent\.owner_user_id/);
  assert.match(query, /job\.financial_outcome = 'SETTLED'/);
  assert.match(query, /attempt\.state = 'FINALIZED'/);
  assert.match(query, /refund\.id IS NULL/);
});

test("owner earnings return an exact empty projection", async () => {
  const sql = (() => []) as unknown as DatabaseClient;
  assert.deepEqual(await getOwnerEarnings("creator-without-settlements", { sql }), {
    asset: "USDC_ATOMIC",
    decimals: 6,
    grossSettledAtomic: "0",
    ownerEarningsAtomic: "0",
    platformFeeAtomic: "0",
    settledHireCount: 0,
    lastSettledAt: null,
    agents: [],
  });
});
