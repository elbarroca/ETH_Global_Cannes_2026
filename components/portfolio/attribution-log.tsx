"use client";

import Link from "next/link";
import { useState } from "react";
import { DebateTheater } from "@/components/debate-theater";
import type { PortfolioEvolutionPoint } from "@/lib/portfolio-types";

const ACTION_TINT: Record<string, string> = {
  BUY: "text-[#39FF7A] border-emerald-500/40 bg-emerald-500/5",
  SELL: "text-[#FF5A5A] border-blood-500/40 bg-blood-500/5",
  HOLD: "text-[#FFC700] border-dawg-500/40 bg-dawg-500/5",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function AttributionLog({
  evolution,
  userId,
}: {
  evolution: PortfolioEvolutionPoint[];
  userId: string;
}) {
  const [openCycleId, setOpenCycleId] = useState<string | null>(null);

  const recent = evolution.slice(-15).reverse();

  if (recent.length === 0) {
    return (
      <div className="text-sm text-void-600 italic py-4">
        No hunts yet — attribution and debate flow will appear after your first cycle.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {recent.map((p) => {
        const tint = ACTION_TINT[p.action.toUpperCase()] ?? "text-void-400 border-void-700";
        const expanded = openCycleId === p.cycleId;
        const showAttribution =
          p.action.toUpperCase() !== "HOLD" &&
          (p.attribution.specialist != null || p.attribution.signal != null);

        return (
          <li
            key={p.cycleId}
            className="rounded-lg border border-void-800 bg-void-950/30 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span
                  className={`font-pixel text-[14px] px-2 py-0.5 rounded border tabular-nums shrink-0 ${tint}`}
                >
                  {p.action.toUpperCase()} {p.pct}%
                </span>
                <div className="min-w-0">
                  <div className="text-sm text-void-200 truncate">
                    Hunt #{p.cycleNumber} · <span className="text-gold-400">{p.asset}</span>
                    {showAttribution && p.attribution.specialist && (
                      <>
                        {" "}
                        <span className="text-void-600">driven by</span>{" "}
                        <span className="text-void-100 font-semibold">
                          {p.attribution.specialist}
                        </span>
                        {p.attribution.confidence != null && (
                          <span className="text-void-500">
                            {" "}
                            ({p.attribution.confidence}% conf)
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="text-[10px] text-void-600 font-mono">
                    {relativeTime(p.timestamp)} · NAV ${p.navAfter.toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setOpenCycleId(expanded ? null : p.cycleId)}
                  className="text-[10px] font-mono text-dawg-400 hover:text-dawg-300 underline decoration-dotted"
                >
                  {expanded ? "hide flow" : "debate flow"}
                </button>
                <Link
                  href={`/verify?cycle=${p.cycleNumber}`}
                  className="text-[10px] font-mono text-teal-300 hover:text-teal-200 underline decoration-dotted"
                >
                  verify ↗
                </Link>
              </div>
            </div>
            {expanded && (
              <div className="border-t border-void-800 px-2 pb-3 pt-2">
                <DebateTheater
                  cycleUuid={p.cycleId}
                  userId={userId}
                  cycleNumber={p.cycleNumber}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
