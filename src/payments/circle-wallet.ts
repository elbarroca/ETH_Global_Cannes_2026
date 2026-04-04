import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { createPublicClient, encodeFunctionData, http, parseUnits } from "viem";
import { baseSepolia } from "viem/chains";

// Arc Testnet USDC (pre-deployed at fixed address)
const USDC_ARC = process.env.USDC_ARC_ADDRESS ?? "0x3600000000000000000000000000000000000000";
// Legacy Base Sepolia USDC (kept for swap routing if needed)
const USDC_BASE_SEPOLIA = process.env.USDC_BASE_SEPOLIA_ADDRESS ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const CIRCLE_BLOCKCHAIN = "ARC-TESTNET" as const;

// Uniswap v3 SwapRouter02 on Base Sepolia
const UNISWAP_ROUTER = "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4";
// Uniswap v3 Factory on Base Sepolia
const UNISWAP_FACTORY = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24";
// Uniswap v3 QuoterV2 on Base Sepolia
const UNISWAP_QUOTER = "0xC5290058841028F1614F3A6F0F5816cAd0df5E27";
// WETH on Base Sepolia
const WETH_BASE_SEPOLIA = "0x4200000000000000000000000000000000000006";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

// Known testnet token addresses on Base Sepolia
const KNOWN_TOKENS: Record<string, string> = {
  USDC: USDC_BASE_SEPOLIA,
  WETH: WETH_BASE_SEPOLIA,
  ETH: WETH_BASE_SEPOLIA, // ETH routes through WETH
};

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const SWAP_ROUTER_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

type CircleClient = ReturnType<typeof initiateDeveloperControlledWalletsClient>;
let client: CircleClient | null = null;

function getClient(): CircleClient {
  if (!client) {
    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
    if (!apiKey || !entitySecret) {
      throw new Error("CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET must be set in .env");
    }
    client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  }
  return client;
}

function getWalletSetId(): string {
  const id = process.env.CIRCLE_WALLET_SET_ID;
  if (!id) throw new Error("CIRCLE_WALLET_SET_ID not set in .env");
  return id;
}

export async function createProxyWallet(
  userId: string,
): Promise<{ walletId: string; address: string }> {
  const circle = getClient();
  const response = await circle.createWallets({
    walletSetId: getWalletSetId(),
    blockchains: [CIRCLE_BLOCKCHAIN],
    count: 1,
    accountType: "EOA",
    metadata: [{ name: `AlphaDawg-${userId}`, refId: userId }],
  });

  const wallet = response.data?.wallets?.[0];
  if (!wallet?.id || !wallet?.address) {
    throw new Error("Circle wallet creation failed — no wallet returned");
  }

  return { walletId: wallet.id, address: wallet.address };
}

export async function getProxyBalance(
  walletId: string,
): Promise<Array<{ amount: string; symbol: string }>> {
  const circle = getClient();
  const response = await circle.getWalletTokenBalance({ id: walletId });
  const balances = response.data?.tokenBalances ?? [];
  return balances.map((b) => ({
    amount: b.amount,
    symbol: b.token?.symbol ?? "UNKNOWN",
  }));
}

export async function agentTransfer(
  walletId: string,
  toAddress: string,
  usdcAmount: string,
): Promise<{ txId: string; state: string }> {
  const circle = getClient();
  // Circle SDK union types require walletAddress+blockchain for tokenAddress.
  // With walletId, the wallet knows its chain — cast to satisfy the complex overload.
  const response = await circle.createTransaction({
    walletId,
    tokenAddress: USDC_ARC,
    destinationAddress: toAddress,
    amount: [usdcAmount],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  } as unknown as Parameters<typeof circle.createTransaction>[0]);

  const tx = response.data;
  if (!tx?.id) {
    throw new Error("Circle transaction creation failed — no tx returned");
  }

  return { txId: tx.id, state: tx.state ?? "INITIATED" };
}

const FACTORY_ABI = [
  {
    name: "getPool",
    type: "function",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" },
    ],
    outputs: [{ name: "pool", type: "address" }],
  },
] as const;

const QUOTER_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

type PoolProbe = { ok: true; feeTier: number; amountOut: bigint } | { ok: false };
type PoolSuggestion = { symbol: string; address: string; feeTier: number; liquidityUsd: string };

/** Try one fee tier. Returns ok+quote or ok:false — never throws. */
async function probePool(tokenIn: string, tokenOut: string, amountIn: bigint, feeTier: number): Promise<PoolProbe> {
  try {
    const poolAddress = await publicClient.readContract({
      address: UNISWAP_FACTORY as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: "getPool",
      args: [tokenIn as `0x${string}`, tokenOut as `0x${string}`, feeTier],
    });
    if (!poolAddress || poolAddress === "0x0000000000000000000000000000000000000000") return { ok: false };

    const result = await publicClient.readContract({
      address: UNISWAP_QUOTER as `0x${string}`,
      abi: QUOTER_ABI,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn: tokenIn as `0x${string}`, tokenOut: tokenOut as `0x${string}`, amountIn, fee: feeTier, sqrtPriceLimitX96: 0n }],
    });
    const amountOut = Array.isArray(result) ? result[0] : result;
    return { ok: true, feeTier, amountOut };
  } catch {
    return { ok: false };
  }
}

