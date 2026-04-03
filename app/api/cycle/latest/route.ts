import { NextResponse } from "next/server";

const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

export async function GET() {
  const topicId = process.env.HCS_AUDIT_TOPIC_ID;
  if (!topicId) {
    return NextResponse.json({ error: "HCS_AUDIT_TOPIC_ID not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `${MIRROR_BASE}/topics/${topicId}/messages?limit=1&order=desc`,
      { next: { revalidate: 10 } },
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Mirror node returned ${res.status}` }, { status: 502 });
    }

    const data = (await res.json()) as { messages: Array<{ message: string; sequence_number: number; consensus_timestamp: string }> };

    if (!data.messages?.length) {
      return NextResponse.json({ cycle: null });
    }

    const msg = data.messages[0];
    const decoded = Buffer.from(msg.message, "base64").toString("utf-8");

    try {
      const cycle = JSON.parse(decoded);
      return NextResponse.json({
        cycle,
        sequenceNumber: msg.sequence_number,
        consensusTimestamp: msg.consensus_timestamp,
        hashscanUrl: `https://hashscan.io/testnet/topic/${topicId}/message/${msg.sequence_number}`,
      });
    } catch {
      return NextResponse.json({ cycle: null });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
