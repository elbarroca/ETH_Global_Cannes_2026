"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { useUser } from "@/contexts/user-context";
import { deposit, withdraw } from "@/lib/api";

type Tab = "deposit" | "withdraw";
const QUICK_AMOUNTS = [1, 10, 50, 100];

export default function DepositPage() {
  const { user, userId, refetch } = useUser();
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deposited = user?.fund?.depositedUsdc ?? 0;
  const nav = user?.fund?.currentNav ?? 0;
  const shares = user?.fund?.htsShareBalance ?? 0;

  async function handleSubmit() {
    if (!amount || parseFloat(amount) <= 0 || !userId) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === "deposit") {
        await deposit(userId, parseFloat(amount));
      } else {
        await withdraw(userId, parseFloat(amount));
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setAmount("");
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setLoading(false);
    }
  }

  const pnl = nav - deposited;
  const pnlPct = deposited > 0 ? (pnl / deposited) * 100 : 0;

  return (
    <main className="max-w-7xl mx-auto px-5 py-5">
      <div className="max-w-md mx-auto space-y-3">
        {/* Deposit / Withdraw form */}
        <Card>
          <CardBody className="space-y-4">
            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-void-800 rounded-xl">
              {(["deposit", "withdraw"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                    tab === t
                      ? "bg-blood-600 text-white"
                      : "text-void-500 hover:text-void-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Amount input */}
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-wider text-void-600">
                Amount (USDC)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  className="w-full bg-void-950 border border-void-800 rounded-xl px-4 py-3 text-xl font-mono font-bold text-void-100 placeholder:text-void-700 focus:outline-none focus:ring-2 focus:ring-blood-600 focus:border-transparent pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-mono text-void-500">
                  USDC
                </span>
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(q.toString())}
                    className="flex-1 py-1.5 bg-void-800 hover:bg-void-700 rounded-lg text-xs font-medium text-void-300 transition-colors"
                  >
                    ${q}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={loading || !amount}
              className="w-full py-3 bg-blood-600 hover:bg-blood-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing…
                </span>
              ) : success ? (
                "✓ Done!"
              ) : tab === "deposit" ? (
                "Deposit via Nanopayments"
              ) : (
                "Withdraw to wallet"
              )}
            </button>

            {error && (
              <p className="text-center text-xs text-blood-300">{error}</p>
            )}
            <p className="text-center text-xs text-void-600">
              Gas-free via Circle Nanopayments on Arc
            </p>
          </CardBody>
        </Card>

        {/* Your Position */}
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-void-200 mb-3">
              Your Position
            </h3>
            <div className="space-y-2">
              <Row
                label="Deposited"
                value={`$${deposited.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              />
              <Row
                label="Current value"
                value={`$${nav.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                valueClass="text-green-400"
              />
              <Row
                label="P&L"
                value={`${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)} (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%)`}
                valueClass={pnl >= 0 ? "text-green-400" : "text-blood-300"}
              />
              <Row
                label="Fund shares (HTS)"
                value={`${shares.toLocaleString("en-US", { minimumFractionDigits: 2 })} DAWG`}
                valueClass="font-mono text-void-200"
              />
            </div>
          </CardBody>
        </Card>

        {/* Agent Status */}
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-void-200 mb-3">
              Agent Status
            </h3>
            <div className="space-y-2">
              <Row
                label="Status"
                value={user?.agent.active ? "Active" : "Inactive"}
                valueClass={user?.agent.active ? "text-green-400" : "text-void-500"}
              />
              <Row
                label="Risk profile"
                value={user?.agent.riskProfile ?? "—"}
              />
              <Row
                label="Hunts run"
                value={String(user?.agent.lastCycleId ?? 0)}
              />
              {user?.agent.lastCycleAt && (
                <Row
                  label="Last hunt"
                  value={new Date(user.agent.lastCycleAt).toLocaleString()}
                />
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  valueClass = "text-void-200",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-void-500">{label}</span>
      <span className={`font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}
