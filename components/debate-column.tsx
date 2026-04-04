"use client";

import type { CycleResult } from "@/lib/api";

export function DebateColumn({ cycle }: { cycle: CycleResult }) {
  const alpha = cycle.debate?.alpha?.parsed as { action?: string; pct?: number; asset?: string; thesis?: string } | undefined;
  const risk = cycle.debate?.risk?.parsed as { maxSafePct?: number; objection?: string } | undefined;
  const exec = cycle.debate?.executor?.parsed as { action?: string; pct?: number; asset?: string; sl?: number; reasoning?: string } | undefined;

  return (
    <div className="space-y-4">
      {/* Alpha */}
      <div className="bg-void-900 rounded-xl p-4 border border-green-500/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-xs font-medium text-green-400 uppercase tracking-wider">
            Alpha Agent
          </span>
        </div>
        {alpha ? (
          <>
            <div className="text-lg font-bold text-void-100">
              {alpha.action} {alpha.pct}% {alpha.asset}
            </div>
            {alpha.thesis && (
              <p className="text-sm text-void-400 mt-2 italic">"{alpha.thesis}"</p>
            )}
          </>
        ) : (
          <p className="text-void-500 text-sm">No data</p>
        )}
      </div>

      <div className="flex justify-center">
        <div className="w-0.5 h-4 bg-void-800" />
      </div>

      {/* Risk */}
      <div className="bg-void-900 rounded-xl p-4 border border-blood-500/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 bg-blood-500 rounded-full" />
          <span className="text-xs font-medium text-blood-300 uppercase tracking-wider">
            Risk Agent
          </span>
        </div>
        {risk ? (
          <>
            <div className="text-lg font-bold text-void-100">MAX {risk.maxSafePct}%</div>
            {risk.objection && (
              <p className="text-sm text-void-400 mt-2 italic">"{risk.objection}"</p>
            )}
          </>
        ) : (
          <p className="text-void-500 text-sm">No data</p>
        )}
      </div>

      <div className="flex justify-center">
        <div className="w-0.5 h-4 bg-void-800" />
      </div>

      {/* Executor */}
      <div className="bg-void-900 rounded-xl p-4 border border-gold-400/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 bg-gold-400 rounded-full" />
          <span className="text-xs font-medium text-gold-400 uppercase tracking-wider">
            Executor
          </span>
        </div>
        {exec ? (
          <>
            <div className="text-lg font-bold text-void-100">
              {exec.action} {exec.pct}% {exec.asset}
              {exec.sl !== undefined && (
                <span className="text-sm text-void-400 ml-2">SL {exec.sl}%</span>
              )}
            </div>
            {exec.reasoning && (
              <p className="text-sm text-void-400 mt-2 italic">"{exec.reasoning}"</p>
            )}
          </>
        ) : (
          <p className="text-void-500 text-sm">No data</p>
        )}
      </div>
    </div>
  );
}
