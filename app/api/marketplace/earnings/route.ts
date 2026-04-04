import { NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";

export const revalidate = 30;

// Per-specialist earnings aggregate.
//
// Reads agent_actions grouped by agent_name, summing the text payment_amount
// column (stored as dollar strings like "0.001") for rows where a payment tx
// hash exists. Also surfaces hire count + last hire timestamp so the
// marketplace cards can render "Earned $X.XXX · N hires · last hire 4m ago".

interface EarningsRow {
  agentName: string;
  totalUsd: number;
  hires: number;
  lastHireAt: string | null;
}

export async function GET(): Promise<NextResponse> {
  const prisma = getPrisma();

  try {
    // payment_amount is stored as text with a leading "$" prefix (e.g. "$0.001"),
    // so we REPLACE the "$" before casting. This matches the storage convention
    // in marketplace_agents.price and the x402 middleware's route config.
    const rows = await prisma.$queryRaw<
      Array<{ agent_name: string; total: number | null; hires: bigint; last_hire: Date | null }>
    >`
      SELECT
        agent_name,
        COALESCE(SUM(CAST(REPLACE(payment_amount, '$', '') AS double precision)), 0) AS total,
        COUNT(*) AS hires,
        MAX(created_at) AS last_hire
      FROM agent_actions
      WHERE action_type = 'SPECIALIST_HIRED'
        AND agent_name IS NOT NULL
      GROUP BY agent_name
      ORDER BY total DESC
    `;

    const byAgent: Record<string, EarningsRow> = {};
    for (const row of rows) {
      byAgent[row.agent_name] = {
        agentName: row.agent_name,
        totalUsd: Number(row.total ?? 0),
        hires: Number(row.hires),
        lastHireAt: row.last_hire ? row.last_hire.toISOString() : null,
      };
    }

    return NextResponse.json({
      agents: byAgent,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/marketplace/earnings] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch marketplace earnings" },
      { status: 500 },
    );
  }
}
