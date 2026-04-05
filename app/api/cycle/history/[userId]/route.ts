import { type NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/src/store/user-store";
import { getPrisma } from "@/src/config/prisma";
import { enrichCycleRow, type EnrichmentContext } from "@/src/store/enrich-cycle";

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

    // Batch-load enrichment inputs once instead of per-row:
    //   - SPECIALIST_HIRED rows for all cycles in a single `IN (...)` query
    //     (was: N queries, one per cycle)
    //   - user.fund.holdings pulled from the user record we already fetched
    //     (was: N identical user reads, one per cycle)
    // Cuts /history payload latency from ~2N roundtrips down to 1 for users
    // with populated action logs.
    const cycleIds = cycles.map((c) => c.id);
    const allActions =
      cycleIds.length > 0
        ? await prisma.agentAction.findMany({
            where: {
              cycleId: { in: cycleIds },
              actionType: "SPECIALIST_HIRED",
            },
            orderBy: { createdAt: "asc" },
            select: {
              cycleId: true,
              agentName: true,
              paymentTxHash: true,
              attestationHash: true,
              payload: true,
            },
          })
        : [];
    const actionsByCycle: EnrichmentContext["actionsByCycle"] = new Map();
    for (const a of allActions) {
      if (!a.cycleId) continue;
      const list = actionsByCycle.get(a.cycleId) ?? [];
      list.push({
        agentName: a.agentName,
        paymentTxHash: a.paymentTxHash,
        attestationHash: a.attestationHash,
        payload: a.payload,
      });
      actionsByCycle.set(a.cycleId, list);
    }
    const holdings =
      ((user.fund ?? {}) as unknown as { holdings?: Record<string, number> })
        .holdings ?? {};
    const ctx: EnrichmentContext = { actionsByCycle, holdings };

    const enriched = await Promise.all(cycles.map((c) => enrichCycleRow(c, ctx)));
    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
