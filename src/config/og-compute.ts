import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";

const OG_RPC_URL = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";

// The sole inference provider for ALL agents — 0G Compute Network
export const OG_PROVIDER = process.env.OG_PROVIDER_ADDRESS!;

let ogProviderInstance: ethers.JsonRpcProvider | null = null;
let ogWalletInstance: ethers.Wallet | null = null;
let brokerInstance: Awaited<ReturnType<typeof createZGComputeNetworkBroker>> | null = null;
let autoFundingStarted = false;

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

    // Start auto-funding to prevent mid-cycle balance failures
    if (!autoFundingStarted && OG_PROVIDER) {
      try {
        await brokerInstance.inference.startAutoFunding(OG_PROVIDER);
        autoFundingStarted = true;
        console.log("[0G] Auto-funding started for provider:", OG_PROVIDER);
      } catch (err) {
        console.warn("[0G] Auto-funding failed (non-fatal):", err instanceof Error ? err.message : String(err));
      }
    }
  }
  return brokerInstance;
}
