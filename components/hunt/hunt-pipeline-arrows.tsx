"use client";

import type { AgentActionRecord, Cycle } from "@/lib/types";
import { formatPipelineTime } from "@/components/hunt/pipeline-shared";

/**
 * Canonical hunt pipeline diagram.
 *
 * The previous implementation filtered raw `agent_actions` rows and rendered
 * whichever ones happened to be present — if a row was missing (cycle_id
 * null, outside time window, write failure) the corresponding box simply
 * didn't appear, leaving the diagram with gaps like "RISK → EXECUTOR → SWAP"
 * with no Alpha or specialists visible.
 *
 * This version builds the canonical topology from the committed `cycle`
 * record (which is the source of truth for specialists + debate + swap +
 * proofs) and only *looks up* timestamps in `actions` as a best-effort
 * annotation. Missing timestamps render without the time — missing NODES
 * never happen because the shape is derived from the cycle itself.
 *
 * Canonical order per hunt:
 *
 *   Main agent
 *     ↓
 *   [Hired specialists, grouped by debate agent that paid for them]
 *     ↓                 ↓                 ↓
 *   Alpha             Risk             Executor
 *     ↓  (optional rebuttal)
 *   Verdict → Swap → 0G → HCS → iNFT → Sealed
 *
 * Kept as a horizontal scrollable strip (same container as before) so the
 * existing dashboard layout doesn't need adjustment.
 */
