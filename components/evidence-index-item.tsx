import { EvidenceStatus } from "@/components/ui/evidence";
import type { EvidenceState } from "@/src/kernel/types";

export function EvidenceIndexItem({ title, state, detail }: { title: string; state: EvidenceState; detail: string }) {
  return <div className="flex flex-wrap items-start justify-between gap-3 border-t border-void-800 py-3"><div className="min-w-0"><h3 className="text-sm font-semibold text-void-100">{title}</h3><p className="mt-1 break-words text-xs text-void-400">{detail}</p></div><EvidenceStatus state={state} /></div>;
}
