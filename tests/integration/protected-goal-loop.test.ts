import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);

test("protected goal routes authenticate before bounded input and reuse the kernel job ledger", async () => {
  const routePaths = [
    "app/api/kernel/goals/route.ts",
    "app/api/kernel/goals/[goalId]/route.ts",
    "app/api/kernel/goals/[goalId]/runs/route.ts",
  ];
  for (const path of routePaths) {
    const source = await readFile(new URL(path, root), "utf8");
    const authenticate = source.indexOf("authenticateRequest(");
    const body = source.indexOf("readBoundedKernelJson(");
    assert.ok(authenticate >= 0, `${path} must authenticate`);
    assert.ok(body < 0 || authenticate < body, `${path} must authenticate before reading a mutation body`);
    assert.doesNotMatch(source, /ownerUserId|walletAddress|buyerUserId/, `${path} accepts server-owned identity`);
    assert.doesNotMatch(source, /api\/kernel\/swap|confirmationSig|txHash/, `${path} crosses into A6 execution`);
  }

  const service = await readFile(new URL("src/kernel/goals.ts", root), "utf8");
  assert.match(service, /submitJob\(/, "goal runs must submit existing kernel jobs");
  assert.doesNotMatch(service, /INSERT INTO (?:quotes|job_intents|kernel_orders|effects|receipts)/i);
  assert.match(service, /receipt\.verified = true AND receipt\.result_hash = effect\.result_hash/);
  assert.match(service, /agent\.owner_user_id <> \$\{ownerUserId\}/);
});
