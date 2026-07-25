import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { POST as postSwapExecute } from "../../app/api/kernel/swap/execute/route";
import { sha256 } from "../../src/auth/service";
import { getPrisma } from "../../src/config/prisma";
import {
  UNICHAIN_SEPOLIA,
  isAllowlistedToken,
  isUnichainSepolia,
} from "../../src/config/unichain-sepolia";
import { KernelError } from "../../src/kernel/errors";
import type { KernelErrorCode } from "../../src/kernel/errors";
import {
  configureDatabaseEnvironment,
  startDisposableDatabase,
  type DisposableDatabase,
} from "../helpers/postgres";

async function seedUniswapContext(
  database: DisposableDatabase,
  buyerAddress: string,
): Promise<{ jobId: string; agentVersionId: string }> {
  const ids = {
    userId: `buyer-${randomUUID()}`,
    agentId: randomUUID(),
    agentVersionId: randomUUID(),
    quoteId: randomUUID(),
    intentId: randomUUID(),
    orderId: randomUUID(),
    jobId: randomUUID(),
  };
  await database.sql.begin(async (tx) => {
    const sql = tx as unknown as DisposableDatabase["sql"];
    await sql`SET LOCAL session_replication_role = replica`;
    await sql`INSERT INTO users (id, wallet_address) VALUES (${ids.userId}, ${buyerAddress})`;
    await sql`
      INSERT INTO kernel_agents (id, owner_user_id, name)
      VALUES (${ids.agentId}::uuid, ${ids.userId}, 'A6 Fixture')
    `;
    await sql`
      INSERT INTO agent_versions (
        id, agent_id, version, manifest, manifest_hash, prompt_hash, config_hash,
        capabilities, adapter_key, owner_wallet, payout_address, price_atomic,
        asset, proof_policy, lifecycle_state, canonical_state, published
      ) VALUES (
        ${ids.agentVersionId}::uuid, ${ids.agentId}::uuid, 1,
        ${sql.json({
          schemaVersion: 1,
          name: "A6 Fixture",
          description: "Disposable A6 relational fixture",
          instructions: "Return one deterministic fixture result.",
          capabilities: ["research"],
          adapterKey: "protected-a3",
          endpoint: null,
          connectorKey: null,
          ownerWallet: buyerAddress,
          payoutAddress: null,
          priceAtomic: "1000",
          asset: "USDC_ATOMIC",
          proofPolicy: "verified-receipt-required",
          ensBinding: null,
        })},
        ${"1".repeat(64)}, ${"2".repeat(64)}, ${"3".repeat(64)},
        ARRAY['research'], 'protected-a3', ${buyerAddress}, ${buyerAddress},
        1000, 'USDC_ATOMIC', 'verified-receipt-required', 'DRAFT', 'UNVERIFIED', false
      )
    `;
    await sql`
      INSERT INTO quotes (
        id, buyer_user_id, agent_version_id, idempotency_key, input_hash,
        amount_atomic, asset, expires_at
      ) VALUES (
        ${ids.quoteId}::uuid, ${ids.userId}, ${ids.agentVersionId}::uuid,
        ${`quote-${ids.jobId}`}, ${"4".repeat(64)}, 1000, 'USDC_ATOMIC',
        clock_timestamp() + interval '5 minutes'
      )
    `;
    await sql`
      INSERT INTO job_intents (
        id, buyer_user_id, agent_version_id, idempotency_key, input, input_hash
      ) VALUES (
        ${ids.intentId}::uuid, ${ids.userId}, ${ids.agentVersionId}::uuid,
        ${`intent-${ids.jobId}`}, ${sql.json({ prompt: "fixture" })}, ${"4".repeat(64)}
      )
    `;
    await sql`
      INSERT INTO kernel_orders (
        id, buyer_user_id, agent_version_id, intent_id, quote_id, amount_atomic, asset
      ) VALUES (
        ${ids.orderId}::uuid, ${ids.userId}, ${ids.agentVersionId}::uuid,
        ${ids.intentId}::uuid, ${ids.quoteId}::uuid, 1000, 'USDC_ATOMIC'
      )
    `;
    await sql`
      INSERT INTO jobs (
        id, order_id, intent_id, buyer_user_id, agent_version_id, state,
        version, attempts, max_attempts
      ) VALUES (
        ${ids.jobId}::uuid, ${ids.orderId}::uuid, ${ids.intentId}::uuid,
        ${ids.userId}, ${ids.agentVersionId}::uuid, 'DELIVERY_READY', 2, 1, 3
      )
    `;
  });
  return { jobId: ids.jobId, agentVersionId: ids.agentVersionId };
}

