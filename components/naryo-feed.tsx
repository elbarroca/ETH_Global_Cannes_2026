"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { hashscanContractUrl, NARYO_CONTRACT_ADDRESS } from "@/lib/links";
import { JsonPayloadPanel, PayloadSummaryChips } from "@/components/json-payload-view";

interface NaryoFeedEvent {
  id: string;
  source: string;
  chain: string;
  eventType: string;
  payloadKind?: "CONTRACT" | "TRANSACTION" | null;
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
  arc: { label: "Arc testnet", color: "text-emerald-400" },
  unknown: { label: "Unknown chain", color: "text-void-400" },
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
  "arc-swap": "filter: Arc AMM (testnet)",
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
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [newRowIds, setNewRowIds] = useState<Set<string>>(new Set());
  const [arriveIds, setArriveIds] = useState<Set<string>>(new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const [copiedPayloadId, setCopiedPayloadId] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/naryo/feed");
      if (!res.ok) return;
      const data = await res.json();
      const next: NaryoFeedEvent[] = data.events ?? [];
      setEvents(next);
      setCorrelations(data.correlations ?? []);
      const p = typeof data.pipeline === "string" ? data.pipeline : data.source;
      setPipeline(typeof p === "string" ? p : null);
      setLastSyncAt(Date.now());

      const nextIds = new Set(next.map((e) => e.id));
      const fresh = new Set<string>();
      const arrived = new Set<string>();
      if (seenIdsRef.current.size > 0) {
        for (const e of next) {
          if (!seenIdsRef.current.has(e.id)) {
            fresh.add(e.id);
            arrived.add(e.id);
          }
        }
      }
      seenIdsRef.current = nextIds;

      if (fresh.size > 0) {
        setNewRowIds(fresh);
        window.setTimeout(() => setNewRowIds(new Set()), 1100);
      }
      if (arrived.size > 0) {
        setArriveIds(arrived);
        window.setTimeout(() => setArriveIds(new Set()), 600);
      }
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFeed();
    const interval = setInterval(() => void fetchFeed(), 5000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  if (loading) {
    return (
      <div className="space-y-3 pt-1">
        <div className="naryo-stream-topline opacity-60" aria-hidden />
        <div className="space-y-2 px-0.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-void-850/80 border border-void-800/60 overflow-hidden relative"
            >
              <div
                className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-void-600/25 to-transparent animate-pulse"
                style={{ animationDelay: `${i * 160}ms` }}
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-center text-void-600 font-mono tracking-wide">Subscribing to feed…</p>
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
  const syncLabel =
    lastSyncAt != null ? formatSyncAge(lastSyncAt) : "—";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-void-500">
        <p className="leading-relaxed min-w-0">
          Events stream in from the listener; contract{" "}
          <a
            href={auditUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400/95 hover:underline font-mono"
          >
            AlphaDawgAuditLog
          </a>
        </p>
        <span
          className="shrink-0 font-mono text-emerald-500/90 tabular-nums flex items-center gap-1.5"
          data-sync-tick={tick}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          {syncLabel}
        </span>
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

      <div className="relative rounded-xl border border-emerald-900/25 bg-gradient-to-b from-emerald-950/[0.12] via-void-950/40 to-void-950/20 shadow-[inset_0_1px_0_rgba(52,211,153,0.06)] overflow-hidden">
        <div className="naryo-stream-topline" aria-hidden />
        <div className="space-y-0.5 max-h-64 overflow-y-auto pr-0.5 py-2 px-1.5">
        {events.slice(0, 20).map((event) => {
          const chainInfo = CHAIN_LABELS[event.chain] ?? { label: event.chain, color: "text-void-400" };
          const filterLabel = FILTER_LABELS[event.source] ?? `filter: ${event.source}`;
          const age = getRelativeTime(event.createdAt);
          const expandable = hasExpandablePayload(event.decodedPayload);
          const expanded = expandedId === event.id;
          const isNew = newRowIds.has(event.id);
          const isArrive = arriveIds.has(event.id);
          const payloadIsObject =
            event.decodedPayload != null &&
            typeof event.decodedPayload === "object" &&
            !Array.isArray(event.decodedPayload);

          return (
            <div
              key={event.id}
              className={`rounded-lg border transition-colors duration-300 ${
                isNew ? "naryo-row-new border-emerald-500/30" : "border-transparent"
              } ${isArrive ? "naryo-row-arrive" : ""} hover:border-void-700/90 hover:bg-void-850/50`}
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
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-void-200 truncate">{event.solidityEventName}</span>
                      {event.payloadKind && (
                        <span
                          className={`shrink-0 text-[8px] font-mono font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                            event.payloadKind === "CONTRACT"
                              ? "border-purple-500/40 text-purple-300/95 bg-purple-950/40"
                              : "border-sky-500/40 text-sky-300/95 bg-sky-950/35"
                          }`}
                        >
                          {event.payloadKind === "CONTRACT" ? "Contract" : "Transaction"}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                      <span className={`text-[10px] font-bold uppercase ${chainInfo.color}`}>{chainInfo.label}</span>
                      <span className="text-[10px] text-void-500">·</span>
                      <span className="text-[10px] text-void-500">{filterLabel}</span>
                      {event.decodedSummary && !payloadIsObject && (
                        <>
                          <span className="text-[10px] text-void-500">·</span>
                          <span
                            className="text-[10px] text-void-500 font-mono truncate max-w-[min(100%,220px)]"
                            title={event.decodedSummary}
                          >
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
                    {payloadIsObject && (
                      <PayloadSummaryChips
                        payload={event.decodedPayload}
                        hideKeys={event.payloadKind ? ["eventType"] : undefined}
                      />
                    )}
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
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-mono">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 transition-colors ${
                        expanded
                          ? "border-emerald-700/50 bg-emerald-950/25 text-emerald-300/95"
                          : "border-void-700/55 bg-void-950/50 text-void-500 hover:border-void-600 hover:text-void-300"
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className={`w-3 h-3 shrink-0 text-emerald-500/90 transition-transform ${expanded ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      {expanded ? "Hide payload" : "View payload"}
                    </span>
                  </div>
                )}
              </div>
              {expanded && expandable && (
                <div className="px-1 pb-1">
                  <JsonPayloadPanel
                    value={event.decodedPayload}
                    copied={copiedPayloadId === event.id}
                    onCopy={async () => {
                      try {
                        await navigator.clipboard.writeText(safeStringify(event.decodedPayload));
                        setCopiedPayloadId(event.id);
                        window.setTimeout(() => setCopiedPayloadId(null), 2000);
                      } catch {
                        /* ignore */
                      }
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
        </div>
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

function formatSyncAge(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 2) return "just now";
  if (s < 60) return `synced ${s}s ago`;
  const m = Math.floor(s / 60);
  return `synced ${m}m ago`;
}
