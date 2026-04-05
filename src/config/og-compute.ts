import { ethers } from "ethers";
import { createRequire } from "node:module";

// Force CJS resolution — the ESM build of @0glabs/0g-serving-broker is broken
// (lib.esm/index.mjs references exports that don't exist in the bundled chunk)
const require = createRequire(import.meta.url);
const ogBrokerModule = require("@0glabs/0g-serving-broker");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OGBroker = any;

const OG_RPC_URL = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";

// The sole inference provider for ALL agents — 0G Compute Network
export const OG_PROVIDER = process.env.OG_PROVIDER_ADDRESS!;

let ogProviderInstance: ethers.JsonRpcProvider | null = null;
let ogWalletInstance: ethers.Wallet | null = null;
let brokerInstance: OGBroker | null = null;
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

export async function getBroker(): Promise<OGBroker> {
  if (!brokerInstance) {
    brokerInstance = await ogBrokerModule.createZGComputeNetworkBroker(getOgWallet());

    // Start auto-funding to prevent mid-cycle balance failures.
    // Gated behind ENABLE_BACKGROUND_WORKERS because startAutoFunding spawns an
    // internal setInterval that would orphan on Vercel serverless (stateless
    // lambdas). On the local backend process this is safe and desirable.
    if (
      !autoFundingStarted &&
      OG_PROVIDER &&
      process.env.ENABLE_BACKGROUND_WORKERS === "true"
    ) {
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
