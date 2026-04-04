import { NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/src/store/user-store";
import { getProxyBalance } from "@/src/payments/circle-wallet";
import { getHotWalletUsdBalance } from "@/src/payments/fund-swap";

// Live on-chain wallet balances for a user's Circle MPC proxy wallet and
// BIP-44 hot wallet. The hero/nasdaq header polls this so the "DEPOSITED"
// readout reflects the true custody balance, not the DB accounting number
// that only moves on deposit/withdraw/swap events.
//
// Response shape is intentionally tolerant of partial failures — if Circle
// or Arc RPC is unreachable we still return the DB accounting number so the
// UI never shows `$—` when a user just wants a quick sanity check.

export const dynamic = "force-dynamic";

interface BalanceResponse {
  userId: string;
  /** Live USDC balance of the Circle MPC proxy wallet (Arc Testnet, native). */
  proxyUsdc: number | null;
  /** Live USDC balance of the BIP-44 hot wallet that signs Arc swap txs. */
  hotWalletUsdc: number | null;
  /** Sum of proxy + hot wallet when both reads succeeded, else null. */
  totalUsdc: number | null;
  /** DB accounting balance — what the backend thinks the user has deposited. */
  depositedUsdcDb: number;
  proxyAddress: string | null;
  hotWalletAddress: string | null;
  /** Unix ms — tells the client how fresh this snapshot is. */
  fetchedAt: number;
  /** Per-source error detail so the UI can show a degraded indicator. */
  errors: { proxy: string | null; hotWallet: string | null };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const errors: BalanceResponse["errors"] = { proxy: null, hotWallet: null };

  // Circle proxy wallet — real MPC custody balance via Circle SDK.
  let proxyUsdc: number | null = null;
  if (user.proxyWallet?.walletId) {
    try {
      const balances = await getProxyBalance(user.proxyWallet.walletId);
      // Arc USDC is the chain's NATIVE currency — Circle surfaces it as "USDC"
      // (and historically "USD" in some SDK versions). Sum any matching rows
      // to tolerate both shapes.
      const usdcRows = balances.filter(
        (b) => b.symbol === "USDC" || b.symbol === "USD",
      );
      proxyUsdc = usdcRows.reduce(
        (sum, b) => sum + (Number.parseFloat(b.amount) || 0),
        0,
      );
    } catch (err) {
      errors.proxy = err instanceof Error ? err.message : String(err);
    }
  }

  // Hot wallet — viem read against the Arc testnet RPC.
  let hotWalletUsdc: number | null = null;
  if (user.hotWalletAddress) {
    try {
      hotWalletUsdc = await getHotWalletUsdBalance(
        user.hotWalletAddress as `0x${string}`,
      );
    } catch (err) {
      errors.hotWallet = err instanceof Error ? err.message : String(err);
    }
  }

  const totalUsdc =
    proxyUsdc != null && hotWalletUsdc != null
      ? proxyUsdc + hotWalletUsdc
      : proxyUsdc ?? hotWalletUsdc;

  const body: BalanceResponse = {
    userId,
    proxyUsdc,
    hotWalletUsdc,
    totalUsdc,
    depositedUsdcDb: user.fund.depositedUsdc,
    proxyAddress: user.proxyWallet?.address ?? null,
    hotWalletAddress: user.hotWalletAddress,
    fetchedAt: Date.now(),
    errors,
  };

  return NextResponse.json(body, {
    // No HTTP cache — this endpoint is meant to be polled aggressively.
    headers: { "Cache-Control": "no-store" },
  });
}
