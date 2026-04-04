/**
 * Proxy → Hot wallet funding bridge for autonomous swap execution.
 *
 * Why this exists
 * ───────────────
 * When the agent decides BUY ETH X%, the x402-signed swap transaction is sent
 * from the user's HD-derived hot wallet (because viem + hot wallet signs Arc
 * txs). But the user's deposited USDC lives in the CIRCLE PROXY WALLET (MPC
 * custody). These are two different on-chain addresses with two different
 * balances. Without a bridge, swaps would try to spend USDC the hot wallet
 * doesn't have and fail.
 *
 * What this does
 * ──────────────
 * 1. Reads the hot wallet's current Arc native USDC balance via viem.
 * 2. If the balance is already >= the swap amount, returns immediately.
 * 3. Otherwise, calls Circle `agentTransfer()` to move the shortfall from
 *    the proxy wallet to the hot wallet.
 * 4. Polls the hot wallet's Arc balance every 3s until it reaches the target
 *    or 60s elapses.
 *
 * This keeps the execution model clean: the agent's hot wallet is the
 * autonomous execution address, and the proxy wallet is the user's custody
 * vault. Every swap pulls exactly the amount needed from custody.
 */

import { createPublicClient, http, parseUnits, formatUnits } from "viem";
import { arcTestnet } from "../config/arc-chain";
import { agentTransfer, getProxyBalance } from "./circle-wallet";
import type { UserRecord } from "../types/index";

// Arc USDC has 18 decimals (it's the native currency, not ERC-20).
const USDC_DECIMALS = 18;
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 60_000;

export interface FundPrepResult {
  skipped: boolean; // true when hot wallet already had enough
  circleTxId?: string;
  fromAddress?: string; // proxy wallet
  toAddress: string; // hot wallet
  transferredUsd: number;
  beforeUsd: number;
  afterUsd: number;
}

export async function getHotWalletUsdBalance(address: `0x${string}`): Promise<number> {
  const client = createPublicClient({ chain: arcTestnet, transport: http() });
  const balanceWei = await client.getBalance({ address });
  return Number(formatUnits(balanceWei, USDC_DECIMALS));
}

/**
 * Bridge `requiredUsd` USDC from the Circle proxy wallet to the hot wallet.
 *
 * IMPORTANT: this ALWAYS pulls from the proxy, regardless of whether the hot
 * wallet already has sufficient balance. This is deliberate — the hot wallet
 * may hold pre-funded demo USDC that isn't the user's deposit, and we want
 * every swap to be debited against the user's actual custody. Any residue in
 * the hot wallet is separate from user accounting.
 *
 * Throws only if the transfer provably fails (Circle rejects or balance
 * never increases). Non-fatal otherwise — the caller should catch and fall
 * back to a degraded "insufficient funds" swap result.
 */
