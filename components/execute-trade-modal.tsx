"use client";

import { useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/80 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4">
        <CardBody className="space-y-5">
          {!result ? (
            <>
              <div className="text-center space-y-2">
                <p className="text-xs text-void-500 uppercase tracking-wider">
                  Confirm Trade
                </p>
                <p className={`text-2xl font-bold ${isBuy ? "text-green-400" : "text-blood-400"}`}>
                  {action} {percentage}% {asset}
                </p>
                <p className="text-sm text-void-400">
                  ${usdcAmount} USDC {isBuy ? "→" : "←"} {asset}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-void-500">
                  <span>Amount</span>
                  <span className="text-void-200">${usdcAmount} USDC</span>
                </div>
                <div className="flex justify-between text-void-500">
                  <span>Slippage</span>
                  <span className="text-void-200">0.5%</span>
                </div>
                <div className="flex justify-between text-void-500">
                  <span>Network</span>
                  <Badge variant="blue">Base Sepolia</Badge>
                </div>
                <div className="flex justify-between text-void-500">
                  <span>Wallet</span>
                  <Badge variant="gray">Circle MPC</Badge>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleConfirm}
                  disabled={executing}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-white text-sm font-bold rounded-xl transition-colors ${
                    isBuy
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-blood-600 hover:bg-blood-700"
                  } disabled:opacity-60`}
                >
                  {executing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Executing...
                    </>
                  ) : (
                    `Confirm ${action}`
                  )}
                </button>
                <button
                  onClick={onClose}
                  disabled={executing}
                  className="flex-1 px-4 py-3 bg-void-800 hover:bg-void-700 disabled:opacity-60 text-void-300 text-sm font-bold rounded-xl transition-colors border border-void-700"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : result.txId ? (
            <div className="text-center space-y-3 py-4">
              <p className="text-3xl">✅</p>
              <p className="text-lg font-bold text-green-400">Trade Executed</p>
              <p className="text-xs font-mono text-void-500 break-all">
                Tx: {result.txId}
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-void-800 hover:bg-void-700 text-void-300 text-sm rounded-xl border border-void-700 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="text-center space-y-3 py-4">
              <p className="text-3xl">❌</p>
              <p className="text-lg font-bold text-blood-400">Trade Failed</p>
              <p className="text-sm text-void-500">{result.error}</p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-void-800 hover:bg-void-700 text-void-300 text-sm rounded-xl border border-void-700 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
