"use client";

import { useState, useEffect } from "react";
import { hashscanContractUrl, NARYO_CONTRACT_ADDRESS } from "@/lib/links";

interface NaryoFeedEvent {
  id: string;
  source: string;
  chain: string;
  eventType: string;
  solidityEventName: string;
  txHash: string | null;
  createdAt: string;
  correlationId?: string | null;
  decodedSummary: string | null;
  decodedPayload: unknown | null;
}

interface NaryoCorrelation {
  id: string;
  description: string;
  chains: string[];
  proofTxHash: string | null;
  createdAt: string;
}

type FeedPipeline = "buffer+db" | "db" | "mirror" | "error" | string;

const CHAIN_LABELS: Record<string, { label: string; color: string }> = {
  hedera: { label: "Hedera", color: "text-blue-400" },
  "0g-chain": { label: "0G Chain", color: "text-purple-400" },
  arc: { label: "Arc", color: "text-emerald-400" },
  unknown: { label: "Chain", color: "text-void-400" },
};

/** Naryo filter key → short label (secondary line). */
const FILTER_LABELS: Record<string, string> = {
  hcs: "filter: HCS",
  hts: "filter: HTS",
  cycle: "filter: cycle",
  deposit: "filter: deposit",
  "og-mint": "filter: og-mint",
  "og-metadata": "filter: og-metadata",
  specialist: "filter: specialist",
  heartbeat: "filter: heartbeat",
  "cross-chain": "filter: cross-chain",
  "mirror-evm": "Mirror REST → AuditLog",
};

function PipelineBanner({ pipeline }: { pipeline: FeedPipeline | null }) {
  const hint = (
    <>
      Run <code className="text-void-400">npm run dev</code> and{" "}
      <code className="text-void-400">npm run naryo:up</code> for the full nine-filter listener writing to the DB.
    </>
  );
  if (pipeline === "mirror") {
    return (
      <p className="text-[10px] text-void-500 border border-void-700/80 rounded-lg px-2 py-1.5 bg-void-850/50 leading-relaxed">
        <span className="text-void-400 font-semibold">Pipeline: Mirror fallback.</span> Hedera Mirror REST only —{" "}
        AlphaDawgAuditLog EVM logs on Hedera. {hint}
      </p>
    );
  }
  if (pipeline === "db") {
    return (
      <p className="text-[10px] text-void-500 border border-void-700/80 rounded-lg px-2 py-1.5 bg-void-850/50 leading-relaxed">
        <span className="text-void-400 font-semibold">Pipeline: DB only.</span> Events persisted from the Naryo listener; in-memory buffer empty (app may have restarted). {hint}
      </p>
    );
  }
  if (pipeline === "buffer+db") {
    return (
      <p className="text-[10px] text-void-500 border border-amber-900/40 rounded-lg px-2 py-1.5 bg-amber-950/20 leading-relaxed">
        <span className="text-amber-400/90 font-semibold">Pipeline: listener + live buffer.</span> Naryo is POSTing into this app; newest rows may be in RAM before Prisma persist.
      </p>
    );
  }
  if (pipeline === "error") {
    return (
      <p className="text-[10px] text-blood-400/90 border border-blood-900/40 rounded-lg px-2 py-1.5 bg-blood-950/20">
        Feed API returned an error — check server logs.
      </p>
    );
  }
  return null;
}

