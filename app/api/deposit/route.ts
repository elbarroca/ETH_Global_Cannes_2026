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
    const { userId, amount, txHash } = (await req.json()) as { userId?: string; amount?: number; txHash?: string };

    if (!userId || amount == null) {
      return NextResponse.json({ error: "userId and amount are required" }, { status: 400 });
    }
    if (amount <= 0) {
      return NextResponse.json({ error: "amount must be positive" }, { status: 400 });
    }

    // Log the on-chain tx hash for audit trail
    if (txHash) {
      console.log(`[deposit] User ${userId} deposited $${amount} USDC, txHash: ${txHash}`);
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

    // NOTE: Deposit does NOT flip `agent.active = true`. Depositing USDC is
    // NOT consent to hunt. The dashboard's "AUTO-HUNT N cycles" card is the
    // ONLY surface that enrolls a user in the heartbeat loop (via
    // /api/configure → cycleCount > 0 → active = true). Manual hunts from the
    // dashboard Hunt button or Telegram /run still work regardless of
    // `active`, because they hit /api/cycle/stream or runCycle() directly.
    const updated = await updateUser(userId, {
      fund: {
        depositedUsdc: user.fund.depositedUsdc + amount,
        currentNav: user.fund.currentNav + amount,
        htsShareBalance: user.fund.htsShareBalance + amount,
      },
    });

    // Emit DepositRecorded event on Hedera EVM for Naryo (non-fatal)
    if (process.env.NARYO_AUDIT_CONTRACT_ADDRESS) {
      try {
        const { emitDepositEvent } = await import("@/src/naryo/emit-event");
        await emitDepositEvent(user.walletAddress, amount, updated.fund.currentNav);
      } catch (err) {
        console.warn("[deposit] Naryo event emit failed (non-fatal):", err instanceof Error ? err.message : String(err));
      }
    }

    // NOTE: Circle Gateway pool bootstrap removed from the deposit path.
    // Previously, depositing ≥ $0.60 would immediately bridge $0.50 out of
    // the user's Circle proxy wallet to their BIP-44 hot wallet → Gateway
    // pool contract, which looked to users like unexplained transfers to a
    // "random wallet". The bootstrap is still handled lazily at the start
    // of the first real cycle via `ensureGatewayPoolFunded()` in
    // src/agents/main-agent.ts:~675 → so deposit is now a pure deposit with
    // no side effects on the proxy wallet balance.

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
