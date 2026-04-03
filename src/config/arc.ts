import { mnemonicToAccount } from "viem/accounts";

const MNEMONIC = process.env.AGENT_MNEMONIC!;

// BIP-44 derivation: index 0 = main agent (buyer/signer)
export function getBuyerAccount() {
  return mnemonicToAccount(MNEMONIC, { addressIndex: 0 });
}
