import { getFlowContract } from "@0gfoundation/0g-ts-sdk";
import { getOgWallet } from "./og-compute";

let flowInstance: ReturnType<typeof getFlowContract> | null = null;

export function getFlow(): ReturnType<typeof getFlowContract> {
  if (!flowInstance) {
    const addr = process.env.OG_FLOW_CONTRACT ?? "0xbD2C3F0E65eDF5582141C35969d66e34e1F27A7C";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ethers v5/v6 mismatch in 0G SDK
    flowInstance = getFlowContract(addr, getOgWallet() as any);
  }
  return flowInstance;
}

export function getStorageIndexerUrl(): string {
  const url = process.env.OG_STORAGE_INDEXER;
  if (!url) throw new Error("OG_STORAGE_INDEXER not set in .env");
  return url;
}
