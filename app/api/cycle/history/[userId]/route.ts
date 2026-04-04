import { type NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/src/store/user-store";
import { getPrisma } from "@/src/config/prisma";
import { enrichCycleRow } from "@/src/store/enrich-cycle";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 10), 100);
    const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

    const prisma = getPrisma();
    const cycles = await prisma.cycle.findMany({
      where: { userId: user.id },
      orderBy: { cycleNumber: "desc" },
      take: limit,
      skip: offset,
    });

    const enriched = await Promise.all(cycles.map((c) => enrichCycleRow(c)));
    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
