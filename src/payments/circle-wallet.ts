import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";

const USDC_BASE_SEPOLIA = process.env.USDC_BASE_SEPOLIA_ADDRESS ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

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
    blockchains: ["BASE-SEPOLIA"],
    count: 1,
    accountType: "EOA",
    metadata: [{ name: `VaultMind-${userId}`, refId: userId }],
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
    tokenAddress: USDC_BASE_SEPOLIA,
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
