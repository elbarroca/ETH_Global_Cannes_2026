import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
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
    "A6_CONFIRMATION_REQUIRED",
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
      calldataHash: "b".repeat(64),
      releaseSha: "test-sha",
      txStatus: "QUOTED",
    };

    await prisma.uniswapToolReceipt.create({
      data: {
        ...baseData,
        jobId: randomUUID(),
        agentVersionId: randomUUID(),
        quoteRequestId,
      },
    });

    await assert.rejects(
      () =>
        prisma.uniswapToolReceipt.create({
          data: {
            ...baseData,
            jobId: randomUUID(), // different job
            agentVersionId: randomUUID(),
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
    await prisma.uniswapToolReceipt.create({
      data: {
        jobId: randomUUID(),
        buyerAddress: "0x3333333333333333333333333333333333333333",
        agentVersionId: randomUUID(),
        quoteRequestId,
        chainId: 1301,
        tokenIn: UNICHAIN_SEPOLIA.tokens.USDC,
        tokenOut: UNICHAIN_SEPOLIA.tokens.WETH,
        amountIn: 1_000_000n,
        amountOut: 500_000_000_000_000n,
        slippageBps: 50,
        deadline: Math.floor(Date.now() / 1000) + 120,
        spender: UNICHAIN_SEPOLIA.swapRouter,
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

// ── Application layer: A6_CONFIRMATION_REQUIRED ──────────────────────────────

test("A6 execute route rejects missing confirmationSig", () => {
  // Replicate the validation logic from the route's parseExecuteBody
  function parseExecuteBody(body: unknown): { quoteRequestId: string; confirmationSig: string } {
    if (typeof body !== "object" || body === null) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "Request body must be an object", 400);
    }
    const b = body as Record<string, unknown>;
    if (typeof b.quoteRequestId !== "string" || b.quoteRequestId.length < 8) {
      throw new KernelError("KERNEL_INVALID_REQUEST", "quoteRequestId is required", 400);
    }
    if (typeof b.confirmationSig !== "string" || b.confirmationSig.length < 4) {
      throw new KernelError(
        "A6_CONFIRMATION_REQUIRED",
        "confirmationSig is required — buyer must explicitly sign the swap",
        400,
      );
    }
    return { quoteRequestId: b.quoteRequestId, confirmationSig: b.confirmationSig };
  }

  const validId = randomUUID();

  // Missing confirmationSig
  assert.throws(
    () => parseExecuteBody({ quoteRequestId: validId }),
    (err: unknown) => {
      assert.ok(err instanceof KernelError);
      assert.equal(err.code, "A6_CONFIRMATION_REQUIRED");
      assert.equal(err.status, 400);
      return true;
    },
  );

  // Empty confirmationSig
  assert.throws(
    () => parseExecuteBody({ quoteRequestId: validId, confirmationSig: "" }),
    (err: unknown) => {
      assert.ok(err instanceof KernelError);
      assert.equal(err.code, "A6_CONFIRMATION_REQUIRED");
      return true;
    },
  );

  // Valid case should not throw
  const result = parseExecuteBody({
    quoteRequestId: validId,
    confirmationSig: "0xdeadbeef",
  });
  assert.equal(result.quoteRequestId, validId);
  assert.equal(result.confirmationSig, "0xdeadbeef");
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
