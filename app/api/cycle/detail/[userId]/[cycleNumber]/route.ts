import { NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string; cycleNumber: string }> },
) {
  try {
    const { userId, cycleNumber } = await params;
    const prisma = getPrisma();

    const cycle = await prisma.cycle.findFirst({
      where: { userId, cycleNumber: Number(cycleNumber) },
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

    // Fallback: many existing rows have cycle_id = null. Correlate by
    // user + time window around the cycle's created_at.
    if (actions.length === 0) {
      const cycleTime = new Date(cycle.createdAt);
      const windowStart = new Date(cycleTime.getTime() - 120_000); // -2 min
      const windowEnd = new Date(cycleTime.getTime() + 30_000);    // +30s
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
