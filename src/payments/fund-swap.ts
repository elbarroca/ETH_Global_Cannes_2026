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
import { getUserGatewayClient } from "../config/arc";
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
  /** Weighted-average cost basis per token AFTER the swap, in USD per unit.
   *  BUY blends the new entry price with the existing basis; SELL leaves the
   *  basis untouched for remaining tokens. */
  newCostBasis: Record<string, number>;
  /** Cumulative realized P&L after the swap. Unchanged on BUY; SELL adds
   *  `(usdcReceived - tokensSold × costBasis)` to the prior value. */
  newRealizedPnl: number;
  /** P&L realized BY THIS SWAP in USD (0 for BUY, positive/negative for SELL).
   *  Separate from `newRealizedPnl` which is the cumulative total. */
  realizedPnlDelta: number;
}

type FundExtensions = {
  holdings?: Record<string, number>;
  costBasis?: Record<string, number>;
  realizedPnl?: number;
};

function readFundExtensions(user: UserRecord): Required<FundExtensions> {
  const fund = user.fund as unknown as FundExtensions;
  return {
    holdings: fund.holdings ?? {},
    costBasis: fund.costBasis ?? {},
    realizedPnl: fund.realizedPnl ?? 0,
  };
}

/**
 * Fresh BUY: increment `holdings[token]`, decrement `depositedUsdc`, and
 * recompute the token's weighted-average cost basis. If the user already owns
 * some of the token, the new basis is:
 *
 *   newBasis = (oldAmount × oldBasis + usdcSpent) / (oldAmount + tokenAmount)
 *
 * which is the USD cost per unit averaged over the total position. Realized
 * P&L is untouched (nothing is sold on BUY).
 */
export function computeHoldingsUpdate(
  user: UserRecord,
  tokenSymbol: string,
  usdcSpent: number,
  tokenAmount: number,
): HoldingsUpdate {
  const { holdings: prevHoldings, costBasis: prevBasis, realizedPnl } = readFundExtensions(user);
  const currentAmount = prevHoldings[tokenSymbol] ?? 0;
  const currentBasis = prevBasis[tokenSymbol] ?? 0;
  const newAmount = currentAmount + tokenAmount;

  // Weighted-average cost basis. When currentAmount is 0, newBasis reduces to
  // the entry price of this purchase (usdcSpent / tokenAmount). When it's > 0,
  // the old position's total cost blends with the new purchase's total cost.
  const oldTotalCost = currentAmount * currentBasis;
  const newTotalCost = oldTotalCost + usdcSpent;
  const newBasis = newAmount > 0 ? newTotalCost / newAmount : 0;

  return {
    tokenSymbol,
    tokenAmount,
    usdcSpent,
    newDepositedUsdc: Math.max(0, user.fund.depositedUsdc - usdcSpent),
    newHoldings: {
      ...prevHoldings,
      [tokenSymbol]: newAmount,
    },
    newCostBasis: {
      ...prevBasis,
      [tokenSymbol]: newBasis,
    },
    newRealizedPnl: realizedPnl,
    realizedPnlDelta: 0,
  };
}

/**
 * SELL: decrement `holdings[token]`, credit `depositedUsdc`, and compute
 * realized P&L against the token's weighted-average cost basis:
 *
 *   pnlDelta = usdcReceived - tokensSold × costBasis
 *
 * Cost basis for the remaining position is preserved — weighted-average
 * accounting says unsold tokens still carry their original basis. If the
 * position fully closes (amount → 0), the basis is reset to 0 so the next
 * BUY starts fresh.
 */
export function computeSellHoldingsUpdate(
  user: UserRecord,
  tokenSymbol: string,
  tokensSold: number,
  usdcReceived: number,
): HoldingsUpdate {
  const { holdings: prevHoldings, costBasis: prevBasis, realizedPnl } = readFundExtensions(user);
  const currentAmount = prevHoldings[tokenSymbol] ?? 0;
  const currentBasis = prevBasis[tokenSymbol] ?? 0;
  const remaining = Math.max(0, currentAmount - tokensSold);

  // Realized P&L for this sale only. Positive = profit, negative = loss.
  // Uses weighted-average cost basis — no FIFO/LIFO lot tracking needed.
  const costOfSold = tokensSold * currentBasis;
  const pnlDelta = usdcReceived - costOfSold;

  const nextBasis = { ...prevBasis };
  if (remaining <= 0) {
    delete nextBasis[tokenSymbol];
  } else {
    nextBasis[tokenSymbol] = currentBasis;
  }

  return {
    tokenSymbol,
    tokenAmount: tokensSold,
    usdcSpent: usdcReceived, // reused as "received" on the sell side
    newDepositedUsdc: user.fund.depositedUsdc + usdcReceived,
    newHoldings: {
      ...prevHoldings,
      [tokenSymbol]: remaining,
    },
    newCostBasis: nextBasis,
    newRealizedPnl: realizedPnl + pnlDelta,
    realizedPnlDelta: pnlDelta,
  };
}

/**
 * Circle Gateway pool funding result. Separate from FundPrepResult because
 * the ledger is different — this is the Gateway contract's pool balance,
 * not the wallet's native USDC.
 */
export interface GatewayFundResult {
  skipped: boolean;
  depositTxHash?: string;
  /** Gateway pool balance in USD before the deposit (0 if nothing was there). */
  beforeUsd: number;
  /** Gateway pool balance in USD after the deposit lands. */
  afterUsd: number;
  /** Amount topped up in USD (0 if skipped). */
  depositedUsd: number;
  /** Human-readable address this deposit credits (the x402 signer). */
  signerAddress: string;
}

