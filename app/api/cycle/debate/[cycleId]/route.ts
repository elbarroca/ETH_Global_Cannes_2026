import { NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";

// GET /api/cycle/debate/[cycleId] — returns debate transcripts for a cycle
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cycleId: string }> },
): Promise<NextResponse> {
  const { cycleId } = await params;

  if (!cycleId) {
    return NextResponse.json({ error: "Missing cycleId" }, { status: 400 });
  }

  try {
    const prisma = getPrisma();
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
