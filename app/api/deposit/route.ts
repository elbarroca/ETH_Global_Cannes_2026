import { NextRequest, NextResponse } from "next/server";
import { getUserById, updateUser } from "@/src/store/user-store";
import { mintShares, grantKyc, getTokenInfo } from "@/src/hedera/hts";
import { getOperatorId } from "@/src/config/hedera";

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

    try {
      await grantKyc(getOperatorId().toString());
    } catch (kycErr) {
      console.warn("[deposit] KYC grant failed:", kycErr instanceof Error ? kycErr.message : String(kycErr));
    }

    const decimals = await getDecimals();
    const shareUnits = Math.round(amount * Math.pow(10, decimals));
    const { newTotalSupply } = await mintShares(shareUnits);

    const updated = await updateUser(userId, {
      fund: {
        depositedUsdc: user.fund.depositedUsdc + amount,
        currentNav: user.fund.currentNav + amount,
        htsShareBalance: user.fund.htsShareBalance + amount,
      },
      agent: { active: true },
    });

    return NextResponse.json({
      success: true,
      depositedUsdc: updated.fund.depositedUsdc,
      htsShareBalance: updated.fund.htsShareBalance,
      currentNav: updated.fund.currentNav,
      agentActive: updated.agent.active,
      htsTotalSupply: newTotalSupply,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
