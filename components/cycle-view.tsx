"use client";

import type { Cycle } from "@/lib/types";
import { SpecialistCard } from "./specialist-card";
import { DebateColumn } from "./debate-column";
import { ProofColumn } from "./proof-column";

// Standalone 3-column cycle layout. The dashboard uses its own inline
// PackColumn/ChallengeColumn/RightColumn triad; this component is the
// reusable alternative for any page that wants the same layout (e.g. a
// future /verify detail view).
export function CycleView({ cycle }: { cycle: Cycle }) {
  const action = cycle.trade.action;

  return (
    <div className="bg-void-900 rounded-2xl border border-void-800 overflow-hidden">
      {/* Header — cycle ID + user goal + live badge */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-void-800 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-void-500 font-mono text-sm shrink-0">Hunt #{cycle.id}</span>
          <span
            className={`px-2 py-0.5 rounded-md text-xs font-bold shrink-0 ${
              action === "BUY"
                ? "bg-green-500/20 text-green-400"
                : action === "SELL"
                ? "bg-blood-500/20 text-blood-300"
                : "bg-gold-400/20 text-gold-400"
            }`}
          >
            {action}
          </span>
          {cycle.goal && (
            <span className="text-xs text-void-500 italic truncate" title={cycle.goal}>
              &ldquo;{cycle.goal}&rdquo;
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
            {cycle.specialists.length > 0 ? (
              cycle.specialists.map((s, i) => (
                <SpecialistCard
                  key={`${s.name}-${i}`}
                  specialist={{
                    name: s.name,
                    signal: s.signal ?? "HOLD",
                    confidence: s.confidence ?? 0,
                    reasoning: s.reasoning,
                    attestationHash: s.attestation,
                    teeVerified: true,
                    hiredBy: s.hiredBy,
                    paymentTxHash: s.paymentTxHash,
                    priceUsd: s.price,
                  }}
                />
              ))
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
