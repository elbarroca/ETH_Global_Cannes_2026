import { NextResponse } from "next/server";
import {
  authenticateRequest,
  authErrorResponse,
  legacyRuntimeDisabledResponse,
} from "@/src/auth/http";

export const runtime = "nodejs";

interface CreateRequestBody {
  name?: unknown;
  description?: unknown;
  instructions?: unknown;
  tools?: unknown;
  emoji?: unknown;
  createdBy?: unknown;
}

const USER_CREATED_ENDPOINT = "local://user-created";
const MAX_TOOL_ENTRIES = 16;

function sanitizeTools(tools: unknown): string[] {
  if (!Array.isArray(tools)) return [];
  const cleaned: string[] = [];
  for (const entry of tools) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (trimmed.length === 0 || trimmed.length > 64) continue;
    cleaned.push(trimmed);
    if (cleaned.length >= MAX_TOOL_ENTRIES) break;
  }
  return cleaned;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const auth = await authenticateRequest(request, { requireUser: true });
    if (!auth.ok) return auth.response;
    const userId = auth.auth.principal.userId;
    if (!userId) {
      return NextResponse.json({ error: "Onboarding required", code: "AUTH_USER_REQUIRED" }, { status: 403 });
    }
    const body = (await request.json()) as CreateRequestBody;
    if (
      body.createdBy !== undefined &&
      body.createdBy !== userId &&
      (typeof body.createdBy !== "string" ||
        body.createdBy.toLowerCase() !== auth.auth.principal.walletAddress)
    ) {
      return NextResponse.json({ error: "Owner claim does not match session", code: "AUTH_FORBIDDEN" }, { status: 403 });
    }
    const disabled = legacyRuntimeDisabledResponse();
    if (disabled) return disabled;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const instructions = typeof body.instructions === "string" ? body.instructions.trim() : "";
    const emoji = typeof body.emoji === "string" ? body.emoji.trim() || "🤖" : "🤖";
    const tools = sanitizeTools(body.tools);
    if (name.length < 2 || name.length > 40) {
      return NextResponse.json({ error: "Name must be 2-40 characters", code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (description.length < 10 || description.length > 800) {
      return NextResponse.json({ error: "Description must be 10-800 characters", code: "INVALID_REQUEST" }, { status: 400 });
    }
    if (instructions.length < 20 || instructions.length > 4_000) {
      return NextResponse.json({ error: "Instructions must be 20-4000 characters", code: "INVALID_REQUEST" }, { status: 400 });
    }

    const [{ getPrisma }, { logAction }, { registerSpecialist }] = await Promise.all([
      import("@/src/config/prisma"),
      import("@/src/store/action-logger"),
      import("@/src/marketplace/registry"),
    ]);
    const prisma = getPrisma();
    const existing = await prisma.marketplaceAgent.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: "Agent name already exists", code: "CONFLICT" }, { status: 409 });
    }
    const tagList = [emoji, "community", "user-built"];
    const row = await prisma.marketplaceAgent.create({
      data: {
        name,
        endpoint: USER_CREATED_ENDPOINT,
        price: "$0.001",
        tags: tagList,
        reputation: 500,
        totalHires: 0,
        correctCalls: 0,
        active: true,
        specialistType: "community",
        dataSources: tools,
        description,
        instructions,
        tools,
        createdBy: auth.auth.principal.walletAddress,
      },
    });
    try {
      await registerSpecialist(name, USER_CREATED_ENDPOINT, tagList, "$0.001");
    } catch (error) {
      const code = error instanceof Error ? error.name : "UNKNOWN";
      console.warn(JSON.stringify({ level: "warn", context: "legacy.marketplace.create.registry", code }));
    }
    try {
      await logAction({
        userId,
        actionType: "AGENT_DEPLOYED",
        agentName: row.name,
        payload: { agentId: row.id, tools },
      });
    } catch (error) {
      const code = error instanceof Error ? error.name : "UNKNOWN";
      console.warn(JSON.stringify({ level: "warn", context: "legacy.marketplace.create.audit", code }));
    }
    return NextResponse.json({
      id: row.id,
      name: row.name,
      emoji,
      price: row.price,
      reputation: row.reputation,
      tools: row.tools,
      description: row.description,
      instructions: row.instructions,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      legacy: true,
      authoritative: false,
    }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error, "legacy.marketplace.create");
  }
}
