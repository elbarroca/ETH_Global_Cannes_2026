import { type NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  authErrorResponse,
  legacyRuntimeDisabledResponse,
} from "@/src/auth/http";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await authenticateRequest(request, { requireUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.auth.principal.userId;
    if (!userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const body = (await request.json()) as { userId?: unknown; amount?: unknown };
    if (body.userId !== undefined && body.userId !== userId) {
      return NextResponse.json({ error: "User claim does not match session", code: "AUTH_FORBIDDEN" }, { status: 403 });
    }
    if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json({ error: "amount must be positive", code: "INVALID_REQUEST" }, { status: 400 });
    }
    const disabled = legacyRuntimeDisabledResponse();
    if (disabled) return disabled;

    const [userStore, hts, circle] = await Promise.all([
      import("@/src/store/user-store"),
      import("@/src/hedera/hts"),
      import("@/src/payments/circle-wallet"),
    ]);
    const user = await userStore.getUserById(userId);
    if (!user) return NextResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
    if (body.amount > user.fund.depositedUsdc) {
      return NextResponse.json({ error: "Insufficient balance", code: "INVALID_REQUEST" }, { status: 400 });
    }
    const tokenInfo = await hts.getTokenInfo();
    const shareUnits = Math.round(body.amount * Math.pow(10, tokenInfo.decimals));
    const { newTotalSupply } = await hts.burnShares(shareUnits);
    const fee = body.amount * 0.01;
    const netWithdraw = body.amount - fee;
    const transfer = await circle.agentTransfer(
      user.proxyWallet.walletId,
      user.walletAddress,
      netWithdraw.toString(),
    );
    const newDeposit = user.fund.depositedUsdc - body.amount;
    const updated = await userStore.updateUser(userId, {
      fund: {
        depositedUsdc: newDeposit,
        currentNav: Math.max(0, user.fund.currentNav - body.amount),
        htsShareBalance: Math.max(0, user.fund.htsShareBalance - body.amount),
      },
      agent: newDeposit <= 0 ? { active: false } : {},
    });
    return NextResponse.json({
      success: true,
      withdrawn: netWithdraw,
      fee,
      remainingUsdc: updated.fund.depositedUsdc,
      agentActive: updated.agent.active,
      htsTotalSupply: newTotalSupply,
      txStatus: "transferred",
      circleTxId: transfer.txId,
      legacy: true,
    });
  } catch (error) {
    return authErrorResponse(error, "legacy.withdraw");
  }
}
