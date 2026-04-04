"use client";

import type { Cycle } from "@/lib/types";
import {
  arcTxUrl,
  hashscanTopicUrl,
  inftTokenUrl,
  ogStorageUrl,
  truncateHash,
} from "@/lib/links";

// ProofColumn renders the cryptographic proof chain for a cycle:
//   1. Agent-to-agent payment graph (who hired whom, with Arc tx links)
//   2. TEE attestations (one per specialist)
//   3. Final Arc swap tx (if executor decided to trade)
//   4. HCS audit record (Hedera topic)
//   5. 0G Storage CID (rich record on decentralized storage)
//   6. iNFT metadata update (0G Chain)
//
// Every link is conditional — we render "—" rather than a broken link so
// degraded cycles remain honest about what proofs landed.

const HIRER_COLOR: Record<string, string> = {
  alpha: "text-green-400",
  mid: "text-blue-400",
  risk: "text-blood-300",
  executor: "text-gold-400",
  "main-agent": "text-void-500",
};

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function Row({
  label,
  value,
  href,
  mono = true,
}: {
  label: string;
  value: string;
  href?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-void-500">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs text-teal-300 hover:text-teal-200 underline decoration-dotted truncate ${mono ? "font-mono" : ""}`}
          title={value}
        >
          {value} ↗
        </a>
      ) : (
        <span className={`text-xs text-void-600 truncate ${mono ? "font-mono" : ""}`} title={value}>
          {value}
        </span>
      )}
    </div>
  );
}

export function ProofColumn({ cycle }: { cycle: Cycle }) {
  const payments = cycle.payments ?? [];
  const specialists = cycle.specialists ?? [];
  const hashscanHref = cycle.hcs?.topicId && cycle.hcs.topicId !== "0.0.unknown"
    ? hashscanTopicUrl(cycle.hcs.topicId)
    : null;
  const storageHref = cycle.storageHash ? ogStorageUrl(cycle.storageHash) : null;
  const inftHref = cycle.inftTokenId ? inftTokenUrl(cycle.inftTokenId) : null;
  const swapHref = cycle.swap?.txHash ? (cycle.swap.explorerUrl ?? arcTxUrl(cycle.swap.txHash)) : null;

  return (
    <div className="space-y-4">
      {/* 1. Agent-to-agent payment graph */}
      <div className="bg-void-900 rounded-xl p-4 border border-void-800">
        <h4 className="text-[11px] font-medium text-void-600 uppercase tracking-wider mb-3">
          Payment Graph
        </h4>
        {payments.length > 0 ? (
          <div className="space-y-2">
            {payments.map((p, i) => {
              const href = arcTxUrl(p.txHash);
              const hirerClass = HIRER_COLOR[p.hiredBy] ?? "text-void-500";
              return (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`font-semibold ${hirerClass}`}>{p.hiredBy}</span>
                    <span className="text-void-600">→</span>
                    <span className="text-void-300 truncate">{p.to}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-void-500">${p.amount.toString()}</span>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-teal-300 hover:text-teal-200 underline decoration-dotted"
                        title={p.txHash}
                      >
                        {truncateHash(p.txHash, 4, 4)} ↗
                      </a>
                    ) : (
                      <span className="font-mono text-void-600">pending</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-void-600">No payment data</p>
        )}
      </div>

      {/* 2. TEE Attestations */}
      <div className="bg-void-900 rounded-xl p-4 border border-void-800">
        <h4 className="text-[11px] font-medium text-void-600 uppercase tracking-wider mb-3">
          TEE Attestations
        </h4>
        <div className="space-y-2">
          {specialists.length > 0 ? (
            specialists.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-void-400 capitalize truncate">{s.name}</span>
                  {s.hiredBy && s.hiredBy !== "main-agent" && (
                    <span className={`text-[9px] uppercase ${HIRER_COLOR[s.hiredBy] ?? "text-void-500"}`}>
                      ({s.hiredBy})
                    </span>
                  )}
                </div>
                <button
                  onClick={() => copyToClipboard(s.attestation)}
                  className="text-[10px] font-mono text-void-500 hover:text-void-300 transition-colors shrink-0"
                  title={`Copy ${s.attestation}`}
                >
                  {truncateHash(s.attestation, 6, 4)} 📋
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-void-600">No attestations</p>
          )}
        </div>
      </div>

      {/* 3-6. Proof chain — Arc swap, HCS, 0G Storage, iNFT */}
      <div className="bg-void-900 rounded-xl p-4 border border-void-800 space-y-2">
        <h4 className="text-[11px] font-medium text-void-600 uppercase tracking-wider mb-2">
          Proof Chain
        </h4>
        <Row
          label="Arc swap"
          value={cycle.swap?.txHash ? truncateHash(cycle.swap.txHash, 6, 4) : "—"}
          href={swapHref}
        />
        <Row
          label="HCS audit"
          value={cycle.hcs?.sequenceNumber ? `seq #${cycle.hcs.sequenceNumber}` : "—"}
          href={hashscanHref}
          mono={false}
        />
        <Row
          label="0G storage"
          value={cycle.storageHash ? truncateHash(cycle.storageHash, 6, 4) : "—"}
          href={storageHref}
        />
        <Row
          label="iNFT update"
          value={cycle.inftTokenId ? `#${cycle.inftTokenId}` : "—"}
          href={inftHref}
          mono={false}
        />
      </div>
    </div>
  );
}
