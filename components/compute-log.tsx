import type { AgentActionRecord } from "@/lib/types";

const ACTION_LABELS: Record<string, { icon: string; label: string; tint: string }> = {
  CYCLE_STARTED: { icon: "🚀", label: "Hunt initiated", tint: "text-void-400" },
  SPECIALIST_HIRED: { icon: "📡", label: "Hired", tint: "text-blue-400" },
  AGENT_HIRED: { icon: "📡", label: "Hired", tint: "text-blue-400" },
  DEBATE_ALPHA: { icon: "🟢", label: "Alpha inference (0G sealed)", tint: "text-green-400" },
  DEBATE_RISK: { icon: "🔴", label: "Risk challenge (0G sealed)", tint: "text-blood-300" },
  DEBATE_EXECUTOR: { icon: "🟡", label: "Executor decision (0G sealed)", tint: "text-gold-400" },
  HCS_LOGGED: { icon: "📝", label: "Logged to Hedera HCS", tint: "text-teal-400" },
  STORAGE_UPLOADED: { icon: "💾", label: "Stored to 0G Storage", tint: "text-purple-400" },
  INFT_UPDATED: { icon: "🎨", label: "iNFT metadata updated", tint: "text-indigo-400" },
  CYCLE_COMPLETED: { icon: "✅", label: "Hunt complete", tint: "text-emerald-400" },
  PENDING_APPROVAL: { icon: "⏳", label: "Awaiting approval", tint: "text-gold-400" },
  CYCLE_APPROVED: { icon: "✅", label: "Cycle approved", tint: "text-emerald-400" },
  CYCLE_REJECTED: { icon: "❌", label: "Cycle rejected", tint: "text-blood-400" },
  TELEGRAM_NOTIFIED: { icon: "📱", label: "Telegram notified", tint: "text-blue-300" },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ComputeLog({ actions }: { actions: AgentActionRecord[] }) {
  return (
    <div className="bg-void-950 border border-void-800 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-void-800">
        <h3 className="text-sm font-semibold text-void-300 uppercase tracking-wider">
          Hunt Log
        </h3>
      </div>
      <div className="max-h-[400px] overflow-y-auto divide-y divide-void-800/50">
        {actions.map((a) => {
          const meta = ACTION_LABELS[a.actionType] ?? {
            icon: "📋",
            label: a.actionType,
            tint: "text-void-400",
          };
          const agentSuffix = a.agentName ? ` ${a.agentName}` : "";
          const paymentSuffix =
            a.paymentAmount != null ? ` ($${a.paymentAmount})` : "";

          return (
            <div
              key={a.id}
              className="flex items-start gap-3 px-4 py-2.5 payment-enter"
            >
              <span className="text-xs font-mono text-void-600 shrink-0 pt-0.5">
                {formatTime(a.createdAt)}
              </span>
              <span className="shrink-0">{meta.icon}</span>
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${meta.tint}`}>
                  {meta.label}{agentSuffix}{paymentSuffix}
                </span>
                {a.attestationHash && (
                  <p className="text-xs font-mono text-void-700 truncate mt-0.5">
                    {a.attestationHash}
                  </p>
                )}
              </div>
              {a.durationMs != null && (
                <span className="text-xs text-void-700 shrink-0">
                  {a.durationMs}ms
                </span>
              )}
            </div>
          );
        })}
        {actions.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-void-600">
            No log entries found for this hunt.
          </div>
        )}
      </div>
    </div>
  );
}
