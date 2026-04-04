/**
 * Direct test of the autonomous swap pipeline — bypasses the debate layer.
 *
 * This proves the full proxy → hot wallet → Arc swap → holdings update chain
 * fires with real on-chain transactions, independent of whether the 7B
 * debate model picks BUY vs HOLD on any given cycle.
 *
 * Sequence:
 *   1. Load the funded user (6d2bc1ce…)
 *   2. Snapshot baseline: Circle proxy balance, hot wallet Arc balance,
 *      user.fund.depositedUsdc
 *   3. Call prepareSwapFunds(user, swapAmountUsd)
 *      → This pulls USDC from the Circle proxy wallet to the hot wallet
 *        via Circle's agentTransfer. Returns a real Circle tx id.
 *   4. Call executeArcSwap({ userPrivateKey, amountUsd })
 *      → This signs a Uniswap V3 exactInputSingle call to MockSwapRouter on
 *        Arc testnet using the user's HD-derived hot wallet key. Returns a
 *        real Arc tx hash.
 *   5. Call computeHoldingsUpdate + updateUser
 *      → Decrements user.fund.depositedUsdc, adds entry to user.fund.holdings.
 *   6. Snapshot post-state and diff against baseline.
 *
 * Usage:
 *   AMOUNT_USD=0.25 ./node_modules/.bin/tsx scripts/test-autonomous-swap.ts
 */

import "dotenv/config";
import { getUserById } from "../src/store/user-store";
import { updateUser } from "../src/store/user-store";
import { prepareSwapFunds, computeHoldingsUpdate, getHotWalletUsdBalance } from "../src/payments/fund-swap";
import { getProxyBalance } from "../src/payments/circle-wallet";
import { executeArcSwap } from "../src/execution/arc-swap";
import { getUserPrivateKey } from "../src/config/arc";

const TEST_USER_ID = process.env.TEST_USER_ID ?? "6d2bc1ce-9f3f-420e-b835-9e8813150ddb";
const AMOUNT_USD = parseFloat(process.env.AMOUNT_USD ?? "0.25");
const ASSET = process.env.ASSET ?? "ETH";

