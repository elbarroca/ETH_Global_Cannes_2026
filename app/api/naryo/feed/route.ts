import { NextRequest, NextResponse } from "next/server";
import { getRecentEvents } from "@/src/naryo/event-handler";
import { fetchMirrorAuditLogFeed, type MirrorFeedEventRow } from "@/src/naryo/mirror-feed";
import { mapFeedEvents, type NaryoFeedPipeline } from "@/src/naryo/feed-mapper";
import { getPrisma } from "@/src/config/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/naryo/feed
 * Returns recent Naryo events for the dashboard widget.
 * Order: in-memory buffer + DB merge; always loads correlations from DB;
 * if still empty, Hedera Mirror fallback (AuditLog EVM logs) when mirror≠0.
 */
export async function GET(req: NextRequest) {
  try {
    const mirrorOff = req.nextUrl.searchParams.get("mirror") === "0";

    const prisma = getPrisma();
    const correlations = await prisma.naryoCorrelation.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const buffered = getRecentEvents();
    const dbEvents = await prisma.naryoEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const bufIds = new Set(buffered.map((e) => e.id));
    const merged = [
      ...buffered,
      ...dbEvents.filter((e) => !bufIds.has(e.id)),
    ].slice(0, 50);

    type Row = (typeof merged)[number] | MirrorFeedEventRow;
    let rawRows: Row[] = merged;
    let pipeline: NaryoFeedPipeline = buffered.length > 0 ? "buffer+db" : "db";

    if (rawRows.length === 0 && !mirrorOff) {
      const mirrorRows = await fetchMirrorAuditLogFeed(15);
      if (mirrorRows.length > 0) {
        rawRows = mirrorRows;
        pipeline = "mirror";
      }
    }

    const events = mapFeedEvents(rawRows as Array<MirrorFeedEventRow | Record<string, unknown>>);

    return NextResponse.json({
      events,
      correlations,
      pipeline,
      source: pipeline,
    });
  } catch (err) {
    return NextResponse.json(
      { events: [], correlations: [], error: String(err), pipeline: "error" as const, source: "error" },
      { status: 200 },
    );
  }
}
