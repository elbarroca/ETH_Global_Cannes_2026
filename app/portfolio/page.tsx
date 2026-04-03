"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/contexts/user-context";
import { useCycleHistory } from "@/hooks/use-vaultmind";
import { withdraw, configure } from "@/lib/api";

export default function PortfolioPage() {
  const router = useRouter();
  const { user, isOnboarded, userId, setUser, refetch } = useUser();
  const { history } = useCycleHistory(50);

  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnboarded) router.push("/onboard");
  }, [isOnboarded, router]);

  async function handleWithdraw() {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await withdraw(userId, parseFloat(withdrawAmount));
      setUser(updated);
      setShowWithdrawConfirm(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAgent() {
    if (!userId || !user) return;
    setLoading(true);
    try {
      const updated = await configure(userId, user.agent.riskProfile, user.telegram?.notifyPreference ?? "trades_only");
      setUser(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Build NAV history from cycles
  const navHistory = history
    .slice()
    .reverse()
    .map((c, i) => ({ cycle: c.cycleId ?? i, nav: 1000 + i * 12.5 })); // approximate

  const pnl = user ? user.agent.nav - user.agent.depositedUsdc : 0;
  const pnlPct = user && user.agent.depositedUsdc > 0 ? (pnl / user.agent.depositedUsdc) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold text-indigo-400">⚡ VaultMind</Link>
          <div className="hidden md:flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors">Dashboard</Link>
            <Link href="/history" className="text-slate-400 hover:text-white transition-colors">History</Link>
            <Link href="/portfolio" className="text-white font-medium">Portfolio</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <h1 className="text-2xl font-bold">Portfolio</h1>

        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {user && (
          <>
            {/* Fund overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="text-2xl font-bold text-indigo-400">${user.agent.nav.toFixed(2)}</div>
                <div className="text-xs text-slate-500 mt-1">Current NAV</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="text-2xl font-bold text-slate-300">${user.agent.depositedUsdc}</div>
                <div className="text-xs text-slate-500 mt-1">Deposited</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className={`text-2xl font-bold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                </div>
                <div className="text-xs text-slate-500 mt-1">P&L</div>
              </div>
              <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className={`text-2xl font-bold ${pnlPct >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500 mt-1">Return</div>
              </div>
            </div>

            {/* NAV chart (simple line) */}
            {navHistory.length > 1 && (
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-sm font-medium text-slate-400 mb-4">NAV History</h3>
                <div className="flex items-end gap-1 h-24">
                  {navHistory.map((point, i) => {
                    const max = Math.max(...navHistory.map((p) => p.nav));
                    const min = Math.min(...navHistory.map((p) => p.nav));
                    const range = max - min || 1;
                    const height = ((point.nav - min) / range) * 80 + 20;
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-indigo-500/60 rounded-t-sm hover:bg-indigo-400/60 transition-colors"
                        style={{ height: `${height}%` }}
                        title={`Cycle #${point.cycle}: $${point.nav.toFixed(2)}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Agent controls */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
              <h3 className="font-semibold text-white">Agent Controls</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-300">Status</div>
                  <div className={`text-sm font-medium ${user.agent.active ? "text-green-400" : "text-yellow-400"}`}>
                    {user.agent.active ? "● Running" : "⏸ Paused"}
                  </div>
                </div>
                <button
                  onClick={handleToggleAgent}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                    user.agent.active
                      ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30"
                      : "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                  }`}
                >
                  {user.agent.active ? "Pause Agent" : "Resume Agent"}
                </button>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-700">
                <div>
                  <div className="text-sm text-slate-300">Risk Profile</div>
                  <div className="text-sm font-medium capitalize text-indigo-300">
                    {user.agent.riskProfile}
                  </div>
                </div>
                <Link
                  href="/onboard"
                  className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Change →
                </Link>
              </div>
            </div>

            {/* Deposit / Withdraw */}
            <div className="grid grid-cols-2 gap-4">
              <Link
                href="/onboard"
                className="flex items-center justify-center py-3 bg-green-500/20 border border-green-500/30 text-green-400 rounded-xl text-sm font-medium hover:bg-green-500/30 transition-colors"
              >
                + Deposit USDC
              </Link>
              <button
                onClick={() => setShowWithdrawConfirm(true)}
                className="py-3 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium hover:bg-red-500/30 transition-colors"
              >
                − Withdraw
              </button>
            </div>

            {/* Withdraw modal */}
            {showWithdrawConfirm && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-sm space-y-4">
                  <h3 className="font-bold text-white">Withdraw Funds</h3>
                  <div>
                    <label className="text-sm text-slate-400">Amount (USDC)</label>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="mt-1 w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowWithdrawConfirm(false)}
                      className="flex-1 py-2 border border-slate-700 rounded-lg text-slate-400 text-sm hover:border-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleWithdraw}
                      disabled={loading}
                      className="flex-1 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors"
                    >
                      {loading ? "Processing…" : "Confirm Withdraw"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
