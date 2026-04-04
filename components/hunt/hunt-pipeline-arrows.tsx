"use client";

import type { AgentActionRecord } from "@/lib/types";

/** Action types shown as sequential pipeline nodes (arrow diagram). */
const PIPELINE_TYPES: string[] = [
  "DEBATE_ALPHA",
  "DEBATE_RISK",
  "DEBATE_EXECUTOR",
  "STORAGE_UPLOADED",
  "HCS_LOGGED",
  "INFT_UPDATED",
  "PAYMENT_SENT",
  "SWAP_EXECUTED",
  "SWAP_FAILED",
];

const NODE_META: Record<string, { short: string; accent: string }> = {
  DEBATE_ALPHA: { short: "Alpha", accent: "border-green-500/40 bg-green-500/10 text-green-300" },
  DEBATE_RISK: { short: "Risk", accent: "border-blood-500/40 bg-blood-500/10 text-blood-300" },
  DEBATE_EXECUTOR: { short: "Executor", accent: "border-gold-500/40 bg-gold-500/10 text-gold-300" },
  STORAGE_UPLOADED: { short: "0G", accent: "border-purple-500/40 bg-purple-500/10 text-purple-300" },
  HCS_LOGGED: { short: "HCS", accent: "border-teal-500/40 bg-teal-500/10 text-teal-300" },
  INFT_UPDATED: { short: "iNFT", accent: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300" },
  PAYMENT_SENT: { short: "Pay", accent: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
  SWAP_EXECUTED: { short: "Swap", accent: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" },
  SWAP_FAILED: { short: "Swap✗", accent: "border-blood-600/50 bg-blood-900/30 text-blood-400" },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Horizontal arrow diagram: ordered hunt events from the action log (same
 * source as Hunt Log), one node per included type in chronological order.
 */
export function HuntPipelineArrows({ actions }: { actions: AgentActionRecord[] }) {
  const flow = [...actions]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .filter((a) => PIPELINE_TYPES.includes(a.actionType));

  if (flow.length === 0) {
    return (
      <p className="text-xs text-void-600 py-2">
        No pipeline events in this hunt&apos;s action log yet — expand after the cycle finishes.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-void-800 bg-void-950/50 p-3 overflow-x-auto">
      <p className="text-[10px] uppercase tracking-wider text-void-600 mb-2">Pipeline (chronological)</p>
      <div className="flex flex-nowrap items-stretch gap-0 min-w-min">
        {flow.map((a, i) => {
          const meta = NODE_META[a.actionType] ?? {
            short: a.actionType.slice(0, 8),
            accent: "border-void-700 bg-void-900 text-void-300",
          };
          const amt = a.paymentAmount
            ? ` $${String(a.paymentAmount).replace(/^\$/, "")}`
            : "";
          const agent = a.agentName ? ` · ${a.agentName}` : "";
          return (
            <div key={`${a.id}-${i}`} className="flex items-center shrink-0">
              {i > 0 && (
                <span className="px-1 text-void-600 font-mono text-sm select-none" aria-hidden>
                  →
                </span>
              )}
              <div
                className={`rounded-lg border px-2.5 py-2 min-w-[72px] max-w-[140px] ${meta.accent}`}
                title={`${a.actionType}${agent}${amt} @ ${formatTime(a.createdAt)}`}
              >
                <div className="text-[10px] font-bold font-mono uppercase tracking-tight leading-tight">
                  {meta.short}
                </div>
                <div className="text-[9px] font-mono text-void-500 mt-0.5 truncate">
                  {formatTime(a.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
