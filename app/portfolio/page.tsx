"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DawgSpinner } from "@/components/dawg-spinner";
import { PortfolioPie } from "@/components/portfolio/portfolio-pie";
import { EvolutionChart } from "@/components/portfolio/evolution-chart";
import { AttributionLog } from "@/components/portfolio/attribution-log";
import { useUser } from "@/contexts/user-context";
import type { PortfolioResponse } from "@/lib/portfolio-types";

/** KPI values: one accent (NAV), rest neutral for calmer scan. */
const KPI_STYLES = {
  nav: "text-dawg-400",
  default: "text-void-200",
} as const;

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
      <main className="max-w-screen-2xl mx-auto px-5 py-8">
        <div className="rounded-2xl border border-void-800 bg-void-950/60 px-6 py-12 text-center">
          <h1 className="font-pixel text-lg text-dawg-400/90 uppercase tracking-wider mb-2">Portfolio</h1>
          <p className="text-void-500 text-sm">Connect your wallet to view positions and hunt history.</p>
        </div>
      </main>
    );
  }

  if (loading && !data) {
    return (
      <main className="max-w-screen-2xl mx-auto flex justify-center px-5 py-20">
        <DawgSpinner size={56} label="Loading portfolio…" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="max-w-screen-2xl mx-auto px-5 py-8">
        <h1 className="font-pixel text-lg text-void-200 mb-4">Portfolio</h1>
        <div className="rounded-2xl border border-blood-900/30 bg-blood-950/10 px-6 py-8 text-center">
          <p className="text-sm text-blood-300/90">Failed to load portfolio data.</p>
          {error && <p className="text-xs text-void-500 font-mono mt-2">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-screen-2xl mx-auto px-5 py-6 space-y-6">
      <header className="rounded-2xl border border-void-800/90 bg-void-950/70 px-5 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-void-600">
              Portfolio
            </p>
            <h1 className="font-pixel text-[26px] sm:text-[30px] leading-tight text-dawg-400/95 uppercase tracking-wide">
              Holdings &amp; hunts
            </h1>
            <p className="text-sm text-void-500 leading-relaxed">
              Allocation, NAV over cycles, and attribution. Arc swap hashes open in ArcScan when present.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Badge variant="gray">{data.cycleCount} hunts</Badge>
            <Badge variant="gray">{data.swapCount} swaps</Badge>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total NAV" value={`$${data.totalNav.toFixed(2)}`} valueClass={KPI_STYLES.nav} />
        <KpiCard label="USDC" value={`$${data.current.usdcDeposited.toFixed(2)}`} valueClass={KPI_STYLES.default} />
        <KpiCard
          label="Token positions"
          value={String(data.current.positions.filter((p) => p.symbol !== "USDC").length)}
          valueClass={KPI_STYLES.default}
        />
        <KpiCard label="Executed swaps" value={String(data.swapCount)} valueClass={KPI_STYLES.default} />
      </div>

      <section>
        <Card className="border-void-800/80 bg-void-950/40 overflow-hidden">
          <CardHeader className="border-void-800/80 bg-black/20">
            <div className="flex items-center gap-2 text-sm font-medium text-void-300">
              <span className="h-px w-6 bg-dawg-500/60" aria-hidden />
              Current allocation
            </div>
            <Badge variant="gray">live</Badge>
          </CardHeader>
          <CardBody className="pt-4 pb-6">
            <PortfolioPie positions={data.current.positions} totalUsd={data.current.totalUsd} />
          </CardBody>
        </Card>
      </section>

      <section>
        <Card className="border-void-800/80 bg-void-950/40 overflow-hidden">
          <CardHeader className="border-void-800/80 bg-black/20">
            <div className="flex items-center gap-2 text-sm font-medium text-void-300">
              <span className="h-px w-6 bg-dawg-500/60" aria-hidden />
              NAV evolution per hunt
            </div>
            <Badge variant="gray">{data.evolution.length} cycles</Badge>
          </CardHeader>
          <CardBody className="pt-2 pb-5">
            <EvolutionChart evolution={data.evolution} />
          </CardBody>
        </Card>
      </section>

      <section>
        <Card className="border-void-800/80 bg-void-950/40 overflow-hidden">
          <CardHeader className="border-void-800/80 bg-black/20">
            <div className="flex items-center gap-2 text-sm font-medium text-void-300">
              <span className="h-px w-6 bg-dawg-500/60" aria-hidden />
              Per-hunt attribution
            </div>
            <Badge variant="gray">Arc tx · verify</Badge>
          </CardHeader>
          <CardBody className="pt-2 pb-5">
            <AttributionLog evolution={data.evolution} />
          </CardBody>
        </Card>
      </section>
    </main>
  );
}

function KpiCard({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <Card className="border-void-800/70 bg-void-950/50 hover:border-void-700/90 transition-colors">
      <CardBody className="py-3.5 px-4 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-void-600">{label}</div>
        <div className={`text-xl font-semibold font-mono tabular-nums ${valueClass}`}>{value}</div>
      </CardBody>
    </Card>
  );
}