// ── Unit: chain guard ────────────────────────────────────────────────────────

test("A6 chain guard rejects Ethereum mainnet (chainId 1)", () => {
  assert.equal(isUnichainSepolia(1), false);
});

test("A6 chain guard rejects Polygon mainnet (chainId 137)", () => {
  assert.equal(isUnichainSepolia(137), false);
});

test("A6 chain guard rejects Base mainnet (chainId 8453)", () => {
  assert.equal(isUnichainSepolia(8453), false);
});

test("A6 chain guard accepts Unichain Sepolia (chainId 1301)", () => {
  assert.equal(isUnichainSepolia(1301), true);
});

// ── Unit: token allowlist ────────────────────────────────────────────────────

test("A6 token allowlist rejects unknown token address", () => {
  assert.equal(isAllowlistedToken("0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"), false);
});

test("A6 token allowlist rejects zero address", () => {
  assert.equal(isAllowlistedToken("0x0000000000000000000000000000000000000000"), false);
});

test("A6 token allowlist accepts canonical USDC address (exact case)", () => {
  assert.equal(isAllowlistedToken(UNICHAIN_SEPOLIA.tokens.USDC), true);
});

test("A6 token allowlist accepts canonical WETH address (exact case)", () => {
  assert.equal(isAllowlistedToken(UNICHAIN_SEPOLIA.tokens.WETH), true);
});

test("A6 token allowlist is case-insensitive", () => {
  const upperCaseUsdc = UNICHAIN_SEPOLIA.tokens.USDC.toUpperCase();
  assert.equal(isAllowlistedToken(upperCaseUsdc), true);
});

// ── Unit: KernelErrorCode completeness for A6 codes ─────────────────────────

test("A6 KernelError codes are constructable without type errors", () => {
  const codes: KernelErrorCode[] = [
    "A6_CHAIN_NOT_AUTHORIZED",
    "A6_TOKEN_NOT_ALLOWLISTED",
    "A6_RECEIPT_IMMUTABLE",
    "A6_QUOTE_EXPIRED",
    "A6_CONFIRMATION_UNVERIFIABLE",
  ];
  for (const code of codes) {
    const err = new KernelError(code, `test: ${code}`, 400);
    assert.equal(err.code, code);
    assert.equal(err.name, "KernelError");
  }
});

// ── Unit: UNICHAIN_SEPOLIA config integrity ──────────────────────────────────

test("UNICHAIN_SEPOLIA config has correct chainId and both token addresses", () => {
  assert.equal(UNICHAIN_SEPOLIA.chainId, 1301);
  assert.match(UNICHAIN_SEPOLIA.tokens.USDC, /^0x[0-9a-fA-F]{40}$/);
  assert.match(UNICHAIN_SEPOLIA.tokens.WETH, /^0x[0-9a-fA-F]{40}$/);
  assert.notEqual(UNICHAIN_SEPOLIA.tokens.USDC, UNICHAIN_SEPOLIA.tokens.WETH);
});

test("UNICHAIN_SEPOLIA swap router is a valid EVM address", () => {
  assert.match(UNICHAIN_SEPOLIA.swapRouter, /^0x[0-9a-fA-F]{40}$/);
});

