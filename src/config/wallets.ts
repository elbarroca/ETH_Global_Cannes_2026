import { mnemonicToAccount } from "viem/accounts";
import type { HDAccount } from "viem/accounts";

// BIP-44 derivation from a single master mnemonic:
//   Users:       m/44'/60'/0'/0/{userIndex}   (accountIndex 0)
//   Specialists: m/44'/60'/1'/0/{specIndex}    (accountIndex 1)

function getMasterMnemonic(): string {
  const seed = process.env.AGENT_MNEMONIC;
  if (!seed) throw new Error("AGENT_MNEMONIC not set in .env");
  return seed;
}

// ── Per-user hot wallet (signs x402 payments) ──────────────────────

export function deriveUserAccount(userIndex: number): HDAccount {
  return mnemonicToAccount(getMasterMnemonic(), {
    accountIndex: 0,
    addressIndex: userIndex,
  });
}

export function deriveUserAddress(userIndex: number): string {
  return deriveUserAccount(userIndex).address;
}

// ── Per-specialist wallet (receives x402 payTo) ────────────────────

export function deriveSpecialistAccount(specIndex: number): HDAccount {
  return mnemonicToAccount(getMasterMnemonic(), {
    accountIndex: 1,
    addressIndex: specIndex,
  });
}

export function deriveSpecialistAddress(specIndex: number): string {
  return deriveSpecialistAccount(specIndex).address;
}
