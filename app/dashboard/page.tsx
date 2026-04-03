"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/contexts/user-context";
import { useLatestCycle, useTriggerCycle, useCycleHistory } from "@/hooks/use-vaultmind";
import { CycleView } from "@/components/cycle-view";
import type { CycleResult } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isOnboarded, walletAddress } = useUser();
  const { cycle: latestCycle, loading, error, refetch } = useLatestCycle();
  const { run, running } = useTriggerCycle();
  const { history } = useCycleHistory(20);

  const [displayCycle, setDisplayCycle] = useState<CycleResult | null>(null);
  const [cycleIdx, setCycleIdx] = useState(0);

  useEffect(() => {
    if (!isOnboarded) router.push("/onboard");
  }, [isOnboarded, router]);

  useEffect(() => {
    if (latestCycle && cycleIdx === 0) setDisplayCycle(latestCycle);
  }, [latestCycle, cycleIdx]);

  useEffect(() => {
    if (history.length > 0 && cycleIdx > 0) {
      setDisplayCycle(history[cycleIdx - 1] ?? null);
    }
  }, [history, cycleIdx]);

  async function handleTrigger() {
    const result = await run();
    if (result) {
      setDisplayCycle(result);
      setCycleIdx(0);
      await refetch();
    }
  }

  function handlePrev() {
    if (cycleIdx < history.length - 1) {
      const newIdx = cycleIdx + 1;
      setCycleIdx(newIdx);
      setDisplayCycle(history[newIdx - 1] ?? null);
    }
  }

  function handleNext() {
    if (cycleIdx > 0) {
      const newIdx = cycleIdx - 1;
      setCycleIdx(newIdx);
      if (newIdx === 0) {
        setDisplayCycle(latestCycle);
      } else {
        setDisplayCycle(history[newIdx - 1] ?? null);
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold text-indigo-400">
            ⚡ VaultMind
          </Link>
          <div className="hidden md:flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-white font-medium">
              Dashboard
            </Link>
            <Link href="/history" className="text-slate-400 hover:text-white transition-colors">
              History
            </Link>
            <Link href="/portfolio" className="text-slate-400 hover:text-white transition-colors">
              Portfolio
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user && (
            <div className="text-xs text-slate-500">
              <span className="text-slate-400 capitalize">{user.agent.riskProfile}</span>
              {" · "}
              <span className={user.agent.active ? "text-green-400" : "text-yellow-400"}>
                {user.agent.active ? "● Running" : "⏸ Paused"}
              </span>
            </div>
          )}
          <span className="text-sm text-slate-500 font-mono hidden md:inline">
            {walletAddress?.slice(0, 6)}…{walletAddress?.slice(-4)}
          </span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* User stats bar */}
        {user && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBadge label="NAV" value={`$${user.agent.nav.toFixed(2)}`} color="indigo" />
            <StatBadge label="Deposited" value={`$${user.agent.depositedUsdc}`} color="blue" />
            <StatBadge label="Cycles Run" value={user.agent.cyclesRun.toString()} color="purple" />
            <StatBadge label="Max/Trade" value={`${user.agent.maxPct}%`} color="cyan" />
          </div>
        )}

        {/* Cycle navigation + trigger */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={cycleIdx >= history.length - 1}
              className="px-3 py-1.5 text-sm border border-slate-700 hover:border-slate-600 disabled:opacity-30 rounded-lg text-slate-400 transition-colors"
            >
              ← Prev
            </button>
            <span className="text-sm text-slate-400 px-2">
              {displayCycle ? `Cycle #${displayCycle.cycleId}` : "No cycles yet"}
            </span>
            <button
              onClick={handleNext}
              disabled={cycleIdx === 0}
              className="px-3 py-1.5 text-sm border border-slate-700 hover:border-slate-600 disabled:opacity-30 rounded-lg text-slate-400 transition-colors"
            >
              Next →
            </button>
          </div>
          <button
            onClick={handleTrigger}
            disabled={running || !user?.agent.active}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
          >
            {running ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running…
              </>
            ) : (
              "⟳ Trigger Cycle"
            )}
          </button>
        </div>

        {/* Main content */}
        {loading && !displayCycle ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <div className="text-center space-y-2">
              <p className="text-lg">API not connected</p>
              <p className="text-sm">Start the backend server on :3001 to see live data</p>
              <button onClick={refetch} className="mt-4 px-4 py-2 bg-slate-700 rounded-lg text-sm hover:bg-slate-600 transition-colors">
                Retry
              </button>
            </div>
          </div>
        ) : displayCycle ? (
          <CycleView cycle={displayCycle} />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500 space-y-4">
            <p className="text-lg">No cycles run yet</p>
            <button
              onClick={handleTrigger}
              disabled={running}
              className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-white font-medium disabled:opacity-50 transition-colors"
            >
              Run First Cycle →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "indigo" | "blue" | "purple" | "cyan";
}) {
  const colors = {
    indigo: "text-indigo-400",
    blue: "text-blue-400",
    purple: "text-purple-400",
    cyan: "text-cyan-400",
  };
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className={`text-xl font-bold ${colors[color]}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
