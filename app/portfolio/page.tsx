"use client";

import { useCallback, useEffect, useState } from "react";
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

  const load = useCallback(async (silent = false): Promise<void> => {
    if (!userId) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/portfolio/${userId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Portfolio API returned ${res.status}`);
      setData((await res.json()) as PortfolioResponse);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Portfolio data is unavailable.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(true), 10_000);
    return () => {
      clearInterval(interval);
    };
  }, [load]);

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

  if (!data) {
    return (
      <main className="max-w-screen-2xl mx-auto px-5 py-8">
        <h1 className="font-pixel text-lg text-void-200 mb-4">Portfolio</h1>
        <div className="rounded-2xl border border-blood-900/30 bg-blood-950/10 px-6 py-8 text-center">
          <p className="text-sm text-blood-300/90">Failed to load portfolio data.</p>
          {error && <p className="text-xs text-void-500 font-mono mt-2">{error}</p>}
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 min-h-11 rounded-xl border border-void-700 px-4 text-sm font-semibold text-void-200 hover:bg-void-800"
          >
            Retry portfolio
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[90rem] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-xl border border-dawg-500/25 bg-black px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="instrument-label">
              Portfolio
            </p>
            <h1 className="text-3xl font-semibold leading-tight tracking-[-0.035em] text-void-100 sm:text-4xl">
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

      {error && (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-dawg-500/25 bg-dawg-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-void-400">Showing the last portfolio snapshot. Refresh failed: {error}</p>
          <button type="button" onClick={() => void load()} className="min-h-11 rounded-xl border border-void-700 px-4 text-sm font-semibold text-void-200 hover:bg-void-800">
            Retry
          </button>
        </div>
      )}

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
            <Badge variant="gray">Modeled snapshot</Badge>
          </CardHeader>
          <CardBody className="pt-4 pb-6">
            <PortfolioPie positions={data.current.positions} totalUsd={data.current.totalUsd} />
            <details className="mt-5 rounded-xl border border-void-800 bg-void-950/45">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-void-300">
                Allocation data table
              </summary>
              <div className="overflow-x-auto border-t border-void-800">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-void-600">
                    <tr><th className="px-4 py-2">Asset</th><th className="px-4 py-2">Amount</th><th className="px-4 py-2">Modeled USD</th><th className="px-4 py-2">Share</th></tr>
                  </thead>
                  <tbody>
                    {data.current.positions.map((position) => (
                      <tr key={position.symbol} className="border-t border-void-800/70 text-void-300">
                        <th scope="row" className="px-4 py-2 font-semibold">{position.symbol}</th>
                        <td className="px-4 py-2 font-mono">{position.amount}</td>
                        <td className="px-4 py-2 font-mono">${position.usdValue.toFixed(2)}</td>
                        <td className="px-4 py-2 font-mono">{position.sharePct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <p className="mt-3 text-xs text-void-600">
              Non-USDC values use the portfolio API&apos;s fixed demo-price model; they are not a market-price feed.
            </p>
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
            <details className="mt-4 rounded-xl border border-void-800 bg-void-950/45">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-void-300">
                NAV history data table
              </summary>
              <div className="overflow-x-auto border-t border-void-800">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-wider text-void-600">
                    <tr><th className="px-4 py-2">Hunt</th><th className="px-4 py-2">Time</th><th className="px-4 py-2">Decision</th><th className="px-4 py-2">NAV snapshot</th><th className="px-4 py-2">Arc tx</th></tr>
                  </thead>
                  <tbody>
                    {data.evolution.map((point) => (
                      <tr key={point.cycleId} className="border-t border-void-800/70 text-void-300">
                        <th scope="row" className="px-4 py-2 font-semibold">#{point.cycleNumber}</th>
                        <td className="px-4 py-2">{new Date(point.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-2">{point.action} {point.pct}% {point.asset}</td>
                        <td className="px-4 py-2 font-mono">${point.navAfter.toFixed(2)}</td>
                        <td className="px-4 py-2 font-mono">{point.swapTxHash ? `${point.swapTxHash.slice(0, 10)}...` : "Unavailable"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
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
