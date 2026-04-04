"use client";

import { useEffect, useRef, useState } from "react";
import { useStreamingCycle } from "@/hooks/use-streaming-cycle";
import { useUser } from "@/contexts/user-context";
import { arcTxUrl } from "@/lib/links";

// The "streaming hunt" panel — live view of a cycle as it unfolds.
// Walks through: bias suggestion → specialist hires (grouped by hirer) →
// debate turns (alpha/risk/executor) → swap quote/execution → committed.

const HIRER_COLORS: Record<string, string> = {
  alpha: "text-green-400 border-green-500/30 bg-green-500/10",
  risk: "text-blood-300 border-blood-500/30 bg-blood-500/10",
  executor: "text-gold-400 border-gold-400/30 bg-gold-400/10",
  "main-agent": "text-void-400 border-void-700 bg-void-800",
};

const TIER_LABELS: Record<string, string> = {
  alpha: "Alpha (bull)",
  risk: "Risk (bear)",
  executor: "Executor (judge)",
};

function formatElapsed(startedAt: number | null): string {
  if (!startedAt) return "0.0s";
  return `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
}

export function StreamingHuntPanel({ userId }: { userId: string | null }) {
  const [goal, setGoal] = useState("Find the best ETH entry this week — I want to accumulate");
  const stream = useStreamingCycle(userId);
  const { refreshAgentBalance } = useUser();

  // When a cycle stream finishes (running transitions true → false), refresh
  // the agent's on-chain balance once so the nav pill reflects the post-cycle
  // total without waiting for the next ticker poll. Uses a ref to detect the
  // transition so we don't refetch on every render.
  const wasRunningRef = useRef(false);
  useEffect(() => {
    if (wasRunningRef.current && !stream.running) {
      void refreshAgentBalance();
    }
    wasRunningRef.current = stream.running;
  }, [stream.running, refreshAgentBalance]);

  const start = async () => {
    if (!userId || stream.running) return;
    await stream.run(goal).catch(() => {});
  };

  const hiresByAgent = stream.specialistsHired.reduce<Record<string, typeof stream.specialistsHired>>(
    (acc, h) => {
      const key = h.hiredBy || "main-agent";
      (acc[key] = acc[key] ?? []).push(h);
      return acc;
    },
    {},
  );

  return (
    <div className="bg-void-900 rounded-2xl border border-void-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-void-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-dawg-500 animate-pulse" />
          <h3 className="text-sm font-semibold text-void-200">Streaming Hunt</h3>
          {stream.running && (
            <span className="text-xs text-void-500">
              cycle #{stream.cycleId ?? "…"} · {formatElapsed(stream.startedAt)}
            </span>
          )}
        </div>
        {stream.running && (
          <button
            onClick={stream.cancel}
            className="text-xs text-blood-300 hover:text-blood-200 underline decoration-dotted"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Goal input */}
      <div className="p-4 border-b border-void-800">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={stream.running}
            placeholder="What should the pack hunt for?"
            className="flex-1 px-3 py-2.5 bg-void-950 border border-void-800 focus:border-dawg-500 focus:outline-none rounded-lg text-sm text-void-200 placeholder:text-void-600"
          />
          <button
            onClick={start}
            disabled={stream.running || !userId || !goal.trim()}
            className="px-4 py-2.5 bg-dawg-500 hover:bg-dawg-400 disabled:opacity-50 text-void-950 text-sm font-bold rounded-lg"
          >
            {stream.running ? "Streaming…" : "🐺 Stream Hunt"}
          </button>
        </div>
      </div>

      {/* 1. Bias suggestion */}
      {stream.bias && (
        <div className="p-4 border-b border-void-800 space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-void-600">Step 1 · Bias suggestion</div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded ${
                stream.bias.bias === "BUY"
                  ? "bg-green-500/20 text-green-400"
                  : stream.bias.bias === "SELL"
                  ? "bg-blood-500/20 text-blood-300"
                  : "bg-gold-400/20 text-gold-400"
              }`}
            >
              {stream.bias.bias}
            </span>
            <span className="text-xs text-void-500">
              {stream.bias.riskProfile} · max {stream.bias.maxTradePercent}%
            </span>
          </div>
          <p className="text-xs text-void-400 italic">{stream.bias.reasoning}</p>
        </div>
      )}

      {/* 2. Specialist hires (grouped by hirer) */}
      {stream.specialistsHired.length > 0 && (
        <div className="p-4 border-b border-void-800 space-y-3">
          <div className="text-[11px] uppercase tracking-wider text-void-600">
            Step 2 · Specialist hires ({stream.specialistsHired.length})
          </div>
          {Object.entries(hiresByAgent).map(([hirer, hires]) => (
            <div key={hirer} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider ${HIRER_COLORS[hirer] ?? HIRER_COLORS["main-agent"]}`}
                >
                  {hirer}
                </span>
                <span className="text-xs text-void-600">paid {hires.length} × $0.001</span>
              </div>
              <div className="ml-2 space-y-1">
                {hires.map((h, i) => {
                  const txUrl = h.paymentTxHash && h.paymentTxHash.startsWith("0x") ? arcTxUrl(h.paymentTxHash) : null;
                  return (
                    <div key={`${h.name}-${i}`} className="flex items-center justify-between text-xs">
                      <span className="text-void-300">
                        → {h.name} <span className="text-void-500">({h.signal ?? "?"} {h.confidence ?? 0}%)</span>
                      </span>
                      {txUrl ? (
                        <a
                          href={txUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-teal-300 hover:text-teal-200 underline decoration-dotted"
                        >
                          tx ↗
                        </a>
                      ) : (
                        <span className="font-mono text-void-600">{h.paymentTxHash ?? "pending"}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Debate turns */}
      {stream.debateTurns.length > 0 && (
        <div className="p-4 border-b border-void-800 space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-void-600">Step 3 · Adversarial debate</div>
          {stream.debateTurns.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  t.tier === "alpha"
                    ? "bg-green-500"
                    : t.tier === "risk"
                    ? "bg-blood-500"
                    : "bg-gold-400"
                }`}
              />
              <span className="text-void-300 min-w-[120px]">{TIER_LABELS[t.tier] ?? t.tier}</span>
              <span className="text-void-500 truncate">
                {String((t.parsed as { action?: string }).action ?? "")} {String((t.parsed as { pct?: number }).pct ?? "")}
                {t.tier === "risk" && ` · max ${String((t.parsed as { max_pct?: number }).max_pct ?? 0)}%`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 4. Funds bridging — proxy → hot wallet */}
      {(stream.funds.transferring || stream.funds.amountUsd !== null) && (
        <div className="p-4 border-b border-void-800 space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-void-600">
            Step 4 · Funds bridge
          </div>
          {stream.funds.transferring ? (
            <div className="flex items-center gap-2 text-xs text-void-400">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
              Bridging ${stream.funds.amountUsd?.toFixed(4) ?? "?"} USDC from Circle proxy → hot wallet…
            </div>
          ) : stream.funds.skipped ? (
            <div className="text-xs text-void-500">
              Hot wallet already funded (${stream.funds.beforeUsd?.toFixed(4) ?? "?"}) — skipped Circle transfer
            </div>
          ) : (
            <div className="text-xs text-void-400 space-y-0.5">
              <div>
                ✓ bridged ${((stream.funds.afterUsd ?? 0) - (stream.funds.beforeUsd ?? 0)).toFixed(4)} USDC
              </div>
              {stream.funds.circleTxId && (
                <div className="font-mono text-[10px] text-void-600">
                  Circle tx {stream.funds.circleTxId.slice(0, 12)}…
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Swap execution on Arc */}
      {stream.swapTxHash && (
        <div className="p-4 border-b border-void-800 space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-void-600">Step 5 · Agentic swap on Arc</div>
          <a
            href={stream.swapExplorerUrl || arcTxUrl(stream.swapTxHash) || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-teal-300 hover:text-teal-200 underline decoration-dotted break-all"
          >
            {stream.swapTxHash} ↗
          </a>
        </div>
      )}

      {/* 6. Holdings update */}
      {stream.holdings && (
        <div className="p-4 border-b border-void-800 space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-void-600">Step 6 · Holdings updated</div>
          <div className="text-xs text-void-400">
            −${stream.holdings.usdcSpent.toFixed(4)} USDC · +
            <span className="text-green-400">{stream.holdings.asset}</span>
          </div>
          <div className="text-[10px] font-mono text-void-600">
            deposited now ${stream.holdings.newDepositedUsdc.toFixed(4)}
          </div>
          {Object.keys(stream.holdings.newHoldings).length > 0 && (
            <div className="text-[10px] font-mono text-void-500">
              holdings: {Object.entries(stream.holdings.newHoldings).map(([k, v]) => `${k}=${Number(v).toFixed(6)}`).join(" · ")}
            </div>
          )}
        </div>
      )}

      {/* 7. Committed */}
      {stream.committed && (
        <div className="p-4 space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-void-600">✓ Committed</div>
          <div className="text-xs text-void-400">
            Cycle #{String(stream.committed.cycleId)} · HCS seq {String(stream.committed.seqNum)} · decision{" "}
            <span className="font-bold">{String((stream.committed.decision as { action?: string })?.action ?? "?")}</span>
          </div>
        </div>
      )}

      {stream.error && (
        <div className="p-4 border-t border-blood-800/40 bg-blood-950/30">
          <p className="text-xs text-blood-300">❌ {stream.error}</p>
        </div>
      )}
    </div>
  );
}
