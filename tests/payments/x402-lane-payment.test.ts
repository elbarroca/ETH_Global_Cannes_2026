import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Address, Hex } from "viem";
import { getOwnerEarnings } from "../../src/kernel/earnings";
import {
  LanePaymentError,
  finalizeLanePayment,
  prepareLanePayment,
  reconcileLanePayment,
  signPreparedLanePayment,
  type PrepareLanePaymentInput,
  type ReconcileLanePaymentDependencies,
  type SignPreparedLanePaymentDependencies,
} from "../../src/payments/x402-lane-payment";
import {
  startDisposableDatabase,
  type DisposableDatabase,
} from "../helpers/postgres";

const BUYER = "0x1111111111111111111111111111111111111111" as Address;
const CREATOR = "0x2222222222222222222222222222222222222222" as Address;
const ASSET = "0x3333333333333333333333333333333333333333" as Address;
const GATEWAY = "0x4444444444444444444444444444444444444444" as Address;
const NETWORK = "eip155:84532" as const;
const RELEASE_SHA = "5".repeat(40);
const RESULT_HASH = "6".repeat(64);
const PROOF_HASH = "7".repeat(64);
let authorityCheckId = 10_000;

interface LaneFixture {
  buyerUserId: string;
  creatorUserId: string;
  agentId: string;
  agentVersionId: string;
  quoteId: string;
  jobId: string;
  effectId: string;
  requestHash: string;
  receiptId: string;
}

