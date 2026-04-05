"use client";

import { useState, useEffect } from "react";

interface NaryoEvent {
  id: string;
  source: string;
  chain: string;
  eventType: string;
  txHash: string | null;
  data?: unknown;
  createdAt: string;
  correlationId?: string | null;
}

interface NaryoCorrelation {
  id: string;
  description: string;
  chains: string[];
  proofTxHash: string | null;
  createdAt: string;
}

const CHAIN_LABELS: Record<string, { label: string; color: string }> = {
  hedera: { label: "Hedera", color: "text-blue-400" },
  "0g-chain": { label: "0G Chain", color: "text-purple-400" },
};

const SOURCE_LABELS: Record<string, string> = {
  hcs: "HCS Message",
  hts: "HTS Transfer",
  cycle: "Cycle Event",
  deposit: "Deposit Event",
  "og-mint": "iNFT Minted",
  "og-metadata": "Metadata Updated",
  specialist: "Specialist Hired",
  heartbeat: "Heartbeat",
  "cross-chain": "Cross-chain Proof",
};

export function NaryoFeed() {
  const [events, setEvents] = useState<NaryoEvent[]>([]);
  const [correlations, setCorrelations] = useState<NaryoCorrelation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFeed() {
      try {
        const res = await fetch("/api/naryo/feed");
        if (!res.ok) return;
        const data = await res.json();
        setEvents(data.events ?? []);
        setCorrelations(data.correlations ?? []);
      } catch { /* non-fatal */ }
      finally { setLoading(false); }
    }
    fetchFeed();
    const interval = setInterval(fetchFeed, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-5 h-5 border-2 border-blood-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-6 space-y-2">
        <p className="text-sm text-void-500">No events yet.</p>
        <p className="text-xs text-void-600">
          Start Naryo with <code className="bg-void-800 px-1.5 py-0.5 rounded text-void-400">npm run naryo:up</code> and trigger a hunt or deposit.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Correlation badges */}
      {correlations.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-2 border-b border-void-800">
          {correlations.slice(0, 3).map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-gold-400/10 border border-gold-400/30 rounded-lg text-xs"
            >
              <span className="text-gold-400">&#x2194;</span>
              <span className="text-void-300">{c.chains.join(" + ")}</span>
              {c.proofTxHash && (
                <a
                  href={`https://hashscan.io/testnet/transaction/${c.proofTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  proof
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Event list */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {events.slice(0, 20).map((event) => {
          const chainInfo = CHAIN_LABELS[event.chain] ?? { label: event.chain, color: "text-void-400" };
          const sourceLabel = SOURCE_LABELS[event.source] ?? event.source;
          const age = getRelativeTime(event.createdAt);

          return (
            <div
              key={event.id}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-void-800/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[10px] font-bold uppercase ${chainInfo.color}`}>
                  {chainInfo.label}
                </span>
                <span className="text-xs text-void-300 truncate">{sourceLabel}</span>
                {event.correlationId && (
                  <span className="text-[9px] px-1 py-0.5 bg-gold-400/20 text-gold-400 rounded font-medium">
                    correlated
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {event.txHash && (
                  <a
                    href={getTxUrl(event.chain, event.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono text-void-600 hover:text-blue-400"
                  >
                    {event.txHash.slice(0, 8)}...
                  </a>
                )}
                <span className="text-[10px] text-void-600">{age}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getTxUrl(chain: string, txHash: string): string {
  if (chain === "hedera") return `https://hashscan.io/testnet/transaction/${txHash}`;
  // chainscan-newton.0g.ai was retired when 0G rebranded Newton → Galileo.
  if (chain === "0g-chain") return `https://chainscan-galileo.0g.ai/tx/${txHash}`;
  return "#";
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  return `${Math.floor(diff / 3_600_000)}h`;
}
