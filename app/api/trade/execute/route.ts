import { NextResponse } from "next/server";
import {
  authenticateRequest,
  authErrorResponse,
  legacyRuntimeDisabledResponse,
} from "@/src/auth/http";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await authenticateRequest(request, { requireUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.auth.principal.userId;
    if (!userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const body = (await request.json()) as {
      userId?: unknown;
      action?: unknown;
      asset?: unknown;
      percentage?: unknown;
    };
    if (body.userId !== undefined && body.userId !== userId) {
      return NextResponse.json({ error: "User claim does not match session", code: "AUTH_FORBIDDEN" }, { status: 403 });
    }
    if (body.action !== "BUY" && body.action !== "SELL") {
      return NextResponse.json({ error: "action must be BUY or SELL", code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (typeof body.asset !== "string" || !/^[A-Z0-9]{2,12}$/.test(body.asset)) {
      return NextResponse.json({ error: "Invalid asset", code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (typeof body.percentage !== "number" || !Number.isFinite(body.percentage) || body.percentage <= 0 || body.percentage > 100) {
      return NextResponse.json({ error: "percentage must be between 1 and 100", code: "INVALID_REQUEST" }, { status: 400 });
    }
    const disabled = legacyRuntimeDisabledResponse();
    if (disabled) return disabled;

    const [userStore, circle, actionLogger] = await Promise.all([
      import("@/src/store/user-store"),
      import("@/src/payments/circle-wallet"),
      import("@/src/store/action-logger"),
    ]);
    const user = await userStore.getUserById(userId);
    if (!user) return NextResponse.json({ error: "User not found", code: "NOT_FOUND" }, { status: 404 });
    if (!user.proxyWallet?.walletId || !user.proxyWallet?.address) {
      return NextResponse.json({ error: "No proxy wallet configured", code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (body.percentage > user.agent.maxTradePercent) {
      return NextResponse.json({ error: "percentage exceeds account policy", code: "AUTH_FORBIDDEN" }, { status: 403 });
    }
    if (body.action === "SELL") {
      return NextResponse.json({ error: "SELL execution not implemented", code: "NOT_IMPLEMENTED" }, { status: 501 });
    }
    const usdcAmount = ((body.percentage / 100) * user.fund.currentNav).toFixed(2);
    const result = await circle.executeSwap(
      user.proxyWallet.walletId,
      user.proxyWallet.address,
      body.asset,
      usdcAmount,
    );
    try {
      await actionLogger.logAction({
        userId,
        actionType: "TRADE_EXECUTED",
        agentName: "executor",
        status: result.success ? "success" : "failed",
        payload: {
          action: body.action,
          asset: body.asset,
          percentage: body.percentage,
          usdcAmount,
          result,
        },
      });
    } catch (error) {
      const code = error instanceof Error ? error.name : "UNKNOWN";
      console.warn(JSON.stringify({ level: "warn", context: "legacy.trade.audit", code }));
    }
    if (!result.success) {
      return NextResponse.json({ error: "Swap failed", code: "LEGACY_SWAP_FAILED" }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      action: body.action,
      asset: body.asset,
      usdcAmount,
      txId: result.swapTxId,
      result,
      legacy: true,
    });
  } catch (error) {
    return authErrorResponse(error, "legacy.trade.execute");
  }
}
