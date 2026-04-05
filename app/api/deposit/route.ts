import { NextRequest, NextResponse } from "next/server";
import { getUserById, updateUser } from "@/src/store/user-store";
import { mintShares, grantKyc, getTokenInfo } from "@/src/hedera/hts";
import { getOperatorId } from "@/src/config/hedera";
import { ensureGatewayPoolFunded } from "@/src/payments/fund-swap";

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

    const updated = await updateUser(userId, {
      fund: {
        depositedUsdc: user.fund.depositedUsdc + amount,
        currentNav: user.fund.currentNav + amount,
        htsShareBalance: user.fund.htsShareBalance + amount,
      },
      agent: { active: true },
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

    // Bootstrap the Circle Gateway pool for this user's x402 signer so the
    // first cycle doesn't pay the deposit round-trip itself. Best-effort:
    // the runCycle() guard will re-attempt if this fails here (e.g. if the
    // deposit amount is smaller than the gateway topup floor). Non-fatal.
    if (amount >= 0.60 && updated.hotWalletIndex != null) {
      try {
        const gwResult = await ensureGatewayPoolFunded(updated, 0.10, 0.50);
        if (!gwResult.skipped) {
          console.log(
            `[deposit] Bootstrapped Gateway pool: +$${gwResult.depositedUsd.toFixed(6)} tx=${gwResult.depositTxHash}`,
          );
        }
      } catch (err) {
        console.warn(
          "[deposit] Gateway pool bootstrap skipped (non-fatal — runCycle will retry):",
          err instanceof Error ? err.message : String(err),
        );
      }
    }

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
