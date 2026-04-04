"use client";

import { DawgLogo } from "./dawg-logo";

interface FundingModalProps {
  proxyAddress: string;
  onNavigate: (href: string) => void;
}

export function FundingModal({ proxyAddress, onNavigate }: FundingModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/95 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-void-900 border border-void-800 rounded-2xl p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <DawgLogo size={128} className="w-16 h-16 mx-auto rounded-2xl" />
          <h2 className="text-xl font-bold text-void-100">Fund Your Agent Wallet</h2>
          <p className="text-sm text-void-400">
            Your agent needs USDC to hire specialists. Each hunt costs $0.003 (3 specialists x $0.001).
          </p>
        </div>

        {/* Agent wallet info */}
        <div className="bg-void-950 border border-void-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-void-600">Agent Wallet (Circle MPC)</span>
            <span className="text-xs text-blood-400 font-medium">$0.00 USDC</span>
          </div>
          <p className="font-mono text-sm text-void-300 break-all">{proxyAddress}</p>
          <p className="text-[10px] text-void-600">Secured by Circle MPC custody on Arc Testnet</p>
        </div>

        {/* Minimum deposit info */}
        <div className="flex items-start gap-3 bg-gold-400/5 border border-gold-400/20 rounded-xl p-3">
          <span className="text-gold-400 text-lg mt-0.5">!</span>
          <div className="space-y-0.5">
            <p className="text-sm text-gold-400 font-medium">Minimum: $1 USDC recommended</p>
            <p className="text-xs text-void-500">Enough for ~333 hunts. You can deposit more anytime.</p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => onNavigate("/deposit")}
          className="shine-sweep flex items-center justify-center gap-2 w-full py-3.5 px-5 bg-dawg-500 hover:bg-dawg-400 active:bg-dawg-600 text-void-950 font-bold rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-6-6h12" />
          </svg>
          Deposit USDC
        </button>

        <p className="text-center text-[11px] text-void-600">
          Transfers USDC from your connected wallet to your agent&apos;s trading wallet
        </p>
      </div>
    </div>
  );
}
