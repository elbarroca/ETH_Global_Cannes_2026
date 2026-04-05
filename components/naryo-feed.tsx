"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { hashscanContractUrl, NARYO_CONTRACT_ADDRESS } from "@/lib/links";
import { JsonPayloadPanel } from "@/components/json-payload-view";
import { LiveBadge } from "@/components/ui/badge";

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

const CHAIN_LABELS: Record<string, { label: string; color: string }> = {
  hedera: { label: "Hedera", color: "text-blue-400" },
  "0g-chain": { label: "0G Chain", color: "text-purple-400" },
  arc: { label: "Arc testnet", color: "text-emerald-400" },
  unknown: { label: "Unknown chain", color: "text-void-400" },
};

const CHAIN_LIGHT: Record<string, string> = {
  hedera: "text-blue-800",
  "0g-chain": "text-purple-900",
  arc: "text-emerald-800",
  unknown: "text-neutral-600",
};

function chainAccentClass(chain: string, variant: "dark" | "light"): string {
  if (variant === "light") {
    return CHAIN_LIGHT[chain] ?? "text-neutral-800";
  }
  return CHAIN_LABELS[chain]?.color ?? "text-void-400";
}

function chainDisplayName(chain: string): string {
  return CHAIN_LABELS[chain]?.label ?? chain;
}

/** Naryo filter key → short label for technical row (secondary). */
const FILTER_LABELS: Record<string, string> = {
  hcs: "HCS topic",
  hts: "HTS token",
  cycle: "Cycle",
  deposit: "Deposit",
  "og-mint": "0G mint",
  "og-metadata": "0G metadata",
  specialist: "Specialist",
  heartbeat: "Heartbeat",
  "cross-chain": "Cross-chain",
  "arc-swap": "Arc AMM",
  "mirror-evm": "Mirror → AuditLog",
};

/** One sentence for bounty reviewers — what this stream proves. */
const SOURCE_PLAIN: Record<string, string> = {
  hcs: "Consensus message on Hedera matched your audit rules.",
  hts: "Fund-token activity on Hedera was picked up by the listener.",
  cycle: "A full investment cycle completed on Hedera.",
  deposit: "A deposit was recorded for the fund.",
  "og-mint": "An agent NFT mint was detected on 0G Chain.",
  "og-metadata": "Agent metadata changed on 0G Chain (listener proves cross-chain reach).",
  specialist: "A specialist was hired on-chain.",
  heartbeat: "A scheduled heartbeat was emitted.",
  "cross-chain": "Events on two chains were correlated for the audit trail.",
  "arc-swap": "A real swap on Arc testnet was indexed — nanopayment / DeFi path.",
  "mirror-evm": "Hedera EVM mirror surfaced an AuditLog event.",
};

function plainSentenceForEvent(event: NaryoFeedEvent): string {
  const t = event.eventType?.toUpperCase();
  if (t === "TEST") {
    return "Health-check ping from the listener (safe to ignore for the demo story).";
  }
  const fromSource = SOURCE_PLAIN[event.source];
  if (fromSource) return fromSource;
  return `On-chain activity (${event.solidityEventName}) matched a Naryo filter.`;
}

function formatMiddleEllipsis(s: string, left = 6, right = 4): string {
  const t = s.trim();
  if (t.length <= left + right + 1) return t;
  return `${t.slice(0, left)}…${t.slice(-right)}`;
}

function payloadFieldEntries(
  payload: Record<string, unknown>,
  solidityEventName?: string,
): { label: string; value: string; full?: string }[] {
  const out: { label: string; value: string; full?: string }[] = [];

  const sender = payload.sender;
  if (typeof sender === "string" && sender.startsWith("0x")) {
    out.push({
      label: "From",
      value: formatMiddleEllipsis(sender, 8, 6),
      full: sender,
    });
  }

  const key = payload.key;
  if (typeof key === "string" && key.length > 0) {
    const isHex = key.startsWith("0x");
    out.push({
      label: isHex ? "Storage key" : "Key",
      value: isHex ? formatMiddleEllipsis(key, 10, 8) : formatMiddleEllipsis(key, 24, 8),
      full: key,
    });
  }

  const nodeId = payload.nodeId;
  if (typeof nodeId === "string" && nodeId.length > 0) {
    out.push({
      label: "Node",
      value: nodeId.length > 14 ? `${nodeId.slice(0, 8)}…` : nodeId,
      full: nodeId,
    });
  }

  const name = payload.name;
  if (typeof name === "string" && name.length > 0 && out.length < 4) {
    if (!solidityEventName || name !== solidityEventName) {
      out.push({ label: "Name", value: name });
    }
  }

  return out.slice(0, 4);
}

