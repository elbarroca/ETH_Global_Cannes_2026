"use client";

import { useEffect, useState } from "react";
import { getWalletBalance, type WalletBalanceResponse } from "@/lib/api";

/**
 * Shape this component consumes. Mirrors the ad-hoc `fund` object the
 * dashboard builds from `user.fund` + `user.agent.lastCycleId`. Keeping the
 * props loose (all optional / nullable) means the header gracefully renders
 * the "—" placeholders before the user record hydrates.
 */
export interface NasdaqHeaderFund {
  nav: number;
  navChange24h?: number | null;
  deposited?: number | null;
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
   * User id. When provided, the header polls /api/wallet/balance/:userId every
   * few seconds and overrides `fund.deposited` with the live Circle MPC proxy
   * wallet balance. Without a userId the component falls back to the prop
   * value (the DB accounting number piped through the user context).
   */
  userId?: string | null;
  /** Polling interval in ms. Defaults to 5s which feels live without hammering Circle. */
  pollMs?: number;
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
 *   • Top strip  — LIVE dot + fund identifiers + wall-clock
 *   • Headline   — oversized NAV digits + 24h change
 *   • Metric row — 4 tiles (hunts / pack spend / 0G sealed / win rate)
 *   • Crawl      — horizontal scrolling chain/proof-chain marquee
 */
export function NasdaqHeader({
  fund,
  connected,
  userId,
  pollMs = 5_000,
}: NasdaqHeaderProps) {
  const [clock, setClock] = useState<string>("");
  const [liveBalance, setLiveBalance] = useState<WalletBalanceResponse | null>(
    null,
  );

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
      });
    const first = setTimeout(() => setClock(format()), 0);
    const id = setInterval(() => setClock(format()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  // Poll the live proxy + hot wallet balance. This is what makes the
  // DEPOSITED readout real-time — `fund.deposited` is a DB accounting number
  // that only moves on deposit/withdraw/swap events, so the hero was showing
  // stale values whenever the proxy received USDC out-of-band.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const tick = async () => {
      const data = await getWalletBalance(userId);
      if (!cancelled && data) setLiveBalance(data);
    };
    // Kick off the first read on the next tick so we don't setState
    // synchronously inside the effect body.
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [userId, pollMs]);

  // Prefer the live Circle/Arc read; fall back to the DB value piped in via
  // fund.deposited. Only the proxy wallet is treated as "deposited" for the
  // hero — the hot wallet is transient execution scratch space and would
  // confuse the total if added here.
  const liveProxyUsdc = liveBalance?.proxyUsdc ?? null;
  const depositedForDisplay =
    liveProxyUsdc != null ? liveProxyUsdc : fund?.deposited ?? null;
  const depositedIsLive = liveProxyUsdc != null;
  const depositedStale = liveBalance?.errors.proxy != null;

  const navLabel = fund ? formatCurrency(fund.nav) : "$------";
  const change = fund?.navChange24h ?? 0;
  const hasChange = fund?.navChange24h != null && !Number.isNaN(change);
  const changePositive = change >= 0;

  return (
    <section
      className="nasdaq-led nasdaq-scanlines relative overflow-hidden rounded-2xl border-2 border-dawg-500/60 shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_10px_50px_-10px_rgba(255,199,0,0.35)]"
      aria-label="AlphaDawg Nasdaq LED ticker"
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
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#39FF7A] opacity-60" />
                <span className="nasdaq-led-green relative inline-flex h-2.5 w-2.5 rounded-full bg-[#39FF7A]" />
              </span>
              <span className="nasdaq-led-green text-[18px] leading-none">LIVE</span>
            </span>
            <LedSeparator />
            <span className="text-[18px] leading-none">
              VMF
              <span className="nasdaq-led-dim mx-2">·</span>
              <span className="nasdaq-led-bright">ALPHADAWG FUND</span>
            </span>
            <LedSeparator />
            <span className="nasdaq-led-dim hidden text-[16px] leading-none md:inline">
              0G SEALED TEE · HEDERA HCS · ARC USDC · X402
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="nasdaq-led-dim hidden text-[16px] leading-none tabular-nums sm:inline">
              {new Date()
                .toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "2-digit",
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
              FUND NAV · USD
            </div>
            <div className="mt-2 flex items-baseline gap-4">
              <span className="nasdaq-led-bright text-[72px] leading-[0.85] tabular-nums md:text-[104px]">
                {navLabel}
              </span>
              <div className="flex flex-col items-start gap-0.5">
                <span
                  className={`inline-flex items-center gap-1 text-[28px] leading-none tabular-nums ${
                    hasChange
                      ? changePositive
                        ? "nasdaq-led-green"
                        : "nasdaq-led-red"
                      : "nasdaq-led-dim"
                  }`}
                >
                  <span aria-hidden="true">
                    {hasChange ? (changePositive ? "▲" : "▼") : "—"}
                  </span>
                  <span>
                    {hasChange
                      ? `${changePositive ? "+" : ""}${change.toFixed(2)}%`
                      : "0.00%"}
                  </span>
                </span>
                <span className="nasdaq-led-dim text-[14px] uppercase leading-none tracking-wider">
                  24H CHANGE
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[16px] uppercase leading-none">
              <span className="nasdaq-led-dim">DEPOSITED</span>
              <span
                className={`tabular-nums ${
                  depositedIsLive ? "nasdaq-led-green" : ""
                }`}
                title={
                  liveBalance
                    ? `Circle MPC proxy ${liveBalance.proxyAddress ?? ""} · fetched ${formatAgeSeconds(liveBalance.fetchedAt)}`
                    : undefined
                }
              >
                {depositedForDisplay != null
                  ? formatCurrency(depositedForDisplay, 4)
                  : "$—"}
              </span>
              <LedSeparator />
              {depositedIsLive ? (
                <span className="nasdaq-led-green inline-flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#39FF7A] opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#39FF7A]" />
                  </span>
                  LIVE · ARC ONCHAIN
                </span>
              ) : depositedStale ? (
                <span className="nasdaq-led-red">CIRCLE UNREACHABLE · SHOWING DB</span>
              ) : (
                <span className="nasdaq-led-dim">
                  {connected ? "ONCHAIN · SETTLED" : "CONNECT WALLET"}
                </span>
              )}
            </div>
          </div>

          {/* Metric grid */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <LedTile
              label="HUNTS"
              value={fund ? formatNumber(fund.totalCycles) : "—"}
              sub="ALL SEALED"
              tone="bright"
            />
            <LedTile
              label="PACK SPEND"
              value={fund ? formatCurrency(fund.totalSpend, 3) : "—"}
              sub={fund ? `${fund.totalPayments} X402 CALLS` : "0 CALLS"}
              tone="bright"
            />
            <LedTile
              label="0G SEALED"
              value={fund ? formatNumber(fund.totalInferences) : "—"}
              sub={fund && fund.totalCycles > 0 ? "6 PER HUNT · TEE ✓" : "TEE VERIFIED"}
              tone="green"
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
            <TickerStream fund={fund} liveDeposited={liveProxyUsdc} />
            <TickerStream fund={fund} liveDeposited={liveProxyUsdc} aria-hidden />
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
  liveDeposited,
  ...props
}: {
  fund: NasdaqHeaderFund | null;
  /** Live Circle MPC proxy balance — shown as CUSTODY so the crawl matches
      the DEPOSITED hero line when the wallet balance endpoint is reachable. */
  liveDeposited: number | null;
} & React.HTMLAttributes<HTMLDivElement>) {
  const items: Array<{ label: string; value: string; tone: "up" | "neutral" | "bright" }> = [
    { label: "VMF", value: fund ? formatCurrency(fund.nav) : "$—", tone: "bright" },
    { label: "24H Δ", value: "0.00%", tone: "neutral" },
    {
      label: "CUSTODY",
      value:
        liveDeposited != null
          ? formatCurrency(liveDeposited, 4)
          : fund?.deposited != null
            ? formatCurrency(fund.deposited, 4)
            : "$—",
      tone: liveDeposited != null ? "up" : "neutral",
    },
    { label: "HUNTS", value: fund ? formatNumber(fund.totalCycles) : "—", tone: "up" },
    { label: "X402 PAID", value: fund ? formatCurrency(fund.totalSpend, 3) : "—", tone: "up" },
    { label: "TEE ATTESTATIONS", value: fund ? formatNumber(fund.totalInferences) : "—", tone: "bright" },
    { label: "SEALED", value: "100%", tone: "up" },
    { label: "SWARM ONLINE", value: "13/13", tone: "up" },
    { label: "CHAIN", value: "0G · HEDERA · ARC", tone: "neutral" },
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
