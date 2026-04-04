import {
  TopicMessageSubmitTransaction,
  TopicId,
} from "@hashgraph/sdk";
import { getHederaClient, getOperatorKey } from "../config/hedera";
import type { CompactCycleRecord, SwarmEventRecord } from "../types/index";

const HASHSCAN_BASE = "https://hashscan.io/testnet/topic";
const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

// Hedera's TopicMessageSubmitTransaction natively chunks messages at
// CHUNK_SIZE (1024 bytes) per chunk, bounded by `maxChunks` (default 20).
// The SDK handles all the splitting transparently — we just call .setMessage()
// with a string of any size up to maxChunks × CHUNK_SIZE and it issues one
// transaction per chunk with a shared initial_transaction_id.
//
// We bump maxChunks to 50 so each swarm event can carry up to ~50KB of full
// untruncated content (cot + reasoning + verdict + attestation + rawDataSnapshot).
// Mirror node returns each chunk as a separate record with `chunk_info`
// metadata; Hashscan and the validator both reassemble by initial_transaction_id.
const MAX_CHUNKS = 50;

// Legacy aggregate limit kept for buildCompactRecord only — the aggregate
// CompactCycleRecord is intentionally a single-chunk summary. Per-event
// swarm records use native chunking (above) and have no size cap.
const AGGREGATE_MAX_PAYLOAD_BYTES = 1024;

export async function logCycle(
  topicId: string,
  record: CompactCycleRecord,
): Promise<{ seqNum: number; hashscanUrl: string }> {
  const payload = JSON.stringify(record);
  const payloadBytes = Buffer.byteLength(payload, "utf8");
  if (payloadBytes > AGGREGATE_MAX_PAYLOAD_BYTES) {
    throw new Error(
      `HCS aggregate payload too large: ${payloadBytes} bytes (max ${AGGREGATE_MAX_PAYLOAD_BYTES}). ` +
      `The aggregate is deliberately single-chunk — trim via buildCompactRecord safety pass.`,
    );
  }

  try {
    const client = getHederaClient();
    const tx = await new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(payload)
      .freezeWith(client)
      .sign(getOperatorKey());

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    const seqNum = receipt.topicSequenceNumber?.toNumber() ?? 0;

    // 6-second delay for mirror node propagation (reads after this write need it)
    await new Promise((r) => setTimeout(r, 6000));

    return {
      seqNum,
      hashscanUrl: `${HASHSCAN_BASE}/${topicId}`,
    };
  } catch (err) {
    throw new Error(`HCS logCycle failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Swarm audit trail ──────────────────────────────────────────────────────
// Writes one HCS message per swarm event (cycle start, specialist hire, debate
// turn, final decision). Each message carries the FULL untruncated content
// (cot, verdict, attestation, reasoning, rawDataSnapshot) via Hedera's native
// chunking — the SDK splits large payloads into CHUNK_SIZE (1024 byte) chunks
// automatically, and mirror node clients reassemble via `chunk_info`.
//
// Unlike logCycle() this does NOT wait 6s for mirror node propagation — swarm
// events are fire-and-forget audit logs, the aggregate logCycle() call at end
// of commit is what readers use for quick single-message summaries.
//
// No truncation. No size cap (beyond maxChunks × CHUNK_SIZE = ~50KB). Callers
// should invoke this with `.catch(console.warn)` — a failed HCS write must
// never fail a cycle.
export async function logSwarmEvent(
  topicId: string,
  event: SwarmEventRecord,
): Promise<{ seqNum: number; chunks: number }> {
  const payload = JSON.stringify(event);
  const payloadBytes = Buffer.byteLength(payload, "utf8");
  const estimatedChunks = Math.ceil(payloadBytes / 1024);

  try {
    const client = getHederaClient();
    const tx = await new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(payload)
      .setMaxChunks(MAX_CHUNKS)
      .freezeWith(client)
      .sign(getOperatorKey());

    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    const seqNum = receipt.topicSequenceNumber?.toNumber() ?? 0;

    console.log(
      `[hcs] ✓ ev=${event.ev} c=${(event as { c?: number }).c ?? "?"} seq=${seqNum} bytes=${payloadBytes} chunks=${estimatedChunks}`,
    );

    return { seqNum, chunks: estimatedChunks };
  } catch (err) {
    throw new Error(
      `HCS logSwarmEvent failed (ev=${event.ev}, bytes=${payloadBytes}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function getHistory(
  topicId: string,
  limit = 25,
): Promise<CompactCycleRecord[]> {
  const url = `${MIRROR_BASE}/topics/${topicId}/messages?limit=${limit}&order=desc`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mirror node returned ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { messages: Array<{ message: string }> };
  const records: CompactCycleRecord[] = [];

  for (const msg of data.messages) {
    try {
      const decoded = Buffer.from(msg.message, "base64").toString("utf8");
      const parsed = JSON.parse(decoded) as CompactCycleRecord;
      records.push(parsed);
    } catch {
      // Skip malformed messages
    }
  }

  return records;
}

export async function getHistoryForUser(
  topicId: string,
  userId: string,
  limit = 10,
): Promise<CompactCycleRecord[]> {
  // Overfetch 3x to account for multi-user topics
  const all = await getHistory(topicId, limit * 3);
  return all.filter((r) => r.u === userId).slice(0, limit);
}
