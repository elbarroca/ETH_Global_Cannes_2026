"use client";

import type { SpecialistResult } from "@/lib/api";

export function SpecialistCard({ specialist }: { specialist: SpecialistResult }) {
  const signalColor =
    specialist.signal === "BUY"
      ? "text-green-400"
      : specialist.signal === "SELL"
      ? "text-red-400"
      : "text-yellow-400";

  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {specialist.name}
        </span>
        {specialist.teeVerified ? (
          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
            ✅ TEE
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-full border border-yellow-500/30">
            ⚠️ Unverified
          </span>
        )}
      </div>

      <div className={`text-2xl font-bold ${signalColor} mb-2`}>{specialist.signal}</div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Confidence</span>
          <span className="text-slate-300">{specialist.confidence}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${
              specialist.confidence >= 70
                ? "bg-green-500"
                : specialist.confidence >= 50
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
            style={{ width: `${specialist.confidence}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-slate-600 font-mono mt-2 truncate" title={specialist.attestationHash}>
        {specialist.attestationHash.slice(0, 20)}…
      </p>
    </div>
  );
}
