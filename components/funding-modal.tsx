"use client";

import { PlusIcon, WarningIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { DawgLogo } from "./dawg-logo";

interface FundingModalProps {
  proxyAddress: string;
  onNavigate: (href: string) => void;
}

export function FundingModal({ proxyAddress, onNavigate }: FundingModalProps) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog-panel max-w-md">
        <div className="space-y-6 px-6 py-7">
          {/* Header */}
          <div className="space-y-3 text-center">
            <DawgLogo size={128} className="mx-auto h-16 w-16 rounded-2xl" />
            <h2 className="text-xl font-bold text-void-100 text-balance">Fund your agent wallet</h2>
            <p className="mx-auto max-w-[38ch] text-sm leading-relaxed text-void-400 text-pretty">
              Your agent needs USDC to hire specialists. Each hunt costs $0.003,
              three specialists at $0.001 each.
            </p>
          </div>

          {/* Agent wallet info */}
          <div className="space-y-2 rounded-[12px] border border-void-800 bg-void-950 p-4">
            <div className="flex items-center justify-between">
              <span className="instrument-label">Agent wallet · Circle MPC</span>
              <span className="font-mono text-xs font-medium text-blood-300">$0.00 USDC</span>
            </div>
            <p className="identifier-value font-mono text-sm text-void-300">{proxyAddress}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-void-600">
              <ShieldCheckIcon size={13} aria-hidden />
              Secured by Circle MPC custody on Arc Testnet
            </p>
          </div>

          {/* Minimum deposit info */}
          <div className="flex items-start gap-3 rounded-[12px] border border-dawg-700/30 bg-dawg-500/5 p-3.5">
            <WarningIcon size={20} weight="fill" className="mt-0.5 shrink-0 text-dawg-400" aria-hidden />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-dawg-300">Minimum $1 USDC recommended</p>
              <p className="text-xs text-void-500">Enough for about 333 hunts. Deposit more anytime.</p>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => onNavigate("/deposit")}
            className="cta-primary shine-sweep flex w-full items-center justify-center gap-2 rounded-[11px] px-5 py-3.5 text-sm font-bold"
          >
            <PlusIcon size={18} weight="bold" aria-hidden />
            Deposit USDC
          </button>

          <p className="text-center text-[11px] text-void-600">
            Transfers USDC from your connected wallet to your agent&apos;s trading wallet.
          </p>
        </div>
      </div>
    </div>
  );
}