export function NaryoFeed() {
  const [events, setEvents] = useState<NaryoFeedEvent[]>([]);
  const [correlations, setCorrelations] = useState<NaryoCorrelation[]>([]);
  const [pipeline, setPipeline] = useState<FeedPipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFeed() {
      try {
        const res = await fetch("/api/naryo/feed");
        if (!res.ok) return;
        const data = await res.json();
        setEvents(data.events ?? []);
        setCorrelations(data.correlations ?? []);
        const p = typeof data.pipeline === "string" ? data.pipeline : data.source;
        setPipeline(typeof p === "string" ? p : null);
      } catch {
        /* non-fatal */
      } finally {
        setLoading(false);
      }
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
      <div className="text-center py-6 space-y-3 max-w-md mx-auto">
        <p className="text-sm text-void-500">No multichain events available.</p>
        <p className="text-xs text-void-600 leading-relaxed">
          The feed reads from the Naryo listener (writes to your DB) or falls back to Hedera Mirror for the
          AuditLog contract. If you see this, Mirror may be unreachable — check your network, or run{" "}
          <code className="bg-void-800 px-1.5 py-0.5 rounded text-void-400">npm run dev</code> on port 3000 plus{" "}
          <code className="bg-void-800 px-1.5 py-0.5 rounded text-void-400">npm run naryo:up</code> so the Docker
          listener can POST events into the app.
        </p>
      </div>
    );
  }

  const auditUrl = hashscanContractUrl(NARYO_CONTRACT_ADDRESS);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-void-800/80 bg-void-900/40 px-2.5 py-2">
        <p className="text-[11px] font-semibold text-void-300">Multichain Naryo feed</p>
        <p className="text-[10px] text-void-500 mt-0.5 leading-relaxed">
          Each row is one captured event: primary name matches the on-chain event (or HCS/HTS stream). Hedera EVM
          contract:{" "}
          <a
            href={auditUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline font-mono break-all"
          >
            AlphaDawgAuditLog
          </a>
          .
        </p>
      </div>

      <PipelineBanner pipeline={pipeline} />

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

      <div className="space-y-0.5 max-h-64 overflow-y-auto pr-0.5">
        {events.slice(0, 20).map((event) => {
          const chainInfo = CHAIN_LABELS[event.chain] ?? { label: event.chain, color: "text-void-400" };
          const filterLabel = FILTER_LABELS[event.source] ?? `filter: ${event.source}`;
          const age = getRelativeTime(event.createdAt);
          const expandable = hasExpandablePayload(event.decodedPayload);
          const expanded = expandedId === event.id;

          return (
            <div
              key={event.id}
              className="rounded-lg border border-transparent hover:border-void-800/80 hover:bg-void-800/40 transition-colors"
            >
              <div
                role={expandable ? "button" : undefined}
                tabIndex={expandable ? 0 : undefined}
                onClick={
                  expandable
                    ? () => setExpandedId(expanded ? null : event.id)
                    : undefined
                }
                onKeyDown={
                  expandable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedId(expanded ? null : event.id);
                        }
                      }
                    : undefined
                }
                className={`w-full text-left py-2 px-2 ${expandable ? "cursor-pointer" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-void-200 truncate">{event.solidityEventName}</div>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                      <span className={`text-[10px] font-bold uppercase ${chainInfo.color}`}>{chainInfo.label}</span>
                      <span className="text-[10px] text-void-500">·</span>
                      <span className="text-[10px] text-void-500">{filterLabel}</span>
                      {event.decodedSummary && (
                        <>
                          <span className="text-[10px] text-void-500">·</span>
                          <span className="text-[10px] text-void-600 truncate max-w-[200px]" title={event.decodedSummary}>
                            {event.decodedSummary}
                          </span>
                        </>
                      )}
                      {event.correlationId && (
                        <span className="text-[9px] px-1 py-0.5 bg-gold-400/20 text-gold-400 rounded font-medium">
                          correlated
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    {event.txHash && (
                      <a
                        href={getTxUrl(event.chain, event.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] font-mono text-void-600 hover:text-blue-400"
                      >
                        {event.txHash.slice(0, 8)}…
                      </a>
                    )}
                    <span className="text-[10px] text-void-600">{age}</span>
                  </div>
                </div>
                {expandable && (
                  <span className="text-[9px] text-void-600 mt-1 inline-block">
                    {expanded ? "▼ hide payload" : "▶ payload"}
                  </span>
                )}
              </div>
              {expanded && expandable && (
                <pre className="text-[9px] text-void-500 font-mono px-2 pb-2 overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap break-all border-t border-void-800/60 pt-1.5">
                  {safeStringify(event.decodedPayload)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function hasExpandablePayload(payload: unknown): boolean {
  if (payload == null) return false;
  if (typeof payload !== "object") return true;
  if (Array.isArray(payload)) return payload.length > 0;
  return Object.keys(payload as object).length > 0;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function getTxUrl(chain: string, txHash: string): string {
  if (chain === "hedera") return `https://hashscan.io/testnet/transaction/${txHash}`;
  if (chain === "0g-chain") return `https://chainscan-galileo.0g.ai/tx/${txHash}`;
  if (chain === "arc") return `https://testnet.arcscan.app/tx/${txHash}`;
  return `https://hashscan.io/testnet/transaction/${txHash}`;
}

function getRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  return `${Math.floor(diff / 3_600_000)}h`;
}
