import { NextRequest, NextResponse } from "next/server";
import { getUserById, updateUser } from "@/src/store/user-store";
import { burnShares, getTokenInfo } from "@/src/hedera/hts";
import { agentTransfer } from "@/src/payments/circle-wallet";

let cachedDecimals: number | null = null;
async function getDecimals(): Promise<number> {
  if (cachedDecimals === null) {
    const info = await getTokenInfo();
    cachedDecimals = info.decimals;
  }
  return cachedDecimals;
}

export async function POST(req: NextRequest) {
  try {
    const { userId, amount } = (await req.json()) as { userId?: string; amount?: number };

    if (!userId || amount == null) {
      return NextResponse.json({ error: "userId and amount are required" }, { status: 400 });
    }
    if (amount <= 0) {
      return NextResponse.json({ error: "amount must be positive" }, { status: 400 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (amount > user.fund.depositedUsdc) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    const decimals = await getDecimals();
    const shareUnits = Math.round(amount * Math.pow(10, decimals));
    const { newTotalSupply } = await burnShares(shareUnits);

    const fee = amount * 0.01;
    const netWithdraw = amount - fee;
    const newDeposit = user.fund.depositedUsdc - amount;

    let txResult: { txId: string; state: string } | null = null;
    try {
      txResult = await agentTransfer(user.proxyWallet.walletId, user.walletAddress, netWithdraw.toString());
    } catch (err) {
      console.warn("[withdraw] Circle transfer failed (non-fatal):", err instanceof Error ? err.message : String(err));
    }

    const updated = await updateUser(userId, {
      fund: {
        depositedUsdc: newDeposit,
        currentNav: Math.max(0, user.fund.currentNav - amount),
        htsShareBalance: Math.max(0, user.fund.htsShareBalance - amount),
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
      txStatus: txResult ? "transferred" : "burned_only",
      circleTxId: txResult?.txId ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
