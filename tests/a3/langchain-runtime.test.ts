import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyMessage, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { EnsAuthorityRuntime } from "../../src/ens/authority";
import type { DatabaseClient } from "../../src/kernel/service";
import {
  createProductionStrictA3Runtime,
  type ProductionA3Config,
  ZeroGStrictChatModel,
} from "../../src/og/langchain-runtime";
import type {
  StrictComputeResponse,
  StrictComputeService,
  StrictComputeTransport,
} from "../../src/og/strict-a3";

const PROVIDER = "0x3333333333333333333333333333333333333333";
const MODEL = "fixture-tee-model-v1";
const SIGNER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const signer = privateKeyToAccount(SIGNER_KEY);

function service(): StrictComputeService {
  return {
    additionalInfo: { TargetSeparated: true, TargetTeeAddress: signer.address.toLowerCase() },
    baseUrl: "https://compute.invalid",
    endpoint: "https://compute.invalid/v1/proxy",
    model: MODEL,
    provider: PROVIDER,
    teeSignerAcknowledged: true,
    teeSignerAddress: signer.address.toLowerCase(),
    verifiability: "TeeML",
  };
}

function requestBytes(): string {
  return JSON.stringify({
    max_tokens: 768,
    messages: [
      { content: "system", role: "system" },
      { content: "binding", role: "system" },
      { content: "prompt", role: "user" },
    ],
    model: MODEL,
    stream: false,
    temperature: 0,
    user: "nonce",
  });
}

class ComputeFixture implements StrictComputeTransport {
  readonly calls = { headers: 0, resolve: 0, send: 0, signature: 0 };

  constructor(
    private readonly completionTokens = 12,
    private readonly responseProvider = PROVIDER,
    private readonly validSignature = true,
  ) {}

  async resolveService(): Promise<StrictComputeService> {
    this.calls.resolve += 1;
    return service();
  }

  async getRequestHeaders(): Promise<Record<string, string>> {
    this.calls.headers += 1;
    return { Authorization: "fixture" };
  }

  async sendRequest(): Promise<StrictComputeResponse> {
    this.calls.send += 1;
    return {
      body: {
        choices: [{ message: { content: "verified", role: "assistant" } }],
        model: MODEL,
        usage: {
          actual_cost_atomic: "7",
          completion_tokens: this.completionTokens,
          prompt_tokens: 10,
          total_tokens: 10 + this.completionTokens,
        },
      },
      model: MODEL,
      provider: this.responseProvider,
      requestId: "request-1",
      status: 200,
    };
  }

  async fetchSignature(): Promise<unknown> {
    this.calls.signature += 1;
    return {
      signature: await signer.signMessage({ message: this.validSignature ? "verified" : "wrong" }),
      text: "verified",
    };
  }

  async verifySignature(text: string, signature: string, expectedSigner: string): Promise<boolean> {
    return verifyMessage({
      address: expectedSigner as Address,
      message: text,
      signature: signature as Hex,
    });
  }
}

const authority: EnsAuthorityRuntime = {
  agentName: "agent.creator.eth",
  chainId: 11155111,
  creatorName: "creator.eth",
  creatorResolver: "0x4444444444444444444444444444444444444444",
  agentResolver: "0x5555555555555555555555555555555555555555",
  maxAgeSeconds: 60,
  policyVersion: "fixture",
  registry: "0x6666666666666666666666666666666666666666",
  resolver: { resolve: async () => ({}) },
};

function config(overrides: Partial<ProductionA3Config> = {}): ProductionA3Config {
  return {
    budgetExpiresAt: new Date("2026-07-26T00:00:00.000Z"),
    chainId: 16602,
    databaseSecretPresent: true,
    effectId: "a".repeat(64),
    expectedSigner: signer.address.toLowerCase(),
    model: MODEL,
    ogSignerSecretPresent: true,
    provider: PROVIDER,
    railwayService: "alphadawg-production",
    releaseSha: "b".repeat(40),
    reservationAmountAtomic: "100",
    reservationEffectIdentity: "c".repeat(64),
    rpcUrl: "https://rpc.invalid",
    storageIndexerUrl: "https://indexer.invalid",
    ...overrides,
  };
}

function budgetSql(state: "RESERVED" | "AMBIGUOUS" | "MISSING" = "RESERVED") {
  let calls = 0;
  const sql = (async () => {
    calls += 1;
    if (state === "MISSING") return [];
    return [{
      amount_atomic: "100",
      asset: "A0GI",
      chain_id: 16602,
      effect_identity: "c".repeat(64),
      limit_atomic: "1000",
      release_sha: "b".repeat(40),
      reservation_id: "11111111-1111-1111-1111-111111111111",
      state,
    }];
  }) as unknown as DatabaseClient;
  return { get calls() { return calls; }, sql };
}

