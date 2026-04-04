import { NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";

export const dynamic = "force-dynamic";

// Streaming "recent activity" feed for the SwarmActivityTicker sidebar widget.
// Reads the 20 most recent agent_actions rows (across all users — this is a
// system-wide ticker, the idea is judges see the whole swarm pulsing).
//
// Response rows are sorted newest-first so the UI can just prepend without
// re-sorting on every poll.

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(limitParam ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
  );

  const prisma = getPrisma();

  try {
    const rows = await prisma.agentAction.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        actionType: true,
        agentName: true,
        status: true,
        attestationHash: true,
        teeVerified: true,
        paymentAmount: true,
        paymentNetwork: true,
        paymentTxHash: true,
        durationMs: true,
        createdAt: true,
        // Payload carries context the ticker uses to describe events in plain
        // English (e.g. rating kind + before/after ELO for AGENT_RATED rows).
        payload: true,
      },
    });

    return NextResponse.json({
      rows: rows.map((r) => ({
        id: r.id,
        actionType: r.actionType,
        agentName: r.agentName,
        status: r.status,
        attestationHash: r.attestationHash,
        teeVerified: r.teeVerified,
        paymentAmount: r.paymentAmount,
        paymentNetwork: r.paymentNetwork,
        paymentTxHash: r.paymentTxHash,
        durationMs: r.durationMs,
        createdAt: r.createdAt.toISOString(),
        payload: r.payload ?? null,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/swarm/activity] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch swarm activity" },
      { status: 500 },
    );
  }
}
