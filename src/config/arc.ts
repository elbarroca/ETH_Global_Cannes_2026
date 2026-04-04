import { deriveUserAccount } from "./wallets";
import { createPaymentFetch, createGatewayClient } from "../payments/x402-client";
import { bytesToHex } from "viem";
import type { GatewayClient } from "@circle-fin/x402-batching/client";

export function getUserPrivateKey(hotWalletIndex: number): `0x${string}` {
  const account = deriveUserAccount(hotWalletIndex);
  const hdKey = account.getHdKey();
  if (!hdKey.privateKey) throw new Error("HD key has no private key");
  return bytesToHex(hdKey.privateKey);
}

// Per-user x402 payment fetch — signs with THIS user's HD-derived hot wallet
export function getUserPaymentFetch(hotWalletIndex: number): typeof fetch {
  const privateKey = getUserPrivateKey(hotWalletIndex);
  return createPaymentFetch(privateKey);
}

// Per-user Gateway client — for deposit/withdraw/balance
export function getUserGatewayClient(hotWalletIndex: number): GatewayClient {
  const privateKey = getUserPrivateKey(hotWalletIndex);
  return createGatewayClient(privateKey);
}

// Legacy: global buyer for fallback (index 0)
export function getBuyerAccount() {
  return deriveUserAccount(0);
}
