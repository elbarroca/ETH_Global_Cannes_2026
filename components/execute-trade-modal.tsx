"use client";

import { useState } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";

interface ExecuteTradeModalProps {
  action: "BUY" | "SELL";
  asset: string;
  percentage: number;
  navUsd: number;
  onConfirm: () => Promise<{ txId?: string; error?: string }>;
  onClose: () => void;
}

export function ExecuteTradeModal({
  action,
  asset,
  percentage,
  navUsd,
  onConfirm,
  onClose,
}: ExecuteTradeModalProps) {
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ txId?: string; error?: string } | null>(null);

  const usdcAmount = ((percentage / 100) * navUsd).toFixed(2);
  const isBuy = action === "BUY";

  async function handleConfirm() {
    setExecuting(true);
    try {
      const res = await onConfirm();
      setResult(res);
    } catch (err) {
      setResult({ error: String(err) });
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="dialog-backdrop">
      <div className="dialog-panel max-w-md">
        <div className="px-6 py-7">
          {!result ? (
            <div className="space-y-5">
              <div className="space-y-2 text-center">
                <p className="instrument-label">Confirm trade</p>
                <p className={`tnums text-2xl font-bold ${isBuy ? "text-emerald-400" : "text-blood-300"}`}>
                  {action} {percentage}% {asset}
                </p>
                <p className="flex items-center justify-center gap-2 text-sm text-void-400">
                  <span className="tnums font-mono">${usdcAmount} USDC</span>
                  {isBuy ? (
                    <ArrowRightIcon size={15} className="text-void-500" aria-hidden />
                  ) : (
                    <ArrowLeftIcon size={15} className="text-void-500" aria-hidden />
                  )}
                  <span>{asset}</span>
                </p>
              </div>

              <dl className="space-y-2.5 rounded-[12px] border border-void-800 bg-void-950 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-void-500">Amount</dt>
                  <dd className="tnums font-mono text-void-200">${usdcAmount} USDC</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-void-500">Slippage</dt>
                  <dd className="tnums font-mono text-void-200">0.5%</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-void-500">Network</dt>
                  <dd><Badge variant="blue">Arc Testnet</Badge></dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-void-500">Wallet</dt>
                  <dd><Badge variant="gray">Circle MPC</Badge></dd>
                </div>
              </dl>

              <div className="flex gap-3">
                <button
                  onClick={handleConfirm}
                  disabled={executing}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-[11px] px-4 py-3 text-sm font-bold text-white transition-colors disabled:opacity-60 ${
                    isBuy ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blood-600 hover:bg-blood-700"
                  }`}
                >
                  {executing ? (
                    <>
                      <SpinnerGapIcon size={16} className="animate-spin" aria-hidden />
                      Executing
                    </>
                  ) : (
                    `Confirm ${action}`
                  )}
                </button>
                <button
                  onClick={onClose}
                  disabled={executing}
                  className="flex-1 rounded-[11px] border border-void-700 bg-void-800 px-4 py-3 text-sm font-semibold text-void-300 transition-colors hover:bg-void-700 hover:text-void-100 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : result.txId ? (
            <div className="space-y-3 py-4 text-center">
              <CheckCircleIcon size={44} weight="fill" className="mx-auto text-emerald-400" aria-hidden />
              <p className="text-lg font-bold text-emerald-400">Trade executed</p>
              <p className="identifier-value font-mono text-xs text-void-500">Tx: {result.txId}</p>
              <button
                onClick={onClose}
                className="rounded-[11px] border border-void-700 bg-void-800 px-6 py-2.5 text-sm font-semibold text-void-300 transition-colors hover:bg-void-700 hover:text-void-100"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-3 py-4 text-center">
              <XCircleIcon size={44} weight="fill" className="mx-auto text-blood-400" aria-hidden />
              <p className="text-lg font-bold text-blood-300">Trade failed</p>
              <p className="text-sm text-void-500 text-pretty">{result.error}</p>
              <button
                onClick={onClose}
                className="rounded-[11px] border border-void-700 bg-void-800 px-6 py-2.5 text-sm font-semibold text-void-300 transition-colors hover:bg-void-700 hover:text-void-100"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
