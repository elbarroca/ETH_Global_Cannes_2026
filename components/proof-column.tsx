"use client";

import type { CycleResult } from "@/lib/api";

export function ProofColumn({ cycle }: { cycle: CycleResult }) {
  const specialists = cycle.specialists ?? [];

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="space-y-4">
      {/* Payment proofs */}
      <div className="bg-void-900 rounded-xl p-4 border border-void-800">
        <h4 className="text-[11px] font-medium text-void-600 uppercase tracking-wider mb-3">
          Specialist Payments
        </h4>
        {specialists.length > 0 ? (
          <div className="space-y-2">
            {specialists.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-void-600">#{i + 1}</span>
                  <span className="text-xs font-mono text-void-500 truncate max-w-[120px]">
                    {s.attestationHash.slice(0, 12)}…
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs ${
                      s.teeVerified ? "text-green-400" : "text-gold-400"
                    }`}
                  >
                    {s.teeVerified ? "✓" : "⚠"}
                  </span>
                  <button
                    onClick={() => copyToClipboard(s.attestationHash)}
                    className="text-xs text-void-600 hover:text-void-400 transition-colors"
                  >
                    📋
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-void-600">No payment data</p>
        )}
      </div>

      {/* TEE Attestations */}
      <div className="bg-void-900 rounded-xl p-4 border border-void-800">
        <h4 className="text-[11px] font-medium text-void-600 uppercase tracking-wider mb-3">
          TEE Attestations
        </h4>
        <div className="space-y-2">
          {specialists.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className={`text-sm ${s.teeVerified ? "text-green-400" : "text-gold-400"}`}
              >
                {s.teeVerified ? "✅" : "⚠️"}
              </span>
              <span className="text-xs text-void-400 capitalize">{s.name}</span>
            </div>
          ))}
          {specialists.length === 0 && (
            <p className="text-xs text-void-600">No attestations</p>
          )}
        </div>
      </div>

      {/* Hashscan link */}
      <a
        href={cycle.hashscanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full py-3 bg-teal-950/50 hover:bg-teal-900/50 border border-teal-800/30 rounded-xl text-teal-300 text-sm font-medium transition-colors"
      >
        📋 View on Hashscan ↗
      </a>
    </div>
  );
}