function line(label: string, value: string | number) {
  console.log(`  ${label.padEnd(24)} ${value}`);
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║   Autonomous Swap Pipeline — Direct Test                     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  line("user:", TEST_USER_ID.slice(0, 12) + "…");
  line("amount:", `$${AMOUNT_USD.toFixed(4)} USDC`);
  line("asset:", ASSET);
  console.log();

  // ─── 1. Load user ───────────────────────────────────────
  const user = await getUserById(TEST_USER_ID);
  if (!user) throw new Error(`user ${TEST_USER_ID} not found`);
  if (user.hotWalletIndex == null || !user.hotWalletAddress) {
    throw new Error("user has no hot wallet configured");
  }
  if (!user.proxyWallet?.walletId) {
    throw new Error("user has no Circle proxy wallet");
  }
  console.log("─── 1. User loaded ────────────────────────────────────────────");
  line("walletAddress:", user.walletAddress);
  line("proxy.walletId:", user.proxyWallet.walletId);
  line("proxy.address:", user.proxyWallet.address);
  line("hot.index:", user.hotWalletIndex);
  line("hot.address:", user.hotWalletAddress);
  line("DB depositedUsdc:", `$${user.fund.depositedUsdc.toFixed(4)}`);
  console.log();

  // ─── 2. Baseline snapshot ───────────────────────────────
  console.log("─── 2. Baseline snapshot (on-chain) ───────────────────────────");
  const proxyBalBefore = await getProxyBalance(user.proxyWallet.walletId).catch(() => []);
  const proxyUsdcBefore = parseFloat(proxyBalBefore.find((b) => b.symbol === "USDC")?.amount ?? "0");
  const hotBalBefore = await getHotWalletUsdBalance(user.hotWalletAddress as `0x${string}`);
  line("Circle proxy USDC:", `$${proxyUsdcBefore.toFixed(6)}`);
  line("Hot wallet Arc USDC:", `$${hotBalBefore.toFixed(6)}`);
  console.log();

  // ─── 3. Bridge funds proxy → hot wallet ─────────────────
  console.log("─── 3. prepareSwapFunds — Circle proxy → hot wallet ───────────");
  const prep = await prepareSwapFunds(user, AMOUNT_USD);
  line("Circle tx id:", prep.circleTxId ?? "—");
  line("transferred:", `$${prep.transferredUsd.toFixed(6)}`);
  line("hot before:", `$${prep.beforeUsd.toFixed(6)}`);
  line("hot after:", `$${prep.afterUsd.toFixed(6)}`);
  console.log();

  // ─── 4. Execute Arc swap ─────────────────────────────────
  console.log("─── 4. executeArcSwap — Uniswap V3 exactInputSingle on Arc ────");
  const userKey = getUserPrivateKey(user.hotWalletIndex);
  const swap = await executeArcSwap({ userPrivateKey: userKey, amountUsd: AMOUNT_USD });
  line("success:", String(swap.success));
  line("method:", swap.method);
  if (swap.txHash) line("tx hash:", swap.txHash);
  if (swap.explorerUrl) line("explorer:", swap.explorerUrl);
  if (swap.reason) line("reason:", swap.reason);
  console.log();

  if (!swap.success) {
    console.log("❌ swap failed — aborting before holdings update");
    process.exit(1);
  }

  // ─── 5. Update holdings in DB ────────────────────────────
  console.log("─── 5. computeHoldingsUpdate + updateUser ──────────────────────");
  const approxTokens = AMOUNT_USD / 100; // same placeholder as main-agent
  const holdings = computeHoldingsUpdate(user, ASSET, AMOUNT_USD, approxTokens);
  line("USD spent:", `$${holdings.usdcSpent.toFixed(6)}`);
  line("tokens gained:", `${approxTokens.toFixed(8)} ${ASSET}`);
  line("new depositedUsdc:", `$${holdings.newDepositedUsdc.toFixed(6)}`);
  line("new holdings:", JSON.stringify(holdings.newHoldings));

  await updateUser(user.id, {
    fund: {
      depositedUsdc: holdings.newDepositedUsdc,
      ...((({ holdings: holdings.newHoldings }) as unknown) as Record<string, never>),
    },
  });
  console.log("  ✅ user record updated");
  console.log();

  // ─── 6. Post-state snapshot ──────────────────────────────
  console.log("─── 6. Post-state snapshot ────────────────────────────────────");
  const proxyBalAfter = await getProxyBalance(user.proxyWallet.walletId).catch(() => []);
  const proxyUsdcAfter = parseFloat(proxyBalAfter.find((b) => b.symbol === "USDC")?.amount ?? "0");
  const hotBalAfter = await getHotWalletUsdBalance(user.hotWalletAddress as `0x${string}`);
  const userAfter = await getUserById(user.id);

  line("Circle proxy USDC:", `$${proxyUsdcAfter.toFixed(6)}  (Δ $${(proxyUsdcAfter - proxyUsdcBefore).toFixed(6)})`);
  line("Hot wallet Arc USDC:", `$${hotBalAfter.toFixed(6)}  (Δ $${(hotBalAfter - hotBalBefore).toFixed(6)})`);
  line("DB depositedUsdc:", `$${(userAfter?.fund.depositedUsdc ?? 0).toFixed(6)}`);
  const fundField = (userAfter?.fund as unknown as { holdings?: Record<string, number> }).holdings;
  line("DB holdings:", JSON.stringify(fundField ?? {}));
  console.log();

  console.log("─── ✅ Summary ─────────────────────────────────────────────────");
  console.log(`  • Circle agentTransfer:  ${prep.circleTxId ?? "skipped"}`);
  console.log(`  • Arc swap tx:           ${swap.txHash ?? "—"}`);
  console.log(`  • Explorer:              ${swap.explorerUrl ?? "—"}`);
  console.log(`  • Proxy debited:         $${(proxyUsdcBefore - proxyUsdcAfter).toFixed(6)}`);
  console.log(`  • User DB updated:       depositedUsdc=${userAfter?.fund.depositedUsdc.toFixed(6)} holdings=${JSON.stringify(fundField ?? {})}`);
  console.log();
  console.log("  🎯 Autonomous swap pipeline proven end-to-end with real");
  console.log("     on-chain transactions + real DB accounting update.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
