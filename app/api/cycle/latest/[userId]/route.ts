import { NextResponse } from "next/server";
import { getUserById } from "@/src/store/user-store";
import { getPrisma } from "@/src/config/prisma";
import { enrichCycleRow } from "@/src/store/enrich-cycle";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const prisma = getPrisma();
    const cycle = await prisma.cycle.findFirst({
      where: { userId: user.id },
      orderBy: { cycleNumber: "desc" },
    });
    if (!cycle) {
      return NextResponse.json(null);
    }

    const enriched = await enrichCycleRow(cycle);
    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