async function seedLane(
  database: DisposableDatabase,
  state: "RUNNING" | "DELIVERY_READY" = "DELIVERY_READY",
): Promise<LaneFixture> {
  const fixture = {
    buyerUserId: "x402-test-buyer",
    creatorUserId: "x402-test-creator",
    agentId: randomUUID(),
    agentVersionId: randomUUID(),
    quoteId: randomUUID(),
    intentId: randomUUID(),
    orderId: randomUUID(),
    jobId: randomUUID(),
    effectId: Math.floor(Math.random() * 16).toString(16).repeat(64),
    requestHash: Math.floor(Math.random() * 16).toString(16).repeat(64),
    receiptId: randomUUID(),
  };
  if (/^(.)\1{63}$/.test(fixture.effectId)) fixture.effectId = fixture.jobId.replaceAll("-", "").padEnd(64, "a").slice(0, 64);
  if (/^(.)\1{63}$/.test(fixture.requestHash)) fixture.requestHash = fixture.quoteId.replaceAll("-", "").padEnd(64, "b").slice(0, 64);
  const now = new Date();
  await database.sql.begin(async (transaction) => {
    const sql = transaction as unknown as DisposableDatabase["sql"];
    await sql`SET LOCAL session_replication_role = replica`;
    await sql`
      INSERT INTO users (id, wallet_address)
      VALUES (${fixture.buyerUserId}, ${BUYER}), (${fixture.creatorUserId}, ${CREATOR})
      ON CONFLICT (wallet_address) DO NOTHING
    `;
    await sql`
      INSERT INTO kernel_agents (id, owner_user_id, name)
      VALUES (${fixture.agentId}::uuid, ${fixture.creatorUserId}, ${`Paid lane ${fixture.agentId}`})
    `;
    await sql`
      INSERT INTO agent_versions (
        id, agent_id, version, manifest, manifest_hash, prompt_hash, config_hash,
        capabilities, adapter_key, owner_wallet, payout_address, price_atomic,
        asset, proof_policy, lifecycle_state, canonical_state, creator_parent,
        agent_label, full_subname, published
      ) VALUES (
        ${fixture.agentVersionId}::uuid, ${fixture.agentId}::uuid, 1,
        ${sql.json({
          schemaVersion: 1,
          name: "Paid TRI_RISK lane",
          description: "Disposable protected payment fixture",
          instructions: "Return one verified lane result.",
          capabilities: ["research"],
          adapterKey: "protected-a3",
          endpoint: null,
          connectorKey: null,
          ownerWallet: CREATOR,
          payoutAddress: CREATOR,
          priceAtomic: "1000",
          asset: "USDC_ATOMIC",
          proofPolicy: "verified-receipt-required",
          ensBinding: null,
        })},
        ${"1".repeat(64)}, ${"2".repeat(64)}, ${"3".repeat(64)},
        ARRAY['research'], 'protected-a3', ${CREATOR}, ${CREATOR}, 1000,
        'USDC_ATOMIC', 'verified-receipt-required', 'DRAFT', 'UNVERIFIED',
        'creator.eth', ${`paid-${fixture.agentId.slice(0, 8)}`},
        ${`paid-${fixture.agentId.slice(0, 8)}.creator.eth`}, false
      )
    `;
    await sql`
      INSERT INTO quotes (
        id, buyer_user_id, agent_version_id, idempotency_key, input_hash,
        amount_atomic, asset, expires_at
      ) VALUES (
        ${fixture.quoteId}::uuid, ${fixture.buyerUserId}, ${fixture.agentVersionId}::uuid,
        ${`quote-${fixture.jobId}`}, ${"4".repeat(64)}, 1000, 'USDC_ATOMIC',
        ${new Date(now.getTime() + 300_000)}
      )
    `;
    await sql`
      INSERT INTO job_intents (
        id, buyer_user_id, agent_version_id, idempotency_key, input, input_hash
      ) VALUES (
        ${fixture.intentId}::uuid, ${fixture.buyerUserId}, ${fixture.agentVersionId}::uuid,
        ${`intent-${fixture.jobId}`}, ${sql.json({ prompt: "fixture" })}, ${"4".repeat(64)}
      )
    `;
    await sql`
      INSERT INTO kernel_orders (
        id, buyer_user_id, agent_version_id, intent_id, quote_id, amount_atomic, asset
      ) VALUES (
        ${fixture.orderId}::uuid, ${fixture.buyerUserId}, ${fixture.agentVersionId}::uuid,
        ${fixture.intentId}::uuid, ${fixture.quoteId}::uuid, 1000, 'USDC_ATOMIC'
      )
    `;
    await sql`
      INSERT INTO jobs (
        id, order_id, intent_id, buyer_user_id, agent_version_id, state,
        version, attempts, max_attempts
      ) VALUES (
        ${fixture.jobId}::uuid, ${fixture.orderId}::uuid, ${fixture.intentId}::uuid,
        ${fixture.buyerUserId}, ${fixture.agentVersionId}::uuid, ${state},
        ${state === "DELIVERY_READY" ? 2 : 1}, 1, 3
      )
    `;
    await sql`
      INSERT INTO effects (
        id, job_id, intent_id, idempotency_key, adapter_key, request_hash,
        state, attempt, result_hash, result, terminal_at, created_at, updated_at
      ) VALUES (
        ${fixture.effectId}, ${fixture.jobId}::uuid, ${fixture.intentId}::uuid,
        ${`effect-${fixture.jobId}`}, 'protected-a3', ${fixture.requestHash},
        'SUCCEEDED', 1, ${RESULT_HASH}, ${sql.json({ ok: true })}, ${now}, ${now}, ${now}
      )
    `;
    await sql`
      INSERT INTO receipts (
        id, job_id, effect_id, authority_check_id, verified, adapter_key,
        proof_hash, result_hash, created_at
      ) VALUES (
        ${fixture.receiptId}::uuid, ${fixture.jobId}::uuid, ${fixture.effectId},
        ${authorityCheckId++}, true, 'protected-a3', ${PROOF_HASH}, ${RESULT_HASH}, ${now}
      )
    `;
  });
  return fixture;
}

function prepareInput(jobId: string): PrepareLanePaymentInput {
  return {
    jobId,
    network: NETWORK,
    assetAddress: ASSET,
    gatewayVerifyingContract: GATEWAY,
    releaseSha: RELEASE_SHA,
    authorizationTtlSeconds: 300,
  };
}

function fundedGateway(available = 10_000n): SignPreparedLanePaymentDependencies["gateway"] {
  return {
    getBalance: async () => ({
      total: available,
      available,
      withdrawing: 0n,
      withdrawable: available,
      formattedTotal: available.toString(),
      formattedAvailable: available.toString(),
      formattedWithdrawing: "0",
      formattedWithdrawable: available.toString(),
    }),
  };
}

