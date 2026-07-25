"use client";

export interface NasdaqHeaderFund {
  nav: number;
  navChange24h?: number | null;
  totalCycles: number;
  totalSpend: number;
  totalPayments: number;
  totalInferences: number;
}

interface NasdaqHeaderProps {
  fund: NasdaqHeaderFund | null;
  connected: boolean;
  agentBalance?: number | null;
  agentBalanceFetchedAt?: number | null;
}

function formatAgeSeconds(ms: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 2) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function formatCurrency(value: number, fractionDigits = 2): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

/** Compact account summary. Every number remains observed or explicitly unavailable. */
export function NasdaqHeader({
  fund,
  connected,
  agentBalance = null,
  agentBalanceFetchedAt = null,
}: NasdaqHeaderProps) {
  const hasObservedBalance = agentBalance !== null;

  return (
    <section
      className="rounded-2xl border border-void-800 bg-void-950/65 px-4 py-4 sm:px-5"
      aria-labelledby="account-summary-title"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-void-500">Observed account state</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="account-summary-title" className="text-2xl font-semibold tracking-tight text-void-100 sm:text-3xl">
              {hasObservedBalance ? formatCurrency(agentBalance) : "$—"}
            </h2>
            <span className="text-sm text-void-500">Arc agent wallet</span>
          </div>
          <p className="mt-2 text-xs text-void-500">
            {hasObservedBalance
              ? `Direct Arc RPC read${agentBalanceFetchedAt ? ` · fetched ${formatAgeSeconds(agentBalanceFetchedAt)}` : ""}`
              : connected
                ? "Waiting for a direct Arc RPC read. No stored balance is substituted."
                : "Connect a wallet to request the direct Arc RPC balance."}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4 lg:min-w-[31rem]">
          <SummaryValue label="Recorded hunts" value={fund ? fund.totalCycles.toLocaleString("en-US") : "—"} />
          <SummaryValue label="Canonical spend" value="—" />
          <SummaryValue label="Inferences" value="—" />
          <SummaryValue label="24h change" value="—" />
        </dl>
      </div>
    </section>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-void-600">{label}</dt>
      <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-void-200">{value}</dd>
    </div>
  );
}
