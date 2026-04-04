import { NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";

// GET /api/cycle/debate/[cycleId]?userId=xxx — returns debate transcripts for a cycle
// Requires userId query param to verify ownership
export async function GET(
  request: Request,
  { params }: { params: Promise<{ cycleId: string }> },
): Promise<NextResponse> {
  const { cycleId } = await params;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!cycleId) {
    return NextResponse.json({ error: "Missing cycleId" }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "Missing userId query parameter" }, { status: 401 });
  }

  try {
    const prisma = getPrisma();

    // Verify the cycle belongs to this user
    const cycle = await prisma.cycle.findFirst({
      where: { id: cycleId, userId },
      select: { id: true },
    });

    if (!cycle) {
      return NextResponse.json({ error: "Cycle not found or not owned by user" }, { status: 403 });
    }

    const transcripts = await prisma.debateTranscript.findMany({
      where: { cycleId },
      orderBy: { turnNumber: "asc" },
      select: {
        id: true,
        turnNumber: true,
        phase: true,
        fromAgent: true,
        toAgent: true,
        messageContent: true,
        responseContent: true,
        attestationHash: true,
        teeVerified: true,
        durationMs: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ transcripts, count: transcripts.length });
  } catch (err) {
    console.error("[api/debate] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch debate transcripts" },
      { status: 500 },
    );
  }
}
