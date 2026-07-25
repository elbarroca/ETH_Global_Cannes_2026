import { NextResponse } from "next/server";
import { randomUUID, createHash } from "node:crypto";
import { authenticateRequest } from "@/src/auth/http";
import { kernelErrorResponse, readBoundedKernelJson } from "@/src/kernel/http";
import { KernelError } from "@/src/kernel/errors";
import { getPrisma } from "@/src/config/prisma";
import {
  UNICHAIN_SEPOLIA,
  isAllowlistedToken,
  isUnichainSepolia,
} from "@/src/config/unichain-sepolia";

export const runtime = "nodejs";

// Server-proxied Uniswap V3 quote. The browser receives only the quote result —
// no RPC URL, API key, or private key ever leaves the server.
// A6 BLOCKED_LIVE: live Unichain Sepolia transactions require separate
// authorization in EXTERNAL-EFFECTS.md. This route implements the local floor.
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await readBoundedKernelJson(request);
    const result = await authenticateRequest(request, { requireUser: true });
    if (!result.ok) return result.response;
    const principal = result.auth.principal;
    if (!principal.userId || !principal.walletAddress) {
      return NextResponse.json(
        { error: "Onboarding required", code: "AUTH_USER_REQUIRED" },
        { status: 403 },
      );
    }

    const { jobId, tokenIn, tokenOut, amountIn, slippageBps } = parseQuoteBody(body);

    if (!isUnichainSepolia(UNICHAIN_SEPOLIA.chainId)) {
      throw new KernelError("A6_CHAIN_NOT_AUTHORIZED", "Only Unichain Sepolia (1301) is authorized", 403);
    }

    const prisma = getPrisma();
    const deadline = Math.floor(Date.now() / 1000) + UNICHAIN_SEPOLIA.quoteDeadlineSeconds;
    const quoteRequestId = randomUUID();
    const requestHash = createHash("sha256")
      .update(JSON.stringify({
        jobId,
        buyerAddress: principal.walletAddress.toLowerCase(),
        chainId: UNICHAIN_SEPOLIA.chainId,
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        slippageBps,
        deadline,
      }))
      .digest("hex");
    const routeHash = createHash("sha256")
      .update(JSON.stringify({
        chainId: UNICHAIN_SEPOLIA.chainId,
        tokenIn,
        tokenOut,
        feeTier: UNICHAIN_SEPOLIA.defaultFeeTier,
        spender: UNICHAIN_SEPOLIA.swapRouter,
      }))
      .digest("hex");

    // Compute a deterministic calldata hash from quote parameters.
    // Live calldata is derived from the Uniswap SwapRouter ABI on-chain;
    // this hash binds the buyer's confirmation to an exact parameter set.
    const calldataHash = createHash("sha256")
      .update(JSON.stringify({
        chainId: UNICHAIN_SEPOLIA.chainId,
        tokenIn,
        tokenOut,
        amountIn: amountIn.toString(),
        slippageBps,
        deadline,
        spender: UNICHAIN_SEPOLIA.swapRouter,
        feeTier: UNICHAIN_SEPOLIA.defaultFeeTier,
      }))
      .digest("hex");

    // Simulate quoted output amount (1:1 ratio for local floor — live Quoter
    // contract on Unichain Sepolia returns the real amount).
    // A6_BLOCKED_LIVE: live quote requires UNICHAIN_SEPOLIA_RPC_URL authorized
    // in EXTERNAL-EFFECTS.md.
    const quotedAmountOut = amountIn;

    await prisma.uniswapToolReceipt.create({
      data: {
        jobId,
        buyerAddress: principal.walletAddress,
        agentVersionId: await resolveAgentVersionIdForJob(jobId, principal.userId),
        quoteRequestId,
        chainId: UNICHAIN_SEPOLIA.chainId,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut: quotedAmountOut,
        slippageBps,
        deadline,
        spender: UNICHAIN_SEPOLIA.swapRouter,
        requestHash,
        routeHash,
        calldataHash,
        txStatus: "QUOTED",
        releaseSha: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      },
    });

    return NextResponse.json({
      quoteRequestId,
      chainId: UNICHAIN_SEPOLIA.chainId,
      chainName: UNICHAIN_SEPOLIA.name,
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      amountOut: quotedAmountOut.toString(),
      slippageBps,
      deadline,
      spender: UNICHAIN_SEPOLIA.swapRouter,
      calldataHash,
      liveBlocked: !process.env.UNICHAIN_SEPOLIA_RPC_URL,
    });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.swap.quote");
  }
}

function parseQuoteBody(body: unknown): {
  jobId: string;
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: bigint;
  slippageBps: number;
} {
  if (typeof body !== "object" || body === null) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Request body must be an object", 400);
  }
  const b = body as Record<string, unknown>;

  if (typeof b.jobId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(b.jobId)) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "jobId must be a UUID", 400);
  }
  if (typeof b.tokenIn !== "string" || !isAllowlistedToken(b.tokenIn)) {
    throw new KernelError("A6_TOKEN_NOT_ALLOWLISTED", "tokenIn must be an allowlisted Unichain Sepolia token", 403);
  }
  if (typeof b.tokenOut !== "string" || !isAllowlistedToken(b.tokenOut)) {
    throw new KernelError("A6_TOKEN_NOT_ALLOWLISTED", "tokenOut must be an allowlisted Unichain Sepolia token", 403);
  }
  if (b.tokenIn === b.tokenOut) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "tokenIn and tokenOut must differ", 400);
  }

  let amountIn: bigint;
  try {
    amountIn = BigInt(String(b.amountIn));
    if (amountIn <= 0n) throw new Error();
  } catch {
    throw new KernelError("KERNEL_INVALID_REQUEST", "amountIn must be a positive integer (atomic units)", 400);
  }

  const slippageBps = b.slippageBps !== undefined
    ? Number(b.slippageBps)
    : UNICHAIN_SEPOLIA.defaultSlippageBps;
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 1000) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "slippageBps must be 0-1000", 400);
  }

  return {
    jobId: b.jobId,
    tokenIn: b.tokenIn as `0x${string}`,
    tokenOut: b.tokenOut as `0x${string}`,
    amountIn,
    slippageBps,
  };
}

async function resolveAgentVersionIdForJob(jobId: string, buyerUserId: string): Promise<string> {
  const prisma = getPrisma();
  const job = await prisma.job.findFirst({
    where: { id: jobId, buyerUserId },
    select: { agentVersionId: true },
  });
  if (!job) {
    throw new KernelError("KERNEL_NOT_FOUND", "Job not found or not owned by this buyer", 404);
  }
  return job.agentVersionId;
}
