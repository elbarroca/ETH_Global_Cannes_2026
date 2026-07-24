"use client";

import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
} from "wagmi";
import { arcTestnet } from "@/lib/arc-chain";

export function WalletConnectButton() {
  const { isConnected } = useConnection();
  const [connector] = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();

  if (!isConnected) {
    const label = !connector
      ? "Wallet unavailable"
      : connect.isPending
        ? "Connecting…"
        : connect.error
          ? "Retry Wallet"
          : "Connect Wallet";

    return (
      <>
        <button
          type="button"
          disabled={!connector || connect.isPending}
          aria-busy={connect.isPending}
          onClick={() => {
            if (!connector) return;
            connect.reset();
            connect.mutate({ connector, chainId: arcTestnet.id });
          }}
          className="shine-sweep flex items-center gap-2 rounded-lg bg-dawg-500 px-3 py-1.5 text-sm font-bold text-void-950 transition-colors hover:bg-dawg-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {label}
        </button>
        {connect.error && (
          <span className="sr-only" role="alert">
            Wallet connection failed. Try again.
          </span>
        )}
      </>
    );
  }

  const label = disconnect.isPending
    ? "Disconnecting wallet…"
    : disconnect.error
      ? "Retry wallet disconnect"
      : "Disconnect wallet";

  return (
    <>
      <button
        type="button"
        disabled={disconnect.isPending}
        aria-busy={disconnect.isPending}
        aria-label={label}
        title={label}
        onClick={() => {
          disconnect.reset();
          disconnect.mutate();
        }}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-void-700/60 bg-void-800 text-void-400 transition-colors hover:bg-void-700 hover:text-void-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span aria-hidden="true">×</span>
      </button>
      {disconnect.error && (
        <span className="sr-only" role="alert">
          Wallet disconnect failed. Try again.
        </span>
      )}
    </>
  );
}
