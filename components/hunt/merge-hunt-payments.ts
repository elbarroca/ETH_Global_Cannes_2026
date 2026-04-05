import type { AgentActionRecord, Cycle } from "@/lib/types";
import type { HuntPaymentProofKind, HuntPaymentRow } from "./hunt-payment-rows";

function parseAmount(raw: string | null | undefined): number {
  if (raw == null) return 0;
  const n = parseFloat(String(raw).replace(/^\$/, "").trim());
  return Number.isNaN(n) ? 0 : n;
}

function isDirectArcTx(hash: string): boolean {
  return hash.startsWith("0x") && hash.length >= 10;
}

function isGatewayReceiptUuid(hash: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hash);
}

function payloadCircleTxId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const c = (payload as { circleTxId?: unknown }).circleTxId;
  return typeof c === "string" && c.length > 4 ? c : undefined;
}

function resolvePipelineTx(a: AgentActionRecord): string {
  const h = a.paymentTxHash?.trim() ?? "";
  if (h) return h;
  if (a.actionType === "PAYMENT_SENT" && a.agentName === "fund-swap") {
    return payloadCircleTxId(a.payload) ?? "";
  }
  return "";
}

function pipelineProofKind(
  a: AgentActionRecord,
  tx: string,
): HuntPaymentProofKind | undefined {
  if (a.agentName === "fund-swap") {
    if (!tx) return undefined;
    if (isDirectArcTx(tx)) return "arc_0x";
    return "circle_transfer";
  }
  if (a.actionType === "SWAP_EXECUTED" || a.actionType === "SWAP_FAILED") {
    if (isDirectArcTx(tx)) return "arc_0x";
    return undefined;
  }
  return undefined;
}

function cyclePaymentProofKind(tx: string): HuntPaymentProofKind | undefined {
  if (isDirectArcTx(tx)) return "arc_0x";
  if (isGatewayReceiptUuid(tx)) return "gateway_receipt";
  return undefined;
}

/**
 * Merges `cycle.payments` (x402 graph from commit) with pipeline rows from
 * `agent_actions` (PAYMENT_SENT fund-swap, SWAP_EXECUTED) when JSON is empty
 * or missing fund flows.
 */
export function mergeHuntPaymentRows(cycle: Cycle, actions: AgentActionRecord[]): HuntPaymentRow[] {
  const rows: HuntPaymentRow[] = [];
  const seen = new Set<string>();

  const pushRow = (r: HuntPaymentRow, dedupeKey: string) => {
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    rows.push(r);
  };

  let cycleIdx = 0;
  for (const p of cycle.payments) {
    const amt = typeof p.amount === "number" ? p.amount : parseAmount(String(p.amount));
    const tx = p.txHash ?? "";
    // One row per marketplace / specialist payment — never dedupe by txHash alone
    // or two hires sharing a Gateway batch id would collapse to a single row.
    pushRow(
      {
        from: p.from,
        to: p.to,
        amount: amt,
        txHash: tx,
        hiredBy: p.hiredBy,
        chain: p.chain,
        proofKind: cyclePaymentProofKind(tx),
      },
      `cycle:${cycleIdx++}`,
    );
  }

  const sorted = [...actions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  for (const a of sorted) {
    if (
      a.actionType !== "PAYMENT_SENT" &&
      a.actionType !== "SWAP_EXECUTED" &&
      a.actionType !== "SWAP_FAILED"
    ) {
      continue;
    }
    const tx = resolvePipelineTx(a);
    const amt = parseAmount(a.paymentAmount);
    const from = a.agentName ?? a.actionType;
    const to =
      a.actionType === "SWAP_EXECUTED"
        ? "arc-swap"
        : a.actionType === "SWAP_FAILED"
          ? "swap-failed"
          : "settlement";
    pushRow(
      {
        from,
        to,
        amount: amt,
        txHash: tx,
        hiredBy: "pipeline",
        chain: a.paymentNetwork === "hedera" ? "hedera" : "arc",
        proofKind: pipelineProofKind(a, tx),
      },
      `action:${a.id}`,
    );
  }

  return annotateSharedGatewaySettlement(rows);
}

/**
 * When Circle Gateway returns the same settlement id for multiple specialist hires
 * (batched), flag rows so the UI can note it — each row remains one nanopayment.
 */
function annotateSharedGatewaySettlement(rows: HuntPaymentRow[]): HuntPaymentRow[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.hiredBy === "pipeline") continue;
    if (r.from === "fund-swap" || r.from === "arc-swap") continue;
    const t = r.txHash?.trim() ?? "";
    if (!t || t === "no-payment") continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return rows.map((r) => {
    if (r.hiredBy === "pipeline") return r;
    if (r.from === "fund-swap" || r.from === "arc-swap") return r;
    const t = r.txHash?.trim() ?? "";
    if (!t || t === "no-payment") return r;
    if ((counts.get(t) ?? 0) > 1) {
      return { ...r, sharedGatewaySettlementId: true };
    }
    return r;
  });
}