export function HuntPipelineArrows({
  cycle,
  actions,
}: {
  cycle: Cycle;
  actions: AgentActionRecord[];
}) {
  // Best-effort timestamp lookup: first row per actionType, in chronological
  // order (agent_actions are fetched ASC). We don't care if a row is missing —
  // the node still renders, the timestamp just reads "—".
  const timeOf = (actionType: string, agentName?: string): string | null => {
    for (const a of actions) {
      if (a.actionType !== actionType) continue;
      if (agentName && a.agentName !== agentName) continue;
      return formatPipelineTime(a.createdAt);
    }
    return null;
  };

  // Build the node list from cycle data.
  const nodes: PipelineNode[] = [];

  // 1. Main agent — always the first node. It's the orchestrator that hires
  //    the debate tier in hierarchical mode (or specialists directly in flat
  //    mode). The timestamp is the CYCLE_STARTED row.
  nodes.push({
    key: "main",
    short: "Main",
    sub: "orchestrator",
    accent: "border-dawg-500/50 bg-dawg-500/10 text-dawg-300",
    time: timeOf("CYCLE_STARTED"),
  });

  // 2. Hired specialists — grouped by hiredBy so the reader sees which debate
  //    agent paid for which intel. In the canonical layout every specialist
  //    gets a box; hiredBy is annotated as the subtitle.
  for (const s of cycle.specialists) {
    const hiredBy = s.hiredBy ?? "main-agent";
    nodes.push({
      key: `spec:${s.name}`,
      short: displayAgentName(s.name),
      sub: hiredBy === "main-agent" ? "hired by main" : `hired by ${hiredBy}`,
      accent: "border-teal-500/40 bg-teal-500/10 text-teal-300",
      time: timeOf("SPECIALIST_HIRED", s.name),
      emoji: s.emoji,
    });
  }

  // 3. Alpha (always present — committed cycle has three debate stages).
  nodes.push({
    key: "alpha",
    short: "Alpha",
    sub: "bull thesis",
    accent: "border-green-500/40 bg-green-500/10 text-green-300",
    time: timeOf("DEBATE_ALPHA"),
  });

  // 4. Risk.
  nodes.push({
    key: "risk",
    short: "Risk",
    sub: "challenge",
    accent: "border-blood-500/40 bg-blood-500/10 text-blood-300",
    time: timeOf("DEBATE_RISK"),
  });

  // 5. Executor.
  nodes.push({
    key: "executor",
    short: "Executor",
    sub: "verdict",
    accent: "border-gold-500/40 bg-gold-500/10 text-gold-300",
    time: timeOf("DEBATE_EXECUTOR"),
  });

  // 6. Rebuttal pass — only surfaces as a node when the round actually fired.
  if (cycle.rebuttalTriggered) {
    nodes.push({
      key: "rebuttal",
      short: "Rebuttal",
      sub: "round 2",
      accent: "border-purple-500/40 bg-purple-500/10 text-purple-300",
      time: null,
    });
  }

  // 7. Swap (if any) — present for BUY/SELL, skipped for HOLD.
  const swap = cycle.swap;
  if (swap && swap.method !== "skipped" && cycle.trade.action !== "HOLD") {
    nodes.push({
      key: "swap",
      short: swap.success ? "Swap" : "Swap✗",
      sub: swap.method ?? "arc",
      accent: swap.success
        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
        : "border-blood-600/50 bg-blood-900/30 text-blood-400",
      time: timeOf(swap.success ? "SWAP_EXECUTED" : "SWAP_FAILED"),
    });
  }

  // 8. 0G storage (non-HOLD or HOLD — always attempted).
  nodes.push({
    key: "storage",
    short: "0G",
    sub: cycle.storageHash ? "stored" : "pending",
    accent: "border-purple-500/40 bg-purple-500/10 text-purple-300",
    time: timeOf("STORAGE_UPLOADED"),
  });

  // 9. HCS.
  nodes.push({
    key: "hcs",
    short: "HCS",
    sub: cycle.hcs.sequenceNumber > 0 ? `seq #${cycle.hcs.sequenceNumber}` : "audit",
    accent: "border-teal-500/40 bg-teal-500/10 text-teal-300",
    time: timeOf("HCS_LOGGED"),
  });

  // 10. iNFT (only when this user has an iNFT).
  if (cycle.inftTokenId != null) {
    nodes.push({
      key: "inft",
      short: "iNFT",
      sub: `#${cycle.inftTokenId}`,
      accent: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300",
      time: timeOf("INFT_UPDATED"),
    });
  }

  // 11. Terminal sealed marker.
  nodes.push({
    key: "sealed",
    short: "Sealed",
    sub: `${cycle.trade.action} ${cycle.trade.percentage}% ${cycle.trade.asset}`,
    accent: "border-dawg-500/50 bg-dawg-500/10 text-dawg-300",
    time: timeOf("HUNT_COMPLETE") ?? timeOf("CYCLE_COMPLETED"),
  });

  return (
    <div className="rounded-xl border border-void-800 bg-void-950/50 p-4 overflow-x-auto">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-void-500 mb-3">
        Pipeline (canonical)
      </p>
      <div className="flex flex-nowrap items-stretch gap-0 min-w-min pb-1">
        {nodes.map((node, i) => (
          <div key={node.key} className="flex items-center shrink-0">
            {i > 0 && (
              <span
                className="px-1.5 text-void-600 font-mono text-base select-none"
                aria-hidden
              >
                →
              </span>
            )}
            <div
              className={`rounded-xl border px-3 py-2.5 min-w-[88px] max-w-[200px] ${node.accent}`}
              title={`${node.short}${node.sub ? ` · ${node.sub}` : ""}${node.time ? ` @ ${node.time}` : ""}`}
            >
              <div className="text-xs sm:text-sm font-bold font-mono uppercase tracking-tight leading-tight flex items-center gap-1.5">
                {node.emoji && <span>{node.emoji}</span>}
                <span>{node.short}</span>
              </div>
              {node.sub && (
                <div className="text-[10px] font-mono text-void-500 mt-0.5 leading-snug truncate">
                  {node.sub}
                </div>
              )}
              <div className="text-[11px] sm:text-xs font-mono text-void-500 mt-1 leading-snug">
                {node.time ?? "—"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PipelineNode {
  key: string;
  short: string;
  sub?: string;
  accent: string;
  time: string | null;
  emoji?: string;
}

/** Canonical specialist display name: capitalize + trim. */
function displayAgentName(raw: string): string {
  const map: Record<string, string> = {
    sentiment: "Sentiment",
    whale: "Whale",
    momentum: "Momentum",
    "memecoin-hunter": "Memecoin",
    "twitter-alpha": "Twitter",
    "defi-yield": "Yield",
    "news-scanner": "News",
    "onchain-forensics": "Forensics",
    "options-flow": "Options",
    "macro-correlator": "Macro",
  };
  return map[raw] ?? raw.slice(0, 10);
}
