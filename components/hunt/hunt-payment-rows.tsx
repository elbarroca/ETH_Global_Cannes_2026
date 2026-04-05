"use client";

import { useState } from "react";
import {
  arcTxUrl,
  CIRCLE_GATEWAY_BATCHED_SETTLEMENT_DOC_URL,
  CIRCLE_GATEWAY_NANOPAYMENTS_DOC_URL,
  CIRCLE_WALLET_GET_TX_DOC_URL,
} from "@/lib/links";

export type HuntPaymentProofKind = "arc_0x" | "gateway_receipt" | "circle_transfer";

export interface HuntPaymentRow {
  from: string;
  to: string;
  amount: number;
  txHash: string;
  hiredBy: string;
  chain: "arc" | "hedera";
  /** When set, drives link vs batched vs Circle labels (UUID is ambiguous otherwise). */
  proofKind?: HuntPaymentProofKind;
  /** True when another specialist row in this hunt has the same Gateway settlement id (batching). */
  sharedGatewaySettlementId?: boolean;
}

function isDirectArcTx(hash: string): boolean {
  return hash.startsWith("0x") && hash.length >= 10;
}

function isBatchedReceipt(hash: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hash);
}

function inferProofFromCyclePayment(tx: string): HuntPaymentProofKind | undefined {
  if (isDirectArcTx(tx)) return "arc_0x";
  if (isBatchedReceipt(tx)) return "gateway_receipt";
  return undefined;
}

/** Full vendor settlement string + copy (Gateway settle / Circle MPC — whatever the API returned). */
function VendorProofPanel({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="border-t border-void-800/60 bg-void-950/40 px-3 py-2.5">
      <div className="text-[9px] uppercase tracking-wider text-void-600 mb-0.5">{label}</div>
      {sublabel && <p className="text-[9px] text-void-500 mb-1 leading-snug">{sublabel}</p>}
      <div className="flex flex-wrap items-start gap-2">
        <p className="font-mono text-[10px] text-void-200 break-all leading-relaxed min-w-0 flex-1">{value}</p>
        <button
          type="button"
          onClick={copy}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-void-700/80 bg-void-900/80 text-[11px] text-void-400 hover:text-teal-300 hover:border-teal-400/40 transition-colors"
          title="Copy proof"
        >
          {copied ? "✓" : "📋"}
        </button>
      </div>
    </div>
  );
}

