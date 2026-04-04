import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import type { Account } from "viem";

const arcTestnet = defineChain({
  id: 2655,
  name: "Arc Testnet",
  nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  testnet: true,
});

const NETWORK = "eip155:2655" as const;

export function createPaymentFetch(viemAccount: Account): typeof fetch {
  const walletClient = createWalletClient({
    account: viemAccount,
    chain: arcTestnet,
    transport: http(),
  });

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });

  // Build ClientEvmSigner manually to satisfy the type
  const signer = {
    address: viemAccount.address,
    signTypedData: (msg: Parameters<typeof walletClient.signTypedData>[0]) =>
      walletClient.signTypedData(msg),
    readContract: (args: Parameters<typeof publicClient.readContract>[0]) =>
      publicClient.readContract(args),
  };

  const client = new x402Client().register(NETWORK, new ExactEvmScheme(signer));

  return wrapFetchWithPayment(fetch, client) as typeof fetch;
}
