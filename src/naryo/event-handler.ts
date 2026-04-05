import { getPrisma } from "../config/prisma";
import { logAction } from "../store/action-logger";
import { emitCrossChainEvent } from "./emit-event";
import type { Prisma } from "@prisma/client";

// ── Types ────────────────────────────────────────────────────────────

export interface NaryoEventPayload {
  id?: string;
  type?: string; // "CONTRACT_EVENT" | "TRANSACTION"
  details?: Record<string, unknown>;
  transactionHash?: string;
  blockNumber?: number;
  status?: string; // "CONFIRMED" | "UNCONFIRMED" | "INVALIDATED"
  [key: string]: unknown;
}

type NaryoSource =
  | "hcs"
  | "hts"
  | "cycle"
  | "deposit"
  | "og-mint"
  | "og-metadata"
  // Exhaustive Hedera EVM coverage — matches Naryo filters in naryo/application.yml
  | "specialist"
  | "heartbeat"
  | "cross-chain";

const SOURCE_TO_CHAIN: Record<NaryoSource, string> = {
  hcs: "hedera",
  hts: "hedera",
  cycle: "hedera",
  deposit: "hedera",
  "og-mint": "0g-chain",
  "og-metadata": "0g-chain",
  specialist: "hedera",
  heartbeat: "hedera",
  // cross-chain proofs live on Hedera EVM but carry the source chain in the
  // event payload — we tag them "hedera" here because that's where Naryo
  // captured the log. The dashboard feed widget shows the embedded sourceChain.
  "cross-chain": "hedera",
};

const SOURCE_TO_ACTION: Record<NaryoSource, string> = {
  hcs: "NARYO_HCS_EVENT",
  hts: "NARYO_HTS_EVENT",
  cycle: "NARYO_CYCLE_EVENT",
  deposit: "NARYO_DEPOSIT_EVENT",
  "og-mint": "NARYO_OG_EVENT",
  "og-metadata": "NARYO_OG_EVENT",
  specialist: "NARYO_SPECIALIST_EVENT",
  heartbeat: "NARYO_HEARTBEAT_EVENT",
  "cross-chain": "NARYO_CROSS_CHAIN_EVENT",
};

// In-memory buffer for dashboard feed
const EVENT_BUFFER_SIZE = 50;
const eventBuffer: Array<{
  id: string;
  source: string;
  chain: string;
  eventType: string;
  txHash: string | null;
  data: unknown;
  createdAt: string;
}> = [];

export function getRecentEvents() {
  return [...eventBuffer];
}

// ── Process incoming Naryo event ─────────────────────────────────────

export async function processNaryoEvent(
  payload: NaryoEventPayload,
  source: string,
): Promise<string> {
  const naryoSource = source as NaryoSource;
  const chain = SOURCE_TO_CHAIN[naryoSource] ?? "unknown";
  const eventType = payload.type ?? "UNKNOWN";
  const txHash = payload.transactionHash ?? null;

  console.log(`[naryo] Event received: source=${source} chain=${chain} type=${eventType} tx=${txHash ?? "n/a"}`);

  // 1. Store in Supabase
  const prisma = getPrisma();
  const record = await prisma.naryoEvent.create({
    data: {
      source,
      chain,
      eventType,
      txHash,
      decodedData: (payload.details ?? null) as Prisma.InputJsonValue,
      rawPayload: payload as Prisma.InputJsonValue,
    },
  });

  // 2. Log as agent action (for unified activity feed)
  const actionType = SOURCE_TO_ACTION[naryoSource] ?? "NARYO_HCS_EVENT";
  try {
    await logAction({
      userId: "system",
      actionType: actionType as Parameters<typeof logAction>[0]["actionType"],
      payload: {
        naryoEventId: record.id,
        source,
        chain,
        txHash,
      } as Prisma.InputJsonValue,
    });
  } catch {
    // Non-fatal — action logger may not have the new types yet
  }

  // 3. Add to in-memory buffer for dashboard
  eventBuffer.unshift({
    id: record.id,
    source,
    chain,
    eventType,
    txHash,
    data: payload.details ?? payload,
    createdAt: new Date().toISOString(),
  });
  if (eventBuffer.length > EVENT_BUFFER_SIZE) {
    eventBuffer.pop();
  }

  // 4. Attempt cross-chain correlation
  await attemptCorrelation(record.id, chain).catch((err) => {
    console.warn("[naryo] Correlation check failed (non-fatal):", err instanceof Error ? err.message : String(err));
  });

  return record.id;
}

// ── Cross-chain correlation ──────────────────────────────────────────

async function attemptCorrelation(eventId: string, eventChain: string): Promise<void> {
  const prisma = getPrisma();
  const WINDOW_MS = 60_000; // 60-second correlation window
  const cutoff = new Date(Date.now() - WINDOW_MS);

  // Find recent events from the OTHER chain
  const otherChain = eventChain === "hedera" ? "0g-chain" : "hedera";
  const otherEvents = await prisma.naryoEvent.findMany({
    where: {
      chain: otherChain,
      correlationId: null,
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (otherEvents.length === 0) return;

  // Create correlation record
  const otherEvent = otherEvents[0];
  const correlation = await prisma.naryoCorrelation.create({
    data: {
      description: `Cross-chain: ${eventChain} + ${otherChain} event within ${WINDOW_MS / 1000}s`,
      chains: [eventChain, otherChain],
    },
  });

  // Link both events to the correlation
  await prisma.naryoEvent.updateMany({
    where: { id: { in: [eventId, otherEvent.id] } },
    data: { correlationId: correlation.id },
  });

  console.log(`[naryo] Cross-chain correlation detected: ${eventChain} <> ${otherChain} (${correlation.id})`);

  // Emit on-chain proof of correlation (non-fatal)
  if (process.env.NARYO_AUDIT_CONTRACT_ADDRESS) {
    const proofTxHash = await emitCrossChainEvent(
      otherChain,
      otherEvent.eventType,
      otherEvent.txHash ?? correlation.id,
    );
    if (proofTxHash) {
      await prisma.naryoCorrelation.update({
        where: { id: correlation.id },
        data: { proofTxHash },
      });
    }
  }
}
