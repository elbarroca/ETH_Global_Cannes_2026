"use client";

import Link from "next/link";
import { arcTxUrl } from "@/lib/links";
import type { PortfolioEvolutionPoint } from "@/lib/portfolio-types";

const ACTION_TINT: Record<string, string> = {
  BUY: "text-emerald-400/90 border-emerald-800/50 bg-emerald-950/35",
  SELL: "text-red-400/85 border-red-900/45 bg-red-950/30",
  HOLD: "text-dawg-400/90 border-dawg-800/40 bg-dawg-950/25",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatTxShort(hash: string | null): string {
  if (!hash || hash.length < 14) return "—";
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

export function AttributionLog({ evolution }: { evolution: PortfolioEvolutionPoint[] }) {
  const recent = evolution.slice(-15).reverse();

  if (recent.length === 0) {
    return (
      <div className="text-sm text-void-600 italic py-4">
        No hunts yet — attribution and swap hashes appear after your first committed cycle.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Column headers — desktop */}
      <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-3 px-3 pb-2 text-[10px] uppercase tracking-wider text-void-600 border-b border-void-800/40">
        <span>Hunt &amp; action</span>
        <span className="text-right font-mono">Arc tx</span>
        <span className="text-right">Links</span>
      </div>
      <ul className="space-y-2">
        {recent.map((p) => {
          const tint = ACTION_TINT[p.action.toUpperCase()] ?? "text-void-400 border-void-700";
          const showAttribution =
            p.action.toUpperCase() !== "HOLD" &&
            (p.attribution.specialist != null || p.attribution.signal != null);
          const tx = p.swapTxHash?.trim() ?? "";
          const arcHref = tx.startsWith("0x") ? arcTxUrl(tx) : null;

          return (
            <li
              key={p.cycleId}
              className="rounded-lg border border-void-800/60 bg-black/25 hover:border-void-700/80 hover:bg-void-950/50 transition-colors"
            >
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-3 px-3 py-3 sm:items-center">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`font-pixel text-[13px] px-2 py-0.5 rounded border tabular-nums shrink-0 mt-0.5 ${tint}`}
                  >
                    {p.action.toUpperCase()} {p.pct}%
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm text-void-200">
                      <span className="font-mono text-dawg-500/90">#{p.cycleNumber}</span>
                      <span className="text-void-600 mx-1.5">·</span>
                      <span className="text-void-100">{p.asset}</span>
                      {showAttribution && p.attribution.specialist && (
                        <>
                          {" "}
                          <span className="text-void-600">·</span>{" "}
                          <span className="text-void-400">driven by</span>{" "}
                          <span className="text-void-100 font-medium">
                            {p.attribution.specialist}
                          </span>
                          {p.attribution.confidence != null && (
                            <span className="text-void-500 text-xs">
                              {" "}
                              ({p.attribution.confidence}%)
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="text-[10px] text-void-600 font-mono mt-1">
                      {relativeTime(p.timestamp)} · NAV ${p.navAfter.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="flex sm:justify-end items-center min-h-[28px] pl-[52px] sm:pl-0 border-t border-void-800/50 sm:border-t-0 pt-2 sm:pt-0">
                  {arcHref ? (
                    <a
                      href={arcHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-dawg-400/95 hover:text-dawg-300 tabular-nums underline decoration-dotted decoration-dawg-600/40 truncate max-w-[200px] sm:max-w-[160px] sm:text-right"
                      title={tx}
                    >
                      {formatTxShort(tx)}
                    </a>
                  ) : (
                    <span
                      className="font-mono text-[11px] text-void-600 sm:text-right"
                      title="No Arc swap tx (HOLD, zero allocation, or pending)"
                    >
                      —
                    </span>
                  )}
                </div>

                <div className="flex sm:justify-end items-center gap-2 pl-[52px] sm:pl-0 border-t border-void-800/50 sm:border-t-0 pt-2 sm:pt-0">
                  <Link
                    href={`/verify?cycle=${p.cycleNumber}`}
                    className="text-[10px] font-mono text-void-500 hover:text-dawg-400/90 underline decoration-dotted decoration-void-700 shrink-0 transition-colors"
                  >
                    verify ↗
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
