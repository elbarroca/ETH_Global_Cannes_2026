import { NextResponse } from "next/server";
import { getPrisma } from "@/src/config/prisma";

// GET /api/specialists/performance?specialist=sentiment&limit=50
//
// Returns per-specialist pick-level performance aggregated from the
// `specialist_pick_entries` table (written at cycle commit, scored by the
// heartbeat's evaluatePickPerformance tick). Each pick has an entry price
// snapshot + exit price scored Δt later + P&L.
//
// Shape:
//   {
//     picks: SpecialistPickEntry[],     // most recent first
//     bySpec: {
//       [name]: { total, scored, correct, wrong, neutral, winRate, avgPnl }
//     }
//   }
//
// This is the feed for the marketplace performance card + hire/fire loop.

interface SpecialistSummary {
  total: number;
  scored: number;
  correct: number;
  wrong: number;
  neutral: number;
  winRate: number;
  avgPnl: number;
  pnlTotal: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const specialist = searchParams.get("specialist") ?? undefined;
    const limitRaw = Number(searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;
    const prisma = getPrisma();

    const picks = await prisma.specialistPickEntry.findMany({
      where: specialist ? { specialistName: specialist } : {},
      orderBy: { enteredAt: "desc" },
      take: limit,
    });

    const bySpec: Record<string, SpecialistSummary> = {};
    for (const p of picks) {
      const key = p.specialistName;
      bySpec[key] ??= {
        total: 0,
        scored: 0,
        correct: 0,
        wrong: 0,
        neutral: 0,
        winRate: 0,
        avgPnl: 0,
        pnlTotal: 0,
      };
      const row = bySpec[key];
      row.total++;
      if (p.scored) {
        row.scored++;
        if (p.correct === true) row.correct++;
        else if (p.correct === false) row.wrong++;
        else row.neutral++;
        if (p.pnlPct != null) row.pnlTotal += p.pnlPct;
      }
    }

    // Compute derived fields once at the end — avoids repeated division.
    for (const row of Object.values(bySpec)) {
      row.winRate = row.scored > 0 ? Math.round((row.correct / row.scored) * 1000) / 10 : 0;
      row.avgPnl = row.scored > 0 ? Math.round((row.pnlTotal / row.scored) * 100) / 100 : 0;
    }

    return NextResponse.json({ picks, bySpec });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
