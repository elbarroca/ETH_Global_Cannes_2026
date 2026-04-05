import type { AgentActionRecord } from "@/lib/types";

/** Types shown in chronological order (matches hunt log; excludes noisy PAYMENT_SENT rows). */
export const PIPELINE_ORDER_TYPES: string[] = [
  "SPECIALIST_HIRED",
  "DEBATE_ALPHA",
  "DEBATE_RISK",
  "DEBATE_EXECUTOR",
  "STORAGE_UPLOADED",
  "HCS_LOGGED",
  "INFT_UPDATED",
  "SWAP_EXECUTED",
  "SWAP_FAILED",
];

export const NODE_META: Record<string, { short: string; accent: string }> = {
  SPECIALIST_HIRED: { short: "Hire", accent: "border-teal-500/40 bg-teal-500/10 text-teal-300" },
  DEBATE_ALPHA: { short: "Alpha", accent: "border-green-500/40 bg-green-500/10 text-green-300" },
  DEBATE_RISK: { short: "Risk", accent: "border-blood-500/40 bg-blood-500/10 text-blood-300" },
  DEBATE_EXECUTOR: { short: "Executor", accent: "border-gold-500/40 bg-gold-500/10 text-gold-300" },
  STORAGE_UPLOADED: { short: "0G", accent: "border-purple-500/40 bg-purple-500/10 text-purple-300" },
  HCS_LOGGED: { short: "HCS", accent: "border-teal-500/40 bg-teal-500/10 text-teal-300" },
  INFT_UPDATED: { short: "iNFT", accent: "border-indigo-500/40 bg-indigo-500/10 text-indigo-300" },
  SWAP_EXECUTED: { short: "Swap", accent: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" },
  SWAP_FAILED: { short: "Swap✗", accent: "border-blood-600/50 bg-blood-900/30 text-blood-400" },
};

export function getOrderedPipelineActions(actions: AgentActionRecord[]): AgentActionRecord[] {
  return [...actions]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .filter((a) => PIPELINE_ORDER_TYPES.includes(a.actionType));
}

export function formatPipelineTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function pipelineNodeLabel(a: AgentActionRecord): string {
  if (a.actionType === "SPECIALIST_HIRED" && a.agentName) {
    const n = a.agentName;
    return n.length <= 12 ? n : `${n.slice(0, 10)}…`;
  }
  const meta = NODE_META[a.actionType];
  return meta?.short ?? a.actionType.slice(0, 8);
}
