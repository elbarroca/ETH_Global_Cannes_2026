"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/contexts/user-context";
import { useCycleHistory } from "@/hooks/use-vaultmind";
import { CycleView } from "@/components/cycle-view";
import type { CycleResult } from "@/lib/api";

export default function HistoryPage() {
  const router = useRouter();
  const { isOnboarded } = useUser();
  const { history, loading, hasMore, loadMore } = useCycleHistory(25);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!isOnboarded) router.push("/onboard");
  }, [isOnboarded, router]);

  function formatTime(iso?: string): string {
    if (!iso) return "–";
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function getActionColor(action?: string): string {
    if (action === "BUY") return "bg-green-500/20 text-green-400 border-green-500/30";
    if (action === "SELL") return "bg-red-500/20 text-red-400 border-red-500/30";
    return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold text-indigo-400">⚡ VaultMind</Link>
          <div className="hidden md:flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">Dashboard</Link>
            <Link href="/history" className="text-white font-medium">History</Link>
            <Link href="/portfolio" className="text-slate-400 hover:text-white transition-colors">Portfolio</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        <h1 className="text-2xl font-bold">Cycle History</h1>

        {loading && history.length === 0 ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p>No cycles yet. Go to Dashboard and trigger your first cycle.</p>
          </div>
        ) : (
          <>
            {/* Timeline */}
            <div className="relative space-y-2">
              {history.map((cycle: CycleResult, i) => {
                const exec = cycle.debate?.executor?.parsed;
                const isOpen = expanded === i;

                return (
                  <div key={cycle.cycleId ?? i}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : i)}
                      className="w-full flex items-center gap-4 p-4 bg-slate-800 hover:bg-slate-750 rounded-xl border border-slate-700 hover:border-slate-600 transition-all text-left"
                    >
                      <span className="text-slate-500 font-mono text-sm w-16">
                        #{cycle.cycleId}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getActionColor(exec?.action)}`}
                      >
                        {exec?.action ?? "?"}
                      </span>
                      {exec && (
                        <span className="text-sm text-slate-300">
                          {exec.pct}% {exec.asset}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-slate-500">
                        {formatTime(cycle.timestamp)}
                      </span>
                      <a
                        href={cycle.hashscanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors ml-2"
                      >
                        Proof ↗
                      </a>
                      <span className="text-slate-600">{isOpen ? "▲" : "▼"}</span>
                    </button>

                    {isOpen && (
                      <div className="mt-2 pl-2">
                        <CycleView cycle={cycle} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Loading…" : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
