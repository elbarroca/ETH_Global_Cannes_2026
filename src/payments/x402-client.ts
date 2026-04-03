import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { createWalletClient, createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import type { Account } from "viem";

const NETWORK = "eip155:84532" as const;

export function createPaymentFetch(viemAccount: Account): typeof fetch {
  const walletClient = createWalletClient({
    account: viemAccount,
    chain: baseSepolia,
    transport: http(),
  });

  const publicClient = createPublicClient({
    chain: baseSepolia,
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
