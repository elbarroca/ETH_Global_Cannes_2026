"use client";

import type { CycleResult } from "@/lib/api";

export function DebateColumn({ cycle }: { cycle: CycleResult }) {
  const alpha = cycle.debate?.alpha?.parsed;
  const risk = cycle.debate?.risk?.parsed;
  const exec = cycle.debate?.executor?.parsed;

  return (
    <div className="space-y-4">
      {/* Alpha */}
      <div className="bg-slate-800 rounded-xl p-4 border border-green-500/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-xs font-medium text-green-400 uppercase tracking-wider">
            Alpha Agent
          </span>
        </div>
        {alpha ? (
          <>
            <div className="text-lg font-bold text-white">
              {alpha.action} {alpha.pct}% {alpha.asset}
            </div>
            {alpha.thesis && (
              <p className="text-sm text-slate-400 mt-2 italic">"{alpha.thesis}"</p>
            )}
          </>
        ) : (
          <p className="text-slate-500 text-sm">No data</p>
        )}
      </div>

      <div className="flex justify-center">
        <div className="w-0.5 h-4 bg-slate-700" />
      </div>

      {/* Risk */}
      <div className="bg-slate-800 rounded-xl p-4 border border-red-500/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 bg-red-500 rounded-full" />
          <span className="text-xs font-medium text-red-400 uppercase tracking-wider">
            Risk Agent
          </span>
        </div>
        {risk ? (
          <>
            <div className="text-lg font-bold text-white">MAX {risk.maxSafePct}%</div>
            {risk.objection && (
              <p className="text-sm text-slate-400 mt-2 italic">"{risk.objection}"</p>
            )}
          </>
        ) : (
          <p className="text-slate-500 text-sm">No data</p>
        )}
      </div>

      <div className="flex justify-center">
        <div className="w-0.5 h-4 bg-slate-700" />
      </div>

      {/* Executor */}
      <div className="bg-slate-800 rounded-xl p-4 border border-indigo-500/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 bg-indigo-500 rounded-full" />
          <span className="text-xs font-medium text-indigo-400 uppercase tracking-wider">
            Executor
          </span>
        </div>
        {exec ? (
          <>
            <div className="text-lg font-bold text-white">
              {exec.action} {exec.pct}% {exec.asset}
              {exec.sl !== undefined && (
                <span className="text-sm text-slate-400 ml-2">SL {exec.sl}%</span>
              )}
            </div>
            {exec.reasoning && (
              <p className="text-sm text-slate-400 mt-2 italic">"{exec.reasoning}"</p>
            )}
          </>
        ) : (
          <p className="text-slate-500 text-sm">No data</p>
        )}
      </div>
    </div>
  );
}