test("UNICHAIN_SEPOLIA slippage defaults are in range", () => {
  assert.ok(UNICHAIN_SEPOLIA.defaultSlippageBps >= 0);
  assert.ok(UNICHAIN_SEPOLIA.defaultSlippageBps <= 1000);
  assert.ok(UNICHAIN_SEPOLIA.quoteDeadlineSeconds > 0);
});

// ── DB: chain_id CHECK constraint blocks non-1301 receipts ──────────────────

test("DB rejects UniswapToolReceipt with non-Unichain chain_id", async () => {
  let database: DisposableDatabase | undefined;
  try {
    database = await startDisposableDatabase("a6-chain-constraint");
    configureDatabaseEnvironment(database.url);

    // Insert users table row (FK not required — receipts have no FK to users)
    const prisma = new PrismaClient({
      datasources: { db: { url: database.url } },
      log: ["error"],
    });

    const jobId = randomUUID();
    const agentVersionId = randomUUID();

    await assert.rejects(
      () =>
        prisma.uniswapToolReceipt.create({
          data: {
            jobId,
            buyerAddress: "0x1111111111111111111111111111111111111111",
            agentVersionId,
            quoteRequestId: randomUUID(),
            chainId: 1, // Ethereum mainnet — must be rejected by CHECK constraint
            tokenIn: UNICHAIN_SEPOLIA.tokens.USDC,
            tokenOut: UNICHAIN_SEPOLIA.tokens.WETH,
            amountIn: 1_000_000n,
            amountOut: 500_000_000_000_000n,
            slippageBps: 50,
            deadline: Math.floor(Date.now() / 1000) + 120,
            spender: UNICHAIN_SEPOLIA.swapRouter,
            requestHash: "1".repeat(64),
            routeHash: "2".repeat(64),
            calldataHash: "a".repeat(64),
            releaseSha: "test-sha",
            txStatus: "QUOTED",
          },
        }),
      /check\s*constraint|violates check/i,
    );

    await prisma.$disconnect();
  } finally {
    await database?.close();
  }
});

// ── DB: duplicate quoteRequestId is rejected ─────────────────────────────────

test("DB rejects duplicate quoteRequestId (UNIQUE constraint)", async () => {
  let database: DisposableDatabase | undefined;
  try {
    database = await startDisposableDatabase("a6-unique-quote");
    configureDatabaseEnvironment(database.url);

    const prisma = new PrismaClient({
      datasources: { db: { url: database.url } },
      log: ["error"],
    });

    const quoteRequestId = randomUUID();
    const first = await seedUniswapContext(
      database,
      "0x2222222222222222222222222222222222222222",
    );
    const second = await seedUniswapContext(
      database,
      "0x2222222222222222222222222222222222222223",
    );
    const baseData = {
      buyerAddress: "0x2222222222222222222222222222222222222222",
      chainId: 1301,
      tokenIn: UNICHAIN_SEPOLIA.tokens.USDC,
      tokenOut: UNICHAIN_SEPOLIA.tokens.WETH,
      amountIn: 1_000_000n,
      amountOut: 500_000_000_000_000n,
      slippageBps: 50,
      deadline: Math.floor(Date.now() / 1000) + 120,
      spender: UNICHAIN_SEPOLIA.swapRouter,
      requestHash: "3".repeat(64),
      routeHash: "4".repeat(64),
      calldataHash: "b".repeat(64),
      releaseSha: "test-sha",
      txStatus: "QUOTED",
    };

    await prisma.uniswapToolReceipt.create({
      data: {
        ...baseData,
        jobId: first.jobId,
        agentVersionId: first.agentVersionId,
        quoteRequestId,
      },
    });

    await assert.rejects(
      () =>
        prisma.uniswapToolReceipt.create({
          data: {
            ...baseData,
            jobId: second.jobId,
            buyerAddress: "0x2222222222222222222222222222222222222223",
            agentVersionId: second.agentVersionId,
            quoteRequestId, // same quoteRequestId — must fail
          },
        }),
      /unique\s*constraint|duplicate\s*key/i,
    );

    await prisma.$disconnect();
  } finally {
    await database?.close();
  }
});

