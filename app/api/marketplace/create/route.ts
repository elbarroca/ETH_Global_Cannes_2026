import { NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";
import { logAction } from "@/src/store/action-logger";
import { registerSpecialist } from "@/src/marketplace/registry";

export const runtime = "nodejs";

interface CreateRequestBody {
  name?: string;
  description?: string;
  instructions?: string;
  tools?: string[];
  emoji?: string;
  createdBy?: string;
  attestationHash?: string | null;
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

export async function POST(req: Request) {
  let body: CreateRequestBody;
  try {
    body = (await req.json()) as CreateRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const description = (body.description ?? "").trim();
  const instructions = (body.instructions ?? "").trim();
  const emoji = (body.emoji ?? "").trim() || "🤖";
  const createdBy = (body.createdBy ?? "").trim() || null;
  const tools = sanitizeTools(body.tools);

  if (!name || name.length < 2 || name.length > 40) {
    return NextResponse.json({ error: "Name must be 2-40 characters" }, { status: 400 });
  }
  if (!description || description.length < 10 || description.length > 800) {
    return NextResponse.json(
      { error: "Description must be 10-800 characters" },
      { status: 400 },
    );
  }
  if (!instructions || instructions.length < 20) {
    return NextResponse.json(
      { error: "Instructions markdown is required — run Generate first" },
      { status: 400 },
    );
  }

  const prisma = getPrisma();

  // Enforce uniqueness against both built-in and previously deployed community agents.
  const existing = await prisma.marketplaceAgent.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: `An agent named "${name}" already exists` },
      { status: 409 },
    );
  }

  try {
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
        createdBy,
      },
    });

    // Sync the in-memory registry so `discoverSpecialists()` (used by the
    // leaderboard enrichment pass) returns this agent immediately. The upsert
    // touches only endpoint/tags/price/active/wallet — our custom columns
    // (description/instructions/tools/createdBy) are preserved.
    try {
      await registerSpecialist(name, USER_CREATED_ENDPOINT, tagList, "$0.001");
    } catch (err) {
      console.warn("[marketplace/create] Registry sync non-fatal:", err);
    }

    // Audit trail — keep a record that a user deployed an agent. Non-fatal.
    if (createdBy) {
      try {
        await logAction({
          userId: createdBy,
          actionType: "AGENT_DEPLOYED",
          agentName: row.name,
          payload: {
            agentId: row.id,
            tools,
            attestationHash: body.attestationHash ?? null,
          },
        });
      } catch {
        /* audit is best-effort */
      }
    }

    return NextResponse.json(
      {
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
      },
      { status: 201 },
    );
  } catch (err) {
    console.warn("[marketplace/create] Insert failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
