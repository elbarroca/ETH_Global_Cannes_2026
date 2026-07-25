import { NextResponse } from "next/server";
import { authenticateRequest } from "@/src/auth/http";
import { kernelErrorResponse, readBoundedKernelJson } from "@/src/kernel/http";
import { KernelError } from "@/src/kernel/errors";
import { getPrisma } from "@/src/config/prisma";
import { isUnichainSepolia } from "@/src/config/unichain-sepolia";

export const runtime = "nodejs";

// Execute a previously quoted Uniswap swap after explicit buyer confirmation.
// Advances UniswapToolReceipt: QUOTED → SUBMITTED (→ CONFIRMED | FAILED async).
// A6_BLOCKED_LIVE: live transaction submission requires UNICHAIN_SEPOLIA_RPC_URL
// authorized in EXTERNAL-EFFECTS.md. This route records buyer confirmation and
// advances local state only.
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

    const { quoteRequestId, confirmationSig } = parseExecuteBody(body);

    const prisma = getPrisma();
    const receipt = await prisma.uniswapToolReceipt.findUnique({
      where: { quoteRequestId },
    });

    if (!receipt) {
      throw new KernelError("KERNEL_NOT_FOUND", "Quote not found", 404);
    }
    if (receipt.buyerAddress.toLowerCase() !== principal.walletAddress.toLowerCase()) {
      throw new KernelError("KERNEL_FORBIDDEN", "Quote belongs to a different buyer", 403);
    }
    if (receipt.txStatus === "CONFIRMED" || receipt.txStatus === "FAILED") {
      throw new KernelError(
        "A6_RECEIPT_IMMUTABLE",
        `UniswapToolReceipt is already terminal: ${receipt.txStatus}`,
        409,
      );
    }
    if (receipt.txStatus === "SUBMITTED") {
      // Idempotent — return current state
      return NextResponse.json({ quoteRequestId, txStatus: receipt.txStatus, txHash: receipt.txHash });
    }
    if (!isUnichainSepolia(receipt.chainId)) {
      throw new KernelError("A6_CHAIN_NOT_AUTHORIZED", "Receipt chain is not Unichain Sepolia", 403);
    }

    // Deadline check
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds > receipt.deadline) {
      await prisma.uniswapToolReceipt.update({
        where: { quoteRequestId },
        data: { txStatus: "FAILED", failureReason: "QUOTE_EXPIRED" },
      });
      throw new KernelError("A6_QUOTE_EXPIRED", "Quote deadline has passed", 410);
    }

    // Record buyer confirmation and advance to SUBMITTED.
    // A6_BLOCKED_LIVE: actual on-chain submission requires authorized
    // UNICHAIN_SEPOLIA_RPC_URL + funded wallet. Local floor records intent only.
    const updated = await prisma.uniswapToolReceipt.update({
      where: { quoteRequestId },
      data: {
        confirmationSig,
        txStatus: "SUBMITTED",
        updatedAt: new Date(),
      },
    });

    const liveBlocked = !process.env.UNICHAIN_SEPOLIA_RPC_URL;

    return NextResponse.json({
      quoteRequestId,
      txStatus: updated.txStatus,
      txHash: updated.txHash,
      liveBlocked,
      message: liveBlocked
        ? "Buyer confirmation recorded. Live transaction submission requires A6_BLOCKED_LIVE authorization in EXTERNAL-EFFECTS.md."
        : "Submitted. Awaiting finality confirmation.",
    });
  } catch (error) {
    return kernelErrorResponse(error, "kernel.swap.execute");
  }
}

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
