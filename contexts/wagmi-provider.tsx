"use client";

import {
  DynamicContextProvider,
  DynamicUserProfile,
} from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import {
  createConfig,
  http,
  WagmiProvider,
  useConnection,
  useSwitchChain,
} from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { UserProvider } from "./user-context";
import { AuthGuard } from "@/components/auth-guard";
import { RouteTransitionLoader } from "@/components/route-transition-loader";
import { arcTestnet, ARC_TESTNET_RPC } from "@/lib/arc-chain";

// Re-export so existing `@/contexts/wagmi-provider` importers (deposit page,
// etc.) keep working without a mass rename — the canonical definition now
// lives in lib/arc-chain.
export { arcTestnet };

const wagmiConfig = createConfig({
  chains: [arcTestnet],
  transports: { [arcTestnet.id]: http("https://rpc.testnet.arc.network") },
  // Disabled: Dynamic's EthereumWalletConnectors already discovers EVM wallets
  // via EIP-6963 and bridges them to wagmi via DynamicWagmiConnector. Wagmi's
  // own independent discovery adds duplicate injected providers (including
  // Phantom), which then show up in Dynamic's picker — disabling it here
  // ensures there is a single source of truth for wallet discovery.
  multiInjectedProviderDiscovery: false,
});

const queryClient = new QueryClient();

const DYNAMIC_ENV_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID ?? "";

// Alias for readability — same URL as the canonical constant in lib/arc-chain.
const ARC_RPC = ARC_TESTNET_RPC;

// Intercept Dynamic SDK's DRPC calls and redirect to direct Arc RPC.
// Dynamic's embedded wallet SDK hardcodes arc-testnet.drpc.org which has a
// 3-request batch limit on the free tier, causing 500 errors.
if (typeof window !== "undefined") {
  const _fetch = window.fetch;
  window.fetch = (input, init) => {
    if (typeof input === "string" && input.includes("arc-testnet.drpc.org")) {
      input = ARC_RPC;
    } else if (
      input instanceof Request &&
      input.url.includes("arc-testnet.drpc.org")
    ) {
      input = new Request(ARC_RPC, input);
    }
    return _fetch(input, init);
  };
}

const ARC_TESTNET_NETWORK = {
  blockExplorerUrls: ["https://testnet.arcscan.app"],
  chainId: arcTestnet.id,
  chainName: "Arc Testnet",
  iconUrls: ["https://app.dynamic.xyz/assets/networks/base.svg"],
  name: "Arc Testnet",
  nativeCurrency: { decimals: 18, name: "USD Coin", symbol: "USDC" },
  networkId: arcTestnet.id,
  rpcUrls: [ARC_RPC],
  privateCustomerRpcUrls: [ARC_RPC],
  vanityName: "Arc Testnet",
};