function factoryOptions(
  compute: ComputeFixture,
  sql: DatabaseClient,
  productionConfig = config(),
) {
  return {
    authority,
    compute,
    config: productionConfig,
    now: new Date("2026-07-25T22:00:00.000Z"),
    signal: new AbortController().signal,
    sql,
    storage: { store: async () => ({ root: `0x${"d".repeat(64)}` }) },
    verifier: async () => ({
      digest: "e".repeat(64), effectId: "a".repeat(64), root: `0x${"d".repeat(64)}`,
      schemaVersion: 1 as const, size: 8, verified: true as const,
    }),
    verifiedService: service(),
  };
}

test("production admission rejects wrong chain and missing config before any transport or budget call", async () => {
  for (const override of [{ chainId: 1 }, { railwayService: "" }, { ogSignerSecretPresent: false }]) {
    const compute = new ComputeFixture();
    const budget = budgetSql();
    await assert.rejects(
      createProductionStrictA3Runtime(factoryOptions(compute, budget.sql, config(override))),
      /A3_LIVE_BLOCKED/,
    );
    assert.equal(compute.calls.resolve, 0);
    assert.equal(budget.calls, 0);
  }
});

test("production admission rejects expired or exhausted reservation without a model call", async () => {
  const expiredCompute = new ComputeFixture();
  const expiredBudget = budgetSql();
  await assert.rejects(
    createProductionStrictA3Runtime(factoryOptions(expiredCompute, expiredBudget.sql, config({
      budgetExpiresAt: new Date("2026-07-25T21:59:59.000Z"),
    }))),
    /A3_LIVE_BLOCKED/,
  );
  assert.equal(expiredCompute.calls.resolve, 0);

  const exhaustedCompute = new ComputeFixture();
  const exhaustedBudget = budgetSql("MISSING");
  await assert.rejects(
    createProductionStrictA3Runtime(factoryOptions(exhaustedCompute, exhaustedBudget.sql)),
    /A3_BUDGET_NOT_ADMITTED/,
  );
  assert.equal(exhaustedCompute.calls.resolve, 0);
});

test("ambiguous reservation remains held and admits only verified provider metadata", async () => {
  const compute = new ComputeFixture();
  const budget = budgetSql("AMBIGUOUS");
  await createProductionStrictA3Runtime(factoryOptions(compute, budget.sql));
  assert.equal(budget.calls, 1);
  assert.equal(compute.calls.resolve, 0);

  const mismatch = new ComputeFixture();
  await assert.rejects(
    createProductionStrictA3Runtime(factoryOptions(
      mismatch,
      budgetSql().sql,
      config({ expectedSigner: "0x7777777777777777777777777777777777777777" }),
    )),
    /A3_PROVIDER_SIGNER_MISMATCH/,
  );
});

test("LangChain model makes one bounded call and exposes verified usage evidence", async () => {
  const compute = new ComputeFixture();
  const model = new ZeroGStrictChatModel({ model: MODEL, provider: PROVIDER, transport: compute });
  const operations: string[] = [];
  const result = await model.invokeStrict(
    requestBytes(),
    new AbortController().signal,
    async (operation) => { operations.push(operation); },
  );
  assert.equal(compute.calls.send, 1);
  assert.equal(result.response.usage.completionTokens, 12);
  assert.equal(result.response.usage.actualCostAtomic, "7");
  assert.deepEqual(operations, ["COMPUTE_SERVICE", "COMPUTE_HEADERS", "COMPUTE_REQUEST", "COMPUTE_SIGNATURE"]);
});

test("LangChain model rejects metadata mismatch, output overflow, and invalid signature", async () => {
  for (const [compute, code] of [
    [new ComputeFixture(12, "0x7777777777777777777777777777777777777777"), "A3_COMPUTE_RESPONSE_IDENTITY_MISMATCH"],
    [new ComputeFixture(769), "A3_COMPUTE_USAGE_MALFORMED"],
    [new ComputeFixture(12, PROVIDER, false), "A3_COMPUTE_SIGNATURE_INVALID"],
  ] as const) {
    const model = new ZeroGStrictChatModel({ model: MODEL, provider: PROVIDER, transport: compute });
    await assert.rejects(
      model.invokeStrict(requestBytes(), new AbortController().signal, async () => undefined),
      new RegExp(code),
    );
    assert.equal(compute.calls.send, 1);
  }
});
