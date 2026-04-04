"use client";

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
          <div className="text-4xl">
            <svg viewBox="0 0 120 120" className="w-16 h-16 mx-auto" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="112" height="112" rx="28" fill="#0C0A09"/>
              <path d="M28 92 L42 28 L60 48 L78 28 L92 92 Z" fill="#7F1D1D"/>
              <path d="M34 92 L46 36 L60 52 L74 36 L86 92 Z" fill="#DC2626"/>
              <circle cx="50" cy="54" r="4.5" fill="#FBBF24"/>
              <circle cx="70" cy="54" r="4.5" fill="#FBBF24"/>
              <circle cx="50" cy="54" r="2" fill="#0C0A09"/>
              <circle cx="70" cy="54" r="2" fill="#0C0A09"/>
              <path d="M55 69 L60 73 L65 69" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
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
          className="flex items-center justify-center gap-2 w-full py-3.5 px-5 bg-blood-600 hover:bg-blood-700 active:bg-blood-800 text-white font-semibold rounded-xl transition-colors"
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
