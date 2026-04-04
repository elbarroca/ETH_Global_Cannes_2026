import { NextResponse } from "next/server";
import { getUserById } from "@/src/store/user-store";
import { getPrisma } from "@/src/config/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/portfolio/[userId]
 *
 * Holdings snapshot, NAV evolution, and per-hunt attribution for /portfolio.
 * Nanopayments and debate flow live on the dashboard hunt accordion instead.
 */

const DEMO_PRICES_USD: Record<string, number> = {
  USDC: 1,
  USD: 1,
  ETH: 3500,
  WETH: 3500,
  SYNTH: 1,
  UNI: 12,
  LINK: 18,
  AAVE: 150,
};

function priceUsd(symbol: string): number {
  return DEMO_PRICES_USD[symbol.toUpperCase()] ?? 0;
}

interface PortfolioPosition {
  symbol: string;
  amount: number;
  usdValue: number;
  sharePct: number;
}

interface EvolutionPoint {
  cycleId: string;
  cycleNumber: number;
  timestamp: string;
  action: string;
  asset: string;
  pct: number;
  navAfter: number;
  swapTxHash: string | null;
  attribution: {
    specialist: string | null;
    confidence: number | null;
    signal: string | null;
  };
}

interface StoredSpecialist {
  name?: string;
  signal?: string;
  confidence?: number;
}

function resolveAttribution(
  specialistsJson: unknown,
  decision: string | null,
): EvolutionPoint["attribution"] {
  if (!Array.isArray(specialistsJson) || !decision) {
    return { specialist: null, confidence: null, signal: null };
  }
  const matching = (specialistsJson as StoredSpecialist[])
    .filter((s) => typeof s?.signal === "string" && s.signal.toUpperCase() === decision.toUpperCase())
    .sort((a, b) => (Number(b?.confidence) || 0) - (Number(a?.confidence) || 0));
  const top = matching[0];
  if (!top) {
    return { specialist: null, confidence: null, signal: null };
  }
  return {
    specialist: String(top.name ?? "unknown"),
    confidence: typeof top.confidence === "number" ? top.confidence : null,
    signal: typeof top.signal === "string" ? top.signal : null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const prisma = getPrisma();

    const depositedUsdc = user.fund?.depositedUsdc ?? 0;
    const holdings =
      (user.fund as unknown as { holdings?: Record<string, number> }).holdings ?? {};

    const usdcUsd = depositedUsdc * priceUsd("USDC");
    const positions: PortfolioPosition[] = [];
    if (usdcUsd > 0) {
      positions.push({ symbol: "USDC", amount: depositedUsdc, usdValue: usdcUsd, sharePct: 0 });
    }
    for (const [symbol, amount] of Object.entries(holdings)) {
      if (!amount || amount <= 0) continue;
      const usd = amount * priceUsd(symbol);
      positions.push({ symbol: symbol.toUpperCase(), amount, usdValue: usd, sharePct: 0 });
    }

    const totalUsd = positions.reduce((s, p) => s + p.usdValue, 0);
    if (totalUsd > 0) {
      for (const p of positions) {
        p.sharePct = (p.usdValue / totalUsd) * 100;
      }
    }
    positions.sort((a, b) => b.usdValue - a.usdValue);

    const cycles = await prisma.cycle.findMany({
      where: { userId: user.id },
      orderBy: { cycleNumber: "asc" },
    });

    const evolution: EvolutionPoint[] = cycles.map((c) => ({
      cycleId: c.id,
      cycleNumber: c.cycleNumber,
      timestamp: c.createdAt.toISOString(),
      action: c.decision ?? "HOLD",
      asset: c.asset ?? "ETH",
      pct: c.decisionPct ?? 0,
      navAfter: c.navAfter ?? 0,
      swapTxHash: c.swapTxHash,
      attribution: resolveAttribution(c.specialists, c.decision),
    }));

    const lastNavAfter = cycles.length > 0 ? (cycles[cycles.length - 1].navAfter ?? 0) : 0;
    const totalNav = Math.max(totalUsd, lastNavAfter);

    return NextResponse.json({
      current: {
        usdcDeposited: depositedUsdc,
        positions,
        totalUsd,
      },
      evolution,
      totalNav,
      cycleCount: cycles.length,
      swapCount: cycles.filter((c) => c.swapTxHash != null).length,
    });
  } catch (err) {
    console.error("[api/portfolio] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
