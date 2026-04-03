import { type NextRequest, NextResponse } from "next/server";

const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

interface MirrorMessage {
  message: string;
  sequence_number: number;
  consensus_timestamp: string;
}

export async function GET(request: NextRequest) {
  const topicId = process.env.HCS_AUDIT_TOPIC_ID;
  if (!topicId) {
    return NextResponse.json({ error: "HCS_AUDIT_TOPIC_ID not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const raw = Number(searchParams.get("limit") ?? "25");
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 100) : 25;

  try {
    const res = await fetch(
      `${MIRROR_BASE}/topics/${topicId}/messages?limit=${limit}&order=desc`,
      { next: { revalidate: 15 } },
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Mirror node returned ${res.status}` }, { status: 502 });
    }

    const data = (await res.json()) as { messages: MirrorMessage[] };

    const cycles = (data.messages ?? [])
      .map((msg) => {
        try {
          const decoded = Buffer.from(msg.message, "base64").toString("utf-8");
          const cycle = JSON.parse(decoded);
          return {
            cycle,
            sequenceNumber: msg.sequence_number,
            consensusTimestamp: msg.consensus_timestamp,
            hashscanUrl: `https://hashscan.io/testnet/topic/${topicId}/message/${msg.sequence_number}`,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return NextResponse.json({ cycles, total: cycles.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
