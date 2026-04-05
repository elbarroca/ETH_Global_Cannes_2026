"use client";

import type { AgentActionRecord } from "@/lib/types";
import {
  getOrderedPipelineActions,
  formatPipelineTime,
  NODE_META,
  pipelineNodeLabel,
} from "@/components/hunt/pipeline-shared";

/**
 * Horizontal arrow diagram: ordered hunt events from the action log (same
 * source as Hunt Log), one node per included type in chronological order.
 */
export function HuntPipelineArrows({ actions }: { actions: AgentActionRecord[] }) {
  const flow = getOrderedPipelineActions(actions);

  if (flow.length === 0) {
    return (
      <p className="text-sm text-void-600 py-2">
        No pipeline events in this hunt&apos;s action log yet — expand after the cycle finishes.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-void-800 bg-void-950/50 p-4 overflow-x-auto">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-void-500 mb-3">
        Pipeline (chronological)
      </p>
      <div className="flex flex-nowrap items-stretch gap-0 min-w-min pb-1">
        {flow.map((a, i) => {
          const meta = NODE_META[a.actionType] ?? {
            short: a.actionType.slice(0, 8),
            accent: "border-void-700 bg-void-900 text-void-300",
          };
          const amt = a.paymentAmount
            ? ` $${String(a.paymentAmount).replace(/^\$/, "")}`
            : "";
          const agent = a.agentName ? ` · ${a.agentName}` : "";
          const title = `${a.actionType}${agent}${amt} @ ${formatPipelineTime(a.createdAt)}`;
          const label = pipelineNodeLabel(a);
          return (
            <div key={`${a.id}-${i}`} className="flex items-center shrink-0">
              {i > 0 && (
                <span className="px-1.5 text-void-600 font-mono text-base select-none" aria-hidden>
                  →
                </span>
              )}
              <div
                className={`rounded-xl border px-3 py-2.5 min-w-[88px] max-w-[180px] ${meta.accent}`}
                title={title}
              >
                <div className="text-xs sm:text-sm font-bold font-mono uppercase tracking-tight leading-tight">
                  {label}
                </div>
                <div className="text-[11px] sm:text-xs font-mono text-void-500 mt-1 leading-snug">
                  {formatPipelineTime(a.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
