import { NextResponse } from "next/server";
import { getUserById } from "@/src/store/user-store";
import { executeSwap } from "@/src/payments/circle-wallet";
import { logAction } from "@/src/store/action-logger";

export async function POST(request: Request) {
  try {
    const { userId, action, asset, percentage } = (await request.json()) as {
      userId: string;
      action: string;
      asset: string;
      percentage: number;
    };

    if (!userId || !action || !asset) {
      return NextResponse.json(
        { error: "userId, action, and asset are required" },
        { status: 400 },
      );
    }

    if (typeof percentage !== "number" || percentage <= 0 || percentage > 100) {
      return NextResponse.json(
        { error: "percentage must be a number between 1 and 100" },
        { status: 400 },
      );
    }

    if (action !== "BUY" && action !== "SELL") {
      return NextResponse.json(
        { error: "action must be BUY or SELL" },
        { status: 400 },
      );
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.proxyWallet?.walletId || !user.proxyWallet?.address) {
      return NextResponse.json(
        { error: "No proxy wallet configured" },
        { status: 400 },
      );
    }

    if (percentage > user.agent.maxTradePercent) {
      return NextResponse.json(
        { error: `percentage exceeds max allowed (${user.agent.maxTradePercent}%)` },
        { status: 400 },
      );
    }

    const usdcAmount = ((percentage / 100) * user.fund.currentNav).toFixed(2);

    if (action === "BUY") {
      const result = await executeSwap(
        user.proxyWallet.walletId,
        user.proxyWallet.address,
        asset,
        usdcAmount,
      );

      await logAction({
        userId,
        actionType: "TRADE_EXECUTED",
        agentName: "executor",
        status: result.success ? "success" : "failed",
        payload: { action, asset, percentage, usdcAmount, result },
      }).catch(() => {});

      if (!result.success) {
        return NextResponse.json(
          { error: result.reason ?? "Swap failed", details: result },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        action,
        asset,
        usdcAmount,
        txId: result.swapTxId,
        result,
      });
    }

    // SELL: would need a reverse swap (token → USDC), simplified for hackathon
    return NextResponse.json(
      { error: "SELL execution not yet implemented" },
      { status: 501 },
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
