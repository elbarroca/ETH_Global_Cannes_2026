// Shared helper: fetch the user's real-time USDC liquidity at cycle start and
// inject it into every specialist's data snapshot + debate context.
//
// Before this existed, specialists and the alpha/risk/executor debate emitted
// percentages (e.g. "BUY 10% ETH") with zero awareness of how much USDC the
// user actually had in their Circle proxy wallet. The swap-sizing math used
// `user.fund.depositedUsdc` — the stale Prisma DB value — not the real
// on-chain balance. When the DB drifted from reality, specialists recommended
// allocations against a non-existent budget.
//
// `fetchCycleLiquidity` is called ONCE at cycle start, before any specialist
// or debate agent runs. The returned snapshot is:
//   · included in every specialist data payload via `injectLiquidityInto`,
//   · passed through `DebateCallContext` to alpha/risk/executor on Fly,
//   · rendered as a line in `buildSpecialistContext` so debate agents see
//     the honest budget alongside the confluence table,
//   · persisted in `RichCycleRecord.cycleLiquidity` and `CycleNarrative` so
//     the dashboard can show "allocating $0.045 USDC of $0.45 available".

import { getProxyBalance } from "../../payments/circle-wallet";
import { getHotWalletUsdBalance } from "../../payments/fund-swap";
import type { UserRecord, CycleLiquidity } from "../../types/index";

/**
 * Fetch a real-time liquidity snapshot for the given user. Non-fatal — if
 * either balance call fails, returns zeros for that leg and logs a warning.
 * `availableUsd` is always `min(proxyUsd, depositedUsd)` so decisions never
 * exceed the DB accounting value either (no phantom budget from hot-wallet
 * residue or external top-ups).
 */
export async function fetchCycleLiquidity(user: UserRecord): Promise<CycleLiquidity> {
  const depositedUsd = user.fund?.depositedUsdc ?? 0;

  let proxyUsd = 0;
  try {
    const balances = await getProxyBalance(user.proxyWallet.walletId);
    const usdc = balances.find((b) => b.symbol === "USDC" || b.symbol === "USD");
    proxyUsd = usdc ? parseFloat(usdc.amount) : 0;
  } catch (err) {
    console.warn(
      `[liquidity] proxy balance fetch failed for ${user.id}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let hotUsd = 0;
  if (user.hotWalletAddress) {
    try {
      hotUsd = await getHotWalletUsdBalance(user.hotWalletAddress as `0x${string}`);
    } catch (err) {
      console.warn(
        `[liquidity] hot wallet balance fetch failed for ${user.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const availableUsd = Math.max(0, Math.min(proxyUsd, depositedUsd));

  return {
    proxyUsd: round4(proxyUsd),
    hotUsd: round4(hotUsd),
    availableUsd: round4(availableUsd),
    depositedUsd: round4(depositedUsd),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Attach a CycleLiquidity snapshot to a specialist's data-fetcher result.
 * Writes two keys so the 7B model sees both a structured object and a
 * pre-formatted tight string (7B models malform easily on large JSON).
 */
export function injectLiquidityInto(
  results: Record<string, unknown>,
  liquidity: CycleLiquidity,
): void {
  results.liquidity = liquidity;
  results.liquidity_table = formatLiquidityTable(liquidity);
}

/**
 * Pre-format the liquidity snapshot as a compact string for 7B prompts.
 * Includes a "your % → USD" lookup so the model doesn't have to do arithmetic
 * when recommending allocations.
 */
export function formatLiquidityTable(liquidity: CycleLiquidity): string {
  const avail = liquidity.availableUsd;
  const usd = (pct: number) => `$${((avail * pct) / 100).toFixed(4)}`;
  const lines = [
    `  AVAILABLE LIQUIDITY: $${avail.toFixed(4)} USDC (proxy wallet, real-time)`,
    `  proxy: $${liquidity.proxyUsd.toFixed(4)} | hot: $${liquidity.hotUsd.toFixed(4)} | deposited (DB): $${liquidity.depositedUsd.toFixed(4)}`,
    `  allocation lookup: 1% = ${usd(1)} | 3% = ${usd(3)} | 5% = ${usd(5)} | 10% = ${usd(10)}`,
  ];
  if (liquidity.depositedUsd > 0 && Math.abs(liquidity.proxyUsd - liquidity.depositedUsd) > 0.01) {
    lines.push(
      `  ⚠ DB/chain drift: DB says $${liquidity.depositedUsd.toFixed(4)}, chain says $${liquidity.proxyUsd.toFixed(4)} — honoring the smaller value`,
    );
  }
  return lines.join("\n");
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
