"use client";

import { DynamicWidget } from "@dynamic-labs/sdk-react-core";

export function WalletConnectButton() {
  return (
    <DynamicWidget
      innerButtonComponent={
        <span className="flex items-center gap-2 px-3 py-1.5 bg-blood-600 hover:bg-blood-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer">
          Connect Wallet
        </span>
      }
    />
  );
}
