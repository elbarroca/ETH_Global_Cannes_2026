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
    const body = (await request.json()) as {
      userId?: unknown;
      amount?: unknown;
      txHash?: unknown;
    };
    if (body.userId !== undefined && body.userId !== userId) {
      return NextResponse.json({ error: "User claim does not match session", code: "AUTH_FORBIDDEN" }, { status: 403 });
    }
    if (typeof body.amount !== "number" || !Number.isFinite(body.amount) || body.amount <= 0) {
      return NextResponse.json({ error: "amount must be positive", code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (body.txHash !== undefined && (typeof body.txHash !== "string" || body.txHash.length > 128)) {
      return NextResponse.json({ error: "Invalid txHash", code: "INVALID_REQUEST" }, { status: 400 });
    }
    const disabled = legacyRuntimeDisabledResponse();
    if (disabled) return disabled;

    const [userStore, hts, hedera] = await Promise.all([
      import("@/src/store/user-store"),
      import("@/src/hedera/hts"),
      import("@/src/config/hedera"),
    ]);
    const user = await userStore.getUserById(userId);
    if (!user) return NextResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
    try {
      await hts.grantKyc(hedera.getOperatorId().toString());
    } catch (error) {
      const code = error instanceof Error ? error.name : "UNKNOWN";
      console.warn(JSON.stringify({ level: "warn", context: "legacy.deposit.kyc", code }));
    }
    const tokenInfo = await hts.getTokenInfo();
    const shareUnits = Math.round(body.amount * Math.pow(10, tokenInfo.decimals));
    const { newTotalSupply } = await hts.mintShares(shareUnits);
    const updated = await userStore.updateUser(userId, {
      fund: {
        depositedUsdc: user.fund.depositedUsdc + body.amount,
        currentNav: user.fund.currentNav + body.amount,
        htsShareBalance: user.fund.htsShareBalance + body.amount,
      },
    });
    if (process.env.NARYO_AUDIT_CONTRACT_ADDRESS) {
      try {
        const { emitDepositEvent } = await import("@/src/naryo/emit-event");
        await emitDepositEvent(user.walletAddress, body.amount, updated.fund.currentNav);
      } catch (error) {
        const code = error instanceof Error ? error.name : "UNKNOWN";
        console.warn(JSON.stringify({ level: "warn", context: "legacy.deposit.naryo", code }));
      }
    }
    return NextResponse.json({
      success: true,
      depositedUsdc: updated.fund.depositedUsdc,
      htsShareBalance: updated.fund.htsShareBalance,
      currentNav: updated.fund.currentNav,
      agentActive: updated.agent.active,
      htsTotalSupply: newTotalSupply,
      legacy: true,
    });
  } catch (error) {
    return authErrorResponse(error, "legacy.deposit");
  }
}
