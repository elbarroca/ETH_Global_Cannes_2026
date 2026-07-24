import { ethers } from "ethers";
import { createRequire } from "node:module";

export interface OgService {
  provider: string;
  serviceType: string;
  url: string;
  model: string;
  verifiability: string;
  additionalInfo: string;
  teeSignerAddress: string;
  teeSignerAcknowledged: boolean;
  inputPrice: bigint;
  outputPrice: bigint;
}

export interface OGBroker {
  inference: {
    listService(offset?: number, limit?: number, includeUnacknowledged?: boolean): Promise<OgService[]>;
    getServiceMetadata(providerAddress: string): Promise<{ endpoint: string; model: string }>;
    getRequestHeaders(providerAddress: string, content?: string): Promise<Record<string, string>>;
    checkProviderSignerStatus(providerAddress: string): Promise<{
      isAcknowledged: boolean;
      teeSignerAddress: string;
    }>;
    processResponse(providerAddress: string, chatId?: string, content?: string): Promise<boolean | null>;
    startAutoFunding(providerAddress: string): Promise<void>;
  };
  ledger: {
    depositFund(amount: number): Promise<void>;
    transferFund(providerAddress: string, serviceType: string, amount: bigint): Promise<void>;
  };
}

export interface OgInferenceVerifier {
  fetchSignatureByChatID(
    providerBrokerUrl: string,
    chatId: string,
    model: string,
  ): Promise<{ text: string; signature: string }>;
  verifySignature(message: string, signature: string, expectedAddress: string): boolean;
}

interface OgBrokerModule {
  createZGComputeNetworkBroker(wallet: ethers.Wallet): Promise<OGBroker>;
  InferenceVerifier: OgInferenceVerifier;
}

const OG_RPC_URL = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";

// The sole inference provider for ALL agents — 0G Compute Network
export const OG_PROVIDER = process.env.OG_PROVIDER_ADDRESS!;

let ogProviderInstance: ethers.JsonRpcProvider | null = null;
let ogWalletInstance: ethers.Wallet | null = null;
let brokerInstance: OGBroker | null = null;
let brokerModuleInstance: OgBrokerModule | null = null;
let autoFundingStarted = false;

function getBrokerModule(): OgBrokerModule {
  if (brokerModuleInstance) return brokerModuleInstance;
  // Force CJS resolution only at the live boundary. The package's ESM build is
  // broken, and disabled/fixture A3 execution must not import broker code.
  const require = createRequire(import.meta.url);
  const loaded: unknown = require("@0glabs/0g-serving-broker");
  if (!loaded || typeof loaded !== "object") throw new Error("OG_BROKER_MODULE_INVALID");
  const candidate = loaded as Partial<OgBrokerModule>;
  if (
    typeof candidate.createZGComputeNetworkBroker !== "function" ||
    !candidate.InferenceVerifier ||
    typeof candidate.InferenceVerifier.fetchSignatureByChatID !== "function" ||
    typeof candidate.InferenceVerifier.verifySignature !== "function"
  ) {
    throw new Error("OG_BROKER_MODULE_INVALID");
  }
  brokerModuleInstance = candidate as OgBrokerModule;
  return brokerModuleInstance;
}

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
    brokerInstance = await getBrokerModule().createZGComputeNetworkBroker(getOgWallet());

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

export function getInferenceVerifier(): OgInferenceVerifier {
  return getBrokerModule().InferenceVerifier;
}
