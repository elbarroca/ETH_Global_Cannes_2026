import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/rag/status
 * Optional ?userId= — latest committed cycle for that user: priorCids count (from DB narrative).
 * Without userId — sample of recent cycles: how many have narrative.priorCids (platform health).
 *
 * Live 0G download proof stays in `scripts/inspect-rag-eligibility.ts` (loadRecentCycles).
 */
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    const prisma = getPrisma();

    if (userId) {
      const latest = await prisma.cycle.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { cycleNumber: true, narrative: true },
      });
      const prior = (latest?.narrative as { priorCids?: string[] } | null | undefined)?.priorCids;
      const priorCidsOnLatest = Array.isArray(prior) ? prior.filter((x) => typeof x === "string" && x.length > 0).length : 0;
      return NextResponse.json({
        userId,
        latestCycleNumber: latest?.cycleNumber ?? null,
        priorCidsOnLatest,
        hasRagOnLatest: priorCidsOnLatest > 0,
      });
    }

    const recent = await prisma.cycle.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { narrative: true },
    });
    const withRag = recent.filter((c) => {
      const n = c.narrative as { priorCids?: string[] } | null | undefined;
      return Array.isArray(n?.priorCids) && n.priorCids!.length > 0;
    }).length;

    return NextResponse.json({
      recentSampleSize: recent.length,
      cyclesWithRagInSample: withRag,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
