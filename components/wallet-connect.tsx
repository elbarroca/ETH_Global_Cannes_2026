"use client";

import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
} from "wagmi";
import { useSyncExternalStore } from "react";
import { PlugsConnectedIcon, SignOutIcon } from "@phosphor-icons/react";

export function WalletConnectButton() {
  const connection = useConnection();
  const [connector] = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const isConnected = hydrated && connection.isConnected;
  const readyConnector = hydrated ? connector : undefined;

  if (!isConnected) {
    const label = !hydrated
      ? "Connect Wallet"
      : !readyConnector
        ? "Wallet unavailable"
        : connect.isPending
        ? "Connecting…"
        : connect.error
          ? "Retry Wallet"
          : "Connect Wallet";

    return (
      <div className="relative flex items-center">
        <button
          type="button"
          disabled={!hydrated || !readyConnector || connect.isPending}
          aria-busy={hydrated && connect.isPending}
          onClick={() => {
            if (!readyConnector) return;
            connect.reset();
            connect.mutate({ connector: readyConnector });
          }}
          className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-dawg-500 px-4 py-2 text-sm font-bold text-void-950 transition-[background-color,transform] hover:bg-dawg-400 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          <PlugsConnectedIcon size={18} aria-hidden />
          {label}
        </button>
        {connect.error && (
          <p
            className="identifier-value fixed left-4 right-4 top-16 z-[80] max-h-24 overflow-auto rounded-xl border border-blood-700 bg-void-900 px-3 py-2 text-xs leading-relaxed text-blood-200 md:absolute md:left-auto md:right-0 md:top-[calc(100%+0.5rem)] md:w-80"
            role="alert"
          >
            Wallet connection failed: {connect.error.message}
          </p>
        )}
      </div>
    );
  }

  const label = disconnect.isPending
    ? "Disconnecting wallet…"
    : disconnect.error
      ? "Retry wallet disconnect"
      : "Disconnect wallet";

  return (
    <div className="relative flex items-center">
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
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-void-700 bg-void-800 text-void-300 transition-[background-color,color,transform] hover:bg-void-700 hover:text-void-100 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
      >
        <SignOutIcon size={19} aria-hidden="true" />
      </button>
      {disconnect.error && (
        <p
          className="identifier-value fixed left-4 right-4 top-16 z-[80] max-h-24 overflow-auto rounded-xl border border-blood-700 bg-void-900 px-3 py-2 text-xs leading-relaxed text-blood-200 md:absolute md:left-auto md:right-0 md:top-[calc(100%+0.5rem)] md:w-80"
          role="alert"
        >
          Wallet disconnect failed: {disconnect.error.message}
        </p>
      )}
    </div>
  );
}
