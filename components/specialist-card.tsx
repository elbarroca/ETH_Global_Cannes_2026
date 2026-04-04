"use client";

import type { SpecialistResult } from "@/lib/api";

export function SpecialistCard({ specialist }: { specialist: SpecialistResult }) {
  const signalColor =
    specialist.signal === "BUY"
      ? "text-green-400"
      : specialist.signal === "SELL"
      ? "text-blood-300"
      : "text-gold-400";

  return (
    <div className="bg-void-900 rounded-xl p-4 border border-void-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium text-void-600 uppercase tracking-wider">
          {specialist.name}
        </span>
        {specialist.teeVerified ? (
          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-md border border-green-500/30">
            ✅ TEE
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 bg-gold-400/20 text-gold-400 rounded-md border border-gold-400/30">
            ⚠️ Unverified
          </span>
        )}
      </div>

      <div className={`text-2xl font-bold ${signalColor} mb-2`}>{specialist.signal}</div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-void-500">
          <span>Confidence</span>
          <span className="text-void-200">{specialist.confidence}%</span>
        </div>
        <div className="w-full bg-void-800 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${
              specialist.confidence >= 70
                ? "bg-green-500"
                : specialist.confidence >= 50
                ? "bg-gold-400"
                : "bg-blood-500"
            }`}
            style={{ width: `${specialist.confidence}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-void-600 font-mono mt-2 truncate" title={specialist.attestationHash}>
        {specialist.attestationHash.slice(0, 20)}…
      </p>
    </div>
  );
}
