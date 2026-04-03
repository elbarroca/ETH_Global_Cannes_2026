import { NextResponse } from "next/server";

const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

export async function GET() {
  const tokenId = process.env.HTS_FUND_TOKEN_ID;

  // Fund info from HTS token (if configured)
  let tokenInfo = null;
  if (tokenId) {
    try {
      const res = await fetch(`${MIRROR_BASE}/tokens/${tokenId}`, {
        next: { revalidate: 30 },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          name: string;
          symbol: string;
          decimals: string;
          total_supply: string;
          token_id: string;
        };
        tokenInfo = {
          name: data.name,
          symbol: data.symbol,
          decimals: Number(data.decimals),
          totalSupply: data.total_supply,
          tokenId: data.token_id,
        };
      }
    } catch {
      // Token query failed -- non-fatal
    }
  }

  // Cycle count from HCS topic
  const topicId = process.env.HCS_AUDIT_TOPIC_ID;
  let cyclesRun = 0;
  if (topicId) {
    try {
      const res = await fetch(
        `${MIRROR_BASE}/topics/${topicId}/messages?limit=1&order=desc`,
        { next: { revalidate: 15 } },
      );
      if (res.ok) {
        const data = (await res.json()) as { messages: Array<{ sequence_number: number }> };
        cyclesRun = data.messages?.[0]?.sequence_number ?? 0;
      }
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json({
    token: tokenInfo,
    stats: {
      cyclesRun,
      topicId: topicId ?? null,
      tokenId: tokenId ?? null,
    },
  });
}