function fakeScheme(
  payer: Address,
  now: Date,
  nonceByte: string,
  onCall?: () => void,
): SignPreparedLanePaymentDependencies["scheme"] {
  return {
    createPaymentPayload: async (version, requirements) => {
      onCall?.();
      return {
        x402Version: version,
        payload: {
          signature: `0x${"a".repeat(130)}` as Hex,
          authorization: {
            from: payer,
            to: requirements.payTo as Address,
            value: requirements.amount,
            validAfter: Math.floor(now.getTime() / 1_000 - 60).toString(),
            validBefore: Math.floor(now.getTime() / 1_000 + 200).toString(),
            nonce: `0x${nonceByte.repeat(64)}` as Hex,
          },
        },
      };
    },
  };
}

function successFacilitator(
  payer: Address,
  transaction = randomUUID(),
  network: string = NETWORK,
  beforeReturn?: (payload: unknown) => Promise<void> | void,
): ReconcileLanePaymentDependencies["facilitator"] {
  return {
    settle: async (payload) => {
      await beforeReturn?.(payload);
      return { success: true, payer, transaction, network };
    },
  };
}

async function prepareAndSign(
  database: DisposableDatabase,
  fixture: LaneFixture,
  now: Date,
  nonceByte: string,
) {
  const attempt = await prepareLanePayment(prepareInput(fixture.jobId), {
    sql: database.sql,
    now: () => now,
    createServerNonce: () => `0x${nonceByte.repeat(64)}` as Hex,
  });
  return signPreparedLanePayment(attempt.id, {
    sql: database.sql,
    now: () => now,
    gateway: fundedGateway(),
    scheme: fakeScheme(BUYER, now, nonceByte),
  });
}

async function economicCounts(database: DisposableDatabase, jobId: string) {
  const rows = await database.sql<{
    attempts: number;
    payments: number;
    settlements: number;
    commissions: number;
  }[]>`
    SELECT
      (SELECT count(*)::INTEGER FROM x402_payment_attempts WHERE job_id = ${jobId}::uuid) AS attempts,
      (SELECT count(*)::INTEGER FROM x402_payment_receipts WHERE job_id = ${jobId}::uuid) AS payments,
      (SELECT count(*)::INTEGER FROM settlements WHERE job_id = ${jobId}::uuid) AS settlements,
      (SELECT count(*)::INTEGER FROM commissions WHERE job_id = ${jobId}::uuid) AS commissions
  `;
  return rows[0];
}