/** Find best fee tier for a pair (tries 500, 3000, 10000). Returns first with liquidity. */
async function findBestPool(tokenIn: string, tokenOut: string, amountIn: bigint): Promise<PoolProbe> {
  for (const feeTier of [500, 3000, 10000]) {
    const result = await probePool(tokenIn, tokenOut, amountIn, feeTier);
    if (result.ok) return result;
  }
  return { ok: false };
}

/**
 * Query Uniswap v3 subgraph for top liquid pools that include USDC on Base Sepolia.
 * Returns suggestions the agent can offer when the requested token has no pool.
 */
export async function queryAvailableUsdcPools(): Promise<PoolSuggestion[]> {
  const SUBGRAPH = "https://api.studio.thegraph.com/query/48211/uniswap-v3-base-sepolia/version/latest";
  const query = `{
    pools(first: 10, orderBy: totalValueLockedUSD, orderDirection: desc,
      where: { token0_in: ["${USDC_BASE_SEPOLIA.toLowerCase()}", "${WETH_BASE_SEPOLIA.toLowerCase()}"],
               token1_in: ["${USDC_BASE_SEPOLIA.toLowerCase()}", "${WETH_BASE_SEPOLIA.toLowerCase()}"] }) {
      token0 { symbol id }
      token1 { symbol id }
      feeTier
      totalValueLockedUSD
    }
  }`;

  try {
    const res = await fetch(SUBGRAPH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const json = await res.json() as { data?: { pools?: Array<{ token0: { symbol: string; id: string }; token1: { symbol: string; id: string }; feeTier: string; totalValueLockedUSD: string }> } };
    const pools = json.data?.pools ?? [];

    return pools.map((p) => {
      // The "other" token relative to USDC
      const isToken0Usdc = p.token0.id.toLowerCase() === USDC_BASE_SEPOLIA.toLowerCase();
      const other = isToken0Usdc ? p.token1 : p.token0;
      return {
        symbol: other.symbol,
        address: other.id,
        feeTier: Number(p.feeTier),
        liquidityUsd: `$${parseFloat(p.totalValueLockedUSD).toFixed(0)}`,
      };
    });
  } catch {
    // Subgraph unreachable — return known stable fallback
    return [{ symbol: "WETH", address: WETH_BASE_SEPOLIA, feeTier: 3000, liquidityUsd: "unknown" }];
  }
}

export type SwapResult =
  | { success: true; approveTxId: string; swapTxId: string; tokenOut: string; quotedAmount: bigint; feeTier: number }
  | { success: false; reason: "unknown_token"; requested: string }
  | { success: false; reason: "no_pool"; requested: string; suggestions: PoolSuggestion[] };

/**
 * Execute a USDC → token swap on Uniswap v3 (Base Sepolia) from a Circle proxy wallet.
 * Returns a typed SwapResult — never throws. Agent should check success before logging.
 *
 * @param walletId       Circle wallet ID (from createProxyWallet)
 * @param walletAddress  On-chain EOA address of that wallet
 * @param tokenSymbol    "ETH", "WETH", or a 0x token address
 * @param usdcAmountIn   Human-readable USDC amount e.g. "10.5"
 * @param slippagePct    Slippage tolerance in percent (default 0.5)
 */
export async function executeSwap(
  walletId: string,
  walletAddress: string,
  tokenSymbol: string,
  usdcAmountIn: string,
  slippagePct = 0.5,
): Promise<SwapResult> {
  const circle = getClient();

  const tokenOut = KNOWN_TOKENS[tokenSymbol.toUpperCase()] ?? tokenSymbol;
  if (!tokenOut.startsWith("0x")) {
    return { success: false, reason: "unknown_token", requested: tokenSymbol };
  }

  const amountIn = parseUnits(usdcAmountIn, 6); // USDC = 6 decimals

  // Find best fee tier with an active pool
  const pool = await findBestPool(USDC_BASE_SEPOLIA, tokenOut, amountIn);
  if (!pool.ok) {
    const suggestions = await queryAvailableUsdcPools();
    return { success: false, reason: "no_pool", requested: tokenSymbol, suggestions };
  }

  const amountOutMinimum = (pool.amountOut * BigInt(Math.floor((100 - slippagePct) * 100))) / 10000n;

  // Step 1 — approve Uniswap router to spend USDC
  const approveCalldata = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [UNISWAP_ROUTER, amountIn],
  });

  const approveRes = await circle.createContractExecutionTransaction({
    walletId,
    contractAddress: USDC_BASE_SEPOLIA,
    callData: approveCalldata,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  } as unknown as Parameters<typeof circle.createContractExecutionTransaction>[0]);

  const approveTxId = approveRes.data?.id;
  if (!approveTxId) throw new Error("USDC approve transaction failed — no tx returned");

  // Step 2 — swap via Uniswap exactInputSingle
  const swapCalldata = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: USDC_BASE_SEPOLIA as `0x${string}`,
        tokenOut: tokenOut as `0x${string}`,
        fee: pool.feeTier,
        recipient: walletAddress as `0x${string}`,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: 0n,
      },
    ],
  });

  const swapRes = await circle.createContractExecutionTransaction({
    walletId,
    contractAddress: UNISWAP_ROUTER,
    callData: swapCalldata,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  } as unknown as Parameters<typeof circle.createContractExecutionTransaction>[0]);

  const swapTxId = swapRes.data?.id;
  if (!swapTxId) throw new Error("Uniswap swap transaction failed — no tx returned");

  return { success: true, approveTxId, swapTxId, tokenOut, quotedAmount: pool.amountOut, feeTier: pool.feeTier };
}
