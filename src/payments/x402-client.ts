import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { registerBatchScheme, GatewayClient } from "@circle-fin/x402-batching/client";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

// ── Payment fetch (wraps fetch with Circle Gateway nanopayments) ──────

export function createPaymentFetch(privateKey: Hex): typeof fetch {
  const account = privateKeyToAccount(privateKey);

  const signer = {
    address: account.address,
    signTypedData: (params: Parameters<typeof account.signTypedData>[0]) =>
      account.signTypedData(params),
  };

  const client = new x402Client();
  registerBatchScheme(client, { signer });

  return wrapFetchWithPayment(fetch, client) as typeof fetch;
}

// ── Gateway client (for deposit/withdraw/balance management) ──────────

export function createGatewayClient(privateKey: Hex): GatewayClient {
  return new GatewayClient({
    chain: "arcTestnet",
    privateKey,
  });
}
