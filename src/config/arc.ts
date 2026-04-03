import { mnemonicToAccount } from "viem/accounts";

// BIP-44 derivation: index 0 = main agent (buyer/signer)
// Read env at call time, not module load — avoids crash if AGENT_MNEMONIC is unset
export function getBuyerAccount() {
  const mnemonic = process.env.AGENT_MNEMONIC;
  if (!mnemonic) throw new Error("AGENT_MNEMONIC not set");
  return mnemonicToAccount(mnemonic, { addressIndex: 0 });
}
