import { type NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  authErrorResponse,
  legacyRuntimeDisabledResponse,
} from "@/src/auth/http";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await authenticateRequest(request, { requireUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.auth.principal.userId;
    if (!userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const body = (await request.json()) as { userId?: unknown; agentName?: unknown };
    if (body.userId !== undefined && body.userId !== userId) {
      return NextResponse.json({ error: "User claim does not match session", code: "AUTH_FORBIDDEN" }, { status: 403 });
    }
    if (typeof body.agentName !== "string" || body.agentName.trim().length === 0) {
      return NextResponse.json({ error: "agentName is required", code: "INVALID_REQUEST" }, { status: 400 });
    }
    const disabled = legacyRuntimeDisabledResponse();
    if (disabled) return disabled;
    const [{ getPrisma }, { logAction }] = await Promise.all([
      import("@/src/config/prisma"),
      import("@/src/store/action-logger"),
    ]);
    const prisma = getPrisma();
    const agent = await prisma.marketplaceAgent.findUnique({ where: { name: body.agentName } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found", code: "NOT_FOUND" }, { status: 404 });
    }
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
    } catch (error) {
      const code = error instanceof Error ? error.name : "UNKNOWN";
      console.warn(JSON.stringify({ level: "warn", context: "legacy.marketplace.hire.audit", code }));
    }
    return NextResponse.json({
      id: hired.id,
      agentName: agent.name,
      agentId: agent.id,
      hiredAt: hired.hiredAt,
      tags: agent.tags,
      price: agent.price,
      reputation: agent.reputation,
    }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error, "legacy.marketplace.hire");
  }
}
