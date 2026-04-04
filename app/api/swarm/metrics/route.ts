import { NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";

export const revalidate = 15;

// Aggregate counters for the SwarmStatusBar metric chips.
//
// Two windows:
//   last24h — drives the chips on the dashboard (rolling 24h of activity)
//   allTime — drives the "since launch" tooltip
//
// Data source: agent_actions (1,464 rows as of writing) + cycles (115 rows).
// Payment totals are computed by summing the text `payment_amount` column
// (stored as dollar strings like "0.001") — we use Prisma raw aggregates for
// the sum so we avoid pulling every row client-side.

export async function GET(): Promise<NextResponse> {
  const prisma = getPrisma();

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      last24hCycles,
      last24hHires,
      last24hDebateTurns,
      last24hTee,
      last24hPayment,
      allTimeCycles,
      allTimeSpecialistCalls,
      allTimePayment,
    ] = await Promise.all([
      prisma.agentAction.count({
        where: { actionType: "CYCLE_COMPLETED", createdAt: { gte: since } },
      }),
      prisma.agentAction.count({
        where: { actionType: "SPECIALIST_HIRED", createdAt: { gte: since } },
      }),
      prisma.agentAction.count({
        where: {
          actionType: { in: ["DEBATE_ALPHA", "DEBATE_RISK", "DEBATE_EXECUTOR"] },
          createdAt: { gte: since },
        },
      }),
      prisma.agentAction.count({
        where: { teeVerified: true, createdAt: { gte: since } },
      }),
      // payment_amount is stored as a text column with a leading "$" prefix
      // (e.g. "$0.001"), so we have to strip the prefix before casting.
      prisma.$queryRaw<Array<{ total: number | null }>>`
        SELECT COALESCE(SUM(CAST(REPLACE(payment_amount, '$', '') AS double precision)), 0) AS total
        FROM agent_actions
        WHERE payment_tx_hash IS NOT NULL
          AND created_at >= ${since}
      `,
      prisma.cycle.count(),
      prisma.agentAction.count({ where: { actionType: "SPECIALIST_HIRED" } }),
      prisma.$queryRaw<Array<{ total: number | null }>>`
        SELECT COALESCE(SUM(CAST(REPLACE(payment_amount, '$', '') AS double precision)), 0) AS total
        FROM agent_actions
        WHERE payment_tx_hash IS NOT NULL
      `,
    ]);

    return NextResponse.json({
      last24h: {
        cycles: last24hCycles,
        hires: last24hHires,
        debateTurns: last24hDebateTurns,
        teeAttestations: last24hTee,
        paymentsUsd: Number(last24hPayment[0]?.total ?? 0),
      },
      allTime: {
        cycles: allTimeCycles,
        specialistCalls: allTimeSpecialistCalls,
        totalUsdSpent: Number(allTimePayment[0]?.total ?? 0),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/swarm/metrics] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch swarm metrics" },
      { status: 500 },
    );
  }
}
