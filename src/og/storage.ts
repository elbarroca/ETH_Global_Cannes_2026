import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { getStorageIndexerUrl } from "../config/og-storage";
import { getOgWallet } from "../config/og-compute";
import { getPrisma } from "../config/prisma";
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
 * Flow (Prisma-first — reliable on a busy shared HCS topic):
 *   1. Read `storage_hash` from `cycles` for this user (optionally `cycleNumber < beforeCycleNumber`
 *      so the in-flight cycle is excluded). Overfetch so gaps still fill `limit`.
 *   2. If Prisma yields nothing, fall back to HCS Mirror `getHistoryForUser` (last N topic
 *      messages) — legacy path when DB is empty or out of sync.
 *   3. Download each rich record via loadMemory() in parallel (Promise.allSettled).
 *   4. Unwrap the storeMemory envelope ({ userId, data, storedAt }) → return `data`.
 *
 * Env (same as backend / `inspect-rag-eligibility.ts`): `OG_STORAGE_INDEXER`, `OG_PRIVATE_KEY`
 * (or compute wallet), optional `HCS_AUDIT_TOPIC_ID` for HCS fallback only.
 *
 * Non-fatal — returns `{ cycles: [], cids: [] }` on any error so cycles proceed
 * even when HCS or 0G is unreachable. Absence of memory degrades gracefully
 * to "no prior context".
 */
export async function loadRecentCycles(
  userId: string,
  limit = 3,
  /** Exclude cycles at or above this number (pass `analyzeCycle`’s `cycleId` = next cycle). */
  beforeCycleNumber?: number,
): Promise<RecentCyclesBundle> {
  const topicId = process.env.HCS_AUDIT_TOPIC_ID;

  const bundleFromRoots = async (roots: Array<{ sh: string }>, source: string): Promise<RecentCyclesBundle> => {
    const top = roots.slice(0, limit);
    if (top.length === 0) {
      return { cycles: [], cids: [] };
    }
    const results = await Promise.allSettled(top.map((c) => loadMemory(c.sh)));

    const loaded: RichCycleRecord[] = [];
    const loadedCids: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status !== "fulfilled") {
        console.warn(
          `[0G storage] loadRecentCycles (${source}): failed to load cid=${top[i].sh.slice(0, 16)}…:`,
          r.reason instanceof Error ? r.reason.message : String(r.reason),
        );
        continue;
      }
      const raw = r.value as { data?: unknown } | null;
      const payload = (raw && typeof raw === "object" && "data" in raw ? raw.data : raw) as RichCycleRecord | null;
      if (payload && typeof payload === "object" && "cycleId" in payload) {
        loaded.push(payload);
        loadedCids.push(top[i].sh);
      }
    }

    const paired = loaded.map((c, i) => ({ cycle: c, cid: loadedCids[i] }));
    paired.sort((a, b) => (b.cycle.timestamp > a.cycle.timestamp ? 1 : -1));
    const sortedCycles = paired.map((p) => p.cycle);
    const sortedCids = paired.map((p) => p.cid);

    console.log(
      `[0G storage] loadRecentCycles [${source}]: loaded ${sortedCycles.length}/${top.length} prior cycles for user ${userId}`,
    );
    return { cycles: sortedCycles, cids: sortedCids };
  };

  try {
    try {
      const prisma = getPrisma();
      const where: Prisma.CycleWhereInput = {
        userId,
        storageHash: { not: null },
      };
      if (beforeCycleNumber != null) {
        where.cycleNumber = { lt: beforeCycleNumber };
      }
      const rows = await prisma.cycle.findMany({
        where,
        orderBy: { cycleNumber: "desc" },
        take: limit * 3,
        select: { storageHash: true },
      });
      const roots = rows
        .map((r) => ({ sh: String(r.storageHash ?? "") }))
        .filter((r) => r.sh.length > 0);
      if (roots.length > 0) {
        return await bundleFromRoots(roots, "prisma");
      }
      console.log(`[0G storage] loadRecentCycles: Prisma had no storage_hash rows for user ${userId} — trying HCS fallback`);
    } catch (prismaErr) {
      console.warn(
        "[0G storage] loadRecentCycles Prisma path failed (non-fatal):",
        prismaErr instanceof Error ? prismaErr.message : String(prismaErr),
      );
    }

    if (!topicId) {
      console.warn("[0G storage] loadRecentCycles: HCS_AUDIT_TOPIC_ID not set — HCS fallback skipped");
      return { cycles: [], cids: [] };
    }

    const history = await getHistoryForUser(topicId, userId, limit * 3);
    const withCids = history.filter((r): r is typeof r & { sh: string } => typeof r.sh === "string" && r.sh.length > 0);
    if (withCids.length === 0) {
      console.log(`[0G storage] loadRecentCycles: no prior cycles with storage CIDs for user ${userId} (HCS)`);
      return { cycles: [], cids: [] };
    }

    const roots = withCids.map((c) => ({ sh: c.sh }));
    return await bundleFromRoots(roots, "hcs");
  } catch (err) {
    console.warn(
      "[0G storage] loadRecentCycles failed (non-fatal):",
      err instanceof Error ? err.message : String(err),
    );
    return { cycles: [], cids: [] };
  }
}
