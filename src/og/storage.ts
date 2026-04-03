import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import crypto from "node:crypto";
import { getStorageIndexerUrl } from "../config/og-storage.js";
import { getOgWallet } from "../config/og-compute.js";

function getRpcUrl(): string {
  return process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
}

function getIndexer(): Indexer {
  return new Indexer(getStorageIndexerUrl());
}

export async function storeMemory(
  userId: string,
  data: unknown,
): Promise<string> {
  const payload = JSON.stringify({
    userId,
    data,
    storedAt: new Date().toISOString(),
  });

  const buffer = Buffer.from(payload, "utf8");
  const file = new MemData(buffer);
  const indexer = getIndexer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ethers ESM/CJS mismatch in 0G SDK
  const signer = getOgWallet() as any;

  const [result, uploadErr] = await indexer.upload(file, getRpcUrl(), signer);

  if (uploadErr) {
    throw new Error(`0G storeMemory failed: ${uploadErr.message}`);
  }

  // Single-file upload returns { txHash, rootHash }
  const rootHash = "rootHash" in result ? result.rootHash : result.rootHashes?.[0];
  if (!rootHash) {
    throw new Error("0G storeMemory failed: upload returned no rootHash");
  }

  console.log(`[0G storage] Stored memory for user ${userId}: rootHash=${rootHash}`);
  return rootHash;
}

export async function loadMemory(rootHash: string): Promise<unknown> {
  const indexer = getIndexer();
  const tmpPath = join(tmpdir(), `0g-${crypto.randomUUID()}.json`);

  try {
    const err = await indexer.download(rootHash, tmpPath, false);
    if (err) {
      throw new Error(`0G download error: ${err.message}`);
    }

    const raw = await readFile(tmpPath, "utf8");
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error("0G loadMemory: downloaded data is not valid JSON");
    }
  } catch (err) {
    throw new Error(`0G loadMemory failed: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    try {
      await unlink(tmpPath);
    } catch {
      // Temp file cleanup — non-fatal
    }
  }
}