/** Auto-switch wallet to Arc Testnet + suppress 4902 unhandled rejections */
function ChainGuard({ children }: { children: ReactNode }) {
  const { chainId, isConnected } = useConnection();
  const { mutate: switchChain } = useSwitchChain();

  // Suppress unhandled wallet rejections (4902=chain not configured, 4001=user denied)
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      if (event.reason?.code === 4902 || event.reason?.code === 4001) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  // Add Arc Testnet to MetaMask with correct RPC, then switch
  useEffect(() => {
    if (!isConnected || !chainId) return;

    (async () => {
      try {
        await window.ethereum?.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${arcTestnet.id.toString(16)}`,
              chainName: "Arc Testnet",
              rpcUrls: [ARC_RPC],
              nativeCurrency: {
                name: "USD Coin",
                symbol: "USDC",
                decimals: 18,
              },
              blockExplorerUrls: ["https://testnet.arcscan.app"],
            },
          ],
        });
      } catch {
        // User rejected or already added — ignore
      }

      if (chainId !== arcTestnet.id && switchChain) {
        switchChain({ chainId: arcTestnet.id });
      }
    })();
  }, [isConnected, chainId, switchChain]);

  return <>{children}</>;
}

// Non-EVM or Solana-first wallets that should NEVER appear in the picker.
//
// Dynamic's wallet-book registers Phantom as FOUR separate entries
// (`phantom`, `phantomevm`, `phantombtc`, `phantomledger`) — which is why
// a naive key filter lets duplicates through. All variants share
// `group: "phantom"` / `chainGroup: "phantom"`, so we match on those fields
// to catch every flavor in one rule. Same logic for other Solana-first
// wallets that ship EVM modes and confuse EVM-only users.
const BLOCKED_WALLET_GROUPS = new Set([
  "phantom",
  "solflare",
  "backpack",
  "glow",
  "coin98",
  "exodus",
]);

function isBlockedWallet(wallet: {
  key?: string;
  name?: string;
  group?: string;
  chainGroup?: string;
}): boolean {
  const fields = [
    wallet.group,
    wallet.chainGroup,
    wallet.key,
    wallet.name,
  ].map((f) => (f ?? "").toLowerCase());
  return fields.some((f) =>
    Array.from(BLOCKED_WALLET_GROUPS).some((blocked) => f.includes(blocked)),
  );
}

/**
 * Remove Phantom and friends from Dynamic's connector list at the source.
 *
 * `EthereumWalletConnectors(props)` returns an array of connector class
 * constructors. Two sources seed Phantom:
 *   1. `injectedWalletOverrides = [PhantomEvm, ExodusEvm]` — hardcoded named
 *      classes; caught by `ConnectorClass.name === 'PhantomEvm'`.
 *   2. `fetchInjectedWalletConnector()` reads the static wallet-book and
 *      builds anonymous classes via `getConnectorConstructorInjectedWallet`;
 *      these set `this.name` / `this.overrideKey` in the constructor, so we
 *      have to instantiate them with dummy props to read those fields.
 *
 * Filtering here means Phantom never enters Dynamic's wallet list — not as a
 * card, not as an "install" prompt, not in the "more wallets" view. The
 * downstream `walletsFilter` below is kept purely as belt-and-suspenders.
 */
function isBlockedConnectorClass(Connector: unknown): boolean {
  if (!Connector || typeof Connector !== "function") return false;

  // Named classes (PhantomEvm, ExodusEvm). Anonymous classes report "".
  const className = ((Connector as { name?: string }).name ?? "").toLowerCase();
  if (
    Array.from(BLOCKED_WALLET_GROUPS).some((blocked) => className.includes(blocked))
  ) {
    return true;
  }

  // Anonymous wallet-book connectors set `name` + `overrideKey` in the ctor,
  // so we have to instantiate to introspect. Pass a minimal dummy props bag;
  // InjectedWalletBase only uses it lazily via getters, so this is safe.
  try {
    const instance = new (Connector as new (props: Record<string, unknown>) => {
      name?: string;
      overrideKey?: string;
    })({});
    const name = (instance.name ?? "").toLowerCase();
    const key = (instance.overrideKey ?? "").toLowerCase();
    return Array.from(BLOCKED_WALLET_GROUPS).some(
      (blocked) => name.includes(blocked) || key.includes(blocked),
    );
  } catch {
    // Can't instantiate (needs special props) — keep it to avoid false positives.
    return false;
  }
}

/** Filtered Ethereum connectors factory — drop-in replacement for `EthereumWalletConnectors`. */
const FilteredEthereumWalletConnectors: typeof EthereumWalletConnectors = (
  props,
) => {
  const connectors = EthereumWalletConnectors(props);
  return connectors.filter((c) => !isBlockedConnectorClass(c));
};

export function Providers({ children }: { children: ReactNode }) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: DYNAMIC_ENV_ID,
        walletConnectors: [FilteredEthereumWalletConnectors],
        initialAuthenticationMode: "connect-only",
        overrides: { evmNetworks: [ARC_TESTNET_NETWORK] },
        walletsFilter: (wallets) => {
          // Diagnostic: if Phantom still leaks into the list after the
          // connector-level filter, log it so we can see the actual key/name/
          // group shape and tighten the matcher.
          if (typeof window !== "undefined") {
            const leaks = wallets.filter((w) => {
              const blob = `${w.key} ${w.name} ${w.group ?? ""} ${w.chainGroup ?? ""}`.toLowerCase();
              return blob.includes("phantom");
            });
            if (leaks.length > 0) {
              console.warn(
                "[wallet-filter] Phantom leaked past connector filter:",
                leaks.map((w) => ({
                  key: w.key,
                  name: w.name,
                  group: w.group,
                  chainGroup: w.chainGroup,
                })),
              );
            }
          }
          return wallets
            .filter((w) => !isBlockedWallet(w))
            .map((w) => ({
              ...w,
              groupedWallets: w.groupedWallets?.filter(
                (gw) => !isBlockedWallet(gw),
              ),
            }));
        },
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <DynamicWagmiConnector>
            <ChainGuard>
              <UserProvider>
                <AuthGuard>{children}</AuthGuard>
                <RouteTransitionLoader />
                {/* Renders the settings modal opened by `setShowDynamicUserProfile`
                    from components/wallet-connect.tsx. Without this the custom
                    wallet-menu button in <Nav /> has nothing to open. */}
                <DynamicUserProfile />
              </UserProvider>
            </ChainGuard>
          </DynamicWagmiConnector>
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicContextProvider>
  );
}