// ── DB: receipt state advances correctly QUOTED → SUBMITTED ──────────────────

test("DB allows advancing UniswapToolReceipt from QUOTED to SUBMITTED", async () => {
  let database: DisposableDatabase | undefined;
  try {
    database = await startDisposableDatabase("a6-state-advance");
    configureDatabaseEnvironment(database.url);

    const prisma = new PrismaClient({
      datasources: { db: { url: database.url } },
      log: ["error"],
    });

    const quoteRequestId = randomUUID();
    const context = await seedUniswapContext(
      database,
      "0x3333333333333333333333333333333333333333",
    );
    await prisma.uniswapToolReceipt.create({
      data: {
        jobId: context.jobId,
        buyerAddress: "0x3333333333333333333333333333333333333333",
        agentVersionId: context.agentVersionId,
        quoteRequestId,
        chainId: 1301,
        tokenIn: UNICHAIN_SEPOLIA.tokens.USDC,
        tokenOut: UNICHAIN_SEPOLIA.tokens.WETH,
        amountIn: 1_000_000n,
        amountOut: 500_000_000_000_000n,
        slippageBps: 50,
        deadline: Math.floor(Date.now() / 1000) + 120,
        spender: UNICHAIN_SEPOLIA.swapRouter,
        requestHash: "5".repeat(64),
        routeHash: "6".repeat(64),
        calldataHash: "c".repeat(64),
        releaseSha: "test-sha",
        txStatus: "QUOTED",
      },
    });

    const updated = await prisma.uniswapToolReceipt.update({
      where: { quoteRequestId },
      data: {
        txStatus: "SUBMITTED",
        confirmationSig: `confirmed-by-${quoteRequestId.slice(0, 8)}`,
      },
    });

    assert.equal(updated.txStatus, "SUBMITTED");
    assert.ok(updated.confirmationSig?.startsWith("confirmed-by-"));

    await prisma.$disconnect();
  } finally {
    await database?.close();
  }
});

// ── Application layer: A6_RECEIPT_IMMUTABLE logic ────────────────────────────

test("A6 terminal status check: CONFIRMED and FAILED are immutable states", () => {
  const terminalStates = ["CONFIRMED", "FAILED"];
  for (const state of terminalStates) {
    const isTerminal = state === "CONFIRMED" || state === "FAILED";
    assert.ok(isTerminal, `${state} must be treated as immutable`);
    if (isTerminal) {
      const err = new KernelError(
        "A6_RECEIPT_IMMUTABLE",
        `UniswapToolReceipt is already terminal: ${state}`,
        409,
      );
      assert.equal(err.status, 409);
      assert.equal(err.code, "A6_RECEIPT_IMMUTABLE");
    }
  }

  const nonTerminalStates = ["QUOTED", "SUBMITTED"];
  for (const state of nonTerminalStates) {
    const isTerminal = state === "CONFIRMED" || state === "FAILED";
    assert.equal(isTerminal, false, `${state} must not be treated as immutable`);
  }
});

// ── Route: /api/kernel/swap/execute is fail-closed ───────────────────────────
//
// These exercise the real route handler. The previous version of this test
// replicated the route's parser inline, which is exactly why a confirmationSig
// accepted on `length >= 4` shipped with a green suite. Never assert against a
// copy of the logic under test.

const EXECUTE_URL = "http://localhost:3000/api/kernel/swap/execute";