/** Full Arc `0x` hash + copy + ArcScan — also used under Arc execution on the hunt card. */
export function ArcTxHashPanel({ hash, explorerHref }: { hash: string; explorerHref: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="border-t border-void-800/60 bg-void-950/40 px-3 py-2.5">
      <div className="text-[9px] uppercase tracking-wider text-void-600 mb-1">
        Arc on-chain proof (vendor) — transaction hash
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <p className="font-mono text-[10px] text-teal-300/95 break-all leading-relaxed min-w-0 flex-1">
          {hash}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={copy}
            className="flex h-7 w-7 items-center justify-center rounded border border-void-700/80 bg-void-900/80 text-[11px] text-void-400 hover:text-teal-300 hover:border-teal-400/40 transition-colors"
            title="Copy transaction hash"
          >
            {copied ? "✓" : "📋"}
          </button>
          <a
            href={explorerHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-teal-400 hover:text-teal-300 underline decoration-dotted whitespace-nowrap"
          >
            ArcScan ↗
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Indexed Arc / x402 nanopayment rows for a single hunt (dashboard accordion).
 */
export function HuntIndexedPaymentRows({ payments }: { payments: HuntPaymentRow[] }) {
  if (payments.length === 0) {
    return (
      <p className="text-xs text-void-600 py-2">
        No settled payment rows on this hunt (402 / insufficient balance skips on-chain settlement).
      </p>
    );
  }

  const hasCircleTransferRow = payments.some((p) => {
    const tx = p.txHash ?? "";
    const kind =
      p.proofKind ??
      (p.from === "fund-swap" && isBatchedReceipt(tx) ? "circle_transfer" : inferProofFromCyclePayment(tx));
    return kind === "circle_transfer" && Boolean(tx);
  });

  /** Any row from committed `cycle.payments` (x402 hires), not pipeline fund-swap / arc-swap only. */
  const hasGatewayNanopaymentRow = payments.some((p) => p.hiredBy !== "pipeline");

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-void-800/60 rounded-lg border border-void-800/80 overflow-hidden">
        {payments.map((p, index) => {
          const tx = p.txHash ?? "";
          const kind =
            p.proofKind ??
            (p.from === "fund-swap" && isBatchedReceipt(tx)
              ? "circle_transfer"
              : inferProofFromCyclePayment(tx));

          const arcHref = kind === "arc_0x" || (!kind && isDirectArcTx(tx)) ? arcTxUrl(tx) : null;
          const isCircleTransfer = kind === "circle_transfer";
          const isGatewayUuid = kind === "gateway_receipt" || (!kind && !arcHref && isBatchedReceipt(tx));

          const showArcTxPanel = Boolean(arcHref && isDirectArcTx(tx));
          const hasVendorProof =
            Boolean(tx) && tx !== "no-payment" && tx !== "pending";
          const showVendorProofPanel = hasVendorProof && !showArcTxPanel;

          let vendorLabel = "Settlement proof (vendor)";
          let vendorSublabel: string | undefined;
          if (isCircleTransfer) {
            vendorLabel = "Circle MPC transfer proof (vendor)";
            vendorSublabel =
              "Exact id returned by Circle Developer Wallets when moving USDC proxy → hot wallet.";
          } else if (p.hiredBy !== "pipeline") {
            vendorLabel = "Gateway nanopayment proof (vendor)";
            vendorSublabel = isGatewayUuid
              ? "Exact string returned by Circle Gateway x402 settle (often a batch receipt id; may repeat across hires)."
              : "Exact string returned by Circle Gateway x402 settle after payment.";
          } else if (p.from === "arc-swap" || p.to === "arc-swap") {
            vendorLabel = "Arc execution proof (vendor)";
          }

          return (
            <li
              key={`${p.from}-${p.to}-${index}`}
              className="flex flex-col bg-void-900/30 overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-xs">
                <span className="font-mono text-void-600 w-7 shrink-0">#{index}</span>
                <span className="text-void-400 min-w-0 flex-1">
                  <span className="text-void-300">{p.from}</span>
                  <span className="text-void-600 mx-1">→</span>
                  <span className="text-void-200">{p.to}</span>
                  {p.sharedGatewaySettlementId && (
                    <span
                      className="ml-1.5 text-[8px] font-mono uppercase tracking-wide text-void-500 border border-void-700/80 rounded px-1 py-0"
                      title="Another specialist hire in this hunt shares this Gateway settlement id (batched settlement — still one paid nanopayment per row)."
                    >
                      batch receipt
                    </span>
                  )}
                </span>
                <span className="font-mono text-teal-300/90 tabular-nums shrink-0">
                  ${p.amount.toFixed(3)}
                </span>
                <span className="text-[10px] uppercase text-void-600 shrink-0">{p.chain}</span>
                {showArcTxPanel && (
                  <span className="text-[9px] font-mono text-void-500 shrink-0 uppercase tracking-wide">
                    on-chain
                  </span>
                )}
                {!hasVendorProof && (
                  <span className="text-[10px] text-void-600 shrink-0">
                    {tx === "pending" ? "proof pending" : "—"}
                  </span>
                )}
              </div>
              {showArcTxPanel && arcHref && <ArcTxHashPanel hash={tx} explorerHref={arcHref} />}
              {showVendorProofPanel && (
                <VendorProofPanel label={vendorLabel} value={tx} sublabel={vendorSublabel} />
              )}
            </li>
          );
        })}
      </ul>
      {hasGatewayNanopaymentRow && (
        <p className="text-[10px] text-void-500 leading-relaxed px-0.5">
          x402 hires use{" "}
          <a
            href={CIRCLE_GATEWAY_NANOPAYMENTS_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-400/90 hover:text-teal-300 underline decoration-dotted"
          >
            Circle Gateway nanopayments ↗
          </a>
          : authorizations settle in{" "}
          <a
            href={CIRCLE_GATEWAY_BATCHED_SETTLEMENT_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-400/90 hover:text-teal-300 underline decoration-dotted"
          >
            batches on-chain ↗
          </a>
          . The id shown may be a settlement receipt (UUID) or an Arc <span className="font-mono text-void-600">0x</span> when
          returned by Gateway; multiple hires can share one id when batched together.
        </p>
      )}
      {hasCircleTransferRow && (
        <p className="text-[10px] text-void-500 leading-relaxed px-0.5">
          Rows with a Circle MPC id are proxy → hot-wallet transfers (not the same as Arc{" "}
          <span className="text-void-600">tx ↗</span>). No public explorer per id —{" "}
          <a
            href={CIRCLE_WALLET_GET_TX_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline decoration-dotted"
          >
            verify via Developer Wallets API ↗
          </a>
        </p>
      )}
    </div>
  );
}
