"use client";

import { DynamicWidget } from "@dynamic-labs/sdk-react-core";

export function WalletConnectButton() {
  return (
    <DynamicWidget
      innerButtonComponent={
        <span className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors">
          Connect Wallet
        </span>
      }
    />
  );
}
