"use client";

import { useEffect, useState } from "react";

/**
 * Shape this component consumes. Mirrors the ad-hoc `fund` object the
 * dashboard builds from `user.fund` + `user.agent.lastCycleId`. Keeping the
 * props loose (all optional / nullable) means the header gracefully renders
 * the "—" placeholders before the user record hydrates.
 */
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
  /** Whether the connected user has completed onboarding. Drives placeholders. */
  connected: boolean;
  /**
   * Live on-chain USDC balance of the agent's Circle MPC proxy wallet.
   * Piped from UserContext so every UI surface (nav, hero, wallet card,
   * deposit page) reads the exact same number and updates in lockstep.
   */
  agentBalance?: number | null;
  /** Timestamp (ms) of the most recent successful balance read, for freshness UI. */
  agentBalanceFetchedAt?: number | null;
}

// Keep the live read freshness banner readable in a glance.
function formatAgeSeconds(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 2) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ago`;
}

function formatCurrency(value: number, fractionDigits = 2): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

/**
 * Nasdaq Marketsite-style LED board.
 *
 * Stylistically mimics the pixelated tower display outside the Nasdaq
 * building in Times Square: pure black panel, bright yellow bitmap-style
 * text (VT323), CRT scanlines and a dot-matrix backdrop. Every visible
 * character uses the `.nasdaq-led*` classes declared in `globals.css`.
 *
 * Layout:
 *   • Top strip  — environment + fund identifiers + wall-clock
 *   • Headline   — oversized NAV digits + 24h change
 *   • Metric row — 4 tiles with observed or explicitly unavailable values
 *   • Crawl      — horizontal scrolling chain/proof-chain marquee
 */
export function NasdaqHeader({
  fund,
  connected,
  agentBalance = null,
  agentBalanceFetchedAt = null,
}: NasdaqHeaderProps) {
  const [clock, setClock] = useState<string>("");

  // Tick the wall-clock every second so the board visibly feels "live".
  // Rendered only client-side to avoid an SSR hydration mismatch. The
  // first tick is deferred via setTimeout(0) so we don't call setState
  // synchronously inside the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    const format = () =>
      new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "UTC",
      });
    const first = setTimeout(() => setClock(format()), 0);
    const id = setInterval(() => setClock(format()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  // agentBalance is piped in from UserContext so every UI surface reads the
  // same Arc RPC poll. null means either "not onboarded yet" or "first read
  // still in flight" — the UI renders "$—" in both cases.
  const hasObservedArcBalance = agentBalance != null;

  // The headline is an observed Arc RPC balance. A stored NAV snapshot is not
  // substituted when the observation is unavailable.
  const headlineNav = agentBalance;
  const navLabel =
    headlineNav != null ? formatCurrency(headlineNav) : "$—";

  return (
    <section
      className="nasdaq-led nasdaq-scanlines relative overflow-hidden rounded-2xl border-2 border-dawg-500/60 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_10px_50px_-10px_rgba(255,199,0,0.35)]"
      aria-label="AlphaDawg Nasdaq LED status board"
    >
      {/* Bright yellow tower accent bar (top edge) */}
      <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-dawg-500 to-transparent" />

      {/* Dot-matrix backdrop sits behind all content */}
      <div className="nasdaq-dot-matrix pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />

      <div className="relative">
        {/* ── Row 1: Exchange status strip ─────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dawg-500/20 px-5 py-2 text-xs uppercase">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-void-500" aria-hidden="true" />
              <span className="nasdaq-led-dim text-[18px] leading-none">TESTNET VIEW</span>
            </span>
            <LedSeparator />
            <span className="text-[18px] leading-none">
              VMF
              <span className="nasdaq-led-dim mx-2">·</span>
              <span className="nasdaq-led-bright">ALPHADAWG FUND</span>
            </span>
            <LedSeparator />
            <span className="nasdaq-led-dim hidden text-[16px] leading-none md:inline">
              PROTECTED JOB EVIDENCE · HEDERA · ARC
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="nasdaq-led-dim hidden text-[16px] leading-none tabular-nums sm:inline">
              {new Date()
                .toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "2-digit",
                  timeZone: "UTC",
                })
                .toUpperCase()}
            </span>
            {clock && (
              <>
                <LedSeparator />
                <span className="text-[18px] leading-none tabular-nums">{clock} UTC</span>
              </>
            )}
          </div>
        </div>

        {/* ── Row 2: Massive NAV headline + metric grid ─────────────────── */}
        <div className="grid grid-cols-1 gap-6 px-5 py-6 md:grid-cols-[auto_1fr] md:items-end md:gap-10">
          {/* Headline NAV */}
          <div>
            <div className="nasdaq-led-dim text-[18px] uppercase leading-none tracking-[0.22em]">
              OBSERVED ARC BALANCE · USD
            </div>
            <div className="mt-2 flex items-baseline gap-4">
              <span className="nasdaq-led-bright text-[72px] leading-[0.85] tabular-nums md:text-[104px]">
                {navLabel}
              </span>
              <div className="flex flex-col items-start gap-0.5">
                <span className="nasdaq-led-dim inline-flex items-center gap-1 text-[28px] leading-none tabular-nums">
                  <span aria-hidden="true">—</span>
                  <span>—</span>
                </span>
                <span className="nasdaq-led-dim text-[14px] uppercase leading-none tracking-wider">
                  24H CHANGE
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[16px] uppercase leading-none">
              <span className="nasdaq-led-dim">ARC BALANCE</span>
              <span
                className={`tabular-nums ${
                  hasObservedArcBalance ? "nasdaq-led-green" : ""
                }`}
                title={
                  agentBalanceFetchedAt
                    ? `Arc RPC direct read · fetched ${formatAgeSeconds(agentBalanceFetchedAt)}`
                    : undefined
                }
              >
                {agentBalance != null ? formatCurrency(agentBalance, 4) : "$—"}
              </span>
              <LedSeparator />
              {hasObservedArcBalance ? (
                <span className="nasdaq-led-green inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#39FF7A]" aria-hidden="true" />
                  ARC RPC · OBSERVED
                </span>
              ) : (
                <span className="nasdaq-led-dim">
                  {connected ? "WAITING FOR ARC RPC…" : "CONNECT WALLET"}
                </span>
              )}
            </div>
          </div>

          {/* Metric grid */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <LedTile
              label="HUNTS"
              value={fund ? formatNumber(fund.totalCycles) : "—"}
              sub="RECORDED CYCLES"
              tone="bright"
            />
            <LedTile
              label="SPEND"
              value="—"
              sub="NO CANONICAL TOTAL"
              tone="dim"
            />
            <LedTile
              label="INFERENCES"
              value="—"
              sub="PER-JOB EVIDENCE"
              tone="dim"
            />
            <LedTile
              label="WIN RATE"
              value="—"
              sub="PENDING P&L"
              tone="dim"
            />
          </div>
        </div>

        {/* ── Row 3: Scrolling crawl (Bloomberg-style marquee) ───────────── */}
        <div className="relative overflow-hidden border-t border-dawg-500/20 bg-black py-2.5">
          <div className="nasdaq-ticker-track whitespace-nowrap text-[20px] uppercase leading-none">
            <TickerStream fund={fund} headlineNav={headlineNav} observedArcBalance={agentBalance} />
            <TickerStream fund={fund} headlineNav={headlineNav} observedArcBalance={agentBalance} aria-hidden />
          </div>
          {/* Black fade edges so the loop point is invisible */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-black to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-black to-transparent" />
        </div>
      </div>
    </section>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

type LedTileTone = "bright" | "green" | "dim";

function LedTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: LedTileTone;
}) {
  const valueClass: Record<LedTileTone, string> = {
    bright: "nasdaq-led-bright",
    green: "nasdaq-led-green",
    dim: "nasdaq-led-dim",
  };
  return (
    <div className="rounded-lg border border-dawg-500/30 bg-black px-4 py-3 shadow-[inset_0_0_20px_rgba(255,199,0,0.04)]">
      <div className="nasdaq-led-dim text-[14px] uppercase leading-none tracking-[0.18em]">
        {label}
      </div>
      <div className={`mt-2 text-[34px] leading-[0.9] tabular-nums ${valueClass[tone]}`}>
        {value}
      </div>
      {sub && (
        <div className="nasdaq-led-dim mt-2 text-[13px] uppercase leading-none tracking-wider">
          {sub}
        </div>
      )}
    </div>
  );
}

function LedSeparator() {
  return (
    <span className="nasdaq-led-dim inline-block text-[18px] leading-none" aria-hidden="true">
      ||
    </span>
  );
}

/**
 * Inner content of the scrolling crawl. Two copies of this are rendered
 * side-by-side and slid 50% of the track width so the loop is seamless.
 */
function TickerStream({
  fund,
  headlineNav,
  observedArcBalance,
  ...props
}: {
  fund: NasdaqHeaderFund | null;
  /** Same figure as the hero FUND NAV (live Arc when available). */
  headlineNav: number | null;
  /** Arc RPC balance observation shown only when the read succeeded. */
  observedArcBalance: number | null;
} & React.HTMLAttributes<HTMLDivElement>) {
  const items: Array<{ label: string; value: string; tone: "up" | "neutral" | "bright" }> = [
    {
      label: "VMF",
      value: headlineNav != null ? formatCurrency(headlineNav) : "$—",
      tone: "bright",
    },
    { label: "24H Δ", value: "—", tone: "neutral" },
    {
      label: "ARC OBSERVED",
      value: observedArcBalance != null ? formatCurrency(observedArcBalance, 4) : "$—",
      tone: observedArcBalance != null ? "up" : "neutral",
    },
    { label: "HUNTS", value: fund ? formatNumber(fund.totalCycles) : "—", tone: "bright" },
    { label: "SPEND", value: "—", tone: "neutral" },
    { label: "INFERENCES", value: "—", tone: "neutral" },
    { label: "PROOF", value: "PER JOB", tone: "neutral" },
    { label: "NETWORKS", value: "0G · HEDERA · ARC", tone: "neutral" },
  ];

  return (
    <div className="flex shrink-0 items-center gap-8 pr-8" {...props}>
      {items.map((item, idx) => (
        <span key={`${item.label}-${idx}`} className="inline-flex items-center gap-2">
          <span className="nasdaq-led-dim">{item.label}</span>
          <span
            className={`tabular-nums ${
              item.tone === "up"
                ? "nasdaq-led-green"
                : item.tone === "bright"
                  ? "nasdaq-led-bright"
                  : ""
            }`}
          >
            {item.value}
          </span>
          {idx < items.length - 1 && <span className="nasdaq-led-dim">·</span>}
        </span>
      ))}
    </div>
  );
}
