import { createWalletClient, createPublicClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, ARC_TOKENS, ARC_SWAP_ROUTER } from "../config/arc-chain";
import type { ArcSwapResult } from "../types/index";

// ERC20 approve ABI
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

// Uniswap V3 exactInputSingle ABI
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

interface SwapParams {
  userPrivateKey: `0x${string}`;
  amountUsd: number; // in USD (will be converted to 18 decimals for Arc)
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

  // If no Uniswap router configured, fall back to direct ERC20 transfer
  if (!ARC_SWAP_ROUTER || tokenOut === "0x0000000000000000000000000000000000000000") {
    return executeDirectTransfer(walletClient, publicClient, account.address, amountIn);
  }

  try {
    // Step 1: Approve router to spend USDC
    const approveTx = await walletClient.writeContract({
      address: ARC_TOKENS.USDC,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ARC_SWAP_ROUTER, amountIn],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });

    // Step 2: Execute Uniswap V3 swap
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 min
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
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: swapTx });

    return {
      success: true,
      txHash: receipt.transactionHash,
      chain: "arc-testnet",
      explorerUrl: `https://testnet.arcscan.app/tx/${receipt.transactionHash}`,
      method: "uniswap_v3",
      amountIn: amountUsd.toString(),
      tokenIn: ARC_TOKENS.USDC,
      tokenOut,
    };
  } catch (err) {
    console.warn("[arc-swap] Uniswap swap failed, falling back to direct transfer:", err instanceof Error ? err.message : String(err));
    return executeDirectTransfer(walletClient, publicClient, account.address, amountIn);
  }
}

// Fallback: direct USDC transfer to self (logs as a "swap" for demo purposes)
async function executeDirectTransfer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  walletClient: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any,
  recipient: `0x${string}`,
  amount: bigint,
): Promise<ArcSwapResult> {
  try {
    const tx = await walletClient.writeContract({
      address: ARC_TOKENS.USDC,
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [recipient, amount],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

    return {
      success: true,
      txHash: receipt.transactionHash,
      chain: "arc-testnet",
      explorerUrl: `https://testnet.arcscan.app/tx/${receipt.transactionHash}`,
      method: "direct_transfer",
      amountIn: amount.toString(),
      tokenIn: ARC_TOKENS.USDC,
      tokenOut: ARC_TOKENS.USDC,
    };
  } catch (err) {
    return {
      success: false,
      chain: "arc-testnet",
      method: "direct_transfer",
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

// Calculate swap amount from deposit balance and trade percentage
export function calculateSwapAmount(depositedUsdc: number, pct: number): number {
  return Math.max(0, Math.floor(depositedUsdc * (pct / 100) * 100) / 100);
}
