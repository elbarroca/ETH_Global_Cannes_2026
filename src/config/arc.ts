import { deriveUserAccount } from "./wallets";
import { createPaymentFetch } from "../payments/x402-client";

// Per-user x402 payment client — signs with THIS user's HD-derived hot wallet
export function getUserPaymentFetch(hotWalletIndex: number): typeof fetch {
  const account = deriveUserAccount(hotWalletIndex);
  return createPaymentFetch(account);
}

// Legacy: global buyer for fallback (index 0)
export function getBuyerAccount() {
  return deriveUserAccount(0);
}