/** Replaces dense horizontal chips with a short vertical fact list for judges. */
function NaryoHumanFields({
  payload,
  payloadKind,
  solidityEventName,
  variant,
}: {
  payload: Record<string, unknown>;
  payloadKind: NaryoFeedEvent["payloadKind"];
  solidityEventName: string;
  variant: "dark" | "light";
}) {
  const rows = payloadFieldEntries(payload, solidityEventName);
  if (rows.length === 0) return null;
  const L = variant === "light";
  return (
    <dl
      className={`mt-2 grid gap-1.5 text-[11px] leading-snug border-t pt-2 ${
        L ? "border-neutral-300" : "border-void-800/50"
      }`}
    >
      {payloadKind && (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <dt className={`shrink-0 w-24 ${L ? "text-neutral-600" : "text-void-500"}`}>Recorded as</dt>
          <dd className={`font-medium ${L ? "text-neutral-900" : "text-void-300"}`}>
            {payloadKind === "CONTRACT" ? "Smart contract event" : "Transaction"}
          </dd>
        </div>
      )}
      {rows.map(({ label, value, full }) => (
        <div key={label} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <dt className={`shrink-0 w-24 ${L ? "text-neutral-600" : "text-void-500"}`}>{label}</dt>
          <dd
            className={`font-mono min-w-0 break-all ${L ? "text-neutral-900" : "text-void-300"}`}
            title={full ?? value}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function NaryoFeed({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const [events, setEvents] = useState<NaryoFeedEvent[]>([]);
  const [correlations, setCorrelations] = useState<NaryoCorrelation[]>([]);
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

  const L = variant === "light";

  if (loading) {
    return (
      <div className="space-y-3 pt-1">
        <div
          className={L ? "naryo-stream-topline-light opacity-90" : "naryo-stream-topline opacity-60"}
          aria-hidden
        />
        <div className="space-y-2 px-0.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={
                L
                  ? "h-12 rounded-lg bg-neutral-100 border-2 border-neutral-200 overflow-hidden relative"
                  : "h-12 rounded-lg bg-void-850/80 border border-void-800/60 overflow-hidden relative"
              }
            >
              <div
                className={
                  L
                    ? "absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-neutral-300/40 to-transparent animate-pulse"
                    : "absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-void-600/25 to-transparent animate-pulse"
                }
                style={{ animationDelay: `${i * 160}ms` }}
              />
            </div>
          ))}
        </div>
        <p
          className={`text-[10px] text-center font-mono tracking-wide ${L ? "text-neutral-500" : "text-void-600"}`}
        >
          Subscribing to feed…
        </p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-6 space-y-2 max-w-md mx-auto">
        <p className={`text-sm ${L ? "text-neutral-700" : "text-void-500"}`}>No multichain events yet.</p>
        <p className={`text-xs leading-relaxed ${L ? "text-neutral-600" : "text-void-600"}`}>
          Events appear here as they are indexed from the audit pipeline.
        </p>
      </div>
    );
  }

  const auditUrl = hashscanContractUrl(NARYO_CONTRACT_ADDRESS);
  const syncLabel =
    lastSyncAt != null ? formatSyncAge(lastSyncAt) : "—";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 gap-y-2">
        <div
          className={`space-y-1.5 text-[11px] leading-relaxed min-w-0 flex-1 ${
            L ? "text-neutral-700" : "text-void-400"
          }`}
        >
          <p className="min-w-0">
            Naryo matches your filters on each chain and POSTs hits into this app —{" "}
            <span className={L ? "text-neutral-900 font-medium" : "text-void-200"}>
              same feed judges can verify on-chain.
            </span>
          </p>
          <p className={`text-[10px] min-w-0 ${L ? "text-neutral-600" : "text-void-500"}`}>
            Audit contract (Hedera EVM):{" "}
            <a
              href={auditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={
                L
                  ? "text-blue-700 hover:underline font-mono text-[10px] font-semibold"
                  : "text-blue-400/95 hover:underline font-mono text-[10px]"
              }
            >
              AlphaDawgAuditLog
            </a>
            <span className={L ? "text-neutral-500" : "text-void-600"}> · </span>
            <span className={L ? "text-neutral-500" : "text-void-600"}>
              Refreshes every 5s · buffer may show before DB
            </span>
          </p>
        </div>
        <div
          className="shrink-0 flex flex-col items-end gap-1 pt-0.5 text-right"
          data-sync-tick={tick}
        >
          <LiveBadge variant={L ? "light" : "dark"} />
          <span
            className={`font-mono text-[10px] tabular-nums ${L ? "text-emerald-800 font-medium" : "text-emerald-500/85"}`}
          >
            {syncLabel}
          </span>
        </div>
      </div>

      {correlations.length > 0 && (
        <div className={`flex flex-wrap gap-2 pb-2 border-b ${L ? "border-neutral-300" : "border-void-800"}`}>
          {correlations.slice(0, 3).map((c) => (
            <div
              key={c.id}
              className={
                L
                  ? "flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border-2 border-amber-800/30 rounded-lg text-xs text-neutral-900"
                  : "flex items-center gap-1.5 px-2.5 py-1 bg-gold-400/10 border border-gold-400/30 rounded-lg text-xs"
              }
            >
              <span className={L ? "text-amber-800" : "text-gold-400"}>&#x2194;</span>
              <span className={L ? "text-neutral-800" : "text-void-300"}>{c.chains.join(" + ")}</span>
              {c.proofTxHash && (
                <a
                  href={`https://hashscan.io/testnet/transaction/${c.proofTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={L ? "text-blue-700 font-medium hover:underline" : "text-blue-400 hover:underline"}
                >
                  proof
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        className={
          L
            ? "relative rounded-xl border-2 border-neutral-900 bg-neutral-50 shadow-md overflow-hidden"
            : "relative rounded-xl border border-emerald-900/25 bg-gradient-to-b from-emerald-950/[0.12] via-void-950/40 to-void-950/20 shadow-[inset_0_1px_0_rgba(52,211,153,0.06)] overflow-hidden"
        }
      >
        <div className={L ? "naryo-stream-topline-light" : "naryo-stream-topline"} aria-hidden />
        <div className="space-y-0.5 max-h-64 overflow-y-auto pr-0.5 py-2 px-1.5">
        {events.slice(0, 20).map((event) => {
          const chainClass = chainAccentClass(event.chain, variant);
          const chainName = chainDisplayName(event.chain);
          const filterLabel = FILTER_LABELS[event.source] ?? event.source;
          const isTestProbe = event.eventType?.toUpperCase() === "TEST";
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
              className={`rounded-lg border-2 transition-colors duration-300 ${
                L
                  ? `bg-white ${
                      isNew ? "naryo-row-new-light border-emerald-600/50" : "border-neutral-300"
                    } hover:border-neutral-900 hover:bg-neutral-50`
                  : `bg-void-950/40 ${
                      isNew ? "naryo-row-new border-emerald-500/35" : "border-void-800/70"
                    } hover:border-void-600/80 hover:bg-void-900/50`
              } ${isArrive ? "naryo-row-arrive" : ""}`}
            >
              <div className="w-full text-left py-2.5 px-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <span
                        className={`text-xs font-semibold truncate ${L ? "text-neutral-900" : "text-void-200"}`}
                      >
                        {event.solidityEventName}
                      </span>
                      {isTestProbe && (
                        <span
                          className={
                            L
                              ? "shrink-0 text-[8px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border-2 border-amber-700 text-amber-900 bg-amber-100"
                              : "shrink-0 text-[8px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-500/35 text-amber-300/95 bg-amber-950/35"
                          }
                        >
                          Test ping
                        </span>
                      )}
                      {event.payloadKind && (
                        <span
                          className={`shrink-0 text-[8px] font-mono font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                            event.payloadKind === "CONTRACT"
                              ? L
                                ? "border-purple-800 text-purple-950 bg-purple-100"
                                : "border-purple-500/40 text-purple-300/95 bg-purple-950/40"
                              : L
                                ? "border-sky-800 text-sky-950 bg-sky-100"
                                : "border-sky-500/40 text-sky-300/95 bg-sky-950/35"
                          }`}
                        >
                          {event.payloadKind === "CONTRACT" ? "Contract" : "Transaction"}
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] mt-1 leading-snug pr-1 ${L ? "text-neutral-700" : "text-void-400"}`}>
                      {plainSentenceForEvent(event)}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
                      <span className={`text-[10px] font-bold uppercase ${chainClass}`}>{chainName}</span>
                      <span className={L ? "text-[10px] text-neutral-400" : "text-[10px] text-void-500"}>·</span>
                      <span
                        className={L ? "text-[10px] text-neutral-600" : "text-[10px] text-void-500"}
                        title={event.source}
                      >
                        {filterLabel}
                      </span>
                      {event.decodedSummary && !payloadIsObject && (
                        <>
                          <span className={L ? "text-[10px] text-neutral-400" : "text-[10px] text-void-500"}>·</span>
                          <span
                            className={`text-[10px] font-mono truncate max-w-[min(100%,220px)] ${
                              L ? "text-neutral-700" : "text-void-500"
                            }`}
                            title={event.decodedSummary}
                          >
                            {event.decodedSummary}
                          </span>
                        </>
                      )}
                      {event.correlationId && (
                        <span
                          className={
                            L
                              ? "text-[9px] px-1.5 py-0.5 bg-amber-100 border border-amber-800/30 text-amber-950 rounded font-medium"
                              : "text-[9px] px-1 py-0.5 bg-gold-400/20 text-gold-400 rounded font-medium"
                          }
                        >
                          Linked chains
                        </span>
                      )}
                    </div>
                    {payloadIsObject && (
                      <NaryoHumanFields
                        payload={event.decodedPayload as Record<string, unknown>}
                        payloadKind={event.payloadKind}
                        solidityEventName={event.solidityEventName}
                        variant={variant}
                      />
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                    {event.txHash && (
                      <a
                        href={getTxUrl(event.chain, event.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={
                          L
                            ? "text-[10px] text-blue-800 font-semibold hover:underline"
                            : "text-[10px] text-blue-400/90 hover:underline"
                        }
                        title={event.txHash}
                      >
                        Open in explorer
                      </a>
                    )}
                    <span className={`text-[10px] tabular-nums ${L ? "text-neutral-600 font-medium" : "text-void-600"}`}>
                      {age}
                    </span>
                    {expandable && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : event.id)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-mono transition-colors ${
                          L
                            ? expanded
                              ? "border-emerald-800 bg-emerald-100 text-emerald-950"
                              : "border-neutral-900 bg-white text-neutral-800 hover:bg-neutral-100"
                            : expanded
                              ? "border-emerald-700/50 bg-emerald-950/25 text-emerald-300/95"
                              : "border-void-700/55 bg-void-950/50 text-void-500 hover:border-void-600 hover:text-void-300"
                        }`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className={`w-3 h-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""} ${
                            L ? "text-emerald-800" : "text-emerald-500/90"
                          }`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        {expanded ? "Hide JSON" : "Raw JSON"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {expanded && expandable && (
                <div className="px-1 pb-1">
                  <JsonPayloadPanel
                    value={event.decodedPayload}
                    copied={copiedPayloadId === event.id}
                    variant={L ? "light" : "dark"}
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
