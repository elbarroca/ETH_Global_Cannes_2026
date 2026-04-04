"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Cycle } from "@/lib/types";
import {
  HCS_TOPIC_ID,
  arcTxUrl,
  hashscanMessageUrl,
  inftTokenUrl,
} from "@/lib/links";

const ACTION_STYLES: Record<string, { color: string; variant: "green" | "red" | "amber" }> = {
  BUY: { color: "text-green-400", variant: "green" },
  SELL: { color: "text-blood-400", variant: "red" },
  HOLD: { color: "text-gold-400", variant: "amber" },
};

export function HuntCard({ cycle }: { cycle: Cycle }) {
  const router = useRouter();
  const style = ACTION_STYLES[cycle.trade.action] ?? ACTION_STYLES.HOLD;
  const time = new Date(cycle.timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const specialistCount = cycle.specialists.length;
  const cost = (specialistCount * 0.001).toFixed(3);

  // Pre-compute explorer URLs so we can conditionally render them as real
  // anchor tags (stopPropagation so clicks don't bubble to the parent <button>).
  const swapHref = cycle.swap?.txHash ? (cycle.swap.explorerUrl ?? arcTxUrl(cycle.swap.txHash)) : null;
  const hcsHref = cycle.hcs.sequenceNumber > 0
    ? hashscanMessageUrl(HCS_TOPIC_ID, cycle.hcs.sequenceNumber)
    : null;
  const inftHref = cycle.inftTokenId != null ? inftTokenUrl(cycle.inftTokenId) : null;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <Card className="agent-card cursor-pointer hover:border-void-700 transition-all">
      <button
        onClick={() => router.push(`/dashboard/compute/${cycle.id}`)}
        className="w-full text-left px-4 py-3 space-y-1.5"
      >
        {/* Top row: Hunt #, time, action label */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-void-200">
              Hunt #{cycle.id}
            </span>
            <span className="text-xs text-void-600">{time}</span>
          </div>
          <Badge variant={style.variant}>{cycle.trade.action}</Badge>
        </div>

        {/* Middle: trade detail */}
        <div className="flex items-center justify-between">
          <span className={`text-lg font-bold ${style.color}`}>
            {cycle.trade.action} {cycle.trade.percentage}% {cycle.trade.asset}
          </span>
          {hcsHref ? (
            <a
              href={hcsHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stop}
              className="text-xs font-mono text-teal-400 hover:text-teal-300 underline decoration-dotted"
              title="View on Hashscan"
            >
              HCS #{cycle.hcs.sequenceNumber} ↗
            </a>
          ) : (
            cycle.hcs.sequenceNumber > 0 && (
              <span className="text-xs font-mono text-teal-500">
                HCS #{cycle.hcs.sequenceNumber}
              </span>
            )
          )}
        </div>

        {/* Bottom: metadata */}
        <div className="flex items-center gap-3 text-xs text-void-600 flex-wrap">
          <span>{specialistCount} specialists</span>
          <span className="w-1 h-1 rounded-full bg-void-700" />
          <span>{specialistCount * 2} sealed inferences</span>
          <span className="w-1 h-1 rounded-full bg-void-700" />
          <span>${cost} spent</span>
          {swapHref && cycle.swap?.txHash && (
            <>
              <span className="w-1 h-1 rounded-full bg-void-700" />
              <a
                href={swapHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={stop}
                className="text-indigo-300 hover:text-indigo-200 font-mono underline decoration-dotted"
                title="View swap tx on ArcScan"
              >
                Arc tx {cycle.swap.txHash.slice(0, 6)}…{cycle.swap.txHash.slice(-4)} ↗
              </a>
            </>
          )}
          {inftHref && cycle.inftTokenId != null && (
            <>
              <span className="w-1 h-1 rounded-full bg-void-700" />
              <a
                href={inftHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={stop}
                className="text-gold-400 hover:text-gold-300 font-mono underline decoration-dotted"
                title={`View iNFT #${cycle.inftTokenId} on 0G Chainscan`}
              >
                iNFT #{cycle.inftTokenId} ↗
              </a>
            </>
          )}
        </div>
      </button>
    </Card>
  );
}
