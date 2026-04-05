import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import crypto from "node:crypto";
import { getStorageIndexerUrl } from "../config/og-storage";
import { getOgWallet } from "../config/og-compute";
import { getHistoryForUser } from "../hedera/hcs";
import type { RichCycleRecord } from "../types/index";

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

/**
 * Bundle returned by loadRecentCycles — full rich records paired with their
 * HCS storage-hash pointers so callers can persist the CIDs on the new cycle
 * (`RichCycleRecord.priorCids`) as verifiable proof of what memory was loaded.
 */
export interface RecentCyclesBundle {
  cycles: RichCycleRecord[];
  cids: string[];
}

/**
 * Load the most recent `limit` committed cycles for a user as full RichCycleRecord
 * blobs from 0G Storage. Closes the write→read loop that makes 0G Storage usable
 * as evolving agent memory (RAG context), rather than just a write-only audit sink.
 *
 * Flow:
 *   1. Ask HCS for the user's last N CompactCycleRecords (each carries an `sh`
 *      field = 0G rootHash of the RichCycleRecord).
 *   2. Download each rich record via loadMemory() in parallel (Promise.allSettled
 *      — a single missing blob must not sink the cycle).
 *   3. Unwrap the storeMemory envelope ({ userId, data, storedAt }) → return `data`.
 *
 * Non-fatal — returns `{ cycles: [], cids: [] }` on any error so cycles proceed
 * even when HCS or 0G is unreachable. Absence of memory degrades gracefully
 * to "no prior context".
 */
export async function loadRecentCycles(
  userId: string,
  limit = 3,
): Promise<RecentCyclesBundle> {
  const topicId = process.env.HCS_AUDIT_TOPIC_ID;
  if (!topicId) {
    console.warn("[0G storage] loadRecentCycles skipped: HCS_AUDIT_TOPIC_ID not set");
    return { cycles: [], cids: [] };
  }

  try {
    // Overfetch 3x so we can tolerate cycles missing `sh` (e.g. 0G upload
    // failure on some prior cycle) and still return `limit` populated records.
    const history = await getHistoryForUser(topicId, userId, limit * 3);
    const withCids = history.filter((r): r is typeof r & { sh: string } => typeof r.sh === "string" && r.sh.length > 0);
    if (withCids.length === 0) {
      console.log(`[0G storage] loadRecentCycles: no prior cycles with storage CIDs for user ${userId}`);
      return { cycles: [], cids: [] };
    }

    const top = withCids.slice(0, limit);
    const results = await Promise.allSettled(top.map((c) => loadMemory(c.sh)));

    const loaded: RichCycleRecord[] = [];
    const loadedCids: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status !== "fulfilled") {
        console.warn(
          `[0G storage] loadRecentCycles: failed to load cid=${top[i].sh.slice(0, 16)}…:`,
          r.reason instanceof Error ? r.reason.message : String(r.reason),
        );
        continue;
      }
      const raw = r.value as { data?: unknown } | null;
      // storeMemory wraps the payload as { userId, data, storedAt }. Unwrap
      // defensively — older blobs may have been stored without the envelope.
      const payload = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as RichCycleRecord | null;
      if (payload && typeof payload === "object" && "cycleId" in payload) {
        loaded.push(payload);
        loadedCids.push(top[i].sh);
      }
    }

    // Sort descending by timestamp so the most recent cycle is first in the
    // prompt context (7B models pay more attention to the first line). Keep
    // cids parallel to cycles after the sort.
    const paired = loaded.map((c, i) => ({ cycle: c, cid: loadedCids[i] }));
    paired.sort((a, b) => (b.cycle.timestamp > a.cycle.timestamp ? 1 : -1));
    const sortedCycles = paired.map((p) => p.cycle);
    const sortedCids = paired.map((p) => p.cid);

    console.log(`[0G storage] loadRecentCycles: loaded ${sortedCycles.length}/${top.length} prior cycles for user ${userId}`);
    return { cycles: sortedCycles, cids: sortedCids };
  } catch (err) {
    console.warn(
      "[0G storage] loadRecentCycles failed (non-fatal):",
      err instanceof Error ? err.message : String(err),
    );
    return { cycles: [], cids: [] };
  }
}