test("protected x402 lane journal is fail-closed, replay-safe, and atomic", async (t) => {
  const database = await startDisposableDatabase("x402-lane-payment");
  const now = new Date();
  try {
    await t.test("does not prepare or pay before DELIVERY_READY", async () => {
      const fixture = await seedLane(database, "RUNNING");
      await assert.rejects(
        prepareLanePayment(prepareInput(fixture.jobId), {
          sql: database.sql,
          now: () => now,
          createServerNonce: () => `0x${"1".repeat(64)}` as Hex,
        }),
        (error) => error instanceof LanePaymentError && error.code === "X402_LANE_NOT_READY",
      );
      assert.deepEqual(await economicCounts(database, fixture.jobId), {
        attempts: 0,
        payments: 0,
        settlements: 0,
        commissions: 0,
      });
    });

    const main = await seedLane(database);
    let mainAttemptId = "";

    await t.test("persists one exact challenge and converges 20 concurrent prepares", async () => {
      const input = prepareInput(main.jobId);
      const attempts = await Promise.all(
        Array.from({ length: 20 }, (_, index) => prepareLanePayment(input, {
          sql: database.sql,
          now: () => now,
          createServerNonce: () => `0x${(index % 10).toString().repeat(64)}` as Hex,
        })),
      );
      mainAttemptId = attempts[0]?.id ?? "";
      assert.ok(mainAttemptId);
      assert.deepEqual(new Set(attempts.map((attempt) => attempt.id)), new Set([mainAttemptId]));
      assert.equal(attempts[0]?.state, "PREPARED");
      assert.equal(attempts[0]?.quoteId, main.quoteId);
      assert.equal(attempts[0]?.effectRequestHash, main.requestHash);
      assert.equal(attempts[0]?.paymentRequirements, null);
    });

    await t.test("database rejects every prepared identity binding tamper", async () => {
      const mutations = [
        "job_id = gen_random_uuid()",
        "quote_id = gen_random_uuid()",
        "delivery_receipt_id = gen_random_uuid()",
        "agent_version_id = gen_random_uuid()",
        "job_version = job_version + 1",
        "payer_address = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'",
        "creator_recipient = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'",
        "network = 'eip155:1', chain_id = 1",
        "asset_address = '0xcccccccccccccccccccccccccccccccccccccccc'",
        "asset = 'OTHER'",
        "amount_atomic = amount_atomic + 1",
        `effect_request_hash = '${"8".repeat(64)}'`,
        `release_sha = '${"9".repeat(40)}'`,
        "gateway_verifying_contract = '0xdddddddddddddddddddddddddddddddddddddddd'",
        "expires_at = expires_at + interval '1 second'",
        `server_nonce = '0x${"a".repeat(64)}'`,
        `server_nonce_hash = '${"b".repeat(64)}'`,
        "challenge = challenge || '{\"tampered\":true}'::jsonb",
        `challenge_hash = '${"c".repeat(64)}'`,
      ];
      for (const mutation of mutations) {
        await assert.rejects(
          database.sql.unsafe(
            `UPDATE x402_payment_attempts SET ${mutation} WHERE id = '${mainAttemptId}'::uuid`,
          ),
          /immutable|constraint|violates|not present/i,
          mutation,
        );
      }
    });

    await t.test("checks Gateway balance before signing and never re-signs a stored payload", async () => {
      let schemeCalls = 0;
      await assert.rejects(
        signPreparedLanePayment(mainAttemptId, {
          sql: database.sql,
          now: () => now,
          gateway: fundedGateway(999n),
          scheme: fakeScheme(BUYER, now, "d", () => schemeCalls++),
        }),
        (error) => error instanceof LanePaymentError && error.code === "X402_INSUFFICIENT_BALANCE",
      );
      assert.equal(schemeCalls, 0);
      const signed = await signPreparedLanePayment(mainAttemptId, {
        sql: database.sql,
        now: () => now,
        gateway: fundedGateway(),
        scheme: fakeScheme(BUYER, now, "d", () => schemeCalls++),
      });
      assert.equal(signed.state, "SIGNED");
      assert.equal(schemeCalls, 1);
      const replay = await signPreparedLanePayment(mainAttemptId, {
        sql: database.sql,
        now: () => now,
        gateway: fundedGateway(),
        scheme: fakeScheme(BUYER, now, "e", () => schemeCalls++),
      });
      assert.equal(replay.signedPayloadHash, signed.signedPayloadHash);
      assert.equal(replay.authorizationNonce, signed.authorizationNonce);
      assert.equal(schemeCalls, 1);
    });

    await t.test("persists SUBMITTED before facilitator work and accepts only exact Gateway success", async () => {
      const settled = await reconcileLanePayment(mainAttemptId, {
        sql: database.sql,
        now: () => now,
        facilitator: successFacilitator(BUYER, randomUUID(), NETWORK, async () => {
          const rows = await database.sql<{ state: string }[]>`
            SELECT state FROM x402_payment_attempts WHERE id = ${mainAttemptId}::uuid
          `;
          assert.equal(rows[0]?.state, "SUBMITTED");
        }),
      });
      assert.equal(settled.state, "GATEWAY_SETTLED");
      assert.match(settled.gatewayTransactionId ?? "", /^[0-9a-f-]{36}$/);
    });

    await t.test("finalizes once under 20-way concurrency with truthful Gateway fields", async () => {
      const results = await Promise.all(
        Array.from({ length: 20 }, () => finalizeLanePayment(mainAttemptId, {
          sql: database.sql,
          now: () => new Date(now.getTime() + 1_000),
        })),
      );
      assert.equal(new Set(results.map((result) => result.paymentReceiptId)).size, 1);
      assert.equal(new Set(results.map((result) => result.settlementId)).size, 1);
      assert.equal(new Set(results.map((result) => result.commissionId)).size, 1);
      const rows = await database.sql<{
        attempt_state: string;
        job_state: string;
        financial_outcome: string;
        settlement_kind: string;
        gateway_transaction_id: string;
        transaction_hash: string | null;
        finality_block: string | null;
        payer_delta: string | null;
        commission_owner: string;
        settlement_amount: string;
        commission_amount: string;
      }[]>`
        SELECT attempt.state AS attempt_state, job.state AS job_state,
          job.financial_outcome, payment.settlement_kind,
          payment.gateway_transaction_id::TEXT, payment.transaction_hash,
          payment.finality_block::TEXT, payment.payer_balance_delta_atomic::TEXT AS payer_delta,
          commission.recipient_user_id AS commission_owner,
          settlement.amount_atomic::TEXT AS settlement_amount,
          commission.amount_atomic::TEXT AS commission_amount
        FROM x402_payment_attempts attempt
        JOIN jobs job ON job.id = attempt.job_id
        JOIN x402_payment_receipts payment ON payment.payment_attempt_id = attempt.id
        JOIN settlements settlement ON settlement.job_id = job.id
        JOIN commissions commission ON commission.job_id = job.id
        WHERE attempt.id = ${mainAttemptId}::uuid
      `;
      assert.deepEqual(rows[0], {
        attempt_state: "FINALIZED",
        job_state: "SUCCEEDED",
        financial_outcome: "SETTLED",
        settlement_kind: "GATEWAY_NANOPAYMENT",
        gateway_transaction_id: rows[0]?.gateway_transaction_id,
        transaction_hash: null,
        finality_block: null,
        payer_delta: null,
        commission_owner: main.creatorUserId,
        settlement_amount: "1000",
        commission_amount: "1000",
      });
      assert.deepEqual(await getOwnerEarnings(main.creatorUserId, { sql: database.sql }), {
        asset: "USDC_ATOMIC",
        decimals: 6,
        grossSettledAtomic: "1000",
        ownerEarningsAtomic: "1000",
        platformFeeAtomic: "0",
        settledHireCount: 1,
        lastSettledAt: new Date(now.getTime() + 1_000).toISOString(),
        agents: [{
          agentVersionId: main.agentVersionId,
          name: `Paid lane ${main.agentId}`,
          fullSubname: `paid-${main.agentId.slice(0, 8)}.creator.eth`,
          ownerEarningsAtomic: "1000",
          settledHireCount: 1,
          lastSettledAt: new Date(now.getTime() + 1_000).toISOString(),
        }],
      });
      assert.equal((await getOwnerEarnings(main.buyerUserId, { sql: database.sql })).settledHireCount, 0);
    });

    await t.test("definitive refusal records FAILED without an economic receipt", async () => {
      const fixture = await seedLane(database);
      const signed = await prepareAndSign(database, fixture, now, "1");
      const failed = await reconcileLanePayment(signed.id, {
        sql: database.sql,
        now: () => now,
        facilitator: {
          settle: async () => ({
            success: false,
            errorReason: "invalid_signature",
            payer: BUYER,
            transaction: "",
            network: NETWORK,
          }),
        },
      });
      assert.equal(failed.state, "FAILED");
      assert.deepEqual(await economicCounts(database, fixture.jobId), {
        attempts: 1,
        payments: 0,
        settlements: 0,
        commissions: 0,
      });
    });

    await t.test("transport ambiguity reuses the identical payload and nonce", async () => {
      const fixture = await seedLane(database);
      const signed = await prepareAndSign(database, fixture, now, "2");
      let firstPayload = "";
      const ambiguous = await reconcileLanePayment(signed.id, {
        sql: database.sql,
        now: () => now,
        facilitator: {
          settle: async (payload) => {
            firstPayload = JSON.stringify(payload);
            throw Object.assign(new Error("gateway timeout"), { statusCode: 504 });
          },
        },
      });
      assert.equal(ambiguous.state, "AMBIGUOUS");
      const settled = await reconcileLanePayment(signed.id, {
        sql: database.sql,
        now: () => new Date(now.getTime() + 1_000),
        facilitator: successFacilitator(BUYER, randomUUID(), NETWORK, (payload) => {
          assert.equal(JSON.stringify(payload), firstPayload);
        }),
      });
      assert.equal(settled.state, "GATEWAY_SETTLED");
      assert.equal(settled.authorizationNonce, signed.authorizationNonce);
    });

    await t.test("nonce-used, wrong payer/network, and non-UUID success remain ambiguous", async () => {
      const cases = [
        {
          label: "nonce used",
          result: { success: false, errorReason: "nonce already used", transaction: "", network: NETWORK },
        },
        {
          label: "wrong payer",
          result: { success: true, payer: CREATOR, transaction: randomUUID(), network: NETWORK },
        },
        {
          label: "wrong network",
          result: { success: true, payer: BUYER, transaction: randomUUID(), network: "eip155:1" },
        },
        {
          label: "non-UUID transaction",
          result: { success: true, payer: BUYER, transaction: `0x${"a".repeat(64)}`, network: NETWORK },
        },
      ];
      for (const [index, entry] of cases.entries()) {
        const fixture = await seedLane(database);
        const signed = await prepareAndSign(database, fixture, now, (index + 3).toString());
        const reconciled = await reconcileLanePayment(signed.id, {
          sql: database.sql,
          now: () => now,
          facilitator: { settle: async () => entry.result },
        });
        assert.equal(reconciled.state, "AMBIGUOUS", entry.label);
        assert.equal((await economicCounts(database, fixture.jobId))?.payments, 0);
      }
    });

    await t.test("a late commission failure rolls back receipt, job, and settlement together", async () => {
      const fixture = await seedLane(database);
      const signed = await prepareAndSign(database, fixture, now, "8");
      const settled = await reconcileLanePayment(signed.id, {
        sql: database.sql,
        now: () => now,
        facilitator: successFacilitator(BUYER),
      });
      await database.sql.unsafe(`
        CREATE FUNCTION public.test_reject_x402_commission() RETURNS TRIGGER
        LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test commission crash'; END $$;
        CREATE TRIGGER test_reject_x402_commission
        BEFORE INSERT ON public.commissions
        FOR EACH ROW EXECUTE FUNCTION public.test_reject_x402_commission();
      `);
      try {
        await assert.rejects(
          finalizeLanePayment(settled.id, {
            sql: database.sql,
            now: () => new Date(now.getTime() + 1_000),
          }),
          /test commission crash/,
        );
      } finally {
        await database.sql.unsafe(`
          DROP TRIGGER test_reject_x402_commission ON public.commissions;
          DROP FUNCTION public.test_reject_x402_commission();
        `);
      }
      assert.deepEqual(await economicCounts(database, fixture.jobId), {
        attempts: 1,
        payments: 0,
        settlements: 0,
        commissions: 0,
      });
      const rows = await database.sql<{ attempt_state: string; job_state: string }[]>`
        SELECT attempt.state AS attempt_state, job.state AS job_state
        FROM x402_payment_attempts attempt JOIN jobs job ON job.id = attempt.job_id
        WHERE attempt.id = ${settled.id}::uuid
      `;
      assert.deepEqual(rows[0], { attempt_state: "GATEWAY_SETTLED", job_state: "DELIVERY_READY" });
    });

    await t.test("legacy EVM receipt shape remains valid and distinct from Gateway UUIDs", async () => {
      const fixture = await seedLane(database);
      const finalizedAt = new Date(now.getTime() - 1_000);
      const rows = await database.sql<{
        settlement_kind: string;
        payment_attempt_id: string | null;
        gateway_transaction_id: string | null;
        transaction_hash: string;
      }[]>`
        INSERT INTO x402_payment_receipts (
          job_id, delivery_receipt_id, agent_version_id, payer_address,
          creator_recipient, network, chain_id, asset_address, amount_atomic,
          facilitator_payload, facilitator_payload_hash, transaction_hash,
          finality_block, finality_block_hash, finalized_at,
          payer_balance_delta_atomic, creator_balance_delta_atomic,
          request_hash, release_hash, release_sha, created_at
        ) VALUES (
          ${fixture.jobId}::uuid, ${fixture.receiptId}::uuid, ${fixture.agentVersionId}::uuid,
          ${BUYER}, ${CREATOR}, 'base-sepolia', 84532,
          '0x036cbd53842c5426634e7929541ec2318f3dcf7e', 1000,
          ${database.sql.json({ legacy: true })}, ${"a".repeat(64)},
          ${`0x${"b".repeat(64)}`}, 1, ${`0x${"c".repeat(64)}`}, ${finalizedAt},
          -1000, 1000, ${fixture.requestHash}, ${"d".repeat(64)}, ${RELEASE_SHA}, ${now}
        )
        RETURNING settlement_kind, payment_attempt_id::TEXT,
          gateway_transaction_id::TEXT, transaction_hash
      `;
      assert.deepEqual(rows[0], {
        settlement_kind: "LEGACY_EVM",
        payment_attempt_id: null,
        gateway_transaction_id: null,
        transaction_hash: `0x${"b".repeat(64)}`,
      });
    });
  } finally {
    await database.close();
  }
});
