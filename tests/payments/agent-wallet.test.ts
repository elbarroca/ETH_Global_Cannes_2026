import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  BadRequestError,
  ForbiddenError,
  HttpRequestError,
  UnauthorizedError,
} from "@circle-fin/developer-controlled-wallets";
import {
  CircleAgentWalletError,
  createAgentWallet,
  type CircleAgentWalletErrorReason,
} from "../../src/payments/circle-wallet";

type CircleWalletClient = NonNullable<Parameters<typeof createAgentWallet>[2]>;
type CreateWalletResponse = Awaited<ReturnType<CircleWalletClient["createWallets"]>>;

const WALLET_SET_ID = randomUUID();
const AGENT_ONE = randomUUID();
const AGENT_TWO = randomUUID();
const WALLET_ONE = randomUUID();
const WALLET_TWO = randomUUID();
const ADDRESS_ONE = "0x1111111111111111111111111111111111111111";
const ADDRESS_TWO = "0x2222222222222222222222222222222222222222";

interface MockWallet {
  id: string;
  address: string;
  blockchain: string;
  state: string;
  walletSetId: string;
}

function walletResponse(wallet: MockWallet): CreateWalletResponse {
  return { data: { wallets: [wallet] } } as CreateWalletResponse;
}

function failingClient(error: unknown): CircleWalletClient {
  return {
    async createWallets() {
      throw error;
    },
  };
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail("Expected promise to reject");
}

