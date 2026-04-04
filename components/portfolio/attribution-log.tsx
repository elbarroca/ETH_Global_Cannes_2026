"use client";

// Per-hunt attribution log: for each cycle that moved NAV, show the top-
// confidence specialist whose signal matched the executor's final decision.
// Answers the question "which specialist drove this position?" so judges
// can trace the money trail back to a specific named agent.

import Link from "next/link";

interface EvolutionPoint {
  cycleNumber: number;
  timestamp: string;
  action: string;
  asset: string;
  pct: number;
  navAfter: number;
  swapTxHash: string | null;
  attribution: {
    specialist: string | null;
    confidence: number | null;
    signal: string | null;
  };
}

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

export function AttributionLog({ evolution }: { evolution: EvolutionPoint[] }) {
  // Only show hunts that actually did something (BUY/SELL + attribution).
  const relevant = evolution
    .filter((p) => p.action && p.action.toUpperCase() !== "HOLD")
    .slice(-15) // most recent 15
    .reverse();

  if (relevant.length === 0) {
    return (
      <div className="text-sm text-void-600 italic py-4">
        No BUY/SELL cycles yet — attribution history will populate after your
        first committed swap.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {relevant.map((p) => {
        const tint = ACTION_TINT[p.action.toUpperCase()] ?? "text-void-400 border-void-700";
        return (
          <li
            key={p.cycleNumber}
            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-void-800 hover:border-void-700 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`font-pixel text-[14px] px-2 py-0.5 rounded border tabular-nums shrink-0 ${tint}`}
              >
                {p.action.toUpperCase()} {p.pct}%
              </span>
              <div className="min-w-0">
                <div className="text-sm text-void-200 truncate">
                  Hunt #{p.cycleNumber} · <span className="text-gold-400">{p.asset}</span>
                  {p.attribution.specialist && (
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
            <Link
              href={`/verify?cycle=${p.cycleNumber}`}
              className="text-[10px] font-mono text-teal-300 hover:text-teal-200 underline decoration-dotted shrink-0"
            >
              verify ↗
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
