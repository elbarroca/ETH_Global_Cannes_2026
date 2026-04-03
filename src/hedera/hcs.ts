import {
  TopicMessageSubmitTransaction,
  TopicId,
} from "@hashgraph/sdk";
import { getHederaClient, getOperatorKey } from "../config/hedera.js";
import type { CompactCycleRecord } from "../types/index.js";

const HASHSCAN_BASE = "https://hashscan.io/testnet/topic";
const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";
const MAX_PAYLOAD_BYTES = 1024;

export async function logCycle(
  topicId: string,
  record: CompactCycleRecord,
): Promise<{ seqNum: number; hashscanUrl: string }> {
  const payload = JSON.stringify(record);
  const payloadBytes = Buffer.byteLength(payload, "utf8");
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    throw new Error(`HCS payload too large: ${payloadBytes} bytes (max ${MAX_PAYLOAD_BYTES})`);
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

    return {
      seqNum,
      hashscanUrl: `${HASHSCAN_BASE}/${topicId}`,
    };
  } catch (err) {
    throw new Error(`HCS logCycle failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function getHistory(
  topicId: string,
  limit = 25,
): Promise<CompactCycleRecord[]> {
  // 6-second delay for mirror node propagation
  await new Promise((r) => setTimeout(r, 6000));

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
