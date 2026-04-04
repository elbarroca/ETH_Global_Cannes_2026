"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SwarmActivityResponse, SwarmActivityRow } from "@/lib/types";
import { agentEmoji, agentLabel } from "@/lib/swarm-endpoints";

const POLL_MS = 3_000;
const LIMIT = 25;

// Action-type → color/label map. Each entry controls both the left border
// of the row and the little pill next to the action name. Keep this aligned
// with the action_type enum in src/store/action-logger.ts.
interface ActionStyle {
  label: string;
  dot: string;
  text: string;
  border: string;
}

const ACTION_STYLES: Record<string, ActionStyle> = {
  SPECIALIST_HIRED: {
    label: "HIRE",
    dot: "bg-dawg-400",
    text: "text-dawg-300",
    border: "border-l-dawg-500/60",
  },
  DEBATE_ALPHA: {
    label: "ALPHA",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    border: "border-l-emerald-500/60",
  },
  DEBATE_RISK: {
    label: "RISK",
    dot: "bg-blood-400",
    text: "text-blood-300",
    border: "border-l-blood-500/60",
  },
  DEBATE_EXECUTOR: {
    label: "EXEC",
    dot: "bg-blue-400",
    text: "text-blue-300",
    border: "border-l-blue-500/60",
  },
  HCS_LOGGED: {
    label: "HCS",
    dot: "bg-teal-400",
    text: "text-teal-300",
    border: "border-l-teal-500/60",
  },
  STORAGE_UPLOADED: {
    label: "0G",
    dot: "bg-teal-300",
    text: "text-teal-200",
    border: "border-l-teal-400/60",
  },
  INFT_UPDATED: {
    label: "iNFT",
    dot: "bg-purple-400",
    text: "text-purple-300",
    border: "border-l-purple-500/60",
  },
  TRADE_EXECUTED: {
    label: "TRADE",
    dot: "bg-gold-400",
    text: "text-gold-300",
    border: "border-l-gold-500/60",
  },
  SWAP_FAILED: {
    label: "SWAP✗",
    dot: "bg-blood-600",
    text: "text-blood-300",
    border: "border-l-blood-700/60",
  },
  CYCLE_STARTED: {
    label: "START",
    dot: "bg-void-400",
    text: "text-void-300",
    border: "border-l-void-700",
  },
  CYCLE_COMPLETED: {
    label: "DONE",
    dot: "bg-gold-300",
    text: "text-gold-200",
    border: "border-l-gold-400/60",
  },
  CYCLE_REJECTED: {
    label: "REJ",
    dot: "bg-blood-500",
    text: "text-blood-300",
    border: "border-l-blood-600/60",
  },
  AGENT_HIRED: {
    label: "PACK+",
    dot: "bg-dawg-300",
    text: "text-dawg-200",
    border: "border-l-dawg-400/60",
  },
  AGENT_FIRED: {
    label: "PACK-",
    dot: "bg-void-500",
    text: "text-void-400",
    border: "border-l-void-600",
  },
};

const DEFAULT_STYLE: ActionStyle = {
  label: "EVENT",
  dot: "bg-void-500",
  text: "text-void-400",
  border: "border-l-void-700",
};

/** Sticky sidebar widget — live feed of recent agent_actions rows. */
export function SwarmActivityTicker() {
  const [rows, setRows] = useState<SwarmActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  const fetchRows = useCallback(async () => {
    try {
      const res = await fetch(`/api/swarm/activity?limit=${LIMIT}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as SwarmActivityResponse;
      setRows(data.rows ?? []);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
    const id = setInterval(fetchRows, POLL_MS);
    return () => clearInterval(id);
  }, [fetchRows]);

  // Auto-scroll to top on new rows unless user has manually scrolled down.
  useEffect(() => {
    if (!userScrolledRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [rows]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    userScrolledRef.current = e.currentTarget.scrollTop > 40;
  };

  return (
    <div className="bg-void-900 border border-void-800 rounded-2xl overflow-hidden flex flex-col h-[560px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-void-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-dawg-400 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-void-300">
            Swarm Activity
          </span>
        </div>
        <span className="text-[10px] font-mono text-void-600">
          {rows.length} events
        </span>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-dawg-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-6 text-xs text-void-600">No swarm activity yet</div>
        ) : (
          <ul className="divide-y divide-void-800/60">
            {rows.map((row) => (
              <TickerRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function TickerRow({ row }: { row: SwarmActivityRow }) {
  const style = ACTION_STYLES[row.actionType] ?? DEFAULT_STYLE;
  const agent = row.agentName ? agentLabel(row.agentName) : null;
  const emoji = row.agentName ? agentEmoji(row.agentName) : null;
  const teeOk = row.teeVerified === true;
  const hasPayment = row.paymentTxHash && row.paymentAmount;

  return (
    <li
      className={`payment-enter px-3 py-2 border-l-2 ${style.border} hover:bg-void-800/40 transition-colors`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot} shrink-0`} />
        <span className={`font-mono text-[9px] font-bold ${style.text}`}>{style.label}</span>
        {agent && (
          <span className="font-mono text-[11px] text-void-300 truncate">
            {emoji} {agent}
          </span>
        )}
        <span className="ml-auto text-[9px] text-void-600 font-mono shrink-0">
          {relativeTime(row.createdAt)}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1 pl-3.5">
        {hasPayment && (
          <span className="text-[9px] font-mono text-emerald-300/80">
            ${Number(row.paymentAmount).toFixed(3)}
          </span>
        )}
        {row.paymentTxHash && (
          <span className="text-[9px] font-mono text-void-600 truncate max-w-[80px]">
            {row.paymentTxHash.slice(0, 8)}…
          </span>
        )}
        {teeOk && (
          <span className="text-[9px] font-mono text-gold-400">TEE ✓</span>
        )}
        {row.attestationHash && !hasPayment && (
          <span className="text-[9px] font-mono text-void-600 truncate max-w-[120px]">
            {row.attestationHash.slice(0, 14)}…
          </span>
        )}
        {row.durationMs != null && row.durationMs > 0 && (
          <span className="text-[9px] font-mono text-void-600">
            {Math.round(row.durationMs / 100) / 10}s
          </span>
        )}
      </div>
    </li>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 10_000) return "now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}
