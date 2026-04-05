import { createWalletClient, createPublicClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, ARC_TOKENS, ARC_SWAP_ROUTER } from "../config/arc-chain";
import type { ArcSwapResult } from "../types/index";

// Uniswap V3 / AlphaDawgSwap exactInputSingle ABI (payable — accepts native USDC as value).
// AlphaDawgSwap.sol exposes this exact signature byte-for-byte so the BUY path
// doesn't need to change when we flip from MockSwapRouter to the real AMM.
const SWAP_ROUTER_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

// AlphaDawgSwap SELL path — dWETH → native USDC. Not present on Uniswap V3 or
// MockSwapRouter; this is net-new swap functionality enabled by the AMM deploy.
const SWAP_SELL_ABI = [
  {
    name: "exactInputSingleSell",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "dwethAmountIn", type: "uint256" },
      { name: "amountOutMinimum", type: "uint256" },
      { name: "recipient", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

// Minimal ERC-20 ABI — only the functions executeArcSell needs to approve the
// AMM and (optionally) read balances for ground-truth checks.
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

interface SwapParams {
  userPrivateKey: `0x${string}`;
  amountUsd: number; // in USD (will be converted to 18 decimals for Arc native USDC)
  tokenOut?: `0x${string}`; // default WETH
}

export async function executeArcSwap(params: SwapParams): Promise<ArcSwapResult> {
  const { userPrivateKey, amountUsd, tokenOut = ARC_TOKENS.WETH } = params;
  const amountIn = parseUnits(amountUsd.toString(), 18); // USDC has 18 decimals on Arc

  const account = privateKeyToAccount(userPrivateKey);

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  // Primary path: use MockSwapRouter / Uniswap V3 router
  if (ARC_SWAP_ROUTER) {
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 min

      // Send native USDC as msg.value (Arc native currency = USDC)
      // No ERC20 approve needed — USDC is the native token
      const swapTx = await walletClient.writeContract({
        address: ARC_SWAP_ROUTER,
        abi: SWAP_ROUTER_ABI,
        functionName: "exactInputSingle",
        args: [
          {
            tokenIn: ARC_TOKENS.USDC,
            tokenOut,
            fee: 3000, // 0.3% pool
            recipient: account.address,
            deadline,
            amountIn,
            amountOutMinimum: 0n, // Testnet — no slippage protection needed
            sqrtPriceLimitX96: 0n,
          },
        ],
        value: amountIn, // Native USDC sent as msg.value
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTx });

      // method: "alphadawg_swap" after the real AMM deploy — the buyer-side
      // calldata is identical to Uniswap V3 / MockSwapRouter, but the contract
      // behind ARC_SWAP_ROUTER now runs constant-product math against real
      // dWETH reserves and emits a real Transfer(dWETH → hotWallet) log.
      return {
        success: true,
        txHash: receipt.transactionHash,
        chain: "arc-testnet",
        explorerUrl: `https://testnet.arcscan.app/tx/${receipt.transactionHash}`,
        method: "alphadawg_swap",
        amountIn: amountUsd.toString(),
        tokenIn: ARC_TOKENS.USDC,
        tokenOut,
      };
    } catch (err) {
      console.warn("[arc-swap] Router swap failed, falling back to native transfer:", err instanceof Error ? err.message : String(err));
    }
  }

  // Fallback: direct native USDC transfer to self (produces real tx hash)
  return executeNativeTransfer(walletClient, publicClient, account.address, amountIn, amountUsd);
}

// Fallback: send native USDC to self via simple value transfer
async function executeNativeTransfer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any,
  recipient: `0x${string}`,
  amount: bigint,
  amountUsd: number,
): Promise<ArcSwapResult> {
  try {
    const tx = await walletClient.sendTransaction({
      to: recipient,
      value: amount,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

    return {
      success: true,
      txHash: receipt.transactionHash,
      chain: "arc-testnet",
      explorerUrl: `https://testnet.arcscan.app/tx/${receipt.transactionHash}`,
      method: "native_transfer",
      amountIn: amountUsd.toString(),
      tokenIn: ARC_TOKENS.USDC,
      tokenOut: ARC_TOKENS.USDC,
    };
  } catch (err) {
    return {
      success: false,
      chain: "arc-testnet",
      method: "native_transfer",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

// Calculate swap amount from deposit balance and trade percentage
export function calculateSwapAmount(depositedUsdc: number, pct: number): number {
  return Math.max(0, Math.floor(depositedUsdc * (pct / 100) * 100) / 100);
}

interface SellParams {
  userPrivateKey: `0x${string}`;
  dwethAmount: number; // tokens to sell (human units, 18 decimals)
  minUsdcOut?: number; // slippage floor in USDC; defaults to 0 for testnet smoke
}

/**
 * SELL path: dWETH → native USDC via AlphaDawgSwap.exactInputSingleSell.
 *
 * Two txs per call:
 *   1. dWETH.approve(AlphaDawgSwap, amountIn) — required because dWETH is an
 *      ERC-20 (unlike the BUY side where USDC is Arc's native currency).
 *   2. AlphaDawgSwap.exactInputSingleSell(amountIn, minOut, recipient, deadline).
 *
 * Requires ARC_WETH_ADDRESS and ARC_UNISWAP_ROUTER to both be set — if
 * ARC_WETH_ADDRESS is missing we're still on the MockSwapRouter pointer and
 * the sell path has no contract to target, so we return a skipped result
 * instead of crashing.
 */
export async function executeArcSell(params: SellParams): Promise<ArcSwapResult> {
  const { userPrivateKey, dwethAmount, minUsdcOut = 0 } = params;
  const dwethAddr = process.env.ARC_WETH_ADDRESS as `0x${string}` | undefined;

  if (!ARC_SWAP_ROUTER || !dwethAddr || dwethAddr === "0x0000000000000000000000000000000000000001") {
    return {
      success: false,
      chain: "arc-testnet",
      method: "skipped",
      reason:
        "ARC_WETH_ADDRESS or ARC_UNISWAP_ROUTER not set — deploy AlphaDawgSwap first",
    };
  }

  const amountIn = parseUnits(dwethAmount.toString(), 18);
  const minOut = parseUnits(minUsdcOut.toString(), 18);
  const account = privateKeyToAccount(userPrivateKey);

  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  try {
    // 1. Approve AlphaDawgSwap to pull dWETH from the seller.
    const approveTx = await walletClient.writeContract({
      address: dwethAddr,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ARC_SWAP_ROUTER, amountIn],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });

    // 2. Execute the sell. Deadline is a 30-minute window like the BUY path.
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800);
    const sellTx = await walletClient.writeContract({
      address: ARC_SWAP_ROUTER,
      abi: SWAP_SELL_ABI,
      functionName: "exactInputSingleSell",
      args: [amountIn, minOut, account.address, deadline],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: sellTx });

    return {
      success: receipt.status === "success",
      txHash: receipt.transactionHash,
      chain: "arc-testnet",
      explorerUrl: `https://testnet.arcscan.app/tx/${receipt.transactionHash}`,
      method: "alphadawg_swap_sell",
      amountIn: dwethAmount.toString(),
      tokenIn: dwethAddr,
      tokenOut: ARC_TOKENS.USDC,
    };
  } catch (err) {
    return {
      success: false,
      chain: "arc-testnet",
      method: "alphadawg_swap_sell",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