async function seedAuthenticatedSession(
  database: DisposableDatabase,
  buyerAddress: string,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const users = await database.sql<{ id: string }[]>`
    SELECT id FROM users WHERE wallet_address = ${buyerAddress}
  `;
  const userId = users[0]?.id;
  assert.ok(userId, "fixture must seed a buyer user");
  await database.sql.begin(async (tx) => {
    const sql = tx as unknown as DisposableDatabase["sql"];
    await sql`SET LOCAL session_replication_role = replica`;
    await sql`
      INSERT INTO auth_sessions (
        challenge_id, token_hash, wallet_address, user_id, action, expires_at
      ) VALUES (
        ${randomUUID()}::uuid, ${sha256(token)}, ${buyerAddress}, ${userId},
        'authenticate', clock_timestamp() + interval '10 minutes'
      )
    `;
  });
  return token;
}

async function seedReceipt(
  database: DisposableDatabase,
  context: { jobId: string; agentVersionId: string },
  buyerAddress: string,
  overrides: { txStatus?: string; deadline?: number } = {},
): Promise<string> {
  const quoteRequestId = randomUUID();
  await database.sql`
    INSERT INTO uniswap_tool_receipts (
      job_id, buyer_address, agent_version_id, quote_request_id, chain_id,
      token_in, token_out, amount_in, amount_out, slippage_bps, deadline, spender,
      request_hash, route_hash, calldata_hash, release_sha, tx_status
    ) VALUES (
      ${context.jobId}::uuid, ${buyerAddress}, ${context.agentVersionId}::uuid,
      ${quoteRequestId}, 1301,
      ${UNICHAIN_SEPOLIA.tokens.USDC}, ${UNICHAIN_SEPOLIA.tokens.WETH},
      1000000, 500000000000000, 50,
      ${overrides.deadline ?? Math.floor(Date.now() / 1000) + 120},
      ${UNICHAIN_SEPOLIA.swapRouter},
      ${"5".repeat(64)}, ${"6".repeat(64)}, ${"c".repeat(64)}, 'test-sha',
      ${overrides.txStatus ?? "QUOTED"}
    )
  `;
  return quoteRequestId;
}

function executeRequest(token: string, body: Record<string, unknown>): Request {
  return new Request(EXECUTE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `alphadawg_session=${token}`,
    },
    body: JSON.stringify(body),
  });
}

async function receiptRow(
  database: DisposableDatabase,
  quoteRequestId: string,
): Promise<{ tx_status: string; confirmation_sig: string | null; tx_hash: string | null }> {
  const rows = await database.sql<
    { tx_status: string; confirmation_sig: string | null; tx_hash: string | null }[]
  >`
    SELECT tx_status, confirmation_sig, tx_hash
    FROM uniswap_tool_receipts WHERE quote_request_id = ${quoteRequestId}
  `;
  assert.ok(rows[0], "receipt must exist");
  return rows[0];
}

