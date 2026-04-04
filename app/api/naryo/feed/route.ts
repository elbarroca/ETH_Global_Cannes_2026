import { NextResponse } from "next/server";
import { getRecentEvents } from "@/src/naryo/event-handler";
import { getPrisma } from "@/src/config/prisma";

/**
 * GET /api/naryo/feed
 * Returns recent Naryo events for the dashboard widget.
 * Uses in-memory buffer first, falls back to DB.
 */
export async function GET() {
  try {
    // Try in-memory buffer first (fastest)
    const buffered = getRecentEvents();
    if (buffered.length > 0) {
      return NextResponse.json({ events: buffered, source: "buffer" });
    }

    // Fallback to DB
    const prisma = getPrisma();
    const events = await prisma.naryoEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Also get recent correlations
    const correlations = await prisma.naryoCorrelation.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ events, correlations, source: "db" });
  } catch (err) {
    return NextResponse.json({ events: [], error: String(err) }, { status: 200 });
  }
}
