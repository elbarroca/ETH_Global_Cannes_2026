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

    const actions = await prisma.agentAction.findMany({
      where: { cycleId: cycle.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ cycle, actions });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
