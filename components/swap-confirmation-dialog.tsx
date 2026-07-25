"use client";

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

export function SwapConfirmationDialog({ quote, onClose }: { quote: SwapQuote; onClose: () => void }) {
  return (
    <Dialog open title="Swap approval unavailable" description="Review only. This interface cannot sign or submit a transaction." onClose={onClose} className="max-w-lg">
      <p className="border-l-2 border-dawg-500 pl-3 text-sm text-dawg-300">A6_BLOCKED_LIVE</p>
      <dl className="mt-5 divide-y divide-void-800 border-y border-void-800 text-sm">
        <Row label="Chain" value={`${quote.chainName} (${quote.chainId})`} />
        <Row label="Token path" value={`${quote.tokenIn} to ${quote.tokenOut}`} />
        <Row label="Input, atomic" value={quote.amountIn} />
        <Row label="Quoted output" value={quote.amountOut} />
        <Row label="Slippage" value={`${quote.slippageBps} bps`} />
        <Row label="Spender" value={quote.spender} />
        <Row label="Calldata hash" value={quote.calldataHash} />
      </dl>
      <button type="button" disabled className="instrument-button instrument-button-secondary mt-5">Wallet execution unavailable</button>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-2 py-3 sm:grid-cols-[8rem_minmax(0,1fr)]"><dt className="text-void-500">{label}</dt><dd className="break-all font-mono text-void-200">{value}</dd></div>;
}
