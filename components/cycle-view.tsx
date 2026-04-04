"use client";

import type { CycleResult } from "@/lib/api";
import { SpecialistCard } from "./specialist-card";
import { DebateColumn } from "./debate-column";
import { ProofColumn } from "./proof-column";

export function CycleView({ cycle }: { cycle: CycleResult }) {
  const specialists = cycle.specialists ?? [];
  const exec = cycle.debate?.executor?.parsed as { action?: string; pct?: number; asset?: string } | undefined;

  return (
    <div className="bg-void-900 rounded-2xl border border-void-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-void-800">
        <div className="flex items-center gap-3">
          <span className="text-void-500 font-mono text-sm">Hunt #{cycle.cycleId}</span>
          {exec && (
            <span
              className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                exec.action === "BUY"
                  ? "bg-green-500/20 text-green-400"
                  : exec.action === "SELL"
                  ? "bg-blood-500/20 text-blood-300"
                  : "bg-gold-400/20 text-gold-400"
              }`}
            >
              {exec.action}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-blood-500 rounded-full animate-pulse" />
          <span className="text-xs text-blood-300 font-mono">LIVE</span>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr] gap-6 p-6">
        {/* Column 1: Pack */}
        <div>
          <h3 className="text-[11px] font-semibold text-void-600 uppercase tracking-wider mb-4">
            Pack
          </h3>
          <div className="space-y-3">
            {specialists.length > 0 ? (
              specialists.map((s) => <SpecialistCard key={s.name} specialist={s} />)
            ) : (
              <p className="text-void-600 text-sm">No specialist data yet</p>
            )}
          </div>
        </div>

        {/* Column 2: The Challenge */}
        <div>
          <h3 className="text-[11px] font-semibold text-void-600 uppercase tracking-wider mb-4">
            The Challenge
          </h3>
          <DebateColumn cycle={cycle} />
        </div>

        {/* Column 3: Proof Chain */}
        <div>
          <h3 className="text-[11px] font-semibold text-void-600 uppercase tracking-wider mb-4">
            Proof Chain
          </h3>
          <ProofColumn cycle={cycle} />
        </div>
      </div>
    </div>
  );
}
