import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";
import { logAction } from "@/src/store/action-logger";

export async function POST(req: NextRequest) {
  try {
    const { userId, agentName } = (await req.json()) as {
      userId?: string;
      agentName?: string;
    };

    if (!userId || !agentName) {
      return NextResponse.json({ error: "userId and agentName are required" }, { status: 400 });
    }

    const prisma = getPrisma();

    // Find the marketplace agent
    const agent = await prisma.marketplaceAgent.findUnique({ where: { name: agentName } });
    if (!agent) {
      return NextResponse.json({ error: `Agent "${agentName}" not found` }, { status: 404 });
    }

    // Upsert — re-activate if previously fired
    const hired = await prisma.userHiredAgent.upsert({
      where: { userId_agentId: { userId, agentId: agent.id } },
      update: { active: true, hiredAt: new Date() },
      create: { userId, agentId: agent.id },
      include: { agent: true },
    });

    try {
      await logAction({
        userId,
        actionType: "AGENT_HIRED",
        agentName: agent.name,
        payload: { agentId: agent.id, price: agent.price },
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({
      id: hired.id,
      agentName: agent.name,
      agentId: agent.id,
      hiredAt: hired.hiredAt,
      tags: agent.tags,
      price: agent.price,
      reputation: agent.reputation,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
