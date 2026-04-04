"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DawgSpinner } from "@/components/dawg-spinner";
import { PortfolioPie } from "@/components/portfolio/portfolio-pie";
import { EvolutionChart } from "@/components/portfolio/evolution-chart";
import { AttributionLog } from "@/components/portfolio/attribution-log";
import { useUser } from "@/contexts/user-context";

interface PortfolioResponse {
  current: {
    usdcDeposited: number;
    positions: Array<{
      symbol: string;
      amount: number;
      usdValue: number;
      sharePct: number;
    }>;
    totalUsd: number;
  };
  evolution: Array<{
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
  }>;
  totalNav: number;
  cycleCount: number;
  swapCount: number;
}

export default function PortfolioPage() {
  const { userId, isConnected } = useUser();
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    // Poll every 10s so the page auto-refreshes during a live cycle without
    // requiring the user to reload. Uses `cache: "no-store"` so Vercel edge
    // caching never serves a stale snapshot.
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/portfolio/${userId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as PortfolioResponse;
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    };
    void load();
    const interval = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId]);

  if (!isConnected || !userId) {
    return (
      <main className="max-w-7xl mx-auto px-5 py-8 space-y-4">
        <h1 className="text-lg font-bold text-void-100">Portfolio</h1>
        <Card>
          <CardBody className="text-center py-12 space-y-2">
            <p className="text-void-400 text-sm">Connect your wallet to view your portfolio.</p>
          </CardBody>
        </Card>
      </main>
    );
  }

  if (loading && !data) {
    return (
      <main className="max-w-7xl mx-auto flex justify-center px-5 py-16">
        <DawgSpinner size={56} label="Loading portfolio…" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="max-w-7xl mx-auto px-5 py-8 space-y-4">
        <h1 className="text-lg font-bold text-void-100">Portfolio</h1>
        <Card>
          <CardBody className="py-8 space-y-2 text-center">
            <p className="text-sm text-blood-300">Failed to load portfolio data.</p>
            {error && <p className="text-xs text-void-500 font-mono">{error}</p>}
          </CardBody>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-5 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-void-100">Portfolio</h1>
          <p className="text-sm text-void-500 mt-0.5">
            Your agent&apos;s on-chain positions, evolution, and hunt attribution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="amber">{data.cycleCount} hunts</Badge>
          <Badge variant="green">{data.swapCount} swaps</Badge>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total NAV"
          value={`$${data.totalNav.toFixed(2)}`}
          accent="gold-400"
        />
        <KpiCard
          label="USDC"
          value={`$${data.current.usdcDeposited.toFixed(2)}`}
          accent="teal-300"
        />
        <KpiCard
          label="Token positions"
          value={String(data.current.positions.filter((p) => p.symbol !== "USDC").length)}
          accent="void-100"
        />
        <KpiCard
          label="Executed swaps"
          value={String(data.swapCount)}
          accent="emerald-300"
        />
      </div>

      {/* Pie chart + legend */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
            <span className="w-2 h-2 rounded-full bg-dawg-500" />
            Current allocation
          </div>
          <Badge variant="gray">snapshot</Badge>
        </CardHeader>
        <CardBody>
          <PortfolioPie
            positions={data.current.positions}
            totalUsd={data.current.totalUsd}
          />
        </CardBody>
      </Card>

      {/* Evolution chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            NAV evolution per hunt
          </div>
          <Badge variant="gray">last {data.evolution.length} cycles</Badge>
        </CardHeader>
        <CardBody>
          <EvolutionChart evolution={data.evolution} />
        </CardBody>
      </Card>

      {/* Attribution log */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-semibold text-void-200">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Per-hunt attribution
          </div>
          <Badge variant="gray">who drove each position</Badge>
        </CardHeader>
        <CardBody>
          <AttributionLog evolution={data.evolution} />
        </CardBody>
      </Card>
    </main>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card>
      <CardBody className="py-3 px-4 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-void-600">{label}</div>
        <div className={`text-xl font-bold font-mono tabular-nums text-${accent}`}>{value}</div>
      </CardBody>
    </Card>
  );
}