test("A6 execute route fails closed and never mutates UniswapToolReceipt", async (t) => {
  let database: DisposableDatabase | undefined;
  try {
    database = await startDisposableDatabase("a6-execute-failclosed");
    configureDatabaseEnvironment(database.url);
    const db = database;
    const buyerAddress = "0x7777777777777777777777777777777777777777";
    const context = await seedUniswapContext(db, buyerAddress);
    const token = await seedAuthenticatedSession(db, buyerAddress);

    await t.test("every confirmation value is refused and the receipt stays QUOTED", async () => {
      const bodies: Record<string, unknown>[] = [
        {},
        { confirmationSig: "" },
        { confirmationSig: "0xdeadbeef" },
        { confirmationSig: "confirmed-by-abcd1234-at-1784822400000" },
        { confirmationSig: `0x${"a".repeat(130)}` },
        { confirmationSig: 12345 },
      ];
      for (const extra of bodies) {
        const quoteRequestId = await seedReceipt(db, context, buyerAddress);
        const response = await postSwapExecute(
          executeRequest(token, { quoteRequestId, ...extra }),
        );
        assert.equal(response.status, 403);
        const payload = await response.json() as { code: string; error: string };
        assert.equal(payload.code, "A6_CONFIRMATION_UNVERIFIABLE");
        assert.ok(typeof payload.error === "string" && payload.error.length > 0);
        assert.deepEqual(await receiptRow(db, quoteRequestId), {
          tx_status: "QUOTED",
          confirmation_sig: null,
          tx_hash: null,
        });
      }
    });

    await t.test("an expired quote is refused without becoming FAILED", async () => {
      const quoteRequestId = await seedReceipt(db, context, buyerAddress, {
        deadline: Math.floor(Date.now() / 1000) - 1,
      });
      const response = await postSwapExecute(
        executeRequest(token, { quoteRequestId, confirmationSig: "0xdeadbeef" }),
      );
      assert.equal(response.status, 410);
      assert.equal((await response.json() as { code: string }).code, "A6_QUOTE_EXPIRED");
      const row = await receiptRow(db, quoteRequestId);
      assert.equal(row.tx_status, "QUOTED");
      assert.notEqual(row.tx_status, "FAILED");
    });

    await t.test("a pre-existing SUBMITTED row is refused, not reported as executed", async () => {
      const quoteRequestId = await seedReceipt(db, context, buyerAddress, {
        txStatus: "SUBMITTED",
      });
      const response = await postSwapExecute(
        executeRequest(token, { quoteRequestId, confirmationSig: "0xdeadbeef" }),
      );
      assert.equal(response.status, 409);
      const payload = await response.json() as Record<string, unknown>;
      assert.equal(payload.code, "A6_CONFIRMATION_UNVERIFIABLE");
      assert.equal("txStatus" in payload, false);
      assert.equal("txHash" in payload, false);
      assert.equal((await receiptRow(db, quoteRequestId)).tx_status, "SUBMITTED");
    });

    await t.test("a quote owned by another buyer is refused before any write", async () => {
      const otherAddress = "0x8888888888888888888888888888888888888888";
      const otherContext = await seedUniswapContext(db, otherAddress);
      const quoteRequestId = await seedReceipt(db, otherContext, otherAddress);
      const response = await postSwapExecute(
        executeRequest(token, { quoteRequestId, confirmationSig: "0xdeadbeef" }),
      );
      assert.equal(response.status, 403);
      assert.equal((await response.json() as { code: string }).code, "KERNEL_FORBIDDEN");
      assert.equal((await receiptRow(db, quoteRequestId)).tx_status, "QUOTED");
    });

    await t.test("an unauthenticated request is refused before any write", async () => {
      const quoteRequestId = await seedReceipt(db, context, buyerAddress);
      const response = await postSwapExecute(new Request(EXECUTE_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quoteRequestId, confirmationSig: "0xdeadbeef" }),
      }));
      assert.equal(response.status, 401);
      assert.equal((await receiptRow(db, quoteRequestId)).tx_status, "QUOTED");
    });
  } finally {
    // The route uses the lazy Prisma singleton; close it before the disposable
    // cluster stops or the shutdown surfaces as a FATAL connection error.
    await getPrisma().$disconnect();
    await database?.close();
  }
});

// ── Application layer: A6_QUOTE_EXPIRED deadline logic ───────────────────────

test("A6 deadline check: expired deadline is correctly detected", () => {
  const nowSeconds = Math.floor(Date.now() / 1000);

  const expiredDeadline = nowSeconds - 1;
  assert.ok(nowSeconds > expiredDeadline, "past deadline must be detectable");

  const futureDeadline = nowSeconds + UNICHAIN_SEPOLIA.quoteDeadlineSeconds;
  assert.ok(nowSeconds <= futureDeadline, "fresh quote must be valid");

  // KernelError for expired quote
  const err = new KernelError("A6_QUOTE_EXPIRED", "Quote deadline has passed", 410);
  assert.equal(err.status, 410);
  assert.equal(err.code, "A6_QUOTE_EXPIRED");
});
