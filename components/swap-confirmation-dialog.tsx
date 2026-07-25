"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";

export interface SwapQuote {
  quoteRequestId: string;
  chainId: number;
  chainName: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  slippageBps: number;
  deadline: number;
  spender: string;
  calldataHash: string;
  liveBlocked: boolean;
}

interface SwapConfirmationDialogProps {
  quote: SwapQuote;
  onConfirm: (quoteRequestId: string, confirmationSig: string) => Promise<void>;
  onClose: () => void;
}

function truncate(value: string, head = 10, tail = 8): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function formatDeadline(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// SwapConfirmationDialog shows every critical swap parameter before the buyer
// signs. Requires an explicit checkbox acknowledgement. Per A6 contract:
// - buyer sees exact chain, allowlisted tokens, amounts, slippage, deadline,
//   spender, calldata hash before signing
// - "Sign & Submit" remains disabled until the checkbox is checked
// A6_BLOCKED_LIVE: actual wallet signing and on-chain submission require
// authorized Unichain Sepolia effects in EXTERNAL-EFFECTS.md.
export function SwapConfirmationDialog({ quote, onConfirm, onClose }: SwapConfirmationDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slippagePct = (quote.slippageBps / 100).toFixed(2);
  const minAmountOut = (BigInt(quote.amountOut) * BigInt(10000 - quote.slippageBps) / 10000n).toString();

  async function handleSubmit() {
    if (!confirmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // A6_BLOCKED_LIVE: wallet signing uses buyer's connected wallet via wagmi.
      // Placeholder signature records confirmation intent without live signing.
      const confirmationSig = `confirmed-by-${quote.quoteRequestId.slice(0, 8)}-at-${Date.now()}`;
      await onConfirm(quote.quoteRequestId, confirmationSig);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Swap submission failed.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open
      title="Confirm swap"
      description="Review every parameter before signing. This swap will execute on Unichain Sepolia testnet only."
      onClose={onClose}
      dismissible={!submitting}
      className="max-w-lg"
    >
      <div className="space-y-4">
        {quote.liveBlocked && (
          <div className="rounded-xl border border-gold-400/30 bg-gold-400/5 px-3 py-2 text-xs text-gold-400">
            A6_BLOCKED_LIVE — live Unichain Sepolia transaction requires authorization in EXTERNAL-EFFECTS.md. Confirmation is recorded locally.
          </div>
        )}

        <div className="rounded-xl border border-void-800 bg-void-950/60 p-3 space-y-2.5 text-xs">
          <SwapRow label="Network" value={quote.chainName} tone="bright" />
          <SwapRow label="Chain ID" value={String(quote.chainId)} />
          <SwapRow label="Token in" value={truncate(quote.tokenIn)} copyValue={quote.tokenIn} />
          <SwapRow label="Token out" value={truncate(quote.tokenOut)} copyValue={quote.tokenOut} />
          <div className="border-t border-void-800 pt-2.5 space-y-2.5">
            <SwapRow label="Amount in" value={quote.amountIn} tone="bright" />
            <SwapRow label="Quoted out" value={quote.amountOut} tone="green" />
            <SwapRow label="Min out (after slippage)" value={minAmountOut} />
            <SwapRow label="Slippage" value={`${slippagePct}%`} />
            <SwapRow label="Deadline" value={formatDeadline(quote.deadline)} />
          </div>
          <div className="border-t border-void-800 pt-2.5 space-y-2.5">
            <SwapRow label="Spender (router)" value={truncate(quote.spender)} copyValue={quote.spender} />
            <SwapRow label="Calldata hash" value={truncate(quote.calldataHash, 12, 8)} copyValue={quote.calldataHash} />
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-void-800 bg-void-950/40 p-3">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={submitting}
            className="mt-0.5 h-4 w-4 accent-dawg-500"
          />
          <span className="text-xs leading-relaxed text-void-300">
            I confirm this swap on Unichain Sepolia with the exact parameters shown above. I understand this is a testnet transaction with no real value.
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-xl border border-blood-500/30 bg-blood-900/25 px-3 py-2 text-sm text-blood-300">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-11 rounded-xl border border-void-700 px-4 text-sm font-semibold text-void-300 hover:bg-void-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!confirmed || submitting}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-dawg-500 px-5 text-sm font-bold text-black hover:bg-dawg-400 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" aria-hidden="true" />
            )}
            {submitting ? "Submitting…" : "Sign & Submit"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function SwapRow({
  label,
  value,
  tone = "default",
  copyValue,
}: {
  label: string;
  value: string;
  tone?: "default" | "bright" | "green";
  copyValue?: string;
}) {
  const toneClass =
    tone === "bright" ? "text-void-100 font-semibold" :
    tone === "green" ? "text-emerald-300 font-semibold" :
    "text-void-300";

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 font-mono uppercase tracking-wider text-void-600">{label}</span>
      <span
        className={`font-mono tabular-nums ${toneClass} ${copyValue ? "cursor-pointer hover:text-dawg-300" : ""}`}
        title={copyValue}
        onClick={copyValue ? () => navigator.clipboard.writeText(copyValue).catch(() => {}) : undefined}
      >
        {value}
        {copyValue && <span className="ml-1 text-void-600">📋</span>}
      </span>
    </div>
  );
}
