import { NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string; cycleNumber: string }> },
) {
  try {
    const { userId, cycleNumber } = await params;
    const prisma = getPrisma();
    const cycleNum = Number(cycleNumber);

    const cycle = await prisma.cycle.findFirst({
      where: { userId, cycleNumber: cycleNum },
    });

    if (!cycle) {
      return NextResponse.json(
        { error: "Cycle not found" },
        { status: 404 },
      );
    }

    // Try direct cycle_id match first
    let actions = await prisma.agentAction.findMany({
      where: { cycleId: cycle.id },
      orderBy: { createdAt: "asc" },
    });

    // Fallback: most rows still have cycle_id = null because logAction is
    // called before the Cycle row exists (CYCLE_STARTED fires at the start
    // of analyzeCycle, the Cycle row is created near the end of commitCycle).
    // Correlate by anchoring on the CYCLE_STARTED row for this cycleNumber
    // and picking everything between that timestamp and the cycle's
    // committed createdAt (+ a small tail for HCS/iNFT/HUNT_COMPLETE).
    //
    // Previous implementation used a hard-coded ±2 min window, which left
    // SPECIALIST_HIRED / DEBATE_ALPHA off the dashboard pipeline arrows
    // because cycles now routinely take 5+ minutes.
    if (actions.length === 0) {
      const started = await prisma.agentAction.findFirst({
        where: {
          userId,
          actionType: "CYCLE_STARTED",
          payload: { path: ["cycleNumber"], equals: cycleNum },
        },
        orderBy: { createdAt: "desc" },
      });
      const cycleTime = new Date(cycle.createdAt);
      // Anchor at CYCLE_STARTED when we have it; otherwise fall back to a
      // generous 15-minute lookback so the full cycle is captured.
      const windowStart = started
        ? started.createdAt
        : new Date(cycleTime.getTime() - 15 * 60_000);
      const windowEnd = new Date(cycleTime.getTime() + 60_000); // +60s tail for late background writes
      actions = await prisma.agentAction.findMany({
        where: {
          userId,
          createdAt: { gte: windowStart, lte: windowEnd },
        },
        orderBy: { createdAt: "asc" },
      });
    }

    return NextResponse.json({ cycle, actions });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