/**
 * Ensure the user's x402 signer has USDC inside the Circle Gateway pool so
 * batched nanopayments can settle.
 *
 * Why this exists
 * ───────────────
 * Circle Gateway's batching scheme pays from a POOLED balance keyed by the
 * signer address, NOT from the signer's wallet native USDC balance. When a
 * specialist 402s, the facilitator asks the Gateway contract "does this
 * address have capacity in the pool?" — if the pool is empty, settlement
 * fails with `insufficient_balance` even though the hot wallet holds native
 * USDC. `ensureHotWalletFunded` handles the wallet side (for swap execution);
 * THIS helper handles the Gateway pool side (for x402 specialist hires).
 *
 * The two helpers are complementary — one funds the "wallet ledger" used by
 * `prepareSwapFunds` → `executeArcSwap`, the other funds the "pool ledger"
 * used by `@circle-fin/x402-batching` for specialist payments.
 *
 * At $0.001/hire, a $0.50 topup covers 500 specialist calls, so in practice
 * this helper is a no-op skip on 99% of cycles and self-heals when the pool
 * finally drains.
 *
 * Call sequence to bootstrap a fresh user:
 *   1. ensureHotWalletFunded(user, 0.05, 0.50+0.05)  ← wallet native USDC
 *   2. ensureGatewayPoolFunded(user, 0.10, 0.50)     ← Gateway pool USDC
 *
 * Non-fatal: logs and returns on failure so callers can cascade to HOLD
 * rather than abort the cycle.
 */
export async function ensureGatewayPoolFunded(
  user: UserRecord,
  minBalanceUsd: number = 0.10,
  topupUsd: number = 0.50,
): Promise<GatewayFundResult> {
  if (user.hotWalletIndex == null) {
    throw new Error("user has no hotWalletIndex — cannot derive Gateway client");
  }

  const gateway = getUserGatewayClient(user.hotWalletIndex);

  // Read the pool balance. `gateway.available` is a bigint in USDC atomic
  // units (6 decimals on the Gateway contract even though Arc native USDC
  // is 18 decimals — the pool uses Circle's canonical representation).
  const balances = await gateway.getBalances();
  const signerAddress = user.hotWalletAddress ?? "(unknown)";
  const availableAtomic = balances.gateway.available;
  const beforeUsd = Number(balances.gateway.formattedAvailable);

  if (beforeUsd >= minBalanceUsd) {
    console.log(
      `[gateway-fund] pool balance $${beforeUsd.toFixed(4)} >= floor $${minBalanceUsd.toFixed(4)} for ${signerAddress.slice(0, 10)}… — skipping deposit`,
    );
    return {
      skipped: true,
      beforeUsd,
      afterUsd: beforeUsd,
      depositedUsd: 0,
      signerAddress,
    };
  }

  // Pool is below floor. The Gateway contract will pull from the signer's
  // wallet native USDC, so the hot wallet needs enough headroom to cover the
  // deposit plus a small buffer for gas (Arc gas is native USDC too). We
  // opportunistically top up the hot wallet here — if it's already fine,
  // ensureHotWalletFunded short-circuits on its own floor check.
  const walletHeadroom = topupUsd + 0.05;
  try {
    await ensureHotWalletFunded(user, walletHeadroom, walletHeadroom + 0.05);
  } catch (err) {
    throw new Error(
      `cannot deposit to Gateway pool: hot wallet top-up failed — ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  console.log(
    `[gateway-fund] pool balance $${beforeUsd.toFixed(6)} (atomic ${availableAtomic}) < floor $${minBalanceUsd.toFixed(4)} — depositing $${topupUsd.toFixed(2)} for ${signerAddress.slice(0, 10)}…`,
  );

  const result = await gateway.deposit(topupUsd.toFixed(6));
  const depositedUsd = Number(result.formattedAmount);
  console.log(
    `[gateway-fund] deposit tx=${result.depositTxHash} amount=$${depositedUsd.toFixed(6)} depositor=${result.depositor}`,
  );

  // Re-read the balance to confirm the deposit settled. `deposit()` awaits
  // the on-chain tx receipt internally, so the balance should reflect the
  // new total immediately — no polling needed like the Circle MPC path.
  const after = await gateway.getBalances();
  const afterUsd = Number(after.gateway.formattedAvailable);

  return {
    skipped: false,
    depositTxHash: result.depositTxHash,
    beforeUsd,
    afterUsd,
    depositedUsd,
    signerAddress,
  };
}

/**
 * Compute a fresh NAV snapshot in USD from a holdings map and a price map.
 *
 *   NAV = depositedUsdc + Σ( holdings[token] × priceUsd[token] )
 *
 * Unknown tokens (no price available) are priced at 0 — callers should log a
 * warning but should not fail the cycle. Stablecoins (USDC) are always $1.
 */
export function computeCurrentNav(
  depositedUsdc: number,
  holdings: Record<string, number>,
  priceUsd: Record<string, number>,
): number {
  let nav = depositedUsdc;
  for (const [symbol, amount] of Object.entries(holdings)) {
    if (!amount || amount <= 0) continue;
    const upper = symbol.toUpperCase();
    if (upper === "USDC" || upper === "USD") {
      nav += amount;
      continue;
    }
    const price = priceUsd[upper] ?? priceUsd[symbol] ?? 0;
    nav += amount * price;
  }
  return nav;
}
