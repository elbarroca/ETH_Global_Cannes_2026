"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-400 font-mono">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1.5 text-sm border border-slate-700 hover:border-red-500 rounded-lg text-slate-300 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        const connector = connectors.find((c) => c.name === "MetaMask") ?? connectors[0];
        if (connector) connect({ connector });
      }}
      className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-semibold text-white transition-colors"
    >
      Connect Wallet
    </button>
  );
}
