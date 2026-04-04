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

    const agent = await prisma.marketplaceAgent.findUnique({ where: { name: agentName } });
    if (!agent) {
      return NextResponse.json({ error: `Agent "${agentName}" not found` }, { status: 404 });
    }

    // Soft-delete: set active = false
    await prisma.userHiredAgent.updateMany({
      where: { userId, agentId: agent.id },
      data: { active: false },
    });

    try {
      await logAction({
        userId,
        actionType: "AGENT_FIRED",
        agentName: agent.name,
        payload: { agentId: agent.id },
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({ success: true, agentName: agent.name });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