export async function prepareSwapFunds(
  user: UserRecord,
  requiredUsd: number,
): Promise<FundPrepResult> {
  if (!user.hotWalletAddress) {
    throw new Error("user has no hotWalletAddress — cannot prepare swap funds");
  }
  if (!user.proxyWallet?.walletId) {
    throw new Error("user has no proxyWallet.walletId — Circle MPC wallet missing");
  }

  const hotAddress = user.hotWalletAddress as `0x${string}`;
  const beforeUsd = await getHotWalletUsdBalance(hotAddress);

  // We always bridge the full swap amount + a small buffer for rounding.
  // This guarantees the proxy wallet is the source of truth for user spend.
  const transferUsd = Math.ceil(requiredUsd * 10000) / 10000 + 0.0001;

  // Guard: don't try to move more than the proxy actually holds.
  const proxyBalances = await getProxyBalance(user.proxyWallet.walletId).catch(() => []);
  const proxyUsdc = proxyBalances.find((b) => b.symbol === "USDC" || b.symbol === "USD");
  if (proxyUsdc) {
    const proxyUsd = parseFloat(proxyUsdc.amount);
    if (proxyUsd < transferUsd) {
      throw new Error(
        `proxy wallet has only $${proxyUsd.toFixed(4)} — cannot cover $${transferUsd.toFixed(4)} swap funding`,
      );
    }
    console.log(`[fund-swap] Circle proxy balance: $${proxyUsd.toFixed(4)} — pulling $${transferUsd.toFixed(4)}`);
  }

  console.log(
    `[fund-swap] bridging $${transferUsd.toFixed(4)} USDC from Circle proxy ${user.proxyWallet.address?.slice(0, 10)}… → hot wallet ${hotAddress.slice(0, 10)}…`,
  );

  const tx = await agentTransfer(
    user.proxyWallet.walletId,
    hotAddress,
    transferUsd.toFixed(6),
  );
  console.log(`[fund-swap] Circle tx=${tx.txId} state=${tx.state}`);

  // Poll Arc until the balance actually increases beyond the prior level.
  // We trust Arc RPC as the source of truth.
  const targetWei = parseUnits(
    (beforeUsd + requiredUsd).toString(),
    USDC_DECIMALS,
  );
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let afterUsd = beforeUsd;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const client = createPublicClient({ chain: arcTestnet, transport: http() });
    const bal = await client.getBalance({ address: hotAddress });
    afterUsd = Number(formatUnits(bal, USDC_DECIMALS));
    if (bal >= targetWei) {
      console.log(
        `[fund-swap] hot wallet received $${(afterUsd - beforeUsd).toFixed(6)} — before $${beforeUsd.toFixed(4)} after $${afterUsd.toFixed(4)}`,
      );
      return {
        skipped: false,
        circleTxId: tx.txId,
        fromAddress: user.proxyWallet.address,
        toAddress: hotAddress,
        transferredUsd: afterUsd - beforeUsd,
        beforeUsd,
        afterUsd,
      };
    }
  }

  throw new Error(
    `Circle transfer ${tx.txId} did not land within ${POLL_TIMEOUT_MS / 1000}s — hot wallet still at $${afterUsd.toFixed(4)} (expected increase from $${beforeUsd.toFixed(4)})`,
  );
}

/**
 * Ensure the user's hot wallet has a minimum Arc USDC balance before
 * x402-paid specialist hires. Unlike `prepareSwapFunds()` (which always
 * bridges the exact swap amount for BUY/SELL accounting), this helper is a
 * top-up with a floor/ceiling:
 *
 *   - If `current >= minBalanceUsd` → return { skipped: true } immediately
 *     (no Circle call, no RPC poll — avoids churn on every cycle).
 *   - Otherwise bridge `topupUsd` from the proxy to the hot wallet.
 *
 * Why this exists
 * ───────────────
 * The x402 signer is the BIP-44 hot wallet (see `src/config/arc.ts`
 * `getUserPaymentFetch`), not the Circle MPC proxy. On a fresh user account
 * the hot wallet has zero Arc USDC, so Circle Gateway rejects every x402
 * settlement with `{"error":"Payment settlement failed","reason":"insufficient_balance"}`.
 * Calling this before `hireSpecialists()` restores the x402 flow.
 *
 * At $0.001 per hire the default $0.20 top-up funds ~200 hires; the $0.05
 * floor means we only top up when the wallet is nearly drained.
 *
 * Non-fatal: if the proxy has insufficient funds or Circle rejects, this
 * throws with a clear message so the caller can log-and-continue rather
 * than abort the whole cycle.
 */
