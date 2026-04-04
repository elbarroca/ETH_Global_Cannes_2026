"use client";

import { arcTxUrl } from "@/lib/links";
import type { PortfolioNanoPaymentsByHunt } from "@/lib/portfolio-types";

function isDirectArcTx(hash: string): boolean {
  return hash.startsWith("0x") && hash.length >= 10;
}

function isBatchedReceipt(hash: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hash);
}

function truncHash(hash: string): string {
  if (!hash || hash.length < 14) return hash || "—";
  return `${hash.slice(0, 10)}…${hash.slice(-4)}`;
}

export function NanoPaymentsPanel({ hunts }: { hunts: PortfolioNanoPaymentsByHunt[] }) {
  if (hunts.length === 0) {
    return (
      <div className="text-sm text-void-600 italic py-4">
        No Arc nanopayment rows recorded yet — they appear after specialist hires settle on
        testnet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hunts.map((hunt) => (
        <div
          key={hunt.cycleId}
          className="rounded-xl border border-void-800 bg-void-900/40 overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-void-800/80 bg-void-900/80">
            <span className="font-pixel text-[13px] text-gold-400 uppercase tracking-wider">
              Hunt #{hunt.cycleNumber}
            </span>
            <span className="text-[10px] font-mono text-void-600">
              {hunt.items.length} payment{hunt.items.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="divide-y divide-void-800/60">
            {hunt.items.map((item) => {
              const tx = item.txHash ?? "";
              const direct = isDirectArcTx(tx);
              const batched = isBatchedReceipt(tx);
              const href = direct ? arcTxUrl(tx) : null;
              return (
                <li
                  key={`${hunt.cycleId}-${item.index}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-xs"
                >
                  <span className="font-mono text-void-600 w-8 shrink-0">#{item.index}</span>
                  <span className="text-void-400 min-w-0 flex-1">
                    <span className="text-void-300">{item.from}</span>
                    <span className="text-void-600 mx-1">→</span>
                    <span className="text-void-200">{item.to}</span>
                  </span>
                  <span className="font-mono text-teal-300/90 tabular-nums shrink-0">{item.amount}</span>
                  <span className="text-[10px] uppercase text-void-600 shrink-0">{item.chain}</span>
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono text-teal-400 hover:text-teal-300 underline decoration-dotted shrink-0"
                    >
                      tx ↗
                    </a>
                  )}
                  {batched && (
                    <span
                      title={`Circle Gateway settlement receipt: ${tx}`}
                      className="text-[10px] font-mono text-teal-400/80 cursor-help shrink-0"
                    >
                      batched
                    </span>
                  )}
                  {!href && !batched && tx && tx !== "no-payment" && (
                    <span className="text-[10px] font-mono text-void-600 truncate max-w-[140px]" title={tx}>
                      {truncHash(tx)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
