import {
  TopicMessageSubmitTransaction,
  TopicId,
} from "@hashgraph/sdk";
import { getHederaClient, getOperatorKey } from "../config/hedera";
import type { CompactCycleRecord, SwarmEventRecord } from "../types/index";

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
// Writes one small HCS message per swarm event (cycle start, specialist hire,
// debate turn, final decision). Unlike logCycle() this does NOT wait 6s for
// mirror node propagation — swarm events are fire-and-forget audit logs, the
// aggregate logCycle() call at end of commit is what readers actually use for
// full history reconstruction.
//
// Callers should invoke this with `.catch(console.warn)` — a failed HCS write
// must never fail a cycle.
export async function logSwarmEvent(
  topicId: string,
  event: SwarmEventRecord,
): Promise<{ seqNum: number }> {
  // Truncate cot[] entries (shortest first is nonsensical — trim longest first)
  // if the payload overflows the 1024-byte HCS limit. Only "hire" and "turn"
  // events carry cot[], so we only touch those.
  let payload = JSON.stringify(event);
  let payloadBytes = Buffer.byteLength(payload, "utf8");

  if (payloadBytes > MAX_PAYLOAD_BYTES && (event.ev === "hire" || event.ev === "turn")) {
    const withCot = event as Extract<SwarmEventRecord, { cot: string[] }>;
    const trimmed: SwarmEventRecord = {
      ...withCot,
      cot: withCot.cot.map((s) => (s.length > 80 ? s.slice(0, 77) + "..." : s)),
    };
    payload = JSON.stringify(trimmed);
    payloadBytes = Buffer.byteLength(payload, "utf8");

    // Still too big? Drop the tail cot entries until we fit.
    let cotCopy = [...(trimmed as Extract<SwarmEventRecord, { cot: string[] }>).cot];
    while (payloadBytes > MAX_PAYLOAD_BYTES && cotCopy.length > 1) {
      cotCopy = cotCopy.slice(0, cotCopy.length - 1);
      const shrunk = { ...trimmed, cot: cotCopy };
      payload = JSON.stringify(shrunk);
      payloadBytes = Buffer.byteLength(payload, "utf8");
    }
  }

  // Second fallback: if still too big, drop `verdict` entirely on turn events
  // (the cycle-decision aggregate logCycle still carries the final verdicts).
  // Keep `cot` — reasoning is the most valuable audit payload.
  if (payloadBytes > MAX_PAYLOAD_BYTES && event.ev === "turn") {
    const withoutVerdict = { ...event, verdict: { dropped: true } };
    payload = JSON.stringify(withoutVerdict);
    payloadBytes = Buffer.byteLength(payload, "utf8");
    console.warn(
      `[hcs] swarm-event ev=turn c=${event.c} t=${event.t}: verdict dropped to fit 1024-byte limit`,
    );
  }

  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    throw new Error(
      `HCS swarm event too large even after cot+verdict truncation: ${payloadBytes} bytes (ev=${event.ev})`,
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

    console.log(
      `[hcs] ✓ ev=${event.ev} c=${(event as { c?: number }).c ?? "?"} seq=${seqNum} bytes=${payloadBytes}`,
    );

    return { seqNum };
  } catch (err) {
    throw new Error(
      `HCS logSwarmEvent failed (ev=${event.ev}): ${err instanceof Error ? err.message : String(err)}`,
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
