"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { MOCK_FUND, MOCK_TRANSACTIONS } from "@/lib/mock-data";

type Tab = "deposit" | "withdraw";
const QUICK_AMOUNTS = [1, 10, 50, 100];

export default function DepositPage() {
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fund = MOCK_FUND;

  async function handleSubmit() {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
    setAmount("");
  }

  const pnl = fund.userValue - fund.userDeposited;
  const pnlPct = (pnl / fund.userDeposited) * 100;

  return (
    <main className="max-w-6xl mx-auto px-4 py-5">
      <div className="max-w-md mx-auto space-y-3">
        {/* Deposit / Withdraw form */}
        <Card>
          <CardBody className="space-y-4">
            {/* Tab switcher */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              {(["deposit", "withdraw"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                    tab === t
                      ? "bg-gray-900 text-white"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Amount input */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-gray-400">
                Amount (USDC)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-semibold text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-purple-500 pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-mono text-gray-400">
                  USDC
                </span>
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(q.toString())}
                    className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-600 transition-colors"
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
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
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

            <p className="text-center text-xs text-gray-400">
              Gas-free via Circle Nanopayments on Arc
            </p>
          </CardBody>
        </Card>

        {/* Your Position */}
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Your Position
            </h3>
            <div className="space-y-2">
              <Row
                label="Deposited"
                value={`$${fund.userDeposited.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
              />
              <Row
                label="Current value"
                value={`$${fund.userValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                valueClass="text-emerald-500"
              />
              <Row
                label="P&L"
                value={`+$${pnl.toFixed(2)} (+${pnlPct.toFixed(2)}%)`}
                valueClass="text-emerald-500"
              />
              <Row
                label="Fund shares (HTS)"
                value={`${fund.userShares.toLocaleString("en-US", { minimumFractionDigits: 2 })} VM`}
                valueClass="font-mono"
              />
            </div>
          </CardBody>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">
              Recent Transactions
            </h3>
            <div className="space-y-2.5">
              {MOCK_TRANSACTIONS.map((tx, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-500 text-sm">↓</span>
                    <div>
                      <div className="text-sm text-gray-700">
                        {tx.type}
                      </div>
                      <div className="text-xs text-gray-400">{tx.timeAgo}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-emerald-500">
                      +${tx.amount.toFixed(2)}
                    </div>
                    <div className="text-xs font-mono text-gray-400">{tx.hash}</div>
                  </div>
                </div>
              ))}
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
  valueClass = "text-gray-900",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}
