"use client";

import { useState } from "react";
import { Card, CodeBlock } from "@/components/ui/card";
import { Badge, SealedBadge, ZeroGBadge } from "@/components/ui/badge";
import { MOCK_HISTORY } from "@/lib/mock-data";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TradeLabel({ action, asset, pct }: { action: string; asset: string; pct: number }) {
  if (action === "HOLD") return <span className="font-semibold text-void-200">HOLD</span>;
  return (
    <span className="font-semibold text-void-200">
      {action} {pct}% {asset}
    </span>
  );
}

export default function HistoryPage() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const cycles = MOCK_HISTORY;

  return (
    <main className="max-w-7xl mx-auto px-5 py-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-void-100">
            Hunt log
          </h1>
        </div>
        <p className="text-sm text-void-500">
          All hunts recorded on Hedera HCS + 0G Sealed Inference
        </p>
      </div>

      {/* Hunt list */}
      <div className="space-y-1.5">
        {cycles.map((cycle) => {
          const isOpen = expanded === cycle.id;
          const { trade, adversarial, pnl, win } = cycle;

          return (
            <Card key={cycle.id}>
              {/* Collapsed row */}
              <button
                onClick={() => setExpanded(isOpen ? null : cycle.id)}
                className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-void-850 rounded-2xl transition-colors"
              >
                <span className="font-mono text-xs text-void-600 w-10 shrink-0">
                  #{cycle.id}
                </span>
                <span className="text-xs text-void-500 shrink-0 w-12">
                  {formatTime(cycle.timestamp)}
                </span>
                <span className="text-sm flex-1">
                  <TradeLabel
                    action={trade.action}
                    asset={trade.asset}
                    pct={trade.percentage}
                  />
                </span>
                <span
                  className={`text-sm font-mono font-medium ${
                    pnl > 0
                      ? "text-green-400"
                      : pnl < 0
                      ? "text-blood-300"
                      : "text-void-500"
                  }`}
                >
                  {pnl > 0 ? "+" : ""}
                  {pnl === 0 ? "$0.00" : `$${pnl.toFixed(2)}`}
                </span>
                <Badge variant={win ? "green" : "red"}>{win ? "win" : "loss"}</Badge>
                <span className="text-void-600 text-xs">{isOpen ? "▲" : "▼"}</span>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-void-800">
                  <div className="pt-3 space-y-2">
                    {/* Alpha */}
                    <div className="flex gap-2">
                      <span className="shrink-0">🟢</span>
                      <div>
                        <span className="text-xs font-semibold text-void-200">
                          Alpha
                        </span>
                        <p className="text-xs text-void-400 mt-0.5">
                          {adversarial.alpha.argument}
                        </p>
                      </div>
                    </div>
                    {/* Risk */}
                    <div className="flex gap-2">
                      <span className="shrink-0">🔴</span>
                      <div>
                        <span className="text-xs font-semibold text-void-200">
                          Risk
                        </span>
                        <p className="text-xs text-void-400 mt-0.5">
                          {adversarial.risk.argument}
                        </p>
                      </div>
                    </div>
                    {/* Executor */}
                    <div className="flex gap-2">
                      <span className="shrink-0">🟡</span>
                      <div>
                        <span className="text-xs font-semibold text-void-200">
                          Executor
                        </span>
                        <p className="text-xs text-void-400 mt-0.5">
                          {adversarial.executor.argument}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer links */}
                  <div className="flex items-center gap-3 pt-1 flex-wrap">
                    <SealedBadge />
                    <ZeroGBadge label="6 × 0G Sealed" />
                    <a
                      href={`https://hashscan.io/testnet/topic/${cycle.hcs.topicId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-teal-400 hover:underline transition-colors"
                    >
                      Verify on Hashscan →
                    </a>
                    <a
                      href="#"
                      className="text-xs text-void-400 hover:text-void-300 transition-colors"
                    >
                      Verify on 0G →
                    </a>
                    <span className="text-xs font-mono text-void-600 ml-auto">
                      HCS #{cycle.hcs.sequenceNumber}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </main>
  );
}
