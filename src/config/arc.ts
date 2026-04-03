import { privateKeyToAccount } from "viem/accounts";
import type { Account } from "viem";

export function getSystemBuyerAccount(): Account {
  const key = process.env.AGENT_EVM_PRIVATE_KEY;
  if (!key) throw new Error("AGENT_EVM_PRIVATE_KEY not set in .env");
  return privateKeyToAccount(key as `0x${string}`);
}
