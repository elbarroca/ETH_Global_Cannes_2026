"use client";

import type { CycleResult } from "@/lib/api";
import { SpecialistCard } from "./specialist-card";
import { DebateColumn } from "./debate-column";
import { ProofColumn } from "./proof-column";

export function CycleView({ cycle }: { cycle: CycleResult }) {
  const specialists = cycle.specialists ?? [];
  const exec = cycle.debate?.executor?.parsed;

  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-slate-400 font-mono text-sm">Cycle #{cycle.cycleId}</span>
          {exec && (
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                exec.action === "BUY"
                  ? "bg-green-500/20 text-green-400"
                  : exec.action === "SELL"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-yellow-500/20 text-yellow-400"
              }`}
            >
              {exec.action}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-green-400">LIVE</span>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr] gap-6 p-6">
        {/* Column 1: Specialists */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Specialists
          </h3>
          <div className="space-y-3">
            {specialists.length > 0 ? (
              specialists.map((s) => <SpecialistCard key={s.name} specialist={s} />)
            ) : (
              <p className="text-slate-600 text-sm">No specialist data yet</p>
            )}
          </div>
        </div>

        {/* Column 2: Adversarial Debate */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Adversarial Debate
          </h3>
          <DebateColumn cycle={cycle} />
        </div>

        {/* Column 3: Proof Chain */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
            Proof Chain
          </h3>
          <ProofColumn cycle={cycle} />
        </div>
      </div>
    </div>
  );
}
