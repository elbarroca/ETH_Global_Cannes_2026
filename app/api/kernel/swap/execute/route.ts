import { NextResponse } from "next/server";
import { authenticateRequest } from "@/src/auth/http";
import { kernelErrorResponse, readBoundedKernelJson } from "@/src/kernel/http";
import { KernelError } from "@/src/kernel/errors";
import { getPrisma } from "@/src/config/prisma";
import { isUnichainSepolia } from "@/src/config/unichain-sepolia";

export const runtime = "nodejs";

// Execute is FAIL-CLOSED. Wallet-signed transaction-hash verification does not
// exist, so no buyer confirmation value can be verified and none is accepted.
// This route performs ZERO UniswapToolReceipt writes on every path: it reads the
// receipt only to apply buyer, terminal-state and chain refusals, then refuses.
// A receipt therefore never leaves QUOTED through this route, an expired quote is
// never marked FAILED here, and a pre-existing SUBMITTED row — recorded before
// this gate under the removed unverifiable-confirmation scheme — is refused
// rather than reported as executed on-chain state.
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

    const { quoteRequestId } = parseExecuteBody(body);

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
      throw new KernelError(
        "A6_CONFIRMATION_UNVERIFIABLE",
        "UniswapToolReceipt is SUBMITTED from an unverifiable confirmation and is not evidence of an executed transaction",
        409,
      );
    }
    if (!isUnichainSepolia(receipt.chainId)) {
      throw new KernelError("A6_CHAIN_NOT_AUTHORIZED", "Receipt chain is not Unichain Sepolia", 403);
    }

    // Deadline check — refusal only. Marking the receipt FAILED here would be a
    // write, and this route never mutates UniswapToolReceipt.
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (nowSeconds > receipt.deadline) {
      throw new KernelError("A6_QUOTE_EXPIRED", "Quote deadline has passed", 410);
    }

    throw new KernelError(
      "A6_CONFIRMATION_UNVERIFIABLE",
      "Swap execution is unavailable: wallet-signed transaction-hash verification is not implemented",
      403,
    );
  } catch (error) {
    return kernelErrorResponse(error, "kernel.swap.execute");
  }
}

// The request body carries no confirmation value. There is no signature string,
// pattern or placeholder that this route will accept, so none is parsed.
function parseExecuteBody(body: unknown): { quoteRequestId: string } {
  if (typeof body !== "object" || body === null) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "Request body must be an object", 400);
  }
  const b = body as Record<string, unknown>;
  if (typeof b.quoteRequestId !== "string" || b.quoteRequestId.length < 8) {
    throw new KernelError("KERNEL_INVALID_REQUEST", "quoteRequestId is required", 400);
  }
  return { quoteRequestId: b.quoteRequestId };
}
