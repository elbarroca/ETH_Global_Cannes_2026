import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

// Arc USDC is the chain's NATIVE currency — Circle's transfer API uses the
// `blockchain` tag (ARC-TESTNET) instead of an ERC-20 token address. Keeping
// USDC_ARC as an exported constant for any legacy call sites that need it,
// but new code should prefer the native-transfer path via `blockchain`.
export const USDC_ARC = process.env.USDC_ARC_ADDRESS ?? "0x3600000000000000000000000000000000000000";

const CIRCLE_BLOCKCHAIN = "ARC-TESTNET" as const;

// CoinGecko endpoint for price lookups
const COINGECKO_API = "https://api.coingecko.com/api/v3";
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY ?? "";

// Known token CoinGecko IDs for price lookups
const COINGECKO_IDS: Record<string, string> = {
  ETH: "ethereum",
  WETH: "ethereum",
  BTC: "bitcoin",
  USDC: "usd-coin",
};

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
  // Arc USDC is the chain's NATIVE currency, not an ERC-20. Circle's SDK
  // represents native transfers by omitting tokenAddress and passing the
  // blockchain tag instead. The docs call this the TokenAddressAndBlockchain-
  // Input variant with an empty tokenAddress.
  //
  // The SDK's TypeScript union is too strict about walletId+blockchain being
  // mutually exclusive, but the API accepts it — cast through unknown.
  const response = await circle.createTransaction({
    walletId,
    blockchain: CIRCLE_BLOCKCHAIN,
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

// ── Token price lookup via CoinGecko ─────────────────────────────────────────

export async function getTokenPrice(symbol: string): Promise<number | null> {
  const geckoId = COINGECKO_IDS[symbol.toUpperCase()];
  if (!geckoId) return null;

  try {
    const headers: Record<string, string> = { "Accept": "application/json" };
    if (COINGECKO_API_KEY) {
      headers["x-cg-demo-api-key"] = COINGECKO_API_KEY;
    }
    const res = await fetch(
      `${COINGECKO_API}/simple/price?ids=${geckoId}&vs_currencies=usd`,
      { headers },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, { usd?: number }>;
    return data[geckoId]?.usd ?? null;
  } catch {
    return null;
  }
}

// ── Available tokens for trading ─────────────────────────────────────────────

type PoolSuggestion = { symbol: string; address: string; feeTier: number; liquidityUsd: string };

export async function queryAvailableUsdcPools(): Promise<PoolSuggestion[]> {
  // On Arc testnet we simulate trades — return known supported tokens
  return [
    { symbol: "ETH", address: "native", feeTier: 0, liquidityUsd: "simulated" },
    { symbol: "WETH", address: "native", feeTier: 0, liquidityUsd: "simulated" },
    { symbol: "BTC", address: "simulated", feeTier: 0, liquidityUsd: "simulated" },
  ];
}

// ── Swap result types ────────────────────────────────────────────────────────

export type SwapResult =
  | { success: true; approveTxId: string; swapTxId: string; tokenOut: string; quotedAmount: bigint; feeTier: number }
  | { success: false; reason: "unknown_token"; requested: string }
  | { success: false; reason: "no_pool"; requested: string; suggestions: PoolSuggestion[] };

/**
 * Execute a simulated USDC → token swap on Arc Testnet.
 *
 * Since Arc testnet does not have Uniswap or a DEX deployment,
 * we simulate the trade by:
 * 1. Looking up the current token price from CoinGecko
 * 2. Calculating estimated token output
 * 3. Recording the trade decision (the actual on-chain transfer happens via Circle proxy wallet)
 *
 * The trade intent is logged to HCS and 0G for full auditability.
 *
 * @param walletId       Circle wallet ID (from createProxyWallet)
 * @param walletAddress  On-chain EOA address of that wallet
 * @param tokenSymbol    "ETH", "WETH", "BTC" etc.
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
  const symbol = tokenSymbol.toUpperCase();

  // Check if we support this token
  if (!COINGECKO_IDS[symbol]) {
    return { success: false, reason: "unknown_token", requested: tokenSymbol };
  }

  // Get current price
  const price = await getTokenPrice(symbol);
  if (!price || price <= 0) {
    // Can't get price — return available options
    const suggestions = await queryAvailableUsdcPools();
    return { success: false, reason: "no_pool", requested: tokenSymbol, suggestions };
  }

  // Calculate simulated output
  const usdcAmount = parseFloat(usdcAmountIn);
  const tokenAmount = usdcAmount / price;
  // Apply slippage
  const tokenAmountAfterSlippage = tokenAmount * (1 - slippagePct / 100);

  // Convert to bigint (18 decimals for ETH/WETH, 8 for BTC)
  const decimals = symbol === "BTC" ? 8 : 18;
  const quotedAmount = BigInt(Math.floor(tokenAmountAfterSlippage * Math.pow(10, decimals)));

  // Log the simulated trade
  console.log(`[swap] Simulated: ${usdcAmountIn} USDC → ${tokenAmountAfterSlippage.toFixed(8)} ${symbol} @ $${price.toFixed(2)}`);

  // Generate deterministic "tx IDs" for the simulated trade
  const timestamp = Date.now().toString(36);
  const approveTxId = `sim-approve-${walletId.slice(0, 8)}-${timestamp}`;
  const swapTxId = `sim-swap-${walletId.slice(0, 8)}-${timestamp}`;

  return {
    success: true,
    approveTxId,
    swapTxId,
    tokenOut: symbol,
    quotedAmount,
    feeTier: 0,
  };
}