test("protected Circle agent wallets are strict and idempotent", async (t) => {
  const previous = {
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
    walletSetId: process.env.CIRCLE_WALLET_SET_ID,
  };
  process.env.CIRCLE_API_KEY = "agent-wallet-test-api-secret";
  process.env.CIRCLE_ENTITY_SECRET = "agent-wallet-test-entity-secret";
  process.env.CIRCLE_WALLET_SET_ID = WALLET_SET_ID;
  t.after(() => {
    if (previous.apiKey === undefined) delete process.env.CIRCLE_API_KEY;
    else process.env.CIRCLE_API_KEY = previous.apiKey;
    if (previous.entitySecret === undefined) delete process.env.CIRCLE_ENTITY_SECRET;
    else process.env.CIRCLE_ENTITY_SECRET = previous.entitySecret;
    if (previous.walletSetId === undefined) delete process.env.CIRCLE_WALLET_SET_ID;
    else process.env.CIRCLE_WALLET_SET_ID = previous.walletSetId;
  });

  await t.test("same key replays one identity and distinct agents stay distinct", async () => {
    const calls: Parameters<CircleWalletClient["createWallets"]>[0][] = [];
    const byKey = new Map<string, CreateWalletResponse>();
    const identities = new Map<string, { id: string; address: string }>([
      [AGENT_ONE, { id: WALLET_ONE, address: ADDRESS_ONE }],
      [AGENT_TWO, { id: WALLET_TWO, address: ADDRESS_TWO }],
    ]);
    const circle: CircleWalletClient = {
      async createWallets(input) {
        calls.push(structuredClone(input));
        const existing = input.idempotencyKey && byKey.get(input.idempotencyKey);
        if (existing) return existing;
        const agentId = input.metadata?.[0]?.refId;
        const identity = agentId && identities.get(agentId);
        assert.ok(identity);
        const response = walletResponse({
          ...identity,
          blockchain: "UNI-SEPOLIA",
          state: "LIVE",
          walletSetId: WALLET_SET_ID,
        });
        assert.ok(input.idempotencyKey);
        byKey.set(input.idempotencyKey, response);
        return response;
      },
    };

    const firstKey = randomUUID();
    const first = await createAgentWallet(AGENT_ONE, firstKey, circle);
    const replay = await createAgentWallet(AGENT_ONE, firstKey, circle);
    const second = await createAgentWallet(AGENT_TWO, randomUUID(), circle);

    assert.deepEqual(replay, first);
    assert.notEqual(second.walletId, first.walletId);
    assert.notEqual(second.address, first.address);
    assert.deepEqual(first, {
      provider: "circle",
      walletId: WALLET_ONE,
      address: ADDRESS_ONE,
      network: "UNI-SEPOLIA",
      accountType: "SCA",
    });
    assert.deepEqual(calls[0], {
      walletSetId: WALLET_SET_ID,
      blockchains: ["UNI-SEPOLIA"],
      count: 1,
      accountType: "SCA",
      idempotencyKey: firstKey,
      metadata: [{ name: `AlphaDawg-Agent-${AGENT_ONE}`, refId: AGENT_ONE }],
    });
    assert.equal(calls[1]?.idempotencyKey, firstKey);
    assert.deepEqual(calls[2]?.metadata, [
      { name: `AlphaDawg-Agent-${AGENT_TWO}`, refId: AGENT_TWO },
    ]);
    const observable = JSON.stringify({ calls, first, replay, second });
    assert.doesNotMatch(observable, /agent-wallet-test-(api|entity)-secret/);
  });

  await t.test("malformed request IDs stop before the SDK", async () => {
    let calls = 0;
    const circle: CircleWalletClient = {
      async createWallets() {
        calls += 1;
        return walletResponse({
          id: WALLET_ONE,
          address: ADDRESS_ONE,
          blockchain: "UNI-SEPOLIA",
          state: "LIVE",
          walletSetId: WALLET_SET_ID,
        });
      },
    };

    await assert.rejects(createAgentWallet("not-a-uuid", randomUUID(), circle), /agentId must be a UUID/);
    await assert.rejects(
      createAgentWallet(AGENT_ONE, "00000000-0000-1000-8000-000000000000", circle),
      /idempotencyKey must be a UUIDv4/,
    );
    assert.equal(calls, 0);
  });

  await t.test("malformed Circle responses fail closed without secret output", async () => {
    const invalidWallets: Array<{ wallet: MockWallet; message: RegExp }> = [
      {
        wallet: {
          id: "not-a-uuid",
          address: ADDRESS_ONE,
          blockchain: "UNI-SEPOLIA",
          state: "LIVE",
          walletSetId: WALLET_SET_ID,
        },
        message: /invalid wallet ID/,
      },
      {
        wallet: {
          id: WALLET_ONE,
          address: "0x0000000000000000000000000000000000000000",
          blockchain: "UNI-SEPOLIA",
          state: "LIVE",
          walletSetId: WALLET_SET_ID,
        },
        message: /invalid address/,
      },
      {
        wallet: {
          id: WALLET_ONE,
          address: ADDRESS_ONE,
          blockchain: "ETH-SEPOLIA",
          state: "LIVE",
          walletSetId: WALLET_SET_ID,
        },
        message: /unexpected network/,
      },
      {
        wallet: {
          id: WALLET_ONE,
          address: ADDRESS_ONE,
          blockchain: "UNI-SEPOLIA",
          state: "FROZEN",
          walletSetId: WALLET_SET_ID,
        },
        message: /not live/,
      },
      {
        wallet: {
          id: WALLET_ONE,
          address: ADDRESS_ONE,
          blockchain: "UNI-SEPOLIA",
          state: "LIVE",
          walletSetId: randomUUID(),
        },
        message: /unexpected wallet set/,
      },
    ];

    for (const { wallet, message } of invalidWallets) {
      const circle: CircleWalletClient = {
        async createWallets() {
          return walletResponse(wallet);
        },
      };
      const error = await assert.rejects(createAgentWallet(AGENT_ONE, randomUUID(), circle), message);
      assert.doesNotMatch(String(error), /agent-wallet-test-(api|entity)-secret/);
    }

    const empty: CircleWalletClient = {
      async createWallets() {
        return { data: { wallets: [] } } as unknown as CreateWalletResponse;
      },
    };
    await assert.rejects(createAgentWallet(AGENT_ONE, randomUUID(), empty), /invalid wallet count/);
  });

  await t.test("Circle response failures expose only stable safe fields", async () => {
    const secret = "circle-api-key-entity-secret-ciphertext-wallet-set";
    const url = `https://api.circle.example/${secret}`;
    const cases: Array<{
      sdkError: BadRequestError | UnauthorizedError | ForbiddenError;
      reason: CircleAgentWalletErrorReason;
      status: number;
      providerCode: string;
    }> = [
      {
        sdkError: new BadRequestError({
          message: secret,
          code: 156017,
          url,
          method: "POST",
          status: 400,
        }),
        reason: "invalid_request",
        status: 400,
        providerCode: "156017",
      },
      {
        sdkError: new UnauthorizedError({
          message: secret,
          code: 401,
          url,
          method: "POST",
          status: 401,
        }),
        reason: "unauthorized",
        status: 401,
        providerCode: "401",
      },
      {
        sdkError: new ForbiddenError({
          message: secret,
          code: 403,
          url,
          method: "POST",
          status: 403,
        }),
        reason: "forbidden",
        status: 403,
        providerCode: "403",
      },
    ];

    for (const expected of cases) {
      const error = await rejectionOf(
        createAgentWallet(AGENT_ONE, randomUUID(), failingClient(expected.sdkError)),
      );
      assert.ok(error instanceof CircleAgentWalletError);
      assert.deepEqual(
        {
          name: error.name,
          message: error.message,
          reason: error.reason,
          status: error.status,
          providerCode: error.providerCode,
        },
        {
          name: "CircleAgentWalletError",
          message: "Circle agent wallet creation failed",
          reason: expected.reason,
          status: expected.status,
          providerCode: expected.providerCode,
        },
      );
      assert.equal("cause" in error, false);
      assert.doesNotMatch(JSON.stringify(error), new RegExp(secret));
      assert.doesNotMatch(String(error.stack), new RegExp(secret));
    }
  });

  await t.test("Circle request and generic failures cannot disclose provider secrets", async () => {
    const secret = "circle-api-key-entity-secret-ciphertext-wallet-set";
    const requestError = new HttpRequestError({
      message: secret,
      code: "ECONNRESET",
      url: `https://api.circle.example/${secret}`,
      method: "POST",
    });

    const requestFailure = await rejectionOf(
      createAgentWallet(AGENT_ONE, randomUUID(), failingClient(requestError)),
    );
    assert.ok(requestFailure instanceof CircleAgentWalletError);
    assert.deepEqual(
      {
        reason: requestFailure.reason,
        status: requestFailure.status,
        providerCode: requestFailure.providerCode,
      },
      { reason: "provider_request", status: null, providerCode: "ECONNRESET" },
    );

    const genericFailure = await rejectionOf(
      createAgentWallet(
        AGENT_ONE,
        randomUUID(),
        failingClient(new Error(`${secret}: headers body API key entity secret`)),
      ),
    );
    assert.ok(genericFailure instanceof CircleAgentWalletError);
    assert.deepEqual(
      {
        reason: genericFailure.reason,
        status: genericFailure.status,
        providerCode: genericFailure.providerCode,
      },
      { reason: "provider_failure", status: null, providerCode: null },
    );

    const observable = JSON.stringify({ requestFailure, genericFailure });
    assert.doesNotMatch(observable, new RegExp(secret));
    assert.doesNotMatch(String(requestFailure.stack), new RegExp(secret));
    assert.doesNotMatch(String(genericFailure.stack), new RegExp(secret));
  });
});
