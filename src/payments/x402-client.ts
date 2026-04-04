import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerBatchScheme, GatewayClient } from "@circle-fin/x402-batching/client";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

// ── Payment fetch (wraps fetch with Circle Gateway nanopayments) ──────

export function createPaymentFetch(privateKey: Hex): typeof fetch {
  const account = privateKeyToAccount(privateKey);
  const client = new x402Client();

  // Pass account directly — privateKeyToAccount returns a LocalAccount
  // that satisfies BatchEvmSigner structurally (has address + signTypedData)
  registerBatchScheme(client, { signer: account });

  return wrapFetchWithPayment(fetch, client);
}

// ── Gateway client (for deposit/withdraw/balance management) ──────────

export function createGatewayClient(privateKey: Hex): GatewayClient {
  return new GatewayClient({
    chain: "arcTestnet",
    privateKey,
  });
}
