"use client";

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
  /** Present when multiple x402 rows shared one Gateway settlement id (merged for display). */
  gatewayGroup?: { count: number; names: string[] };
}

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

function inferProofFromCyclePayment(tx: string): HuntPaymentProofKind | undefined {
  if (isDirectArcTx(tx)) return "arc_0x";
  if (isBatchedReceipt(tx)) return "gateway_receipt";
  return undefined;
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
          const batched = kind === "gateway_receipt" || (!kind && !arcHref && isBatchedReceipt(tx));

          return (
            <li
              key={`${p.from}-${p.to}-${index}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-xs bg-void-900/30"
            >
              <span className="font-mono text-void-600 w-7 shrink-0">#{index}</span>
              <span className="text-void-400 min-w-0 flex-1">
                <span className="text-void-300">{p.from}</span>
                {p.gatewayGroup && p.gatewayGroup.count > 1 && (
                  <span
                    className="ml-1 text-[9px] font-mono text-teal-500/90 tabular-nums"
                    title={p.gatewayGroup.names.join(", ")}
                  >
                    ×{p.gatewayGroup.count}
                  </span>
                )}
                <span className="text-void-600 mx-1">→</span>
                <span className="text-void-200">{p.to}</span>
              </span>
              <span className="font-mono text-teal-300/90 tabular-nums shrink-0">
                ${p.amount.toFixed(3)}
              </span>
              <span className="text-[10px] uppercase text-void-600 shrink-0">{p.chain}</span>
              {arcHref && (
                <a
                  href={arcHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-teal-400 hover:text-teal-300 underline decoration-dotted shrink-0"
                >
                  tx ↗
                </a>
              )}
              {isCircleTransfer && tx && (
                <span
                  className="text-[10px] font-mono text-blue-300/90 shrink-0 max-w-[140px] truncate"
                  title={`Circle wallet tx id (separate from Arc swap tx). Full id: ${tx}`}
                >
                  {truncHash(tx)}
                </span>
              )}
              {batched && (
                <span
                  title={`Circle Gateway settlement receipt: ${tx}`}
                  className="text-[10px] font-mono text-teal-400/80 cursor-help shrink-0"
                >
                  batched
                </span>
              )}
              {!arcHref && !isCircleTransfer && !batched && tx && tx !== "no-payment" && (
                <span className="text-[10px] font-mono text-void-600 truncate max-w-[140px]" title={tx}>
                  {truncHash(tx)}
                </span>
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