export async function ensureHotWalletFunded(
  user: UserRecord,
  minBalanceUsd: number = 0.05,
  topupUsd: number = 0.20,
): Promise<FundPrepResult> {
  if (!user.hotWalletAddress) {
    throw new Error("user has no hotWalletAddress — cannot top up hot wallet");
  }
  if (!user.proxyWallet?.walletId) {
    throw new Error("user has no proxyWallet.walletId — Circle MPC wallet missing");
  }

  const hotAddress = user.hotWalletAddress as `0x${string}`;
  const beforeUsd = await getHotWalletUsdBalance(hotAddress);

  // Already funded above the floor — skip the Circle round-trip entirely.
  if (beforeUsd >= minBalanceUsd) {
    console.log(
      `[fund-topup] hot wallet already funded: $${beforeUsd.toFixed(6)} >= floor $${minBalanceUsd.toFixed(4)} — skipping top-up`,
    );
    return {
      skipped: true,
      toAddress: hotAddress,
      transferredUsd: 0,
      beforeUsd,
      afterUsd: beforeUsd,
    };
  }

  // Guard: ensure the proxy actually has enough to cover the top-up.
  const proxyBalances = await getProxyBalance(user.proxyWallet.walletId).catch(() => []);
  const proxyUsdc = proxyBalances.find((b) => b.symbol === "USDC" || b.symbol === "USD");
  if (proxyUsdc) {
    const proxyUsd = parseFloat(proxyUsdc.amount);
    if (proxyUsd < topupUsd) {
      throw new Error(
        `proxy wallet has only $${proxyUsd.toFixed(4)} — cannot cover $${topupUsd.toFixed(4)} hot wallet top-up`,
      );
    }
  }

  console.log(
    `[fund-topup] hot wallet at $${beforeUsd.toFixed(6)} < floor $${minBalanceUsd.toFixed(4)} — bridging $${topupUsd.toFixed(4)} from Circle proxy ${user.proxyWallet.address?.slice(0, 10)}… → ${hotAddress.slice(0, 10)}…`,
  );

  const tx = await agentTransfer(
    user.proxyWallet.walletId,
    hotAddress,
    topupUsd.toFixed(6),
  );
  console.log(`[fund-topup] Circle tx=${tx.txId} state=${tx.state}`);

  // Poll Arc until the balance reflects the top-up. We target
  // (beforeUsd + topupUsd) but accept any increase beyond the floor as
  // success — Circle rounding can land a hair below the requested amount.
  const targetWei = parseUnits(
    (beforeUsd + topupUsd * 0.95).toString(), // 5% slippage tolerance
    USDC_DECIMALS,
  );
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let afterUsd = beforeUsd;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const client = createPublicClient({ chain: arcTestnet, transport: http() });
    const bal = await client.getBalance({ address: hotAddress });
    afterUsd = Number(formatUnits(bal, USDC_DECIMALS));
    if (bal >= targetWei) {
      console.log(
        `[fund-topup] hot wallet topped up: +$${(afterUsd - beforeUsd).toFixed(6)} (before $${beforeUsd.toFixed(4)} → after $${afterUsd.toFixed(4)})`,
      );
      return {
        skipped: false,
        circleTxId: tx.txId,
        fromAddress: user.proxyWallet.address,
        toAddress: hotAddress,
        transferredUsd: afterUsd - beforeUsd,
        beforeUsd,
        afterUsd,
      };
    }
  }

  throw new Error(
    `Circle top-up ${tx.txId} did not land within ${POLL_TIMEOUT_MS / 1000}s — hot wallet still at $${afterUsd.toFixed(4)} (expected $${(beforeUsd + topupUsd).toFixed(4)})`,
  );
}

/**
 * After a successful swap, update the user's DB balance to reflect the
 * spend. This is the accounting counterpart to the on-chain movement —
 * user.fund.depositedUsdc decreases, user.fund.holdings[token] increases.
 *
 * Called from commitCycle() after executeArcSwap returns success.
 */
export interface HoldingsUpdate {
  tokenSymbol: string;
  tokenAmount: number; // quoted token amount from the swap
  usdcSpent: number;
  newDepositedUsdc: number;
  newHoldings: Record<string, number>;
}

export function computeHoldingsUpdate(
  user: UserRecord,
  tokenSymbol: string,
  usdcSpent: number,
  tokenAmount: number,
): HoldingsUpdate {
  const prevHoldings = (user.fund as unknown as { holdings?: Record<string, number> }).holdings ?? {};
  const currentAmount = prevHoldings[tokenSymbol] ?? 0;
  return {
    tokenSymbol,
    tokenAmount,
    usdcSpent,
    newDepositedUsdc: Math.max(0, user.fund.depositedUsdc - usdcSpent),
    newHoldings: {
      ...prevHoldings,
      [tokenSymbol]: currentAmount + tokenAmount,
    },
  };
}
