import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId query param is required" }, { status: 400 });
    }

    const prisma = getPrisma();

    const hired = await prisma.userHiredAgent.findMany({
      where: { userId, active: true },
      include: { agent: true },
      orderBy: { hiredAt: "desc" },
    });

    const agents = hired.map((h) => ({
      name: h.agent.name,
      agentId: h.agent.id,
      endpoint: h.agent.endpoint,
      tags: h.agent.tags,
      price: h.agent.price,
      reputation: h.agent.reputation,
      totalHires: h.agent.totalHires,
      correctCalls: h.agent.correctCalls,
      hiredAt: h.hiredAt,
      walletAddress: h.agent.walletAddress ?? null,
    }));

    return NextResponse.json({ agents });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
