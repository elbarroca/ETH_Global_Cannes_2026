"use client";

import type { SpecialistResult } from "@/lib/api";
import { arcTxUrl, truncateHash } from "@/lib/links";

// hiredBy is also exposed on the enriched cycle's specialists[] — this
// component accepts either shape because some call sites use SpecialistResult
// (pending) and others use the enriched cycle variant (live).
interface SpecialistCardProps {
  specialist: SpecialistResult & {
    hiredBy?: string;
    paymentTxHash?: string;
  };
}

const HIRER_STYLES: Record<string, string> = {
  alpha: "bg-green-500/15 text-green-400 border-green-500/30",
  risk: "bg-blood-500/15 text-blood-300 border-blood-500/30",
  executor: "bg-gold-400/15 text-gold-400 border-gold-400/30",
  "main-agent": "bg-void-800 text-void-400 border-void-700",
};

export function SpecialistCard({ specialist }: SpecialistCardProps) {
  const signalColor =
    specialist.signal === "BUY"
      ? "text-green-400"
      : specialist.signal === "SELL"
      ? "text-blood-300"
      : "text-gold-400";

  const hiredBy = specialist.hiredBy ?? "main-agent";
  const hirerClass = HIRER_STYLES[hiredBy] ?? HIRER_STYLES["main-agent"];
  const paymentUrl = specialist.paymentTxHash ? arcTxUrl(specialist.paymentTxHash) : null;

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

      {/* Hirer attribution — THE core "agent hiring economy" visual: which
          debate agent paid for this specialist's signal. */}
      <div className="mb-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${hirerClass}`}>
          hired by {hiredBy}
        </span>
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

      {/* Payment tx link — clickable when hierarchical hiring produced a real
          Arc tx. Falls back to the attestation hash display otherwise. */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[10px] text-void-600 font-mono truncate" title={specialist.attestationHash}>
          att {truncateHash(specialist.attestationHash, 6, 4)}
        </p>
        {paymentUrl ? (
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-teal-300 hover:text-teal-200 underline decoration-dotted"
            title={specialist.paymentTxHash}
          >
            ${(specialist.priceUsd ?? 0.001).toFixed(3)} ↗
          </a>
        ) : (
          <span className="text-[10px] text-void-600 font-mono">$0.001</span>
        )}
      </div>
    </div>
  );
}
