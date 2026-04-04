"use client";

import { useDynamicContext, useIsLoggedIn } from "@dynamic-labs/sdk-react-core";

/**
 * Compact wallet action button.
 *
 * - Disconnected: full "Connect Wallet" CTA → opens Dynamic auth flow.
 * - Connected: minimal icon button (⋮) → opens Dynamic user profile
 *   (network switch, copy address, disconnect). The user's address + chain
 *   are displayed separately in `<Nav />` via `UserWalletPill`, so we avoid
 *   duplicating that information here.
 */
export function WalletConnectButton() {
  const { setShowAuthFlow, setShowDynamicUserProfile } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();

  if (!isLoggedIn) {
    return (
      <button
        onClick={() => setShowAuthFlow(true)}
        className="shine-sweep flex items-center gap-2 px-3 py-1.5 bg-dawg-500 hover:bg-dawg-400 text-void-950 text-sm font-bold rounded-lg transition-colors cursor-pointer"
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <button
      onClick={() => setShowDynamicUserProfile(true)}
      title="Wallet settings"
      className="flex items-center justify-center w-8 h-8 rounded-lg bg-void-800 hover:bg-void-700 border border-void-700/60 text-void-400 hover:text-void-200 transition-colors"
    >
      <svg
        viewBox="0 0 24 24"
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="19" r="1" />
      </svg>
    </button>
  );
}
