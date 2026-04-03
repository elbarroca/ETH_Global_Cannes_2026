import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";

const OG_RPC_URL = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";

let ogProviderInstance: ethers.JsonRpcProvider | null = null;
let ogWalletInstance: ethers.Wallet | null = null;
let brokerInstance: Awaited<ReturnType<typeof createZGComputeNetworkBroker>> | null = null;

function getPrivateKey(): string {
  const raw = process.env.OG_PRIVATE_KEY!;
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

export function getOgProvider(): ethers.JsonRpcProvider {
  if (!ogProviderInstance) {
    ogProviderInstance = new ethers.JsonRpcProvider(OG_RPC_URL);
  }
  return ogProviderInstance;
}

export function getOgWallet(): ethers.Wallet {
  if (!ogWalletInstance) {
    ogWalletInstance = new ethers.Wallet(getPrivateKey(), getOgProvider());
  }
  return ogWalletInstance;
}

export async function getBroker(): Promise<Awaited<ReturnType<typeof createZGComputeNetworkBroker>>> {
  if (!brokerInstance) {
    brokerInstance = await createZGComputeNetworkBroker(getOgWallet());
  }
  return brokerInstance;
}
